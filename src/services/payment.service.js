const Order = require("../models/order.model");
const crypto = require("crypto");
const axios = require("axios");
const querystring = require("querystring");

const paymentService = {
  /**
   * Tạo mã thanh toán duy nhất
   * @returns {String} - Mã thanh toán
   */
  generatePaymentCode: () => {
    const timestamp = new Date().getTime();
    const randomNum = Math.floor(Math.random() * 1000000);
    return `PAY${timestamp}${randomNum}`;
  },

  /**
   * Sắp xếp đối tượng theo khóa
   * @param {Object} obj - Đối tượng cần sắp xếp
   * @returns {Object} - Đối tượng sau khi sắp xếp
   */
  sortObject: (obj) => {
    const sorted = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) {
        sorted[key] = obj[key];
      }
    }

    return sorted;
  },

  /**
   * Tạo thanh toán mới
   * @param {Object} paymentData - Thông tin thanh toán
   * @returns {Object} - Thông tin thanh toán đã tạo
   */
  createPayment: async (paymentData) => {
    const {
      orderId,
      amount,
      method,
      status = "pending",
      details = {},
    } = paymentData;

    // Tìm đơn hàng
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Không tìm thấy đơn hàng");
    }

    // Tạo mã thanh toán
    const paymentCode = paymentService.generatePaymentCode();

    // Cập nhật thông tin thanh toán trong đơn hàng
    order.paymentMethod = method;
    order.paymentStatus = status;
    order.paymentCode = paymentCode;
    order.paymentInfo = details;
    await order.save();

    return {
      _id: order._id,
      order: orderId,
      amount,
      method,
      status,
      paymentCode,
      details,
    };
  },

  /**
   * Cập nhật trạng thái thanh toán
   * @param {String} orderId - ID đơn hàng
   * @param {String} status - Trạng thái mới
   * @param {Object} details - Thông tin chi tiết bổ sung
   * @returns {Object} - Thông tin thanh toán đã cập nhật
   */
  updatePaymentStatus: async (orderId, status, details = {}) => {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Không tìm thấy đơn hàng");
    }

    // Cập nhật trạng thái thanh toán
    order.paymentStatus = status;

    // Thêm thông tin chi tiết nếu có
    if (Object.keys(details).length > 0) {
      order.paymentInfo = { ...order.paymentInfo, ...details };
    }

    // Ghi nhận thời gian hoàn thành nếu thanh toán thành công
    if (status === "completed" || status === "paid") {
      if (!order.paymentHistory) {
        order.paymentHistory = [];
      }

      order.paymentHistory.push({
        status: "paid",
        timestamp: new Date(),
        note: "Thanh toán thành công qua cổng thanh toán",
      });

      // Cập nhật trạng thái đơn hàng nếu đang ở trạng thái pending
      if (order.status === "pending") {
        order.status = "confirmed";
        order.statusHistory.push({
          status: "confirmed",
          timestamp: new Date(),
          note: "Tự động cập nhật sau khi thanh toán thành công",
        });
      }
    }

    await order.save();

    return {
      order: orderId,
      status: order.paymentStatus,
      details: order.paymentInfo,
    };
  },

  /**
   * Tạo URL thanh toán VNPay
   * @param {Object} paymentData - Thông tin thanh toán
   * @param {Object} req - Request object
   * @returns {Object} - URL thanh toán và thông tin liên quan
   */
  createVnpayPaymentUrl: async (paymentData, req) => {
    const {
      orderId,
      amount,
      orderInfo = "Thanh toan don hang",
      returnUrl,
    } = paymentData;

    // Tạo thanh toán trong database
    const payment = await paymentService.createPayment({
      orderId,
      amount,
      method: "VNPAY",
      status: "pending",
      details: { orderInfo },
    });

    // Cấu hình VNPay
    const vnpay_config = {
      vnp_TmnCode: process.env.VNP_TMN_CODE,
      vnp_HashSecret: process.env.VNP_HASH_SECRET,
      vnp_Url: process.env.VNP_URL,
      vnp_ReturnUrl: returnUrl || process.env.VNP_RETURN_URL,
    };

    // Tạo tham số thanh toán
    const date = new Date();
    const createDate =
      date.toISOString().split("T")[0].replace(/-/g, "") +
      date.toTimeString().split(" ")[0].replace(/:/g, "");

    const ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress;

    const tmnCode = vnpay_config.vnp_TmnCode;
    const secretKey = vnpay_config.vnp_HashSecret;

    const vnp_Params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: payment.paymentCode,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: "other",
      vnp_Amount: amount * 100, // VNPay yêu cầu số tiền * 100
      vnp_ReturnUrl: vnpay_config.vnp_ReturnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    };

    // Sắp xếp tham số
    const sortedParams = paymentService.sortObject(vnp_Params);

    // Tạo chuỗi ký tự cần mã hóa
    const signData = querystring.stringify(sortedParams, { encode: false });

    // Tạo chữ ký
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    // Thêm chữ ký vào tham số
    sortedParams.vnp_SecureHash = signed;

    // Tạo URL thanh toán
    const paymentUrl =
      vnpay_config.vnp_Url +
      "?" +
      querystring.stringify(sortedParams, { encode: false });

    return {
      paymentUrl,
      paymentCode: payment.paymentCode,
      orderId: payment.order,
    };
  },

  /**
   * Xác thực thanh toán VNPay khi callback
   * @param {Object} vnpResponse - Phản hồi từ VNPay
   * @returns {Object} - Kết quả xác thực thanh toán
   */
  verifyVnpayPayment: async (vnpResponse) => {
    // Lấy thông tin từ response
    const {
      vnp_TxnRef: paymentCode,
      vnp_Amount: amount,
      vnp_ResponseCode: responseCode,
      vnp_TransactionStatus: transactionStatus,
      vnp_SecureHash: secureHash,
      ...otherParams
    } = vnpResponse;

    // Lấy thông tin thanh toán từ database
    const order = await Order.findOne({ paymentCode });
    if (!order) {
      throw new Error("Không tìm thấy thông tin thanh toán");
    }

    // Xác thực chữ ký
    const secretKey = process.env.VNP_HASH_SECRET;
    const sortedParams = paymentService.sortObject(otherParams);
    const signData = querystring.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    const calculatedHash = hmac
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    // Kiểm tra chữ ký
    if (secureHash !== calculatedHash) {
      throw new Error("Chữ ký không hợp lệ");
    }

    // Kiểm tra mã giao dịch
    if (Number(amount) !== Number(order.totalAmount) * 100) {
      throw new Error("Số tiền không khớp");
    }

    // Xác định trạng thái thanh toán
    const isSuccess = responseCode === "00" && transactionStatus === "00";
    const newStatus = isSuccess ? "paid" : "failed";

    // Cập nhật trạng thái thanh toán
    const updatedPayment = await paymentService.updatePaymentStatus(
      order._id,
      newStatus,
      {
        vnpResponse: vnpResponse,
        vnpResponseCode: responseCode,
        vnpTransactionStatus: transactionStatus,
      }
    );

    return {
      success: isSuccess,
      message: isSuccess ? "Thanh toán thành công" : "Thanh toán thất bại",
      order: order,
      paymentStatus: newStatus,
    };
  },

  /**
   * Lấy thông tin thanh toán theo mã
   * @param {String} paymentCode - Mã thanh toán
   * @returns {Object} - Thông tin thanh toán
   */
  getPaymentByCode: async (paymentCode) => {
    const order = await Order.findOne({ paymentCode });
    if (!order) {
      return null;
    }

    return {
      order: order._id,
      amount: order.totalAmount,
      method: order.paymentMethod,
      status: order.paymentStatus,
      paymentCode: order.paymentCode,
      details: order.paymentInfo,
    };
  },
};

module.exports = paymentService;
