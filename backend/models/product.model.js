const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2"); // Import plugin phân trang cho mongoose
const slugify = require("slugify");

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
      type: Number,
      default: function () {
        return this.percentDiscount > 0
          ? this.price - (this.price * this.percentDiscount) / 100
          : this.price;
      },
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
    profit: {
      type: Number,
      default: function () {
        return this.price - this.costPrice; // Tính lợi nhuận tự động từ giá bán và giá gốc
      },
    },
    profitPercentage: {
      type: Number,
      default: function () {
        return this.costPrice > 0
          ? parseFloat(((this.profit / this.costPrice) * 100).toFixed(2)) // Làm tròn đến 2 chữ số thập phân
          : 0;
      },
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
        isSizeAvailable: {
          type: Boolean,
          default: function () {
            return this.quantity > 0; // Tự động xác định size có sẵn dựa trên số lượng
          },
        },
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
    toJSON: { virtuals: true }, // Đảm bảo trường ảo được bao gồm khi chuyển đổi thành JSON
    toObject: { virtuals: true }, // Đảm bảo trường ảo được bao gồm khi chuyển đổi thành object
  }
);

// Tạo chỉ mục cho các trường tìm kiếm
ProductSchema.index({ name: "text", description: "text" }); // Thêm text index cho tìm kiếm
ProductSchema.index({ isActive: 1, isDeleted: 1 }); // Index cho trạng thái sản phẩm
ProductSchema.index({ category: 1 });
ProductSchema.index({ brand: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ rating: -1 });
ProductSchema.index({ slug: 1 }); // Index cho tìm kiếm bằng slug
ProductSchema.index({ "variants.sku": 1 }); // Index cho tìm kiếm bằng SKU của biến thể

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

// Hàm tính toán giá cuối cùng
function calculateFinalPrice(price, percentDiscount) {
  return percentDiscount > 0 ? price - (price * percentDiscount) / 100 : price;
}

// Hàm cập nhật trạng thái biến thể
function updateVariantStatus(variant) {
  const variantTotalQuantity = variant.sizes.reduce((total, size) => {
    return total + (size.isSizeAvailable ? size.quantity : 0);
  }, 0);

  if (variantTotalQuantity === 0) {
    variant.status = "discontinued";
  } else if (variant.status === "discontinued") {
    variant.status = "active";
  }
}

// Hàm tạo slug cải tiến với xử lý đặc biệt
function createUniqueSlug(name, suffix = "") {
  const baseSlug = slugify(name, {
    lower: true, // Chuyển thành chữ thường
    strict: true, // Loại bỏ các ký tự đặc biệt
    remove: /[*+~.()'"!:@]/g, // Quy tắc xóa ký tự đặc biệt
  });

  return suffix ? `${baseSlug}-${suffix}` : baseSlug;
}

// Middleware trước khi lưu sản phẩm - cải tiến với async/await
ProductSchema.pre("save", async function (next) {
  try {
    // Xử lý tạo slug cải tiến với kiểm tra trùng lặp
    if (this.isModified("name") || !this.slug) {
      const baseSlug = createUniqueSlug(this.name);

      // Nếu là sản phẩm mới hoặc slug bị thay đổi
      if (this.isNew || this.isModified("slug")) {
        // Kiểm tra trùng lặp slug trong database
        let newSlug = baseSlug;
        let count = 1;

        // Kiểm tra trùng lặp trong vòng lặp
        let slugExists = await mongoose
          .model("Product")
          .findOne({ slug: newSlug, _id: { $ne: this._id } });
        while (slugExists) {
          newSlug = `${baseSlug}-${count}`;
          count++;
          slugExists = await mongoose
            .model("Product")
            .findOne({ slug: newSlug, _id: { $ne: this._id } });
        }

        this.slug = newSlug;
      }
    }

    // Xử lý SKU biến thể cải tiến
    if (this.variants && this.variants.length > 0) {
      for (const [index, variant] of this.variants.entries()) {
        if (!variant.sku) {
          try {
            // Tìm nạp dữ liệu liên quan nếu cần
            const productId = this._id.toString().substring(0, 5);

            // Kiểm tra nếu brand và color là ObjectId hoặc đã là đối tượng
            let brandName = "";
            if (typeof this.brand === "object" && this.brand.name) {
              brandName = this.brand.name;
            } else {
              const brand = await mongoose.model("Brand").findById(this.brand);
              if (brand) brandName = brand.name;
            }

            let colorName = "";
            if (typeof variant.color === "object" && variant.color.name) {
              colorName = variant.color.name;
            } else {
              const colorDoc = await mongoose
                .model("Color")
                .findById(variant.color);
              if (colorDoc) colorName = colorDoc.name;
            }

            // Tạo SKU với cấu trúc rõ ràng hơn
            const brandCode = brandName
              ? brandName.substring(0, 3).toUpperCase()
              : "BRD";
            const colorCode = colorName
              ? colorName.substring(0, 3).toUpperCase()
              : "CLR";
            const uniqueCode = Date.now().toString().substring(8) + index;

            const newSKU = `${brandCode}-${productId}-${colorCode}-${uniqueCode}`;

            // Kiểm tra trùng lặp SKU
            const existingSKU = await mongoose.model("Product").findOne({
              "variants.sku": newSKU,
              _id: { $ne: this._id },
            });

            if (existingSKU) {
              variant.sku = `${newSKU}-${Math.floor(
                1000 + Math.random() * 9000
              )}`;
            } else {
              variant.sku = newSKU;
            }
          } catch (error) {
            // Cơ chế dự phòng nếu không thể lấy dữ liệu liên quan
            const timestamp = Date.now() + index;
            variant.sku = `PROD-${this._id
              .toString()
              .substring(0, 5)}-${timestamp}`;
          }
        }

        // Tự động tính giá cuối cùng và lợi nhuận cho biến thể
        variant.priceFinal = calculateFinalPrice(
          variant.price,
          variant.percentDiscount
        );
        variant.profit = variant.price - variant.costPrice;
        variant.profitPercentage =
          variant.costPrice > 0
            ? parseFloat(
                ((variant.profit / variant.costPrice) * 100).toFixed(2)
              )
            : 0;

        // Cập nhật trạng thái variant
        updateVariantStatus(variant);
      }
    }

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
      for (const variant of this.variants) {
        // Tính tổng số lượng sẵn có của biến thể
        let variantTotalQuantity = 0;

        // Cập nhật isSizeAvailable dựa trên quantity
        for (const size of variant.sizes) {
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
        }
      }
    }

    // Tính tổng số lượng sản phẩm và cập nhật trạng thái kho
    const totalQuantity = totalMaleQuantity + totalFemaleQuantity;

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
  } catch (error) {
    next(error);
  }
});

