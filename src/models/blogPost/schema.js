const mongoose = require("mongoose");

const BlogPostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    slug: {
      type: String,
      unique: true,
      required: true,
    },

    // Nội dung xen kẽ text và ảnh
    contentBlocks: [
      {
        type: {
          type: String,
          enum: ["TEXT", "IMAGE"],
          required: true,
        },
        order: {
          type: Number,
          required: true,
        },

        // Cho TEXT block
        text: {
          type: String,
          maxlength: 10000,
        },

        // Cho IMAGE block
        image: {
          url: String,
          public_id: String,
          caption: {
            type: String,
            maxlength: 200,
          },
          alt: String,
        },
      },
    ],

    // Ảnh thumbnail (preview trong danh sách)
    thumbnail: {
      url: {
        type: String,
        required: true,
      },
      public_id: {
        type: String,
        required: true,
      },
    },

    // Ảnh tiêu đề (featured image - hiển thị đầu bài viết)
    featuredImage: {
      url: {
        type: String,
      },
      public_id: {
        type: String,
      },
      caption: {
        type: String,
        maxlength: 200,
      },
      alt: String,
    },

    // Excerpt/mô tả ngắn
    excerpt: {
      type: String,
      maxlength: 300,
      trim: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlogCategory",
    },

    tags: [
      {
        type: String,
        trim: true,
      },
    ],

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      default: "DRAFT",
    },

    publishedAt: {
      type: Date,
    },

    // SEO
    metaTitle: {
      type: String,
      maxlength: 200,
    },

    metaDescription: {
      type: String,
      maxlength: 300,
    },

    metaKeywords: [String],

    // Stats
    viewCount: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Index
BlogPostSchema.index({ slug: 1 });
BlogPostSchema.index({ status: 1, publishedAt: -1 });
BlogPostSchema.index({ category: 1, status: 1 });
BlogPostSchema.index({ tags: 1 });
BlogPostSchema.index({ author: 1 });

// Text search
BlogPostSchema.index({ title: "text", excerpt: "text" });

module.exports = BlogPostSchema;

