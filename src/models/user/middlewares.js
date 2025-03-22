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

  // Thêm middleware cho xóa mềm - kiểm tra trước khi xóa mềm
  schema.method("checkBeforeSoftDelete", async function () {
    // Kiểm tra đơn hàng đang xử lý
    const Order = mongoose.model("Order");
    const pendingOrders = await Order.countDocuments({
      user: this._id,
      status: { $nin: ["delivered", "cancelled", "refunded"] },
      deletedAt: null,
    });

    if (pendingOrders > 0) {
      throw new Error("Không thể xóa tài khoản có đơn hàng đang xử lý");
    }

    return true;
  });

  // Xử lý đồng bộ khi xóa mềm người dùng
  schema.method("softDeleteRelatedData", async function (userId) {
    try {
      // Xóa các bình luận của người dùng
      const Comment = mongoose.model("Comment");
      if (Comment) {
        await Comment.softDeleteMany({ user: this._id }, userId);
      }

      // Xóa giỏ hàng của người dùng
      const Cart = mongoose.model("Cart");
      if (Cart) {
        await Cart.softDeleteMany({ user: this._id }, userId);
      }

      // Đánh dấu đã xóa các reviews của người dùng nhưng không xóa hoàn toàn
      // để giữ lại thông tin đánh giá cho sản phẩm
      const Review = mongoose.model("Review");
      if (Review) {
        await Review.softDeleteMany({ user: this._id }, userId);
      }

      return true;
    } catch (error) {
      console.error("Lỗi khi xóa dữ liệu liên quan:", error);
      throw error;
    }
  });

  // Xử lý khôi phục dữ liệu liên quan khi khôi phục người dùng
  schema.method("restoreRelatedData", async function () {
    try {
      // Khôi phục các bình luận của người dùng
      const Comment = mongoose.model("Comment");
      if (Comment) {
        await Comment.restoreMany({ user: this._id });
      }

      // Khôi phục giỏ hàng của người dùng
      const Cart = mongoose.model("Cart");
      if (Cart) {
        await Cart.restoreMany({ user: this._id });
      }

      // Khôi phục reviews của người dùng
      const Review = mongoose.model("Review");
      if (Review) {
        await Review.restoreMany({ user: this._id });
      }

      return true;
    } catch (error) {
      console.error("Lỗi khi khôi phục dữ liệu liên quan:", error);
      throw error;
    }
  });
};

module.exports = { applyMiddlewares };
