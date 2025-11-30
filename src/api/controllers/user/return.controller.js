const asyncHandler = require("express-async-handler");
const returnService = require("@services/return.service");

/**
 * USER RETURN CONTROLLER
 * Chứa các endpoints dành cho User/Customer quản lý đổi trả hàng của chính họ
 */

/**
 * TẠO YÊU CẦU ĐỔI/TRẢ HÀNG
 * @access  Authenticated User
 * @route   POST /api/v1/returns
 */
const createReturnRequest = asyncHandler(async (req, res) => {
  const { orderId, items, type, reason, refundMethod, bankInfo } = req.body;
  const customerId = req.user._id;

  const returnRequest = await returnService.createReturnRequest({
    orderId,
    customerId,
    items,
    type,
    reason,
    refundMethod,
    bankInfo,
  });

  res.status(201).json({
    success: true,
    message: "Tạo yêu cầu đổi trả thành công",
    data: returnRequest,
  });
});

/**
 * LẤY DANH SÁCH YÊU CẦU ĐỔI/TRẢ HÀNG CỦA USER
 * @access  Authenticated User (isAuthenticated middleware)
 * @route   GET /api/v1/returns?page=1&limit=20&status=pending&type=RETURN
 */
const getReturnRequests = asyncHandler(async (req, res) => {
  const { page, limit, status, type } = req.query;

  const filters = {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
    type,
    customerId: req.user._id, // Only get user's own requests
  };

  const result = await returnService.getReturnRequests(filters);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * LẤY CHI TIẾT YÊU CẦU ĐỔI/TRẢ
 * @access  Authenticated User (isAuthenticated middleware)
 * @route   GET /api/v1/returns/:id
 */
const getReturnRequestDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const isAdmin = false; // User is not admin

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
 * HUỶ YÊU CẦU ĐỔI/TRẢ HÀNG (CHỈ CUSTOMER)
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
    message: "Hủy yêu cầu đổi trả thành công",
    data: returnRequest,
  });
});

/**
 * KIỂM TRA SẢN PHẨM CÓ THỂ ĐỔI HÀNG KHÔNG
 * @access  Authenticated User
 * @route   GET /api/v1/returns/check-eligibility?orderId=xxx&variantId=xxx&sizeId=xxx
 */
const checkExchangeEligibility = asyncHandler(async (req, res) => {
  const { orderId, variantId, sizeId } = req.query;
  const userId = req.user._id;

  const result = await returnService.checkItemExchangeEligibility(
    orderId,
    variantId,
    sizeId,
    userId
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  createReturnRequest,
  getReturnRequests,
  getReturnRequestDetail,
  cancelReturnRequest,
  checkExchangeEligibility,
};
