const Order = require("../models/order.model");
const Payment = require("../models/payment.model");
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

    // Tạo đối tượng thanh toán mới
    const payment = await Payment.create({
      order: orderId,
      amount,
      method,
      status,
      paymentCode,
      details,
    });

    // Cập nhật thông tin thanh toán trong đơn hàng
    order.payment = payment._id;
    order.paymentMethod = method;
    order.paymentStatus = status;
    await order.save();

    return payment;
  },

  /**
   * Cập nhật trạng thái thanh toán
   * @param {String} paymentId - ID thanh toán
   * @param {String} status - Trạng thái mới
   * @param {Object} details - Thông tin chi tiết bổ sung
   * @returns {Object} - Thông tin thanh toán đã cập nhật
   */
  updatePaymentStatus: async (paymentId, status, details = {}) => {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new Error("Không tìm thấy thanh toán");
    }

    // Cập nhật trạng thái thanh toán
    payment.status = status;

    // Thêm thông tin chi tiết nếu có
    if (Object.keys(details).length > 0) {
      payment.details = { ...payment.details, ...details };
    }

    // Ghi nhận thời gian hoàn thành nếu thanh toán thành công
    if (status === "completed") {
      payment.completedAt = new Date();
    }

    await payment.save();

    // Cập nhật trạng thái thanh toán trong đơn hàng
    const order = await Order.findById(payment.order);
    if (order) {
      order.paymentStatus = status;
      await order.save();
    }

    return payment;
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
      method: "vnpay",
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
      paymentId: payment._id,
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
    const payment = await Payment.findOne({ paymentCode });
    if (!payment) {
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
    if (Number(amount) !== Number(payment.amount) * 100) {
      throw new Error("Số tiền không khớp");
    }

    // Xác định trạng thái thanh toán
    const isSuccess = responseCode === "00" && transactionStatus === "00";
    const newStatus = isSuccess ? "completed" : "failed";

    // Cập nhật trạng thái thanh toán
    const updatedPayment = await paymentService.updatePaymentStatus(
      payment._id,
      newStatus,
      {
        vnpResponse: vnpResponse,
        verifiedAt: new Date(),
      }
    );

    return {
      success: isSuccess,
      payment: updatedPayment,
      message: isSuccess ? "Thanh toán thành công" : "Thanh toán thất bại",
    };
  },

  /**
   * Lấy thông tin thanh toán
   * @param {String} paymentId - ID thanh toán
   * @returns {Object} - Thông tin thanh toán
   */
  getPaymentById: async (paymentId) => {
    const payment = await Payment.findById(paymentId).populate({
      path: "order",
      select: "orderCode totalAmount user",
      populate: {
        path: "user",
        select: "name email phone",
      },
    });

    if (!payment) {
      throw new Error("Không tìm thấy thanh toán");
    }

    return payment;
  },

  /**
   * Lấy danh sách thanh toán
   * @param {Object} queryOptions - Các tùy chọn truy vấn
   * @returns {Array} - Danh sách thanh toán
   */
  getPayments: async (queryOptions = {}) => {
    const { status, method, page = 1, limit = 10 } = queryOptions;

    const query = {};
    if (status) query.status = status;
    if (method) query.method = method;

    const skip = (Number(page) - 1) * Number(limit);

    const payments = await Payment.find(query)
      .populate({
        path: "order",
        select: "orderCode totalAmount user",
        populate: {
          path: "user",
          select: "name email",
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Payment.countDocuments(query);

    return {
      payments,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    };
  },
};

module.exports = paymentService;
