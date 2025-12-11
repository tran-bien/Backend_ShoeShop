const asyncHandler = require("express-async-handler");
const returnService = require("@services/return.service");

/**
 * USER RETURN CONTROLLER
 * Chứa các endpoints dành cho User/Customer quản lý trả hàng/hoàn tiền
 * (Đã loại bỏ logic đổi hàng - chỉ có trả hàng/hoàn tiền toàn bộ đơn)
 */

/**
 * TẠO YÊU CẦU TRẢ HÀNG/HOÀN TIỀN
 * @access  Authenticated User
 * @route   POST /api/v1/returns
 */
const createReturnRequest = asyncHandler(async (req, res) => {
  const { orderId, reason, reasonDetail, refundMethod, bankInfo } = req.body;
  const customerId = req.user._id;

  const returnRequest = await returnService.createReturnRequest(
    {
      orderId,
      reason,
      reasonDetail,
      refundMethod,
      bankInfo,
    },
    customerId
  );

  res.status(201).json({
    success: true,
    message: "Tạo yêu cầu trả hàng thành công",
    data: returnRequest,
  });
});

/**
 * LẤY DANH SÁCH YÊU CẦU TRẢ HÀNG CỦA USER
 * @access  Authenticated User (isAuthenticated middleware)
 * @route   GET /api/v1/returns?page=1&limit=20&status=pending
 */
const getReturnRequests = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;

  const filters = {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
    customerId: req.user._id, // Only get user's own requests
  };

  const result = await returnService.getReturnRequests(filters);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * LẤY CHI TIẾT YÊU CẦU TRẢ HÀNG
 * @access  Authenticated User (isAuthenticated middleware)
 * @route   GET /api/v1/returns/:id
 */
const getReturnRequestDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const isAdmin = false;

  const returnRequest = await returnService.getReturnRequestById(
    id,
    userId,
    isAdmin
  );

  res.status(200).json({
    success: true,
    data: returnRequest,
  });
});

/**
 * HUỶ YÊU CẦU TRẢ HÀNG (CHỈ KHI CÒN PENDING)
 * @access  Authenticated User (isAuthenticated middleware)
 * @route   DELETE /api/v1/returns/:id
 */
const cancelReturnRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const returnRequest = await returnService.cancelReturnRequest(
    id,
    req.user._id
  );

  res.status(200).json({
    success: true,
    message: "Hủy yêu cầu trả hàng thành công",
    data: returnRequest,
  });
});

module.exports = {
  createReturnRequest,
  getReturnRequests,
  getReturnRequestDetail,
  cancelReturnRequest,
};
