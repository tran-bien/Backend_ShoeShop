const mongoose = require("mongoose");
const BannerSchema = require("./schema");
const { applyMiddlewares } = require("./middlewares");
const softDeletePlugin = require("@plugins/softDelete");

// Áp dụng plugin xóa mềm
BannerSchema.plugin(softDeletePlugin);

// Áp dụng middlewares
applyMiddlewares(BannerSchema);

// Tạo model
const Banner = mongoose.model("Banner", BannerSchema);

module.exports = Banner;
