const asyncHandler = require("express-async-handler");
const Order = require("../models/order.model");
const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const Coupon = require("../models/coupon.model");
const CancelRequest = require("../models/cancel.request.model");
const emailUtils = require("../utils/email");
const Notification = require("../models/notification.model");
const User = require("../models/user.model");
const mongoose = require("mongoose");
const { generateOrderCode } = require("../utils/helpers");
const NotificationService = require("../services/notification.service");

// Tạo đơn hàng mới
exports.createOrder = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      orderItems,
      shippingAddress,
      addressId,
      paymentMethod,
      totalPrice,
      shippingPrice,
      couponCode,
      note,
    } = req.body;

    // Kiểm tra đầu vào
    if (!orderItems || orderItems.length === 0) {
      res.status(400);
      throw new Error("Không có sản phẩm nào trong đơn hàng");
    }

    // Kiểm tra thông tin địa chỉ giao hàng
    let finalShippingAddress = shippingAddress;

    // Nếu có addressId, lấy địa chỉ từ danh sách địa chỉ của người dùng
    if (addressId) {
      const user = await User.findById(req.user._id).session(session);
      const address = user.addresses.id(addressId);

      if (!address) {
        res.status(404);
        throw new Error("Không tìm thấy địa chỉ đã chọn");
      }

      finalShippingAddress = {
        fullName: address.fullName,
        phone: address.phone,
        province: address.province,
        district: address.district,
        ward: address.ward,
        addressDetail: address.addressDetail,
      };
    } else if (!shippingAddress) {
      res.status(400);
      throw new Error("Vui lòng cung cấp thông tin địa chỉ giao hàng");
    } else {
      // Kiểm tra thông tin địa chỉ giao hàng
      const {
        fullName,
        phone,
        province,
        district,
        ward,
        addressDetail,
        saveAddress,
      } = shippingAddress;

      if (
        !fullName ||
        !phone ||
        !province ||
        !district ||
        !ward ||
        !addressDetail
      ) {
        res.status(400);
        throw new Error("Vui lòng cung cấp đầy đủ thông tin địa chỉ giao hàng");
      }

      // Kiểm tra định dạng số điện thoại
      const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
      if (!phoneRegex.test(phone)) {
        res.status(400);
        throw new Error("Số điện thoại không hợp lệ");
      }

      // Nếu người dùng chọn lưu địa chỉ mới
      if (saveAddress && req.user) {
        const user = await User.findById(req.user._id).session(session);

        const newAddress = {
          fullName,
          phone,
          province,
          district,
          ward,
          addressDetail,
          isDefault: user.addresses.length === 0, // Nếu là địa chỉ đầu tiên, đặt làm mặc định
        };

        user.addresses.push(newAddress);
        await user.save({ session });
      }
    }

    // Tạo đơn hàng mới
    const newOrderItems = [];
    let itemsPrice = 0;

    // Xác thực sản phẩm và tính giá
    for (const item of orderItems) {
      try {
        // Lấy thông tin sản phẩm
        const product = await Product.findById(item.product).session(session);

        if (!product) {
          throw new Error(`Sản phẩm với ID ${item.product} không tồn tại`);
        }

        // Kiểm tra sản phẩm có còn hoạt động không
        if (!product.isActive || product.isDeleted) {
          throw new Error(`Sản phẩm ${product.name} không còn khả dụng`);
        }

        // Kiểm tra tồn kho sử dụng variants trong model Product
        const variant = product.findVariant(item.color, item.size);

        if (!variant) {
          throw new Error(
            `Không tìm thấy màu ${item.color} và kích thước ${item.size} cho sản phẩm ${product.name}`
          );
        }

        // Kiểm tra trạng thái
        if (variant.status === "discontinued") {
          throw new Error(
            `Sản phẩm ${product.name} với màu và kích thước này đã ngừng kinh doanh`
          );
        }

        if (variant.status === "inactive") {
          throw new Error(
            `Sản phẩm ${product.name} với màu và kích thước này tạm thời không khả dụng`
          );
        }

        // Kiểm tra số lượng
        if (variant.quantity < item.quantity) {
          throw new Error(
            `Sản phẩm ${product.name} chỉ còn ${variant.quantity} sản phẩm trong kho`
          );
        }

        // Thêm vào danh sách sản phẩm
        newOrderItems.push({
          name: product.name,
          quantity: item.quantity,
          image:
            product.images.find((img) => img.isMain)?.url ||
            product.images[0]?.url,
          price: product.price,
          product: product._id,
          color: item.color,
          size: item.size,
        });

        // Cộng vào tổng giá
        itemsPrice += product.price * item.quantity;

        // Cập nhật số lượng trong kho sử dụng variants trong model Product
        variant.quantity -= item.quantity;

        // Cập nhật trạng thái
        if (variant.quantity <= 0 && variant.status === "active") {
          variant.isAvailable = false;
        }

        // Cập nhật tổng số lượng và số lượng theo màu
        product.updateColorQuantities();
        await product.updateTotalQuantity();

        // Lưu sản phẩm
        await product.save({ session });
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400);
        throw error;
      }
    }

    // Xử lý mã giảm giá nếu có
    let discountAmount = 0;
    let coupon = null;

    if (couponCode) {
      coupon = await Coupon.findOne({
        code: couponCode,
        isActive: true,
        expiryDate: { $gt: Date.now() },
      }).session(session);

      if (!coupon) {
        throw new Error("Mã giảm giá không hợp lệ hoặc đã hết hạn");
      }

      // Kiểm tra số lượng sử dụng
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        throw new Error("Mã giảm giá đã hết lượt sử dụng");
      }

      // Kiểm tra giá trị đơn hàng tối thiểu
      if (coupon.minOrderValue && itemsPrice < coupon.minOrderValue) {
        throw new Error(
          `Đơn hàng phải có giá trị tối thiểu ${coupon.minOrderValue} để sử dụng mã giảm giá này`
        );
      }

      // Tính toán số tiền giảm giá
      if (coupon.discountType === "percentage") {
        discountAmount = (itemsPrice * coupon.discountValue) / 100;
        if (
          coupon.maxDiscountAmount &&
          discountAmount > coupon.maxDiscountAmount
        ) {
          discountAmount = coupon.maxDiscountAmount;
        }
      } else {
        discountAmount = coupon.discountValue;
        if (discountAmount > itemsPrice) {
          discountAmount = itemsPrice;
        }
      }

      // Cập nhật số lần sử dụng mã giảm giá
      coupon.usedCount += 1;
      await coupon.save({ session });
    }

    // Tạo đơn hàng
    const order = new Order({
      user: req.user ? req.user._id : null,
      orderItems: newOrderItems,
      shippingAddress: finalShippingAddress,
      customerInfo: {
        name: finalShippingAddress.fullName,
        phone: finalShippingAddress.phone,
        province: finalShippingAddress.province,
        district: finalShippingAddress.district,
        ward: finalShippingAddress.ward,
        addressDetail: finalShippingAddress.addressDetail,
      },
      paymentMethod,
      itemsPrice,
      shippingPrice,
      totalPrice: totalPrice || itemsPrice + shippingPrice - discountAmount,
      coupon: coupon ? coupon._id : null,
      discountAmount,
      note,
    });

    // Lưu đơn hàng
    const createdOrder = await order.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: createdOrder,
    });
  } catch (error) {
    // Rollback transaction nếu có lỗi
    await session.abortTransaction();
    session.endSession();

    res.status(400);
    throw error;
  }
});

