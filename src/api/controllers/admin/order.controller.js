const asyncHandler = require("express-async-handler");
const orderService = require("@services/order.service");

/**
 * @desc    Lấy danh sách đơn hàng (admin)
 * @route   GET /api/admin/orders
 * @access  Staff/Admin
 */
const getOrders = asyncHandler(async (req, res) => {
  const result = await orderService.getAllOrders(req.query);
  
  res.status(200).json({
    success: true,
    message: "Lấy danh sách đơn hàng thành công",
    ...result
  });
});

/**
 * @desc    Lấy chi tiết đơn hàng (admin)
 * @route   GET /api/admin/orders/:id
 * @access  Staff/Admin
 */
const getOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderDetail(req.params.id);
  
  res.status(200).json({
    success: true,
    message: "Lấy chi tiết đơn hàng thành công",
    data: order
  });
});

/**
 * @desc    Cập nhật trạng thái đơn hàng
 * @route   PATCH /api/admin/orders/:id/status
 * @access  Staff/Admin
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  
  const result = await orderService.updateOrderStatus(req.params.id, {
    status,
    note,
    updatedBy: req.user.id
  });
  
  res.status(200).json({
    success: true,
    message: "Cập nhật trạng thái đơn hàng thành công",
    data: result.order
  });
});

/**
 * @desc    Lấy danh sách yêu cầu hủy đơn hàng
 * @route   GET /api/admin/orders/cancel-requests
 * @access  Staff/Admin
 */
const getCancelRequests = asyncHandler(async (req, res) => {
  const result = await orderService.getCancelRequests(req.query);
  
  res.status(200).json({
    success: true,
    message: "Lấy danh sách yêu cầu hủy đơn hàng thành công",
    ...result
  });
});

/**
 * @desc    Xử lý yêu cầu hủy đơn hàng
 * @route   PATCH /api/admin/orders/cancel-requests/:id
 * @access  Staff/Admin
 */
const processCancelRequest = asyncHandler(async (req, res) => {
  const { status, adminResponse } = req.body;
  
  const result = await orderService.processCancelRequest(req.params.id, {
    status,
    adminResponse,
    processedBy: req.user.id
  });
  
  res.status(200).json({
    success: true,
    message: result.message,
    data: result.cancelRequest
  });
});

module.exports = {
  getOrders,
  getOrderById,
  updateOrderStatus,
  getCancelRequests,
  processCancelRequest
};