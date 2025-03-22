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

  // Thay thế pre('remove') bằng phương thức kiểm tra trước khi xóa mềm
  schema.method("checkBeforeSoftDelete", async function () {
    const Product = mongoose.model("Product");

    // Đếm sản phẩm hoạt động liên kết với thương hiệu này
    const productCount = await Product.countDocuments({
      brand: this._id,
      deletedAt: null, // Chỉ kiểm tra sản phẩm chưa bị xóa
    });

    if (productCount > 0) {
      throw new Error("Không thể xóa thương hiệu có sản phẩm");
    }

    return true;
  });
};

module.exports = { applyMiddlewares };
