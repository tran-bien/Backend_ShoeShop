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
   * @returns {Object} - Danh sách thanh toán và thông tin phân trang
   */
  getPayments: async (queryOptions = {}) => {
    const { page = 1, limit = 10, status, method, search } = queryOptions;

    // Xây dựng điều kiện truy vấn
    const query = {};
    if (status) query.status = status;
    if (method) query.method = method;
    if (search) {
      query.$or = [
        { paymentCode: { $regex: search, $options: "i" } },
        { "details.orderInfo": { $regex: search, $options: "i" } },
      ];
    }

    // Thực hiện truy vấn với phân trang
    const total = await Payment.countDocuments(query);
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
      .skip((page - 1) * limit)
      .limit(limit);

    // Trả về kết quả với thông tin phân trang
    return {
      payments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  },

  /**
   * Xử lý thông báo tức thời (IPN) từ VNPay
   * @param {Object} vnpParams - Tham số từ VNPay
   * @returns {Object} - Kết quả xử lý IPN
   */
  handleVnpayIpn: async (vnpParams) => {
    const secureHash = vnpParams["vnp_SecureHash"];

    // Xóa các trường không cần thiết
    delete vnpParams["vnp_SecureHash"];
    delete vnpParams["vnp_SecureHashType"];

    // Sắp xếp đúng thứ tự
    const sortedParams = paymentService.sortObject(vnpParams);

    // Tạo chữ ký để xác thực
    const secretKey = process.env.VNP_HASH_SECRET;
    const signData = querystring.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    // Kiểm tra chữ ký
    if (secureHash !== signed) {
      return {
        RspCode: "97",
        Message: "Invalid Signature",
      };
    }

    const orderId = vnpParams["vnp_TxnRef"];
    const rspCode = vnpParams["vnp_ResponseCode"];

    // Tìm thanh toán theo mã giao dịch
    const payment = await Payment.findOne({ paymentCode: orderId });
    if (!payment) {
      return {
        RspCode: "01",
        Message: "Payment not found",
      };
    }

    // Tìm đơn hàng liên quan
    const order = await Order.findById(payment.order);
    if (!order) {
      return {
        RspCode: "01",
        Message: "Order not found",
      };
    }

    // Kiểm tra số tiền thanh toán
    const vnpAmount = vnpParams["vnp_Amount"] / 100; // VNPay trả về số tiền * 100
    if (vnpAmount !== order.totalAmount) {
      return {
        RspCode: "04",
        Message: "Invalid amount",
      };
    }

    // Nếu thanh toán đã được xử lý trước đó, không xử lý lại
    if (payment.details.vnpTransactionNo === vnpParams["vnp_TransactionNo"]) {
      return {
        RspCode: "02",
        Message: "Payment already confirmed",
      };
    }

    // Cập nhật thông tin thanh toán
    payment.details = {
      ...payment.details,
      vnpTransactionNo: vnpParams["vnp_TransactionNo"],
      vnpResponseData: vnpParams,
    };

    if (rspCode === "00") {
      // Thanh toán thành công
      payment.status = "success";
      order.paymentStatus = "paid";

      // Nếu đơn hàng đang ở trạng thái pending, chuyển sang confirmed
      if (order.status === "pending") {
        order.status = "confirmed";
      }
    } else {
      // Thanh toán thất bại
      payment.status = "failed";
      order.paymentStatus = "failed";
    }

    // Lưu thay đổi
    await payment.save();
    await order.save();

    return {
      RspCode: "00",
      Message: "Confirm Success",
    };
  },

  /**
   * Xử lý callback thanh toán từ VNPay (cho frontend)
   * @param {Object} vnpParams - Tham số từ VNPay
   * @param {Object} notificationService - Service để tạo thông báo
   * @returns {Object} - Kết quả xử lý callback
   */
  handlePaymentCallback: async (vnpParams, notificationService) => {
    const secureHash = vnpParams["vnp_SecureHash"];

    // Xóa các trường không cần thiết
    delete vnpParams["vnp_SecureHash"];
    delete vnpParams["vnp_SecureHashType"];

    // Sắp xếp đúng thứ tự
    const sortedParams = paymentService.sortObject(vnpParams);

    // Tạo chữ ký để xác thực
    const secretKey = process.env.VNP_HASH_SECRET;
    const signData = querystring.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    // Kiểm tra chữ ký
    if (secureHash !== signed) {
      return {
        success: false,
        message: "Chữ ký không hợp lệ",
        redirectUrl: `${process.env.FRONTEND_URL}/payment/failed?error=invalid_signature`,
      };
    }

    const orderId = vnpParams["vnp_OrderInfo"];
    const transactionId = vnpParams["vnp_TransactionNo"];
    const amount = vnpParams["vnp_Amount"] / 100;
    const responseCode = vnpParams["vnp_ResponseCode"];

    // Tìm đơn hàng
    const order = await Order.findById(orderId);
    if (!order) {
      return {
        success: false,
        message: "Không tìm thấy đơn hàng",
        redirectUrl: `${process.env.FRONTEND_URL}/payment/failed?error=order_not_found`,
      };
    }

    // Tạo hoặc cập nhật thanh toán
    let payment = await Payment.findOne({ order: order._id });
    if (!payment) {
      payment = await paymentService.createPayment({
        orderId: order._id,
        amount,
        method: "VNPAY",
        status: responseCode === "00" ? "success" : "failed",
        details: {
          vnpResponseData: vnpParams,
          transactionId,
        },
      });
    } else {
      payment.status = responseCode === "00" ? "success" : "failed";
      payment.details = {
        ...payment.details,
        vnpResponseData: vnpParams,
        transactionId,
      };
      await payment.save();
    }

    // Xử lý thành công
    if (responseCode === "00") {
      // Cập nhật trạng thái đơn hàng
      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentStatus = "paid";
      order.paymentResult = {
        id: transactionId,
        status: "success",
        update_time: Date.now(),
        email_address: order.user ? order.user.email : "unknown",
      };

      // Nếu đơn hàng đang ở trạng thái pending, chuyển sang confirmed
      if (order.status === "pending") {
        order.status = "confirmed";
      }

      await order.save();

      // Tạo thông báo thanh toán thành công
      if (notificationService && order.userId) {
        await notificationService.createNotification({
          userId: order.userId,
          title: "Thanh toán thành công",
          message: `Đơn hàng ${order._id} đã được thanh toán thành công.`,
          type: "order",
          referenceId: order._id,
        });
      }

      return {
        success: true,
        message: "Thanh toán thành công",
        order,
        payment,
        redirectUrl: `${process.env.FRONTEND_URL}/payment/success?orderId=${orderId}`,
      };
    }
    // Xử lý thất bại
    else {
      // Cập nhật thông tin đơn hàng khi thanh toán thất bại
      order.paymentStatus = "failed";
      order.paymentResult = {
        id: transactionId,
        status: "failed",
        update_time: Date.now(),
        email_address: order.user ? order.user.email : "unknown",
        error_message: `Mã lỗi: ${responseCode}`,
      };
      await order.save();

      // Tạo thông báo thanh toán thất bại
      if (notificationService && order.userId) {
        await notificationService.createNotification({
          userId: order.userId,
          title: "Thanh toán thất bại",
          message: `Đơn hàng ${order._id} thanh toán không thành công. Vui lòng thử lại.`,
          type: "order",
          referenceId: order._id,
        });
      }

      return {
        success: false,
        message: "Thanh toán thất bại",
        order,
        payment,
        redirectUrl: `${process.env.FRONTEND_URL}/payment/failed?orderId=${orderId}&code=${responseCode}`,
      };
    }
  },

  /**
   * Thử lại thanh toán cho đơn hàng
   * @param {String} orderId - ID đơn hàng
   * @param {Object} options - Các tùy chọn thanh toán (bankCode, language)
   * @param {Object} req - Request object
   * @returns {Object} - URL thanh toán mới
   */
  retryPayment: async (orderId, options, req) => {
    // Tìm đơn hàng
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Không tìm thấy đơn hàng");
    }

    // Kiểm tra trạng thái đơn hàng
    if (
      order.paymentMethod !== "VNPAY" ||
      (order.status !== "pending" && order.paymentStatus !== "failed")
    ) {
      throw new Error(
        "Đơn hàng không thể thanh toán lại ở trạng thái hiện tại"
      );
    }

    // Tạo mã thanh toán mới
    const paymentCode = paymentService.generatePaymentCode();

    // Tạo hoặc cập nhật thanh toán
    let payment = await Payment.findOne({
      order: order._id,
      status: { $ne: "success" },
    });
    if (!payment) {
      payment = await paymentService.createPayment({
        orderId: order._id,
        amount: order.totalAmount,
        method: "VNPAY",
        status: "pending",
        details: {
          orderInfo: `Thanh toan lai don hang: ${order._id}`,
          paymentCode,
        },
      });
    } else {
      payment.status = "pending";
      payment.paymentCode = paymentCode;
      payment.details = {
        ...payment.details,
        orderInfo: `Thanh toan lai don hang: ${order._id}`,
        retryAt: new Date(),
      };
      await payment.save();
    }

    // Cập nhật đơn hàng
    order.paymentStatus = "pending";
    await order.save();

    // Tạo URL thanh toán mới
    const { bankCode, language } = options;
    const result = await paymentService.createVnpayPaymentUrl(
      {
        orderId: order._id,
        amount: order.totalAmount,
        orderInfo: `Thanh toan lai don hang: ${order._id}`,
        bankCode,
        language,
      },
      req
    );

    return result;
  },
};

module.exports = paymentService;
