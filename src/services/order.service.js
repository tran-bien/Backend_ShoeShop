const { Order, Cart, CancelRequest, User, InventoryItem } = require("@models");
const mongoose = require("mongoose");
const paginate = require("@utils/pagination");
const ApiError = require("@utils/ApiError");

const orderService = {
  /**
   * Lấy danh sách đơn hàng của người dùng
   * @param {String} userId - ID của người dùng
   * @param {Object} query - Các tham số truy vấn
   * @returns {Object} - Danh sách đơn hàng và thống kê
   */
  getUserOrders: async (userId, query = {}) => {
    const { page = 1, limit = 90, status, search } = query;

    // Xây dựng điều kiện lọc
    const filter = { user: userId };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: "i" } },
        { "shippingAddress.name": { $regex: search, $options: "i" } },
        { "shippingAddress.phone": { $regex: search, $options: "i" } },
      ];
    }

    // Sử dụng hàm phân trang
    const populate = [
      { path: "user", select: "name email" },
      {
        path: "orderItems.variant",
        select: "color product",
        populate: [
          { path: "color", select: "name code" },
          { path: "product", select: "name slug images price" },
        ],
      },
      { path: "orderItems.size", select: "value description" },
    ];

    const result = await paginate(Order, filter, {
      page,
      limit,
      populate,
    });

    // Thống kê số đơn hàng theo trạng thái
    const orderStatsAgg = await Order.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const stats = {
      pending: 0,
      confirmed: 0,
      shipping: 0,
      delivered: 0,
      cancelled: 0,
      total: 0,
    };

    orderStatsAgg.forEach(({ _id, count }) => {
      stats[_id] = count;
      stats.total += count;
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
      stats,
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
        select: "color gender imagesvariant", // FIXED: Removed 'price' - không còn trong Variant schema
        populate: [
          { path: "color", select: "name code" },
          { path: "product", select: "name slug images price description" },
        ],
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
      couponCode,
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
      detail: address.addressDetail,
    };

    // Lấy giỏ hàng hiện tại
    let cart = await Cart.findOne({ user: userId })
      .populate({
        path: "cartItems.variant",
        populate: { path: "product" },
      })
      .populate("cartItems.size");

    if (!cart || cart.cartItems.length === 0) {
      throw new ApiError(400, "Giỏ hàng trống, không thể tạo đơn hàng");
    }

    // Lọc ra những sản phẩm được chọn
    const selectedItems = cart.cartItems.filter((item) => item.isSelected);

    if (selectedItems.length === 0) {
      throw new ApiError(
        400,
        "Vui lòng chọn ít nhất một sản phẩm để thanh toán"
      );
    }

    console.log("Đang kiểm tra tồn kho cho các sản phẩm đã chọn...");

    // Kiểm tra trực tiếp tồn kho và chuẩn bị mảng orderItems
    const Variant = mongoose.model("Variant");
    const orderItems = [];
    const unavailableItems = [];

    for (const item of selectedItems) {
      const itemId = item._id.toString();
      const variantId =
        typeof item.variant === "object" ? item.variant._id : item.variant;
      const variant = await Variant.findById(variantId).select("product sizes");

      if (!variant) {
        unavailableItems.push({
          productName: item.productName,
          reason: "Không tìm thấy biến thể sản phẩm",
        });
        continue;
      }

      const sizeId = typeof item.size === "object" ? item.size._id : item.size;

      // Kiểm tra size có trong variant không
      const sizeExists = variant.sizes.some(
        (s) => s.size.toString() === sizeId.toString()
      );

      console.log(`Kiểm tra sản phẩm: ${item.productName}`);
      console.log(`- Biến thể: ${variantId}`);
      console.log(`- Kích thước: ${sizeId}`);
      console.log(`- Yêu cầu số lượng: ${item.quantity}`);

      if (!sizeExists) {
        console.log(`- Kết quả: Không tìm thấy kích thước trong biến thể`);
        unavailableItems.push({
          productName: item.productName,
          reason: "Không tìm thấy kích thước cho biến thể này",
        });
        continue;
      }

      // Kiểm tra tồn kho từ InventoryItem
      const inventoryItem = await InventoryItem.findOne({
        product: variant.product,
        variant: variantId,
        size: sizeId,
      });

      console.log(
        `- Trong kho (InventoryItem): ${inventoryItem?.quantity || 0}`
      );
      console.log(
        `- Có sẵn: ${
          inventoryItem && inventoryItem.quantity > 0 ? "Có" : "Không"
        }`
      );

      if (!inventoryItem || inventoryItem.quantity === 0) {
        unavailableItems.push({
          productName: item.productName,
          reason: "Sản phẩm hiện không có sẵn trong kho",
        });
        continue;
      }

      if (inventoryItem.quantity < item.quantity) {
        unavailableItems.push({
          productName: item.productName,
          reason: `Không đủ tồn kho. Hiện còn ${inventoryItem.quantity} sản phẩm.`,
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
      const errorMessage = `Một số sản phẩm không có sẵn: ${unavailableItems
        .map((item) => `${item.productName} (${item.reason})`)
        .join(", ")}`;
      throw new ApiError(400, errorMessage);
    }

    // Kiểm tra nếu không có sản phẩm nào khả dụng
    if (orderItems.length === 0) {
      throw new ApiError(
        400,
        "Không có sản phẩm nào khả dụng trong giỏ hàng. Vui lòng kiểm tra lại."
      );
    }

    // Tính tổng giá trị của các sản phẩm
    const subTotal = orderItems.reduce(
      (total, item) => total + item.price * item.quantity,
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
        $or: [{ isPublic: true }, { users: userId }],
      })
        .populate("applicableProducts")
        .populate("applicableVariants")
        .populate("applicableCategories");

      if (!coupon) {
        throw new ApiError(
          400,
          "Mã giảm giá không hợp lệ, đã hết hạn hoặc bạn chưa thu thập"
        );
      }

      // Kiểm tra số lần sử dụng toàn cục
      if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
        throw new ApiError(422, "Mã giảm giá đã hết lượt sử dụng");
      }

      // Kiểm tra giá trị đơn hàng tối thiểu
      if (coupon.minOrderValue && subTotal < coupon.minOrderValue) {
        throw new ApiError(
          400,
          `Giá trị đơn hàng chưa đạt tối thiểu ${coupon.minOrderValue.toLocaleString()}đ để áp dụng mã giảm giá`
        );
      }

      // Populate orderItems với đầy đủ thông tin cho validation
      const populatedOrderItems = await Promise.all(
        orderItems.map(async (item) => {
          const variant = await Variant.findById(item.variant)
            .populate("product")
            .populate({
              path: "product",
              populate: { path: "category" },
            });

          return {
            ...item,
            variant: variant,
          };
        })
      );

      // Validate advanced coupon conditions (scope, tier, firstOrder, etc.)
      const couponService = require("@services/coupon.service");
      const validation = await couponService.validateAdvancedCoupon(
        coupon,
        userId,
        populatedOrderItems
      );

      if (!validation.isValid) {
        throw new ApiError(422, validation.message);
      }

      // Calculate discount dựa trên scope (ALL/PRODUCTS/VARIANTS/CATEGORIES)
      const discountResult = couponService.calculateApplicableDiscount(
        coupon,
        populatedOrderItems,
        subTotal
      );

      discount = discountResult.discountAmount;

      // Lưu chi tiết coupon
      couponDetail = {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        maxDiscount: coupon.maxDiscount,
        scope: coupon.scope,
        applicableSubtotal: discountResult.applicableSubtotal,
      };
    }

    // Tính phí vận chuyển
    const DEFAULT_SHIPPING_FEE = 30000;
    const SHIPPING_FREE_THRESHOLD = 1000000;
    const shippingFee =
      subTotal >= SHIPPING_FREE_THRESHOLD ? 0 : DEFAULT_SHIPPING_FEE;

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
      statusHistory: [
        {
          status: "pending",
          updatedAt: new Date(),
          note: "Đơn hàng được tạo",
        },
      ],
      inventoryDeducted: paymentMethod === "COD", // Chỉ đánh dấu true nếu là COD
    });

    // Nếu có coupon, lưu thông tin và tăng số lần sử dụng
    if (coupon) {
      newOrder.coupon = coupon._id;
      newOrder.couponDetail = couponDetail;

      // Tăng số lần sử dụng toàn cục
      coupon.currentUses += 1;

      // Tăng số lần sử dụng per user (userUsage array)
      const userUsageIndex = coupon.userUsage.findIndex(
        (u) => u.user.toString() === userId.toString()
      );

      if (userUsageIndex !== -1) {
        // User đã từng dùng coupon này, tăng usageCount
        coupon.userUsage[userUsageIndex].usageCount += 1;
        coupon.userUsage[userUsageIndex].lastUsedAt = new Date();
      } else {
        // Lần đầu user dùng coupon này, thêm vào array
        coupon.userUsage.push({
          user: userId,
          usageCount: 1,
          lastUsedAt: new Date(),
        });
      }

      await coupon.save();
    }

    try {
      console.log("Đang lưu đơn hàng mới...");
      // Lưu đơn hàng
      const savedOrder = await newOrder.save();
      console.log("Đã lưu đơn hàng thành công, ID:", savedOrder._id);

      // ============================================================
      // INVENTORY MANAGEMENT - ĐÃ CHUYỂN SANG INVENTORYSERVICE
      // ============================================================
      // COD: KHÔNG TRỪ KHO Ở ĐÂY NỮA
      // VNPAY: KHÔNG TRỪ KHO Ở ĐÂY NỮA
      //
      // Inventory sẽ được tự động trừ KHI GÁN SHIPPER
      // Xem: shipper.service.js -> assignOrderToShipper() -> inventoryService.stockOut()
      //
      // Lý do: Đảm bảo tồn kho chỉ bị trừ khi đơn hàng thực sự được xử lý,
      // tránh trường hợp user tạo đơn rồi không thanh toán (VNPAY) hoặc hủy (COD)
      // ============================================================

      console.log(
        "Đơn hàng được tạo. Inventory sẽ được trừ khi assign shipper."
      );

      // Start of Selection
      // Sau khi tạo đơn hàng, xóa sản phẩm đã chọn trong giỏ hàng
      const itemsToRemove = cart.cartItems.filter(
        (item) => item.isSelected && item.isAvailable
      );
      if (itemsToRemove.length > 0) {
        cart.cartItems = cart.cartItems.filter(
          (item) => !(item.isSelected && item.isAvailable)
        );
        cart.totalItems = cart.cartItems.reduce(
          (sum, item) => sum + item.quantity,
          0
        );
        cart.subTotal = cart.cartItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        await cart.save();
        console.log(
          `Đã xóa ${itemsToRemove.length} sản phẩm đã chọn khỏi giỏ hàng`
        );
      }
      // End of Selectio

      return savedOrder;
    } catch (error) {
      console.error("Lỗi khi lưu đơn hàng:", error);
      if (error.name === "ValidationError") {
        console.error(
          "Chi tiết lỗi validation:",
          JSON.stringify(error.errors, null, 2)
        );
        console.error(
          "Dữ liệu shippingAddress:",
          JSON.stringify(shippingAddress, null, 2)
        );
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

    // Lưu yêu cầu hủy
    await cancelRequest.save();

    // Nếu đơn hàng đang ở trạng thái PENDING → Cho phép hủy ngay (tự động)
    if (order.status === "pending") {
      // Cập nhật yêu cầu hủy thành đã duyệt
      cancelRequest.status = "approved";
      cancelRequest.resolvedAt = new Date();
      cancelRequest.adminResponse = "Tự động duyệt cho đơn hàng pending";
      await cancelRequest.save();

      // Tạo bản ghi lịch sử mới
      const newHistoryEntry = {
        status: "cancelled",
        updatedAt: new Date(),
        note: `Đơn hàng bị hủy tự động. Lý do: ${reason}`,
      };

      // Cập nhật trạng thái đơn hàng
      const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId },
        {
          $set: {
            status: "cancelled",
            cancelledAt: new Date(),
            cancelReason: reason,
            cancelRequestId: cancelRequest._id,
            hasCancelRequest: false,
          },
          $addToSet: { statusHistory: newHistoryEntry },
        },
        { new: true }
      );

      // Xóa duplicate statusHistory nếu có
      const cancelledEntries = updatedOrder.statusHistory.filter(
        (entry) => entry.status === "cancelled"
      );

      if (cancelledEntries.length > 1) {
        const latestCancelledEntry =
          cancelledEntries[cancelledEntries.length - 1];

        const uniqueHistory = updatedOrder.statusHistory.filter((entry) => {
          return (
            entry.status !== "cancelled" ||
            entry._id.toString() === latestCancelledEntry._id.toString()
          );
        });

        await Order.updateOne(
          { _id: orderId },
          { $set: { statusHistory: uniqueHistory } }
        );
      }

      // Middleware sẽ tự động restore inventory nếu inventoryDeducted = true

      return {
        success: true,
        message: "Đơn hàng đã được hủy thành công",
        cancelRequest,
      };
    } else {
      // Nếu đơn hàng đã CONFIRMED → Cần admin duyệt
      order.hasCancelRequest = true;
      order.cancelRequestId = cancelRequest._id;
      await order.save();

      return {
        success: true,
        message: "Yêu cầu hủy đơn hàng đã được gửi và đang chờ xử lý",
        cancelRequest: await cancelRequest.populate("user", "name email phone"),
      };
    }
  },

  /**
   * Admin/Staff duyệt yêu cầu hủy đơn
   */
  processCancelRequest: async (cancelRequestId, decision, adminId) => {
    const cancelRequest = await CancelRequest.findById(
      cancelRequestId
    ).populate("order");

    if (!cancelRequest) {
      throw new ApiError(404, "Không tìm thấy yêu cầu hủy đơn");
    }

    if (cancelRequest.status !== "pending") {
      throw new ApiError(400, "Yêu cầu hủy đơn đã được xử lý");
    }

    const order = cancelRequest.order;
    if (!order) {
      throw new ApiError(404, "Không tìm thấy đơn hàng");
    }

    // Cập nhật cancel request
    cancelRequest.status = decision.approved ? "approved" : "rejected";
    cancelRequest.processedBy = adminId;
    cancelRequest.resolvedAt = new Date();
    cancelRequest.adminResponse = decision.note || "";
    await cancelRequest.save();

    if (decision.approved) {
      // Nếu DUYỆT → Cancel order
      // Tạo bản ghi lịch sử mới
      const newHistoryEntry = {
        status: "cancelled",
        updatedAt: new Date(),
        note: `Đơn hàng bị hủy. Lý do: ${cancelRequest.reason}`,
      };

      // Cập nhật trạng thái đơn hàng
      const updatedOrder = await Order.findOneAndUpdate(
        { _id: order._id },
        {
          $set: {
            status: "cancelled",
            cancelledAt: new Date(),
            cancelReason: cancelRequest.reason,
            hasCancelRequest: false,
          },
          $addToSet: { statusHistory: newHistoryEntry },
        },
        { new: true }
      );

      // Xóa duplicate statusHistory nếu có
      const cancelledEntries = updatedOrder.statusHistory.filter(
        (entry) => entry.status === "cancelled"
      );

      if (cancelledEntries.length > 1) {
        const latestCancelledEntry =
          cancelledEntries[cancelledEntries.length - 1];

        const uniqueHistory = updatedOrder.statusHistory.filter(
          (entry, index) => {
            return (
              entry.status !== "cancelled" ||
              entry._id.toString() === latestCancelledEntry._id.toString()
            );
          }
        );

        await Order.updateOne(
          { _id: order._id },
          { $set: { statusHistory: uniqueHistory } }
        );
      }

      // Hoàn trả tồn kho nếu đã trừ (logic này sẽ được middleware xử lý tự động)
      // Middleware sẽ check inventoryDeducted và restore inventory

      return {
        success: true,
        message: "Đã phê duyệt yêu cầu hủy đơn. Đơn hàng đã được hủy",
        order: updatedOrder,
      };
    } else {
      // Nếu TỪ CHỐI → Giữ nguyên order, chỉ update flag
      order.hasCancelRequest = false;
      await order.save();

      return {
        success: true,
        message: "Đã từ chối yêu cầu hủy đơn",
        cancelRequest,
      };
    }
  },

  /**
   * DEPRECATED - Phần auto cancel cho pending orders đã bị xóa
   * Bây giờ TẤT CẢ cancel requests đều phải qua admin duyệt
   */

  /**
   * Lấy danh sách yêu cầu hủy đơn hàng (cho admin)
   * @param {Object} query - Các tham số truy vấn
   * @returns {Object} - Danh sách yêu cầu hủy đơn hàng
   */
  getCancelRequests: async (query = {}) => {
    const { page = 1, limit = 50, status, search } = query;

    const filter = {};

    // Lọc theo trạng thái nếu có
    if (status) {
      filter.status = status;
    }

    // Tìm kiếm
    if (search) {
      // Tìm user phù hợp với từ khóa tìm kiếm
      const User = mongoose.model("User");
      const userIds = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      }).distinct("_id");

      // Tìm order phù hợp với từ khóa tìm kiếm
      const Order = mongoose.model("Order");
      const orderIds = await Order.find({
        code: { $regex: search, $options: "i" },
      }).distinct("_id");

      filter.$or = [{ user: { $in: userIds } }, { order: { $in: orderIds } }];
    }

    const populate = [
      { path: "user", select: "name email phone avatar" },
      {
        path: "order",
        select: "code status payment totalAfterDiscountAndShipping createdAt",
        populate: { path: "user", select: "name email" },
      },
      { path: "processedBy", select: "name email" },
    ];

    const result = await paginate(CancelRequest, filter, {
      page,
      limit,
      populate,
      sort: { createdAt: -1 }, // Sắp xếp theo thời gian tạo mới nhất
    });

    return {
      cancelRequests: result.data,
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
   * Lấy danh sách yêu cầu hủy đơn hàng của người dùng
   * @param {String} userId - ID của người dùng
   * @param {Object} query - Các tham số truy vấn
   * @returns {Object} - Danh sách yêu cầu hủy đơn hàng
   */
  getUserCancelRequests: async (userId, query = {}) => {
    const { page = 1, limit = 50, status } = query;

    const filter = { user: userId };
    if (status) {
      filter.status = status;
    }

    const populate = [
      {
        path: "order",
        select: "code status payment totalAfterDiscountAndShipping createdAt",
      },
    ];

    const result = await paginate(CancelRequest, filter, {
      page,
      limit,
      populate,
      sort: { createdAt: -1 },
    });

    return {
      cancelRequests: result.data,
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
   * Lấy danh sách tất cả đơn hàng (cho admin)
   * @param {Object} query - Các tham số truy vấn
   * @returns {Object} - Danh sách đơn hàng
   */
  getAllOrders: async (query = {}) => {
    const { page = 1, limit = 90, status, search } = query;

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
        select: "color gender imagesvariant", // FIXED: Removed 'price' - không còn trong Variant schema
        populate: [
          { path: "color", select: "name code" },
          { path: "product", select: "name slug images price" },
        ],
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
    const order = await Order.findById(orderId).populate("cancelRequestId");
    if (!order) {
      throw new ApiError(404, "Không tìm thấy đơn hàng");
    }

    // Kiểm tra nếu trạng thái không thay đổi
    if (order.status === status) {
      throw new ApiError(400, `Đơn hàng đã ở trạng thái ${status}`);
    }

    // Kiểm tra các trạng thái chuyển đổi hợp lệ
    const validStatusTransitions = {
      pending: ["confirmed"],
      confirmed: ["shipping"],
      shipping: ["delivered"],
      delivered: [],
      cancelled: ["refunded"], // Admin có thể hoàn tiền sau khi hủy
      returned: ["refunded"], // Admin có thể hoàn tiền sau khi nhận hàng trả
      refunded: [],
    };

    // Xử lý riêng trường hợp chuyển sang trạng thái "cancelled"
    if (status === "cancelled") {
      // Admin không thể trực tiếp hủy đơn hàng mà phải thông qua yêu cầu hủy
      if (!order.hasCancelRequest) {
        throw new ApiError(
          400,
          "Không thể hủy đơn hàng trực tiếp. Cần có yêu cầu hủy từ khách hàng."
        );
      }

      // Kiểm tra yêu cầu hủy có hợp lệ không
      if (!order.cancelRequestId) {
        throw new ApiError(
          400,
          "Không tìm thấy thông tin yêu cầu hủy đơn hàng"
        );
      }

      // Kiểm tra trạng thái của yêu cầu hủy
      const cancelRequest =
        order.cancelRequestId instanceof mongoose.Document
          ? order.cancelRequestId
          : await CancelRequest.findById(order.cancelRequestId);

      if (!cancelRequest) {
        throw new ApiError(404, "Không tìm thấy yêu cầu hủy đơn hàng");
      }

      if (cancelRequest.status !== "pending") {
        throw new ApiError(
          400,
          `Yêu cầu hủy đã được xử lý với trạng thái: ${cancelRequest.status}`
        );
      }
    }
    // Kiểm tra trạng thái chuyển đổi thông thường nếu không phải trường hợp hủy
    else if (!validStatusTransitions[order.status].includes(status)) {
      throw new ApiError(
        400,
        `Không thể chuyển từ trạng thái ${order.status} sang ${status}`
      );
    }

    // Kiểm tra thanh toán VNPAY: đảm bảo đã thanh toán trước khi chuyển sang các trạng thái tiếp theo
    if (
      order.payment.method === "VNPAY" &&
      ["confirmed", "shipping", "delivered"].includes(status) &&
      order.payment.paymentStatus !== "paid"
    ) {
      throw new ApiError(
        400,
        `Đơn hàng VNPAY chưa được thanh toán, không thể chuyển sang trạng thái ${status}`
      );
    }

    // Kiểm tra nếu đơn hàng có yêu cầu hủy đang chờ xử lý và đang cố gắng chuyển sang trạng thái khác
    if (order.hasCancelRequest && status !== "cancelled") {
      throw new ApiError(
        400,
        "Đơn hàng có yêu cầu hủy đang chờ xử lý, phải xử lý yêu cầu hủy trước khi thay đổi trạng thái"
      );
    }

    // Lưu trạng thái trước khi cập nhật
    const previousStatus = order.status;

    // Cập nhật trạng thái đơn hàng
    order.status = status;

    // Thêm vào lịch sử trạng thái
    order.statusHistory.push({
      status,
      note: note || "",
      updatedAt: new Date(),
      // Có thể thêm updatedBy nếu có thông tin người cập nhật
    });

    // Cập nhật thông tin thêm tùy thuộc vào trạng thái
    switch (status) {
      case "confirmed":
        order.confirmedAt = new Date();
        break;
      case "shipping":
        order.shippingAt = new Date();
        break;
      case "delivered":
        order.deliveredAt = new Date();
        // Cập nhật trạng thái thanh toán cho COD
        if (
          order.payment.method === "COD" &&
          order.payment.paymentStatus !== "paid"
        ) {
          order.payment.paymentStatus = "paid";
          order.payment.paidAt = new Date();
        }
        break;
      case "cancelled":
        order.cancelledAt = new Date();

        // Nếu đơn hàng có yêu cầu hủy, đánh dấu đã xử lý
        if (order.cancelRequestId) {
          // Cập nhật cancel request
          await CancelRequest.findByIdAndUpdate(order.cancelRequestId, {
            status: "approved",
            resolvedAt: new Date(),
            adminResponse: note || "Yêu cầu hủy đơn hàng được chấp nhận",
          });
          order.hasCancelRequest = false;
          order.cancelReason =
            order.cancelRequestId.reason ||
            "Đã chấp nhận yêu cầu hủy từ khách hàng";
        }
        break;
    }

    // Lưu đơn hàng
    await order.save();

    return {
      success: true,
      message: `Đã cập nhật trạng thái đơn hàng từ ${previousStatus} sang ${status}`,
      data: {
        orderId: order._id,
        code: order.code,
        previousStatus,
        currentStatus: status,
        updatedAt: new Date(),
      },
    };
  },

  /**
   * Xử lý yêu cầu hủy đơn hàng cho admin
   * @param {String} requestId - ID của yêu cầu hủy đơn hàng
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Object} - Kết quả xử lý
   */
  /**
   * Xác nhận nhận hàng trả về (Option 2)
   * @param {String} orderId - ID của đơn hàng
   * @param {Object} data - Dữ liệu xác nhận
   * @param {String} data.confirmedBy - ID của người xác nhận (Staff/Admin)
   * @param {String} data.notes - Ghi chú xác nhận
   * @returns {Object} - Đơn hàng đã được cập nhật
   */
  confirmReturn: async (orderId, data) => {
    const { confirmedBy, notes = "" } = data;

    // Kiểm tra đơn hàng tồn tại
    const order = await Order.findById(orderId).populate([
      {
        path: "orderItems.variant",
        select: "product color",
        populate: { path: "product", select: "_id name" },
      },
      { path: "orderItems.size", select: "_id value" },
    ]);
    if (!order) {
      throw new ApiError(404, "Không tìm thấy đơn hàng");
    }

    // Kiểm tra trạng thái đơn hàng (chấp nhận: cancelled, returned, returning_to_warehouse)
    const validStatuses = ["cancelled", "returned", "returning_to_warehouse"];
    if (!validStatuses.includes(order.status)) {
      throw new ApiError(
        400,
        `Chỉ có thể xác nhận nhận hàng cho đơn hàng đã hủy hoặc trả về. Status hiện tại: ${order.status}`
      );
    }

    // Kiểm tra đã xác nhận chưa
    if (order.returnConfirmed) {
      throw new ApiError(
        400,
        "Đơn hàng này đã được xác nhận nhận hàng trước đó"
      );
    }

    // Kiểm tra có trừ tồn kho chưa
    if (!order.inventoryDeducted) {
      throw new ApiError(
        400,
        "Đơn hàng này chưa trừ tồn kho nên không cần xác nhận nhận hàng"
      );
    }

    // Xác định lý do hoàn kho
    const stockInReason =
      order.status === "returning_to_warehouse"
        ? "delivery_failed"
        : order.status === "returned"
        ? "return"
        : "cancelled";

    // Hoàn kho thủ công (vì middleware chỉ chạy khi returnConfirmed = true)
    const inventoryService = require("@services/inventory.service");
    for (const item of order.orderItems) {
      // Lấy productId từ variant
      const productId = item.variant?.product?._id || item.variant?.product;

      if (!productId) {
        console.error(
          `[confirmReturn] Không tìm thấy productId từ variant ${item.variant?._id}`
        );
        continue;
      }

      await inventoryService.stockIn(
        {
          product: productId,
          variant: item.variant?._id || item.variant,
          size: item.size?._id || item.size,
          quantity: item.quantity,
          costPrice: 0, // Hàng trả về không tính giá nhập
          reason: stockInReason,
          reference: order._id, // ✅ FIXED: ObjectId thay vì object
          notes: `Staff xác nhận nhận hàng trả về - ${
            notes || order.cancelReason || "Hoàn kho"
          }`,
        },
        confirmedBy
      );
    }

    // Nếu từ "returning_to_warehouse" → chuyển sang "cancelled"
    if (order.status === "returning_to_warehouse") {
      order.status = "cancelled";
      order.cancelledAt = new Date();
    }

    // Cập nhật trạng thái xác nhận
    order.returnConfirmed = true;
    order.returnConfirmedAt = new Date();
    order.returnConfirmedBy = confirmedBy;
    order.inventoryDeducted = false; // Reset flag sau khi hoàn kho

    // Thêm ghi chú vào statusHistory
    order.statusHistory.push({
      status: order.status,
      updatedAt: new Date(),
      updatedBy: confirmedBy,
      note: `[Xác nhận nhận hàng trả về] ${
        notes || "Đã nhận hàng về kho và hoàn tồn kho"
      }`,
    });

    // Lưu đơn hàng - Middleware KHÔNG chạy hoàn kho nữa vì đã xử lý thủ công ở trên
    await order.save();

    // Populate để trả về thông tin đầy đủ
    await order.populate([
      { path: "user", select: "name email" },
      { path: "returnConfirmedBy", select: "name email role" },
      {
        path: "orderItems.variant",
        select: "color product",
        populate: [
          { path: "color", select: "name code" },
          { path: "product", select: "name slug" },
        ],
      },
      { path: "orderItems.size", select: "value" },
    ]);

    return {
      success: true,
      message: "Đã xác nhận nhận hàng trả về và hoàn tồn kho thành công",
      data: order,
    };
  },

  /**
   * Xử lý hoàn tiền cho đơn hàng (MANUAL ONLY - Không có VNPAY auto refund)
   * Flow: Admin nhận thông tin tài khoản từ khách → Chuyển khoản thủ công → Đánh dấu hoàn tất
   * @param {String} orderId - ID đơn hàng
   * @param {Object} refundData - { amount, method, bankInfo?, notes }
   * @param {String} processedBy - ID admin xử lý
   * @returns {Object}
   */
  processRefund: async (orderId, refundData, processedBy) => {
    const { amount, method, bankInfo, notes } = refundData;

    // Kiểm tra đơn hàng
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, "Không tìm thấy đơn hàng");
    }

    // Kiểm tra trạng thái - chỉ cho phép refund từ cancelled hoặc returned
    if (!["cancelled", "returned"].includes(order.status)) {
      throw new ApiError(
        400,
        `Không thể hoàn tiền cho đơn hàng ở trạng thái "${order.status}". Chỉ chấp nhận: cancelled, returned`
      );
    }

    // Kiểm tra đơn đã hoàn tiền chưa
    if (order.status === "refunded") {
      throw new ApiError(400, "Đơn hàng đã được hoàn tiền trước đó");
    }

    // Validate amount
    if (!amount || amount <= 0) {
      throw new ApiError(400, "Số tiền hoàn phải lớn hơn 0");
    }

    if (amount > order.totalAfterDiscountAndShipping) {
      throw new ApiError(
        400,
        `Số tiền hoàn (${amount}) không được lớn hơn tổng đơn hàng (${order.totalAfterDiscountAndShipping})`
      );
    }

    // Validate method - CHỈ 2 PHƯƠNG THỨC THỦ CÔNG
    const validMethods = [
      "cash", // Hoàn tiền mặt tại cửa hàng
      "bank_transfer", // Chuyển khoản ngân hàng (yêu cầu bankInfo)
    ];
    if (!validMethods.includes(method)) {
      throw new ApiError(
        400,
        `Phương thức hoàn tiền không hợp lệ. Chấp nhận: ${validMethods.join(
          ", "
        )}`
      );
    }

    // Nếu method là bank_transfer, bắt buộc phải có bankInfo
    if (
      method === "bank_transfer" &&
      (!bankInfo ||
        !bankInfo.bankName ||
        !bankInfo.accountNumber ||
        !bankInfo.accountName)
    ) {
      throw new ApiError(
        400,
        "Phương thức chuyển khoản yêu cầu thông tin ngân hàng đầy đủ (bankName, accountNumber, accountName)"
      );
    }

    // Cập nhật refund info
    order.refund = {
      amount,
      method,
      status: "completed", // Manual refund - Admin đánh dấu completed sau khi chuyển khoản xong
      bankInfo: method === "bank_transfer" ? bankInfo : undefined,
      transactionId: `REFUND-${order.code}-${Date.now()}`,
      notes: notes || "",
      processedBy,
      requestedAt: new Date(),
      completedAt: new Date(),
    };

    // Chuyển status sang refunded
    const previousStatus = order.status;
    order.status = "refunded";

    // Thêm vào status history
    order.statusHistory.push({
      status: "refunded",
      updatedAt: new Date(),
      updatedBy: processedBy,
      note: `Hoàn tiền ${amount.toLocaleString("vi-VN")}đ qua ${method}. ${
        notes || ""
      }`,
    });

    await order.save();

    // Populate để trả về
    await order.populate([
      { path: "user", select: "name email phone" },
      { path: "refund.processedBy", select: "name email role" },
    ]);

    return {
      success: true,
      message: `Đã hoàn tiền thành công ${amount.toLocaleString(
        "vi-VN"
      )}đ cho đơn hàng ${order.code}`,
      data: {
        order,
        refund: order.refund,
        previousStatus,
      },
    };
  },
};

module.exports = orderService;
