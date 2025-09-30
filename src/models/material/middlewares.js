const mongoose = require("mongoose");
const ApiError = require("@utils/ApiError");

/**
 * Áp dụng middleware cho Material Schema
 * @param {mongoose.Schema} schema - Schema để áp dụng middleware
 */
const applyMiddlewares = (schema) => {
  // Middleware kiểm tra trước khi xóa - không cho phép xóa nếu đang được sử dụng
  schema.pre("deleteOne", { document: true }, async function (next) {
    try {
      const Product = mongoose.model("Product");
      const count = await Product.countDocuments({
        material: this._id,
        deletedAt: null,
      });

      if (count > 0) {
        throw new ApiError(
          400,
          `Không thể xóa chất liệu này vì có ${count} sản phẩm đang sử dụng`
        );
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  // Middleware kiểm tra trước khi xóa nhiều
  schema.pre("deleteMany", async function (next) {
    try {
      const Product = mongoose.model("Product");
      const materialIds = await this.model.find(this.getFilter()).select("_id");

      for (const material of materialIds) {
        const count = await Product.countDocuments({
          material: material._id,
          deletedAt: null,
        });

        if (count > 0) {
          throw new ApiError(
            400,
            `Không thể xóa chất liệu có ID ${material._id} vì có ${count} sản phẩm đang sử dụng`
          );
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  });
};

module.exports = { applyMiddlewares };
