const mongoose = require("mongoose");
const { createSlug } = require("@utils/slugify");

/**
 * Cập nhật tổng số lượng và trạng thái tồn kho của sản phẩm
 * @param {Object} product - Document sản phẩm hoặc ID sản phẩm
 * @returns {Promise<void>}
 */
async function updateProductStockInfo(product) {
  try {
    const Product = mongoose.model("Product");
    const Variant = mongoose.model("Variant");

    // Nếu là ID, lấy đối tượng sản phẩm
    const productId =
      typeof product === "string" || product instanceof mongoose.Types.ObjectId
        ? product
        : product._id;

    // Tìm tất cả variant của sản phẩm
    const variants = await Variant.find({
      _id: { $in: product.variants || [] },
      deletedAt: null,
      isActive: true,
    });

    // Tính tổng số lượng
    let totalQuantity = 0;
    variants.forEach((variant) => {
      if (variant.sizes && Array.isArray(variant.sizes)) {
        variant.sizes.forEach((sizeObj) => {
          if (sizeObj && sizeObj.quantity && sizeObj.quantity > 0) {
            totalQuantity += sizeObj.quantity;
          }
        });
      }
    });

    // Cập nhật trạng thái tồn kho
    let stockStatus = "out_of_stock";
    if (totalQuantity > 0) {
      stockStatus = totalQuantity <= 10 ? "low_stock" : "in_stock";
    }

    // Cập nhật sản phẩm (sử dụng findByIdAndUpdate để không kích hoạt middleware này lại)
    await Product.findByIdAndUpdate(
      productId,
      {
        totalQuantity,
        stockStatus,
      },
      {
        new: true,
        runValidators: false,
      }
    );
  } catch (error) {
    console.error("Lỗi khi cập nhật thông tin tồn kho:", error);
  }
}

/**
 * Áp dụng middleware cho Product Schema
 * @param {mongoose.Schema} schema - Schema để áp dụng middleware
 */
const applyMiddlewares = (schema) => {
  // Middleware để cập nhật totalQuantity trước khi lưu
  schema.pre("save", async function (next) {
    try {
      // Nếu là document mới hoặc có sự thay đổi về variants, cập nhật thông tin tồn kho
      if (this.isNew || this.isModified("variants")) {
        await updateProductStockInfo(this);
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  // Middleware để cập nhật totalQuantity khi biến thể được thêm hoặc sửa
  schema.pre("findOneAndUpdate", async function (next) {
    try {
      const update = this.getUpdate();
      const variants = update.variants || (update.$set && update.$set.variants);

      // Nếu có cập nhật variants, cập nhật thông tin tồn kho
      if (variants && Array.isArray(variants)) {
        const doc = await this.model.findOne(this.getQuery());
        if (doc) {
          // Tạm thời cập nhật variants để tính toán
          doc.variants = variants;
          await updateProductStockInfo(doc);
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  // Tạo slug trước khi lưu, đồng thời đảm bảo tính duy nhất
  schema.pre("save", async function (next) {
    try {
      if (this.isModified("name") || !this.slug) {
        this.slug = createSlug(this.name);

        // Đảm bảo slug là duy nhất
        const Product = mongoose.model("Product");
        const slugRegEx = new RegExp(`^${this.slug}(-\\d+)?$`, "i");
        const productsWithSlug = await Product.find({
          slug: slugRegEx,
          _id: { $ne: this._id },
          deletedAt: null,
        });

        if (productsWithSlug.length > 0) {
          this.slug = `${this.slug}-${productsWithSlug.length + 1}`;
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  // Xử lý khi khôi phục sản phẩm (đặt deletedAt thành null)
  schema.pre("findOneAndUpdate", async function (next) {
    try {
      const update = this.getUpdate();

      // Nếu đang khôi phục (đặt deletedAt thành null)
      if (update && update.$set && update.$set.deletedAt === null) {
        const doc = await this.model.findOne(this.getFilter(), {
          includeDeleted: true,
        });

        if (doc && doc.slug) {
          // Kiểm tra xem có sản phẩm nào khác đang dùng slug này không
          const duplicate = await this.model.findOne({
            slug: doc.slug,
            _id: { $ne: doc._id },
            deletedAt: null,
          });

          if (duplicate) {
            // Nếu có, tạo một slug mới với hậu tố thời gian
            const newSlug = `${doc.slug}-${Date.now()}`;
            update.$set.slug = newSlug;
            console.log(
              `Slug bị trùng khi khôi phục, đã tạo slug mới: ${newSlug}`
            );
          }
        }

        // Kiểm tra và cập nhật status khi khôi phục
        if (update.$set.isActive === undefined) {
          update.$set.isActive = false; // Mặc định là inactive khi khôi phục
        }
      }
      next();
    } catch (error) {
      console.error("Lỗi khi kiểm tra slug khi khôi phục:", error);
      next(error);
    }
  });
};

module.exports = {
  applyMiddlewares,
  updateProductStockInfo,
};
