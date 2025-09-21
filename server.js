const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import routes
const appointmentRoutes = require('./routes/appointments');
const prescriptionRoutes = require('./routes/prescriptions');
const doctorRoutes = require('./routes/doctors');
const patientRoutes = require('./routes/patients');

// Import models
const Appointment = require('./models/Appointment');
const Doctor = require('./models/Doctor');
const Patient = require('./models/Patient');
const Medicine = require('./models/Medicine');
const Prescription = require('./models/Prescription');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Socket.IO setup with enhanced configuration
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:5173", 
      "http://localhost:5174",
      "https://health-app-frontend-drab.vercel.app",
      process.env.FRONTEND_URL
    ].filter(Boolean),
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowEIO3: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174", 
    "https://health-app-frontend-drab.vercel.app",
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files for prescriptions and uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-consultation';
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      heartbeatFrequencyMS: 2000,
      retryWrites: true,
      w: 'majority'
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Seed medicines if collection is empty
    const medicineCount = await Medicine.countDocuments();
    if (medicineCount === 0) {
      console.log('📊 Seeding medicines database...');
      const { seedMedicines } = require('./seedMedicines');
      await seedMedicines();
    }
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Routes
app.use('/api/appointments', appointmentRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/patients', patientRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      socket: 'active'
    }
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Medical Consultation Platform API',
    version: '1.0.0',
    description: 'Backend API for video consultations with prescription system',
    features: [
      'Video call rooms with WebRTC',
      'In-call prescription creation',
      'Medicine database with search',
      'PDF prescription generation',
      'Appointment scheduling (5 AM - 9 PM)',
      'Real-time Socket.IO communication'
    ],
    endpoints: {
      appointments: '/api/appointments',
      prescriptions: '/api/prescriptions',
      doctors: '/api/doctors',
      patients: '/api/patients',
      health: '/health'
    }
  });
});