// Lấy danh sách đơn hàng của người dùng (không lọc)
exports.getUserOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  // Tính toán vị trí bắt đầu
  const startIndex = (Number(page) - 1) * Number(limit);

  // Truy vấn cơ bản - tất cả đơn hàng của người dùng
  const query = { user: req.user._id };

  // Thực hiện truy vấn với phân trang
  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip(startIndex)
    .populate("coupon", "code discountValue discountType")
    .populate("items.product", "name images")
    .populate("items.color", "name code")
    .populate("items.size", "value");

  // Đếm tổng số đơn hàng
  const total = await Order.countDocuments(query);

  // Định dạng tiền tệ cho đơn hàng
  const formattedOrders = orders.map((order) => {
    const formattedOrder = order.toObject();
    formattedOrder.formattedTotalPrice = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(order.totalPrice);

    return formattedOrder;
  });

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    totalPages: Math.ceil(total / Number(limit)),
    currentPage: Number(page),
    orders: formattedOrders,
  });
});

// Lọc đơn hàng của người dùng theo trạng thái
exports.filterUserOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    paymentStatus,
    sort = "createdAt",
    fromDate,
    toDate,
  } = req.query;

  // Tính toán vị trí bắt đầu
  const startIndex = (Number(page) - 1) * Number(limit);

  // Xây dựng query
  let query = { user: req.user._id };

  // Lọc theo trạng thái đơn hàng nếu có
  if (status) {
    query.status = status;
  }

  // Lọc theo trạng thái thanh toán nếu có
  if (paymentStatus) {
    query.paymentStatus = paymentStatus;
  }

  // Lọc theo khoảng thời gian
  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) {
      query.createdAt.$gte = new Date(fromDate);
    }
    if (toDate) {
      // Thêm 1 ngày vào toDate để bao gồm cả ngày kết thúc
      const endDate = new Date(toDate);
      endDate.setDate(endDate.getDate() + 1);
      query.createdAt.$lt = endDate;
    }
  }

  // Xác định cách sắp xếp
  let sortOption = {};
  if (sort === "newest") {
    sortOption = { createdAt: -1 };
  } else if (sort === "oldest") {
    sortOption = { createdAt: 1 };
  } else if (sort === "price-high") {
    sortOption = { totalPrice: -1 };
  } else if (sort === "price-low") {
    sortOption = { totalPrice: 1 };
  } else {
    sortOption = { createdAt: -1 }; // Mặc định sắp xếp theo thời gian tạo giảm dần
  }

  // Thực hiện truy vấn với lọc và phân trang
  const orders = await Order.find(query)
    .sort(sortOption)
    .limit(Number(limit))
    .skip(startIndex)
    .populate("coupon", "code discountValue discountType")
    .populate("items.product", "name images")
    .populate("items.color", "name code")
    .populate("items.size", "value");

  // Đếm tổng số đơn hàng thỏa mãn điều kiện
  const total = await Order.countDocuments(query);

  // Đếm số lượng đơn hàng theo từng trạng thái
  const statusCounts = await Order.aggregate([
    { $match: { user: req.user._id } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  // Chuyển đổi kết quả đếm trạng thái thành đối tượng
  const statusCountMap = {};
  statusCounts.forEach((item) => {
    statusCountMap[item._id] = item.count;
  });

  // Định dạng tiền tệ cho đơn hàng
  const formattedOrders = orders.map((order) => {
    const formattedOrder = order.toObject();
    formattedOrder.formattedTotalPrice = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(order.totalPrice);

    // Định dạng các giá trị tiền tệ khác nếu cần
    formattedOrder.formattedItemsPrice = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(order.itemsPrice);

    formattedOrder.formattedShippingPrice = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(order.shippingPrice);

    if (order.discountAmount) {
      formattedOrder.formattedDiscountAmount = new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(order.discountAmount);
    }

    return formattedOrder;
  });

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    totalPages: Math.ceil(total / Number(limit)),
    currentPage: Number(page),
    orders: formattedOrders,
    statusCounts: statusCountMap,
  });
});

