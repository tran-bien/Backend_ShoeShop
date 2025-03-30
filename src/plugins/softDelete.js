const mongoose = require("mongoose");

module.exports = function softDeletePlugin(schema, options) {
  options = options || {};

  // Đảm bảo schema không có sẵn trường deletedAt & deletedBy
  if (!schema.path("deletedAt")) {
    schema.add({
      deletedAt: {
        type: Date,
        default: null,
      },
    });
  }

  if (!schema.path("deletedBy")) {
    schema.add({
      deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    });
  }

  // Nếu bạn không muốn plugin tự thêm index, hãy kiểm tra option index
  if (options.index !== false) {
    schema.index({ deletedAt: 1 });
  }

  // Thêm thuộc tính ảo "isDeleted"
  schema.virtual("isDeleted").get(function () {
    return this.deletedAt !== null;
  });

  // CẢI TIẾN: Middleware cho find operations
  ["find", "findOne", "findById", "countDocuments", "count"].forEach(
    (method) => {
      schema.pre(method, function (next) {
        // Lấy options từ query hoặc từ options
        const includeDeleted =
          this.getOptions().includeDeleted || this.getQuery().includeDeleted;

        // Nếu không chỉ định includeDeleted, chỉ lấy các record chưa xóa
        if (!includeDeleted) {
          this.where({ deletedAt: null });
        }

        // Xóa trường includeDeleted khỏi query vì không phải field trong MongoDB
        if (this.getQuery().includeDeleted !== undefined) {
          delete this.getQuery().includeDeleted;
        }

        next();
      });
    }
  );

  // CẢI TIẾN: Middleware cho update operations
  ["updateOne", "updateMany", "findOneAndUpdate", "findByIdAndUpdate"].forEach(
    (method) => {
      schema.pre(method, function (next) {
        // Lấy options từ query hoặc từ options
        const includeDeleted =
          this.getOptions().includeDeleted || this.getQuery().includeDeleted;

        if (!includeDeleted) {
          this.where({ deletedAt: null });
        }

        // Xóa trường includeDeleted khỏi query
        if (this.getQuery().includeDeleted !== undefined) {
          delete this.getQuery().includeDeleted;
        }

        next();
      });
    }
  );

  // PHƯƠNG THỨC INSTANCE

  // Tạo phương thức cho instance để xóa mềm một mục
  schema.methods.softDelete = async function (userId = null) {
    this.deletedAt = new Date();
    this.deletedBy = userId;
    return await this.save();
  };

  // Tạo phương thức cho instance để khôi phục một mục đã xóa mềm
  schema.methods.restore = async function () {
    this.deletedAt = null;
    this.deletedBy = null;
    return await this.save();
  };

  // PHƯƠNG THỨC TĨNH
  // Thêm phương thức tĩnh để tìm chỉ các mục đã bị xóa mềm
  schema.statics.findDeleted = function (query = {}, options = {}) {
    const { sort, page, limit } = options;
    const paginationOptions = {};

    if (sort) paginationOptions.sort = sort;
    if (page && limit) {
      paginationOptions.skip = (parseInt(page) - 1) * parseInt(limit);
      paginationOptions.limit = parseInt(limit);
    }

    return this.find({
      ...query,
      deletedAt: { $ne: null },
    }).setOptions({ includeDeleted: true, ...paginationOptions });
  };

  // Thêm phương thức đếm các mục đã bị xóa mềm
  schema.statics.countDeleted = function (query = {}) {
    return this.countDocuments({
      ...query,
      deletedAt: { $ne: null },
    }).setOptions({ includeDeleted: true });
  };

  // Thêm phương thức tĩnh để xóa mềm nhiều mục cùng lúc
  schema.statics.softDeleteMany = async function (filter = {}, userId = null) {
    return await this.updateMany(filter, {
      $set: {
        deletedAt: new Date(),
        deletedBy: userId || null,
      },
    });
  };

  // Thêm phương thức tĩnh để khôi phục một document đã xóa mềm theo ID
  schema.statics.restoreById = async function (id) {
    try {
      // Tìm document đã xóa
      const doc = await this.findOne({ _id: id })
        .setOptions({ includeDeleted: true })
        .where("deletedAt")
        .ne(null);

      if (!doc) {
        throw new Error(`Không tìm thấy document hoặc document chưa bị xóa`);
      }

      // Khôi phục
      doc.deletedAt = null;
      doc.deletedBy = null;
      await doc.save();
      return doc;
    } catch (error) {
      throw error; // Re-throw để service xử lý
    }
  };

  // Thêm phương thức tĩnh để khôi phục nhiều mục cùng lúc
  schema.statics.restoreMany = async function (filter = {}) {
    return await this.updateMany(
      { ...filter, deletedAt: { $ne: null } },
      {
        $set: {
          deletedAt: null,
          deletedBy: null,
        },
      },
      { includeDeleted: true }
    );
  };
};
