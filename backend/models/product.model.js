const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2"); // Import plugin phân trang cho mongoose

const ProductImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    public_id: {
      type: String,
      required: true,
    },
    isMain: {
      type: Boolean,
      default: false,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const VariantSchema = new mongoose.Schema(
  {
    imagesvariant: [ProductImageSchema],
    priceFinal: {
      // giá bán hàng chính thức cuối cùng khi add phần trăm giảm giá
      // ví dụ: giá gốc 100k, phần trăm giảm giá 10%, giá bán hàng chính thức cuối cùng là 90k
      type: Number,
      default: 0,
      min: 0,
    },
    price: {
      type: Number,
      required: [true, "Giá bán sản phẩm là bắt buộc"],
      min: [0, "Giá bán sản phẩm không được âm"],
    },
    costPrice: {
      type: Number,
      required: [true, "Vui lòng nhập giá gốc sản phẩm"],
      min: [0, "Giá gốc sản phẩm không được âm"],
      validate: {
        validator: function (value) {
          return value >= 0 && Number.isFinite(value);
        },
        message: "Giá gốc sản phẩm phải là số hợp lệ và không âm",
      },
    },
    percentDiscount: {
      type: Number,
      default: 0,
      required: [true, "Vui lòng nhập phần trăm giảm giá"],
      min: [0, "Phần trăm giảm giá không được âm"],
      max: [100, "Phần trăm giảm giá không được vượt quá 100%"],
    },
    gender: {
      type: String,
      enum: ["male", "female"],
      default: "male",
      required: true,
    },
    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Color",
      required: true,
    },
    sizes: [
      {
        size: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Size",
          required: true,
        },
        quantity: {
          type: Number,
          default: 0,
          min: [0, "Số lượng sản phẩm theo size không được âm"],
        },
        isSizeAvailable: { type: Boolean, default: true },
        totalSoldSize: { type: Number, default: 0 },
      },
    ],
    status: {
      type: String,
      enum: ["active", "inactive", "discontinued"],
      default: "active",
    },
    lastRestocked: {
      type: Date,
      default: Date.now,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

// Định nghĩa schema cho sản phẩm
const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên sản phẩm là bắt buộc"],
      trim: true,
      maxlength: [1000, "Tên sản phẩm không được vượt quá 1000 ký tự"],
    },
    slug: {
      type: String,
      unique: true, // Đảm bảo slug là duy nhất
    },
    description: {
      type: String,
      required: [true, "Mô tả sản phẩm là bắt buộc"],
      maxlength: [1000, "Mô tả sản phẩm không được vượt quá 1000 ký tự"],
    },
    images: [ProductImageSchema], // Sử dụng schema của Image
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category", // Tham chiếu đến mô hình Category
      required: [true, "Vui lòng chọn danh mục sản phẩm"], // Danh mục là bắt buộc
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand", // Tham chiếu đến mô hình Brand
      required: [true, "Vui lòng chọn thương hiệu"], // Thương hiệu là bắt buộc
    },
    variants: [VariantSchema], // Khôi phục lại cấu trúc variants
    profit: {
      type: Number,
      default: 0,
    },
    profitPercentage: {
      type: Number,
      default: 0,
    },
    totalQuantity: {
      type: Number,
      default: 0, // Tổng số lượng mặc định là 0
      min: [0, "Tổng số lượng không được âm"],
    },
    stockStatus: {
      type: String,
      enum: ["inStock", "lowStock", "outOfStock", "discontinued"], // Trạng thái kho hàng
      default: "outOfStock", // Trạng thái mặc định là outOfStock
    },
    rating: {
      type: Number,
      default: 0, // Điểm đánh giá mặc định là 0
      min: [0, "Điểm đánh giá không được âm"],
      max: [5, "Điểm đánh giá không được vượt quá 5"],
    },
    numReviews: {
      type: Number,
      default: 0, // Số lượng đánh giá mặc định là 0
      min: [0, "Số lượng đánh giá không được âm"],
    },
    isActive: {
      type: Boolean,
      default: true, // Mặc định là true, sản phẩm sẽ hoạt động khi được tạo
    },
    isDeleted: {
      type: Boolean,
      default: false, // Mặc định là false, sản phẩm chưa bị xóa
    },
  },
  {
    timestamps: true, // Tự động thêm trường createdAt và updatedAt
  }
);

// Tạo chỉ mục cho các trường tìm kiếm
ProductSchema.index({ name: "text", description: "text" }); // Thêm text index cho tìm kiếm
ProductSchema.index({ isActive: 1, isDeleted: 1 }); // Index cho trạng thái sản phẩm
ProductSchema.index({ category: 1 });
ProductSchema.index({ brand: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ rating: -1 });

// Virtual field để tính toán tổng số lượng và trạng thái kho hàng
ProductSchema.virtual("calculatedTotalQuantity").get(function () {
  let total = 0;
  if (this.variants && this.variants.length > 0) {
    this.variants.forEach((variant) => {
      if (variant.status === "active") {
        variant.sizes.forEach((sizeItem) => {
          if (sizeItem.isSizeAvailable) {
            total += sizeItem.quantity;
          }
        });
      }
    });
  }
  return total;
});

ProductSchema.virtual("calculatedStockStatus").get(function () {
  const total = this.calculatedTotalQuantity;
  if (total === 0) return "outOfStock";
  if (total < 10) return "lowStock";
  return "inStock";
});