// Tìm kiếm đơn hàng của người dùng
exports.searchUserOrders = asyncHandler(async (req, res) => {
  const { keyword, page = 1, limit = 10 } = req.query;

  if (!keyword) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp từ khóa tìm kiếm",
    });
  }

  // Tính toán vị trí bắt đầu
  const startIndex = (Number(page) - 1) * Number(limit);

  // Xây dựng query tìm kiếm
  const query = {
    user: req.user._id,
    $or: [
      { orderCode: { $regex: keyword, $options: "i" } },
      { "customerInfo.name": { $regex: keyword, $options: "i" } },
      { "customerInfo.phone": { $regex: keyword, $options: "i" } },
      { note: { $regex: keyword, $options: "i" } },
    ],
  };

  // Thực hiện truy vấn với tìm kiếm và phân trang
  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip(startIndex)
    .populate("coupon", "code discountValue discountType")
    .populate("items.product", "name images")
    .populate("items.color", "name code")
    .populate("items.size", "value");

  // Đếm tổng số đơn hàng thỏa mãn điều kiện
  const total = await Order.countDocuments(query);

  // Định dạng tiền tệ cho đơn hàng
  const formattedOrders = orders.map((order) => {
    const formattedOrder = order.toObject();
    formattedOrder.formattedTotalPrice = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(order.totalPrice);

    return formattedOrder;
  });

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    totalPages: Math.ceil(total / Number(limit)),
    currentPage: Number(page),
    orders: formattedOrders,
    keyword,
  });
});

// Lấy tất cả đơn hàng (Admin)
exports.getOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  // Tính toán vị trí bắt đầu
  const startIndex = (Number(page) - 1) * Number(limit);

  // Truy vấn cơ bản
  const query = {};

  // Thực hiện truy vấn với phân trang
  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip(startIndex)
    .populate("user", "name email")
    .populate("coupon", "code discountValue discountType")
    .populate("items.product", "name images")
    .populate("items.color", "name code")
    .populate("items.size", "value");

  // Đếm tổng số đơn hàng
  const total = await Order.countDocuments(query);

  // Tính tổng doanh thu
  const stats = await getOrderStats();

  // Định dạng tiền tệ cho đơn hàng và thống kê
  const formattedOrders = orders.map((order) => {
    const formattedOrder = order.toObject();
    formattedOrder.formattedTotalPrice = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(order.totalPrice);

    return formattedOrder;
  });

  const formattedStats = {
    ...stats,
    formattedTotalRevenue: new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(stats.totalRevenue),
    formattedWeeklyRevenue: new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(stats.weeklyRevenue),
    formattedMonthlyRevenue: new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(stats.monthlyRevenue),
  };

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    totalPages: Math.ceil(total / Number(limit)),
    currentPage: Number(page),
    orders: formattedOrders,
    stats: formattedStats,
  });
});

