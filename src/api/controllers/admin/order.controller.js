const asyncHandler = require("express-async-handler");
const orderService = require("@services/order.service");

/**
 * LẤY DANH SÁCH TẤT CẢ ĐƠN HÀNG (ADMIN)
 *
 * Business Logic:
 * - Admin/Staff xem được TẤT CẢ đơn hàng của tất cả users
 * - Filter: status (pending/confirmed/shipping/delivered/cancelled)
 * - Search: code (mã đơn), user (name, email, phone), shippingAddress (name, phone)
 * - Pagination: page, limit
 * - Populate: user (name, email, phone), cancelRequestId (reason, status)
 * - Dùng để quản lý đơn hàng, theo dõi trạng thái
 *
 * @access  Staff/Admin only
 * @route   GET /api/admin/orders?page=1&limit=90&status=pending&search=ĐH001
 * @query   { page, limit, status, search }
 * @flow    order.route.js (admin) → order.controller.js → order.service.js → getAllOrders()
 */
const getOrders = asyncHandler(async (req, res) => {
  const result = await orderService.getAllOrders(req.query);

  res.status(200).json({
    success: true,
    message: "Lấy danh sách đơn hàng thành công",
    ...result,
  });
});

/**
 * LẤY CHI TIẾT ĐƠN HÀNG (ADMIN)
 *
 * Business Logic:
 * - Admin/Staff xem được chi tiết BẤT KỲ đơn hàng nào (không giới hạn ownership)
 * - Populate đầy đủ: user, orderItems (variant, size, color, product), coupon, cancelRequestId
 * - Hiển thị đầy đủ: shippingAddress, payment info, statusHistory
 * - Dùng để xử lý đơn hàng, kiểm tra thông tin trước khi thay đổi trạng thái
 *
 * @access  Staff/Admin only
 * @route   GET /api/admin/orders/:id
 * @params  { id: orderId }
 * @flow    order.route.js (admin) → order.controller.js → order.service.js → getOrderDetail()
 */
const getOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderDetail(req.params.id);

  res.status(200).json({
    success: true,
    message: "Lấy chi tiết đơn hàng thành công",
    data: order,
  });
});

/**
 * CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG
 *
 * Business Logic:
 * - Chỉ Staff/Admin mới có quyền thay đổi trạng thái
 * - Trạng thái flow hợp lệ: pending → confirmed → shipping → delivered
 * - Không thể chuyển sang cancelled trực tiếp (phải qua processCancelRequest)
 * - VNPAY: Kiểm tra đã thanh toán trước khi chuyển sang confirmed/shipping/delivered
 * - Kiểm tra: Nếu có yêu cầu huỷ đang pending → PHẢI xử lý yêu cầu huỷ trước
 * - Delivered + COD: Tự động cập nhật payment.paymentStatus = "paid"
 * - Thêm vào statusHistory với note và updatedBy
 *
 * @access  Staff/Admin only
 * @route   PATCH /api/admin/orders/:id/status
 * @params  { id: orderId }
 * @body    { status: confirmed|shipping|delivered, note }
 * @flow    order.route.js (admin) → order.controller.js → order.service.js → updateOrderStatus()
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  const result = await orderService.updateOrderStatus(req.params.id, {
    status,
    note,
    updatedBy: req.user.id,
  });

  res.status(200).json({
    success: true,
    message: "Cập nhật trạng thái đơn hàng thành công",
    data: result.order,
  });
});

/**
 * LẤY DANH SÁCH YÊU CẦU HUỶ ĐƠN HÀNG (ADMIN)
 *
 * Business Logic:
 * - Admin/Staff xem được TẤT CẢ yêu cầu huỷ của tất cả users
 * - Filter: status (pending/approved/rejected)
 * - Search: user (name, email, phone), order code
 * - Pagination: page, limit (default 50)
 * - Populate: user, order, processedBy (admin đã xử lý)
 * - Sort: createdAt desc (mới nhất lên đầu)
 * - Dùng để xem và xử lý yêu cầu huỷ từ customers
 *
 * @access  Staff/Admin only
 * @route   GET /api/admin/orders/cancel-requests?page=1&limit=50&status=pending&search=ĐH001
 * @query   { page, limit, status, search }
 * @flow    order.route.js (admin) → order.controller.js → order.service.js → getCancelRequests()
 */
const getCancelRequests = asyncHandler(async (req, res) => {
  const result = await orderService.getCancelRequests(req.query);

  res.status(200).json({
    success: true,
    message: "Lấy danh sách yêu cầu hủy đơn hàng thành công",
    ...result,
  });
});

/**
 * XỬ LÝ YÊU CẦU HỦY ĐƠN HÀNG (Admin duyệt yêu cầu hủy của user)
 *
 * @flow    order.route.js (admin) → order.controller.js → order.service.js → processCancelRequest()
 */
const processCancelRequest = asyncHandler(async (req, res) => {
  const { approved, note } = req.body;

  const result = await orderService.processCancelRequest(
    req.params.id,
    { approved, note },
    req.user.id
  );

  res.status(200).json(result);
});

/**
 * XÁC NHẬN NHẬN HÀNG TRẢ VỀ (HOÀN KHO)
 *
 * Business Logic:
 * - Chỉ Staff/Admin mới có quyền xác nhận
 * - Chỉ xử lý đơn ở trạng thái: cancelled, returned, returning_to_warehouse
 * - Kiểm tra: returnConfirmed phải = false (chưa xác nhận trước đó)
 * - Kiểm tra: inventoryDeducted = true (đã trừ kho trước đó)
 * - Tự động HOÀN KHO (stockIn) các items về inventory
 * - Xác định lý do hoàn kho:
 *   + returning_to_warehouse → delivery_failed
 *   + returned → return
 *   + cancelled → cancelled
 * - Nếu từ "returning_to_warehouse" → chuyển sang "cancelled"
 * - Set: returnConfirmed = true, returnConfirmedAt, returnConfirmedBy, inventoryDeducted = false
 * - Thêm vào statusHistory với note
 *
 * @access  Staff/Admin only
 * @route   POST /api/admin/orders/:id/confirm-return
 * @params  { id: orderId }
 * @body    { notes: string (optional) }
 * @flow    order.route.js (admin) → order.controller.js → order.service.js → confirmReturn()
 */
const confirmReturn = asyncHandler(async (req, res) => {
  const { notes } = req.body;

  const result = await orderService.confirmReturn(req.params.id, {
    confirmedBy: req.user.id,
    notes,
  });

  res.status(200).json({
    success: result.success,
    message: result.message,
    data: result.data,
  });
});

module.exports = {
  getOrders,
  getOrderById,
  updateOrderStatus,
  getCancelRequests,
  processCancelRequest,
  confirmReturn,
};
