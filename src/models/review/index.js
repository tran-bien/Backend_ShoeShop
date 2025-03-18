const mongoose = require("mongoose");
const ReviewSchema = require("./schema");
const { applyMiddlewares } = require("./middlewares");

// Áp dụng middlewares
applyMiddlewares(ReviewSchema);

// Tạo model
const Review = mongoose.model("Review", ReviewSchema);

module.exports = Review;
