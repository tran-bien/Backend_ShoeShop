const { Review, Product, Variant, Order, User } = require("@models");
const mongoose = require("mongoose");
const paginate = require("@utils/pagination");
const ApiError = require("@utils/ApiError");

const reviewService = {
  /**
   * Lấy danh sách đánh giá của một sản phẩm và tính trung bình điểm đánh giá sản phẩm đó
   * @param {String} productId - ID sản phẩm
   * @param {Object} query - Các tham số truy vấn
   * @returns {Object} - Danh sách đánh giá phân trang và thống kê
   */
  getProductReviews: async (productId, query = {}) => {
    const { page = 1, limit = 10, rating, sort = "createdAt_desc" } = query;

    // Kiểm tra sản phẩm tồn tại
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, "Không tìm thấy sản phẩm");
    }

    // Tìm tất cả variants của sản phẩm này
    const variants = await Variant.find({ product: productId }).select('_id');
    const variantIds = variants.map(v => v._id);

    // Tìm tất cả orderItems từ Order model có chứa các variant của sản phẩm
    const orderItemsInfo = await Order.aggregate([
      { $unwind: "$orderItems" },
      { $match: { "orderItems.variant": { $in: variantIds.map(id => new mongoose.Types.ObjectId(id)) } } },
      { $project: { orderItemId: "$orderItems._id" } }
    ]);

    const orderItemIds = orderItemsInfo.map(item => item.orderItemId);

    // Xây dựng điều kiện lọc
    const filter = {
      orderItem: { $in: orderItemIds },
      isActive: true,
      deletedAt: null,
    };

    // Lọc theo số sao đánh giá
    if (rating && !isNaN(rating)) {
      filter.rating = parseInt(rating);
    }

    // Xây dựng thông tin sắp xếp
    const sortOptions = {};
    if (sort) {
      const [field, order] = sort.split("_");
      sortOptions[field] = order === "desc" ? -1 : 1;
    }

    // Thực hiện truy vấn với phân trang
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: sortOptions,
      populate: [
        { path: "user", select: "name avatar" },
        { 
          path: "orderItem", 
          populate: [
            { path: "product", select: "name" },
            { path: "variant", populate: { path: "color", select: "name" } },
            { path: "size", select: "value" }
          ]
        }
      ],
    };

    // Truy vấn phân trang
    const result = await paginate(Review, filter, options);

    // Tính toán thống kê đánh giá cho sản phẩm
    const statsFilter = {
      orderItem: { $in: orderItemIds },
      isActive: true,
      deletedAt: null,
    };

    const stats = await Review.aggregate([
      {
        $match: statsFilter
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          avgRating: { $avg: "$rating" },
          sumRating: { $sum: "$rating" },
          distribution: {
            $push: "$rating"
          }
        }
      }
    ]);

    // Xây dựng đối tượng thống kê
    let reviewStats = {
      totalReviews: 0,
      avgRating: 0,
      ratingDistribution: {
        1: { count: 0, percentage: 0 },
        2: { count: 0, percentage: 0 },
        3: { count: 0, percentage: 0 },
        4: { count: 0, percentage: 0 },
        5: { count: 0, percentage: 0 }
      }
    };

    // Nếu có dữ liệu thống kê
    if (stats.length > 0) {
      // Làm tròn điểm đánh giá đến 1 số thập phân
      reviewStats.totalReviews = stats[0].totalReviews;
      reviewStats.avgRating = Math.round(stats[0].avgRating * 10) / 10;
      
      // Tính phân phối đánh giá
      if (stats[0].distribution && stats[0].distribution.length > 0) {
        stats[0].distribution.forEach(rating => {
          if (rating >= 1 && rating <= 5) {
            reviewStats.ratingDistribution[rating].count += 1;
          }
        });
      }
      
      // Tính phần trăm cho mỗi mức đánh giá
      if (reviewStats.totalReviews > 0) {
        for (let i = 1; i <= 5; i++) {
          reviewStats.ratingDistribution[i].percentage = 
            Math.round((reviewStats.ratingDistribution[i].count / reviewStats.totalReviews) * 100);
        }
      }
    }

    // Chuẩn bị thông tin sản phẩm để trả về
    const productInfo = {
      _id: product._id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      rating: product.rating || reviewStats.avgRating, // Đảm bảo luôn có giá trị rating
      numReviews: product.numReviews || reviewStats.totalReviews, // Đảm bảo luôn có số lượng đánh giá
      image: product.images && product.images.length > 0 ? product.images[0].url : null
    };

    // Cập nhật rating và số lượng đánh giá cho sản phẩm nếu có thay đổi
    if (product.rating !== reviewStats.avgRating || product.numReviews !== reviewStats.totalReviews) {
      await Product.findByIdAndUpdate(productId, {
        rating: reviewStats.avgRating,
        numReviews: reviewStats.totalReviews
      });
    }

    return {
      success: true,
      data: result.data,
      pagination: {
        page: result.currentPage,
        limit: parseInt(limit),
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.hasNextPage,
        hasPrev: result.hasPrevPage,
      },
      product: productInfo,
      reviewStats: reviewStats
    };
  },

  /**
   * Lấy chi tiết đánh giá
   * @param {String} reviewId - ID đánh giá
   * @returns {Object} - Chi tiết đánh giá
   */
  getReviewDetail: async (reviewId) => {
    const review = await Review.findOne({
      _id: reviewId,
      isActive: true,
      deletedAt: null,
    }).populate([
      { path: "user", select: "name avatar" },
      { 
        path: "orderItem", 
        populate: [
          { path: "product", select: "name" },
          { path: "variant", populate: { path: "color", select: "name" } },
          { path: "size", select: "value" }
        ]
      }
    ]);

    if (!review) {
      throw new ApiError(404, "Không tìm thấy đánh giá");
    }

    return {
      success: true,
      review,
    };
  },

  /**
   * Tạo đánh giá mới
   * @param {String} userId - ID của người dùng
   * @param {Object} reviewData - Dữ liệu đánh giá
   * @returns {Object} - Đánh giá đã tạo
   */
  createReview: async (userId, reviewData) => {
    // Kiểm tra đơn hàng tồn tại
    const order = await Order.findOne({
      _id: reviewData.orderId,
    });

    if (!order) {
      throw new ApiError(
        404,
        "Không tìm thấy đơn hàng với ID đã cung cấp"
      );
    }

    // Kiểm tra xem người dùng có phải là chủ đơn hàng không
    if (order.user.toString() !== userId) {
      throw new ApiError(
        403,
        "Bạn không có quyền đánh giá đơn hàng này vì bạn không phải chủ sở hữu"
      );
    }

    // Kiểm tra trạng thái đơn hàng đã giao hàng chưa
    if (order.status !== "delivered") {
      throw new ApiError(
        400,
        "Bạn chỉ có thể đánh giá sản phẩm sau khi đơn hàng đã được giao thành công"
      );
    }

    // Tìm orderItem trong đơn hàng
    const orderItem = order.orderItems.id(reviewData.orderItemId);
    if (!orderItem) {
      throw new ApiError(400, "Không tìm thấy sản phẩm trong đơn hàng. Người dùng không thể đánh giá");
    }

    // Lấy variantId từ orderItem
    const variantId = orderItem.variant;
    if (!variantId) {
      throw new ApiError(400, "Không tìm thấy thông tin biến thể sản phẩm trong đơn hàng");
    }

    // Lấy thông tin variant để tìm product
    const variant = await Variant.findById(variantId);
    if (!variant) {
      throw new ApiError(404, "Không tìm thấy biến thể sản phẩm");
    }

    // Lấy productId từ variant
    const productId = variant.product;
    if (!productId) {
      throw new ApiError(404, "Không tìm thấy thông tin sản phẩm từ biến thể");
    }

    console.log("Product ID từ variant:", productId);

    // Tìm product trong database để đảm bảo nó tồn tại
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, "Không tìm thấy sản phẩm");
    }

    //Kiểm tra người dùng đã đánh giá orderItem này chưa (bao gồm cả đánh giá đã xóa mềm)
    const existingReview = await Review.findOne({
      user: userId,
      orderItem: reviewData.orderItemId
    }).setOptions({ includeDeleted: true }); // Bao gồm cả đánh giá đã xóa mềm

    if (existingReview) {
      // Kiểm tra xem đánh giá đã bị xóa mềm hay chưa
      if (existingReview.deletedAt) {
        throw new ApiError(
          400,
          "Bạn đã đánh giá và sau đó đã xóa đánh giá cho sản phẩm này trong đơn hàng. Không thể đánh giá lại."
        );
      } else {
        throw new ApiError(
          400,
          "Bạn đã đánh giá sản phẩm này trong đơn hàng rồi"
        );
      }
    }

    // Tạo đánh giá mới
    const newReview = new Review({
      user: userId,
      orderItem: reviewData.orderItemId,
      product: productId, // Thêm trường product lấy từ variant
      rating: reviewData.rating,
      content: reviewData.content,
      isActive: true
    });

    try {
      // Lưu review và hiển thị log để kiểm tra
      const savedReview = await newReview.save();
      console.log("Review đã lưu:", savedReview);

      // Lấy đánh giá đã tạo kèm theo thông tin người dùng và sản phẩm
      const createdReview = await Review.findById(newReview._id)
        .populate("user", "name avatar")
        .populate("product", "name images slug")
        .lean();

      console.log("Review sau khi populate:", createdReview);

      // Tự động cập nhật số lượng đánh giá và rating trung bình của sản phẩm
      const reviewStats = await Review.aggregate([
        {
          $match: {
            product: productId,
            isActive: true,
            deletedAt: null,
          }
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: "$rating" },
            numReviews: { $sum: 1 }
          }
        }
      ]);

      if (reviewStats.length > 0) {
        await Product.findByIdAndUpdate(productId, {
          rating: Math.round(reviewStats[0].avgRating * 10) / 10,
          numReviews: reviewStats[0].numReviews,
        });
        console.log(`Đã cập nhật trực tiếp rating sản phẩm ${productId}: ${reviewStats[0].avgRating}, số lượng: ${reviewStats[0].numReviews}`);
      }

      return {
        success: true,
        message: "Đánh giá sản phẩm thành công",
        review: createdReview,
      };
    } catch (error) {
      console.error("Lỗi khi tạo đánh giá:", error);
      
      // Bắt lỗi duplicate key và cung cấp thông báo cụ thể
      if (error.code === 11000) {
        console.log("Lỗi trùng lặp dữ liệu:", error.keyPattern);
        
        // Nếu lỗi trùng lặp liên quan đến cặp user_orderItem
        if (error.keyPattern && error.keyPattern.user && error.keyPattern.orderItem) {
          throw new ApiError(
            400,
            "Bạn đã đánh giá sản phẩm trong đơn hàng này rồi. Mỗi sản phẩm trong đơn hàng chỉ được đánh giá một lần."
          );
        }
        
        // Trường hợp khác
        throw new ApiError(
          400,
          `Không thể tạo đánh giá do trùng lặp dữ liệu ${JSON.stringify(error.keyPattern || {})}.`
        );
      }
      
      // Các lỗi khác
      throw error;
    }
  },

  /**
   * Cập nhật đánh giá
   * @param {String} userId - ID của người dùng
   * @param {String} reviewId - ID của đánh giá
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Object} - Đánh giá đã cập nhật
   */
  updateReview: async (userId, reviewId, updateData) => {
    // Kiểm tra đánh giá tồn tại và thuộc về người dùng
    const review = await Review.findOne({
      _id: reviewId,
      user: userId,
      deletedAt: null,
    });

    if (!review) {
      throw new ApiError(
        404,
        "Không tìm thấy đánh giá hoặc bạn không có quyền cập nhật"
      );
    }

    // Những trường được phép cập nhật
    const allowedFields = ["rating", "content"];
    const updateFields = {};

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updateFields[field] = updateData[field];
      }
    });

    // Cập nhật đánh giá
    const updatedReview = await Review.findByIdAndUpdate(
      reviewId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate([
      { path: "user", select: "name avatar" },
      { path: "product", select: "name images slug" },
      { 
        path: "orderItem", 
        populate: [
          { path: "product", select: "name" },
          { path: "variant", populate: { path: "color", select: "name" } },
          { path: "size", select: "value" }
        ]
      }
    ]);

    return {
      success: true,
      message: "Cập nhật đánh giá thành công",
      review: updatedReview,
    };
  },

  /**
   * Xóa đánh giá (xóa mềm)
   * @param {String} userId - ID của người dùng
   * @param {String} reviewId - ID của đánh giá
   * @returns {Object} - Kết quả xóa
   */
  deleteReview: async (userId, reviewId) => {
    // Kiểm tra đánh giá tồn tại và thuộc về người dùng
    const review = await Review.findOne({
      _id: reviewId,
      user: userId,
      deletedAt: null,
    });

    if (!review) {
      throw new ApiError(
        404,
        "Không tìm thấy đánh giá hoặc bạn không có quyền xóa"
      );
    }

    // Xóa mềm đánh giá
    await Review.findByIdAndUpdate(reviewId, {
      $set: {
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });

    return {
      success: true,
      message: "Xóa đánh giá thành công",
    };
  },

  /**
   * Thích đánh giá (tăng số lượng like)
   * @param {String} userId - ID của người dùng
   * @param {String} reviewId - ID của đánh giá
   * @returns {Object} - Kết quả thích
   */
  likeReview: async (userId, reviewId) => {
    // Kiểm tra đánh giá tồn tại
    const review = await Review.findOne({
      _id: reviewId,
      isActive: true,
      deletedAt: null,
    });

    if (!review) {
      throw new ApiError(404, "Không tìm thấy đánh giá");
    }
    //tăng số lượng like
    const updatedReview = await Review.findByIdAndUpdate(
      reviewId,
      {
        $inc: { numberOfLikes: 1 }
      },
      { new: true }
    );
    
    return {
      success: true,
      message: "Đã thích đánh giá",
      numberOfLikes: updatedReview.numberOfLikes
    };
  },

      /**
   * Lấy danh sách sản phẩm có thể đánh giá từ các đơn hàng đã giao
   * @param {String} userId - ID của người dùng
   * @param {Object} query - Các tham số truy vấn
   * @returns {Object} - Danh sách sản phẩm có thể đánh giá
   */
  getReviewableProducts: async (userId, query = {}) => {
    try {
      const { page = 1, limit = 10, sort = "deliveredAt_desc" } = query;

      // Tìm tất cả đơn hàng đã giao của người dùng
      const orders = await Order.find({
        user: userId, 
        status: "delivered"
      }).sort({ deliveredAt: -1 });

      if (!orders || orders.length === 0) {
        return {
          success: true,
          message: "Không có đơn hàng đã giao nào để đánh giá",
          data: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            totalPages: 0,
          }
        };
      }

      // Tạo mảng chứa tất cả các orderItems từ các đơn hàng đã giao
      let allOrderItems = [];
      
      for (const order of orders) {
        // Thêm thông tin đơn hàng vào mỗi orderItem
        const orderItemsWithOrderInfo = order.orderItems.map(item => ({
          ...item.toObject(),
          orderId: order._id,
          orderCode: order.code,
          deliveredAt: order.deliveredAt
        }));
        
        allOrderItems = [...allOrderItems, ...orderItemsWithOrderInfo];
      }
      
      if (allOrderItems.length === 0) {
        return {
          success: true,
          message: "Không có sản phẩm nào trong các đơn hàng đã giao",
          data: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            totalPages: 0,
          }
        };
      }
      
      // Lấy danh sách OrderItem IDs
      const orderItemIds = allOrderItems.map(item => item._id);
      
      // Tìm các đánh giá đã tồn tại cho các orderItems này
      const existingReviews = await Review.find({
        orderItem: { $in: orderItemIds },
        user: userId,
      }).setOptions({ includeDeleted: true });
      
      // Tạo Set các orderItem IDs đã được đánh giá
      const reviewedOrderItemIds = new Set(existingReviews.map(review => 
        review.orderItem.toString()
      ));
      
      // Lọc ra các orderItems chưa được đánh giá
      let reviewableItems = allOrderItems.filter(item => 
        !reviewedOrderItemIds.has(item._id.toString())
      );

      // Sắp xếp theo yêu cầu
      const [sortField, sortOrder] = sort.split("_");
      if (sortField && sortOrder) {
        reviewableItems.sort((a, b) => {
          if (sortField === "deliveredAt") {
            const valA = a.deliveredAt ? new Date(a.deliveredAt).getTime() : 0;
            const valB = b.deliveredAt ? new Date(b.deliveredAt).getTime() : 0;
            return sortOrder === "desc" ? valB - valA : valA - valB;
          }
          return 0;
        });
      }

      // Phân trang thủ công
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedItems = reviewableItems.slice(startIndex, endIndex);

      // Populate thông tin chi tiết cho các sản phẩm
      const populatedItems = await Promise.all(paginatedItems.map(async (item) => {
        // Lấy thông tin variant
        const variant = await Variant.findById(item.variant)
          .populate("product", "name slug images price")
          .populate("color", "name code");

        // Lấy thông tin size
        const size = await mongoose.model("Size").findById(item.size, "value description");

        // Kiểm tra thời hạn có thể đánh giá (ví dụ: 30 ngày sau khi giao hàng)
        const deliveryDate = new Date(item.deliveredAt);
        const currentDate = new Date();
        const daysSinceDelivery = Math.floor(
          (currentDate - deliveryDate) / (1000 * 60 * 60 * 24)
        );
        const REVIEW_WINDOW_DAYS = 30; // Có thể cấu hình theo yêu cầu
        const canReview = daysSinceDelivery <= REVIEW_WINDOW_DAYS;
        const reviewExpiresAt = new Date(deliveryDate);
        reviewExpiresAt.setDate(reviewExpiresAt.getDate() + REVIEW_WINDOW_DAYS);

        return {
          orderItemId: item._id,
          orderId: item.orderId,
          orderCode: item.orderCode,
          product: variant?.product || null,
          variant: {
            _id: variant?._id || null,
            color: variant?.color || null
          },
          size: size || null,
          quantity: item.quantity,
          price: item.price,
          image: item.image || (variant?.product?.images && variant.product.images.length > 0 
            ? variant.product.images[0].url 
            : null),
          deliveredAt: item.deliveredAt,
          canReview,
          reviewExpiresAt: canReview ? reviewExpiresAt : null,
          daysLeftToReview: canReview ? REVIEW_WINDOW_DAYS - daysSinceDelivery : 0
        };
      }));

      return {
        success: true,
        message: "Danh sách sản phẩm có thể đánh giá",
        data: populatedItems,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: reviewableItems.length,
          totalPages: Math.ceil(reviewableItems.length / parseInt(limit)),
        }
      };
    } catch (error) {
      console.error("Lỗi khi lấy sản phẩm có thể đánh giá:", error);
      throw new ApiError(500, "Lỗi khi lấy sản phẩm có thể đánh giá: " + error.message);
    }
  },

  /**
   * Lấy danh sách đánh giá của người dùng
   * @param {String} userId - ID người dùng
   * @param {Object} query - Các tham số truy vấn
   * @returns {Object} - Danh sách đánh giá phân trang
   */
  getUserReviews: async (userId, query = {}) => {
    const { page = 1, limit = 10, sort = "createdAt_desc" } = query;

    // Xây dựng điều kiện lọc
    const filter = {
      user: userId,
      deletedAt: null,
    };

    // Xây dựng thông tin sắp xếp
    const sortOptions = {};
    if (sort) {
      const [field, order] = sort.split("_");
      sortOptions[field] = order === "desc" ? -1 : 1;
    }

    // Thực hiện truy vấn với phân trang
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: sortOptions,
      populate: [
        { path: "user", select: "name avatar" },
        { path: "product", select: "name images slug" },
        { 
          path: "orderItem", 
          populate: [
            { path: "product", select: "name" },
            { path: "variant", populate: { path: "color", select: "name" } },
            { path: "size", select: "value" }
          ]
        }
      ],
    };

    const result = await paginate(Review, filter, options);

    return {
      success: true,
      data: result.data,
      pagination: {
        page: result.currentPage,
        limit: parseInt(limit),
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.hasNextPage,
        hasPrev: result.hasPrevPage,
      },
    };
  },
};

