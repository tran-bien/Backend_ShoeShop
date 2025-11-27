const { ChatConversation, ChatMessage } = require("@models");
const cloudinary = require("@config/cloudinary");

/**
 * Chat Service - Simple version
 */
class ChatService {
  /**
   * Tạo hoặc lấy conversation giữa 2 users
   */
  async getOrCreateConversation(
    userId1,
    role1,
    userId2,
    role2,
    orderId = null
  ) {
    // Tìm conversation hiện có
    let conversation = await ChatConversation.findOne({
      participants: {
        $all: [
          { $elemMatch: { userId: userId1 } },
          { $elemMatch: { userId: userId2 } },
        ],
      },
      status: "active",
    }).populate("participants.userId", "name avatar role");

    if (conversation) {
      return conversation;
    }

    // Tạo mới nếu chưa có
    conversation = await ChatConversation.create({
      participants: [
        { userId: userId1, role: role1, joinedAt: new Date() },
        { userId: userId2, role: role2, joinedAt: new Date() },
      ],
      orderId,
      status: "active",
      unreadCount: {
        [userId1]: 0,
        [userId2]: 0,
      },
    });

    return conversation.populate("participants.userId", "name avatar role");
  }

  /**
   * Lấy danh sách conversations của user
   */
  async getUserConversations(
    userId,
    { status = "active", page = 1, limit = 20 }
  ) {
    const skip = (page - 1) * limit;

    const conversations = await ChatConversation.find({
      "participants.userId": userId,
      status,
    })
      .populate("participants.userId", "name avatar role email")
      .populate("lastMessage.sentBy", "name")
      .sort({ "lastMessage.sentAt": -1 })
      .skip(skip)
      .limit(limit);

    const total = await ChatConversation.countDocuments({
      "participants.userId": userId,
      status,
    });

    return {
      conversations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Gửi tin nhắn
   */
  async sendMessage({
    conversationId,
    senderId,
    type = "text",
    text,
    images = [],
  }) {
    // Upload images nếu có với error handling
    let uploadedImages = [];
    if (type === "image" && images.length > 0) {
      const uploadResults = await Promise.allSettled(
        images.map(async (imageBuffer) => {
          const result = await cloudinary.uploader.upload(imageBuffer, {
            folder: "chat_images",
            resource_type: "image",
          });
          return {
            url: result.secure_url,
            public_id: result.public_id,
          };
        })
      );

      // Lấy các upload thành công
      uploadedImages = uploadResults
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value);

      // Nếu không có ảnh nào upload thành công
      if (uploadedImages.length === 0 && type === "image") {
        const ApiError = require("@utils/ApiError");
        throw new ApiError(500, "Không thể upload ảnh. Vui lòng thử lại.");
      }

      // Log các ảnh upload thất bại
      const failedUploads = uploadResults.filter(
        (r) => r.status === "rejected"
      );
      if (failedUploads.length > 0) {
        console.error(
          `[CHAT] ${failedUploads.length} images failed to upload:`,
          failedUploads.map((r) => r.reason?.message)
        );
      }
    }

    // Tạo message
    const message = await ChatMessage.create({
      conversationId,
      senderId,
      type,
      text: text || "",
      images: uploadedImages,
      readBy: [{ userId: senderId, readAt: new Date() }],
    });

    // Update conversation
    const conversation = await ChatConversation.findById(conversationId);

    conversation.lastMessage = {
      text: text || "[Hình ảnh]",
      sentBy: senderId,
      sentAt: new Date(),
    };

    // Tăng unread count cho người nhận
    conversation.participants.forEach((p) => {
      const participantId = p.userId.toString();
      if (participantId !== senderId.toString()) {
        const currentCount = conversation.unreadCount.get(participantId) || 0;
        conversation.unreadCount.set(participantId, currentCount + 1);
      }
    });

    await conversation.save();

    return message.populate("senderId", "name avatar role");
  }

  /**
   * Lấy tin nhắn trong conversation
   */
  async getMessages(conversationId, { page = 1, limit = 50 }) {
    const skip = (page - 1) * limit;

    const messages = await ChatMessage.find({ conversationId })
      .populate("senderId", "name avatar role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ChatMessage.countDocuments({ conversationId });

    return {
      messages: messages.reverse(), // Đảo ngược để hiển thị từ cũ -> mới
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Đánh dấu đã đọc
   */
  async markAsRead(conversationId, userId) {
    // Reset unread count
    const conversation = await ChatConversation.findById(conversationId);
    conversation.unreadCount.set(userId.toString(), 0);
    await conversation.save();

    // Mark messages as read
    await ChatMessage.updateMany(
      {
        conversationId,
        "readBy.userId": { $ne: userId },
      },
      {
        $push: {
          readBy: { userId, readAt: new Date() },
        },
      }
    );
  }

  /**
   * Đóng conversation
   */
  async closeConversation(conversationId) {
    return ChatConversation.findByIdAndUpdate(
      conversationId,
      { status: "closed" },
      { new: true }
    );
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId) {
    return ChatConversation.findById(conversationId).populate(
      "participants.userId",
      "name avatar role email"
    );
  }
}

module.exports = new ChatService();
