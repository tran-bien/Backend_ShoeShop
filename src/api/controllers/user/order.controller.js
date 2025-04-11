const asyncHandler = require("express-async-handler");
const orderService = require("@services/order.service");
const cartService = require("@services/cart.service");
const paymentService = require("@services/payment.service");
const { Order } = require("@models");

// Các mã HTTP Status
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
};

/**
 * @desc    Get orders
 * @route   GET /api/orders
 * @access  Private
 */
const getOrders = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const result = await orderService.getUserOrders(userId, req.query);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    ...result,
  });
});

/**
 * @desc    Lấy chi tiết đơn hàng
 * @route   GET /api/orders/:id
 * @access  Người dùng đã đăng nhập
 */
const getOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id, req.user.id);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Lấy chi tiết đơn hàng thành công",
    data: order,
  });
});

/**
 * @desc    Tạo đơn hàng mới
 * @route   POST /api/orders
 * @access  Người dùng đã đăng nhập
 */
const createOrder = asyncHandler(async (req, res) => {
  const { addressId, paymentMethod, shippingMethod, note } = req.body;

  const result = await orderService.createOrder({
    userId: req.user.id,
    addressId,
    paymentMethod,
    shippingMethod,
    note,
  });

  // Nếu thanh toán qua VNPAY, tạo URL thanh toán
  if (paymentMethod === "VNPAY") {
    const paymentUrl = await paymentService.createVnpayPaymentUrl({
      orderId: result.order._id,
      amount: result.order.totalAfterDiscountAndShipping,
      orderInfo: `Thanh toán đơn hàng #${result.order._id}`,
      ipAddr: req.ip,
      returnUrl: process.env.VNPAY_RETURN_URL,
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Đơn hàng đã được tạo, vui lòng thanh toán",
      data: { order: result.order, paymentUrl },
    });
  }

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: "Đơn hàng đã được tạo thành công",
    data: result.order,
  });
});

/**
 * @desc    Hủy đơn hàng
 * @route   POST /api/orders/:id/cancel
 * @access  Người dùng đã đăng nhập
 */
const cancelOrder = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const canceledOrder = await orderService.cancelOrder(
    req.params.id,
    req.user.id,
    { reason }
  );

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Đơn hàng đã được hủy thành công",
    data: canceledOrder,
  });
});

/**
 * @desc    Callback từ VNPAY
 * @route   GET /api/orders/vnpay/callback
 * @access  Public
 */
const vnpayCallback = asyncHandler(async (req, res) => {
  const vnpParams = req.query;

  // Xử lý kết quả thanh toán
  const paymentResult = await paymentService.processVnpayReturn(vnpParams);

  // Chuyển hướng tới trang kết quả ở frontend
  res.redirect(
    `${process.env.FRONTEND_URL}/payment/result?${new URLSearchParams({
      orderId: paymentResult.orderId,
      status: paymentResult.success ? "success" : "failed",
      message: paymentResult.message,
    }).toString()}`
  );
});

/**
 * @desc    IPN từ VNPAY
 * @route   POST /api/orders/vnpay/ipn
 * @access  Public
 */
const vnpayIpn = asyncHandler(async (req, res) => {
  const vnpParams = req.query;

  // Xử lý thông báo thanh toán
  const result = await paymentService.processVnpayIpn(vnpParams);

  if (result.success) {
    return res
      .status(HTTP_STATUS.OK)
      .json({ RspCode: "00", Message: "Confirmed" });
  }

  return res
    .status(HTTP_STATUS.BAD_REQUEST)
    .json({ RspCode: "99", Message: "Invalid Params" });
});

/**
 * @desc    Lấy thông tin theo dõi đơn hàng
 * @route   GET /api/orders/:id/tracking
 * @access  Người dùng đã đăng nhập
 */
const getOrderTracking = asyncHandler(async (req, res) => {
  const tracking = await orderService.getOrderTracking(
    req.params.id,
    req.user.id
  );

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Lấy thông tin theo dõi đơn hàng thành công",
    data: tracking,
  });
});

/**
 * @desc    Thanh toán lại đơn hàng
 * @route   POST /api/orders/:id/repay
 * @access  Người dùng đã đăng nhập
 */
const repayOrder = asyncHandler(async (req, res) => {
  const orderId = req.params.id;

  // Tạo URL thanh toán lại
  const result = await paymentService.createRepaymentUrl(
    orderId,
    req.ip,
    process.env.VNP_RETURN_URL
  );

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Đã tạo URL thanh toán lại cho đơn hàng",
    data: result.data,
  });
});

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  cancelOrder,
  getOrderTracking,
  vnpayCallback,
  vnpayIpn,
  repayOrder,
};
