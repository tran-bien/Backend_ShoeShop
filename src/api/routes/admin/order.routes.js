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
 * @route   GET /api/admin/orders
 * @desc    Lấy danh sách tất cả đơn hàng
 * @access  Admin
 */
router.get("/", orderController.getOrders);

/**
 * @route   GET /api/admin/orders/:id
 * @desc    Lấy chi tiết đơn hàng
 * @access  Admin
 */
router.get("/:id", orderController.getOrderById);

/**
 * @route   PATCH /api/admin/orders/:id/status
 * @desc    Cập nhật trạng thái đơn hàng
 * @access  Admin
 */
router.patch(
  "/:id/status",
  validate(orderValidator.validateUpdateOrderStatus),
  orderController.updateOrderStatus
);

/**
 * @route   PATCH /api/admin/orders/:id/cancel
 * @desc    Hủy đơn hàng (bởi Admin)
 * @access  Admin
 */
router.patch("/:id/cancel", orderController.cancelOrder);

module.exports = router;
