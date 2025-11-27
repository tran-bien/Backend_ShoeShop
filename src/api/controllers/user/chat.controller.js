const asyncHandler = require("express-async-handler");
const ChatService = require("@services/chat.service");
const { User } = require("@models");

const chatController = {
  /**
   * @route GET /api/v1/user/chat/conversations
   * @desc Lấy danh sách conversations
   */
  getConversations: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { status = "active", page = 1, limit = 20 } = req.query;

    const result = await ChatService.getUserConversations(userId, {
      status,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    return res.json({
      success: true,
      data: result.conversations,
      pagination: result.pagination,
    });
  }),

  /**
   * @route POST /api/v1/user/chat/conversations
   * @desc Tạo conversation mới
   */
  createConversation: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const userRole = req.user.role;
    const { targetUserId, orderId, message } = req.body;

    let targetUser;
    let targetRole;

    if (targetUserId) {
      targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy người dùng",
        });
      }
      targetRole = targetUser.role;
    } else {
      const availableStaff = await User.findOne({
        role: { $in: ["staff", "admin"] },
        isActive: true,
      }).sort({ createdAt: 1 });

      if (!availableStaff) {
        return res.status(404).json({
          success: false,
          message: "Không có nhân viên hỗ trợ khả dụng",
        });
      }

      targetUser = availableStaff;
      targetRole = availableStaff.role;
    }

    const conversation = await ChatService.getOrCreateConversation(
      userId,
      userRole,
      targetUser._id,
      targetRole,
      orderId
    );

    if (message && message.trim().length > 0) {
      await ChatService.sendMessage({
        conversationId: conversation._id,
        senderId: userId,
        type: "text",
        text: message,
      });
    }

    return res.status(201).json({
      success: true,
      data: conversation,
    });
  }),

  /**
   * @route GET /api/v1/user/chat/conversations/:conversationId/messages
   * @desc Lấy tin nhắn trong conversation
   */
  getMessages: asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user._id;

    const conversation = await ChatService.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy conversation",
      });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.userId._id.toString() === userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập conversation này",
      });
    }

    const result = await ChatService.getMessages(conversationId, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    return res.json({
      success: true,
      data: result.messages,
      pagination: result.pagination,
    });
  }),

  /**
   * @route POST /api/v1/user/chat/conversations/:conversationId/messages
   * @desc Gửi tin nhắn (HTTP fallback)
   */
  sendMessage: asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { type, text, images } = req.body;
    const userId = req.user._id;

    const conversation = await ChatService.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy conversation",
      });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.userId._id.toString() === userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền gửi tin nhắn trong conversation này",
      });
    }

    const message = await ChatService.sendMessage({
      conversationId,
      senderId: userId,
      type,
      text,
      images,
    });

    return res.status(201).json({
      success: true,
      data: message,
    });
  }),

  /**
   * @route PUT /api/v1/user/chat/conversations/:conversationId/read
   * @desc Đánh dấu đã đọc
   */
  markAsRead: asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user._id;

    await ChatService.markAsRead(conversationId, userId);

    return res.json({
      success: true,
      message: "Đã đánh dấu đã đọc",
    });
  }),

  /**
   * @route PUT /api/v1/user/chat/conversations/:conversationId/close
   * @desc Đóng conversation
   */
  closeConversation: asyncHandler(async (req, res) => {
    const { conversationId } = req.params;

    const conversation = await ChatService.closeConversation(conversationId);

    return res.json({
      success: true,
      data: conversation,
    });
  }),
};

module.exports = chatController;
