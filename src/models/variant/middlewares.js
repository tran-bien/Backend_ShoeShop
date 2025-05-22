const mongoose = require("mongoose");

/**
 * Tạo SKU cho một size dựa trên thông tin biến thể
 * @param {Object} variant Biến thể cần tạo SKU
 * @param {Object} sizeObj Đối tượng kích thước
 */
function generateSkuForSize(variant, sizeObj) {
  // Lấy ID sản phẩm và biến thể, rút gọn thành 6 ký tự
  const productId = variant.product
    ? variant.product.toString().substring(0, 6)
    : "";
  const variantId = variant._id.toString().substring(0, 6);

  // Lấy ID của size, đảm bảo mỗi size có SKU khác nhau
  const sizeId = sizeObj.size
    ? sizeObj.size.toString().substring(0, 6)
    : "NOSIZE";

  // Lấy thông tin màu sắc
  let colorCode = "NC";
  if (variant.color) {
    colorCode = variant.color.toString().substring(0, 4).toUpperCase();
  }

  // Lấy viết tắt giới tính
  const genderMap = {
    male: "M",
    female: "F",
  };
  const genderCode =
    genderMap[variant.gender] || variant.gender?.charAt(0).toUpperCase() || "U";

  // Lấy giá trị của size
  let sizeValue = "NS";
  if (sizeObj.size) {
    if (typeof sizeObj.size === "object" && sizeObj.size.value !== undefined) {
      sizeValue = sizeObj.size.value.toString();
    } else {
      const size = sizeObj.size.toString();
      sizeValue = size.substring(Math.max(0, size.length - 4));
    }
  }

  // Thêm một giá trị ngẫu nhiên để đảm bảo tính duy nhất
  const randomVal = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  // Format: PPPPPP-VVVVVV-C-G-SSSID-SZVAL-RRR
  // P: Product ID, V: Variant ID, C: Color, G: Gender, S: Size ID, SZ: Size Value, R: Random
  return `${productId}-${variantId}-${colorCode}-${genderCode}-${sizeId}-${sizeValue}-${randomVal}`;
}

/**
 * Cập nhật thông tin số lượng và trạng thái tồn kho của sản phẩm
 * @param {string} productId - ID của sản phẩm cần cập nhật
 */
async function updateProductStock(productId) {
  if (!productId) return;

  try {
    const Product = mongoose.model("Product");
    // Import hàm cập nhật stock từ product middlewares
    const { updateProductStockInfo } = require("../product/middlewares");

    const product = await Product.findById(productId);
    if (product) {
      await updateProductStockInfo(product);
    }
  } catch (error) {
    console.error(
      `[variant/middlewares] Lỗi cập nhật tồn kho: ${error.message}`
    );
  }
}

/**
 * Áp dụng middleware cho Variant Schema
 * @param {mongoose.Schema} schema - Schema để áp dụng middleware
 */
