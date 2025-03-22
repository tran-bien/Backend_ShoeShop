const mongoose = require("mongoose");
const { createSlug } = require("@utils/slugify");

/**
 * Áp dụng middleware cho Product Schema
 * @param {mongoose.Schema} schema - Schema để áp dụng middleware
 */
const applyMiddlewares = (schema) => {
  // Hàm để tính tổng số lượng và cập nhật trạng thái tồn kho
  function updateStockInfo(product) {
    let total = 0;
    if (Array.isArray(product.variants)) {
      product.variants.forEach((variant) => {
        // Chỉ tính nếu variant là object đã được populate và có trường sizes (mảng)
        if (
          variant &&
          typeof variant === "object" &&
          Array.isArray(variant.sizes)
        ) {
          total += variant.sizes.reduce(
            (sum, size) => sum + (size.quantity || 0),
            0
          );
        }
      });
    }
    product.totalQuantity = total;
    if (total <= 0) {
      product.stockStatus = "out_of_stock";
    } else if (total <= 10) {
      product.stockStatus = "low_stock";
    } else {
      product.stockStatus = "in_stock";
    }
  }

  // Middleware để cập nhật totalQuantity trước khi lưu
  schema.pre("save", function (next) {
    updateStockInfo(this);
    next();
  });

  // Middleware để cập nhật totalQuantity khi biến thể được thêm hoặc sửa
  schema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate();
    const variants = update.variants || (update.$set && update.$set.variants);

    if (
      variants &&
      Array.isArray(variants) &&
      variants.length > 0 &&
      typeof variants[0] === "object" // đảm bảo đã populate
    ) {
      const product = await this.model.findOne(this.getQuery());
      product.variants = variants; // Cập nhật biến thể
      updateStockInfo(product);
      await product.save();
    }
    next();
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

  // Đảm bảo mỗi variant có SKU duy nhất
  schema.pre("save", async function (next) {
    try {
      if (this.isModified("variants")) {
        const skuSet = new Set();
        for (const variant of this.variants) {
          if (variant && typeof variant === "object" && variant.sku) {
            if (skuSet.has(variant.sku)) {
              return next(new Error(`SKU trùng lặp: ${variant.sku}`));
            }
            skuSet.add(variant.sku);
          }
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  // Xử lý khi khôi phục sản phẩm (đặt deletedAt thành null)
  schema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate();

    // Nếu đang khôi phục (đặt deletedAt thành null)
    if (update && update.$set && update.$set.deletedAt === null) {
      try {
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
        if (!update.$set.isActive) {
          update.$set.isActive = false; // Mặc định là inactive khi khôi phục
        }
      } catch (error) {
        console.error("Lỗi khi kiểm tra slug khi khôi phục:", error);
      }
    }

    next();
  });
};

module.exports = { applyMiddlewares };
