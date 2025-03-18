const { createSlug } = require("@utils/slugify");
const mongoose = require("mongoose");

/**
 * Áp dụng middleware cho Brand Schema
 * @param {mongoose.Schema} schema - Schema để áp dụng middleware
 */
const applyMiddlewares = (schema) => {
  // Tạo slug trước khi lưu
  schema.pre("save", function (next) {
    if (this.isModified("name")) {
      this.slug = createSlug(this.name);
    }
    next();
  });

  // Trước khi xóa, đảm bảo không có sản phẩm trỏ đến thương hiệu
  schema.pre("remove", async function (next) {
    const Product = mongoose.model("Product");
    const productCount = await Product.countDocuments({ brand: this._id });

    if (productCount > 0) {
      const error = new Error("Không thể xóa thương hiệu có sản phẩm");
      return next(error);
    }

    next();
  });
};

module.exports = { applyMiddlewares };
