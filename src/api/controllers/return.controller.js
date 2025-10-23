const asyncHandler = require("express-async-handler");
const returnService = require("../../services/return.service");

/**
 * TẠO YÊU CẦU ĐỔI/TRẢ HÀNG
 *
 * Business Logic:
 * - Chỉ đổi/trả được đơn hàng đã DELIVERED
 * - Thời hạn: 7 ngày kể từ khi giao hàng
 * - Kiểm tra số lượng trả không vượt quá số lượng đã mua
 * - Type: RETURN (trả hàng + hoàn tiền) hoặc EXCHANGE (đổi sang variant/size khác)
 * - Tính refundAmount tự động = sum(orderItem.price * quantity)
 *
 * @access  Authenticated User
 * @route   POST /api/returns
 * @body    { orderId, items[], type: RETURN|EXCHANGE, reason, refundMethod, bankInfo }
 * @flow    return.route.js → return.controller.js → return.service.js → createReturnRequest()
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
 * LẤY DANH SÁCH YÊU CẦU ĐỔI/TRẢ HÀNG
 *
 * Business Logic:
 * - User thường: Chỉ xem được yêu cầu của chính mình (route dùng isAuthenticated)
 * - Staff/Admin: Xem được tất cả yêu cầu, có thể filter theo customerId (route dùng requireStaffOrAdmin)
 * - Filter: status (pending/approved/rejected/completed), type (RETURN/EXCHANGE)
 * - Pagination: page, limit
 * - Logic phân quyền xem: Service tự động filter dựa vào customerId được truyền vào
 *
 * @access  Authenticated User (isAuthenticated middleware)
 * @route   GET /api/returns?page=1&limit=20&status=pending&type=RETURN
 * @query   { page, limit, status, type, customerId (optional) }
 * @flow    return.route.js → return.controller.js → return.service.js → getReturnRequests()
 */
const getReturnRequests = asyncHandler(async (req, res) => {
  const { page, limit, status, type, customerId } = req.query;
  const isAdmin = req.user.role === "admin" || req.user.role === "staff";

  const filters = {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
    type,
  };

  // Nếu không phải admin, chỉ lấy yêu cầu của chính mình
  if (!isAdmin) {
    filters.customerId = req.user._id;
  } else if (customerId) {
    filters.customerId = customerId;
  }

  const result = await returnService.getReturnRequests(filters);

  res.status(200).json({
    success: true,
    data: result,
  });
});
/**
 * LẤY CHI TIẾT YÊU CẦU ĐỔI/TRẢ
 *
 * Business Logic:
 * - User thường: Chỉ xem được yêu cầu của chính mình (ownership check trong service)
 * - Staff/Admin: Xem được tất cả yêu cầu
 * - Populate đầy đủ: customer info, order details, items (variant, size, color, product)
 * - Trả về toàn bộ thông tin: items, type, status, reason, refundMethod, bankInfo, admin notes
 * - Service sẽ throw ApiError(403) nếu user không có quyền xem
 *
 * @access  Authenticated User (isAuthenticated middleware)
 * @route   GET /api/returns/:id
 * @params  { id: returnRequestId }
 * @flow    return.route.js → return.controller.js → return.service.js → getReturnRequestById()
 */
const getReturnRequestDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const isAdmin = req.user.role === "admin" || req.user.role === "staff";

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
 * DUYỆT YÊU CẦU ĐỔI/TRẢ HÀNG
 *
 * Business Logic:
 * - Chỉ Staff/Admin mới có quyền duyệt (requireStaffOrAdmin middleware)
 * - Chỉ duyệt được yêu cầu ở trạng thái PENDING
 * - Chuyển status: pending → approved
 * - Có thể thêm note từ admin khi duyệt
 * - Sau khi duyệt, customer có thể gửi hàng về
 *
 * @access  Staff/Admin only (requireStaffOrAdmin middleware)
 * @route   PATCH /api/returns/:id/approve
 * @params  { id: returnRequestId }
 * @body    { note (optional) }
 * @flow    return.route.js → return.controller.js → return.service.js → approveReturnRequest()
 */
const approveReturnRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  const returnRequest = await returnService.approveReturnRequest(id, {
    approvedBy: req.user._id,
    note,
  });

  res.status(200).json({
    success: true,
    message: "Phê duyệt yêu cầu đổi trả thành công",
    data: returnRequest,
  });
});

/**
 * TỪ CHỐI YÊU CẦU ĐỔI/TRẢ HÀNG
 *
 * Business Logic:
 * - Chỉ Staff/Admin mới có quyền từ chối (requireStaffOrAdmin middleware)
 * - Chỉ từ chối được yêu cầu ở trạng thái PENDING
 * - Chuyển status: pending → rejected
 * - REQUIRED: Phải có lý do từ chối (reason)
 * - Sau khi từ chối, customer không thể đổi/trả nữa
 *
 * @access  Staff/Admin only (requireStaffOrAdmin middleware)
 * @route   PATCH /api/returns/:id/reject
 * @params  { id: returnRequestId }
 * @body    { reason: string (required) }
 * @flow    return.route.js → return.controller.js → return.service.js → rejectReturnRequest()
 */
const rejectReturnRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const returnRequest = await returnService.rejectReturnRequest(id, {
    rejectedBy: req.user._id,
    reason,
  });

  res.status(200).json({
    success: true,
    message: "Từ chối yêu cầu đổi trả",
    data: returnRequest,
  });
});

