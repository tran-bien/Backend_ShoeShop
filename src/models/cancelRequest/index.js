const mongoose = require("mongoose");
const CancelRequestSchema = require("./schema");
const { applyMiddlewares } = require("./middlewares");
const softDeletePlugin = require("@plugins/softDelete");

// Áp dụng plugin xóa mềm
CancelRequestSchema.plugin(softDeletePlugin);

// Áp dụng middlewares
applyMiddlewares(CancelRequestSchema);

// Tạo model
const CancelRequest = mongoose.model("CancelRequest", CancelRequestSchema);

module.exports = CancelRequest;