// Lọc đơn hàng (Admin)
exports.filterOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    paymentStatus,
    paymentMethod,
    fromDate,
    toDate,
    minPrice,
    maxPrice,
    sort = "createdAt",
  } = req.query;

  // Tính toán vị trí bắt đầu
  const startIndex = (Number(page) - 1) * Number(limit);

  // Xây dựng query
  let query = {};

  // Lọc theo trạng thái đơn hàng nếu có
  if (status) {
    query.status = status;
  }

  // Lọc theo trạng thái thanh toán nếu có
  if (paymentStatus) {
    query.paymentStatus = paymentStatus;
  }

  // Lọc theo phương thức thanh toán
  if (paymentMethod) {
    query.paymentMethod = paymentMethod;
  }

  // Lọc theo khoảng thời gian
  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) {
      query.createdAt.$gte = new Date(fromDate);
    }
    if (toDate) {
      // Thêm 1 ngày vào toDate để bao gồm cả ngày kết thúc
      const endDate = new Date(toDate);
      endDate.setDate(endDate.getDate() + 1);
      query.createdAt.$lt = endDate;
    }
  }

  // Lọc theo khoảng giá
  if (minPrice || maxPrice) {
    query.totalPrice = {};
    if (minPrice) {
      query.totalPrice.$gte = Number(minPrice);
    }
    if (maxPrice) {
      query.totalPrice.$lte = Number(maxPrice);
    }
  }

  // Xác định cách sắp xếp
  let sortOption = {};
  if (sort === "newest") {
    sortOption = { createdAt: -1 };
  } else if (sort === "oldest") {
    sortOption = { createdAt: 1 };
  } else if (sort === "price-high") {
    sortOption = { totalPrice: -1 };
  } else if (sort === "price-low") {
    sortOption = { totalPrice: 1 };
  } else {
    sortOption = { createdAt: -1 }; // Mặc định sắp xếp theo thời gian tạo giảm dần
  }

  // Thực hiện truy vấn với lọc và phân trang
  const orders = await Order.find(query)
    .sort(sortOption)
    .limit(Number(limit))
    .skip(startIndex)
    .populate("user", "name email")
    .populate("coupon", "code discountValue discountType")
    .populate("items.product", "name images")
    .populate("items.color", "name code")
    .populate("items.size", "value");

  // Đếm tổng số đơn hàng thỏa mãn điều kiện
  const total = await Order.countDocuments(query);

  // Đếm số lượng đơn hàng theo từng trạng thái
  const statusCounts = await Order.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  // Chuyển đổi kết quả đếm trạng thái thành đối tượng
  const statusCountMap = {};
  statusCounts.forEach((item) => {
    statusCountMap[item._id] = item.count;
  });

  // Định dạng tiền tệ cho đơn hàng
  const formattedOrders = orders.map((order) => {
    const formattedOrder = order.toObject();
    formattedOrder.formattedTotalPrice = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(order.totalPrice);

    // Định dạng các giá trị tiền tệ khác
    formattedOrder.formattedItemsPrice = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(order.itemsPrice);

    formattedOrder.formattedShippingPrice = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(order.shippingPrice);

    if (order.discountAmount) {
      formattedOrder.formattedDiscountAmount = new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(order.discountAmount);
    }

    return formattedOrder;
  });

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    totalPages: Math.ceil(total / Number(limit)),
    currentPage: Number(page),
    orders: formattedOrders,
    statusCounts: statusCountMap,
  });
});

// Tìm kiếm đơn hàng (Admin)
exports.searchOrders = asyncHandler(async (req, res) => {
  const { keyword, page = 1, limit = 10 } = req.query;

  if (!keyword) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp từ khóa tìm kiếm",
    });
  }

  // Tính toán vị trí bắt đầu
  const startIndex = (Number(page) - 1) * Number(limit);

  // Xây dựng query tìm kiếm
  const query = {
    $or: [
      { orderCode: { $regex: keyword, $options: "i" } },
      { "customerInfo.name": { $regex: keyword, $options: "i" } },
      { "customerInfo.phone": { $regex: keyword, $options: "i" } },
      { note: { $regex: keyword, $options: "i" } },
    ],
  };

  // Thực hiện truy vấn với tìm kiếm và phân trang
  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip(startIndex)
    .populate("user", "name email")
    .populate("coupon", "code discountValue discountType")
    .populate("items.product", "name images")
    .populate("items.color", "name code")
    .populate("items.size", "value");

  // Đếm tổng số đơn hàng thỏa mãn điều kiện
  const total = await Order.countDocuments(query);

  // Định dạng tiền tệ cho đơn hàng
  const formattedOrders = orders.map((order) => {
    const formattedOrder = order.toObject();
    formattedOrder.formattedTotalPrice = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(order.totalPrice);

    return formattedOrder;
  });

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    totalPages: Math.ceil(total / Number(limit)),
    currentPage: Number(page),
    orders: formattedOrders,
    keyword,
  });
});

// Lấy chi tiết đơn hàng
exports.getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("items.product", "name")
    .populate("items.color", "name code")
    .populate("items.size", "value");

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy đơn hàng",
    });
  }

  // Kiểm tra quyền truy cập
  if (
    order.userId.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    return res.status(403).json({
      success: false,
      message: "Không có quyền truy cập đơn hàng này",
    });
  }

  res.json({
    success: true,
    order,
  });
});

