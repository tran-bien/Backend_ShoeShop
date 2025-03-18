const applyMiddlewares = (schema) => {
  // Tính lại tổng số tiền khi giỏ hàng được cập nhật
  schema.pre("save", function (next) {
    if (this.cartItems && Array.isArray(this.cartItems)) {
      this.totalPrice = this.cartItems.reduce((total, item) => {
        return total + (item.price * item.quantity || 0);
      }, 0);

      this.totalItems = this.cartItems.reduce((count, item) => {
        return count + (item.quantity || 0);
      }, 0);
    }
    next();
  });

  // Xử lý khi findOneAndUpdate
  schema.pre("findOneAndUpdate", function (next) {
    const update = this.getUpdate();
    const items = update.cartItems || (update.$set && update.$set.cartItems);

    if (items && Array.isArray(items)) {
      const totalPrice = items.reduce((total, item) => {
        return total + (item.price * item.quantity || 0);
      }, 0);

      const totalItems = items.reduce((count, item) => {
        return count + (item.quantity || 0);
      }, 0);

      if (!update.$set) update.$set = {};
      update.$set.totalPrice = totalPrice;
      update.$set.totalItems = totalItems;
    }
    next();
  });
};

module.exports = { applyMiddlewares };
