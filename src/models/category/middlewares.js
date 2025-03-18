const mongoose = require("mongoose");
const { createSlug } = require("@utils/slugify");

/**
 * Áp dụng middleware cho Category Schema
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

  // Trước khi xóa, đảm bảo không có sản phẩm trỏ đến danh mục
  schema.pre("deleteOne", { document: true }, async function (next) {
    const Product = mongoose.model("Product");
    const productCount = await Product.countDocuments({ category: this._id });

    if (productCount > 0) {
      const error = new Error("Không thể xóa danh mục có sản phẩm");
      return next(error);
    }

    next();
  });
};

module.exports = { applyMiddlewares };
