const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

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
  // và xử lý xung đột email khi khôi phục
  schema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate();

    // 1. Xử lý password nếu được cập nhật
    if (update && update.password) {
      try {
        const salt = await bcrypt.genSalt(10);
        update.password = await bcrypt.hash(update.password, salt);
      } catch (error) {
        return next(error);
      }
    }

    // 2. Xử lý khi khôi phục (đặt deletedAt thành null)
    if (update && update.$set && update.$set.deletedAt === null) {
      try {
        const doc = await this.model.findOne(this.getFilter(), {
          includeDeleted: true,
        });

        if (doc && doc.email) {
          // Kiểm tra xem có người dùng nào khác đang dùng email này không
          const duplicate = await this.model.findOne({
            email: doc.email,
            _id: { $ne: doc._id },
            deletedAt: null,
          });

          if (duplicate) {
            // Nếu có, tạo một email mới với hậu tố thời gian
            const emailParts = doc.email.split("@");
            const newEmail = `archived.${emailParts[0]}.${Date.now()}@${
              emailParts[1]
            }`;
            update.$set.email = newEmail;
            console.log(
              `Email bị trùng khi khôi phục, đã tạo email mới: ${newEmail}`
            );
          }
        }
      } catch (error) {
        console.error("Lỗi khi kiểm tra email khi khôi phục:", error);
      }
    }

    next();
  });
};

module.exports = { applyMiddlewares };
