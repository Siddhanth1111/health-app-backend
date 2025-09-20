require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-consultation')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Models
const patientSchema = new mongoose.Schema({
  clerkUserId: String,
  name: String,
  email: String
}, { timestamps: true });

const doctorSchema = new mongoose.Schema({
  clerkUserId: String,
  name: String,
  email: String,
  specialty: { type: String, default: 'General Physician' },
  experience: { type: Number, default: 5 },
  consultationFee: { type: Number, default: 100 },
  isVerified: { type: Boolean, default: true }
}, { timestamps: true });

const Patient = mongoose.model('Patient', patientSchema);
const Doctor = mongoose.model('Doctor', doctorSchema);

// Simple storage for connected users and calls
const connectedUsers = new Map();
const activeCalls = new Map();

// Socket handling
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  socket.on('register-user', async (data) => {
    const { userId, userType, userName } = data;
    console.log('📝 Registering:', userName, 'as', userType);
    
    try {
      let dbUser;
      if (userType === 'patient') {
        dbUser = await Patient.findOne({ clerkUserId: userId }) || 
                 await Patient.create({ clerkUserId: userId, name: userName, email: `${userId}@temp.com` });
      } else if (userType === 'doctor') {
        dbUser = await Doctor.findOne({ clerkUserId: userId }) || 
                 await Doctor.create({ 
                   clerkUserId: userId, 
                   name: userName, 
                   email: `${userId}@temp.com`,
                   specialty: 'General Physician',
                   experience: 5,
                   consultationFee: 100,
                   isVerified: true
                 });
      }

      connectedUsers.set(userId, {
        socketId: socket.id,
        userName: dbUser.name,
        userType: userType,
        dbId: dbUser._id.toString()
      });

      socket.userId = userId;
      socket.userType = userType;
      socket.join(`user_${userId}`);

      socket.emit('registration-success', { userId, userName: dbUser.name, userType });
      
      if (userType === 'doctor') {
        io.emit('doctor-online', { doctorId: dbUser._id.toString(), doctorName: dbUser.name });
      }

      console.log('✅ Registered successfully:', dbUser.name);
    } catch (error) {
      console.error('❌ Registration error:', error);
      socket.emit('registration-error', { message: error.message });
    }
  });

  socket.on('initiate-call', (data) => {
    const { targetDoctorId, patientName } = data;
    console.log('📞 Call to doctor:', targetDoctorId, 'from:', patientName);

    const doctor = Array.from(connectedUsers.values()).find(
      user => user.dbId === targetDoctorId && user.userType === 'doctor'
    );

    if (!doctor) {
      socket.emit('call-failed', { message: 'Doctor is not available' });
      return;
    }

    const callId = `call_${Date.now()}`;
    const roomId = `room_${callId}`;
    
    activeCalls.set(callId, {
      callId, roomId,
      caller: socket.userId,
      callerName: patientName,
      receiver: targetDoctorId,
      receiverName: doctor.userName,
      status: 'ringing'
    });

    io.to(doctor.socketId).emit('incoming-call', {
      callId, roomId,
      callerName: patientName,
      callerId: socket.userId
    });

    socket.emit('call-initiated', { callId, roomId, doctorName: doctor.userName });
    console.log('✅ Call initiated:', callId);
  });

  socket.on('respond-to-call', (data) => {
    const { callId, accepted } = data;
    const call = activeCalls.get(callId);

    if (!call) return;

    if (accepted) {
      call.status = 'active';
      socket.join(call.roomId);
      
      const caller = connectedUsers.get(call.caller);
      if (caller) {
        io.sockets.sockets.get(caller.socketId)?.join(call.roomId);
      }

      io.to(call.roomId).emit('call-accepted', {
        callId, roomId: call.roomId,
        participants: {
          patient: { id: call.caller, name: call.callerName },
          doctor: { id: call.receiver, name: call.receiverName }
        }
      });
      console.log('✅ Call accepted:', callId);
    } else {
      const caller = connectedUsers.get(call.caller);
      if (caller) {
        io.to(caller.socketId).emit('call-rejected', { callId, doctorName: call.receiverName });
      }
      activeCalls.delete(callId);
      console.log('❌ Call rejected:', callId);
    }
  });

  socket.on('webrtc-signal', (data) => {
    socket.to(data.roomId).emit('webrtc-signal', {
      signal: data.signal,
      type: data.type,
      from: socket.userId
    });
  });

  socket.on('end-call', (data) => {
    io.to(data.roomId).emit('call-ended', { callId: data.callId });
    activeCalls.delete(data.callId);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    if (socket.userId) {
      const user = connectedUsers.get(socket.userId);
      if (user && user.userType === 'doctor') {
        io.emit('doctor-offline', { doctorId: user.dbId });
      }
      connectedUsers.delete(socket.userId);
    }
  });
});

// API Routes
app.get('/api/doctors', async (req, res) => {
  try {
    const doctors = await Doctor.find({ isVerified: true });
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/me', (req, res) => {
  res.json({ needsOnboarding: false });
});

app.get('/', (req, res) => {
  res.json({ message: 'Medical Consultation API is running!' });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
