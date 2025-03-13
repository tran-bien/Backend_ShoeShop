const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const moment = require("moment");
const querystring = require("qs");
const Order = require("../models/order.model");
const Notification = require("../models/notification.model");
const mongoose = require("mongoose");
const paymentService = require("../services/payment.service");

const vnp_TmnCode = process.env.VNP_TMN_CODE;
const vnp_HashSecret = process.env.VNP_HASH_SECRET;
const vnp_Url = process.env.VNP_URL;
const vnp_ReturnUrl = process.env.VNP_RETURN_URL;
const vnp_IpnUrl = process.env.VNP_IPN_URL;

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
    if (order.userId.toString() !== req.user._id.toString()) {
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
      payment: result.payment,
      order: result.payment.order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi xử lý kết quả thanh toán",
    });
  }
});

// Xử lý thông báo tức thời IPN từ VNPAY (cho backend - không yêu cầu xác thực)
exports.vnpayIpn = asyncHandler(async (req, res) => {
  try {
    let vnp_Params = req.query;
    const secureHash = vnp_Params["vnp_SecureHash"];

    // Xóa các trường không cần thiết
    delete vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHashType"];

    // Sắp xếp đúng thứ tự như VNPay yêu cầu
    vnp_Params = sortObject(vnp_Params);

    // Tạo chữ ký để xác thực
    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", vnp_HashSecret);
    // Sử dụng Buffer.from thay vì Buffer()
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    // Kiểm tra chữ ký
    if (secureHash === signed) {
      const orderId = vnp_Params["vnp_TxnRef"];
      const rspCode = vnp_Params["vnp_ResponseCode"];

      // Tìm đơn hàng theo mã giao dịch VNPay
      const order = await Order.findOne({ paymentCode: orderId });

      if (!order) {
        return res
          .status(200)
          .json({ RspCode: "01", Message: "Order not found" });
      }

      // Kiểm tra số tiền thanh toán
      const vnpAmount = vnp_Params["vnp_Amount"] / 100; // VNPay trả về số tiền * 100
      const orderAmount = order.totalAmount;

      if (vnpAmount !== orderAmount) {
        return res
          .status(200)
          .json({ RspCode: "04", Message: "Invalid amount" });
      }

      // Nếu đơn hàng đã được xử lý trước đó, không xử lý lại
      if (
        order.vnpayTransactionData &&
        order.vnpayTransactionData.vnp_TransactionNo ===
          vnp_Params["vnp_TransactionNo"]
      ) {
        return res
          .status(200)
          .json({ RspCode: "02", Message: "Order already confirmed" });
      }

      if (rspCode === "00") {
        // Cập nhật đơn hàng - thanh toán thành công
        order.paymentStatus = "paid";
        order.vnpayTransactionData = vnp_Params;

        // Nếu đơn hàng đang ở trạng thái pending, chuyển sang confirmed
        if (order.status === "pending") {
          order.status = "confirmed";
        }

        await order.save();

        return res
          .status(200)
          .json({ RspCode: "00", Message: "Confirm Success" });
      } else {
        // Cập nhật đơn hàng - thanh toán thất bại
        order.paymentStatus = "failed";
        order.vnpayTransactionData = vnp_Params;
        await order.save();

        return res
          .status(200)
          .json({ RspCode: "00", Message: "Confirm Success" });
      }
    } else {
      return res
        .status(200)
        .json({ RspCode: "97", Message: "Invalid Signature" });
    }
  } catch (error) {
    console.error("Lỗi khi xử lý IPN từ VNPay:", error);
    return res.status(200).json({ RspCode: "99", Message: "Unknown error" });
  }
});

