const { Coupon, User, Product, Category, Order, Variant } = require("@models");
const paginate = require("@utils/pagination");
const ApiError = require("@utils/ApiError");
const mongoose = require("mongoose");

const couponService = {
  /**
   * Lấy danh sách coupon công khai đang hoạt động
   * @param {Object} query - Các tham số truy vấn
   * @returns {Object} - Danh sách coupon phân trang
   */
  getPublicCoupons: async (query = {}) => {
    const { page = 1, limit = 10, sort = "createdAt_desc" } = query;

    // Xây dựng điều kiện lọc - chỉ lấy coupon công khai và còn hoạt động
    const filter = {
      isPublic: true,
      status: "active",
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    };

    // Xây dựng thông tin sắp xếp
    const sortOptions = {};
    if (sort) {
      const [field, order] = sort.split("_");
      sortOptions[field] = order === "desc" ? -1 : 1;
    }

    // Thực hiện truy vấn với phân trang
    const result = await paginate(Coupon, filter, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: sortOptions,
      select:
        "code description type value maxDiscount minOrderValue startDate endDate",
    });

    return {
      success: true,
      message: "Lấy danh sách mã giảm giá thành công",
      coupons: result.data,
      pagination: {
        page: result.currentPage,
        limit: parseInt(limit),
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  },

  /**
   * Lấy danh sách coupon đã thu thập của người dùng
   * @param {String} userId - ID của người dùng
   * @param {Object} query - Các tham số truy vấn
   * @returns {Object} - Danh sách coupon phân trang
   */
  getUserCoupons: async (userId, query = {}) => {
    const {
      page = 1,
      limit = 10,
      status = "active",
      sort = "createdAt_desc",
    } = query;

    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "Không tìm thấy người dùng");
    }

    // Xây dựng điều kiện lọc
    let filter = {
      users: { $in: [userId] },
    };

    // Lọc theo trạng thái
    if (status) {
      if (status === "active") {
        filter.status = "active";
        filter.startDate = { $lte: new Date() };
        filter.endDate = { $gte: new Date() };
      } else {
        filter.status = status;
      }
    }

    // Xây dựng thông tin sắp xếp
    const sortOptions = {};
    if (sort) {
      const [field, order] = sort.split("_");
      sortOptions[field] = order === "desc" ? -1 : 1;
    }

    // Thực hiện truy vấn với phân trang
    const result = await paginate(Coupon, filter, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: sortOptions,
    });

    return {
      success: true,
      message: "Lấy danh sách mã giảm giá đã thu thập thành công",
      coupons: result.data,
      pagination: {
        page: result.currentPage,
        limit: parseInt(limit),
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  },

  /**
   * Thu thập mã giảm giá
   * @param {String} userId - ID của người dùng
   * @param {String} couponId - ID của coupon
   * @returns {Object} - Kết quả thu thập
   */
  collectCoupon: async (userId, couponId) => {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "Không tìm thấy người dùng");
    }

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      throw new ApiError(404, "Không tìm thấy mã giảm giá");
    }

    // Kiểm tra coupon có công khai không và còn hoạt động không
    if (!coupon.isPublic) {
      throw new ApiError(403, "Mã giảm giá không công khai");
    }

    // Kiểm tra trạng thái
    if (coupon.status !== "active") {
      throw new ApiError(422, "Mã giảm giá không còn hoạt động");
    }

    // Kiểm tra thời gian
    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      throw new ApiError(422, "Mã giảm giá không trong thời gian sử dụng");
    }

    // Kiểm tra người dùng đã thu thập coupon này chưa
    if (coupon.users.includes(userId)) {
      throw new ApiError(422, "Bạn đã thu thập mã giảm giá này rồi");
    }

    // Thêm người dùng vào danh sách đã thu thập
    coupon.users.push(userId);
    await coupon.save();

    return {
      success: true,
      message: "Thu thập mã giảm giá thành công",
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        description: coupon.description,
        type: coupon.type,
        value: coupon.value,
        maxDiscount: coupon.maxDiscount,
        minOrderValue: coupon.minOrderValue,
        startDate: coupon.startDate,
        endDate: coupon.endDate,
      },
    };
  },

  /**
   * Lấy chi tiết mã giảm giá
   * @param {String} userId - ID của người dùng
   * @param {String} couponId - ID của mã giảm giá
   * @returns {Object} - Chi tiết mã giảm giá
   */
  getCouponDetails: async (userId, couponId) => {
    // Kiểm tra coupon tồn tại
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      throw new ApiError(404, "Không tìm thấy mã giảm giá");
    }

    // Kiểm tra người dùng đã thu thập coupon này chưa
    if (!coupon.users.includes(userId)) {
      throw new ApiError(403, "Bạn chưa thu thập mã giảm giá này");
    }

    // Kiểm tra trạng thái coupon
    const now = new Date();
    const isValid =
      coupon.status === "active" &&
      now >= new Date(coupon.startDate) &&
      now <= new Date(coupon.endDate) &&
      (!coupon.maxUses || coupon.currentUses < coupon.maxUses);

    // Trả về thông tin chi tiết
    return {
      success: true,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        description: coupon.description,
        type: coupon.type,
        value: coupon.value,
        maxDiscount: coupon.maxDiscount,
        minOrderValue: coupon.minOrderValue,
        startDate: coupon.startDate,
        endDate: coupon.endDate,
        status: coupon.status,
        isValid,
      },
    };
  },

  /**
   * Validate coupon với advanced conditions
   * @param {Object} coupon - Coupon object
   * @param {String} userId - User ID
   * @param {Array} cartItems - Cart items array
   * @returns {Object} - Validation result
   */
  validateAdvancedCoupon: async (coupon, userId, cartItems = []) => {
    // 1. Check scope - Kiểm tra coupon áp dụng cho sản phẩm/variant/category nào
    if (coupon.scope && coupon.scope !== "ALL") {
      let hasApplicableItem = false;

      for (const item of cartItems) {
        // Check applicable products
        if (
          coupon.scope === "PRODUCTS" &&
          coupon.applicableProducts?.length > 0
        ) {
          if (
            coupon.applicableProducts.some(
              (p) => p.toString() === item.variant?.product?._id?.toString()
            )
          ) {
            hasApplicableItem = true;
            break;
          }
        }

        // Check applicable variants
        if (
          coupon.scope === "VARIANTS" &&
          coupon.applicableVariants?.length > 0
        ) {
          if (
            coupon.applicableVariants.some(
              (v) => v.toString() === item.variant?._id?.toString()
            )
          ) {
            hasApplicableItem = true;
            break;
          }
        }

        // Check applicable categories
        if (
          coupon.scope === "CATEGORIES" &&
          coupon.applicableCategories?.length > 0
        ) {
          if (
            coupon.applicableCategories.some(
              (c) =>
                c.toString() ===
                item.variant?.product?.category?._id?.toString()
            )
          ) {
            hasApplicableItem = true;
            break;
          }
        }
      }

      if (!hasApplicableItem) {
        return {
          isValid: false,
          message: "Mã giảm giá không áp dụng cho sản phẩm trong giỏ hàng",
        };
      }
    }

    // 2. Check conditions
    if (coupon.conditions) {
      const conditions = coupon.conditions;

      // Check minQuantity
      if (conditions.minQuantity) {
        const totalQuantity = cartItems.reduce(
          (sum, item) => sum + item.quantity,
          0
        );
        if (totalQuantity < conditions.minQuantity) {
          return {
            isValid: false,
            message: `Cần mua tối thiểu ${conditions.minQuantity} sản phẩm để áp dụng mã này`,
          };
        }
      }

      // Check maxUsagePerUser
      if (conditions.maxUsagePerUser) {
        const usageCount =
          coupon.userUsage?.find(
            (u) => u.user?.toString() === userId?.toString()
          )?.usageCount || 0;
        if (usageCount >= conditions.maxUsagePerUser) {
          return {
            isValid: false,
            message: `Bạn đã sử dụng mã này ${usageCount}/${conditions.maxUsagePerUser} lần`,
          };
        }
      }

      // Check requiredTiers (loyalty tiers)
      if (conditions.requiredTiers && conditions.requiredTiers.length > 0) {
        const user = await User.findById(userId).populate("loyalty.tier");
        if (!user || !user.loyalty?.tier) {
          return {
            isValid: false,
            message:
              "Mã giảm giá này chỉ dành cho thành viên có hạng thành viên",
          };
        }

        const userTierId = user.loyalty.tier._id?.toString();
        const isValidTier = conditions.requiredTiers.some(
          (t) => t.toString() === userTierId
        );
        if (!isValidTier) {
          return {
            isValid: false,
            message: `Mã giảm giá này chỉ dành cho hạng thành viên: ${conditions.requiredTiers.join(
              ", "
            )}`,
          };
        }
      }

      // Check firstOrderOnly
      if (conditions.firstOrderOnly) {
        const orderCount = await Order.countDocuments({
          user: userId,
          status: { $in: ["delivered", "confirmed", "shipping"] },
        });
        if (orderCount > 0) {
          return {
            isValid: false,
            message: "Mã giảm giá này chỉ dành cho đơn hàng đầu tiên",
          };
        }
      }

      // Check requiredTotalSpent
      if (conditions.requiredTotalSpent) {
        const totalSpent = await Order.aggregate([
          {
            $match: {
              user: new mongoose.Types.ObjectId(userId),
              status: "delivered",
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$totalAfterDiscountAndShipping" },
            },
          },
        ]);

        const userTotalSpent = totalSpent.length > 0 ? totalSpent[0].total : 0;
        if (userTotalSpent < conditions.requiredTotalSpent) {
          return {
            isValid: false,
            message: `Cần chi tiêu tối thiểu ${conditions.requiredTotalSpent.toLocaleString(
              "vi-VN"
            )}đ để sử dụng mã này`,
          };
        }
      }
    }

    return {
      isValid: true,
      message: "Mã giảm giá hợp lệ",
    };
  },

  /**
   * Calculate applicable discount for items based on coupon scope
   * @param {Object} coupon - Coupon object
   * @param {Array} cartItems - Cart items array
   * @param {Number} subtotal - Original subtotal
   * @returns {Object} - Discount info
   */
  calculateApplicableDiscount: (coupon, cartItems, subtotal) => {
    let applicableSubtotal = subtotal;

    // If coupon has scope restriction, only apply to applicable items
    if (coupon.scope && coupon.scope !== "ALL") {
      applicableSubtotal = 0;

      for (const item of cartItems) {
        let isApplicable = false;

        if (
          coupon.scope === "PRODUCTS" &&
          coupon.applicableProducts?.length > 0
        ) {
          isApplicable = coupon.applicableProducts.some(
            (p) => p.toString() === item.variant?.product?._id?.toString()
          );
        } else if (
          coupon.scope === "VARIANTS" &&
          coupon.applicableVariants?.length > 0
        ) {
          isApplicable = coupon.applicableVariants.some(
            (v) => v.toString() === item.variant?._id?.toString()
          );
        } else if (
          coupon.scope === "CATEGORIES" &&
          coupon.applicableCategories?.length > 0
        ) {
          isApplicable = coupon.applicableCategories.some(
            (c) =>
              c.toString() === item.variant?.product?.category?._id?.toString()
          );
        }

        if (isApplicable) {
          applicableSubtotal += item.price * item.quantity;
        }
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.type === "percent") {
      discountAmount = (applicableSubtotal * coupon.value) / 100;
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else if (coupon.type === "fixed") {
      discountAmount = Math.min(coupon.value, applicableSubtotal);
    }

    return {
      applicableSubtotal,
      discountAmount: Math.round(discountAmount),
    };
  },
};

/**
 * ADMIN COUPON SERVICE - Quản lý mã giảm giá
 */
const adminCouponService = {
  /**
   * Lấy danh sách tất cả mã giảm giá
   * @param {Object} query - Các tham số truy vấn và phân trang
   * @returns {Object} - Danh sách mã giảm giá phân trang
   */
  getAllCoupons: async (query = {}) => {
    const { page = 1, limit = 50, code, type, status, isPublic } = query;

    // Xây dựng điều kiện lọc
    const filter = {};

    if (code) {
      filter.code = { $regex: code, $options: "i" };
    }

    if (type && ["percent", "fixed"].includes(type)) {
      filter.type = type;
    }

    if (
      status &&
      ["active", "inactive", "expired", "archived"].includes(status)
    ) {
      filter.status = status;
    }

    if (isPublic !== undefined) {
      filter.isPublic = isPublic === "true" || isPublic === true;
    }

    // Thực hiện truy vấn với phân trang
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      select: "-__v",
      populate: [
        { path: "createdBy", select: "name" },
        { path: "updatedBy", select: "name" },
      ],
    };

    const result = await paginate(Coupon, filter, options);

    return {
      success: true,
      ...result,
    };
  },

  /**
   * Lấy chi tiết mã giảm giá
   * @param {String} couponId - ID của mã giảm giá
   * @returns {Object} - Chi tiết mã giảm giá
   */
  getCouponById: async (couponId) => {
    const coupon = await Coupon.findById(couponId)
      .populate({ path: "createdBy", select: "name" })
      .populate({ path: "updatedBy", select: "name" });

    if (!coupon) {
      throw new ApiError(404, "Không tìm thấy mã giảm giá");
    }

    return {
      success: true,
      coupon,
    };
  },

  /**
   * Tạo mã giảm giá mới
   * @param {Object} couponData - Dữ liệu mã giảm giá
   * @param {String} adminId - ID của admin tạo
   * @returns {Object} - Mã giảm giá đã tạo
   */
  createCoupon: async (couponData, adminId) => {
    // Kiểm tra các ràng buộc dựa trên loại giảm giá
    if (couponData.type === "percent") {
      if (couponData.value < 0 || couponData.value > 100) {
        throw new ApiError(400, "Giá trị phần trăm giảm giá phải từ 0 đến 100");
      }
    }

    // Kiểm tra mã đã tồn tại chưa
    const existingCoupon = await Coupon.findOne({
      code: couponData.code.toUpperCase(),
    });
    if (existingCoupon) {
      throw new ApiError(400, "Mã giảm giá đã tồn tại");
    }

    // Đảm bảo code luôn viết hoa
    couponData.code = couponData.code.toUpperCase();

    // Thêm thông tin người tạo
    couponData.createdBy = adminId;
    couponData.updatedBy = adminId;

    // Tạo mã giảm giá mới
    const coupon = new Coupon(couponData);
    await coupon.save();

    return {
      success: true,
      message: "Tạo mã giảm giá thành công",
      coupon,
    };
  },

  /**
   * Cập nhật mã giảm giá
   * @param {String} couponId - ID của mã giảm giá
   * @param {Object} couponData - Dữ liệu cập nhật
   * @param {String} adminId - ID của admin
   * @returns {Object} - Mã giảm giá đã cập nhật
   */
  updateCoupon: async (couponId, couponData, adminId) => {
    // Kiểm tra mã giảm giá tồn tại
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      throw new ApiError(404, "Không tìm thấy mã giảm giá");
    }

    // Kiểm tra loại giảm giá nếu được cung cấp
    if (couponData.type !== undefined) {
      // Kiểm tra các ràng buộc dựa trên loại giảm giá
      if (couponData.type === "percent") {
        const value =
          couponData.value !== undefined ? couponData.value : coupon.value;
        if (value < 0 || value > 100) {
          throw new ApiError(
            400,
            "Giá trị phần trăm giảm giá phải từ 0 đến 100"
          );
        }
      }
    }

    // Nếu thay đổi code, kiểm tra trùng lặp
    if (couponData.code && couponData.code !== coupon.code) {
      const existingCoupon = await Coupon.findOne({
        code: couponData.code.toUpperCase(),
        _id: { $ne: couponId },
      });

      if (existingCoupon) {
        throw new ApiError(400, "Mã giảm giá đã tồn tại");
      }

      // Đảm bảo code luôn viết hoa
      couponData.code = couponData.code.toUpperCase();
    }

    // Cập nhật thời gian
    couponData.updatedAt = new Date();

    // Thêm thông tin người cập nhật
    couponData.updatedBy = adminId;

    // Cập nhật mã giảm giá
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      { $set: couponData },
      { new: true, runValidators: true }
    );

    return {
      success: true,
      message: "Cập nhật mã giảm giá thành công",
      coupon: updatedCoupon,
    };
  },

  /**
   * Xóa mã giảm giá
   * @param {String} couponId - ID của mã giảm giá
   * @returns {Object} - Kết quả xóa
   */
  deleteCoupon: async (couponId) => {
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      throw new ApiError(404, "Không tìm thấy mã giảm giá");
    }

    // Middleware sẽ tự động chuyển sang archived nếu coupon đã được sử dụng
    try {
      await coupon.deleteOne();
      return {
        success: true,
        message: "Xóa mã giảm giá thành công",
      };
    } catch (error) {
      // Nếu lỗi từ middleware và đã chuyển thành archived
      if (error.message.includes("archived")) {
        return {
          success: true,
          message: error.message,
        };
      }
      throw error;
    }
  },

  /**
   * Cập nhật trạng thái mã giảm giá
   * @param {String} couponId - ID của mã giảm giá
   * @param {String} status - Trạng thái mới
   * @param {String} adminId - ID của admin
   * @returns {Object} - Kết quả cập nhật
   */
  updateCouponStatus: async (couponId, status, adminId) => {
    if (!["active", "inactive", "archived"].includes(status)) {
      throw new ApiError(400, "Trạng thái không hợp lệ");
    }

    const coupon = await Coupon.findByIdAndUpdate(
      couponId,
      {
        $set: {
          status,
          updatedBy: adminId,
        },
      },
      { new: true }
    );

    if (!coupon) {
      throw new ApiError(404, "Không tìm thấy mã giảm giá");
    }

    return {
      success: true,
      message: `Đã chuyển trạng thái mã giảm giá thành ${status}`,
      coupon,
    };
  },
};

// Kết hợp services để export
const exportedCouponService = {
  ...couponService,
  adminCouponService,
};

module.exports = exportedCouponService;
