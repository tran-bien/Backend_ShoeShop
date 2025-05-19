const { Coupon, User, Product, Category } = require("@models");
const paginate = require("@utils/pagination");
const paginateDeleted = require("@utils/paginationDeleted");
const ApiError = require("@utils/ApiError");

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
      throw new ApiError(400, "Mã giảm giá không còn hoạt động");
    }

    // Kiểm tra thời gian
    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      throw new ApiError(400, "Mã giảm giá không trong thời gian sử dụng");
    }

    // Kiểm tra người dùng đã thu thập coupon này chưa
    if (coupon.users.includes(userId)) {
      throw new ApiError(400, "Bạn đã thu thập mã giảm giá này rồi");
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
   * Kiểm tra tính hợp lệ của mã giảm giá khi đặt hàng
   * @param {String} userId - ID của người dùng
   * @param {String} couponId - ID của mã giảm giá
   * @param {Number} orderValue - Giá trị đơn hàng
   * @param {Array} productIds - Danh sách ID sản phẩm trong đơn hàng
   * @param {Array} categoryIds - Danh sách ID danh mục sản phẩm trong đơn hàng
   * @returns {Object} - Kết quả kiểm tra và giá trị giảm giá
   */
  validateCouponForOrder: async (
    userId,
    couponId,
    orderValue,
    productIds = [],
    categoryIds = []
  ) => {
    // Kiểm tra coupon tồn tại
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      throw new ApiError(404, "Không tìm thấy mã giảm giá");
    }

    // Kiểm tra người dùng đã thu thập coupon này chưa
    if (!coupon.users.includes(userId)) {
      throw new ApiError(403, "Bạn chưa thu thập mã giảm giá này");
    }

    // Kiểm tra trạng thái
    if (coupon.status !== "active") {
      throw new ApiError(400, "Mã giảm giá không còn hoạt động");
    }

    // Kiểm tra thời gian
    const now = new Date();
    if (now < new Date(coupon.startDate) || now > new Date(coupon.endDate)) {
      throw new ApiError(400, "Mã giảm giá không trong thời gian sử dụng");
    }

    // Kiểm tra số lượng sử dụng
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      throw new ApiError(400, "Mã giảm giá đã hết lượt sử dụng");
    }

    // Kiểm tra giá trị tối thiểu
    if (orderValue < coupon.minOrderValue) {
      throw new ApiError(
        400,
        `Giá trị đơn hàng phải từ ${coupon.minOrderValue}đ để sử dụng mã giảm giá này`
      );
    }

    // Kiểm tra phạm vi áp dụng
    if (coupon.applyFor !== "all") {
      if (coupon.applyFor === "products" && coupon.productIds.length > 0) {
        // Kiểm tra xem đơn hàng có chứa sản phẩm áp dụng không
        const hasValidProduct = productIds.some((id) =>
          coupon.productIds.some((pid) => pid.toString() === id.toString())
        );

        if (!hasValidProduct) {
          throw new ApiError(
            400,
            "Mã giảm giá không áp dụng cho sản phẩm trong đơn hàng"
          );
        }
      }

      if (coupon.applyFor === "categories" && coupon.categoryIds.length > 0) {
        // Kiểm tra xem đơn hàng có chứa danh mục áp dụng không
        const hasValidCategory = categoryIds.some((id) =>
          coupon.categoryIds.some((cid) => cid.toString() === id.toString())
        );

        if (!hasValidCategory) {
          throw new ApiError(
            400,
            "Mã giảm giá không áp dụng cho danh mục sản phẩm trong đơn hàng"
          );
        }
      }
    }

    // Tính toán giá trị giảm giá
    let discountAmount = 0;
    if (coupon.type === "fixed") {
      discountAmount = coupon.value;
    } else if (coupon.type === "percent") {
      discountAmount = (orderValue * coupon.value) / 100;

      // Áp dụng giảm giá tối đa nếu có
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    }

    return {
      success: true,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        description: coupon.description,
        type: coupon.type,
        value: coupon.value,
      },
      discountAmount,
      orderValueAfterDiscount: orderValue - discountAmount,
    };
  },

  /**
   * Tăng số lần sử dụng của mã giảm giá khi đặt hàng thành công
   * @param {String} couponId - ID của mã giảm giá
   * @returns {Boolean} - Kết quả cập nhật
   */
  incrementCouponUsage: async (couponId) => {
    const result = await Coupon.findByIdAndUpdate(
      couponId,
      { $inc: { currentUses: 1 } },
      { new: true }
    );

    return !!result;
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
  const {
    page = 1,
    limit = 10,
    code,
    type,
    status,
    isPublic,
  } = query;

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
  if (couponData.type === 'percent') {
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

  // Kiểm tra sự phù hợp của dữ liệu dựa trên phạm vi áp dụng
  if (couponData.applyFor === "all" || !couponData.applyFor) {
    // Nếu áp dụng cho tất cả, không cần productIds và categoryIds
    if (couponData.productIds && couponData.productIds.length > 0) {
      throw new ApiError(
        400, 
        "Khi áp dụng cho tất cả sản phẩm, không cần chỉ định danh sách sản phẩm cụ thể"
      );
    }
    if (couponData.categoryIds && couponData.categoryIds.length > 0) {
      throw new ApiError(
        400, 
        "Khi áp dụng cho tất cả sản phẩm, không cần chỉ định danh sách danh mục cụ thể"
      );
    }
    
    // Đảm bảo giá trị mặc định là "all"
    couponData.applyFor = "all";
    couponData.productIds = [];
    couponData.categoryIds = [];
  } 
  else if (couponData.applyFor === "categories") {
    // Nếu áp dụng cho danh mục, không cần productIds
    if (couponData.productIds && couponData.productIds.length > 0) {
      throw new ApiError(
        400, 
        "Khi áp dụng cho danh mục cụ thể, không cần chỉ định danh sách sản phẩm"
      );
    }
    
    // Phải có ít nhất một danh mục
    if (!couponData.categoryIds || couponData.categoryIds.length === 0) {
      throw new ApiError(
        400, 
        "Khi áp dụng cho danh mục cụ thể, phải chọn ít nhất một danh mục"
      );
    }
    
    // Kiểm tra danh mục có tồn tại không
    const categories = await Category.find({
      _id: { $in: couponData.categoryIds },
    });
    
    if (categories.length !== couponData.categoryIds.length) {
      throw new ApiError(400, "Một số danh mục không tồn tại");
    }
    
    // Đảm bảo rỗng cho productIds
    couponData.productIds = [];
  } 
  else if (couponData.applyFor === "products") {
    // Nếu áp dụng cho sản phẩm, không cần categoryIds
    if (couponData.categoryIds && couponData.categoryIds.length > 0) {
      throw new ApiError(
        400, 
        "Khi áp dụng cho sản phẩm cụ thể, không cần chỉ định danh sách danh mục"
      );
    }
    
    // Phải có ít nhất một sản phẩm
    if (!couponData.productIds || couponData.productIds.length === 0) {
      throw new ApiError(
        400, 
        "Khi áp dụng cho sản phẩm cụ thể, phải chọn ít nhất một sản phẩm"
      );
    }
    
    // Kiểm tra sản phẩm có tồn tại không
    const products = await Product.find({
      _id: { $in: couponData.productIds },
    });
    
    if (products.length !== couponData.productIds.length) {
      throw new ApiError(400, "Một số sản phẩm không tồn tại");
    }
    
    // Đảm bảo rỗng cho categoryIds
    couponData.categoryIds = [];
  } else {
    throw new ApiError(400, "Phạm vi áp dụng không hợp lệ. Chỉ chấp nhận 'all', 'categories' hoặc 'products'");
  }

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
    if (couponData.type === 'percent') {
      const value = couponData.value !== undefined ? couponData.value : coupon.value;
      if (value < 0 || value > 100) {
        throw new ApiError(400, "Giá trị phần trăm giảm giá phải từ 0 đến 100");
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

  // Xác định applyFor hiện tại hoặc mới
  const newApplyFor = couponData.applyFor || coupon.applyFor;
  
  // Kiểm tra phạm vi áp dụng
  if (couponData.applyFor && !['all', 'categories', 'products'].includes(couponData.applyFor)) {
    throw new ApiError(400, "Phạm vi áp dụng không hợp lệ. Chỉ chấp nhận 'all', 'categories' hoặc 'products'");
  }
  
  // Kiểm tra sự phù hợp của dữ liệu dựa trên phạm vi áp dụng
  if (newApplyFor === "all") {
    // Nếu áp dụng cho tất cả, không cần productIds và categoryIds
    if (couponData.productIds && couponData.productIds.length > 0) {
      throw new ApiError(
        400, 
        "Khi áp dụng cho tất cả sản phẩm, không cần chỉ định danh sách sản phẩm cụ thể"
      );
    }
    if (couponData.categoryIds && couponData.categoryIds.length > 0) {
      throw new ApiError(
        400, 
        "Khi áp dụng cho tất cả sản phẩm, không cần chỉ định danh sách danh mục cụ thể"
      );
    }
    
    // Nếu cập nhật applyFor thành "all", xóa các IDs của phiên bản cũ
    if (couponData.applyFor === "all" && coupon.applyFor !== "all") {
      couponData.productIds = [];
      couponData.categoryIds = [];
    }
  } 
  else if (newApplyFor === "categories") {
    // Nếu áp dụng cho danh mục, không cần productIds
    if (couponData.productIds && couponData.productIds.length > 0) {
      throw new ApiError(
        400, 
        "Khi áp dụng cho danh mục cụ thể, không cần chỉ định danh sách sản phẩm"
      );
    }
    
    // Phải có ít nhất một danh mục
    const categoryIds = couponData.categoryIds || coupon.categoryIds;
    if (!categoryIds || categoryIds.length === 0) {
      throw new ApiError(
        400, 
        "Khi áp dụng cho danh mục cụ thể, phải chọn ít nhất một danh mục"
      );
    }
    
    // Kiểm tra danh mục có tồn tại không
    if (couponData.categoryIds && couponData.categoryIds.length > 0) {
      const categories = await Category.find({
        _id: { $in: couponData.categoryIds },
      });
      
      if (categories.length !== couponData.categoryIds.length) {
        throw new ApiError(400, "Một số danh mục không tồn tại");
      }
    }
    
    // Nếu chuyển sang chế độ áp dụng cho danh mục, xóa productIds cũ
    if (couponData.applyFor === "categories" && coupon.applyFor !== "categories") {
      couponData.productIds = [];
    }
  } 
  else if (newApplyFor === "products") {
    // Nếu áp dụng cho sản phẩm, không cần categoryIds
    if (couponData.categoryIds && couponData.categoryIds.length > 0) {
      throw new ApiError(
        400, 
        "Khi áp dụng cho sản phẩm cụ thể, không cần chỉ định danh sách danh mục"
      );
    }
    
    // Phải có ít nhất một sản phẩm
    const productIds = couponData.productIds || coupon.productIds;
    if (!productIds || productIds.length === 0) {
      throw new ApiError(
        400, 
        "Khi áp dụng cho sản phẩm cụ thể, phải chọn ít nhất một sản phẩm"
      );
    }
    
    // Kiểm tra sản phẩm có tồn tại không
    if (couponData.productIds && couponData.productIds.length > 0) {
      const products = await Product.find({
        _id: { $in: couponData.productIds },
      });
      
      if (products.length !== couponData.productIds.length) {
        throw new ApiError(400, "Một số sản phẩm không tồn tại");
      }
    }
    
    // Nếu chuyển sang chế độ áp dụng cho sản phẩm, xóa categoryIds cũ
    if (couponData.applyFor === "products" && coupon.applyFor !== "products") {
      couponData.categoryIds = [];
    }
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
