const connectedUsers = new Map(); // Store connected users
const activeRooms = new Map(); // Store active call rooms

const handleSocketConnection = (io, socket) => {
  console.log('🔌 User connected:', socket.id);

  // Register user with their details
  socket.on('register-user', (data) => {
    console.log('📝 Registering user:', data);
    
    const { userId, userType, userName } = data;
    
    // Store user information
    connectedUsers.set(userId, {
      socketId: socket.id,
      userType: userType,
      userName: userName,
      isOnline: true,
      lastSeen: new Date()
    });
    
    // Join user to their personal room
    socket.join(`user_${userId}`);
    
    console.log('✅ User registered:', userName, 'as', userType);
    socket.emit('user-registered', { 
      message: 'Registration successful',
      userId,
      userType 
    });
    
    // Broadcast online status if doctor
    if (userType === 'doctor') {
      socket.broadcast.emit('doctor-status-changed', {
        doctorId: userId,
        isOnline: true,
        userName: userName
      });
    }
  });

  // Handle call initiation
  socket.on('initiate-call', (data) => {
    console.log('📞 Call initiated:', data);
    
    const { targetUserId, fromUserId, fromUserName, fromUserType } = data;
    
    // Check if target user is connected
    const targetUser = connectedUsers.get(targetUserId);
    
    if (!targetUser) {
      console.log('❌ Target user not online:', targetUserId);
      socket.emit('call-failed', {
        reason: 'User is not online',
        targetUserId
      });
      return;
    }
    
    // Create call room
    const callRoomId = `call_${fromUserId}_${targetUserId}_${Date.now()}`;
    
    // Store call information
    activeRooms.set(callRoomId, {
      initiator: fromUserId,
      receiver: targetUserId,
      status: 'ringing',
      createdAt: new Date()
    });
    
    // Send incoming call to target user
    io.to(`user_${targetUserId}`).emit('incoming-call', {
      callRoomId,
      fromUserId,
      fromUserName,
      fromUserType,
      timestamp: new Date()
    });
    
    // Confirm call initiated to sender
    socket.emit('call-initiated', {
      callRoomId,
      targetUserId,
      targetUserName: targetUser.userName,
      status: 'ringing'
    });
    
    console.log('✅ Call setup complete:', callRoomId);
  });

  // Handle call response (accept/reject)
  socket.on('call-response', (data) => {
    console.log('📞 Call response:', data);
    
    const { callRoomId, response, userId } = data; // response: 'accept' or 'reject'
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
      const initiatorUser = connectedUsers.get(callInfo.initiator);
      if (initiatorUser) {
        io.sockets.sockets.get(initiatorUser.socketId)?.join(callRoomId);
      }
      
      // Notify both users that call is accepted
      io.to(callRoomId).emit('call-accepted', {
        callRoomId,
        participants: [callInfo.initiator, callInfo.receiver]
      });
      
      console.log('✅ Call accepted:', callRoomId);
    } else {
      // Call rejected
      const initiatorUser = connectedUsers.get(callInfo.initiator);
      if (initiatorUser) {
        io.to(`user_${callInfo.initiator}`).emit('call-rejected', {
          callRoomId,
          rejectedBy: userId
        });
      }
      
      // Remove call from active rooms
      activeRooms.delete(callRoomId);
      console.log('❌ Call rejected:', callRoomId);
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
    
    // Find and remove user from connected users
    for (const [userId, userInfo] of connectedUsers.entries()) {
      if (userInfo.socketId === socket.id) {
        userInfo.isOnline = false;
        userInfo.lastSeen = new Date();
        
        // Broadcast offline status if doctor
        if (userInfo.userType === 'doctor') {
          socket.broadcast.emit('doctor-status-changed', {
            doctorId: userId,
            isOnline: false,
            userName: userInfo.userName
          });
        }
        
        connectedUsers.delete(userId);
        break;
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
};

// Helper function to get online users
const getOnlineUsers = () => {
  return Array.from(connectedUsers.entries()).map(([userId, userInfo]) => ({
    userId,
    ...userInfo
  }));
};

// Helper function to get active calls
const getActiveCalls = () => {
  return Array.from(activeRooms.entries()).map(([callRoomId, callInfo]) => ({
    callRoomId,
    ...callInfo
  }));
};

module.exports = {
  handleSocketConnection,
  getOnlineUsers,
  getActiveCalls
};
