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

const appointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  patientClerkId: { type: String, required: true },
  doctorClerkId: { type: String, required: true },
  appointmentDate: { type: Date, required: true },
  appointmentTime: { type: String, required: true },
  status: { type: String, enum: ['scheduled', 'in-progress', 'completed', 'cancelled'], default: 'scheduled' },
  reason: { type: String, required: true },
  consultationFee: { type: Number, required: true },
  duration: { type: Number, default: 30 },
  callStarted: { type: Boolean, default: false }
}, { timestamps: true });

const Patient = mongoose.model('Patient', patientSchema);
const Doctor = mongoose.model('Doctor', doctorSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);

// Simple storage for connected users and calls
const connectedUsers = new Map();
const activeCalls = new Map();

// Helper function to check if appointment time is active (±15 minutes)
const isAppointmentTimeActive = (appointmentDate, appointmentTime) => {
  const now = new Date();
  const [hours, minutes] = appointmentTime.split(':');
  const appointmentDateTime = new Date(appointmentDate);
  appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  const timeDifference = Math.abs(now - appointmentDateTime);
  const fifteenMinutes = 15 * 60 * 1000; // 15 minutes in milliseconds
  
  return timeDifference <= fifteenMinutes;
};

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

  // Updated call initiation with appointment check
  socket.on('initiate-call', async (data) => {
    const { targetDoctorId, patientName, appointmentId } = data;
    console.log('📞 Call to doctor:', targetDoctorId, 'with appointment:', appointmentId);

    try {
      // Verify appointment exists and is active
      const appointment = await Appointment.findById(appointmentId)
        .populate('patientId')
        .populate('doctorId');

      if (!appointment) {
        socket.emit('call-failed', { message: 'Invalid appointment' });
        return;
      }

      if (appointment.status !== 'scheduled') {
        socket.emit('call-failed', { message: 'Appointment is not active' });
        return;
      }

      // Check if it's the right time for the appointment
      if (!isAppointmentTimeActive(appointment.appointmentDate, appointment.appointmentTime)) {
        socket.emit('call-failed', { message: 'Call only allowed during appointment time (±15 minutes)' });
        return;
      }

      // Check if caller is the patient for this appointment
      if (appointment.patientClerkId !== socket.userId) {
        socket.emit('call-failed', { message: 'Unauthorized to make this call' });
        return;
      }

      const doctor = connectedUsers.get(appointment.doctorClerkId);

      if (!doctor) {
        socket.emit('call-failed', { message: 'Doctor is not available' });
        return;
      }

      // Update appointment status
      appointment.status = 'in-progress';
      appointment.callStarted = true;
      await appointment.save();

      const callId = `call_${Date.now()}`;
      const roomId = `room_${callId}`;
      
      activeCalls.set(callId, {
        callId, roomId,
        caller: socket.userId,
        callerName: patientName,
        receiver: appointment.doctorClerkId,
        receiverName: doctor.userName,
        appointmentId: appointmentId,
        status: 'ringing'
      });

      io.to(doctor.socketId).emit('incoming-call', {
        callId, roomId,
        callerName: patientName,
        callerId: socket.userId,
        appointmentId: appointmentId,
        appointmentTime: appointment.appointmentTime,
        reason: appointment.reason
      });

      socket.emit('call-initiated', { callId, roomId, doctorName: doctor.userName });
      console.log('✅ Call initiated with appointment:', callId);
    } catch (error) {
      console.error('❌ Error initiating call:', error);
      socket.emit('call-failed', { message: 'Failed to initiate call' });
    }
  });

  // Rest of socket handlers remain the same
  socket.on('respond-to-call', async (data) => {
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

      // Reset appointment status if call rejected
      if (call.appointmentId) {
        try {
          await Appointment.findByIdAndUpdate(call.appointmentId, {
            status: 'scheduled',
            callStarted: false
          });
        } catch (error) {
          console.error('Error updating appointment on reject:', error);
        }
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

  socket.on('end-call', async (data) => {
    io.to(data.roomId).emit('call-ended', { callId: data.callId });
    
    // Complete the appointment
    const call = activeCalls.get(data.callId);
    if (call && call.appointmentId) {
      try {
        await Appointment.findByIdAndUpdate(call.appointmentId, {
          status: 'completed',
          callEndedAt: new Date()
        });
        console.log('✅ Appointment completed:', call.appointmentId);
      } catch (error) {
        console.error('Error updating appointment on end:', error);
      }
    }
    
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
    console.log('📋 Doctors requested, found:', doctors.length);
    res.json(doctors);
  } catch (error) {
    console.error('❌ Error fetching doctors:', error);
    res.status(500).json({ error: error.message });
  }
});

// Appointment Routes
app.post('/api/appointments', async (req, res) => {
  try {
    const { doctorId, patientClerkId, appointmentDate, appointmentTime, reason } = req.body;
    
    // Find doctor and patient
    const doctor = await Doctor.findById(doctorId);
    const patient = await Patient.findOne({ clerkUserId: patientClerkId });
    
    if (!doctor || !patient) {
      return res.status(404).json({ error: 'Doctor or patient not found' });
    }

    // Check for existing appointment at same time
    const existingAppointment = await Appointment.findOne({
      doctorId: doctorId,
      appointmentDate: new Date(appointmentDate),
      appointmentTime: appointmentTime,
      status: 'scheduled'
    });

    if (existingAppointment) {
      return res.status(400).json({ error: 'Time slot already booked' });
    }

    const appointment = new Appointment({
      patientId: patient._id,
      doctorId: doctor._id,
      patientClerkId: patientClerkId,
      doctorClerkId: doctor.clerkUserId,
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      reason,
      consultationFee: doctor.consultationFee
    });

    await appointment.save();
    
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('doctorId')
      .populate('patientId');
    
    res.status(201).json(populatedAppointment);
  } catch (error) {
    console.error('❌ Error creating appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get patient appointments
app.get('/api/appointments/patient/:patientClerkId', async (req, res) => {
  try {
    const appointments = await Appointment.find({ 
      patientClerkId: req.params.patientClerkId,
      status: { $in: ['scheduled', 'in-progress'] }
    })
    .populate('doctorId')
    .sort({ appointmentDate: 1, appointmentTime: 1 });
    
    res.json(appointments);
  } catch (error) {
    console.error('❌ Error fetching patient appointments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get doctor appointments
app.get('/api/appointments/doctor/:doctorClerkId', async (req, res) => {
  try {
    const appointments = await Appointment.find({ 
      doctorClerkId: req.params.doctorClerkId,
      status: { $in: ['scheduled', 'in-progress'] }
    })
    .populate('patientId')
    .sort({ appointmentDate: 1, appointmentTime: 1 });
    
    res.json(appointments);
  } catch (error) {
    console.error('❌ Error fetching doctor appointments:', error);
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
