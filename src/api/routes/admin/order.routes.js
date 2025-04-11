const express = require("express");
const router = express.Router();

const orderController = require("@controllers/admin/order.controller");
const orderValidator = require("@validators/order.validator");
const validate = require("@utils/validatehelper");
const { protect, admin } = require("@middlewares/auth.middleware");

/**
 * @route   GET /api/admin/orders
 * @desc    Lấy danh sách tất cả đơn hàng
 * @access  Admin
 */
router.get("/", protect, admin, orderController.getOrders);

/**
 * @route   GET /api/admin/orders/:id
 * @desc    Lấy chi tiết đơn hàng
 * @access  Admin
 */
router.get("/:id", protect, admin, orderController.getOrderById);

/**
 * @route   PATCH /api/admin/orders/:id/status
 * @desc    Cập nhật trạng thái đơn hàng
 * @access  Admin
 */
router.patch(
  "/:id/status",
  protect,
  admin,
  validate(orderValidator.validateUpdateOrderStatus),
  orderController.updateOrderStatus
);

/**
 * @route   PATCH /api/admin/orders/:id/cancel
 * @desc    Hủy đơn hàng (bởi Admin)
 * @access  Admin
 */
router.patch("/:id/cancel", protect, admin, orderController.cancelOrder);

module.exports = router;