// Người dùng yêu cầu hủy đơn hàng
exports.cancelOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;

  // Kiểm tra lý do hủy
  if (!reason) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp lý do hủy đơn hàng",
    });
  }

  // Bắt đầu một session và transaction
  const session = await mongoose.startSession();

  try {
    // Bắt đầu transaction
    session.startTransaction();

    // Tìm đơn hàng
    const order = await Order.findById(orderId).session(session);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng",
      });
    }

    // Kiểm tra xem đơn hàng có thuộc về người dùng hiện tại không
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền hủy đơn hàng này",
      });
    }

    // Kiểm tra trạng thái đơn hàng
    if (order.status !== "pending" && order.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: "Không thể hủy đơn hàng ở trạng thái này",
      });
    }

    // Kiểm tra xem đã có yêu cầu hủy đơn hàng nào đang chờ xử lý không
    const existingRequest = await CancelRequest.findOne({
      orderId: order._id,
      status: "pending",
    }).session(session);

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "Đã có yêu cầu hủy đơn hàng đang chờ xử lý",
      });
    }

    // Tạo yêu cầu hủy đơn hàng mới
    const cancelRequest = new CancelRequest({
      orderId: order._id,
      userId: req.user._id,
      reason: reason,
      status: "pending",
    });

    await cancelRequest.save({ session });

    // Tạo thông báo cho admin
    await Notification.create(
      [
        {
          userId: null, // Null means for admin
          title: "Yêu cầu hủy đơn hàng mới",
          message: `Khách hàng ${req.user.name} đã gửi yêu cầu hủy đơn hàng #${order.orderCode}.`,
          type: "order_cancel",
          entityId: order._id,
        },
      ],
      { session }
    );

    // Tạo thông báo cho khách hàng
    await Notification.create(
      [
        {
          userId: req.user._id,
          title: "Đã gửi yêu cầu hủy đơn hàng",
          message: `Yêu cầu hủy đơn hàng #${order.orderCode} của bạn đã được gửi đi. Chúng tôi sẽ xem xét và phản hồi sớm.`,
          type: "order",
          entityId: order._id,
        },
      ],
      { session }
    );

    // Hoàn tất transaction
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Yêu cầu hủy đơn hàng đã được gửi thành công",
      data: cancelRequest,
    });
  } catch (error) {
    // Hủy bỏ transaction nếu có lỗi
    await session.abortTransaction();
    session.endSession();

    // Ghi log lỗi
    console.error("Lỗi khi gửi yêu cầu hủy đơn hàng:", error);

    res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi gửi yêu cầu hủy đơn hàng",
      error: error.message,
    });
  }
});

// Admin xét duyệt yêu cầu hủy đơn
exports.reviewCancelRequest = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    // Bắt đầu transaction
    session.startTransaction();

    const { orderId } = req.params;
    const { action, note } = req.body;

    // Kiểm tra hành động hợp lệ
    if (action !== "approve" && action !== "reject") {
      return res.status(400).json({
        success: false,
        message: "Hành động không hợp lệ. Vui lòng chọn approve hoặc reject",
      });
    }

    // Tìm đơn hàng
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng",
      });
    }

    // Chỉ xét duyệt yêu cầu hủy của đơn hàng ở trạng thái pending hoặc confirmed
    if (order.status !== "pending" && order.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        message:
          "Chỉ có thể xét duyệt yêu cầu hủy cho đơn hàng ở trạng thái chờ xử lý hoặc đã xác nhận",
      });
    }

    // Tìm yêu cầu hủy đơn
    const cancelRequest = await CancelRequest.findOne({
      orderId: order._id,
      status: "pending",
    }).session(session);

    if (!cancelRequest) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy yêu cầu hủy đơn hàng hoặc yêu cầu đã được xử lý",
      });
    }

    if (action === "approve") {
      // Phê duyệt yêu cầu hủy đơn
      cancelRequest.status = "approved";
      cancelRequest.reviewNote = note || "Yêu cầu hủy đã được chấp nhận";
      cancelRequest.reviewedBy = req.user._id;
      cancelRequest.reviewedAt = new Date();
      await cancelRequest.save({ session });

      // Cập nhật trạng thái đơn hàng
      order.status = "cancelled";
      order.cancelReason = cancelRequest.reason;
      await order.save({ session });

      // Hoàn trả số lượng vào kho
      for (const item of order.items) {
        // Tìm ProductSize tương ứng
        const productSize = await ProductSize.findOne({
          product: item.product,
          color: item.color,
          size: item.size,
        }).session(session);

        if (productSize) {
          // Hoàn trả số lượng vào kho
          productSize.quantity += item.quantity;

          // Cập nhật trạng thái isAvailable
          if (productSize.quantity > 0 && productSize.status === "active") {
            productSize.isAvailable = true;
          }

          await productSize.save({ session });
        }
      }

      // Hoàn trả mã giảm giá nếu có
      if (order.discount) {
        await Discount.findByIdAndUpdate(
          order.discount,
          {
            $inc: { usedCount: -1 },
            $pull: { usedBy: order.userId },
          },
          { session }
        );
      }

      // Gửi thông báo cho người dùng
      await Notification.create(
        [
          {
            userId: order.userId,
            title: "Yêu cầu hủy đơn hàng đã được chấp nhận",
            message: `Yêu cầu hủy đơn hàng #${order.orderCode} của bạn đã được chấp nhận. Đơn hàng đã bị hủy.`,
            type: "order",
            entityId: order._id,
          },
        ],
        { session }
      );
    } else {
      // Từ chối yêu cầu hủy đơn
      cancelRequest.status = "rejected";
      cancelRequest.reviewNote = note || "Yêu cầu hủy đã bị từ chối";
      cancelRequest.reviewedBy = req.user._id;
      cancelRequest.reviewedAt = new Date();
      await cancelRequest.save({ session });

      // Gửi thông báo cho người dùng
      await Notification.create(
        [
          {
            userId: order.userId,
            title: "Yêu cầu hủy đơn hàng đã bị từ chối",
            message: `Yêu cầu hủy đơn hàng #${
              order.orderCode
            } của bạn đã bị từ chối. ${note || "Không có lý do được cung cấp"}`,
            type: "order",
            entityId: order._id,
          },
        ],
        { session }
      );
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: `Yêu cầu hủy đơn hàng đã được ${
        action === "approve" ? "chấp nhận" : "từ chối"
      }`,
      cancelRequest,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500);
    throw new Error(`Lỗi khi xét duyệt yêu cầu hủy đơn: ${error.message}`);
  }
});

