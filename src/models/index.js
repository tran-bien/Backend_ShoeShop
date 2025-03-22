// Import tất cả các model từ các thư mục con
const Product = require("./product");
const Category = require("./category");
const Brand = require("./brand");
const User = require("./user");
const Review = require("./review");
const Order = require("./order");
const Cart = require("./cart");
const Color = require("./color");
const Size = require("./size");
const Coupon = require("./coupon");
const CancelRequest = require("./cancelRequest");
const Session = require("./session");
const Notification = require("./notification");
const Variant = require("./variant");

module.exports = {
  Product,
  Category,
  Brand,
  User,
  Review,
  Order,
  Cart,
  Color,
  Size,
  Coupon,
  CancelRequest,
  Session,
  Notification,
  Variant,
};
