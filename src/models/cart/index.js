const mongoose = require("mongoose");
const CartSchema = require("./schema");
const { applyMiddlewares } = require("./middlewares");

// Áp dụng middlewares
applyMiddlewares(CartSchema);

// Tạo model
const Cart = mongoose.model("Cart", CartSchema);

module.exports = Cart;
