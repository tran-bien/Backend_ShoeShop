const mongoose = require("mongoose");
const NotificationSchema = require("./schema");
const { applyMiddlewares } = require("./middlewares");

// Áp dụng middlewares
applyMiddlewares(NotificationSchema);

const Notification = mongoose.model("Notification", NotificationSchema);

module.exports = Notification;
