const Order = require("../models/order.model");
const Product = require("../models/product.model");
const Coupon = require("../models/coupon.model");
const mongoose = require("mongoose");
const paginationService = require("./pagination.service");

const orderService = {
  /**
   * Tính phí vận chuyển dựa trên giá trị đơn hàng
   * @param {Number} orderValue - Tổng giá trị đơn hàng (chưa tính phí vận chuyển)
   * @returns {Number} - Phí vận chuyển
   */
  calculateShippingFee: (orderValue) => {
    // Nếu đơn hàng trên 500k, miễn phí vận chuyển
    if (orderValue >= 500000) {
      return 0;
    }

    // Nếu đơn hàng trên 300k, giảm phí vận chuyển còn 15k
    if (orderValue >= 300000) {
      return 15000;
    }

    // Đơn hàng dưới 300k, phí vận chuyển là 30k
    return 30000;
  },

  /**
   * Kiểm tra và tính toán mã giảm giá
   * @param {String} couponCode - Mã giảm giá
   * @param {Number} orderValue - Tổng giá trị đơn hàng (chưa tính phí vận chuyển)
   * @param {String} userId - ID người dùng
   * @returns {Object} - Kết quả kiểm tra mã giảm giá
   */
  validateCoupon: async (couponCode, orderValue, userId) => {
    // Tìm mã giảm giá
    const coupon = await Coupon.findOne({
      code: { $regex: new RegExp(`^${couponCode}$`, "i") },
      isActive: true,
      expiryDate: { $gt: new Date() },
    });

    // Kiểm tra mã giảm giá có tồn tại không
    if (!coupon) {
      return {
        valid: false,
        message: "Mã giảm giá không tồn tại hoặc đã hết hạn",
      };
    }

    // Kiểm tra xem mã giảm giá đã được sử dụng bởi người dùng này chưa
    if (coupon.usedBy.includes(userId)) {
      return {
        valid: false,
        message: "Bạn đã sử dụng mã giảm giá này rồi",
      };
    }

    // Kiểm tra giới hạn số lần sử dụng
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      return {
        valid: false,
        message: "Mã giảm giá đã hết lượt sử dụng",
      };
    }

    // Kiểm tra điều kiện áp dụng (giá trị tối thiểu)
    if (coupon.minOrderValue > 0 && orderValue < coupon.minOrderValue) {
      return {
        valid: false,
        message: `Mã giảm giá chỉ áp dụng cho đơn hàng từ ${coupon.minOrderValue.toLocaleString()} đ`,
      };
    }

    // Tính giá trị giảm giá
    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      // Giảm theo phần trăm
      discountAmount = (orderValue * coupon.discountValue) / 100;

      // Áp dụng giới hạn giảm nếu có
      if (
        coupon.maxDiscountAmount > 0 &&
        discountAmount > coupon.maxDiscountAmount
      ) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else {
      // Giảm cố định
      discountAmount = coupon.discountValue;

      // Đảm bảo số tiền giảm không vượt quá giá trị đơn hàng
      if (discountAmount > orderValue) {
        discountAmount = orderValue;
      }
    }

    return {
      valid: true,
      discount: discountAmount,
      coupon,
    };
  },
};

module.exports = orderService;
