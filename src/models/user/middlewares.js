const bcrypt = require("bcryptjs");

const applyMiddlewares = (schema) => {
  // Mã hóa mật khẩu trước khi lưu
  schema.pre("save", async function (next) {
    if (this.isModified("password")) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
    next();
  });

  // Đảm bảo chỉ có một địa chỉ mặc định
  schema.pre("save", function (next) {
    if (this.isModified("addresses")) {
      let hasDefault = false;

      // Kiểm tra và đảm bảo chỉ có một địa chỉ mặc định
      this.addresses.forEach((address) => {
        if (address.isDefault) {
          if (hasDefault) {
            address.isDefault = false;
          } else {
            hasDefault = true;
          }
        }
      });

      // Nếu không có địa chỉ mặc định và có ít nhất một địa chỉ
      if (!hasDefault && this.addresses.length > 0) {
        this.addresses[0].isDefault = true;
      }
    }
    next();
  });

  // Middleware trước khi cập nhật để hash mật khẩu nếu được cập nhật
  schema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate();

    // Nếu không cập nhật mật khẩu, bỏ qua
    if (!update.password) {
      return next();
    }

    try {
      // Hash mật khẩu mới
      const salt = await bcrypt.genSalt(10);
      update.password = await bcrypt.hash(update.password, salt);
      next();
    } catch (error) {
      next(error);
    }
  });
};

module.exports = { applyMiddlewares };