// Socket.IO connection handling
const activeRooms = new Map();
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log(`🔗 User connected: ${socket.id}`);

  // Join video call room
  socket.on('join-room', async (data) => {
    try {
      const { roomId, userId, userType, userName } = data;
      
      // Leave any existing rooms
      socket.rooms.forEach(room => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });

      // Join the new room
      socket.join(roomId);
      
      // Store user information
      userSockets.set(userId, {
        socketId: socket.id,
        roomId,
        userType,
        userName,
        joinedAt: new Date()
      });

      // Update room information
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, {
          participants: new Map(),
          createdAt: new Date(),
          appointmentId: data.appointmentId
        });
      }

      const room = activeRooms.get(roomId);
      room.participants.set(userId, {
        userId,
        userType,
        userName,
        socketId: socket.id,
        joinedAt: new Date()
      });

      console.log(`👥 ${userName} (${userType}) joined room ${roomId}`);

      // Notify other participants
      socket.to(roomId).emit('user-joined', {
        userId,
        userType,
        userName,
        participantCount: room.participants.size
      });

      // Send current room state to the newly joined user
      socket.emit('room-state', {
        roomId,
        participants: Array.from(room.participants.values()),
        participantCount: room.participants.size
      });

      // Update appointment status to 'ongoing' if both doctor and patient are present
      if (room.participants.size >= 2 && data.appointmentId) {
        try {
          await Appointment.findOneAndUpdate(
            { appointmentId: data.appointmentId },
            { 
              status: 'ongoing',
              callStartTime: new Date()
            }
          );
          console.log(`📞 Appointment ${data.appointmentId} marked as ongoing`);
        } catch (error) {
          console.error('Error updating appointment status:', error);
        }
      }

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle WebRTC signaling
  socket.on('webrtc-signal', (data) => {
    const { roomId, signal, type } = data;
    console.log(`📡 WebRTC signal (${type}) in room ${roomId}`);
    
    // Broadcast the signal to other participants in the room
    socket.to(roomId).emit('webrtc-signal', {
      signal,
      type,
      from: socket.id
    });
  });

  // Handle prescription creation during call
  socket.on('prescription-created', async (data) => {
    try {
      const { roomId, prescriptionData, appointmentId } = data;
      
      console.log(`💊 Prescription created in room ${roomId}`);
      
      // Broadcast to all participants in the room
      io.to(roomId).emit('prescription-created', {
        prescriptionId: prescriptionData.prescriptionId,
        message: 'Prescription has been created and saved',
        appointmentId
      });

      // Update appointment with prescription ID
      if (appointmentId) {
        await Appointment.findOneAndUpdate(
          { appointmentId },
          { prescriptionId: prescriptionData.prescriptionId }
        );
      }

    } catch (error) {
      console.error('Error handling prescription creation:', error);
      socket.emit('error', { message: 'Failed to process prescription creation' });
    }
  });

  // Handle call end
  socket.on('end-call', async (data) => {
    try {
      const { roomId, appointmentId } = data;
      
      console.log(`📵 Call ended in room ${roomId}`);
      
      // Notify all participants
      io.to(roomId).emit('call-ended', {
        message: 'Call has been ended',
        endedBy: socket.id,
        endedAt: new Date()
      });

      // Update appointment status
      if (appointmentId) {
        const endTime = new Date();
        const appointment = await Appointment.findOne({ appointmentId });
        
        if (appointment && appointment.callStartTime) {
          const duration = Math.round((endTime - appointment.callStartTime) / (1000 * 60));
          
          await Appointment.findOneAndUpdate(
            { appointmentId },
            { 
              status: 'completed',
              callEndTime: endTime,
              callDuration: duration
            }
          );
          
          console.log(`✅ Appointment ${appointmentId} completed (${duration} minutes)`);
        }
      }

      // Clean up room
      if (activeRooms.has(roomId)) {
        const room = activeRooms.get(roomId);
        room.participants.forEach((participant, userId) => {
          userSockets.delete(userId);
        });
        activeRooms.delete(roomId);
      }

    } catch (error) {
      console.error('Error ending call:', error);
    }
  });

  // Handle chat messages during call
  socket.on('chat-message', (data) => {
    const { roomId, message, userId, userName, timestamp } = data;
    
    console.log(`💬 Chat message in room ${roomId} from ${userName}`);
    
    // Broadcast message to all participants in the room
    io.to(roomId).emit('chat-message', {
      message,
      userId,
      userName,
      timestamp: timestamp || new Date(),
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
  });

  // Handle appointment reminders
  socket.on('appointment-reminder', async (data) => {
    try {
      const { appointmentId, type } = data; // type: '15min', '5min', 'now'
      
      const appointment = await Appointment.findOne({ appointmentId })
        .populate('doctorId', 'name')
        .populate('patientId', 'name');

      if (appointment) {
        const doctorSocket = userSockets.get(appointment.doctorClerkId);
        const patientSocket = userSockets.get(appointment.patientClerkId);

        const reminderMessage = {
          appointmentId,
          type,
          doctor: appointment.doctorId.name,
          patient: appointment.patientId.name,
          time: appointment.timeSlot,
          date: appointment.appointmentDate,
          meetingRoomId: appointment.meetingRoomId
        };

        if (doctorSocket) {
          io.to(doctorSocket.socketId).emit('appointment-reminder', reminderMessage);
        }

        if (patientSocket) {
          io.to(patientSocket.socketId).emit('appointment-reminder', reminderMessage);
        }

        console.log(`⏰ Reminder sent for appointment ${appointmentId} (${type})`);
      }

    } catch (error) {
      console.error('Error sending appointment reminder:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
    
    // Find and remove user from active sessions
    let disconnectedUserId = null;
    let disconnectedRoomId = null;

    userSockets.forEach((userData, userId) => {
      if (userData.socketId === socket.id) {
        disconnectedUserId = userId;
        disconnectedRoomId = userData.roomId;
        userSockets.delete(userId);
      }
    });

    // Remove from active rooms and notify other participants
    if (disconnectedRoomId && activeRooms.has(disconnectedRoomId)) {
      const room = activeRooms.get(disconnectedRoomId);
      
      if (disconnectedUserId && room.participants.has(disconnectedUserId)) {
        const participant = room.participants.get(disconnectedUserId);
        room.participants.delete(disconnectedUserId);

        // Notify remaining participants
        socket.to(disconnectedRoomId).emit('user-left', {
          userId: disconnectedUserId,
          userName: participant.userName,
          userType: participant.userType,
          participantCount: room.participants.size
        });

        console.log(`👋 ${participant.userName} left room ${disconnectedRoomId}`);
      }

      // Clean up empty rooms
      if (room.participants.size === 0) {
        activeRooms.delete(disconnectedRoomId);
        console.log(`🧹 Cleaned up empty room ${disconnectedRoomId}`);
      }
    }
  });

  // Handle connection errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Periodic cleanup of inactive rooms (every 30 minutes)
setInterval(() => {
  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

  activeRooms.forEach((room, roomId) => {
    if (room.createdAt < thirtyMinutesAgo && room.participants.size === 0) {
      activeRooms.delete(roomId);
      console.log(`🧹 Cleaned up inactive room ${roomId}`);
    }
  });
}, 30 * 60 * 1000);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/api/appointments',
      '/api/prescriptions', 
      '/api/doctors',
      '/api/patients',
      '/health'
    ]
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  
  // Close Socket.IO server
  io.close(() => {
    console.log('🔌 Socket.IO server closed');
  });

  // Close HTTP server
  server.close(async () => {
    console.log('🌐 HTTP server closed');
    
    // Close MongoDB connection
    try {
      await mongoose.connection.close();
      console.log('🗄️ MongoDB connection closed');
    } catch (error) {
      console.error('Error closing MongoDB connection:', error);
    }
    
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  process.emit('SIGTERM');
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();
    
    // Start the server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 API available at http://localhost:${PORT}/api`);
      console.log(`🏥 Health check at http://localhost:${PORT}/health`);
      console.log(`📡 Socket.IO ready for connections`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io };
