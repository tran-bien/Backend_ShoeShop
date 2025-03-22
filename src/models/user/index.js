const mongoose = require("mongoose");
const UserSchema = require("./schema");
const { applyMiddlewares } = require("./middlewares");
const softDeletePlugin = require("@plugins/softDelete");

// Áp dụng plugin xóa mềm
UserSchema.plugin(softDeletePlugin);

// Áp dụng middlewares
applyMiddlewares(UserSchema);

// Tạo model
const User = mongoose.model("User", UserSchema);

module.exports = User;
