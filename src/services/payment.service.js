const crypto = require("crypto");
const querystring = require("querystring");
const { Order } = require("@models");
const ApiError = require("@utils/ApiError");
/**
 * Format ngày theo định dạng yyyyMMddHHmmss
 * @param {Date} date - Đối tượng ngày cần định dạng
 * @returns {String} - Chuỗi ngày đã định dạng
 */
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const paymentService = {
  /**
   * Tạo URL thanh toán VNPAY
   * @param {Object} paymentData - Thông tin thanh toán
   * @param {String} paymentData.orderId - ID đơn hàng
   * @param {Number} paymentData.amount - Số tiền thanh toán
   * @param {String} paymentData.orderInfo - Mô tả đơn hàng
   * @param {String} paymentData.ipAddr - IP của người dùng
   * @param {String} paymentData.returnUrl - URL callback sau khi thanh toán
   * @returns {String} - URL thanh toán VNPAY
   */
  createVnpayPaymentUrl: async (paymentData) => {
    try {
      const { orderId, amount, orderInfo, ipAddr, returnUrl } = paymentData;

      // Cấu hình VNPAY từ biến môi trường
      const vnp_TmnCode = process.env.VNP_TMN_CODE;
      const vnp_HashSecret = process.env.VNP_HASH_SECRET;
      const vnp_Url = process.env.VNP_URL;
      const vnp_ReturnUrl = returnUrl || process.env.VNP_RETURN_URL;

      // Kiểm tra cấu hình
      if (!vnp_TmnCode || !vnp_HashSecret || !vnp_Url || !vnp_ReturnUrl) {
        throw new ApiError(500, "Thiếu cấu hình thanh toán VNPAY");
      }

      // Tạo đối tượng tham số cho VNPAY
      const date = new Date();
      const createDate = formatDate(date);
      const vnpOrderId = `${orderId}_${createDate}`;

      // Chuyển đổi số tiền sang đơn vị VND (*100 để loại bỏ phần thập phân)
      const amountVnd = Math.round(amount);

      const vnpParams = {
        vnp_Version: "2.1.0",
        vnp_Command: "pay",
        vnp_TmnCode: vnp_TmnCode,
        vnp_Locale: "vn",
        vnp_CurrCode: "VND",
        vnp_TxnRef: vnpOrderId,
        vnp_OrderInfo: orderInfo || `Thanh toán đơn hàng ${orderId}`,
        vnp_OrderType: "billpayment",
        vnp_Amount: amountVnd * 100, // Nhân 100 theo yêu cầu của VNPAY
        vnp_ReturnUrl: vnp_ReturnUrl,
        vnp_IpAddr: ipAddr || "127.0.0.1",
        vnp_CreateDate: createDate,
      };

      // Sắp xếp các tham số theo thứ tự chữ cái a-z
      const sortedParams = {};
      Object.keys(vnpParams)
        .sort()
        .forEach((key) => {
          sortedParams[key] = vnpParams[key];
        });

      // Tạo chuỗi ký tự cần ký
      const signData = querystring.stringify(sortedParams, { encode: false });

      // Tạo chữ ký
      const hmac = crypto.createHmac("sha512", vnp_HashSecret);
      const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

      // Thêm chữ ký vào tham số
      sortedParams.vnp_SecureHash = signed;

      // Tạo URL thanh toán
      const paymentUrl = `${vnp_Url}?${querystring.stringify(sortedParams, {
        encode: true,
      })}`;

      return paymentUrl;
    } catch (error) {
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

      // Xóa chữ ký khỏi đối tượng tham số
      delete vnpayParams.vnp_SecureHash;
      delete vnpayParams.vnp_SecureHashType;

      // Sắp xếp các tham số theo thứ tự chữ cái
      const sortedParams = {};
      Object.keys(vnpayParams)
        .sort()
        .forEach((key) => {
          sortedParams[key] = vnpayParams[key];
        });

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
      // Xác minh tính hợp lệ của callback
      const verifyResult = paymentService.verifyVnpayReturn(vnpayParams);

      if (!verifyResult.success) {
        return verifyResult;
      }

      // Lấy thông tin đơn hàng từ mã giao dịch
      const txnRef = vnpayParams.vnp_TxnRef;
      const orderId = txnRef.split("_")[0];

      // Tìm đơn hàng trong cơ sở dữ liệu
      const order = await Order.findById(orderId);

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
      const transactionId = vnpayParams.vnp_TransactionNo;

      // Cập nhật thông tin thanh toán
      order.payment.transactionId = transactionId;
      order.payment.paymentStatus = responseCode === "00" ? "paid" : "failed";

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
      // Verify chữ ký và tham số từ VNPAY
      const verifyResult = paymentService.verifyVnpayReturn(vnpParams);

      if (!verifyResult.success) {
        return {
          success: false,
          message: verifyResult.message,
          orderId: vnpParams.vnp_TxnRef
            ? vnpParams.vnp_TxnRef.split("_")[0]
            : null,
        };
      }

      // Xử lý kết quả thanh toán
      const paymentResult = await paymentService.processPaymentResult(
        vnpParams
      );

      return {
        success: paymentResult.success,
        message: paymentResult.message,
        orderId: paymentResult.data.orderId,
      };
    } catch (error) {
      console.error("Lỗi xử lý callback VNPAY:", error);
      return {
        success: false,
        message: "Có lỗi xảy ra khi xử lý thanh toán",
        orderId: vnpParams.vnp_TxnRef
          ? vnpParams.vnp_TxnRef.split("_")[0]
          : null,
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
      // Verify chữ ký và tham số từ VNPAY
      const verifyResult = paymentService.verifyVnpayReturn(vnpParams);

      if (!verifyResult.success) {
        return {
          success: false,
          message: "Chữ ký không hợp lệ hoặc dữ liệu không đúng",
        };
      }

      // Xử lý cập nhật thanh toán
      await paymentService.processPaymentResult(vnpParams);

      return {
        success: true,
        message: "IPN đã được xử lý thành công",
      };
    } catch (error) {
      console.error("Lỗi xử lý IPN VNPAY:", error);
      return {
        success: false,
        message: "Có lỗi xảy ra khi xử lý IPN",
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

      // Kiểm tra trạng thái thanh toán
      if (order.payment.paymentStatus === "paid") {
        throw new ApiError(400, "Đơn hàng này đã được thanh toán");
      }

      // Tạo URL thanh toán
      const paymentUrl = await paymentService.createVnpayPaymentUrl({
        orderId: order._id,
        amount: order.totalAfterDiscountAndShipping,
        orderInfo: `Thanh toán lại đơn hàng #${order._id}`,
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
      throw error;
    }
  },
};

module.exports = paymentService;
