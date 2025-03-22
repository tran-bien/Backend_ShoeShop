const mongoose = require("mongoose");
const OrderSchema = require("./schema");
const { applyMiddlewares } = require("./middlewares");
const softDeletePlugin = require("@plugins/softDelete");

// Áp dụng plugin xóa mềm
OrderSchema.plugin(softDeletePlugin);

// Áp dụng middlewares
applyMiddlewares(OrderSchema);

// Tạo model
const Order = mongoose.model("Order", OrderSchema);

module.exports = Order;
