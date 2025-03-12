const mongoose = require("mongoose");
// const BaseSchema = require("./base.model");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: false,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    dateOfBirth: {
      type: Date,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    image: {
      type: String,
      default: "",
    },
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    coupons: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Coupon",
      },
    ],
    addresses: [
      {
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        province: { type: String, required: true },
        district: { type: String, required: true },
        ward: { type: String, required: true },
        addressDetail: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    blockReason: {
      type: String,
    },
    blockedAt: {
      type: Date,
    },
    otp: {
      code: { type: String },
      expiredAt: { type: Date },
    },
    passwordResetToken: {
      type: String,
    },
    passwordResetExpires: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Tự động hash mật khẩu trước khi lưu
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Phương thức kiểm tra mật khẩu
UserSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Đặt địa chỉ mặc định
UserSchema.methods.setDefaultAddress = async function (addressId) {
  this.addresses.forEach((address) => {
    address.isDefault = address._id.toString() === addressId.toString();
  });
  await this.save();
};

// Thêm middleware để ngăn người dùng bị khóa đăng nhập
UserSchema.pre("findOne", function (next) {
  // Không áp dụng cho các truy vấn admin
  if (this._skipBlockCheck) {
    return next();
  }

  // Thêm điều kiện isActive = true vào truy vấn
  this.where({ isActive: true });
  next();
});

// Phương thức để admin có thể tìm người dùng bị khóa
UserSchema.statics.findEvenBlocked = function (conditions) {
  return this.findOne(conditions)._skipBlockCheck(true);
};

// Phương thức mở rộng cho truy vấn
mongoose.Query.prototype._skipBlockCheck = function (skip) {
  this._skipBlockCheck = skip;
  return this;
};

const User = mongoose.model("User", UserSchema);

module.exports = User;
