// socket.js - Complete updated file
let ioInstance = null;

exports.init = (server) => {
  const { Server } = require('socket.io');
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ];

  const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  };

  ioInstance = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Socket CORS blocked'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  ioInstance.use((socket, next) => {
    try {
      const { verifyToken } = require('./utils/jwt');
      
      // Get token from handshake auth or cookies
      let token = socket.handshake.auth?.token;
      
      // If not in auth, try to parse from cookies
      if (!token && socket.handshake.headers?.cookie) {
        const cookies = socket.handshake.headers.cookie;
        const tokenMatch = cookies.match(/token=([^;]+)/);
        if (tokenMatch) {
          token = tokenMatch[1];
        }
      }

      console.log('🔍 Socket auth attempt - Token present:', !!token);

      if (!token) {
        console.warn('Socket connection rejected: No token provided');
        console.log('Handshake auth:', socket.handshake.auth);
        console.log('Handshake headers cookie:', socket.handshake.headers?.cookie);
        return next(new Error('Authentication error: Token required'));
      }

      const decoded = verifyToken(token);
      socket.userId = (decoded.userId || decoded.id)?.toString?.() ?? decoded.id;
      socket.userRole = decoded.role;
      
      console.log(`✅ Secure Socket Auth: User ${socket.userId} (${socket.userRole})`);
      next();
    } catch (err) {
      console.error('Socket Auth Failure:', err.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  ioInstance.on('connection', (socket) => {
    console.log('Socket connected:', socket.id, 'User:', socket.userId);
    
    // Feature 1: Intelligent Waiting Room (Presence)
    const { manageWaitingRoom } = require('./socket/presence');
    manageWaitingRoom(ioInstance, socket);

    if (socket.userId) {
      socket.join(socket.userId);
      console.log(`User ${socket.userId} joined room ${socket.userId}`);
    }

    socket.on('join', (userId) => {
      const normalizedId = userId?.toString?.() ?? userId;
      const socketUserId = socket.userId?.toString?.() ?? socket.userId;
      if (normalizedId && normalizedId === socketUserId) {
        socket.join(normalizedId);
        console.log(`User ${normalizedId} joined their notification room`);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', socket.id, 'Reason:', reason);
    });
  });

  // Feature 3: Collaborative Live Notes Namespace
  const notesNamespace = ioInstance.of('/notes');
  notesNamespace.on('connection', (socket) => {
    socket.on('join_session', (appointmentId) => {
      socket.join(appointmentId);
      console.log(`📝 User joined live notes session: ${appointmentId}`);
    });

    socket.on('edit_note', ({ appointmentId, content, authorRole }) => {
      // Broadcast the edit to the other party in the room
      socket.to(appointmentId).emit('note_updated', { content, authorRole });
    });

    socket.on('set_typing', ({ appointmentId, isTyping, userRole }) => {
      socket.to(appointmentId).emit('user_typing', { isTyping, userRole });
    });
  });

  return ioInstance;
};

exports.notifyUser = (userId, payload) => {
  if (!ioInstance) {
    console.log('Socket.io not initialized');
    return;
  }
  
  if (!userId) {
    console.log('Cannot notify: No userId provided');
    return;
  }
  
  const roomId = userId?.toString?.() ?? userId;
  console.log(`Sending notification to user ${roomId}:`, payload);
  ioInstance.to(roomId).emit('notification', payload);
};

exports.getIO = () => ioInstance;