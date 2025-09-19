const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

const connectedUsers = new Map(); // Store connected users
const activeRooms = new Map(); // Store active call rooms

const handleSocketConnection = (io, socket) => {
  console.log('🔌 User connected:', socket.id);

  // Register user with their details
  socket.on('register-user', async (data) => {
    try {
      console.log('📝 Registering user:', data);
      
      const { userId, userType, userName } = data;
      
      if (!userId || !userType) {
        console.error('❌ Missing registration data:', data);
        socket.emit('registration-error', { message: 'Missing userId or userType' });
        return;
      }

      // Find user in database to get their database ID
      let dbUser;
      let dbUserId;

      if (userType === 'patient') {
        dbUser = await Patient.findOne({ clerkUserId: userId });
        if (!dbUser) {
          // Create patient profile if it doesn't exist
          console.log('📝 Creating new patient profile for:', userName);
          dbUser = new Patient({
            clerkUserId: userId,
            name: userName,
            email: 'patient@example.com', // You might want to get actual email
            phone: '',
            dateOfBirth: null,
            emergencyContact: {
              name: '',
              phone: '',
              relationship: ''
            }
          });
          await dbUser.save();
          console.log('✅ Created new patient profile:', dbUser._id);
        }
        dbUserId = dbUser._id.toString();
      } else if (userType === 'doctor') {
        dbUser = await Doctor.findOne({ clerkUserId: userId });
        if (!dbUser) {
          // Create doctor profile if it doesn't exist
          console.log('📝 Creating new doctor profile for:', userName);
          dbUser = new Doctor({
            clerkUserId: userId,
            name: userName,
            email: 'doctor@example.com', // You might want to get actual email
            specialty: 'General Physician',
            experience: 5,
            qualifications: ['MBBS'],
            consultationFee: 50,
            bio: `Dr. ${userName} is a qualified medical professional`,
            isVerified: true,
            availability: {
              monday: { isAvailable: true, slots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] },
              tuesday: { isAvailable: true, slots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] },
              wednesday: { isAvailable: true, slots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] },
              thursday: { isAvailable: true, slots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] },
              friday: { isAvailable: true, slots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] },
              saturday: { isAvailable: true, slots: ['09:00', '10:00', '11:00', '14:00', '15:00'] },
              sunday: { isAvailable: false, slots: [] }
            }
          });
          await dbUser.save();
          console.log('✅ Created new doctor profile:', dbUser._id);
        }
        dbUserId = dbUser._id.toString();
      }

      if (!dbUser) {
        console.error('❌ Could not create or find user profile:', userId);
        socket.emit('registration-error', { message: 'Could not create user profile' });
        return;
      }

      console.log('✅ Found/Created user in database:', dbUser.name, 'DB ID:', dbUserId);

      // Store user information with both Clerk ID and DB ID
      const userInfo = {
        socketId: socket.id,
        clerkUserId: userId,
        dbUserId: dbUserId,
        userType: userType,
        userName: dbUser.name,
        isOnline: true,
        lastSeen: new Date(),
        dbUser: dbUser
      };

      connectedUsers.set(userId, userInfo);
      connectedUsers.set(dbUserId, userInfo);
      
      // Join user to their personal rooms
      socket.join(`user_${userId}`);
      socket.join(`user_${dbUserId}`);
      socket.join(`${userType}_${dbUserId}`);
      
      // Store user info on socket for cleanup
      socket.userId = userId;
      socket.dbUserId = dbUserId;
      socket.userType = userType;
      socket.userName = dbUser.name;
      
      console.log('✅ User registered:', dbUser.name, 'as', userType);
      console.log('📋 Rooms joined:', [`user_${userId}`, `user_${dbUserId}`, `${userType}_${dbUserId}`]);
      
      socket.emit('user-registered', { 
        message: 'Registration successful',
        userId,
        dbUserId,
        userType 
      });
      
      // Broadcast online status if doctor
      if (userType === 'doctor') {
        socket.broadcast.emit('doctor-status-changed', {
          doctorId: dbUserId,
          clerkUserId: userId,
          isOnline: true,
          userName: dbUser.name
        });
      }

      // Log all connected users for debugging
      console.log('📊 Connected users count:', connectedUsers.size / 2); // Divided by 2 because we store twice

    } catch (error) {
      console.error('❌ Error registering user:', error);
      socket.emit('registration-error', { message: 'Registration failed: ' + error.message });
    }
  });

  // Handle call initiation (for the initial call setup)
  socket.on('initiate-call', async (data) => {
    console.log('📞 Call initiated:', data);
    
    const { targetUserId, fromUserId, fromUserName, fromUserType } = data;
    
    console.log('🔍 Looking for target user:', targetUserId);
    console.log('🔍 Available users:', Array.from(connectedUsers.keys()));
    
    // Look for target user by both Clerk ID and DB ID
    let targetUser = connectedUsers.get(targetUserId);
    
    // If not found by Clerk ID, try to find by database ID
    if (!targetUser) {
      console.log('🔍 Not found by Clerk ID, searching by DB ID...');
      for (const [key, userInfo] of connectedUsers.entries()) {
        if (userInfo.dbUserId === targetUserId || userInfo.clerkUserId === targetUserId) {
          targetUser = userInfo;
          console.log('✅ Found target user by DB ID:', userInfo.userName);
          break;
        }
      }
    }
    
    if (!targetUser) {
      console.log('❌ Target user not online:', targetUserId);
      console.log('📋 Connected users:', Array.from(connectedUsers.entries()).map(([key, user]) => ({
        key,
        name: user.userName,
        type: user.userType,
        clerkId: user.clerkUserId,
        dbId: user.dbUserId
      })));
      
      socket.emit('call-failed', {
        reason: 'User is not online',
        targetUserId,
        debug: {
          searchedFor: targetUserId,
          availableUsers: Array.from(connectedUsers.keys())
        }
      });
      return;
    }
    
    // Get caller information
    let callerUser = connectedUsers.get(fromUserId);
    
    // If caller not found, try to register them automatically
    if (!callerUser) {
      console.log('⚠️ Caller not found in connected users, attempting auto-registration...');
      
      try {
        let dbUser;
        if (fromUserType === 'patient') {
          dbUser = await Patient.findOne({ clerkUserId: fromUserId });
          if (!dbUser) {
            dbUser = new Patient({
              clerkUserId: fromUserId,
              name: fromUserName,
              email: 'patient@example.com'
            });
            await dbUser.save();
          }
        } else if (fromUserType === 'doctor') {
          dbUser = await Doctor.findOne({ clerkUserId: fromUserId });
          if (!dbUser) {
            dbUser = new Doctor({
              clerkUserId: fromUserId,
              name: fromUserName,
              email: 'doctor@example.com',
              specialty: 'General Physician',
              experience: 5,
              isVerified: true
            });
            await dbUser.save();
          }
        }

        if (dbUser) {
          const userInfo = {
            socketId: socket.id,
            clerkUserId: fromUserId,
            dbUserId: dbUser._id.toString(),
            userType: fromUserType,
            userName: fromUserName,
            isOnline: true,
            lastSeen: new Date(),
            dbUser: dbUser
          };

          connectedUsers.set(fromUserId, userInfo);
          connectedUsers.set(dbUser._id.toString(), userInfo);
          
          socket.userId = fromUserId;
          socket.dbUserId = dbUser._id.toString();
          socket.userType = fromUserType;
          socket.userName = fromUserName;
          
          callerUser = userInfo;
          console.log('✅ Auto-registered caller:', fromUserName);
          
          socket.emit('user-registered', { 
            message: 'Auto-registration successful',
            userId: fromUserId,
            dbUserId: dbUser._id.toString(),
            userType: fromUserType
          });
        }
      } catch (error) {
        console.error('❌ Auto-registration failed:', error);
      }
    }

    if (!callerUser) {
      console.error('❌ Caller still not found after auto-registration attempt:', fromUserId);
      socket.emit('call-failed', { reason: 'Caller not registered' });
      return;
    }
    
    // Create call room
    const callRoomId = `call_${callerUser.dbUserId}_${targetUser.dbUserId}_${Date.now()}`;
    
    // Store call information
    activeRooms.set(callRoomId, {
      initiator: callerUser.dbUserId,
      initiatorClerk: callerUser.clerkUserId,
      receiver: targetUser.dbUserId,
      receiverClerk: targetUser.clerkUserId,
      status: 'ringing',
      createdAt: new Date()
    });
    
    console.log('📞 Sending incoming call to:', targetUser.userName);
    
    // Send incoming call to target user (try all possible room formats)
    const callData = {
      callRoomId,
      fromUserId: callerUser.clerkUserId,
      fromDbUserId: callerUser.dbUserId,
      fromUserName: callerUser.userName,
      fromUserType: callerUser.userType,
      targetUserId: targetUser.dbUserId,
      targetUserName: targetUser.userName,
      timestamp: new Date()
    };

    // Send to all possible rooms for the target user
    io.to(`user_${targetUser.clerkUserId}`).emit('incoming-call', callData);
    io.to(`user_${targetUser.dbUserId}`).emit('incoming-call', callData);
    io.to(targetUser.socketId).emit('incoming-call', callData);
    
    // Confirm call initiated to sender
    socket.emit('call-initiated', {
      callRoomId,
      targetUserId: targetUser.dbUserId,
      targetUserName: targetUser.userName,
      status: 'ringing'
    });
    
    console.log('✅ Call setup complete:', callRoomId);
  });

  // ... rest of your existing handlers (calling, call-response, etc.) ...

  // Handle WebRTC calling events (for your VideoCall component)
  socket.on('calling', (data) => {
    console.log('📞 WebRTC calling event:', data);
    
    const { targetUserId, type, ...rtcData } = data;
    
    // Find target user by both Clerk ID and DB ID
    let targetUser = connectedUsers.get(targetUserId);
    if (!targetUser) {
      for (const [key, userInfo] of connectedUsers.entries()) {
        if (userInfo.dbUserId === targetUserId || userInfo.clerkUserId === targetUserId) {
          targetUser = userInfo;
          break;
        }
      }
    }
    
    if (!targetUser) {
      console.log('❌ Target user not found for WebRTC:', targetUserId);
      socket.emit('user-not-available', { targetUserId });
      return;
    }
    
    // Forward WebRTC signaling data to target user
    io.to(targetUser.socketId).emit('calling', {
      ...rtcData,
      type,
      fromUserId: socket.userId || socket.dbUserId,
      targetUserId: targetUserId
    });
    
    console.log('✅ Forwarded WebRTC message:', type, 'to', targetUser.userName);
  });

  // Handle call response (accept/reject)
  socket.on('call-response', (data) => {
    console.log('📞 Call response:', data);
    
    const { callRoomId, response, userId, targetUserId, accepted } = data;
    
    // Handle both new format (with callRoomId) and old format (with targetUserId)
    if (callRoomId) {
      // New format - with call room
      const callInfo = activeRooms.get(callRoomId);
      
      if (!callInfo) {
        console.log('❌ Call not found:', callRoomId);
        return;
      }
      
      if (response === 'accept') {
        // Update call status
        callInfo.status = 'connected';
        activeRooms.set(callRoomId, callInfo);
        
        // Join both users to call room
        socket.join(callRoomId);
        const initiatorUser = connectedUsers.get(callInfo.initiatorClerk) || connectedUsers.get(callInfo.initiator);
        if (initiatorUser) {
          const initiatorSocket = io.sockets.sockets.get(initiatorUser.socketId);
          initiatorSocket?.join(callRoomId);
        }
        
        // Notify both users that call is accepted
        io.to(callRoomId).emit('call-accepted', {
          callRoomId,
          participants: [callInfo.initiator, callInfo.receiver]
        });
        
        console.log('✅ Call accepted:', callRoomId);
      } else {
        // Call rejected
        const initiatorUser = connectedUsers.get(callInfo.initiatorClerk) || connectedUsers.get(callInfo.initiator);
        if (initiatorUser) {
          io.to(`user_${callInfo.initiatorClerk}`).emit('call-rejected', {
            callRoomId,
            rejectedBy: userId
          });
          io.to(initiatorUser.socketId).emit('call-rejected', {
            callRoomId,
            rejectedBy: userId
          });
        }
        
        // Remove call from active rooms
        activeRooms.delete(callRoomId);
        console.log('❌ Call rejected:', callRoomId);
      }
    } else if (targetUserId !== undefined) {
      // Old format - direct response to target user (for VideoCall component compatibility)
      const targetUser = connectedUsers.get(targetUserId) || 
        Array.from(connectedUsers.values()).find(u => u.dbUserId === targetUserId);
      
      if (targetUser) {
        io.to(targetUser.socketId).emit('call-response', {
          accepted: accepted !== undefined ? accepted : (response === 'accept'),
          fromUserId: socket.userId || socket.dbUserId
        });
        
        console.log('✅ Sent call response to:', targetUser.userName, 'accepted:', accepted);
      }
    }
  });

  // Handle call end
  socket.on('end-call', (data) => {
    console.log('📞 Call ended:', data);
    
    const { callRoomId } = data;
    const callInfo = activeRooms.get(callRoomId);
    
    if (callInfo) {
      // Notify all participants that call ended
      io.to(callRoomId).emit('call-ended', {
        callRoomId,
        endedBy: data.userId
      });
      
      // Remove call from active rooms
      activeRooms.delete(callRoomId);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    
    if (socket.userId) {
      // Remove from both Clerk ID and DB ID mappings
      const userInfo = connectedUsers.get(socket.userId);
      if (userInfo) {
        connectedUsers.delete(socket.userId);
        connectedUsers.delete(socket.dbUserId);
        
        // Broadcast offline status if doctor
        if (socket.userType === 'doctor') {
          socket.broadcast.emit('doctor-status-changed', {
            doctorId: socket.dbUserId,
            clerkUserId: socket.userId,
            isOnline: false,
            userName: userInfo.userName
          });
        }
        
        console.log('❌ Removed user from connected list:', userInfo.userName);
      }
    }
  });

  // Handle typing indicators for chat during call
  socket.on('typing', (data) => {
    socket.to(data.callRoomId).emit('user-typing', {
      userId: data.userId,
      userName: data.userName
    });
  });

  socket.on('stop-typing', (data) => {
    socket.to(data.callRoomId).emit('user-stopped-typing', {
      userId: data.userId
    });
  });

  // Handle general errors
  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
};

