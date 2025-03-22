const applyMiddlewares = (schema) => {
  // Điều chỉnh TTL khi đánh dấu xóa
  schema.pre("save", function (next) {
    // Nếu thông báo được đánh dấu xóa, đặt thời gian hết hạn ngắn hơn (3 ngày)
    if (
      this.isModified("markedForDeletion") &&
      this.markedForDeletion === true
    ) {
      const date = new Date();
      date.setDate(date.getDate() + 3); // Sẽ bị xóa sau 3 ngày
      this.expiresAt = date;
    }

    next();
  });

  // Xử lý tương tự cho findOneAndUpdate
  schema.pre("findOneAndUpdate", function (next) {
    const update = this.getUpdate();

    // Nếu đang cập nhật markedForDeletion thành true
    if (update && update.$set && update.$set.markedForDeletion === true) {
      const date = new Date();
      date.setDate(date.getDate() + 3);

      if (!update.$set) update.$set = {};
      update.$set.expiresAt = date;
    }

    next();
  });

  // Khi đọc thông báo, tự động đặt isRead = true
  schema.pre("findOne", function (next) {
    // Lưu lại thông tin truy vấn ban đầu để sử dụng sau
    this._originalFilter = { ...this.getFilter() };
    next();
  });

  schema.post("findOne", async function (doc) {
    if (doc && !doc.isRead) {
      // Nếu tìm thấy document và chưa đọc, cập nhật isRead = true
      await this.model.updateOne({ _id: doc._id }, { $set: { isRead: true } });
    }
  });
};

module.exports = { applyMiddlewares };