// Lấy danh sách yêu cầu hủy đơn (Admin)
exports.getCancelRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  const query = {};
  if (status) {
    query.status = status;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const cancelRequests = await CancelRequest.find(query)
    .populate({
      path: "orderId",
      select: "orderCode totalAmount status customerInfo",
    })
    .populate("userId", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const count = await CancelRequest.countDocuments(query);

  res.json({
    success: true,
    count,
    totalPages: Math.ceil(count / Number(limit)),
    currentPage: Number(page),
    cancelRequests,
  });
});

// Cập nhật trạng thái đơn hàng - Chỉ Admin
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  // Bắt đầu một session và transaction
  const session = await mongoose.startSession();

  try {
    // Bắt đầu transaction
    session.startTransaction();

    const { orderId } = req.params;
    const { status, trackingInfo } = req.body;

    // Kiểm tra trạng thái hợp lệ
    const validStatuses = [
      "pending",
      "confirmed",
      "shipping",
      "delivered",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái đơn hàng không hợp lệ",
      });
    }

    // Tìm đơn hàng
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng",
      });
    }

    // Kiểm tra logic chuyển trạng thái
    const currentStatus = order.status;
    const validTransitions = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["shipping", "cancelled"],
      shipping: ["delivered"], // Loại bỏ khả năng hủy đơn khi đang giao
      delivered: [], // Đơn hàng đã giao không thể chuyển sang trạng thái khác
      cancelled: [], // Đơn hàng đã hủy không thể khôi phục
    };

    if (
      !validTransitions[currentStatus].includes(status) &&
      currentStatus !== status
    ) {
      return res.status(400).json({
        success: false,
        message: `Không thể chuyển đơn hàng từ trạng thái ${currentStatus} sang ${status}`,
      });
    }

    // Xử lý các hành động đặc biệt
    if (status === "cancelled" && currentStatus !== "cancelled") {
      // Hủy đơn hàng
      if (!req.body.cancelReason) {
        return res.status(400).json({
          success: false,
          message: "Cần cung cấp lý do hủy đơn hàng",
        });
      }

      order.cancelReason = req.body.cancelReason;

      // Hoàn trả số lượng vào kho
      for (const item of order.items) {
        // Tìm ProductSize tương ứng
        const productSize = await ProductSize.findOne({
          product: item.product,
          color: item.color,
          size: item.size,
        }).session(session);

        if (productSize) {
          // Hoàn trả số lượng vào kho
          productSize.quantity += item.quantity;

          // Cập nhật trạng thái isAvailable
          if (productSize.quantity > 0 && productSize.status === "active") {
            productSize.isAvailable = true;
          }

          await productSize.save({ session });
        }
      }

      // Hoàn trả mã giảm giá nếu có
      if (order.discount) {
        await Discount.findByIdAndUpdate(
          order.discount,
          {
            $inc: { usedCount: -1 },
            $pull: { usedBy: order.userId },
          },
          { session }
        );
      }
    } else if (status === "shipping" && trackingInfo) {
      // Cập nhật thông tin vận chuyển
      order.trackingInfo = {
        ...order.trackingInfo,
        ...trackingInfo,
      };
    } else if (status === "delivered") {
      // Đơn hàng đã giao, cập nhật số lượng bán ra
      for (const item of order.items) {
        // Cập nhật số lượng bán ra của sản phẩm
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { totalSold: item.quantity } },
          { session }
        );
      }

      // Đặt trạng thái thanh toán thành paid nếu là COD
      if (order.paymentMethod === "COD" && order.paymentStatus !== "paid") {
        order.paymentStatus = "paid";
      }
    }

    // Cập nhật trạng thái đơn hàng
    order.status = status;
    order.statusHistory.push({
      status,
      updatedBy: req.user._id,
      timestamp: new Date(),
    });

    await order.save({ session });

    // Tạo các thông báo
    let notificationTitle = "";
    let notificationMessage = "";

    if (status === "confirmed") {
      notificationTitle = "Đơn hàng đã được xác nhận";
      notificationMessage = `Đơn hàng #${order.orderCode} của bạn đã được xác nhận và đang được chuẩn bị.`;
    } else if (status === "shipping") {
      notificationTitle = "Đơn hàng đang được giao";
      notificationMessage = `Đơn hàng #${order.orderCode} của bạn đang được giao đến địa chỉ của bạn.`;
      if (order.trackingInfo && order.trackingInfo.trackingNumber) {
        notificationMessage += ` Mã vận đơn: ${order.trackingInfo.trackingNumber}`;
      }
    } else if (status === "delivered") {
      notificationTitle = "Đơn hàng đã giao thành công";
      notificationMessage = `Đơn hàng #${order.orderCode} đã được giao thành công. Cảm ơn bạn đã mua hàng!`;
    } else if (status === "cancelled") {
      notificationTitle = "Đơn hàng đã bị hủy";
      notificationMessage = `Đơn hàng #${order.orderCode} đã bị hủy. Lý do: ${
        order.cancelReason || "Không xác định"
      }`;
    }

    // Lưu thông báo vào cơ sở dữ liệu
    if (notificationTitle && notificationMessage) {
      await Notification.create(
        [
          {
            userId: order.userId,
            title: notificationTitle,
            message: notificationMessage,
            type: "order",
            entityId: orderId,
          },
        ],
        { session }
      );

      // Gửi thông báo realtime qua Socket.io
      const io = req.app.get("io");
      if (io) {
        const notificationService = new NotificationService(io);

        // Chờ transaction commit trước khi gửi thông báo realtime
        // để đảm bảo dữ liệu nhất quán
        await session.commitTransaction();
        session.endSession();

        notificationService.sendOrderStatusUpdate(
          order.userId,
          orderId,
          status,
          notificationMessage
        );

        return res.status(200).json({
          success: true,
          message: "Cập nhật trạng thái đơn hàng thành công",
          order,
        });
      }
    }

    // Commit transaction nếu không gửi thông báo realtime
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Cập nhật trạng thái đơn hàng thành công",
      order,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500);
    throw new Error(`Lỗi khi cập nhật trạng thái đơn hàng: ${error.message}`);
  }
});