// Helper functions
const getOnlineUsers = () => {
  const users = Array.from(connectedUsers.entries());
  // Only return Clerk ID entries to avoid duplicates
  return users.filter(([key, value]) => key === value.clerkUserId)
    .map(([userId, userInfo]) => ({
      userId,
      dbUserId: userInfo.dbUserId,
      userName: userInfo.userName,
      userType: userInfo.userType,
      isOnline: userInfo.isOnline,
      lastSeen: userInfo.lastSeen
    }));
};

const getActiveCalls = () => {
  return Array.from(activeRooms.entries()).map(([callRoomId, callInfo]) => ({
    callRoomId,
    initiator: callInfo.initiator,
    receiver: callInfo.receiver,
    status: callInfo.status,
    createdAt: callInfo.createdAt
  }));
};

const getConnectedUser = (userId) => {
  return connectedUsers.get(userId) || 
    Array.from(connectedUsers.values()).find(u => 
      u.clerkUserId === userId || u.dbUserId === userId
    );
};

// Cleanup inactive calls (run periodically)
const cleanupInactiveCalls = () => {
  const now = new Date();
  const CALL_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  for (const [callRoomId, callInfo] of activeRooms.entries()) {
    if (now - callInfo.createdAt > CALL_TIMEOUT && callInfo.status === 'ringing') {
      console.log('🧹 Cleaning up inactive call:', callRoomId);
      activeRooms.delete(callRoomId);
    }
  }
};

// Run cleanup every 2 minutes
setInterval(cleanupInactiveCalls, 2 * 60 * 1000);

module.exports = {
  handleSocketConnection,
  getOnlineUsers,
  getActiveCalls,
  getConnectedUser
};
