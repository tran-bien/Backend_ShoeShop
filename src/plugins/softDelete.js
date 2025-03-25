const mongoose = require("mongoose");

module.exports = function softDeletePlugin(schema, options) {
  options = options || {};
  // Thêm trường deletedAt (nhưng không dùng option index nếu đã được set)
  schema.add({ deletedAt: { type: Date, default: null } });

  // Nếu bạn không muốn plugin tự thêm index, hãy kiểm tra option index
  if (options.index !== false) {
    schema.index({ deletedAt: 1 });
  }

  // Thêm thuộc tính ảo "isDeleted"
  schema.virtual("isDeleted").get(function () {
    return this.deletedAt !== null;
  });

  // Tạo phương thức tĩnh để tìm các mục chưa bị xóa
  schema.static("findNotDeleted", function (query = {}) {
    return this.find({ ...query, deletedAt: null });
  });

  // Tạo phương thức cho instance để xóa mềm một mục (sử dụng updateOne để tránh middleware)
  schema.method("softDelete", async function (userId = null) {
    const updateData = {
      deletedAt: new Date(),
      deletedBy: userId || null,
    };

    // Cập nhật trong bộ nhớ để instance phản ánh trạng thái mới
    this.deletedAt = updateData.deletedAt;
    this.deletedBy = updateData.deletedBy;

    // Sử dụng updateOne để tránh kích hoạt các middleware pre('save')
    return await this.constructor.updateOne(
      { _id: this._id },
      { $set: updateData }
    );
  });

  // Tạo phương thức cho instance để khôi phục một mục đã xóa mềm
  schema.method("restore", async function () {
    // Cập nhật trong bộ nhớ
    this.deletedAt = null;
    this.deletedBy = null;

    // Cập nhật trong DB
    return await this.constructor.updateOne(
      { _id: this._id },
      {
        $set: {
          deletedAt: null,
          deletedBy: null,
        },
      }
    );
  });

  // Sửa đổi các phương thức tìm kiếm mặc định để loại trừ các mục đã xóa mềm
  const queryMethods = [
    "find",
    "findOne",
    "findById",
    "countDocuments",
    "count",
  ];

  queryMethods.forEach((method) => {
    const originalMethod = schema.statics[method];

    schema.static(method, function (...args) {
      // Nếu đối số đầu tiên là một đối tượng truy vấn, thêm deletedAt: null vào đó
      if (args[0] !== null && typeof args[0] === "object") {
        // Chỉ thêm bộ lọc nếu includeDeleted không được đặt rõ ràng
        if (!args[0].includeDeleted) {
          args[0].deletedAt = null;
        }

        // Xóa cờ includeDeleted vì nó không phải là trường MongoDB
        if (args[0].includeDeleted) {
          delete args[0].includeDeleted;
        }
      }

      return originalMethod.apply(this, args);
    });
  });

  // Xử lý các phương thức update
  const updateMethods = [
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "findByIdAndUpdate",
  ];

  updateMethods.forEach((method) => {
    const originalMethod = schema.statics[method];

    schema.static(method, function (...args) {
      // Thêm điều kiện deletedAt: null cho điều kiện tìm kiếm
      if (args[0] !== null && typeof args[0] === "object") {
        if (!args[0].includeDeleted) {
          args[0].deletedAt = null;
        }

        // Xóa cờ includeDeleted
        if (args[0].includeDeleted) {
          delete args[0].includeDeleted;
        }
      }

      return originalMethod.apply(this, args);
    });
  });

  // Thêm phương thức tĩnh để tìm tất cả các mục kể cả đã xóa
  schema.static("findWithDeleted", function (query = {}) {
    return this.find({ ...query });
  });

  // Thêm phương thức tĩnh để đếm các mục đã bị xóa mềm
  schema.static("countDeleted", function (query = {}) {
    return this.countDocuments({ ...query, deletedAt: { $ne: null } });
  });

  // Thêm phương thức tĩnh để xóa mềm nhiều mục cùng lúc
  schema.static("softDeleteMany", async function (filter = {}, userId = null) {
    return await this.updateMany(filter, {
      $set: {
        deletedAt: new Date(),
        deletedBy: userId || null,
      },
    });
  });

  // Thêm phương thức tĩnh để khôi phục nhiều mục cùng lúc
  schema.static("restoreMany", async function (filter = {}) {
    return await this.updateMany(
      { ...filter, deletedAt: { $ne: null } },
      {
        $set: {
          deletedAt: null,
          deletedBy: null,
        },
      }
    );
  });
};
