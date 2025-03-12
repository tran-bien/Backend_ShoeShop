const express = require("express");
const { protect, admin } = require("../middlewares/auth.middleware");
const {
  createOrder,
  getOrderById,
  getUserOrders,
  filterUserOrders,
  searchUserOrders,
  getOrders,
  filterOrders,
  searchOrders,
  cancelOrder,
  updateOrderStatus,
  updatePaymentStatus,
  reviewCancelRequest,
  getCancelRequests,
  getUserCancelRequests,
} = require("../controllers/order.controller");

const router = express.Router();

// Tất cả các route đều yêu cầu xác thực
router.use(protect);

// Route cho người dùng
router.post("/", createOrder);
router.get("/", getUserOrders);
router.get("/filter", filterUserOrders);
router.get("/search", searchUserOrders);
router.get("/my-cancel-requests", getUserCancelRequests);
router.get("/:id", getOrderById);
router.post("/:orderId/cancel", cancelOrder);

// Route cho admin
router.get("/admin/orders", admin, getOrders);
router.get("/admin/orders/filter", admin, filterOrders);
router.get("/admin/orders/search", admin, searchOrders);
router.put("/:orderId/status", admin, updateOrderStatus);
router.put("/:orderId/payment-status", admin, updatePaymentStatus);
router.get("/cancel-requests", admin, getCancelRequests);
router.post("/cancel-requests/:requestId/review", admin, reviewCancelRequest);

module.exports = router;
