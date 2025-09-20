const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

// Simple in-memory storage for connected users and active calls
const connectedUsers = new Map(); // userId -> {socketId, userName, userType, isOnline}
const activeCalls = new Map(); // callId -> {caller, receiver, status, roomId}

const handleSocketConnection = (io, socket) => {
  console.log('🔌 New socket connection:', socket.id);

  // Register user when they connect
  socket.on('register-user', async (data) => {
    try {
      const { userId, userType, userName } = data;
      console.log('📝 Registering user:', { userId, userType, userName });

      // Find or create user profile
      let dbUser = null;
      if (userType === 'patient') {
        dbUser = await Patient.findOne({ clerkUserId: userId });
        if (!dbUser) {
          dbUser = await Patient.create({
            clerkUserId: userId,
            name: userName,
            email: `${userId}@temp.com`
          });
        }
      } else if (userType === 'doctor') {
        dbUser = await Doctor.findOne({ clerkUserId: userId });
        if (!dbUser) {
          dbUser = await Doctor.create({
            clerkUserId: userId,
            name: userName,
            email: `${userId}@temp.com`,
            specialty: 'General Physician',
            experience: 5,
            consultationFee: 100,
            isVerified: true
          });
        }
      }

      // Store user in memory
      connectedUsers.set(userId, {
        socketId: socket.id,
        userName: dbUser.name,
        userType: userType,
        dbId: dbUser._id.toString(),
        isOnline: true
      });

      // Store userId on socket for cleanup
      socket.userId = userId;
      socket.userType = userType;

      // Join user to their room
      socket.join(`user_${userId}`);

      console.log('✅ User registered successfully:', dbUser.name);
      socket.emit('registration-success', {
        userId,
        userName: dbUser.name,
        userType
      });

      // Notify others if doctor came online
      if (userType === 'doctor') {
        io.emit('doctor-online', {
          doctorId: dbUser._id.toString(),
          doctorName: dbUser.name
        });
      }

    } catch (error) {
      console.error('❌ Registration error:', error);
      socket.emit('registration-error', { message: error.message });
    }
  });

  // Handle call initiation
  socket.on('initiate-call', (data) => {
    const { targetDoctorId, patientName } = data;
    console.log('📞 Call initiated to doctor:', targetDoctorId);

    // Find the doctor
    const doctor = Array.from(connectedUsers.values()).find(
      user => user.dbId === targetDoctorId && user.userType === 'doctor'
    );

    if (!doctor) {
      console.log('❌ Doctor not online');
      socket.emit('call-failed', { message: 'Doctor is not available' });
      return;
    }

    // Create call session
    const callId = `call_${Date.now()}`;
    const roomId = `room_${callId}`;
    
    activeCalls.set(callId, {
      callId,
      roomId,
      caller: socket.userId,
      callerName: patientName,
      receiver: doctor.dbId,
      receiverName: doctor.userName,
      status: 'ringing',
      createdAt: new Date()
    });

    // Send call notification to doctor
    io.to(doctor.socketId).emit('incoming-call', {
      callId,
      roomId,
      callerName: patientName,
      callerId: socket.userId
    });

    // Confirm to patient
    socket.emit('call-initiated', {
      callId,
      roomId,
      doctorName: doctor.userName
    });

    console.log('✅ Call session created:', callId);
  });

  // Handle call response from doctor
  socket.on('respond-to-call', (data) => {
    const { callId, accepted } = data;
    const call = activeCalls.get(callId);

    if (!call) {
      console.log('❌ Call not found:', callId);
      return;
    }

    if (accepted) {
      // Update call status
      call.status = 'active';
      activeCalls.set(callId, call);

      // Both users join the call room
      socket.join(call.roomId);
      
      // Find caller socket and make them join too
      const caller = connectedUsers.get(call.caller);
      if (caller) {
        io.sockets.sockets.get(caller.socketId)?.join(call.roomId);
      }

      // Notify both parties
      io.to(call.roomId).emit('call-accepted', {
        callId,
        roomId: call.roomId,
        participants: {
          patient: { id: call.caller, name: call.callerName },
          doctor: { id: call.receiver, name: call.receiverName }
        }
      });

      console.log('✅ Call accepted:', callId);
    } else {
      // Call rejected
      const caller = connectedUsers.get(call.caller);
      if (caller) {
        io.to(caller.socketId).emit('call-rejected', {
          callId,
          doctorName: call.receiverName
        });
      }

      activeCalls.delete(callId);
      console.log('❌ Call rejected:', callId);
    }
  });

  // Handle WebRTC signaling
  socket.on('webrtc-signal', (data) => {
    const { roomId, signal, type } = data;
    console.log('📡 WebRTC signal:', type);
    
    // Forward signal to other participant in the room
    socket.to(roomId).emit('webrtc-signal', {
      signal,
      type,
      from: socket.userId
    });
  });

  // Handle call termination
  socket.on('end-call', (data) => {
    const { callId, roomId } = data;
    console.log('📞 Call ended:', callId);

    // Notify room participants
    io.to(roomId).emit('call-ended', { callId });

    // Clean up
    activeCalls.delete(callId);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id);
    
    if (socket.userId) {
      const user = connectedUsers.get(socket.userId);
      if (user && user.userType === 'doctor') {
        io.emit('doctor-offline', { doctorId: user.dbId });
      }
      connectedUsers.delete(socket.userId);
    }
  });
};

module.exports = { handleSocketConnection };
