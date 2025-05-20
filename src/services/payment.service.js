const crypto = require("crypto");
const moment = require('moment');
const querystring = require("querystring");
const { Order } = require("@models");
const ApiError = require("@utils/ApiError");

/**
 * Sắp xếp đối tượng theo key
 * @param {Object} obj - Đối tượng cần sắp xếp
 * @returns {Object} - Đối tượng đã sắp xếp
 */
const sortObject = (obj) => {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  keys.forEach(key => {
    sorted[key] = obj[key];
  });
  return sorted;
};

const paymentService = {
  createVnpayPaymentUrl: async (paymentData) => {
    try {
      const { orderId, amount, returnUrl } = paymentData;
      
      // Kiểm tra đơn hàng trước
      const order = await Order.findById(orderId);
      if (!order) {
        throw new ApiError(404, "Không tìm thấy đơn hàng");
      }
      if (order.payment.paymentStatus === "paid") {
        throw new ApiError(400, "Đơn hàng này đã được thanh toán");
      }
  
      // Cấu hình VNPAY
      const vnp_TmnCode = process.env.VNP_TMN_CODE;
      const vnp_HashSecret = process.env.VNP_HASH_SECRET;
      const vnp_Url = process.env.VNP_URL;
      const vnp_ReturnUrl = returnUrl || process.env.VNP_RETURN_URL;
  
      // Tạo ngày tháng theo định dạng
      const date = new Date();
      const createDate = moment(date).format('YYYYMMDDHHmmss'); // Sử dụng moment.js
  
      // Tạo mã giao dịch
      const randomAttempt = Math.floor(100000 + Math.random() * 900000);
      const vnp_TxnRef = `T${randomAttempt}`; // Đơn giản hóa mã giao dịch
  
      // Chuẩn bị tham số với số tiền nhỏ cho test
      const vnp_Params = {
        vnp_Version: '2.0.0',
        vnp_Command: 'pay',
        vnp_TmnCode: vnp_TmnCode,
        vnp_Locale: 'vn',
        vnp_CurrCode: 'VND',
        vnp_TxnRef: vnp_TxnRef,
        vnp_OrderInfo: 'Thanh toan don hang test',
        vnp_OrderType: 'other',
        vnp_Amount: amount * 100,
        vnp_ReturnUrl: vnp_ReturnUrl,
        vnp_IpAddr: '127.0.0.1',
        vnp_CreateDate: createDate
      };
  
      // Sắp xếp các tham số theo thứ tự ABC
      const sortedParams = {};
      Object.keys(vnp_Params)
        .sort()
        .forEach(key => {
          sortedParams[key] = vnp_Params[key];
        });
  
      // Tạo chuỗi ký
      let signData = '';
      Object.keys(sortedParams).forEach((key, index) => {
        if (index > 0) signData += '&';
        signData += `${key}=${sortedParams[key]}`;
      });
  
      // Tạo chữ ký
      const hmac = crypto.createHmac('sha512', vnp_HashSecret);
      const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
      
      // Tạo URL đầy đủ thủ công
      let finalUrl = vnp_Url + '?';
      let idx = 0;
      
      Object.keys(sortedParams).forEach(key => {
        if (idx > 0) finalUrl += '&';
        finalUrl += `${key}=${encodeURIComponent(sortedParams[key])}`;
        idx++;
      });
      
      // Thêm chữ ký vào URL
      finalUrl += `&vnp_SecureHash=${signed}`;
      
      console.log("VNPAY URL created manually:", finalUrl);
  
      // Lưu mã giao dịch vào đơn hàng
      try {
        order.tempPaymentRef = vnp_TxnRef;
        await order.save();
        console.log(`Đã liên kết mã giao dịch ${vnp_TxnRef} với đơn hàng ${order.code}`);
      } catch (err) {
        console.error("Không thể cập nhật đơn hàng:", err);
      }
  
      return finalUrl;
    } catch (error) {
      console.error("Lỗi khi tạo URL thanh toán:", error);
      throw error;
    }
  },

  /**
   * Xác minh callback từ VNPAY
   * @param {Object} vnpayParams - Các tham số trả về từ VNPAY
   * @returns {Object} - Kết quả xác minh
   */
  verifyVnpayReturn: (vnpayParams) => {
    try {
      // Lấy các tham số cấu hình
      const vnp_HashSecret = process.env.VNP_HASH_SECRET;
      const secureHash = vnpayParams.vnp_SecureHash;
      
      // Log dữ liệu nhận về để debug
      console.log("VNPAY Return Params:", JSON.stringify(vnpayParams));

      // Xóa chữ ký khỏi đối tượng tham số
      delete vnpayParams.vnp_SecureHash;
      delete vnpayParams.vnp_SecureHashType;

      // Sắp xếp các tham số theo thứ tự chữ cái
      const sortedParams = sortObject(vnpayParams);

      // Tạo chuỗi cần ký
      const signData = querystring.stringify(sortedParams, { encode: false });

      // Tạo chữ ký để so sánh
      const hmac = crypto.createHmac("sha512", vnp_HashSecret);
      const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

      // So sánh chữ ký
      if (secureHash === signed) {
        // Kiểm tra trạng thái thanh toán
        const responseCode = vnpayParams.vnp_ResponseCode;
        return {
          success: responseCode === "00",
          message:
            responseCode === "00"
              ? "Thanh toán thành công"
              : "Thanh toán thất bại",
          data: vnpayParams,
        };
      } else {
        return {
          success: false,
          message: "Chữ ký không hợp lệ",
          data: vnpayParams,
        };
      }
    } catch (error) {
      console.error("Lỗi xử lý callback VNPAY:", error);
      return {
        success: false,
        message: error.message || "Lỗi xử lý dữ liệu thanh toán",
        data: vnpayParams,
      };
    }
  },

  /**
   * Xử lý kết quả thanh toán và cập nhật đơn hàng
   * @param {Object} vnpayParams - Các tham số trả về từ VNPAY
   * @returns {Object} - Kết quả xử lý
   */
  processPaymentResult: async (vnpayParams) => {
    try {
      // Kiểm tra và xác minh tính hợp lệ của callback
      const verifyResult = paymentService.verifyVnpayReturn(vnpayParams);

      if (!verifyResult.success) {
        return verifyResult;
      }

      // Tìm đơn hàng dựa trên mã giao dịch tạm thời
      let order = null;
      
      if (vnpayParams.vnp_TxnRef) {
        // Tìm đơn hàng có tempPaymentRef trùng với vnp_TxnRef
        order = await Order.findOne({ tempPaymentRef: vnpayParams.vnp_TxnRef });
      }
      
      // Nếu không tìm thấy theo mã giao dịch, lấy đơn hàng mới nhất
      if (!order) {
        const pendingOrders = await Order.find({
          "payment.paymentStatus": "pending",
          "payment.method": "VNPAY"
        }).sort({ createdAt: -1 }).limit(1);
        
        if (pendingOrders.length > 0) {
          order = pendingOrders[0];
        }
      }

      if (!order) {
        return {
          success: false,
          message: "Không tìm thấy đơn hàng",
          data: vnpayParams,
        };
      }

      // Kiểm tra xem đơn hàng đã được thanh toán chưa
      if (order.payment.paymentStatus === "paid") {
        return {
          success: true,
          message: "Đơn hàng đã được thanh toán trước đó",
          data: {
            orderId: order._id,
            amount: order.totalAfterDiscountAndShipping,
            paymentStatus: order.payment.paymentStatus,
          },
        };
      }

      // Cập nhật trạng thái đơn hàng dựa trên kết quả thanh toán
      const responseCode = vnpayParams.vnp_ResponseCode;
      const transactionId = vnpayParams.vnp_TransactionNo || vnpayParams.vnp_TxnRef;

      // Cập nhật thông tin thanh toán
      order.payment.transactionId = transactionId;
      order.payment.paymentStatus = responseCode === "00" ? "paid" : "failed";
      
      if (responseCode === "00") {
        order.payment.paidAt = new Date();
      }

      // Đảm bảo mảng paymentHistory tồn tại
      if (!order.paymentHistory) {
        order.paymentHistory = [];
      }

      // Thêm vào lịch sử thanh toán
      order.paymentHistory.push({
        status: order.payment.paymentStatus,
        transactionId: transactionId,
        amount: order.totalAfterDiscountAndShipping,
        method: order.payment.method,
        updatedAt: new Date(),
        responseData: vnpayParams,
      });

      // Nếu thanh toán thành công và đơn hàng đang ở trạng thái pending
      if (responseCode === "00" && order.status === "pending") {
        order.status = "confirmed";
        order.confirmedAt = new Date();

        // Thêm vào lịch sử trạng thái
        order.statusHistory.push({
          status: "confirmed",
          updatedAt: new Date(),
          note: "Tự động xác nhận sau khi thanh toán thành công",
        });
      }

      // Lưu đơn hàng
      await order.save();

      return {
        success: true,
        message:
          responseCode === "00"
            ? "Thanh toán thành công"
            : "Thanh toán thất bại",
        data: {
          orderId: order._id,
          amount: order.totalAfterDiscountAndShipping,
          paymentStatus: order.payment.paymentStatus,
          orderStatus: order.status,
        },
      };
    } catch (error) {
      console.error("Lỗi xử lý kết quả thanh toán:", error);
      return {
        success: false,
        message: error.message || "Lỗi xử lý kết quả thanh toán",
        data: vnpayParams,
      };
    }
  },

  /**
   * Xử lý và verify kết quả thanh toán từ VNPAY callback
   * @param {Object} vnpParams - Tham số từ VNPAY
   * @returns {Object} - Kết quả xử lý thanh toán
   */
  processVnpayReturn: async (vnpParams) => {
    try {
      console.log("VNPAY Return Callback:", JSON.stringify(vnpParams));
      
      // Xử lý kết quả thanh toán
      const paymentResult = await paymentService.processPaymentResult(vnpParams);
      
      return {
        success: paymentResult.success,
        message: paymentResult.message,
        orderId: paymentResult.data?.orderId || null
      };
    } catch (error) {
      console.error("Lỗi xử lý callback VNPAY:", error);
      return {
        success: false,
        message: "Có lỗi xảy ra khi xử lý thanh toán",
        orderId: null
      };
    }
  },

  /**
   * Xử lý thông báo tự động từ VNPAY (IPN)
   * @param {Object} vnpParams - Tham số từ VNPAY
   * @returns {Object} - Kết quả xử lý
   */
  processVnpayIpn: async (vnpParams) => {
    try {
      console.log("VNPAY IPN Received:", JSON.stringify(vnpParams));
      
      // Xử lý kết quả thanh toán
      const paymentResult = await paymentService.processPaymentResult(vnpParams);
      
      return {
        RspCode: paymentResult.success ? "00" : "99",
        Message: paymentResult.success ? "Confirmed" : "Failed"
      };
    } catch (error) {
      console.error("Lỗi xử lý IPN VNPAY:", error);
      return {
        RspCode: "99",
        Message: "Failed"
      };
    }
  },

  /**
   * Tạo URL thanh toán lại cho đơn hàng
   * @param {String} orderId - ID đơn hàng cần thanh toán lại
   * @param {String} ipAddr - IP của người dùng
   * @param {String} returnUrl - URL callback sau khi thanh toán
   * @returns {Object} - Thông tin URL thanh toán và kết quả
   */
  createRepaymentUrl: async (orderId, ipAddr, returnUrl) => {
    try {
      // Tìm đơn hàng trong cơ sở dữ liệu
      const order = await Order.findById(orderId);

      if (!order) {
        throw new ApiError(404, "Không tìm thấy đơn hàng");
      }

      // Kiểm tra phương thức thanh toán
      if (order.payment.method !== "VNPAY") {
        throw new ApiError(400, "Đơn hàng này không sử dụng phương thức VNPAY");
      }

      // Kiểm tra trạng thái đơn hàng
      if (!["pending", "confirmed"].includes(order.status)) {
        throw new ApiError(
          400,
          "Không thể thanh toán lại đơn hàng ở trạng thái này"
        );
      }
      
      // Kiểm tra nếu đơn hàng có yêu cầu hủy đang chờ xử lý
      if (order.hasCancelRequest) {
        throw new ApiError(
          400,
          "Đơn hàng có yêu cầu hủy đang chờ xử lý, không thể thanh toán lại"
        );
      }

      // Kiểm tra trạng thái thanh toán
      if (order.payment.paymentStatus === "paid") {
        throw new ApiError(400, "Đơn hàng này đã được thanh toán");
      }

      // Tạo URL thanh toán
      const paymentUrl = await paymentService.createVnpayPaymentUrl({
        orderId: order._id,
        amount: 10000, // Sử dụng số tiền nhỏ để test
        orderInfo: `Thanh toan don hang ${order.code}`,
        ipAddr: ipAddr || "127.0.0.1",
        returnUrl: returnUrl,
      });

      return {
        success: true,
        message: "Đã tạo URL thanh toán lại",
        data: {
          paymentUrl,
          order: {
            _id: order._id,
            code: order.code,
            totalAmount: order.totalAfterDiscountAndShipping,
          },
        },
      };
    } catch (error) {
      console.error("Lỗi tạo URL thanh toán lại:", error);
      throw error;
    }
  },
};

module.exports = paymentService;