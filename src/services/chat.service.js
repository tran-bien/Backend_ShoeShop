const { ChatConversation, ChatMessage, User } = require("@models");
const cloudinary = require("@config/cloudinary");
const ApiError = require("@utils/ApiError");

/**
 * Chat Service - Simple version
 */
class ChatService {
  /**
   * Tìm staff/admin khả dụng để hỗ trợ
   */
  async findAvailableStaff() {
    const staff = await User.findOne({
      role: { $in: ["staff", "admin"] },
      isActive: true,
    }).sort({ createdAt: 1 });

    if (!staff) {
      throw new ApiError(404, "Không có nhân viên hỗ trợ khả dụng");
    }

    return staff;
  }

  /**
   * Lấy target user theo ID hoặc tìm staff khả dụng
   */
  async getTargetUser(targetUserId) {
    if (targetUserId) {
      const user = await User.findById(targetUserId);
      if (!user) {
        throw new ApiError(404, "Không tìm thấy người dùng");
      }
      return user;
    }
    return this.findAvailableStaff();
  }

  /**
   * Kiểm tra quyền truy cập conversation
   */
  async verifyConversationAccess(conversationId, userId) {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new ApiError(404, "Không tìm thấy conversation");
    }

    const isParticipant = conversation.participants.some(
      (p) => p.userId._id.toString() === userId.toString()
    );

    if (!isParticipant) {
      throw new ApiError(403, "Bạn không có quyền truy cập conversation này");
    }

    return conversation;
  }
  /**
   * Tạo hoặc lấy conversation giữa 2 users
   * FIXED: Luôn chỉ có 1 conversation duy nhất giữa 2 users
   * Nếu conversation đã đóng thì tự động mở lại
   */
  async getOrCreateConversation(
    userId1,
    role1,
    userId2,
    role2,
    orderId = null
  ) {
    // Tìm BẤT KỲ conversation nào giữa 2 users (không quan tâm status)
    let conversation = await ChatConversation.findOne({
      participants: {
        $all: [
          { $elemMatch: { userId: userId1 } },
          { $elemMatch: { userId: userId2 } },
        ],
      },
    }).populate("participants.userId", "name avatar role email");

    if (conversation) {
      // Nếu conversation đã đóng thì tự động mở lại
      if (conversation.status === "closed") {
        conversation = await ChatConversation.findByIdAndUpdate(
          conversation._id,
          { status: "active" },
          { new: true }
        ).populate("participants.userId", "name avatar role email");
      }
      return conversation;
    }

    // Tạo mới nếu chưa có conversation nào
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

    return conversation.populate(
      "participants.userId",
      "name avatar role email"
    );
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
   * Gửi tin nhắn - hỗ trợ gửi text + images cùng lúc
   */
  async sendMessage({
    conversationId,
    senderId,
    type = "text",
    text,
    images = [],
  }) {
    // FIXED Bug #25: Validate text length để tránh spam/DoS
    const MAX_TEXT_LENGTH = 5000;
    if (text && text.length > MAX_TEXT_LENGTH) {
      throw new ApiError(
        400,
        `Tin nhắn không được vượt quá ${MAX_TEXT_LENGTH} ký tự`
      );
    }

    // FIXED Bug #25: Validate images count
    const MAX_IMAGES = 10;
    if (images && images.length > MAX_IMAGES) {
      throw new ApiError(
        400,
        `Không được gửi quá ${MAX_IMAGES} ảnh trong một tin nhắn`
      );
    }

    // Upload images nếu có với error handling
    let uploadedImages = [];
    if (images && images.length > 0) {
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

      // Nếu không có ảnh nào upload thành công và user chỉ gửi ảnh
      if (uploadedImages.length === 0 && !text?.trim()) {
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

    // Xác định loại tin nhắn: có cả text và images thì là "mixed"
    const hasText = text && text.trim().length > 0;
    const hasImages = uploadedImages.length > 0;
    let messageType = "text";
    if (hasImages && hasText) {
      messageType = "mixed"; // Cả text và images
    } else if (hasImages) {
      messageType = "image"; // Chỉ có images
    }

    // Tạo message
    const message = await ChatMessage.create({
      conversationId,
      senderId,
      type: messageType,
      text: text || "",
      images: uploadedImages,
      readBy: [{ userId: senderId, readAt: new Date() }],
    });

    // Update conversation với atomic operation để tránh race condition
    const conversation = await ChatConversation.findById(conversationId);

    // Build atomic update for unreadCount
    const unreadIncrements = {};
    conversation.participants.forEach((p) => {
      const participantId = p.userId.toString();
      if (participantId !== senderId.toString()) {
        unreadIncrements[`unreadCount.${participantId}`] = 1;
      }
    });

    // Atomic update để tránh race condition
    await ChatConversation.findByIdAndUpdate(
      conversationId,
      {
        $set: {
          lastMessage: {
            text: text || "[Hình ảnh]",
            sentBy: senderId,
            sentAt: new Date(),
          },
        },
        $inc: unreadIncrements,
      },
      { new: true }
    );

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
   * Mở lại conversation đã đóng
   */
  async reopenConversation(conversationId) {
    return ChatConversation.findByIdAndUpdate(
      conversationId,
      { status: "active" },
      { new: true }
    ).populate("participants.userId", "name avatar role email");
  }

  /**
   * Lấy danh sách users để admin có thể chat
   */
  async getAvailableUsers(
    currentUserId,
    { role, search, page = 1, limit = 20 }
  ) {
    const skip = (page - 1) * limit;

    const query = {
      _id: { $ne: currentUserId },
      isActive: true,
    };

    if (role) {
      query.role = role;
    } else {
      // Mặc định lấy user và shipper
      query.role = { $in: ["user", "shipper"] };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .select("_id name email role avatar phone")
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
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
