const express = require("express");
const router = express.Router();

const orderController = require("@controllers/admin/order.controller");
const orderValidator = require("@validators/order.validator");
const validate = require("@utils/validatehelper");
const {
  protect,
  requireStaff,
  requireStaffOrAdmin,
  requireStaffReadOnly,
} = require("@middlewares/auth.middleware");

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);
// Bỏ router.use(requireStaff) để phân quyền chi tiết cho từng route

/**
 * @route   GET /api/v1/admin/orders
 * @desc    Lấy danh sách tất cả đơn hàng
 * @access  Staff/Admin
 */
router.get(
  "/",
  requireStaffOrAdmin,
  validate(orderValidator.validateGetOrders),
  orderController.getOrders
);

/**
 * @route   GET /api/v1/admin/orders/cancel-requests
 * @desc    Lấy danh sách yêu cầu hủy đơn hàng
 * @access  Staff/Admin
 */
router.get(
  "/cancel-requests",
  requireStaffReadOnly,
  validate(orderValidator.validateGetCancelRequests),
  orderController.getCancelRequests
);

/**
 * @route   PATCH /api/v1/admin/orders/cancel-requests/:id
 * @desc    Xử lý yêu cầu hủy đơn hàng
 * @access  Staff, Admin
 */
router.patch(
  "/cancel-requests/:id",
  requireStaff,
  validate(orderValidator.validateProcessCancelRequest),
  orderController.processCancelRequest
);

/**
 * @route   GET /api/v1/admin/orders/:id
 * @desc    Lấy chi tiết đơn hàng
 * @access  Staff (read-only), Admin
 */
router.get(
  "/:id",
  requireStaffReadOnly,
  validate(orderValidator.validateGetOrder),
  orderController.getOrderById
);

/**
 * @route   PATCH /api/v1/admin/orders/:id/status
 * @desc    Cập nhật trạng thái đơn hàng
 * @access  Staff, Admin
 */
router.patch(
  "/:id/status",
  requireStaff,
  validate(orderValidator.validateUpdateOrderStatus),
  orderController.updateOrderStatus
);

/**
 * @route   POST /api/v1/admin/orders/:id/confirm-return
 * @desc    Xác nhận nhận hàng trả về
 * @access  Staff/Admin
 */
router.post(
  "/:id/confirm-return",
  requireStaffOrAdmin,
  orderController.confirmReturn
);

/**
 * @route   POST /api/v1/admin/orders/:id/force-confirm-payment
 * @desc    FIXED Bug #11: Force confirm payment cho VNPAY failed callbacks
 * @access  Admin only
 */
router.post(
  "/:id/force-confirm-payment",
  requireStaff,
  orderController.forceConfirmPayment
);

module.exports = router;