// Middleware để tự động cập nhật slug khi cập nhật tên
ProductSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate();

    // Tạo slug mới nếu tên sản phẩm được cập nhật
    if (update.name) {
      const baseSlug = createUniqueSlug(update.name);
      let newSlug = baseSlug;
      let count = 1;

      // Lấy ID sản phẩm đang được cập nhật
      const doc = await this.model.findOne(this.getQuery());
      if (!doc) return next();

      // Kiểm tra trùng lặp
      let slugExists = await mongoose.model("Product").findOne({
        slug: newSlug,
        _id: { $ne: doc._id },
      });

      while (slugExists) {
        newSlug = `${baseSlug}-${count}`;
        count++;
        slugExists = await mongoose.model("Product").findOne({
          slug: newSlug,
          _id: { $ne: doc._id },
        });
      }

      update.slug = newSlug;
    }

    // Kiểm tra giá và giá gốc
    if (update.price && update.costPrice && update.price < update.costPrice) {
      const error = new Error("Giá bán phải lớn hơn hoặc bằng giá gốc");
      return next(error);
    }

    // Tính lại giá bán cuối cùng và lợi nhuận nếu cập nhật giá hoặc phần trăm giảm giá
    if (update.price || update.percentDiscount || update.costPrice) {
      const doc = await this.model.findOne(this.getQuery());
      if (!doc) return next();

      // Nếu đang cập nhật biến thể
      if (update["variants.$"]) {
        const variant = update["variants.$"];

        // Tính giá bán cuối cùng nếu có thông tin giá và phần trăm giảm giá
        if (variant.price || variant.percentDiscount) {
          const price = variant.price || doc.variants[0].price;
          const percentDiscount =
            variant.percentDiscount || doc.variants[0].percentDiscount;

          if (percentDiscount > 0) {
            variant.priceFinal = price - (price * percentDiscount) / 100;
          } else {
            variant.priceFinal = price;
          }

          // Cập nhật lợi nhuận nếu có costPrice
          if (variant.costPrice || variant.price) {
            const costPrice = variant.costPrice || doc.variants[0].costPrice;
            variant.profit = price - costPrice;
            variant.profitPercentage =
              costPrice > 0
                ? parseFloat(((variant.profit / costPrice) * 100).toFixed(2))
                : 0;
          }
        }
      }
      // Cập nhật sản phẩm
      else if (update.price || update.costPrice) {
        const newPrice = update.price || doc.price;
        const newCostPrice = update.costPrice || doc.costPrice;

        update.profit = newPrice - newCostPrice;
        update.profitPercentage =
          newCostPrice > 0
            ? parseFloat(((update.profit / newCostPrice) * 100).toFixed(2))
            : 0;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Thêm phương thức tạo SKU chuyên nghiệp
ProductSchema.methods.generateSKU = async function (variant, size) {
  try {
    const brand = await mongoose.model("Brand").findById(this.brand);
    const color = await mongoose.model("Color").findById(variant.color);

    const brandCode = brand.name.substring(0, 3).toUpperCase();
    const productCode = this._id.toString().substring(0, 5);
    const colorCode = color.name.substring(0, 3).toUpperCase();
    const sizeValue = size.value;

    return `${brandCode}-${productCode}-${colorCode}-${sizeValue}`;
  } catch (error) {
    // Cơ chế dự phòng nếu có lỗi
    return `PROD-${this._id.toString().substring(0, 8)}-${Date.now()
      .toString()
      .substring(8)}`;
  }
};

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

// Kích hoạt plugin phân trang
ProductSchema.plugin(mongoosePaginate);

const Product = mongoose.model("Product", ProductSchema);

module.exports = Product;
