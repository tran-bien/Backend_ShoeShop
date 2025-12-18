const { ChatConversation, ChatMessage, User } = require("@models");
const ApiError = require("@utils/ApiError");

/**
 * Chat Service - Simplified (NO status open/close)
 * Mỗi cặp user chỉ có DUY NHẤT 1 conversation
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
   * CHỈ 1 CONVERSATION DUY NHẤT giữa 2 users (không có status)
   */
  async getOrCreateConversation(
    userId1,
    role1,
    userId2,
    role2,
    orderId = null
  ) {
    console.log(
      `[ChatService] getOrCreateConversation: user1=${userId1}, user2=${userId2}`
    );

    // Tìm conversation đã tồn tại giữa 2 users
    let conversation = await ChatConversation.findOne({
      participants: {
        $all: [
          { $elemMatch: { userId: userId1 } },
          { $elemMatch: { userId: userId2 } },
        ],
      },
    }).populate("participants.userId", "name avatar role email");

    if (conversation) {
      console.log(
        `[ChatService] Found existing conversation: ${conversation._id}`
      );
      return conversation;
    }

    // Tạo mới nếu chưa có
    console.log(`[ChatService] Creating new conversation`);
    conversation = await ChatConversation.create({
      participants: [
        { userId: userId1, role: role1, joinedAt: new Date() },
        { userId: userId2, role: role2, joinedAt: new Date() },
      ],
      orderId,
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
   * Lấy TẤT CẢ conversations của user (không filter status)
   */
  async getUserConversations(userId, { page = 1, limit = 50 }) {
    const skip = (page - 1) * limit;

    console.log(`[ChatService] getUserConversations for userId: ${userId}`);

    const conversations = await ChatConversation.find({
      "participants.userId": userId,
    })
      .populate("participants.userId", "name avatar role email")
      .populate("lastMessage.sentBy", "name")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ChatConversation.countDocuments({
      "participants.userId": userId,
    });

    console.log(`[ChatService] Found ${conversations.length} conversations`);

    // Transform unreadCount Map to single number for current user
    const transformedConversations = conversations.map((conv) => {
      const convObj = conv.toObject();
      // Get unreadCount for this specific user from the Map
      convObj.unreadCount = conv.unreadCount?.get(userId.toString()) || 0;
      return convObj;
    });

    return {
      conversations: transformedConversations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Gửi tin nhắn - chỉ hỗ trợ text
   */
  async sendMessage({ conversationId, senderId, text }) {
    console.log(
      `[ChatService] sendMessage: conv=${conversationId}, sender=${senderId}`
    );

    // Validate text
    if (!text || !text.trim()) {
      throw new ApiError(400, "Tin nhắn không được để trống");
    }

    const MAX_TEXT_LENGTH = 5000;
    if (text.length > MAX_TEXT_LENGTH) {
      throw new ApiError(
        400,
        `Tin nhắn không được vượt quá ${MAX_TEXT_LENGTH} ký tự`
      );
    }

    // Tạo message
    const message = await ChatMessage.create({
      conversationId,
      senderId,
      type: "text",
      text: text.trim(),
      readBy: [{ userId: senderId, readAt: new Date() }],
    });

    // Update conversation
    const conversation = await ChatConversation.findById(conversationId);
    if (!conversation) {
      throw new ApiError(404, "Không tìm thấy conversation");
    }

    // Build unreadCount increments
    const unreadIncrements = {};
    conversation.participants.forEach((p) => {
      const participantId = p.userId.toString();
      if (participantId !== senderId.toString()) {
        unreadIncrements[`unreadCount.${participantId}`] = 1;
      }
    });

    // Atomic update
    await ChatConversation.findByIdAndUpdate(
      conversationId,
      {
        $set: {
          lastMessage: {
            text: text.trim(),
            sentBy: senderId,
            sentAt: new Date(),
          },
        },
        $inc: unreadIncrements,
      },
      { new: true }
    );

    const populatedMessage = await message.populate(
      "senderId",
      "name avatar role"
    );
    console.log(`[ChatService] Message created: ${populatedMessage._id}`);

    return populatedMessage;
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
      messages: messages.reverse(),
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
    const conversation = await ChatConversation.findById(conversationId);
    if (conversation) {
      conversation.unreadCount.set(userId.toString(), 0);
      await conversation.save();
    }

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

  /**
   * Lấy tất cả participant IDs của một conversation
   */
  async getConversationParticipantIds(conversationId) {
    const conversation = await ChatConversation.findById(conversationId);
    if (!conversation) return [];
    return conversation.participants.map((p) => p.userId.toString());
  }
}

module.exports = new ChatService();
