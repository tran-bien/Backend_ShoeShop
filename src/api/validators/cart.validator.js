const { body, param } = require("express-validator");
const mongoose = require("mongoose");
const ApiError = require("@utils/ApiError");

/**
 * Kiểm tra ID có phải là MongoDB ObjectId hợp lệ không
 */
const isValidObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, "ID không hợp lệ");
  }
  return true;
};

/**
 * Validator cho thêm sản phẩm vào giỏ hàng
 */
const validateAddToCart = [
  body("productId")
    .notEmpty()
    .withMessage("Vui lòng cung cấp ID sản phẩm")
    .custom(isValidObjectId)
    .withMessage("ID sản phẩm không hợp lệ"),

  body("variantId")
    .notEmpty()
    .withMessage("Vui lòng cung cấp ID biến thể")
    .custom(isValidObjectId)
    .withMessage("ID biến thể không hợp lệ"),

  body("sizeId")
    .notEmpty()
    .withMessage("Vui lòng cung cấp ID kích thước")
    .custom(isValidObjectId)
    .withMessage("ID kích thước không hợp lệ"),

  body("quantity")
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage("Số lượng phải là số nguyên từ 1-10"),
];

/**
 * Validator cho cập nhật số lượng sản phẩm trong giỏ hàng
 */
const validateUpdateCartItem = [
  param("itemId")
    .notEmpty()
    .withMessage("Vui lòng cung cấp ID sản phẩm trong giỏ hàng")
    .custom(isValidObjectId)
    .withMessage("ID sản phẩm không hợp lệ"),

  body("quantity")
    .notEmpty()
    .withMessage("Vui lòng cung cấp số lượng")
    .isInt({ min: 1, max: 10 })
    .withMessage("Số lượng phải là số nguyên từ 1-10"),
];

/**
 * Validator cho xóa sản phẩm khỏi giỏ hàng
 */
const validateRemoveFromCart = [
  param("itemId")
    .notEmpty()
    .withMessage("Vui lòng cung cấp ID sản phẩm trong giỏ hàng")
    .custom(isValidObjectId)
    .withMessage("ID sản phẩm không hợp lệ"),
];

/**
 * Validator cho áp dụng mã giảm giá
 */
const validateApplyCoupon = [
  body("couponCode")
    .notEmpty()
    .withMessage("Vui lòng cung cấp mã giảm giá")
    .isString()
    .withMessage("Mã giảm giá phải là chuỗi")
    .isLength({ min: 3, max: 20 })
    .withMessage("Mã giảm giá phải có độ dài từ 3-20 ký tự"),
];

/**
 * Validator cho checkout
 */
const validateCheckout = [
  body("shippingAddress")
    .optional()
    .isObject()
    .withMessage("Địa chỉ giao hàng phải là đối tượng"),

  body("shippingAddress.name")
    .optional()
    .isString()
    .withMessage("Tên người nhận phải là chuỗi")
    .isLength({ min: 2, max: 100 })
    .withMessage("Tên người nhận phải có độ dài từ 2-100 ký tự"),

  body("shippingAddress.phone")
    .optional()
    .isString()
    .withMessage("Số điện thoại phải là chuỗi")
    .matches(/^(0[2-9]|84[2-9])[0-9]{8}$/)
    .withMessage("Số điện thoại không hợp lệ"),

  body("paymentMethod")
    .optional()
    .isIn(["COD", "VNPAY"])
    .withMessage("Phương thức thanh toán không hợp lệ"),
];

module.exports = {
  validateAddToCart,
  validateUpdateCartItem,
  validateRemoveFromCart,
  validateApplyCoupon,
  validateCheckout,
};
