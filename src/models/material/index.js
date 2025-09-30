const mongoose = require("mongoose");
const MaterialSchema = require("./schema");
const { applyMiddlewares } = require("./middlewares");
const softDeletePlugin = require("@plugins/softDelete");

// Áp dụng plugin xóa mềm
MaterialSchema.plugin(softDeletePlugin);

// Áp dụng middlewares
applyMiddlewares(MaterialSchema);

// Tạo model
const Material = mongoose.model("Material", MaterialSchema);

module.exports = Material;