/**
 * ADMIN REVIEW SERVICE - Quản lý đánh giá
 */
const adminReviewService = {
  /**
   * Lấy danh sách tất cả đánh giá
   * @param {Object} query - Các tham số truy vấn và phân trang
   * @returns {Object} - Danh sách đánh giá phân trang
   */
  getAllReviews: async (query = {}) => {
    const {
      page = 1,
      limit = 10,
      productId,
      userId,
      rating,
      isActive,
      sort = "createdAt_desc",
    } = query;

    // Xây dựng điều kiện lọc
    const filter = {};

    if (productId) {
      // Tìm variantIds cho sản phẩm
      const variants = await Variant.find({ product: productId }).select('_id');
      const variantIds = variants.map(v => v._id);
      
      // Tìm orderItems liên quan đến variants của sản phẩm
      const orderItemsInfo = await Order.aggregate([
        { $unwind: "$orderItems" },
        { $match: { "orderItems.variant": { $in: variantIds.map(id => new mongoose.Types.ObjectId(id)) } } },
        { $project: { orderItemId: "$orderItems._id" } }
      ]);
      
      const orderItemIds = orderItemsInfo.map(item => item.orderItemId);
      filter.orderItem = { $in: orderItemIds };
    }

    if (userId) {
      filter.user = userId;
    }

    if (rating && !isNaN(rating)) {
      filter.rating = parseInt(rating);
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true" || isActive === true;
    }

    // Xây dựng thông tin sắp xếp
    const sortOptions = {};
    if (sort) {
      const [field, order] = sort.split("_");
      sortOptions[field] = order === "desc" ? -1 : 1;
    }

    // Thực hiện truy vấn với phân trang
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: sortOptions,
      populate: [
        { path: "user", select: "name email avatar" },
        { path: "deletedBy", select: "name email" },
        { 
          path: "orderItem", 
          populate: [
            { path: "product", select: "name" },
            { path: "variant", populate: { path: "color", select: "name" } },
            { path: "size", select: "value" }
          ]
        }
      ],
    };

    const result = await paginate(Review, filter, options);

    return {
      success: true,
      data: result.data,
      pagination: {
        page: result.currentPage,
        limit: parseInt(limit),
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.hasNextPage,
        hasPrev: result.hasPrevPage,
      },
    };
  },

  /**
   * Lấy danh sách tất cả đánh giá đã xóa
   * @param {Object} query - Các tham số truy vấn và phân trang
   * @returns {Object} - Danh sách đánh giá phân trang
   */
  getAllReviewsDeleted: async (query = {}) => {
    const { page = 1, limit = 10, productId,
      userId,
      rating,
      isActive, sort = "createdAt_desc" } = query;

    // Xây dựng điều kiện lọc
    const filter = {
      deletedAt: { $ne: null }
    }

    if (productId) {
      filter.product = productId;
    }

    if (userId) {
      filter.user = userId;
    }

    if (rating) {
      filter.rating = rating;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true" || isActive === true;
    }

    // Xây dựng thông tin sắp xếp
    const sortOptions = {};
    if (sort) {
      const [field, order] = sort.split("_");
      sortOptions[field] = order === "desc" ? -1 : 1;
    } 

    // Thực hiện truy vấn với phân trang
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: sortOptions,
      populate: [
        { path: "user", select: "name email avatar" },
        { path: "deletedBy", select: "name email" },
        { 
          path: "orderItem", 
          populate: [
            { path: "product", select: "name" },
            { path: "variant", populate: { path: "color", select: "name" } },
            { path: "size", select: "value" }
          ]
        }
      ],
    };

    const result = await paginate(Review, filter, options);

    return {
      success: true,
      data: result.data,
      pagination: {
        page: result.currentPage,
        limit: parseInt(limit),
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  },

  /**
   * Lấy chi tiết đánh giá (bao gồm cả đánh giá đã xóa)
   * @param {String} reviewId - ID đánh giá
   * @returns {Object} - Chi tiết đánh giá
   */
  getReviewById: async (reviewId) => {
    // Sử dụng option includeDeleted để truy vấn cả review đã xóa mềm
    const review = await Review.findOne({ _id: reviewId })
      .setOptions({ includeDeleted: true })
      .populate([
        { path: "user", select: "name email avatar" },
        { path: "deletedBy", select: "name email" },
        { 
          path: "orderItem", 
          populate: [
            { path: "product", select: "name" },
            { path: "variant", populate: { path: "color", select: "name" } },
            { path: "size", select: "value" }
          ]
        }
      ]);

    if (!review) {
      throw new ApiError(404, "Không tìm thấy đánh giá");
    }

    return {
      success: true,
      review,
      isDeleted: review.deletedAt !== null
    };
  },

  /**
   * Ẩn/hiện đánh giá
   * @param {String} reviewId - ID đánh giá
   * @param {Boolean} isActive - Trạng thái đánh giá (true: hiện, false: ẩn)
   * @returns {Object} - Kết quả cập nhật
   */
  toggleReviewVisibility: async (reviewId, isActive) => {
    const review = await Review.findById(reviewId);

    if (!review) {
      throw new ApiError(404, "Không tìm thấy đánh giá");
    }

    // Không thể kích hoạt lại đánh giá đã xóa mềm
    if (review.deletedAt && isActive) {
      throw new ApiError(400, "Không thể kích hoạt đánh giá đã xóa");
    }

    review.isActive = isActive;
    await review.save();

    const status = isActive ? "hiển thị" : "ẩn";
    return {
      success: true,
      message: `Đã ${status} đánh giá thành công`,
      review,
    };
  },

  /**
   * Khôi phục đánh giá đã xóa mềm
   * @param {String} reviewId - ID đánh giá
   * @returns {Object} - Kết quả khôi phục
   */
  restoreReview: async (reviewId) => {
    const review = await Review.findById(reviewId);

    if (!review) {
      throw new ApiError(404, "Không tìm thấy đánh giá");
    }

    if (!review.deletedAt) {
      throw new ApiError(400, "Đánh giá chưa bị xóa");
    }

    review.deletedAt = null;
    review.deletedBy = null;
    await review.save();

    return {
      success: true,
      message: "Khôi phục đánh giá thành công",
      review,
    };
  },

  /**
   * Thống kê đánh giá theo sản phẩm
   * @param {String} productId - ID sản phẩm
   * @returns {Object} - Thống kê đánh giá
   */
  getProductReviewStats: async (productId) => {
    // Kiểm tra sản phẩm tồn tại
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, "Không tìm thấy sản phẩm");
    }

    // Tìm tất cả variants của sản phẩm này
    const variants = await Variant.find({ product: productId }).select('_id');
    const variantIds = variants.map(v => v._id);

    // Tìm tất cả orderItems từ Order model có chứa các variant của sản phẩm
    const orderItemsInfo = await Order.aggregate([
      { $unwind: "$orderItems" },
      { $match: { "orderItems.variant": { $in: variantIds.map(id => new mongoose.Types.ObjectId(id)) } } },
      { $project: { orderItemId: "$orderItems._id" } }
    ]);

    const orderItemIds = orderItemsInfo.map(item => item.orderItemId);

    // Tính thống kê đánh giá - chỉ từ đánh giá active và không bị xóa mềm
    const stats = await Review.aggregate([
      {
        $match: {
          orderItem: { $in: orderItemIds },
          isActive: true,
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          avgRating: { $avg: "$rating" },
          ratingCounts: {
            $push: "$rating",
          },
        },
      },
    ]);

    // Mặc định nếu không có đánh giá
    let result = {
      totalReviews: 0,
      avgRating: 0,
      ratingDistribution: {
        1: { count: 0, percentage: 0 },
        2: { count: 0, percentage: 0 },
        3: { count: 0, percentage: 0 },
        4: { count: 0, percentage: 0 },
        5: { count: 0, percentage: 0 },
      },
    };

    if (stats.length > 0) {
      // Làm tròn điểm đánh giá đến 1 số thập phân
      result.totalReviews = stats[0].totalReviews;
      result.avgRating = Math.round(stats[0].avgRating * 10) / 10;
      
      // Tính phân phối đánh giá
      if (stats[0].ratingCounts) {
        stats[0].ratingCounts.forEach((rating) => {
          if (rating >= 1 && rating <= 5) {
            result.ratingDistribution[rating].count++;
          }
        });
      }
      
      // Tính phần trăm cho mỗi mức đánh giá
      if (result.totalReviews > 0) {
        for (let i = 1; i <= 5; i++) {
          result.ratingDistribution[i].percentage = 
            Math.round((result.ratingDistribution[i].count / result.totalReviews) * 100);
        }
      }
    }

    // Thêm thống kê về tổng số đánh giá (bao gồm cả đã ẩn và đã xóa)
    const allReviewsCount = await Review.countDocuments({
      orderItem: { $in: orderItemIds },
    });

    const hiddenReviewsCount = await Review.countDocuments({
      orderItem: { $in: orderItemIds },
      isActive: false,
      deletedAt: null,
    });

    const deletedReviewsCount = await Review.countDocuments({
      orderItem: { $in: orderItemIds },
      deletedAt: { $ne: null },
    });

    result.allReviewsStats = {
      total: allReviewsCount,
      active: result.totalReviews,
      hidden: hiddenReviewsCount,
      deleted: deletedReviewsCount,
    };

    return {
      success: true,
      stats: result,
      product: {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        image: product.images && product.images.length > 0 ? product.images[0].url : null
      }
    };
  },
};

// Kết hợp services để export
const exportedReviewService = {
  ...reviewService,
  adminReviewService,
};

module.exports = exportedReviewService;