const express = require("express");
const router = express.Router();

const orderController = require("@controllers/admin/order.controller");
const orderValidator = require("@validators/order.validator");
const validate = require("@utils/validatehelper");
const { protect, admin } = require("@middlewares/auth.middleware");

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);
router.use(admin);

/**
 * @route   GET /api/v1/admin/orders
 * @desc    Lấy danh sách tất cả đơn hàng
 * @access  Admin
 */
router.get("/", validate(orderValidator.validateGetOrders), orderController.getOrders);

/**
 * @route   GET /api/v1/admin/orders/cancel-requests
 * @desc    Lấy danh sách yêu cầu hủy đơn hàng
 * @access  Admin
 */
router.get("/cancel-requests", validate(orderValidator.validateGetCancelRequests), orderController.getCancelRequests);

/**
 * @route   PATCH /api/v1/admin/orders/cancel-requests/:id
 * @desc    Xử lý yêu cầu hủy đơn hàng
 * @access  Admin
 */
router.patch(
  "/cancel-requests/:id",
  validate(orderValidator.validateProcessCancelRequest),
  orderController.processCancelRequest
);

/**
 * @route   GET /api/v1/admin/orders/:id
 * @desc    Lấy chi tiết đơn hàng
 * @access  Admin
 */
router.get("/:id", validate(orderValidator.validateGetOrder), orderController.getOrderById);

/**
 * @route   PATCH /api/v1/admin/orders/:id/status
 * @desc    Cập nhật trạng thái đơn hàng
 * @access  Admin
 */
router.patch(
  "/:id/status",
  validate(orderValidator.validateUpdateOrderStatus),
  orderController.updateOrderStatus
);

module.exports = router;