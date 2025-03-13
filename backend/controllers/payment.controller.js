const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Order = require("../models/order.model");
const paymentService = require("../services/payment.service");

// Tạo URL thanh toán VNPAY
exports.createPaymentUrl = asyncHandler(async (req, res) => {
  try {
    const { orderId, amount, bankCode, language } = req.body;

    // Validation rõ ràng hơn
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mã đơn hàng",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Mã đơn hàng không hợp lệ",
      });
    }

    // Kiểm tra đơn hàng có tồn tại không và thuộc về người dùng hiện tại
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng",
      });
    }

    // Kiểm tra đơn hàng có thuộc về người dùng hiện tại không
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thanh toán đơn hàng này",
      });
    }

    // Kiểm tra trạng thái đơn hàng, chỉ cho phép thanh toán đơn hàng ở trạng thái chờ thanh toán
    if (order.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Đơn hàng không ở trạng thái chờ thanh toán",
      });
    }

    // Kiểm tra số tiền thanh toán có khớp với tổng tiền đơn hàng không
    if (Number(amount) !== Number(order.totalAmount)) {
      return res.status(400).json({
        success: false,
        message: "Số tiền thanh toán không khớp với tổng tiền đơn hàng",
      });
    }

    // Sử dụng paymentService để tạo URL thanh toán
    const orderInfo = `Thanh toan don hang ${order.orderCode}`;
    const result = await paymentService.createVnpayPaymentUrl(
      {
        orderId: order._id,
        amount: order.totalAmount,
        orderInfo,
        bankCode,
        language,
      },
      req
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi tạo URL thanh toán",
    });
  }
});

// Xử lý kết quả thanh toán từ VNPAY (cho frontend)
exports.vnpayReturn = asyncHandler(async (req, res) => {
  try {
    // Sử dụng paymentService để xác thực thanh toán
    const result = await paymentService.verifyVnpayPayment(req.query);

    // Trả về kết quả
    res.json({
      success: result.success,
      message: result.message,
      order: result.order,
      paymentStatus: result.paymentStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi xử lý kết quả thanh toán",
    });
  }
});

// Xử lý thông báo tức thời IPN từ VNPAY
exports.vnpayIpn = asyncHandler(async (req, res) => {
  try {
    // Sử dụng paymentService để xác thực thanh toán
    const result = await paymentService.verifyVnpayPayment(req.query);

    if (result.success) {
      return res
        .status(200)
        .json({ RspCode: "00", Message: "Confirm Success" });
    } else {
      return res.status(200).json({ RspCode: "99", Message: result.message });
    }
  } catch (error) {
    console.error("Lỗi khi xử lý IPN từ VNPay:", error);
    return res.status(200).json({ RspCode: "99", Message: "Unknown error" });
  }
});

// Cải thiện xử lý thanh toán thất bại
exports.paymentCallback = asyncHandler(async (req, res) => {
  try {
    // Lấy thông tin từ query parameters
    const { vnp_TxnRef: paymentCode, vnp_ResponseCode: responseCode } =
      req.query;

    // Tìm đơn hàng bằng paymentCode
    const order = await Order.findOne({ paymentCode });

    if (!order) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/payment/failed?error=order_not_found`
      );
    }

    // Xác định URL chuyển hướng dựa trên kết quả thanh toán
    const redirectUrl =
      responseCode === "00"
        ? `${process.env.FRONTEND_URL}/payment/success?orderId=${order._id}`
        : `${process.env.FRONTEND_URL}/payment/failed?orderId=${order._id}&code=${responseCode}`;

    // Chuyển hướng đến URL thích hợp
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("Lỗi khi xử lý callback thanh toán:", error);
    return res.redirect(
      `${process.env.FRONTEND_URL}/payment/failed?error=server_error`
    );
  }
});

/**
 * @desc    Thanh toán lại đơn hàng
 * @route   POST /api/payments/retry
 * @access  Private
 */
exports.retryPayment = asyncHandler(async (req, res) => {
  try {
    const { orderId, bankCode, language } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mã đơn hàng",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Mã đơn hàng không hợp lệ",
      });
    }

    // Kiểm tra đơn hàng có tồn tại không và thuộc về người dùng hiện tại
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng",
      });
    }

    // Kiểm tra đơn hàng có thuộc về người dùng hiện tại không
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thanh toán đơn hàng này",
      });
    }

    // Sử dụng paymentService để tạo lại URL thanh toán
    const orderInfo = `Thanh toan lai don hang ${order.orderCode}`;
    const result = await paymentService.createVnpayPaymentUrl(
      {
        orderId: order._id,
        amount: order.totalAmount,
        orderInfo,
        bankCode,
        language,
      },
      req
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi tạo URL thanh toán",
    });
  }
});
