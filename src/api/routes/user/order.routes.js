const express = require("express");
const router = express.Router();
const orderController = require("@controllers/user/order.controller");
const { protect } = require("@middlewares/auth.middleware");
const validate = require("@utils/validatehelper");
const orderValidator = require("@validators/order.validator");
const auth = require("@middlewares/auth.middleware");

/**
 * @description Áp dụng middleware xác thực cho tất cả các routes
 * @access      Người dùng đã đăng nhập
 */
router.use(protect);

/**
 * @description Routes cho đơn hàng
 * @access      Người dùng đã đăng nhập
 */
router
  .route("/")
  .get(validate(orderValidator.validateGetOrders), orderController.getOrders)
  .post(
    validate(orderValidator.validateCreateOrder),
    orderController.createOrder
  );

/**
 * @description Lấy chi tiết đơn hàng
 * @access      Người dùng đã đăng nhập
 */
router
  .route("/:id")
  .get(validate(orderValidator.validateGetOrder), orderController.getOrderById);

/**
 * @description Hủy đơn hàng
 * @access      Người dùng đã đăng nhập
 */
router
  .route("/:id/cancel")
  .patch(
    validate(orderValidator.validateCancelOrder),
    orderController.cancelOrder
  );

/**
 * @description Lấy thông tin vận chuyển của đơn hàng
 * @access      Người dùng đã đăng nhập
 */
router
  .route("/:id/tracking")
  .get(
    validate(orderValidator.validateOrderTracking),
    orderController.getOrderTracking
  );

/**
 * @description Thanh toán lại đơn hàng
 * @access      Người dùng đã đăng nhập
 */
router.post("/:id/repay", auth.protect, orderController.repayOrder);

/**
 * @description Xử lý callback từ VNPAY
 * @access      Public
 */
router.get("/vnpay/callback", orderController.vnpayCallback);

/**
 * @description Xử lý IPN từ VNPAY
 * @access      Public
 */
router.post("/vnpay/ipn", orderController.vnpayIpn);

module.exports = router;
