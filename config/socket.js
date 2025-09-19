const socketIo = require('socket.io');

const configureSocket = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: [
        "http://localhost:5173",
        "http://127.0.0.1:5173"
      ],
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  console.log('✅ Socket.IO configured');
  return io;
};

module.exports = { configureSocket };
