const mongoose = require("mongoose");
const ProductSchema = require("./schema");
const { applyMiddlewares } = require("./middlewares");

// Áp dụng các middlewares
applyMiddlewares(ProductSchema);

// Tạo model
const Product = mongoose.model("Product", ProductSchema);

module.exports = Product;
