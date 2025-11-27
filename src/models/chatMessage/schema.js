const mongoose = require("mongoose");

/**
 * Chat Message - Simple version
 * Support: Text và Image only
 */
const ChatMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true,
      index: true,
    },

    // Người gửi
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Loại tin nhắn
    type: {
      type: String,
      enum: ["text", "image"],
      required: true,
      default: "text",
    },

    // Nội dung
    text: {
      type: String,
      maxLength: 2000,
    },

    // Hình ảnh (nếu có) - từ Cloudinary
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        public_id: {
          type: String,
          required: true,
        },
      },
    ],

    // Đã đọc chưa
    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// INDEXES
ChatMessageSchema.index({ conversationId: 1, createdAt: -1 });
ChatMessageSchema.index({ senderId: 1 });

module.exports = mongoose.model("ChatMessage", ChatMessageSchema);
