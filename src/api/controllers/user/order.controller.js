const asyncHandler = require("express-async-handler");
const orderService = require("@services/order.service");
const paymentService = require("@services/payment.service");

/**
 * @desc    Lấy danh sách đơn hàng của người dùng
 * @route   GET /api/orders
 * @access  Private
 */
const getOrders = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await orderService.getUserOrders(userId, req.query);
  
  res.status(200).json({
    success: true,
    message: "Lấy danh sách đơn hàng thành công",
    ...result
  });
});

/**
 * @desc    Lấy chi tiết đơn hàng
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id, req.user.id);
  
  res.status(200).json({
    success: true,
    message: "Lấy chi tiết đơn hàng thành công",
    data: order
  });
});

/**
 * @desc    Tạo đơn hàng mới
 * @route   POST /api/orders
 * @access  Private
 */
const createOrder = asyncHandler(async (req, res) => {
  const { addressId, paymentMethod, note, couponCode } = req.body;

  const order = await orderService.createOrder({
    userId: req.user.id,
    addressId,
    paymentMethod,
    note,
    couponCode
  });

  // Nếu thanh toán qua VNPAY, tạo URL thanh toán
  if (paymentMethod === "VNPAY") {
    try {
      console.log("Creating VNPAY payment for order:", {
        id: order._id,
        code: order.code,
        amount: order.totalAfterDiscountAndShipping
      });
      
      const paymentUrl = await paymentService.createVnpayPaymentUrl({
        orderId: order._id,
        amount: order.totalAfterDiscountAndShipping,
        orderInfo: `Thanh toan don hang ${order.code || order._id}`,
        ipAddr: req.ip || req.connection.remoteAddress || "127.0.0.1",
        returnUrl: process.env.VNPAY_RETURN_URL
      });

      return res.status(200).json({
        success: true,
        message: "Đơn hàng đã được tạo, vui lòng thanh toán",
        data: { 
          order: {
            _id: order._id,
            code: order.code,
            totalAmount: order.totalAfterDiscountAndShipping
          }, 
          paymentUrl 
        }
      });
    } catch (error) {
      console.error("VNPAY payment URL creation failed:", error);
      
      // Nếu lỗi tạo URL thanh toán, vẫn trả về đơn hàng đã tạo
      return res.status(201).json({
        success: true,
        message: "Đơn hàng đã tạo thành công, nhưng có lỗi khi tạo URL thanh toán",
        error: error.message,
        data: order
      });
    }
  }

  res.status(201).json({
    success: true,
    message: "Đơn hàng đã được tạo thành công",
    data: order
  });
});

/**
 * @desc    Gửi yêu cầu hủy đơn hàng
 * @route   POST /api/orders/:id/cancel
 * @access  Private
 */
const cancelOrder = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  
  const result = await orderService.cancelOrder(
    req.params.id,
    req.user.id,
    { reason }
  );
  
  res.status(200).json({
    success: true,
    message: result.message,
    data: result.cancelRequest
  });
});

/**
 * @desc    Lấy thông tin theo dõi đơn hàng
 * @route   GET /api/orders/:id/tracking
 * @access  Private
 */
const getOrderTracking = asyncHandler(async (req, res) => {
  const tracking = await orderService.getOrderTracking(
    req.params.id,
    req.user.id
  );
  
  res.status(200).json({
    success: true,
    message: "Lấy thông tin theo dõi đơn hàng thành công",
    data: tracking
  });
});

/**
 * @desc    Lấy thống kê đơn hàng theo trạng thái
 * @route   GET /api/orders/stats
 * @access  Private
 */
const getUserOrderStats = asyncHandler(async (req, res) => {
  const stats = await orderService.getUserOrderStats(req.user.id);
  
  res.status(200).json({
    success: true,
    message: "Lấy thống kê đơn hàng thành công",
    data: stats
  });
});

/**
 * @desc    Thanh toán lại đơn hàng
 * @route   POST /api/orders/:id/repay
 * @access  Private
 */
const repayOrder = asyncHandler(async (req, res) => {
  const result = await paymentService.createRepaymentUrl(
    req.params.id,
    req.ip,
    process.env.VNPAY_RETURN_URL
  );
  
  res.status(200).json({
    success: true,
    message: "Đã tạo URL thanh toán lại cho đơn hàng",
    data: result.data
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
      message: paymentResult.message
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
    return res.status(200).json({ RspCode: "00", Message: "Confirmed" });
  }
  
  return res.status(400).json({ RspCode: "99", Message: "Invalid Params" });
});

/**
 * @desc    Test callback từ VNPAY
 * @route   GET /api/orders/vnpay/test-callback
 * @access  Public
 */
const testVnpayCallback = asyncHandler(async (req, res) => {
  const vnpParams = req.query;
  
  console.log("Xử lý VNPAY test callback:", JSON.stringify(vnpParams));
  
  // Xử lý kết quả thanh toán
  const paymentResult = await paymentService.processPaymentResult(vnpParams);
  
  res.status(200).json({
    success: true,
    message: "Đã xử lý callback VNPAY test",
    data: paymentResult
  });
});

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  cancelOrder,
  getOrderTracking,
  getUserOrderStats,
  repayOrder,
  vnpayCallback,
  vnpayIpn,
  testVnpayCallback
};