const asyncHandler = require("express-async-handler");
const Coupon = require("../../models/coupon.model");
const couponService = require("../../services/coupon.service");

// Tạo mã giảm giá mới (Admin)
exports.createCoupon = asyncHandler(async (req, res) => {
  const {
    code,
    discountType,
    discountValue,
    expiryDate,
    maxDiscountAmount,
    minOrderValue,
    maxUses,
    description,
  } = req.body;

  // Kiểm tra mã giảm giá đã tồn tại chưa
  const existingCoupon = await Coupon.findOne({ code });
  if (existingCoupon) {
    return res.status(400).json({
      success: false,
      message: "Mã giảm giá này đã tồn tại",
    });
  }

  // Tạo mã giảm giá mới
  const coupon = await Coupon.create({
    code,
    discountType,
    discountValue,
    expiryDate,
    maxDiscountAmount,
    minOrderValue,
    maxUses,
    description,
    isActive: true,
    usedCount: 0,
  });

  res.status(201).json({
    success: true,
    data: coupon,
  });
});

// Lấy danh sách mã giảm giá (Admin)
exports.getCoupons = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    showInactive = false,
    code,
    discountType,
  } = req.query;

  // Xây dựng query
  const query = {};
  if (!showInactive) {
    query.isActive = true;
  }
  if (code) {
    query.code = { $regex: code, $options: "i" }; // Tìm kiếm theo mã giảm giá
  }
  if (discountType) {
    query.discountType = discountType; // Lọc theo loại giảm giá
  }

  // Thực hiện paginate
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { createdAt: -1 },
  };

  const coupons = await Coupon.paginate(query, options);

  res.status(200).json({
    success: true,
    data: coupons,
  });
});

// Lấy danh sách mã giảm giá cho người dùng (Public)
exports.getCouponUser = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find({
    isActive: true,
    expiryDate: { $gt: new Date() },
  });

  res.status(200).json({
    success: true,
    data: coupons,
  });
});

// Lấy chi tiết mã giảm giá (Admin)
exports.getCouponById = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy mã giảm giá",
    });
  }

  res.status(200).json({
    success: true,
    data: coupon,
  });
});

// Cập nhật mã giảm giá (Admin)
exports.updateCoupon = asyncHandler(async (req, res) => {
  const {
    code,
    discountType,
    discountValue,
    expiryDate,
    maxDiscountAmount,
    minOrderValue,
    maxUses,
    isActive,
    description,
  } = req.body;

  let coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy mã giảm giá",
    });
  }

  // Kiểm tra mã đã tồn tại chưa nếu thay đổi mã
  if (code && code !== coupon.code) {
    const existingCoupon = await Coupon.findOne({
      code,
      _id: { $ne: req.params.id },
    });

    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: "Mã giảm giá này đã tồn tại",
      });
    }
  }

  // Cập nhật thông tin
  if (code) coupon.code = code;
  if (discountType) coupon.discountType = discountType;
  if (discountValue !== undefined) coupon.discountValue = discountValue;
  if (expiryDate) coupon.expiryDate = expiryDate;
  if (maxDiscountAmount !== undefined)
    coupon.maxDiscountAmount = maxDiscountAmount;
  if (minOrderValue !== undefined) coupon.minOrderValue = minOrderValue;
  if (maxUses !== undefined) coupon.maxUses = maxUses;
  if (isActive !== undefined) coupon.isActive = isActive;
  if (description !== undefined) coupon.description = description;

  coupon = await coupon.save();

  res.status(200).json({
    success: true,
    data: coupon,
  });
});

// Xóa mã giảm giá (Admin)
exports.deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy mã giảm giá",
    });
  }

  await coupon.remove();

  res.status(200).json({
    success: true,
    message: "Đã xóa mã giảm giá",
  });
});

// Kiểm tra mã giảm giá hợp lệ (User)
exports.validateCoupon = asyncHandler(async (req, res) => {
  const { code, total } = req.body;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp mã giảm giá",
    });
  }

  // Tìm mã giảm giá
  const coupon = await Coupon.findOne({
    code,
    isActive: true,
    expiryDate: { $gt: new Date() },
  });

  if (!coupon) {
    return res.status(404).json({
      success: false,
      message: "Mã giảm giá không tồn tại hoặc đã hết hạn",
    });
  }

  // Kiểm tra số lần sử dụng
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    return res.status(400).json({
      success: false,
      message: "Mã giảm giá đã hết lượt sử dụng",
    });
  }

  // Kiểm tra người dùng đã sử dụng chưa
  if (coupon.usedBy && coupon.usedBy.includes(req.user._id)) {
    return res.status(400).json({
      success: false,
      message: "Bạn đã sử dụng mã giảm giá này rồi",
    });
  }

  // Kiểm tra giá trị đơn hàng tối thiểu
  if (coupon.minOrderValue && total < coupon.minOrderValue) {
    return res.status(400).json({
      success: false,
      message: `Đơn hàng phải có giá trị tối thiểu ${coupon.minOrderValue} để sử dụng mã giảm giá này`,
    });
  }

  // Tính toán giá trị giảm giá
  let discountAmount = 0;
  if (coupon.discountType === "percentage") {
    discountAmount = (total * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
      discountAmount = coupon.maxDiscountAmount;
    }
  } else {
    discountAmount = coupon.discountValue;
    if (discountAmount > total) {
      discountAmount = total;
    }
  }

  res.status(200).json({
    success: true,
    data: {
      code: coupon.code,
      discountAmount,
      couponInfo: coupon,
    },
  });
});

// Xác minh mã giảm giá cho người dùng đã đăng nhập
exports.verifyCoupon = asyncHandler(async (req, res) => {
  try {
    const { code, orderValue } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mã giảm giá",
      });
    }

    // Gọi service để xác minh mã giảm giá
    const result = await couponService.verifyCoupon(
      code,
      req.user._id,
      orderValue || 0
    );

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.message,
        minOrderValue: result.minOrderValue,
      });
    }

    res.status(200).json({
      success: true,
      message: "Mã giảm giá hợp lệ",
      data: {
        coupon: result.coupon,
        discount: result.discount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi xác minh mã giảm giá",
    });
  }
});

// Người dùng thu thập mã giảm giá
exports.collectCoupon = asyncHandler(async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mã giảm giá",
      });
    }

    // Gọi service để thu thập mã giảm giá
    const result = await couponService.collectCoupon(req.user._id, code);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      coupon: result.coupon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi thu thập mã giảm giá",
    });
  }
});
