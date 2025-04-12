const { Order, Cart, CancelRequest, User } = require("@models");
const mongoose = require("mongoose");
const paginate = require("@utils/pagination");
const ApiError = require("@utils/ApiError");

const orderService = {
  /**
   * Lấy danh sách đơn hàng của người dùng
   * @param {String} userId - ID của người dùng
   * @param {Object} query - Các tham số truy vấn
   * @returns {Object} - Danh sách đơn hàng
   */
  getUserOrders: async (userId, query = {}) => {
    const { page = 1, limit = 10, status, sort = "createdAt" } = query;

    // Xây dựng điều kiện lọc
    const filter = { user: userId };
    if (status) filter.status = status;

    // Xây dựng thông tin sắp xếp
    let sortOptions = {};
    if (sort) {
      const [field, order] = sort.split("_");
      sortOptions[field] = order === "desc" ? -1 : 1;
    } else {
      sortOptions = { createdAt: -1 };
    }

    // Sử dụng hàm phân trang
    const populate = [
      { path: "user", select: "name email" },
      { path: "orderItems.product", select: "name images price slug" },
      {
        path: "orderItems.variant",
        select: "name color",
        populate: { path: "color", select: "name code" },
      },
      { path: "orderItems.size", select: "name value" },
    ];

    const result = await paginate(Order, filter, {
      page,
      limit,
      sort: sortOptions,
      populate,
    });

    return {
      orders: result.data,
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
   * Lấy chi tiết đơn hàng
   * @param {String} orderId - ID của đơn hàng
   * @param {String} userId - ID của người dùng (để kiểm tra quyền truy cập)
   * @returns {Object} - Chi tiết đơn hàng
   */
  getOrderById: async (orderId, userId) => {
    // Kiểm tra đơn hàng có tồn tại không
    const order = await Order.findById(orderId)
      .populate("user", "name email avatar")
      .populate({
        path: "orderItems.product",
        select: "name slug images price description",
      })
      .populate({
        path: "orderItems.variant",
        select: "name color price",
        populate: { path: "color", select: "name code" },
      })
      .populate({
        path: "orderItems.size",
        select: "name value",
      })
      .populate("coupon", "code type value maxDiscount")
      .populate("cancelRequestId")
      .lean();

    if (!order) {
      throw new ApiError(404, "Không tìm thấy đơn hàng");
    }

    // Kiểm tra người dùng có quyền xem đơn hàng này không
    if (order.user._id.toString() !== userId) {
      throw new ApiError(403, "Bạn không có quyền xem đơn hàng này");
    }

    return order;
  },

  /**
   * Tạo đơn hàng mới từ giỏ hàng
   * @param {String} userId - ID của người dùng
   * @param {Object} orderData - Dữ liệu đơn hàng
   * @returns {Object} - Đơn hàng đã tạo
   */
  createOrder: async (orderData) => {
    const {
      userId,
      addressId,
      paymentMethod = "COD",
      shippingMethod,
      note,
    } = orderData;

    // Kiểm tra dữ liệu đầu vào
    if (!addressId) {
      throw new ApiError(400, "Vui lòng cung cấp địa chỉ giao hàng");
    }

    // Kiểm tra phương thức thanh toán hợp lệ
    if (!["COD", "VNPAY"].includes(paymentMethod)) {
      throw new ApiError(400, "Phương thức thanh toán không hợp lệ");
    }

    // Lấy địa chỉ giao hàng từ user
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "Không tìm thấy người dùng");
    }

    // Tìm địa chỉ trong danh sách địa chỉ của người dùng
    const shippingAddress = user.addresses.find(
      (addr) => addr._id.toString() === addressId
    );
    if (!shippingAddress) {
      throw new ApiError(404, "Không tìm thấy địa chỉ giao hàng");
    }

    // Lấy giỏ hàng hiện tại
    const cart = await Cart.findOne({ user: userId })
      .populate("cartItems.product")
      .populate("cartItems.variant")
      .populate("cartItems.size")
      .populate("coupon");

    if (!cart || cart.cartItems.length === 0) {
      throw new ApiError(400, "Giỏ hàng trống, không thể tạo đơn hàng");
    }

    // Kiểm tra tồn kho cho từng sản phẩm
    const unavailableItems = [];
    for (const item of cart.cartItems) {
      if (!item.isAvailable) {
        unavailableItems.push({
          productName: item.productName,
          variantName: item.variantName,
          sizeName: item.sizeName,
        });
      }
    }

    if (unavailableItems.length > 0) {
      throw new ApiError(
        400,
        "Một số sản phẩm đã hết hàng hoặc không đủ số lượng"
      );
    }

    // Tính phí vận chuyển
    let shippingFee = 30000; // 30,000 VND
    const totalItems = cart.cartItems.reduce(
      (total, item) => total + item.quantity,
      0
    );
    if (totalItems > 2 && cart.subTotal >= 1000000) {
      shippingFee = 0;
    }

    // Tạo đơn hàng mới
    const newOrder = new Order({
      user: userId,
      orderItems: cart.cartItems.map((item) => ({
        product: item.product._id,
        variant: item.variant._id,
        size: item.size._id,
        productName: item.productName,
        variantName: item.variantName,
        sizeName: item.sizeName,
        quantity: item.quantity,
        price: item.price,
        image: item.image,
      })),
      shippingAddress,
      note: note || "",
      subTotal: cart.subTotal,
      discount: cart.discount || 0,
      shippingFee,
      totalAfterDiscountAndShipping:
        cart.subTotal - (cart.discount || 0) + shippingFee,
      status: "pending",
      payment: {
        method: paymentMethod,
        paymentStatus: paymentMethod === "COD" ? "pending" : "pending",
      },
    });

    // Nếu có coupon, lưu thông tin
    if (cart.coupon) {
      newOrder.coupon = cart.coupon._id;
      newOrder.couponDetail = {
        code: cart.coupon.code,
        type: cart.coupon.type,
        value: cart.coupon.value,
        maxDiscount: cart.coupon.maxDiscount,
      };
    }

    // Lưu đơn hàng
    await newOrder.save();

    // Sau khi tạo đơn hàng, xóa sạch giỏ hàng
    cart.cartItems = [];
    cart.coupon = null;
    cart.couponData = null;
    cart.subTotal = 0;
    cart.discount = 0;
    cart.totalPrice = 0;
    cart.totalItems = 0;
    await cart.save();

    return newOrder;
  },

  /**
   * Hủy đơn hàng
   * @param {String} orderId - ID của đơn hàng
   * @param {String} userId - ID của người dùng
   * @param {Object} cancelData - Dữ liệu hủy đơn hàng
   * @returns {Object} - Kết quả hủy đơn hàng
   */
  cancelOrder: async (orderId, userId, cancelData) => {
    // Kiểm tra đơn hàng
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, "Không tìm thấy đơn hàng");
    }

    // Kiểm tra quyền hủy đơn hàng
    if (order.user.toString() !== userId) {
      throw new ApiError(403, "Bạn không có quyền hủy đơn hàng này");
    }

    // Kiểm tra trạng thái đơn hàng
    if (!["pending", "confirmed"].includes(order.status)) {
      throw new ApiError(
        400,
        "Chỉ có thể hủy đơn hàng khi đang ở trạng thái chờ xác nhận hoặc đã xác nhận"
      );
    }

    // Kiểm tra lý do hủy đơn
    const { reason } = cancelData;
    if (!reason) {
      throw new ApiError(400, "Vui lòng cung cấp lý do hủy đơn hàng");
    }

    // Tạo yêu cầu hủy đơn
    const cancelRequest = new CancelRequest({
      order: orderId,
      user: userId,
      reason,
      status: "pending",
    });

    // Nếu đơn hàng đang ở trạng thái pending, cho phép hủy ngay
    if (order.status === "pending") {
      cancelRequest.status = "approved";
      cancelRequest.approvedAt = new Date();
      cancelRequest.note = "Hủy tự động khi đơn hàng chưa được xác nhận";

      // Cập nhật đơn hàng
      order.status = "cancelled";
      order.cancelledAt = new Date();
      order.cancelledBy = userId;
      order.cancelReason = reason;
      order.cancelRequestId = cancelRequest._id;
      order.hasCancelRequest = true;
    } else {
      // Nếu đơn hàng đã xác nhận, cần chờ admin phê duyệt
      order.cancelRequestId = cancelRequest._id;
      order.hasCancelRequest = true;
    }

    // Lưu thay đổi
    await Promise.all([cancelRequest.save(), order.save()]);

    return {
      message:
        order.status === "cancelled"
          ? "Đơn hàng đã được hủy thành công"
          : "Yêu cầu hủy đơn hàng đã được gửi và đang chờ xử lý",
      cancelRequest,
    };
  },

  /**
   * Kiểm tra xem người dùng có thể đánh giá sản phẩm không
   * @param {String} userId - ID của người dùng
   * @param {String} productId - ID của sản phẩm
   * @returns {Boolean} - Kết quả kiểm tra
   */
  canReviewProduct: async (userId, productId) => {
    // Tìm đơn hàng đã giao thành công, có chứa sản phẩm này
    const orders = await Order.find({
      user: userId,
      status: "delivered",
      "orderItems.product": productId,
    });

    return orders.length > 0;
  },

  /**
   * Lấy danh sách tất cả đơn hàng (cho admin)
   * @param {Object} query - Các tham số truy vấn
   * @returns {Object} - Danh sách đơn hàng
   */
  getAllOrders: async (query = {}) => {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sort = "createdAt_desc",
    } = query;

    // Xây dựng điều kiện lọc
    const filter = {};

    // Lọc theo trạng thái nếu có
    if (status) {
      filter.status = status;
    }

    // Tìm kiếm theo mã đơn hàng hoặc thông tin người dùng
    if (search) {
      const userIds = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      }).distinct("_id");

      filter.$or = [
        { orderCode: { $regex: search, $options: "i" } },
        { user: { $in: userIds } },
        { "shippingAddress.fullName": { $regex: search, $options: "i" } },
        { "shippingAddress.phone": { $regex: search, $options: "i" } },
      ];
    }

    // Xây dựng thông tin sắp xếp
    let sortOptions = {};
    if (sort) {
      const [field, order] = sort.split("_");
      sortOptions[field] = order === "desc" ? -1 : 1;
    } else {
      // Mặc định sắp xếp theo thời gian tạo giảm dần
      sortOptions = { createdAt: -1 };
    }

    // Sử dụng hàm phân trang
    const populate = [
      { path: "user", select: "name email phone" },
      {
        path: "cancelRequestId",
        select: "reason status createdAt approvedAt note",
      },
    ];

    const result = await paginate(Order, filter, {
      page,
      limit,
      sort: sortOptions,
      populate,
    });

    return {
      orders: result.data,
      pagination: {
        page: result.currentPage,
        limit: parseInt(limit),
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  },

  /**
   * Lấy chi tiết đơn hàng (cho admin)
   * @param {String} orderId - ID của đơn hàng
   * @returns {Object} - Chi tiết đơn hàng
   */
  getOrderDetail: async (orderId) => {
    // Kiểm tra đơn hàng có tồn tại không
    const order = await Order.findById(orderId)
      .populate("user", "name email phone avatar")
      .populate({
        path: "orderItems.product",
        select: "name slug images price",
      })
      .populate({
        path: "orderItems.variant",
        select: "name color price",
        populate: { path: "color", select: "name code" },
      })
      .populate({
        path: "orderItems.size",
        select: "name value",
      })
      .populate("coupon", "code type value maxDiscount")
      .populate("cancelRequestId")
      .lean();

    if (!order) {
      throw new ApiError(404, "Không tìm thấy đơn hàng");
    }

    return order;
  },

  /**
   * Cập nhật trạng thái đơn hàng
   * @param {String} orderId - ID của đơn hàng
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Object} - Đơn hàng đã cập nhật
   */
  updateOrderStatus: async (orderId, updateData) => {
    const { status, note } = updateData;

    // Kiểm tra đơn hàng có tồn tại không
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, "Không tìm thấy đơn hàng");
    }

    // Kiểm tra trạng thái hợp lệ
    const validStatusTransitions = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["shipping", "cancelled"],
      shipping: ["delivered", "cancelled"],
      delivered: [],
      cancelled: [],
    };

    if (!validStatusTransitions[order.status].includes(status)) {
      throw new ApiError(
        400,
        `Không thể chuyển từ trạng thái ${order.status} sang ${status}`
      );
    }

    // Cập nhật trạng thái
    const previousStatus = order.status;
    order.status = status;
    order.statusHistory.push({
      status,
      note: note || "",
      updatedAt: new Date(),
    });

    // Cập nhật thông tin thêm tùy thuộc vào trạng thái
    if (status === "confirmed") {
      order.confirmedAt = new Date();
    } else if (status === "shipping") {
      order.shippingAt = new Date();
    } else if (status === "delivered") {
      order.deliveredAt = new Date();

      // Cập nhật trạng thái thanh toán nếu là COD
      if (order.payment.method === "COD") {
        order.payment.paymentStatus = "completed";
        order.payment.paidAt = new Date();
      }
    } else if (status === "cancelled") {
      order.cancelledAt = new Date();
    }

    // Lưu đơn hàng
    await order.save();

    return {
      message: "Cập nhật trạng thái đơn hàng thành công",
      order,
      previousStatus,
    };
  },

  /**
   * Xử lý yêu cầu hủy đơn hàng
   * @param {String} requestId - ID của yêu cầu hủy
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Object} - Kết quả xử lý
   */
  processCancelRequest: async (requestId, updateData) => {
    const { status, note } = updateData;

    // Kiểm tra yêu cầu hủy có tồn tại không
    const cancelRequest = await CancelRequest.findById(requestId);
    if (!cancelRequest) {
      throw new ApiError(404, "Không tìm thấy yêu cầu hủy đơn hàng");
    }

    // Kiểm tra trạng thái hiện tại
    if (cancelRequest.status !== "pending") {
      throw new ApiError(400, "Yêu cầu hủy đơn hàng này đã được xử lý");
    }

    // Kiểm tra trạng thái cập nhật hợp lệ
    if (!["approved", "rejected"].includes(status)) {
      throw new ApiError(400, "Trạng thái không hợp lệ");
    }

    // Cập nhật yêu cầu hủy
    cancelRequest.status = status;
    cancelRequest.note = note || "";
    cancelRequest.processedAt = new Date();

    // Nếu được chấp nhận, cập nhật đơn hàng
    if (status === "approved") {
      const order = await Order.findById(cancelRequest.order);
      if (!order) {
        throw new ApiError(404, "Không tìm thấy đơn hàng liên quan");
      }

      order.status = "cancelled";
      order.cancelledAt = new Date();
      order.hasCancelRequest = true;
      order.cancelReason = cancelRequest.reason;
      order.cancelledBy = cancelRequest.processedBy || null;
      order.statusHistory.push({
        status: "cancelled",
        note: `Đơn hàng bị hủy theo yêu cầu. Lý do: ${cancelRequest.reason}`,
        updatedAt: new Date(),
        updatedBy: cancelRequest.processedBy || null,
      });

      await order.save();
    } else if (status === "rejected") {
      // Nếu từ chối, cập nhật trạng thái yêu cầu hủy
      const order = await Order.findById(cancelRequest.order);
      if (order) {
        order.hasCancelRequest = false;
        order.cancelRequestId = null;
        await order.save();
      }
    }

    // Lưu yêu cầu hủy
    await cancelRequest.save();

    return {
      message:
        status === "approved"
          ? "Đã chấp nhận yêu cầu hủy đơn hàng"
          : "Đã từ chối yêu cầu hủy đơn hàng",
      cancelRequest,
    };
  },

  /**
   * Tạo đơn hàng mới không qua giỏ hàng (cho admin)
   * @param {Object} orderData - Dữ liệu đơn hàng
   * @returns {Object} - Đơn hàng đã tạo
   */
  createOrderByAdmin: async (orderData) => {
    const {
      userId,
      orderItems,
      shippingAddress,
      note,
      shippingFee = 30000,
      paymentMethod = "COD",
      couponId,
    } = orderData;

    // Kiểm tra dữ liệu đầu vào
    if (!userId || !orderItems || orderItems.length === 0 || !shippingAddress) {
      throw new ApiError(400, "Dữ liệu đơn hàng không đầy đủ");
    }

    // Kiểm tra người dùng
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "Không tìm thấy người dùng");
    }

    // Xử lý các mục đơn hàng
    const processedItems = [];
    let subTotal = 0;

    for (const item of orderItems) {
      const { productId, variantId, sizeId, quantity } = item;

      // Kiểm tra dữ liệu sản phẩm, biến thể, kích cỡ thực tế
      const Product = mongoose.model("Product");
      const Variant = mongoose.model("Variant");
      const Size = mongoose.model("Size");

      const [product, variant, size] = await Promise.all([
        Product.findById(productId),
        Variant.findById(variantId),
        Size.findById(sizeId),
      ]);

      if (!product || !variant || !size) {
        throw new ApiError(
          404,
          "Sản phẩm, biến thể hoặc kích cỡ không tồn tại"
        );
      }

      // Kiểm tra tồn kho
      const sizeObj = variant.sizes.find(
        (s) => s.size.toString() === sizeId.toString()
      );

      if (!sizeObj || !sizeObj.isSizeAvailable || sizeObj.quantity < quantity) {
        throw new ApiError(
          400,
          `Sản phẩm ${product.name} - ${variant.name} - ${size.name} không đủ số lượng`
        );
      }

      // Thêm vào danh sách
      const price = variant.priceFinal || variant.price;
      processedItems.push({
        product: productId,
        variant: variantId,
        size: sizeId,
        productName: product.name,
        variantName: variant.name,
        sizeName: size.name || size.value,
        quantity,
        price,
        image: variant.images?.[0] || product.images?.[0],
      });

      subTotal += price * quantity;
    }

    // Xử lý coupon nếu có
    let discount = 0;
    let couponDetail = null;

    if (couponId) {
      const Coupon = mongoose.model("Coupon");
      const coupon = await Coupon.findById(couponId);

      if (
        coupon &&
        coupon.isActive &&
        new Date() >= coupon.startDate &&
        new Date() <= coupon.endDate
      ) {
        couponDetail = {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          maxDiscount: coupon.maxDiscount,
        };

        if (coupon.type === "percent") {
          discount = (subTotal * coupon.value) / 100;
          if (coupon.maxDiscount) {
            discount = Math.min(discount, coupon.maxDiscount);
          }
        } else {
          discount = Math.min(coupon.value, subTotal);
        }
      }
    }

    // Tạo đơn hàng mới
    const orderCode = await generateOrderCode();
    const newOrder = new Order({
      user: userId,
      orderCode,
      orderItems: processedItems,
      shippingAddress,
      note: note || "",
      subTotal,
      discount,
      shippingFee,
      totalAfterDiscountAndShipping: subTotal - discount + shippingFee,
      status: "pending",
      payment: {
        method: paymentMethod,
        paymentStatus: "pending",
      },
      createdBy: "admin",
    });

    if (couponId && couponDetail) {
      newOrder.coupon = couponId;
      newOrder.couponDetail = couponDetail;
    }

    // Lưu đơn hàng
    await newOrder.save();

    return newOrder;
  },

  /**
   * Admin hủy đơn hàng trực tiếp
   * @param {String} orderId - ID của đơn hàng
   * @param {String} adminId - ID của admin
   * @param {Object} cancelData - Dữ liệu hủy đơn
   * @returns {Object} - Đơn hàng đã hủy
   */
  adminCancelOrder: async (orderId, adminId, cancelData) => {
    // Kiểm tra đơn hàng
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, "Không tìm thấy đơn hàng");
    }

    // Kiểm tra trạng thái đơn hàng
    if (["delivered", "cancelled"].includes(order.status)) {
      throw new ApiError(400, "Không thể hủy đơn hàng đã giao hoặc đã hủy");
    }

    // Cập nhật trạng thái đơn hàng
    order.status = "cancelled";
    order.cancelledAt = new Date();
    order.cancelledBy = adminId;
    order.cancelReason = cancelData.reason || "Hủy bởi admin";
    order.hasCancelRequest = false; // Đánh dấu là hủy trực tiếp, không qua quy trình yêu cầu

    // Lưu lịch sử trạng thái
    order.statusHistory.push({
      status: "cancelled",
      updatedAt: new Date(),
      updatedBy: adminId,
      note: `Đơn hàng bị hủy bởi admin. Lý do: ${order.cancelReason}`,
    });

    // Lưu đơn hàng
    await order.save();

    return order;
  },

  /**
   * Lấy thông tin theo dõi đơn hàng
   * @param {String} orderId - ID của đơn hàng
   * @param {String} userId - ID của người dùng
   * @returns {Object} - Lịch sử trạng thái và thông tin đơn hàng
   */
  getOrderTracking: async (orderId, userId) => {
    // Kiểm tra đơn hàng có tồn tại không
    const order = await Order.findById(orderId)
      .populate({
        path: "statusHistory.updatedBy",
        select: "name role",
      })
      .lean();

    if (!order) {
      throw new ApiError(404, "Không tìm thấy đơn hàng");
    }

    // Kiểm tra người dùng có quyền xem đơn hàng này không
    if (order.user.toString() !== userId) {
      throw new ApiError(403, "Bạn không có quyền xem đơn hàng này");
    }

    // Lấy thông tin chi tiết cần thiết cho việc theo dõi
    return {
      orderCode: order.code,
      orderStatus: order.status,
      orderDate: order.createdAt,
      statusHistory: order.statusHistory.map((status) => ({
        status: status.status,
        updatedAt: status.updatedAt,
        updatedBy: status.updatedBy ? status.updatedBy.name : "Hệ thống",
        note: status.note,
      })),
      paymentStatus: order.payment.paymentStatus,
      paymentMethod: order.payment.method,
      shippingAddress: order.shippingAddress,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      hasCancelRequest: order.hasCancelRequest,
    };
  },

  /**
   * Lấy thống kê đơn hàng của người dùng theo trạng thái
   * @param {String} userId - ID của người dùng
   * @returns {Object} - Thống kê số lượng đơn hàng theo trạng thái
   */
  getUserOrderStats: async (userId) => {
    // Lấy tổng số đơn hàng theo từng trạng thái
    const orderStats = await Order.aggregate([
      {
        $match: { user: mongoose.Types.ObjectId(userId) },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Chuyển đổi kết quả thành đối tượng dễ sử dụng
    const stats = {
      pending: 0,
      confirmed: 0,
      shipping: 0,
      delivered: 0,
      cancelled: 0,
      total: 0,
    };

    // Cập nhật số lượng cho từng trạng thái
    orderStats.forEach((stat) => {
      stats[stat._id] = stat.count;
      stats.total += stat.count;
    });

    return stats;
  },
};

/**
 * Tạo mã đơn hàng mới
 * @returns {String} - Mã đơn hàng
 */
const generateOrderCode = async () => {
  // Đếm số lượng đơn hàng hiện có và tạo mã mới
  const count = await Order.countDocuments();
  const orderCode = `DH${String(count + 1).padStart(6, "0")}`;
  return orderCode;
};

module.exports = orderService;