// Cải thiện xử lý thanh toán thất bại
exports.paymentCallback = asyncHandler(async (req, res) => {
  let vnp_Params = req.query;
  const secureHash = vnp_Params["vnp_SecureHash"];

  // Xóa tham số bảo mật trước khi ký
  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  // Sắp xếp tham số theo thứ tự bảng chữ cái
  vnp_Params = sortObject(vnp_Params);

  // Tạo chuỗi ký
  const signData = querystring.stringify(vnp_Params, { encode: false });
  const hmac = crypto.createHmac("sha512", process.env.VNP_HASH_SECRET);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  // Kiểm tra chữ ký hợp lệ
  if (secureHash === signed) {
    const orderId = vnp_Params["vnp_OrderInfo"];
    const transactionId = vnp_Params["vnp_TransactionNo"];
    const amount = vnp_Params["vnp_Amount"] / 100;
    const responseCode = vnp_Params["vnp_ResponseCode"];

    // Tìm đơn hàng
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).send("Không tìm thấy đơn hàng");
    }

    // Tạo thông tin thanh toán
    const payment = {
      orderId: order._id,
      transactionId: transactionId,
      amount: amount,
      method: "VNPAY",
      status: responseCode === "00" ? "success" : "failed",
      responseData: vnp_Params,
    };

    // Thay vào đó, lưu thông tin thanh toán vào đơn hàng
    order.paymentInfo = payment;

    // Xử lý thành công
    if (responseCode === "00") {
      // Cập nhật trạng thái đơn hàng
      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentResult = {
        id: transactionId,
        status: "success",
        update_time: Date.now(),
        email_address: order.user.email || "unknown",
      };
      order.status = "confirmed"; // Cập nhật trạng thái đơn hàng
      await order.save();

      // Tạo thông báo thanh toán thành công
      await createNotification(
        order.userId,
        "Thanh toán thành công",
        `Đơn hàng ${order._id} đã được thanh toán thành công.`,
        "order",
        order._id
      );

      // Chuyển hướng đến trang thành công
      return res.redirect(
        `${process.env.FRONTEND_URL}/payment/success?orderId=${orderId}`
      );
    }
    // Xử lý thất bại rõ ràng hơn
    else {
      // Cập nhật thông tin đơn hàng khi thanh toán thất bại
      order.paymentResult = {
        id: transactionId,
        status: "failed",
        update_time: Date.now(),
        email_address: order.user.email || "unknown",
        error_message: `Mã lỗi: ${responseCode}`,
      };
      await order.save();

      // Tạo thông báo thanh toán thất bại
      await createNotification(
        order.userId,
        "Thanh toán thất bại",
        `Đơn hàng ${order._id} thanh toán không thành công. Vui lòng thử lại.`,
        "order",
        order._id
      );

      // Chuyển hướng đến trang thất bại với mã lỗi
      return res.redirect(
        `${process.env.FRONTEND_URL}/payment/failed?orderId=${orderId}&code=${responseCode}`
      );
    }
  } else {
    // Chữ ký không hợp lệ
    return res.status(400).send("Chữ ký không hợp lệ");
  }
});

/**
 * @desc    Thanh toán lại đơn hàng
 * @route   POST /api/payments/retry
 * @access  Private
 */
exports.retryPayment = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

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
  if (order.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền thanh toán đơn hàng này",
    });
  }

  // Kiểm tra trạng thái đơn hàng, chỉ cho phép thanh toán lại đơn hàng ở trạng thái chờ thanh toán hoặc thanh toán thất bại
  if (
    order.paymentMethod !== "VNPAY" ||
    (order.status !== "pending" && order.paymentStatus !== "failed")
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Đơn hàng không thể thanh toán lại ở trạng thái hiện tại hoặc không phải phương thức thanh toán VNPAY",
    });
  }

  // Tiếp tục logic tạo URL thanh toán...
  try {
    const date = new Date();
    const createDate = moment(date).format("YYYYMMDDHHmmss");

    const ipAddr = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    const tmnCode = vnp_TmnCode;
    const secretKey = vnp_HashSecret;
    let vnpUrl = vnp_Url;
    const returnUrl = vnp_ReturnUrl;
    const ipnUrl = vnp_IpnUrl;

    // Tạo mã giao dịch mới với format "ORDER_ID_DDHHmmss"
    const vnpOrderId = `${order._id.toString().slice(-8)}_${moment(date).format(
      "DDHHmmss"
    )}`;

    const amount = order.totalAmount;
    const bankCode = req.body.bankCode || "";
    const locale = req.body.language || "vn";

    const currCode = "VND";
    let vnp_Params = {};
    vnp_Params["vnp_Version"] = "2.1.0";
    vnp_Params["vnp_Command"] = "pay";
    vnp_Params["vnp_TmnCode"] = tmnCode;
    vnp_Params["vnp_Locale"] = locale;
    vnp_Params["vnp_CurrCode"] = currCode;
    vnp_Params["vnp_TxnRef"] = vnpOrderId;
    vnp_Params["vnp_OrderInfo"] = `Thanh toan lai don hang: ${order._id}`;
    vnp_Params["vnp_OrderType"] = "other";
    vnp_Params["vnp_Amount"] = amount * 100;
    vnp_Params["vnp_ReturnUrl"] = returnUrl;
    vnp_Params["vnp_IpAddr"] = ipAddr;
    vnp_Params["vnp_CreateDate"] = createDate;
    vnp_Params["vnp_IpnUrl"] = ipnUrl;

    if (bankCode !== null && bankCode !== "") {
      vnp_Params["vnp_BankCode"] = bankCode;
    }

    vnp_Params = sortObject(vnp_Params);

    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
    vnp_Params["vnp_SecureHash"] = signed;
    vnpUrl += "?" + querystring.stringify(vnp_Params, { encode: false });

    // Lưu mã giao dịch vào đơn hàng
    order.paymentCode = vnpOrderId;
    order.paymentStatus = "pending"; // Cập nhật lại trạng thái thanh toán thành "pending"
    await order.save();

    // Trả về URL thanh toán mới
    res.json({
      success: true,
      data: { paymentUrl: vnpUrl },
    });
  } catch (error) {
    console.error("Lỗi khi tạo URL thanh toán:", error);
    res.status(500).json({
      success: false,
      message: "Có lỗi xảy ra khi tạo URL thanh toán",
      error: error.message,
    });
  }
});

// Hàm sắp xếp object theo key
function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    if (obj.hasOwnProperty(key)) {
      sorted[key] = obj[key];
    }
  }
  return sorted;
}
