const { User, Order } = require("../models");
const ApiError = require("../utils/ApiError");

/**
 * Lấy danh sách shippers
 */
const getShippers = async (filter = {}, options = {}) => {
  const {
    page = 1,
    limit = 20,
    isAvailable,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  const query = { role: "shipper" };

  if (isAvailable !== undefined) {
    query["shipper.isAvailable"] = isAvailable;
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

  const [shippers, total] = await Promise.all([
    User.find(query)
      .select("name email phone shipper avatar")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    User.countDocuments(query),
  ]);

  return {
    shippers,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Cập nhật trạng thái shipper
 */
const updateShipperAvailability = async (shipperId, isAvailable) => {
  const shipper = await User.findOne({ _id: shipperId, role: "shipper" });

  if (!shipper) {
    throw new ApiError(404, "Không tìm thấy shipper");
  }

  shipper.shipper.isAvailable = isAvailable;
  await shipper.save();

  return shipper;
};

/**
 * Gán đơn hàng cho shipper
 */
const assignOrderToShipper = async (orderId, shipperId, assignedBy) => {
  const [order, shipper] = await Promise.all([
    Order.findById(orderId),
    User.findOne({ _id: shipperId, role: "shipper" }),
  ]);

  if (!order) {
    throw new ApiError(404, "Không tìm thấy đơn hàng");
  }

  if (!shipper) {
    throw new ApiError(404, "Không tìm thấy shipper");
  }

  if (!shipper.shipper.isAvailable) {
    throw new ApiError(400, "Shipper hiện không khả dụng");
  }

  if (shipper.shipper.activeOrders >= shipper.shipper.maxOrders) {
    throw new ApiError(400, "Shipper đã đạt số đơn tối đa");
  }

  // Cập nhật đơn hàng
  order.assignedShipper = shipperId;
  order.assignmentTime = new Date();
  order.status = "assigned_to_shipper";
  order.statusHistory.push({
    status: "assigned_to_shipper",
    updatedAt: new Date(),
    updatedBy: assignedBy,
    note: `Đơn hàng được gán cho shipper ${shipper.name}`,
  });

  await order.save();

  // Cập nhật số đơn của shipper
  shipper.shipper.activeOrders += 1;
  await shipper.save();

  return order;
};

/**
 * Shipper cập nhật trạng thái giao hàng
 */
const updateDeliveryStatus = async (orderId, shipperId, data) => {
  const { status, location, note, images } = data;

  const order = await Order.findOne({
    _id: orderId,
    assignedShipper: shipperId,
  });

  if (!order) {
    throw new ApiError(404, "Không tìm thấy đơn hàng hoặc không có quyền");
  }

  // Thêm vào lịch sử giao hàng
  order.deliveryAttempts.push({
    time: new Date(),
    status,
    location,
    note,
    shipper: shipperId,
    images: images || [],
  });

  // Cập nhật trạng thái đơn hàng
  if (status === "success") {
    order.status = "delivered";
    order.deliveredAt = new Date();
    order.payment.paymentStatus = "paid";
    order.payment.paidAt = new Date();

    // Giảm số đơn active của shipper
    const shipper = await User.findById(shipperId);
    shipper.shipper.activeOrders = Math.max(
      0,
      shipper.shipper.activeOrders - 1
    );
    shipper.shipper.deliveryStats.total += 1;
    shipper.shipper.deliveryStats.successful += 1;
    await shipper.save();
  } else if (status === "failed") {
    order.status = "delivery_failed";

    // Nếu thất bại 3 lần thì tự động hủy
    const failedAttempts = order.deliveryAttempts.filter(
      (a) => a.status === "failed"
    ).length;

    if (failedAttempts >= 3) {
      order.status = "cancelled";
      order.cancelReason = "Giao hàng thất bại sau 3 lần thử";
      order.cancelledAt = new Date();

      // Giảm số đơn active của shipper
      const shipper = await User.findById(shipperId);
      shipper.shipper.activeOrders = Math.max(
        0,
        shipper.shipper.activeOrders - 1
      );
      shipper.shipper.deliveryStats.total += 1;
      shipper.shipper.deliveryStats.failed += 1;
      await shipper.save();
    }
  }

  order.statusHistory.push({
    status: order.status,
    updatedAt: new Date(),
    updatedBy: shipperId,
    note,
  });

  await order.save();

  return order;
};

/**
 * Lấy đơn hàng của shipper
 */
const getShipperOrders = async (shipperId, filter = {}, options = {}) => {
  const {
    page = 1,
    limit = 20,
    status,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  const query = { assignedShipper: shipperId };

  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate("user", "name phone email")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Order.countDocuments(query),
  ]);

  return {
    orders,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Shipper cập nhật vị trí
 */
const updateShipperLocation = async (shipperId, location) => {
  const { lat, lng } = location;

  const shipper = await User.findOne({ _id: shipperId, role: "shipper" });

  if (!shipper) {
    throw new ApiError(404, "Không tìm thấy shipper");
  }

  shipper.shipper.currentLocation = {
    lat,
    lng,
    updatedAt: new Date(),
  };

  await shipper.save();

  return shipper;
};

/**
 * Thống kê shipper
 */
const getShipperStats = async (shipperId) => {
  const shipper = await User.findOne({ _id: shipperId, role: "shipper" });

  if (!shipper) {
    throw new ApiError(404, "Không tìm thấy shipper");
  }

  const [totalOrders, completedOrders, failedOrders, activeOrders] =
    await Promise.all([
      Order.countDocuments({ assignedShipper: shipperId }),
      Order.countDocuments({
        assignedShipper: shipperId,
        status: "delivered",
      }),
      Order.countDocuments({
        assignedShipper: shipperId,
        status: "delivery_failed",
      }),
      Order.countDocuments({
        assignedShipper: shipperId,
        status: { $in: ["assigned_to_shipper", "out_for_delivery"] },
      }),
    ]);

  return {
    shipper: {
      name: shipper.name,
      email: shipper.email,
      phone: shipper.phone,
      isAvailable: shipper.shipper.isAvailable,
      maxOrders: shipper.shipper.maxOrders,
    },
    stats: {
      totalOrders,
      completedOrders,
      failedOrders,
      activeOrders,
      successRate:
        totalOrders > 0
          ? ((completedOrders / totalOrders) * 100).toFixed(2)
          : 0,
    },
  };
};

/**
 * Lấy thông tin chi tiết shipper
 */
const getShipperById = async (shipperId) => {
  const shipper = await User.findOne({
    _id: shipperId,
    role: "shipper",
  }).select("name email phone shipper avatar createdAt");

  if (!shipper) {
    throw new ApiError(404, "Không tìm thấy shipper");
  }

  return shipper;
};

module.exports = {
  getShippers,
  updateShipperAvailability,
  assignOrderToShipper,
  updateDeliveryStatus,
  getShipperOrders,
  updateShipperLocation,
  getShipperStats,
  getShipperById,
};
