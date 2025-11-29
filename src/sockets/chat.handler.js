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
      // SECURITY: Verify user is a participant before joining
      const conversation = await ChatService.getConversation(conversationId);
      if (!conversation) {
        return callback({
          success: false,
          error: "Conversation không tồn tại",
        });
      }

      const isParticipant = conversation.participants.some(
        (p) => p.userId._id.toString() === userId.toString()
      );

      if (!isParticipant) {
        return callback({
          success: false,
          error: "Bạn không có quyền truy cập conversation này",
        });
      }

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

      // Validate conversationId
      if (!conversationId) {
        return callback({
          success: false,
          error: "conversationId là bắt buộc",
        });
      }

      // Verify user is participant before sending
      const conversation = await ChatService.getConversation(conversationId);
      if (!conversation) {
        return callback({
          success: false,
          error: "Conversation không tồn tại",
        });
      }

      const isParticipant = conversation.participants.some(
        (p) => p.userId._id.toString() === userId.toString()
      );

      if (!isParticipant) {
        return callback({
          success: false,
          error: "Bạn không có quyền gửi tin nhắn trong conversation này",
        });
      }

      // Validate message content
      if (type === "text" && (!text || text.trim().length === 0)) {
        return callback({
          success: false,
          error: "Text là bắt buộc khi type là 'text'",
        });
      }

      if (type === "image" && (!images || images.length === 0)) {
        return callback({
          success: false,
          error: "Images là bắt buộc khi type là 'image'",
        });
      }

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
      // Reuse conversation đã query ở trên
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
