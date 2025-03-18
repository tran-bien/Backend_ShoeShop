const mongoose = require("mongoose");
const VariantSchema = require("./schema");
const { applyMiddlewares } = require("./middlewares");

// Áp dụng middlewares
applyMiddlewares(VariantSchema);

const Variant = mongoose.model("Variant", VariantSchema);

module.exports = Variant;
