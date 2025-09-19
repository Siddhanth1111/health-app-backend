const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

// Store connected users globally
const connectedUsers = new Map();

const handleSocketConnection = (io, socket) => {
  console.log('🔌 User connected:', socket.id);

  socket.on('register-user', async (data) => {
    try {
      console.log('📝 Received registration data:', data);
      
      const { userId, userType } = data;
      
      if (!userId) {
        console.error('❌ Missing userId in registration');
        socket.emit('registration-error', { message: 'Missing userId' });
        return;
      }
      
      if (!userType) {
        console.error('❌ Missing userType in registration');
        socket.emit('registration-error', { message: 'Missing userType' });
        return;
      }
      
      console.log('📝 Registering user:', userId.substring(0, 20) + '...', 'as', userType);
      
      let user;
      if (userType === 'patient') {
        user = await Patient.findOneAndUpdate(
          { clerkUserId: userId },
          { 
            isOnline: true, 
            socketId: socket.id, 
            lastSeen: new Date() 
          },
          { new: true }
        );
      } else if (userType === 'doctor') {
        user = await Doctor.findOneAndUpdate(
          { clerkUserId: userId },
          { 
            isOnline: true, 
            socketId: socket.id, 
            lastSeen: new Date() 
          },
          { new: true }
        );
      } else {
        console.error('❌ Invalid userType:', userType);
        socket.emit('registration-error', { message: 'Invalid userType. Must be "patient" or "doctor"' });
        return;
      }
      
      if (user) {
        connectedUsers.set(user._id.toString(), {
          socketId: socket.id,
          userId: user._id.toString(),
          clerkUserId: userId,
          userType,
          userData: user
        });
        
        socket.userId = user._id.toString();
        socket.clerkUserId = userId;
        socket.userType = userType;
        
        console.log(`✅ ${userType} ${user.name} registered with socket ${socket.id}`);
        
        socket.emit('user-registered', {
          userId: user._id.toString(),
          userType,
          userName: user.name,
          message: 'Successfully registered'
        });
        
        // Broadcast status change (only for doctors)
        if (userType === 'doctor') {
          socket.broadcast.emit('doctor-status-changed', {
            doctorId: user._id.toString(),
            isOnline: true
          });
        }
      } else {
        console.log('❌ User profile not found for:', userId.substring(0, 20) + '...');
        socket.emit('registration-error', { 
          message: `${userType} profile not found. Please complete your profile setup first.` 
        });
      }
    } catch (error) {
      console.error('❌ Error registering user:', error);
      socket.emit('registration-error', { 
        message: 'Registration failed: ' + error.message 
      });
    }
  });

  // Rest of the socket events remain the same...
  socket.on('initiate-call', async (data) => {
    console.log('📞 Call initiation request:', data);
    
    if (!socket.userId) {
      socket.emit('error', { message: 'Please register first' });
      return;
    }
    
    const targetUser = connectedUsers.get(data.targetUserId);
    if (!targetUser) {
      socket.emit('user-not-available', { 
        message: 'User is not available',
        targetUserId: data.targetUserId 
      });
      return;
    }
    
    try {
      const callerData = connectedUsers.get(socket.userId);
      const callData = {
        fromUserId: socket.userId,
        fromUserName: callerData.userData.name,
        fromUserAvatar: callerData.userData.getAvatarUrl(),
        fromUserType: socket.userType
      };
      
      console.log(`📞 Sending call to ${targetUser.userData.name}`);
      io.to(targetUser.socketId).emit('incoming-call', callData);
      
      socket.emit('call-initiated', {
        targetUserId: data.targetUserId,
        targetUserName: targetUser.userData.name
      });
      
    } catch (error) {
      console.error('❌ Error initiating call:', error);
      socket.emit('error', { message: 'Failed to initiate call' });
    }
  });

  socket.on('calling', (message) => {
    const targetUser = connectedUsers.get(message.targetUserId);
    if (targetUser) {
      const messageWithSender = { ...message, fromUserId: socket.userId };
      io.to(targetUser.socketId).emit('calling', messageWithSender);
    }
  });

  socket.on('call-response', (data) => {
    const targetUser = connectedUsers.get(data.targetUserId);
    if (targetUser) {
      io.to(targetUser.socketId).emit('call-response', {
        ...data,
        fromUserId: socket.userId
      });
    }
  });

  socket.on('disconnect', async () => {
    console.log('🔌 User disconnecting:', socket.id);
    
    if (socket.userId) {
      try {
        const userData = connectedUsers.get(socket.userId);
        
        if (userData) {
          if (userData.userType === 'patient') {
            await Patient.findByIdAndUpdate(socket.userId, {
              isOnline: false,
              socketId: null,
              lastSeen: new Date()
            });
          } else if (userData.userType === 'doctor') {
            await Doctor.findByIdAndUpdate(socket.userId, {
              isOnline: false,
              socketId: null,
              lastSeen: new Date()
            });
            
            // Broadcast doctor offline status
            socket.broadcast.emit('doctor-status-changed', {
              doctorId: socket.userId,
              isOnline: false
            });
          }
          
          connectedUsers.delete(socket.userId);
          console.log(`❌ ${userData.userType} ${userData.userData.name} disconnected`);
        }
      } catch (error) {
        console.error('❌ Error updating user offline status:', error);
      }
    }
  });
};

module.exports = {
  handleSocketConnection,
  connectedUsers
};
