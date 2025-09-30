const mongoose = require("mongoose");
const UseCaseSchema = require("./schema");
const { applyMiddlewares } = require("./middlewares");
const softDeletePlugin = require("@plugins/softDelete");

// Áp dụng plugin xóa mềm
UseCaseSchema.plugin(softDeletePlugin);

// Áp dụng middlewares
applyMiddlewares(UseCaseSchema);

// Tạo model
const UseCase = mongoose.model("UseCase", UseCaseSchema);

module.exports = UseCase;
