const express = require("express");
const { protect } = require("../middlewares/auth.middleware");
const {
  createPaymentUrl,
  vnpayReturn,
  vnpayIpn,
  retryPayment,
} = require("../controllers/payment.controller");

const router = express.Router();

// Routes công khai (không yêu cầu xác thực)
// Cho phép VNPay gọi callback và redirect người dùng
router.get("/vnpay_ipn", vnpayIpn);
router.get("/vnpay_return", vnpayReturn); // Không yêu cầu xác thực vì VNPay redirect người dùng về url này

// Routes yêu cầu xác thực
router.use(protect);

router.post("/create_payment_url", createPaymentUrl);
router.post("/retry", retryPayment);

module.exports = router;
