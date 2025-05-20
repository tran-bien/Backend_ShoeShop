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
    const { page = 1, limit = 10, status} = query;

    // Xây dựng điều kiện lọc
    const filter = { user: userId };
    if (status) filter.status = status;

    // Sử dụng hàm phân trang
    const populate = [
      { path: "user", select: "name email" },
      {
        path: "orderItems.variant",
        select: "color product",
        populate: [
          { path: "color", select: "name code" },
          { path: "product", select: "name slug images price" }
        ]
      },
      { path: "orderItems.size", select: "value description" },
    ];

    const result = await paginate(Order, filter, {
      page,
      limit,
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
        path: "orderItems.variant",
        select: "color price",
        populate: [
          { path: "color", select: "name code" },
          { path: "product", select: "name slug images price description" }
        ]
      })
      .populate({
        path: "orderItems.size",
        select: "value description",
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
   * @param {Object} orderData - Dữ liệu đơn hàng
   * @returns {Object} - Đơn hàng đã tạo
   */
  createOrder: async (orderData) => {
    const {
      userId,
      addressId,
      paymentMethod = "COD",
      note,
      couponCode
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
    const address = user.addresses.find(
      (addr) => addr._id.toString() === addressId
    );
    if (!address) {
      throw new ApiError(404, "Không tìm thấy địa chỉ giao hàng");
    }

    // Ánh xạ từ cấu trúc địa chỉ User sang cấu trúc địa chỉ Order
    const shippingAddress = {
      name: address.fullName,
      phone: address.phone,
      province: address.province,
      district: address.district,
      ward: address.ward,
      detail: address.addressDetail
    };

    // Lấy giỏ hàng hiện tại
    let cart = await Cart.findOne({ user: userId })
      .populate({
        path: "cartItems.variant",
        populate: { path: "product" }
      })
      .populate("cartItems.size");

    if (!cart || cart.cartItems.length === 0) {
      throw new ApiError(400, "Giỏ hàng trống, không thể tạo đơn hàng");
    }

    // Lọc ra những sản phẩm được chọn
    const selectedItems = cart.cartItems.filter(item => item.isSelected);
    
    if (selectedItems.length === 0) {
      throw new ApiError(400, "Vui lòng chọn ít nhất một sản phẩm để thanh toán");
    }

    console.log("Đang kiểm tra tồn kho cho các sản phẩm đã chọn...");
    
    // Kiểm tra trực tiếp tồn kho và chuẩn bị mảng orderItems
    const Variant = mongoose.model("Variant");
    const orderItems = [];
    const unavailableItems = [];
    
    for (const item of selectedItems) {
      const itemId = item._id.toString();
      const variantId = typeof item.variant === 'object' ? item.variant._id : item.variant;
      const variant = await Variant.findById(variantId);
      
      if (!variant) {
        unavailableItems.push({
          productName: item.productName,
          reason: "Không tìm thấy biến thể sản phẩm"
        });
        continue;
      }
      
      const sizeId = typeof item.size === 'object' ? item.size._id : item.size;
      const sizeInfo = variant.sizes.find(s => s.size.toString() === sizeId.toString());
      
      console.log(`Kiểm tra sản phẩm: ${item.productName}`);
      console.log(`- Biến thể: ${variantId}`);
      console.log(`- Kích thước: ${sizeId}`);
      console.log(`- Yêu cầu số lượng: ${item.quantity}`);
      
      if (!sizeInfo) {
        console.log(`- Kết quả: Không tìm thấy kích thước trong biến thể`);
        unavailableItems.push({
          productName: item.productName,
          reason: "Không tìm thấy kích thước cho biến thể này"
        });
        continue;
      }
      
      console.log(`- Trong kho: ${sizeInfo.quantity}`);
      console.log(`- Có sẵn: ${sizeInfo.isSizeAvailable ? "Có" : "Không"}`);
      
      if (!sizeInfo.isSizeAvailable) {
        unavailableItems.push({
          productName: item.productName,
          reason: "Kích thước này hiện không có sẵn"
        });
        continue;
      }
      
      if (sizeInfo.quantity < item.quantity) {
        unavailableItems.push({
          productName: item.productName,
          reason: `Không đủ tồn kho. Hiện còn ${sizeInfo.quantity} sản phẩm.`
        });
        continue;
      }
      
      // Sản phẩm có sẵn, thêm vào danh sách orderItems
      orderItems.push({
        variant: variantId,
        size: sizeId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        image: item.image || "",
      });
    }
    
    // Nếu có sản phẩm không khả dụng
    if (unavailableItems.length > 0) {
      const errorMessage = `Một số sản phẩm không có sẵn: ${unavailableItems.map(item => `${item.productName} (${item.reason})`).join(", ")}`;
      throw new ApiError(400, errorMessage);
    }
    
    // Kiểm tra nếu không có sản phẩm nào khả dụng
    if (orderItems.length === 0) {
      throw new ApiError(400, "Không có sản phẩm nào khả dụng trong giỏ hàng. Vui lòng kiểm tra lại.");
    }

    // Tính tổng giá trị của các sản phẩm
    const subTotal = orderItems.reduce(
      (total, item) => total + (item.price * item.quantity),
      0
    );

    // Xử lý mã giảm giá nếu có
    let coupon = null;
    let discount = 0;
    let couponDetail = null;

    // Chỉ xử lý mã giảm giá nếu có couponCode
    if (couponCode) {
      // Tìm mã giảm giá
      const Coupon = mongoose.model("Coupon");
      coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        status: "active",
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
        $or: [
          { isPublic: true },
          { users: userId }
        ]
      });

      if (!coupon) {
        throw new ApiError(400, "Mã giảm giá không hợp lệ, đã hết hạn hoặc bạn chưa thu thập");
      }

      // Kiểm tra số lần sử dụng
      if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
        throw new ApiError(400, "Mã giảm giá đã hết lượt sử dụng");
      }

      // Kiểm tra giá trị đơn hàng tối thiểu
      if (coupon.minOrderValue && subTotal < coupon.minOrderValue) {
        throw new ApiError(
          400,
          `Giá trị đơn hàng chưa đạt tối thiểu ${coupon.minOrderValue.toLocaleString()}đ để áp dụng mã giảm giá`
        );
      }

      // Tính giảm giá
      if (coupon.type === "percent") {
        discount = (subTotal * coupon.value) / 100;
        if (coupon.maxDiscount) {
          discount = Math.min(discount, coupon.maxDiscount);
        }
      } else { // fixed
        discount = Math.min(coupon.value, subTotal);
      }

      // Lưu chi tiết coupon
      couponDetail = {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        maxDiscount: coupon.maxDiscount,
      };
    }

    // Tính phí vận chuyển
    const DEFAULT_SHIPPING_FEE = 30000;
    const SHIPPING_FREE_THRESHOLD = 1000000;
    const shippingFee = subTotal >= SHIPPING_FREE_THRESHOLD ? 0 : DEFAULT_SHIPPING_FEE;

    // Tạo đơn hàng mới
    const newOrder = new Order({
      user: userId,
      orderItems: orderItems,
      shippingAddress, // Sử dụng đối tượng shippingAddress đã được ánh xạ
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
      statusHistory: [{
        status: "pending",
        updatedAt: new Date(),
        note: "Đơn hàng được tạo"
      }]
    });

    // Nếu có coupon, lưu thông tin và tăng số lần sử dụng
    if (coupon) {
      newOrder.coupon = coupon._id;
      newOrder.couponDetail = couponDetail;
      
      // Tăng số lần sử dụng mã giảm giá
      coupon.currentUses += 1;
      await coupon.save();
    }

    try {
      console.log("Đang lưu đơn hàng mới...");
      // Lưu đơn hàng
      const savedOrder = await newOrder.save();
      console.log("Đã lưu đơn hàng thành công, ID:", savedOrder._id);

      // Sau khi tạo đơn hàng, xóa sạch giỏ hàng
      cart.cartItems = [];
      cart.totalItems = 0;
      cart.subTotal = 0;
      await cart.save();
      console.log("Đã xóa sạch giỏ hàng");

      return savedOrder;
    } catch (error) {
      console.error("Lỗi khi lưu đơn hàng:", error);
      if (error.name === 'ValidationError') {
        console.error("Chi tiết lỗi validation:", JSON.stringify(error.errors, null, 2));
        console.error("Dữ liệu shippingAddress:", JSON.stringify(shippingAddress, null, 2));
      }
      throw error;
    }
  },

  /**
   * Gửi yêu cầu hủy đơn hàng
   * @param {String} orderId - ID của đơn hàng
   * @param {String} userId - ID của người dùng
   * @param {Object} cancelData - Dữ liệu hủy đơn hàng
   * @returns {Object} - Kết quả yêu cầu hủy đơn hàng
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
      cancelRequest.resolvedAt = new Date();
      cancelRequest.adminResponse = "Hủy tự động khi đơn hàng chưa được xác nhận";

      // Cập nhật đơn hàng
      order.status = "cancelled";
      order.cancelledAt = new Date();
      order.cancelReason = reason;
      order.cancelRequestId = cancelRequest._id;
      order.hasCancelRequest = false; // Không còn yêu cầu hủy đang chờ xử lý
      
      // Thêm vào lịch sử
      order.statusHistory.push({
        status: "cancelled",
        updatedAt: new Date(),
        note: `Đơn hàng bị hủy tự động. Lý do: ${reason}`,
      });
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
        { code: { $regex: search, $options: "i" } },
        { user: { $in: userIds } },
        { "shippingAddress.name": { $regex: search, $options: "i" } },
        { "shippingAddress.phone": { $regex: search, $options: "i" } },
      ];
    }

    // Sử dụng hàm phân trang
    const populate = [
      { path: "user", select: "name email phone" },
      {
        path: "cancelRequestId",
        select: "reason status createdAt resolvedAt adminResponse",
      },
    ];

    const result = await paginate(Order, filter, {
      page,
      limit,
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
        path: "orderItems.variant",
        select: "color price",
        populate: [
          { path: "color", select: "name code" },
          { path: "product", select: "name slug images price" }
        ]
      })
      .populate({
        path: "orderItems.size",
        select: "value description",
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

    // Kiểm tra nếu đơn hàng có yêu cầu hủy đang chờ xử lý
    if (order.hasCancelRequest && status !== "cancelled") {
      throw new ApiError(
        400,
        "Đơn hàng có yêu cầu hủy đang chờ xử lý, không thể chuyển sang trạng thái khác"
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
        order.payment.paymentStatus = "paid";
        order.payment.paidAt = new Date();
      }
    } else if (status === "cancelled") {
      order.cancelledAt = new Date();
      
      // Nếu đơn hàng có yêu cầu hủy, đánh dấu đã xử lý
      if (order.hasCancelRequest && order.cancelRequestId) {
        // Cập nhật cancel request nếu có
        await CancelRequest.findByIdAndUpdate(order.cancelRequestId, {
          status: "approved",
          resolvedAt: new Date(),
          adminResponse: note || "Yêu cầu hủy đơn hàng được chấp nhận"
        });
        
        order.hasCancelRequest = false;
      }
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
    const { status, adminResponse } = updateData;

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
    cancelRequest.adminResponse = adminResponse || "";
    cancelRequest.resolvedAt = new Date();

    // Nếu được chấp nhận, cập nhật đơn hàng
    if (status === "approved") {
      const order = await Order.findById(cancelRequest.order);
      if (!order) {
        throw new ApiError(404, "Không tìm thấy đơn hàng liên quan");
      }

      order.status = "cancelled";
      order.cancelledAt = new Date();
      order.hasCancelRequest = false;
      order.cancelReason = cancelRequest.reason;
      order.statusHistory.push({
        status: "cancelled",
        note: `Đơn hàng bị hủy theo yêu cầu. Lý do: ${cancelRequest.reason}`,
        updatedAt: new Date(),
      });

      await order.save();
    } else if (status === "rejected") {
      // Nếu từ chối, cập nhật đơn hàng để loại bỏ trạng thái yêu cầu hủy
      const order = await Order.findById(cancelRequest.order);
      if (order) {
        order.hasCancelRequest = false;
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

module.exports = orderService;