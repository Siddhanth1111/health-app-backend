const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

const app = express();
const server = http.createServer(app);

// FIXED CORS Configuration for Vite (port 5173)
const corsOptions = {
  origin: [
    "http://localhost:5173",      // Vite default port
    "http://127.0.0.1:5173",     // Vite with 127.0.0.1
    "http://localhost:3001",      // Create React App port (fallback)
    "http://127.0.0.1:3001",     
    "http://localhost:3000",      // Backend port
    "http://127.0.0.1:3000"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  credentials: true
};

// Apply CORS to Express
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Configure Socket.IO with CORS for port 5173
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:5173",      // Vite default port
      "http://127.0.0.1:5173",     
      "http://localhost:3001",      // Fallback
      "http://127.0.0.1:3001",
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true
  },
  allowEIO3: true,
  transports: ['websocket', 'polling']
});

app.use(express.json());

// Add headers middleware for additional CORS handling
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3001',
    'http://127.0.0.1:3001'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/videocall-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Store connected users
const connectedUsers = new Map();

// Test route
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend is working!', 
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    corsEnabled: true
  });
});

// Get all users (for user list)
app.get('/api/users', async (req, res) => {
  try {
    console.log('📋 GET /api/users - Fetching users...');
    const users = await User.find({}, '-password').sort({ name: 1 });
    const usersWithStatus = users.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.getAvatarUrl(),
      isOnline: connectedUsers.has(user._id.toString()),
      lastSeen: user.lastSeen
    }));
    
    console.log(`✅ Returning ${users.length} users, ${connectedUsers.size} online`);
    res.json(usersWithStatus);
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
});

// Get current user info
app.get('/api/users/me/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId, '-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.getAvatarUrl(),
      isOnline: connectedUsers.has(user._id.toString())
    });
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user', details: error.message });
  }
});

// Create dummy users (for testing)
app.post('/api/users/seed', async (req, res) => {
  try {
    console.log('🌱 POST /api/users/seed - Creating dummy users...');
    console.log('🌐 Request origin:', req.headers.origin);
    
    // Check if users already exist
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      console.log('✅ Users already exist, skipping seed');
      const users = await User.find({}, '-password').sort({ name: 1 });
      return res.json({ message: 'Users already exist', users });
    }
    
    const dummyUsers = [
      {
        name: 'John Doe',
        email: 'john@example.com'
      },
      {
        name: 'Jane Smith',
        email: 'jane@example.com'
      },
      {
        name: 'Mike Johnson',
        email: 'mike@example.com'
      },
      {
        name: 'Sarah Wilson',
        email: 'sarah@example.com'
      },
      {
        name: 'David Brown',
        email: 'david@example.com'
      }
    ];
    
    const users = await User.insertMany(dummyUsers);
    console.log('✅ Created dummy users:', users.length);
    res.json({ message: 'Dummy users created successfully', users, count: users.length });
  } catch (error) {
    console.error('❌ Error creating dummy users:', error);
    res.status(500).json({ error: 'Failed to create dummy users', details: error.message });
  }
});

