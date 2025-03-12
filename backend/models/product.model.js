const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2"); // Import plugin phân trang cho mongoose

const ProductImageSchema = new mongoose.Schema({
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
});

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
    price: {
      type: Number,
      required: [true, "Giá sản phẩm là bắt buộc"],
      min: [0, "Giá sản phẩm không được âm"],
    },
    costPrice: {
      type: Number,
      required: [true, "Giá gốc sản phẩm là bắt buộc"],
      min: [0, "Giá gốc sản phẩm không được âm"],
    },
    profit: {
      type: Number,
      default: 0,
    },
    profitPercentage: {
      type: Number,
      default: 0,
    },
    totalSoldproduct: {
      type: Number,
      default: 0, //Tổng số lượng đã bán mặc định là 0
      min: [0, "Tổng số lượng đã bán không được âm"],
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

// Middleware trước khi lưu sản phẩm
ProductSchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  // Tính lợi nhuận
  if (this.price && this.costPrice) {
    this.profit = this.price - this.costPrice;
    // Tính tỷ lệ lợi nhuận
    this.profitPercentage =
      this.costPrice > 0
        ? parseFloat(((this.profit / this.costPrice) * 100).toFixed(2))
        : 0;
  }

  // Kiểm tra nếu sản phẩm bị đánh dấu là đã xóa thì chuyển trạng thái hoạt động thành false
  if (this.isDeleted === true) {
    this.isActive = false;
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

  // Tính lại lợi nhuận nếu cập nhật giá hoặc giá gốc
  if (update.price || update.costPrice) {
    this.findOne({}, (err, product) => {
      if (err || !product) return next(err);

      const newPrice = update.price || product.price;
      const newCostPrice = update.costPrice || product.costPrice;

      update.profit = newPrice - newCostPrice;
      update.profitPercentage =
        newCostPrice > 0
          ? parseFloat(((update.profit / newCostPrice) * 100).toFixed(2))
          : 0;

      next();
    });
  } else {
    next();
  }
});

// Phương thức định dạng giá theo VNĐ
ProductSchema.methods.formatPrice = function () {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(this.price);
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