/**
 * Xử lý hoàn trả
 */

/**
 * XỬ LÝ TRẢ HÀNG (HOÀN TIỀN)
 *
 * Business Logic:
 * - Chỉ Staff/Admin mới có quyền xử lý (requireStaffOrAdmin middleware)
 * - Chỉ xử lý được yêu cầu đã APPROVED
 * - Type phải là RETURN (trả hàng + hoàn tiền)
 * - Tự động STOCK IN các items trả về vào inventory (tăng stock)
 * - Cập nhật order status → 'returned'
 * - Cập nhật returnRequest status → 'completed'
 *
 * @access  Staff/Admin only (requireStaffOrAdmin middleware)
 * @route   POST /api/returns/:id/process-return
 * @params  { id: returnRequestId }
 * @flow    return.route.js → return.controller.js → return.service.js → processReturn()
 */
const processReturn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  const result = await returnService.processReturn(id, {
    processedBy: req.user._id,
    note,
  });

  res.status(200).json({
    success: true,
    message: "Xử lý hoàn trả thành công",
    data: result,
  });
});

/**
 * XỬ LÝ ĐỔI HÀNG
 *
 * Business Logic:
 * - Chỉ Staff/Admin mới có quyền xử lý (requireStaffOrAdmin middleware)
 * - Chỉ xử lý được yêu cầu đã APPROVED
 * - Type phải là EXCHANGE (đổi sang variant/size khác)
 * - STOCK IN các items cũ trả về (tăng stock items cũ)
 * - STOCK OUT các items mới đổi (giảm stock items mới)
 * - Kiểm tra stock items mới trước khi đổi
 * - Cập nhật returnRequest status → 'completed'
 *
 * @access  Staff/Admin only (requireStaffOrAdmin middleware)
 * @route   POST /api/returns/:id/process-exchange
 * @params  { id: returnRequestId }
 * @body    { newItems: [{ variantId, sizeId, colorId, quantity }] }
 * @flow    return.route.js → return.controller.js → return.service.js → processExchange()
 */
const processExchange = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  const result = await returnService.processExchange(id, {
    processedBy: req.user._id,
    note,
  });

  res.status(200).json({
    success: true,
    message: "Xử lý đổi hàng thành công",
    data: result,
  });
});

/**
 * Hủy yêu cầu đổi trả
 */

/**
 * HUỶ YÊU CẦU ĐỔI/TRẢ HÀNG (CHỈ CUSTOMER)
 *
 * Business Logic:
 * - CHỈ customer tạo yêu cầu mới được huỷ
 * - CHỈ huỷ được yêu cầu ở trạng thái PENDING (chưa duyệt)
 * - Admin/Staff KHÔNG thể huỷ yêu cầu của customer
 * - Chuyển status: pending → canceled
 * - Sau khi huỷ, customer có thể tạo yêu cầu mới
 *
 * @access  Authenticated User (isAuthenticated middleware)
 * @route   DELETE /api/returns/:id
 * @params  { id: returnRequestId }
 * @flow    return.route.js → return.controller.js → return.service.js → cancelReturnRequest()
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
 * LẤY THỐNG KÊ YÊU CẦU ĐỔI/TRẢ HÀNG
 *
 * Business Logic:
 * - Chỉ Admin/Staff mới có quyền xem thống kê (requireStaffOrAdmin middleware)
 * - Đếm số lượng yêu cầu theo status: pending, approved, rejected, completed, canceled
 * - Đếm số lượng yêu cầu theo type: RETURN, EXCHANGE
 * - Tổng hợp refundAmount (tổng tiền hoàn trả)
 * - Dùng cho Dashboard admin
 *
 * @access  Staff/Admin only (requireStaffOrAdmin middleware)
 * @route   GET /api/returns/stats/summary
 * @flow    return.route.js → return.controller.js → return.service.js → getReturnStats()
 */
const getReturnStats = asyncHandler(async (req, res) => {
  const stats = await returnService.getReturnStats();

  res.status(200).json({
    success: true,
    data: stats,
  });
});

/**
 * KIỂM TRA SẢN PHẨM CÓ THỂ ĐỔI HÀNG KHÔNG
 *
 * Business Logic:
 * - Kiểm tra orderItem có đủ điều kiện đổi hàng không
 * - Validate: order status, thời hạn 7 ngày, chưa đổi, không có yêu cầu pending
 * - Trả về: { canExchange: boolean, reason: string, daysRemaining, exchangeHistory }
 * - Dùng để hiển thị UI enable/disable nút "Đổi hàng"
 *
 * @access  Authenticated User
 * @route   GET /api/returns/check-eligibility?orderId=xxx&variantId=xxx&sizeId=xxx
 * @query   { orderId, variantId, sizeId }
 * @flow    return.route.js → return.controller.js → return.service.js → checkItemExchangeEligibility()
 */
const checkExchangeEligibility = asyncHandler(async (req, res) => {
  const { orderId, variantId, sizeId } = req.query;
  const userId = req.user._id;

  if (!orderId || !variantId || !sizeId) {
    throw new ApiError(
      400,
      "Thiếu thông tin: orderId, variantId, sizeId là bắt buộc"
    );
  }

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
  approveReturnRequest,
  rejectReturnRequest,
  processReturn,
  processExchange,
  cancelReturnRequest,
  getReturnStats,
  checkExchangeEligibility,
};
