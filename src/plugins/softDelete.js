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

  // SỬ DỤNG MIDDLEWARE THAY VÌ GHI ĐÈ PHƯƠNG THỨC

  // Middleware cho find và findOne
  ["find", "findOne", "findById", "countDocuments", "count"].forEach(
    (method) => {
      schema.pre(method, function (next) {
        // Kiểm tra xem có chỉ định includeDeleted không
        const includeDeleted = this.getQuery().includeDeleted;

        // Nếu không chỉ định includeDeleted, chỉ lấy các record chưa xóa
        if (includeDeleted === undefined) {
          this.where({ deletedAt: null });
        }

        // Xóa trường includeDeleted vì không phải một trường MongoDB
        if (includeDeleted !== undefined) {
          delete this.getQuery().includeDeleted;
        }

        next();
      });
    }
  );

  // Middleware cho update methods
  ["updateOne", "updateMany", "findOneAndUpdate", "findByIdAndUpdate"].forEach(
    (method) => {
      schema.pre(method, function (next) {
        const includeDeleted = this.getQuery().includeDeleted;

        if (includeDeleted === undefined) {
          this.where({ deletedAt: null });
        }

        if (includeDeleted !== undefined) {
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

  // Tạo phương thức tĩnh để tìm các mục chưa bị xóa
  schema.statics.findNotDeleted = function (query = {}) {
    return this.find({ ...query, deletedAt: null });
  };

  // Thêm phương thức tĩnh để tìm tất cả các mục kể cả đã xóa
  schema.statics.findWithDeleted = function (query = {}) {
    return this.find({ ...query, includeDeleted: true });
  };

  // Thêm phương thức tĩnh để đếm các mục đã bị xóa mềm
  schema.statics.countDeleted = function (query = {}) {
    return this.countDocuments({
      ...query,
      deletedAt: { $ne: null },
      includeDeleted: true,
    });
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

  // Thêm phương thức tĩnh để khôi phục nhiều mục cùng lúc
  schema.statics.restoreMany = async function (filter = {}) {
    return await this.updateMany(
      { ...filter, deletedAt: { $ne: null }, includeDeleted: true },
      {
        $set: {
          deletedAt: null,
          deletedBy: null,
        },
      }
    );
  };

  // Thêm phương thức tĩnh để tìm các mục đã bị xóa mềm
  schema.statics.findDeleted = function (query = {}) {
    return this.find({
      ...query,
      deletedAt: { $ne: null },
      includeDeleted: true,
    });
  };
};