// Cập nhật trạng thái thanh toán - Chỉ Admin
exports.updatePaymentStatus = asyncHandler(async (req, res) => {
  // Bắt đầu một session và transaction
  const session = await mongoose.startSession();

  try {
    // Bắt đầu transaction
    session.startTransaction();

    const { orderId } = req.params;
    const { paymentStatus } = req.body;

    // Kiểm tra trạng thái thanh toán hợp lệ
    const validStatuses = ["pending", "paid", "failed"];
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái thanh toán không hợp lệ",
      });
    }

    // Tìm đơn hàng
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng",
      });
    }

    // Kiểm tra nếu đơn hàng đã bị hủy
    if (order.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message:
          "Không thể cập nhật trạng thái thanh toán cho đơn hàng đã bị hủy",
      });
    }

    // Không thay đổi nếu trạng thái giống nhau
    if (order.paymentStatus === paymentStatus) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái thanh toán không thay đổi",
      });
    }

    // Lưu trạng thái thanh toán cũ để ghi lịch sử
    const oldPaymentStatus = order.paymentStatus;

    // Cập nhật trạng thái thanh toán
    order.paymentStatus = paymentStatus;
    order.paymentHistory.push({
      status: paymentStatus,
      updatedBy: req.user._id,
      timestamp: new Date(),
    });

    // Biến để lưu thông tin thông báo
    let notificationTitle = "";
    let notificationMessage = "";
    let notificationType = "payment";

    // Xử lý các trường hợp đặc biệt
    if (paymentStatus === "paid" && oldPaymentStatus !== "paid") {
      // Thanh toán thành công - Cập nhật trạng thái đơn hàng nếu đang pending
      if (order.status === "pending") {
        order.status = "confirmed";
        order.statusHistory.push({
          status: "confirmed",
          updatedBy: req.user._id,
          timestamp: new Date(),
          note: "Tự động cập nhật sau khi thanh toán thành công",
        });
      }

      notificationTitle = "Thanh toán thành công";
      notificationMessage = `Đơn hàng #${order.orderCode} của bạn đã được thanh toán thành công.`;
    } else if (paymentStatus === "failed" && oldPaymentStatus !== "failed") {
      // Thanh toán thất bại - Thông báo cho người dùng
      notificationTitle = "Thanh toán thất bại";
      notificationMessage = `Thanh toán cho đơn hàng #${order.orderCode} của bạn không thành công. Vui lòng thử lại hoặc chọn phương thức thanh toán khác.`;
    }

    // Lưu đơn hàng với thay đổi
    await order.save({ session });

    // Tạo thông báo trong database nếu có
    if (notificationTitle && notificationMessage) {
      await Notification.create(
        [
          {
            userId: order.userId,
            title: notificationTitle,
            message: notificationMessage,
            type: notificationType,
            entityId: orderId,
          },
        ],
        { session }
      );

      // Gửi thông báo realtime qua Socket.io
      const io = req.app.get("io");
      if (io) {
        const notificationService = new NotificationService(io);

        // Chờ transaction commit trước khi gửi thông báo realtime
        await session.commitTransaction();
        session.endSession();

        notificationService.sendPaymentStatusUpdate(
          order.userId,
          orderId,
          paymentStatus,
          notificationMessage
        );

        return res.status(200).json({
          success: true,
          message: "Cập nhật trạng thái thanh toán thành công",
          order,
        });
      }
    }

    // Commit transaction nếu không gửi thông báo realtime
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Cập nhật trạng thái thanh toán thành công",
      order,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500);
    throw new Error(`Lỗi khi cập nhật trạng thái thanh toán: ${error.message}`);
  }
});

