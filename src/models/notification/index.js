const mongoose = require("mongoose");
const NotificationSchema = require("./schema");

// Tạo model
const Notification = mongoose.model("Notification", NotificationSchema);

module.exports = Notification;