// Rest of your socket.io code remains the same...
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  socket.on('register-user', async (userId) => {
    try {
      console.log('📝 Registering user:', userId, 'with socket:', socket.id);
      
      if (!userId || typeof userId !== 'string') {
        console.error('❌ Invalid userId provided:', userId);
        socket.emit('registration-error', { message: 'Invalid user ID' });
        return;
      }

      const user = await User.findById(userId);
      if (!user) {
        console.error('❌ User not found in database:', userId);
        socket.emit('registration-error', { message: 'User not found' });
        return;
      }

      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        socketId: socket.id,
        lastSeen: new Date()
      });
      
      connectedUsers.set(userId, {
        socketId: socket.id,
        userId: userId,
        userName: user.name
      });
      
      socket.userId = userId;
      console.log(`✅ User ${user.name} (${userId}) registered with socket ${socket.id}`);
      console.log(`👥 Total connected users: ${connectedUsers.size}`);
      
      socket.emit('user-registered', {
        userId: userId,
        userName: user.name,
        message: 'Successfully registered'
      });
      
      socket.broadcast.emit('user-status-changed', {
        userId,
        isOnline: true
      });
    } catch (error) {
      console.error('❌ Error registering user:', error);
      socket.emit('registration-error', { message: 'Registration failed' });
    }
  });

  socket.on('initiate-call', async (data) => {
    console.log('📞 Call initiation request:', data);
    
    if (!socket.userId) {
      console.error('❌ Socket not registered, cannot initiate call');
      socket.emit('error', { message: 'Please register first' });
      return;
    }
    
    const targetUser = connectedUsers.get(data.targetUserId);
    
    if (!targetUser) {
      console.log('❌ Target user not found or offline:', data.targetUserId);
      socket.emit('user-not-available', { 
        message: 'User is not available',
        targetUserId: data.targetUserId 
      });
      return;
    }
    
    try {
      const callerUser = await User.findById(socket.userId);
      const callData = {
        fromUserId: socket.userId,
        fromUserName: callerUser ? callerUser.name : data.fromUserName || 'Unknown User',
        fromUserAvatar: callerUser ? callerUser.getAvatarUrl() : null
      };
      
      console.log(`📞 Sending call to ${targetUser.userName} (${data.targetUserId})`);
      io.to(targetUser.socketId).emit('incoming-call', callData);
      
      socket.emit('call-initiated', {
        targetUserId: data.targetUserId,
        targetUserName: targetUser.userName
      });
      
    } catch (error) {
      console.error('❌ Error initiating call:', error);
      socket.emit('error', { message: 'Failed to initiate call' });
    }
  });

  socket.on('calling', async (message) => {
    console.log('📡 Calling message:', message.type, 'from:', socket.userId, 'to:', message.targetUserId);
    
    const targetUser = connectedUsers.get(message.targetUserId);
    
    if (!targetUser) {
      console.log('❌ Target user not found for calling message:', message.targetUserId);
      socket.emit('user-not-available', { message: 'User not available' });
      return;
    }
    
    const messageWithSender = {
      ...message,
      fromUserId: socket.userId
    };
    
    console.log(`📤 Forwarding ${message.type} to ${targetUser.userName}`);
    io.to(targetUser.socketId).emit('calling', messageWithSender);
  });

  socket.on('call-response', (data) => {
    console.log('📞 Call response:', data.accepted ? 'ACCEPTED' : 'REJECTED', 'from:', socket.userId);
    
    const targetUser = connectedUsers.get(data.targetUserId);
    
    if (targetUser) {
      console.log(`📤 Sending response to ${targetUser.userName}`);
      io.to(targetUser.socketId).emit('call-response', {
        ...data,
        fromUserId: socket.userId
      });
    } else {
      console.log('❌ Target user not found for call response:', data.targetUserId);
    }
  });

  socket.on('disconnect', async () => {
    console.log('🔌 User disconnecting:', socket.id);
    
    if (socket.userId) {
      try {
        const user = connectedUsers.get(socket.userId);
        
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          socketId: null,
          lastSeen: new Date()
        });
        
        connectedUsers.delete(socket.userId);
        console.log(`❌ User ${user?.userName || 'Unknown'} (${socket.userId}) disconnected`);
        console.log(`👥 Remaining connected users: ${connectedUsers.size}`);
        
        socket.broadcast.emit('user-status-changed', {
          userId: socket.userId,
          isOnline: false
        });
      } catch (error) {
        console.error('❌ Error updating user offline status:', error);
      }
    }
  });

  socket.on('connect_error', (error) => {
    console.error('🔌 Connection error:', error);
  });
});

io.engine.on("connection_error", (err) => {
  console.error('🔌 Engine connection error:');
  console.error('Request:', err.req);
  console.error('Code:', err.code);
  console.error('Message:', err.message);
  console.error('Context:', err.context);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 MongoDB URI: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/videocall-app'}`);
  console.log(`🌐 CORS enabled for port 5173 (Vite)`);
  console.log(`🔌 Socket.IO transports: websocket, polling`);
});
