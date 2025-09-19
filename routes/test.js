// Add this route to check connected users
router.get('/connected-users', (req, res) => {
  try {
    const { getOnlineUsers } = require('../services/socketService');
    const onlineUsers = getOnlineUsers();
    
    res.json({
      count: onlineUsers.length,
      users: onlineUsers.map(user => ({
        userName: user.userName,
        userType: user.userType,
        clerkId: user.clerkUserId?.substring(0, 20) + '...',
        dbId: user.dbUserId,
        isOnline: user.isOnline
      }))
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});