// Middleware trước khi lưu sản phẩm
ProductSchema.pre("save", function (next) {
  // Cập nhật thời gian thay đổi
  this.updatedAt = Date.now();

  // Kiểm tra nếu sản phẩm bị đánh dấu là đã xóa thì chuyển trạng thái hoạt động thành false
  if (this.isDeleted === true) {
    this.isActive = false;
  }

  // Tính tổng số lượng sản phẩm nam và nữ
  let totalMaleQuantity = 0;
  let totalFemaleQuantity = 0;

  // Cập nhật trạng thái isSizeAvailable cho tất cả các size
  if (this.variants && this.variants.length > 0) {
    this.variants.forEach((variant) => {
      // Cập nhật giá cuối cùng (priceFinal) dựa trên phần trăm giảm giá
      variant.priceFinal =
        variant.percentDiscount > 0
          ? variant.price - (variant.price * variant.percentDiscount) / 100
          : variant.price;

      // Tính tổng số lượng sẵn có của biến thể
      let variantTotalQuantity = 0;

      // Cập nhật isSizeAvailable dựa trên quantity
      variant.sizes.forEach((size) => {
        // Size có khả dụng nếu số lượng > 0
        size.isSizeAvailable = size.quantity > 0;
        if (size.isSizeAvailable) {
          variantTotalQuantity += size.quantity;

          // Cộng vào tổng số lượng theo giới tính
          if (variant.gender === "male") {
            totalMaleQuantity += size.quantity;
          } else if (variant.gender === "female") {
            totalFemaleQuantity += size.quantity;
          }
        }
      });

      // Cập nhật trạng thái của biến thể dựa trên tổng số lượng của các size
      if (variantTotalQuantity === 0) {
        variant.status = "discontinued"; // Đổi thành discontinued nếu hết hàng
      } else if (variant.status === "discontinued") {
        // Nếu đã là discontinued nhưng có hàng trở lại, đổi thành active
        variant.status = "active";
      }
      // Giữ nguyên trạng thái "inactive" nếu đã được thiết lập thủ công
    });
  }

  // Tính tổng số lượng sản phẩm và cập nhật trạng thái kho
  let totalQuantity = totalMaleQuantity + totalFemaleQuantity;

  // Cập nhật tổng số lượng
  this.totalQuantity = totalQuantity;

  // Cập nhật trạng thái kho hàng dựa trên tổng số lượng
  if (totalQuantity === 0) {
    const allDiscontinued =
      this.variants.length > 0 &&
      this.variants.every((v) => v.status === "discontinued");
    this.stockStatus = allDiscontinued ? "discontinued" : "outOfStock";
  } else if (totalQuantity < 10) {
    this.stockStatus = "lowStock";
  } else {
    this.stockStatus = "inStock";
  }

  next();
});

// Middleware trước khi cập nhật sản phẩm
ProductSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();

  // Kiểm tra giá và giá gốc
  if (update.price && update.costPrice && update.price < update.costPrice) {
    const error = new Error("Giá bán phải lớn hơn hoặc bằng giá gốc");
    return next(error);
  }

  // Tính lại giá bán cuối cùng và lợi nhuận nếu cập nhật giá hoặc phần trăm giảm giá
  if (update.price || update.percentDiscount || update.costPrice) {
    this.findOne({}, (err, product) => {
      if (err || !product) return next(err);

      // Nếu đang cập nhật biến thể
      if (update["variants.$"]) {
        const variant = update["variants.$"];

        // Tính giá bán cuối cùng nếu có thông tin giá và phần trăm giảm giá
        if (variant.price || variant.percentDiscount) {
          const price = variant.price || product.variants[0].price;
          const percentDiscount =
            variant.percentDiscount || product.variants[0].percentDiscount;

          if (percentDiscount > 0) {
            variant.priceFinal = price - (price * percentDiscount) / 100;
          } else {
            variant.priceFinal = price;
          }
        }
      }
      // Cập nhật sản phẩm
      else if (update.price || update.costPrice) {
        const newPrice = update.price || product.price;
        const newCostPrice = update.costPrice || product.costPrice;

        update.profit = newPrice - newCostPrice;
        update.profitPercentage =
          newCostPrice > 0
            ? parseFloat(((update.profit / newCostPrice) * 100).toFixed(2))
            : 0;
      }

      next();
    });
  } else {
    next();
  }
});

// Tìm variant theo color và size
ProductSchema.methods.findVariant = function (colorId, sizeId) {
  // Tìm variant có màu sắc phù hợp
  const variant = this.variants.find(
    (v) => v.color.toString() === colorId.toString()
  );

  if (!variant) return null;

  // Tìm size phù hợp trong variant
  const sizeItem = variant.sizes.find(
    (s) => s.size.toString() === sizeId.toString()
  );

  if (!sizeItem) return null;

  // Tạo đối tượng kết quả với đầy đủ thông tin
  return {
    _id: variant._id,
    color: variant.color,
    size: sizeItem.size,
    quantity: sizeItem.quantity,
    product: this._id,
    gender: variant.gender,
    price: variant.price,
    priceFinal: variant.priceFinal,
    costPrice: variant.costPrice,
    percentDiscount: variant.percentDiscount,
    status: variant.status,
    sku: variant.sku,
    imagesvariant: variant.imagesvariant,
    isSizeAvailable: sizeItem.isSizeAvailable,
    isAvailable:
      variant.status === "active" &&
      sizeItem.isSizeAvailable &&
      sizeItem.quantity > 0,
    totalSoldSize: sizeItem.totalSoldSize || 0,
  };
};

// Phương thức định dạng giá theo VNĐ
ProductSchema.methods.formatPrice = function (price) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price || this.price);
};

// Phương thức định dạng giá gốc theo VNĐ
ProductSchema.methods.formatCostPrice = function () {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(this.costPrice);
};

// Kích hoạt plugin phân trang
ProductSchema.plugin(mongoosePaginate);

const Product = mongoose.model("Product", ProductSchema);

module.exports = Product;
