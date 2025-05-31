const express = require("express");
const router = express.Router();
const orderController = require("@controllers/user/order.controller");
const validate = require("@utils/validatehelper");
const orderValidator = require("@validators/order.validator");
const { protect } = require("@middlewares/auth.middleware");

// Routes không cần xác thực
/** 
 * @route   GET /api/v1/orders/vnpay/test-callback
 * @desc    Test callback từ VNPAY
 * @access  Public
 */
router.get("/vnpay/test-callback", orderController.testVnpayCallback);
router.get("/vnpay/callback", orderController.vnpayCallback);
router.post("/vnpay/ipn", orderController.vnpayIpn);
router.get("/vnpay/ipn", orderController.vnpayIpn);

// Áp dụng middleware xác thực cho các routes còn lại
router.use(protect);

/**
 * @route   GET /api/v1/orders
 * @desc    Lấy danh sách đơn hàng của người dùng và thống kê theo trạng thái
 * @access  Private
 */
router.get("/", validate(orderValidator.validateGetOrders), orderController.getOrders);

/**
 * @route   POST /api/v1/orders
 * @desc    Tạo đơn hàng mới
 * @access  Private
 */
router.post("/", validate(orderValidator.validateCreateOrder), orderController.createOrder);

/**
 * @route   GET /api/v1/orders/user-cancel-requests
 * @desc    Lấy danh sách yêu cầu hủy đơn hàng của người dùng
 * @access  Private
 */
router.get("/user-cancel-requests", validate(orderValidator.validateGetUserCancelRequests), orderController.getUserCancelRequests);

/**
 * @route   GET /api/v1/orders/:id
 * @desc    Lấy chi tiết đơn hàng
 * @access  Private
 */
router.get("/:id", validate(orderValidator.validateGetOrder), orderController.getOrderById);

/**
 * @route   POST /api/v1/orders/:id/cancel
 * @desc    Gửi yêu cầu hủy đơn hàng
 * @access  Private
 */
router.post(
  "/:id/cancel",
  validate(orderValidator.validateCancelOrder),
  orderController.cancelOrder
);

/**
 * @route   POST /api/v1/orders/:id/repay
 * @desc    Thanh toán lại đơn hàng
 * @access  Private
 */
router.post("/:id/repay", orderController.repayOrder);

module.exports = router;