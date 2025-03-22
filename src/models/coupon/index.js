const mongoose = require("mongoose");
const CouponSchema = require("./schema");
const { applyMiddlewares } = require("./middlewares");
const softDeletePlugin = require("@plugins/softDelete");

// Áp dụng plugin xóa mềm
CouponSchema.plugin(softDeletePlugin);

// Áp dụng middlewares
applyMiddlewares(CouponSchema);

// Tạo model
const Coupon = mongoose.model("Coupon", CouponSchema);

module.exports = Coupon;
