const mongoose = require("mongoose");
const ReviewSchema = require("./schema");
const { applyMiddlewares } = require("./middlewares");
const softDeletePlugin = require("@plugins/softDelete");

// Áp dụng plugin xóa mềm
ReviewSchema.plugin(softDeletePlugin);

// Áp dụng middlewares
applyMiddlewares(ReviewSchema);

// Tạo model
const Review = mongoose.model("Review", ReviewSchema);

module.exports = Review;
