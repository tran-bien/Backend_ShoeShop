const mongoose = require("mongoose");

const applyMiddlewares = (schema) => {
  schema.pre("save", function (next) {
    // Đảm bảo giá trị là số nguyên dương
    if (this.isModified("value")) {
      this.value = Math.abs(Math.round(this.value));
    }

    next();
  });

  // Middleware trước khi cập nhật để xử lý giá trị
  schema.pre("findOneAndUpdate", function (next) {
    const update = this.getUpdate();

    // Đảm bảo giá trị là số nguyên dương
    if (update.value !== undefined) {
      update.value = Math.abs(Math.round(update.value));
    }

    next();
  });
};

module.exports = { applyMiddlewares };
