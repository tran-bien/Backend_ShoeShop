const mongoose = require("mongoose");
const SessionSchema = require("./schema");
const softDeletePlugin = require("@plugins/softDelete");

// Áp dụng plugin xóa mềm
SessionSchema.plugin(softDeletePlugin);

// Tạo model
const Session = mongoose.model("Session", SessionSchema);

module.exports = Session;
