const { User, Order } = require("../models");
const ApiError = require("../utils/ApiError");

/**
 * Lấy danh sách shippers
 */
const getShippers = async (query = {}) => {
  const {
    available,
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  const filter = { role: "shipper" };

  // Filter theo availability
  if (available === "true") {
    filter["shipper.isAvailable"] = true;
  } else if (available === "false") {
    filter["shipper.isAvailable"] = false;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

  const [shippers, total] = await Promise.all([
    User.find(filter)
      .select("name email phone shipper avatar createdAt")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit)),
    User.countDocuments(filter),
  ]);

  return {
    shippers,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
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
    Order.findById(orderId).populate([
      {
        path: "orderItems.variant",
        select: "product color",
        populate: { path: "product", select: "_id name" },
      },
      { path: "orderItems.size", select: "_id value" },
    ]),
    User.findOne({ _id: shipperId, role: "shipper" }),
  ]);

  if (!order) {
    throw new ApiError(404, "Không tìm thấy đơn hàng");
  }

  // Kiểm tra order đã có shipper chưa
  if (order.assignedShipper) {
    throw new ApiError(400, "Đơn hàng đã được gán cho shipper khác");
  }

  // Kiểm tra trạng thái order phải là 'confirmed'
  if (order.status !== "confirmed") {
    throw new ApiError(
      400,
      `Chỉ có thể gán shipper cho đơn hàng đã xác nhận. Trạng thái hiện tại: ${order.status}`
    );
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

  // TỰ ĐỘNG XUẤT KHO KHI GÁN CHO SHIPPER
  if (!order.inventoryDeducted) {
    const inventoryService = require("@services/inventory.service");

    for (const item of order.orderItems) {
      try {
        // Lấy productId từ variant (vì orderItem không có trực tiếp product field)
        const productId = item.variant?.product?._id || item.variant?.product;

        if (!productId) {
          throw new ApiError(
            400,
            `Không tìm thấy product từ variant ${item.variant?._id}`
          );
        }

        await inventoryService.stockOut(
          {
            product: productId,
            variant: item.variant._id,
            size: item.size._id,
            quantity: item.quantity,
            reason: "sale",
            reference: order._id, // ObjectId của Order
            notes: `Xuất kho tự động cho đơn hàng ${order.code} - Giao cho shipper ${shipper.name}`,
          },
          assignedBy // Người gán đơn hàng
        );
      } catch (error) {
        console.error(`Lỗi khi xuất kho cho orderItem:`, error.message);
        throw new ApiError(400, `Không thể xuất kho: ${error.message}`);
      }
    }

    order.inventoryDeducted = true;
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

  // Validate status transitions
  const validStatuses = ["out_for_delivery", "delivered", "delivery_failed"];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, "Trạng thái không hợp lệ");
  }

  // Thêm vào lịch sử giao hàng
  order.deliveryAttempts.push({
    time: new Date(),
    status:
      status === "delivered"
        ? "success"
        : status === "delivery_failed"
        ? "failed"
        : status,
    location,
    note,
    shipper: shipperId,
    images: images || [],
  });

  // Cập nhật trạng thái đơn hàng
  if (status === "delivered") {
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
  } else if (status === "delivery_failed") {
    order.status = "delivery_failed";

    // Nếu thất bại 3 lần thì chuyển trạng thái về returning_to_warehouse
    const failedAttempts = order.deliveryAttempts.filter(
      (a) => a.status === "failed" || a.status === "delivery_failed"
    ).length;

    if (failedAttempts >= 3) {
      // Set status = returning_to_warehouse thay vì cancelled ngay
      order.status = "returning_to_warehouse";
      order.cancelReason =
        "Giao hàng thất bại sau 3 lần thử - Hàng đang trả về kho";

      // Set returnConfirmed = false (chờ staff xác nhận nhận hàng)
      order.returnConfirmed = false;

      // KHÔNG thay đổi inventoryDeducted (vẫn = true)
      // Chờ staff xác nhận rồi mới hoàn kho

      console.log(
        `[Shipper Service] Order ${order.code}: Giao thất bại 3 lần, hàng đang trả về kho`
      );

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
  } else if (status === "out_for_delivery") {
    order.status = "out_for_delivery";
  }

  // Thêm vào status history
  order.statusHistory.push({
    status: order.status,
    updatedAt: new Date(),
    updatedBy: shipperId,
    note: note || `Shipper cập nhật trạng thái: ${status}`,
  });

  await order.save();

  return order;
};

/**
 * Lấy đơn hàng của shipper
 */
const getShipperOrders = async (shipperId, query = {}) => {
  const {
    status,
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  const filter = { assignedShipper: shipperId };

  // Filter theo status
  if (status) {
    filter.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("user", "name phone email")
      .populate({
        path: "orderItems.variant",
        select: "sku color images",
        populate: {
          path: "product",
          select: "name slug",
        },
      })
      .populate("orderItems.size", "value")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit)),
    Order.countDocuments(filter),
  ]);

  return {
    orders,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
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
  getShipperStats,
  getShipperById,
};
