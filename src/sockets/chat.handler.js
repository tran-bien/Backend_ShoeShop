const ChatService = require("@services/chat.service");

/**
 * Socket.IO Chat Handler
 * Xử lý real-time chat events
 */
module.exports = (io, socket) => {
  const userId = socket.userId;
  const userRole = socket.userRole;

  console.log(`[CHAT] User connected: ${userId} (${userRole})`);

  // Join user's personal room
  socket.join(`user:${userId}`);

  /**
   * Join conversation room
   */
  socket.on("chat:join", async (conversationId, callback) => {
    try {
      socket.join(`conversation:${conversationId}`);

      // Mark messages as read
      await ChatService.markAsRead(conversationId, userId);

      // Emit to other participants
      socket.to(`conversation:${conversationId}`).emit("chat:userJoined", {
        userId,
        conversationId,
      });

      callback({ success: true });
    } catch (error) {
      console.error("[CHAT] Join error:", error);
      callback({ success: false, error: error.message });
    }
  });

  /**
   * Send message
   */
  socket.on("chat:sendMessage", async (data, callback) => {
    try {
      const { conversationId, type, text, images } = data;

      // Save message to DB
      const message = await ChatService.sendMessage({
        conversationId,
        senderId: userId,
        type,
        text,
        images,
      });

      // Broadcast to conversation room
      io.to(`conversation:${conversationId}`).emit("chat:newMessage", {
        message,
        conversationId,
      });

      // Notify other participants (push notification)
      const conversation = await ChatService.getConversation(conversationId);
      conversation.participants.forEach((p) => {
        const participantId = p.userId._id.toString();
        if (participantId !== userId.toString()) {
          io.to(`user:${participantId}`).emit("chat:notification", {
            conversationId,
            message: text || "[Hình ảnh]",
            sender: message.senderId,
          });
        }
      });

      callback({ success: true, message });
    } catch (error) {
      console.error("[CHAT] Send message error:", error);
      callback({ success: false, error: error.message });
    }
  });

  /**
   * Typing indicator
   */
  socket.on("chat:typing", (conversationId) => {
    socket.to(`conversation:${conversationId}`).emit("chat:userTyping", {
      userId,
      conversationId,
    });
  });

  /**
   * Stop typing
   */
  socket.on("chat:stopTyping", (conversationId) => {
    socket.to(`conversation:${conversationId}`).emit("chat:userStopTyping", {
      userId,
      conversationId,
    });
  });

  /**
   * Leave conversation
   */
  socket.on("chat:leave", (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
    socket.to(`conversation:${conversationId}`).emit("chat:userLeft", {
      userId,
      conversationId,
    });
  });

  /**
   * Disconnect
   */
  socket.on("disconnect", () => {
    console.log(`[CHAT] User disconnected: ${userId}`);
  });
};
