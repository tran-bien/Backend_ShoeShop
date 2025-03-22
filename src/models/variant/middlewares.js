/**
 * Hàm tự tạo SKU cho một size dựa trên:
 * - Mã sản phẩm (nếu có field productId, dùng field đó; nếu không dùng _id)
 * - Tên màu (color) viết in hoa
 * - Viết tắt giới tính
 * - Viết tắt kích cỡ
 */
function generateSkuForSize(variant, sizeObj) {
  // Sử dụng productId nếu có, ngược lại dùng _id của variant
  const productId = variant.productId
    ? variant.productId.toString()
    : variant._id.toString();

  // Lấy tên của màu: nếu tồn tại, sử dụng giá trị của variant.color (đã chuyển thành chữ in hoa); nếu không có thì 'NC'
  let colorName = "NC";
  if (variant.color) {
    colorName = variant.color.toString().toUpperCase();
  }

  // Lấy viết tắt của giới tính: chuyển "male" thành "M", "female" thành "F"; nếu không có dữ liệu, lấy ký tự đầu của variant.gender (viết hoa), nếu không có thì 'NG'
  let genderAbbr = "NG";
  if (variant.gender) {
    const genderLower = variant.gender.toLowerCase();
    if (genderLower === "male") {
      genderAbbr = "M";
    } else if (genderLower === "female") {
      genderAbbr = "F";
    } else {
      genderAbbr = variant.gender.charAt(0).toUpperCase();
    }
  }

  // Lấy kích cỡ: nếu đã được populate (có thuộc tính value) thì lấy value, nếu không, chuyển đổi trực tiếp sang chuỗi
  let sizeStr = "NS";
  if (sizeObj.size) {
    if (typeof sizeObj.size === "object" && sizeObj.size.value !== undefined) {
      sizeStr = sizeObj.size.value.toString();
    } else {
      sizeStr = sizeObj.size.toString();
    }
  }

  // Trả về SKU theo định dạng: productId-colorName-genderAbbr-sizeStr
  return `${productId}-${colorName}-${genderAbbr}-${sizeStr}`;
}

/**
 * Áp dụng middleware cho Variant Schema
 * @param {mongoose.Schema} schema - Schema để áp dụng middleware
 */
const applyMiddlewares = (schema) => {
  // Pre-save hook: Khi lưu mới, xử lý tự động tạo SKU cho từng size nếu chưa có và tính toán các trường liên quan
  schema.pre("save", function (next) {
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
    // Tính toán lại các trường: profit, profitPercentage, priceFinal
    this.profit = this.price - this.costPrice;
    this.profitPercentage = this.costPrice
      ? ((this.price - this.costPrice) / this.costPrice) * 100
      : 0;
    this.priceFinal =
      this.percentDiscount > 0
        ? this.price - (this.price * this.percentDiscount) / 100
        : this.price;
    next();
  });

  // Pre-findOneAndUpdate hook: Khi sử dụng findOneAndUpdate để cập nhật document Variant
  schema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate();
    if (update) {
      // Nếu có cập nhật mảng sizes, xử lý tạo SKU cho các phần tử chưa có SKU
      const sizesData = update.$set ? update.$set.sizes : update.sizes;
      if (sizesData && Array.isArray(sizesData)) {
        // Lấy document hiện tại để có thông tin (productId, color, gender, createdAt) cần thiết
        const doc = await this.model.findOne(this.getQuery());
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
      if (newPrice !== undefined && newCostPrice !== undefined) {
        const newProfit = newPrice - newCostPrice;
        const newProfitPercentage = newCostPrice
          ? ((newPrice - newCostPrice) / newCostPrice) * 100
          : 0;
        const newPriceFinal =
          newPercentDiscount !== undefined && newPercentDiscount > 0
            ? newPrice - (newPrice * newPercentDiscount) / 100
            : newPrice;
        if (!update.$set) update.$set = {};
        update.$set.profit = newProfit;
        update.$set.profitPercentage = newProfitPercentage;
        update.$set.priceFinal = newPriceFinal;
      }

      // Xử lý khi khôi phục variant (đặt deletedAt thành null)
      if (update.$set && update.$set.deletedAt === null) {
        try {
          const doc = await this.model.findOne(this.getQuery(), {
            includeDeleted: true,
          });

          if (doc && doc.sizes && Array.isArray(doc.sizes)) {
            // Kiểm tra xem có SKU nào bị trùng khi khôi phục không
            const skus = doc.sizes.map((size) => size.sku);

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
              const timestamp = Date.now();
              updatedSizes.forEach((size, index) => {
                if (duplicateSKUs.includes(size.sku)) {
                  // Tạo SKU mới bằng cách thêm timestamp
                  updatedSizes[index].sku = `${size.sku}-${timestamp}`;
                  console.log(`Đã tạo SKU mới: ${updatedSizes[index].sku}`);
                }
              });

              // Cập nhật mảng sizes với các SKU mới
              if (!update.$set) update.$set = {};
              update.$set.sizes = updatedSizes;
            }
          }

          // Đặt trạng thái mặc định khi khôi phục là inactive
          if (!update.$set.variantStatus) {
            update.$set.variantStatus = "inactive";
          }
        } catch (error) {
          console.error(
            "Lỗi khi kiểm tra SKU trùng lặp khi khôi phục variant:",
            error
          );
        }
      }
    }
    next();
  });
};

module.exports = { applyMiddlewares };
