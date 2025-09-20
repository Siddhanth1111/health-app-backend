const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();
// ... existing imports and setup ...

// Import routes
const testRoutes = require('./routes/test'); // Make sure this exists

// Use routes
app.use('/api/test', testRoutes); // Make sure this is included

// ... rest of your server code ...

// Import configurations
const { connectDatabase } = require('./config/database');
const { configureCors } = require('./middleware/cors');
const { configureSocket } = require('./config/socket');

// Import routes
const authRoutes = require('./routes/auth');
const doctorRoutes = require('./routes/doctors');
const patientRoutes = require('./routes/patients');
const consultationRoutes = require('./routes/consultations');
const testRoutes = require('./routes/test');

// Import services
const { handleSocketConnection } = require('./services/socketService');

const app = express();
const server = http.createServer(app);

// Configure CORS
configureCors(app);

// Parse JSON bodies
app.use(express.json());

// Connect to database
connectDatabase();

// Configure Socket.IO
const io = configureSocket(server);

// Make io available to routes
app.set('io', io);

// Health check route (before other routes)
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Medical consultation API is working!', 
    timestamp: new Date().toISOString(),
    status: 'healthy'
  });
});

// API Routes
app.use('/api', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/test', testRoutes);

// Socket connection handler
io.on('connection', (socket) => {
  handleSocketConnection(io, socket);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log('❌ 404 - Route not found:', req.originalUrl);
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// ✅ Use Render’s assigned PORT in production, fallback to 3000 locally
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🏥 Medical Consultation Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
