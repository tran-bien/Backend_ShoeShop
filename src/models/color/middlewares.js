const applyMiddlewares = (schema) => {
  // Chuyển đổi mã màu thành chữ in hoa
  schema.pre("save", function (next) {
    if (this.code) {
      this.code = this.code.toUpperCase();
    }

    // Chuyển đổi tất cả các màu thành chữ in hoa nếu có
    if (this.colors && Array.isArray(this.colors)) {
      this.colors = this.colors.map((color) => color.toUpperCase());
    }

    next();
  });
};

module.exports = { applyMiddlewares };