// Khóa tài khoản người dùng - Chỉ Admin
exports.blockUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;

  // Kiểm tra quyền admin
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền thực hiện hành động này",
    });
  }

  // Tìm người dùng
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy người dùng",
    });
  }

  // Kiểm tra xem người dùng đã bị khóa chưa
  if (user.isActive === false) {
    return res.status(400).json({
      success: false,
      message: "Tài khoản này đã bị khóa",
    });
  }

  // Không cho phép khóa tài khoản admin
  if (user.role === "admin") {
    return res.status(400).json({
      success: false,
      message: "Không thể khóa tài khoản admin",
    });
  }

  // Cập nhật trạng thái và lý do khóa
  user.isActive = false;
  user.blockReason = reason || "Vi phạm chính sách người dùng";
  user.blockedAt = Date.now();

  await user.save();

  // Đăng xuất người dùng khỏi tất cả các thiết bị
  await Session.deleteMany({ userId: user._id });

  // Gửi thông báo đến người dùng
  await createNotification(
    user._id,
    "Tài khoản bị khóa",
    `Tài khoản của bạn đã bị khóa với lý do: ${user.blockReason}. Vui lòng liên hệ quản trị viên để biết thêm chi tiết.`,
    "user",
    user._id
  );

  res.status(200).json({
    success: true,
    message: "Đã khóa tài khoản người dùng thành công",
  });
});

// Mở khóa tài khoản người dùng - Chỉ Admin
exports.unblockUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Kiểm tra quyền admin
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền thực hiện hành động này",
    });
  }

  // Tìm người dùng
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy người dùng",
    });
  }

  // Kiểm tra xem người dùng đã bị khóa chưa
  if (user.isActive === true) {
    return res.status(400).json({
      success: false,
      message: "Tài khoản này đang hoạt động",
    });
  }

  // Cập nhật trạng thái và xóa lý do khóa
  user.isActive = true;
  user.blockReason = undefined;
  user.blockedAt = undefined;

  await user.save();

  // Gửi thông báo đến người dùng
  await createNotification(
    user._id,
    "Tài khoản đã được mở khóa",
    "Tài khoản của bạn đã được mở khóa và có thể sử dụng bình thường.",
    "user",
    user._id
  );

  res.status(200).json({
    success: true,
    message: "Đã mở khóa tài khoản người dùng thành công",
  });
});

/**
 * @desc    Lấy danh sách yêu cầu hủy đơn hàng của người dùng
 * @route   GET /api/orders/my-cancel-requests
 * @access  Private
 */
exports.getUserCancelRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  const query = { userId: req.user._id };
  if (status) {
    query.status = status;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const cancelRequests = await CancelRequest.find(query)
    .populate({
      path: "orderId",
      select: "orderCode totalAmount status customerInfo createdAt",
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const count = await CancelRequest.countDocuments(query);

  res.json({
    success: true,
    count,
    totalPages: Math.ceil(count / Number(limit)),
    currentPage: Number(page),
    cancelRequests,
  });
});

// Hàm lấy thống kê đơn hàng
const getOrderStats = async () => {
  const today = new Date();
  const startOfToday = new Date(today.setHours(0, 0, 0, 0));
  const endOfToday = new Date(today.setHours(23, 59, 59, 999));

  // Tháng hiện tại
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  // Thống kê theo trạng thái
  const statusStats = await Order.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$totalAmount" },
      },
    },
  ]);

  // Thống kê theo phương thức thanh toán
  const paymentMethodStats = await Order.aggregate([
    {
      $group: {
        _id: "$paymentMethod",
        count: { $sum: 1 },
        totalAmount: { $sum: "$totalAmount" },
      },
    },
  ]);

  // Thống kê theo ngày, tháng
  const todayOrders = await Order.countDocuments({
    createdAt: { $gte: startOfToday, $lte: endOfToday },
  });

  const todayRevenue = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfToday, $lte: endOfToday },
        paymentStatus: "paid",
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$totalAmount" },
      },
    },
  ]);

  const monthlyOrders = await Order.countDocuments({
    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
  });

  const monthlyRevenue = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        paymentStatus: "paid",
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$totalAmount" },
      },
    },
  ]);

  return {
    total: {
      orders: await Order.countDocuments(),
      revenue:
        (
          await Order.aggregate([
            { $match: { paymentStatus: "paid" } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } },
          ])
        )[0]?.total || 0,
    },
    today: {
      orders: todayOrders,
      revenue: todayRevenue[0]?.total || 0,
    },
    monthly: {
      orders: monthlyOrders,
      revenue: monthlyRevenue[0]?.total || 0,
    },
    byStatus: statusStats.reduce((acc, stat) => {
      acc[stat._id] = { count: stat.count, totalAmount: stat.totalAmount };
      return acc;
    }, {}),
    byPaymentMethod: paymentMethodStats.reduce((acc, stat) => {
      acc[stat._id] = { count: stat.count, totalAmount: stat.totalAmount };
      return acc;
    }, {}),
  };
};