const applyMiddlewares = (schema) => {
  // Pre-save hook: Khi lưu mới, xử lý tự động tạo SKU cho từng size nếu chưa có và tính toán các trường liên quan
  schema.pre("save", async function (next) {
    try {
      // Duyệt qua mảng sizes của variant
      if (this.sizes && Array.isArray(this.sizes)) {
        this.sizes.forEach((sizeObj) => {
          if (!sizeObj.sku) {
            sizeObj.sku = generateSkuForSize(this, sizeObj);
          }
          // Cập nhật thuộc tính isSizeAvailable dựa trên quantity
          if (sizeObj.quantity !== undefined) {
            sizeObj.isSizeAvailable = sizeObj.quantity > 0;
          }
        });
      }

      // Tính priceFinal trước để dùng cho việc tính profit
      this.priceFinal =
        this.percentDiscount > 0
          ? this.price - (this.price * this.percentDiscount) / 100
          : this.price;

      // Tính profit dựa trên priceFinal thay vì price
      this.profit = this.priceFinal - this.costPrice;

      // Tính profitPercentage dựa trên profit mới
      this.profitPercentage = this.costPrice
        ? (this.profit / this.costPrice) * 100
        : 0;

      next();
    } catch (error) {
      next(error);
    }
  });

  // Post-save hook: Sau khi lưu, cập nhật thông tin sản phẩm liên quan
  schema.post("save", async function () {
    try {
      if (this.product) {
        await updateProductStock(this.product);
      }
    } catch (error) {
      console.error(
        "[POST-SAVE] Lỗi khi cập nhật tồn kho sau lưu variant:",
        error
      );
    }
  });

  // Pre-findOneAndUpdate hook: Khi sử dụng findOneAndUpdate để cập nhật document Variant
  schema.pre("findOneAndUpdate", async function (next) {
    try {
      const update = this.getUpdate();
      if (!update) return next();

      // Lưu productId để cập nhật sau khi update
      const doc = await this.model.findOne(this.getQuery());
      if (doc && doc.product) {
        this._productId = doc.product;
      }

      // Nếu có cập nhật mảng sizes, xử lý tạo SKU cho các phần tử chưa có SKU
      const sizesData = update.$set ? update.$set.sizes : update.sizes;
      if (sizesData && Array.isArray(sizesData)) {
        const doc = await this.model.findOne(this.getQuery());
        if (!doc) return next();

        sizesData.forEach((sizeObj, index) => {
          if (!sizeObj.sku) {
            sizesData[index].sku = generateSkuForSize(doc, sizeObj);
          }
          if (sizeObj.quantity !== undefined) {
            sizesData[index].isSizeAvailable = sizeObj.quantity > 0;
          }
        });

        if (update.$set) {
          update.$set.sizes = sizesData;
        } else {
          update.sizes = sizesData;
        }
      }

      // Tính toán lại các trường nếu có cập nhật các trường price, costPrice, percentDiscount
      const newPrice =
        update.price !== undefined
          ? update.price
          : update.$set && update.$set.price;
      const newCostPrice =
        update.costPrice !== undefined
          ? update.costPrice
          : update.$set && update.$set.costPrice;
      const newPercentDiscount =
        update.percentDiscount !== undefined
          ? update.percentDiscount
          : update.$set && update.$set.percentDiscount;

      if (
        newPrice !== undefined ||
        newCostPrice !== undefined ||
        newPercentDiscount !== undefined
      ) {
        // Lấy giá trị hiện tại để tính toán nếu không có giá trị mới
        const currentDoc = await this.model.findOne(this.getQuery());
        if (currentDoc) {
          const price = newPrice !== undefined ? newPrice : currentDoc.price;
          const costPrice =
            newCostPrice !== undefined ? newCostPrice : currentDoc.costPrice;
          const percentDiscount =
            newPercentDiscount !== undefined
              ? newPercentDiscount
              : currentDoc.percentDiscount;

          // Tính priceFinal trước
          const newPriceFinal =
            percentDiscount > 0
              ? price - (price * percentDiscount) / 100
              : price;

          // Tính profit dựa trên priceFinal
          const newProfit = newPriceFinal - costPrice;

          // Tính profitPercentage dựa trên profit mới
          const newProfitPercentage =
            costPrice > 0 ? (newProfit / costPrice) * 100 : 0;

          if (!update.$set) update.$set = {};
          update.$set.priceFinal = newPriceFinal;
          update.$set.profit = newProfit;
          update.$set.profitPercentage = newProfitPercentage;
        }
      }

      // Xử lý khi khôi phục variant (đặt deletedAt thành null)
      if (update.$set && update.$set.deletedAt === null) {
        try {
          const doc = await this.model.findOne(this.getQuery(), {
            includeDeleted: true,
          });

          if (doc && doc.sizes && Array.isArray(doc.sizes)) {
            // Kiểm tra xem có SKU nào bị trùng khi khôi phục không
            const skus = doc.sizes.map((size) => size.sku).filter(Boolean);

            // Tìm tất cả variant có SKU trùng với các SKU của variant đang khôi phục
            const duplicateSKUs = [];
            for (const sku of skus) {
              if (sku) {
                // Tìm các SKU trùng lặp trong các variant khác không bị xóa
                const duplicateExists = await this.model.findOne({
                  "sizes.sku": sku,
                  _id: { $ne: doc._id },
                  deletedAt: null,
                });

                if (duplicateExists) {
                  duplicateSKUs.push(sku);
                }
              }
            }

            // Nếu có SKU bị trùng, tạo SKU mới cho các size bị trùng
            if (duplicateSKUs.length > 0) {
              console.log(
                `Phát hiện ${duplicateSKUs.length} SKU trùng lặp khi khôi phục variant`
              );

              // Lấy sizes hiện tại
              const updatedSizes = JSON.parse(JSON.stringify(doc.sizes));

              // Tạo SKU mới cho các size bị trùng
              updatedSizes.forEach((size, index) => {
                if (size.sku && duplicateSKUs.includes(size.sku)) {
                  // Tạo SKU mới
                  updatedSizes[index].sku = generateSkuForSize(doc, size);
                  console.log(`Đã tạo SKU mới: ${updatedSizes[index].sku}`);
                }
              });

              // Cập nhật mảng sizes với các SKU mới
              if (!update.$set) update.$set = {};
              update.$set.sizes = updatedSizes;
            }
          }

          // Đặt trạng thái mặc định khi khôi phục là inactive
          if (update.$set.isActive === undefined) {
            update.$set.isActive = false;
          }
        } catch (error) {
          console.error(
            "Lỗi khi kiểm tra SKU trùng lặp khi khôi phục variant:",
            error
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  });

  // Post-findOneAndUpdate hook: Sau khi cập nhật, cập nhật thông tin sản phẩm liên quan
  schema.post("findOneAndUpdate", async function (doc) {
    try {
      // Sử dụng productId đã lưu trữ hoặc từ document cập nhật
      const productId = this._productId || (doc && doc.product);
      if (productId) {
        await updateProductStock(productId);
        // Xóa biến tạm để tránh rò rỉ bộ nhớ
        delete this._productId;
      }
    } catch (error) {
      console.error(
        "[POST-FINDONEANDUPDATE] Lỗi khi cập nhật tồn kho sau cập nhật variant:",
        error
      );
    }
  });

  // Pre-deleteOne/findOneAndDelete hook: Trước khi xóa, lưu productId
  schema.pre(/deleteOne|findOneAndDelete/, async function (next) {
    try {
      const doc = await this.model.findOne(this.getQuery());
      if (doc && doc.product) {
        this._productId = doc.product;
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  // Post-deleteOne/findOneAndDelete hook: Sau khi xóa, cập nhật thông tin sản phẩm liên quan
  schema.post(/deleteOne|findOneAndDelete/, async function () {
    try {
      if (this._productId) {
        await updateProductStock(this._productId);
        delete this._productId;
      }
    } catch (error) {
      console.error(
        "[POST-DELETE] Lỗi khi cập nhật tồn kho sau xóa variant:",
        error
      );
    }
  });

  // Post-updateMany hook: Sau khi cập nhật nhiều variant, cập nhật các sản phẩm liên quan
  schema.post("updateMany", async function () {
    try {
      const filter = this.getQuery();

      // Nếu là cập nhật theo productId cụ thể
      if (filter.product) {
        await updateProductStock(filter.product);
      }
      // Nếu cập nhật theo nhiều variant
      else if (filter._id && filter._id.$in) {
        // Lấy danh sách productId từ các variant bị ảnh hưởng
        const Variant = mongoose.model("Variant");
        const variants = await Variant.find({
          _id: { $in: filter._id.$in },
        }).distinct("product");

        // Cập nhật tất cả các sản phẩm liên quan
        for (const productId of variants) {
          await updateProductStock(productId);
        }
      }
    } catch (error) {
      console.error(
        "[POST-UPDATEMANY] Lỗi khi cập nhật tồn kho sau updateMany:",
        error
      );
    }
  });

  // Middleware POST-SOFTDELETE và POST-RESTORE: Cập nhật stock sau khi xóa mềm hoặc khôi phục
  schema.post("softDelete", async function () {
    try {
      if (this.product) {
        await updateProductStock(this.product);
      }
    } catch (error) {
      console.error("[POST-SOFTDELETE] Lỗi cập nhật tồn kho:", error);
    }
  });

  schema.post("restore", async function () {
    try {
      if (this.product) {
        await updateProductStock(this.product);
      }
    } catch (error) {
      console.error("[POST-RESTORE] Lỗi cập nhật tồn kho:", error);
    }
  });
};

module.exports = {
  applyMiddlewares,
  generateSkuForSize,
  updateProductStock,
};
