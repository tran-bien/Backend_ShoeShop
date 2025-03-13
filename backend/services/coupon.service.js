const Coupon = require("../models/coupon.model");
const User = require("../models/user.model");
const paginationService = require("./pagination.service");

const couponService = {
  /**
   * Lấy danh sách mã giảm giá của người dùng hiện tại
   * @param {String} userId - ID người dùng
   * @param {Object} queryParams - Query parameters
   * @returns {Object} - Danh sách mã giảm giá
   */
  getUserCoupons: async (userId, queryParams) => {
    // Lấy thông tin người dùng và populate coupons
    const user = await User.findById(userId).populate({
      path: "coupons",
      match: { isActive: true, expiryDate: { $gt: new Date() } },
    });

    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    return user.coupons || [];
  },

  /**
   * Thu thập mã giảm giá cho người dùng
   * @param {String} userId - ID người dùng
   * @param {String} couponCode - Mã giảm giá
   * @returns {Object} - Thông tin kết quả
   */
  collectCoupon: async (userId, couponCode) => {
    // Tìm mã giảm giá
    const coupon = await Coupon.findOne({
      code: couponCode,
      isActive: true,
      expiryDate: { $gt: new Date() },
    });

    if (!coupon) {
      return {
        success: false,
        message: "Mã giảm giá không hợp lệ hoặc đã hết hạn",
      };
    }

    // Tìm người dùng
    const user = await User.findById(userId);
    if (!user) {
      return { success: false, message: "Không tìm thấy người dùng" };
    }

    // Kiểm tra xem người dùng đã có mã giảm giá này chưa
    if (
      user.coupons &&
      user.coupons.some((c) => c.toString() === coupon._id.toString())
    ) {
      return { success: false, message: "Bạn đã thu thập mã giảm giá này rồi" };
    }

    // Thêm mã giảm giá vào danh sách của người dùng
    if (!user.coupons) {
      user.coupons = [];
    }

    user.coupons.push(coupon._id);
    await user.save();

    return {
      success: true,
      message: "Đã thu thập mã giảm giá thành công",
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        expiryDate: coupon.expiryDate,
        description: coupon.description,
      },
    };
  },

  /**
   * Xác minh tính hợp lệ của mã giảm giá
   * @param {String} couponCode - Mã giảm giá
   * @param {String} userId - ID người dùng
   * @param {Number} orderValue - Giá trị đơn hàng (tùy chọn)
   * @returns {Object} - Thông tin kết quả xác minh
   */
  verifyCoupon: async (couponCode, userId, orderValue = 0) => {
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
    if (coupon.usedBy && coupon.usedBy.includes(userId)) {
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
    if (
      orderValue > 0 &&
      coupon.minOrderValue > 0 &&
      orderValue < coupon.minOrderValue
    ) {
      return {
        valid: false,
        message: `Mã giảm giá chỉ áp dụng cho đơn hàng từ ${coupon.minOrderValue.toLocaleString()} đ`,
        minOrderValue: coupon.minOrderValue,
      };
    }

    // Tính giá trị giảm giá nếu có orderValue
    let discountAmount = 0;
    if (orderValue > 0) {
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
    }

    // Trả về kết quả
    return {
      valid: true,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountAmount: coupon.maxDiscountAmount,
        minOrderValue: coupon.minOrderValue,
        expiryDate: coupon.expiryDate,
        description: coupon.description,
      },
      discount: discountAmount,
      message: "Mã giảm giá hợp lệ",
    };
  },
};

module.exports = couponService;
