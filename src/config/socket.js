const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");

/**
 * Initialize Socket.IO with JWT authentication
 */
const initializeSocket = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Middleware: JWT Authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user info to socket
      socket.userId = decoded.id;
      socket.userRole = decoded.role;

      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  return io;
};

module.exports = initializeSocket;
