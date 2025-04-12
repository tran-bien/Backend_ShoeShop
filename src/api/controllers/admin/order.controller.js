const asyncHandler = require("express-async-handler");
const orderService = require("@services/order.service");

// Các mã HTTP Status
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
};

/**
 * @desc    Lấy danh sách đơn hàng (admin)
 * @route   GET /api/admin/orders
 * @access  Admin
 */
const getOrders = asyncHandler(async (req, res) => {
  const result = await orderService.getOrders(req.query);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Lấy danh sách đơn hàng thành công",
    data: result,
  });
});

/**
 * @desc    Lấy chi tiết đơn hàng (admin)
 * @route   GET /api/admin/orders/:id
 * @access  Admin
 */
const getOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Lấy chi tiết đơn hàng thành công",
    data: order,
  });
});

/**
 * @desc    Cập nhật trạng thái đơn hàng
 * @route   PATCH /api/admin/orders/:id/status
 * @access  Admin
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const updatedOrder = await orderService.updateOrderStatus(
    req.params.id,
    status,
    {
      note,
      updatedBy: req.user.id,
    }
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Cập nhật trạng thái đơn hàng thành công",
    data: updatedOrder,
  });
});

/**
 * @desc    Xử lý hủy đơn hàng (Admin hủy trực tiếp)
 * @route   PATCH /api/admin/orders/:id/cancel
 * @access  Admin
 * @note    Admin có thể hủy đơn trực tiếp mà không cần qua quy trình yêu cầu hủy đơn
 *          Khác với việc phê duyệt yêu cầu hủy đơn từ người dùng
 */
const cancelOrder = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const canceledOrder = await orderService.adminCancelOrder(
    req.params.id,
    req.user.id,
    {
      reason,
    }
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Hủy đơn hàng thành công",
    data: canceledOrder,
  });
});

module.exports = {
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
};
