const { ReturnRequest, Order, User } = require("../models");
const ApiError = require("../utils/ApiError");
const inventoryService = require("./inventory.service");
const mongoose = require("mongoose");

/**
 * PHÍ TRẢ HÀNG MẶC ĐỊNH
 */
const RETURN_SHIPPING_FEE = 30000; // 30.000đ

/**
 * Tạo yêu cầu trả hàng/hoàn tiền
 * - Trả TOÀN BỘ đơn hàng
 * - Phí trả hàng: 30.000đ
 */
const createReturnRequest = async (data, userId) => {
  const { orderId, reason, reasonDetail, refundMethod, bankInfo } = data;

  // Kiểm tra đơn hàng
  const order = await Order.findOne({
    _id: orderId,
    user: userId,
    status: "delivered",
  });

  if (!order) {
    throw new ApiError(
      404,
      "Không tìm thấy đơn hàng hoặc đơn hàng chưa được giao"
    );
  }

  // Kiểm tra thời hạn đổi trả (7 ngày)
  const daysSinceDelivery = Math.floor(
    (new Date() - order.deliveredAt) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceDelivery > 7) {
    throw new ApiError(400, "Đã quá thời hạn trả hàng (7 ngày kể từ khi giao)");
  }

  // Kiểm tra đã có yêu cầu trả hàng chưa
  const existingRequest = await ReturnRequest.findOne({
    order: orderId,
    status: { $nin: ["rejected", "canceled"] },
  });

  if (existingRequest) {
    throw new ApiError(400, "Đơn hàng này đã có yêu cầu trả hàng đang xử lý");
  }

  // Validate refundMethod
  if (!["cash", "bank_transfer"].includes(refundMethod)) {
    throw new ApiError(400, "Phương thức hoàn tiền không hợp lệ");
  }

  // Nếu chuyển khoản, phải có thông tin ngân hàng
  if (refundMethod === "bank_transfer") {
    if (
      !bankInfo ||
      !bankInfo.bankName ||
      !bankInfo.accountNumber ||
      !bankInfo.accountName
    ) {
      throw new ApiError(400, "Vui lòng nhập đầy đủ thông tin ngân hàng");
    }
  }

  // Tính số tiền hoàn = tổng đơn hàng - phí ship trả hàng 30k
  // totalAfterDiscountAndShipping đã bao gồm giá sản phẩm + ship ban đầu - discount
  const refundAmount =
    order.totalAfterDiscountAndShipping - RETURN_SHIPPING_FEE;

  if (refundAmount < 0) {
    throw new ApiError(400, "Số tiền hoàn không hợp lệ");
  }

  // Tạo yêu cầu
  const returnRequest = await ReturnRequest.create({
    order: orderId,
    customer: userId,
    reason,
    reasonDetail: reasonDetail || "",
    refundMethod,
    refundAmount,
    bankInfo: refundMethod === "bank_transfer" ? bankInfo : undefined,
    returnShippingFee: RETURN_SHIPPING_FEE,
    status: "pending",
  });

  return await returnRequest.populate([
    { path: "order" },
    { path: "customer", select: "name email phone" },
  ]);
};

/**
 * Lấy danh sách yêu cầu trả hàng
 */
const getReturnRequests = async (filter = {}, options = {}) => {
  // AUTO-REJECT expired pending requests
  const now = new Date();
  await ReturnRequest.updateMany(
    {
      status: "pending",
      expiresAt: { $lt: now },
    },
    {
      $set: {
        status: "rejected",
        rejectionReason: "Tự động từ chối do quá thời hạn xử lý (7 ngày)",
        autoRejectedAt: now,
      },
    }
  );

  const {
    page = 1,
    limit = 20,
    status,
    customerId,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  const query = {};

  if (status) {
    query.status = status;
  }

  if (customerId) {
    query.customer = customerId;
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

  const [requests, total] = await Promise.all([
    ReturnRequest.find(query)
      .populate({
        path: "order",
        populate: [
          {
            path: "orderItems.variant",
            populate: [
              { path: "product", select: "name images slug" },
              { path: "color", select: "name code" },
            ],
          },
          {
            path: "orderItems.size",
            select: "value",
          },
        ],
      })
      .populate("customer", "name email phone")
      .populate("approvedBy", "name")
      .populate("assignedShipper", "name phone")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    ReturnRequest.countDocuments(query),
  ]);

  return {
    requests,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Lấy chi tiết yêu cầu
 */
const getReturnRequestById = async (id, userId, isAdmin = false) => {
  const query = { _id: id };

  if (!isAdmin) {
    query.customer = userId;
  }

  const request = await ReturnRequest.findOne(query)
    .populate({
      path: "order",
      populate: [
        {
          path: "orderItems.variant",
          populate: [
            { path: "product", select: "name images slug" },
            { path: "color", select: "name code" },
          ],
        },
        { path: "orderItems.size", select: "value" },
      ],
    })
    .populate("customer", "name email phone avatar")
    .populate("approvedBy", "name")
    .populate("assignedShipper", "name phone shipper")
    .populate("receivedBy", "name")
    .populate("completedBy", "name");

  if (!request) {
    throw new ApiError(404, "Không tìm thấy yêu cầu trả hàng");
  }

  return request;
};

/**
 * Admin phê duyệt yêu cầu
 */
const approveReturnRequest = async (id, approvedBy, staffNotes) => {
  const request = await ReturnRequest.findById(id);

  if (!request) {
    throw new ApiError(404, "Không tìm thấy yêu cầu");
  }

  if (request.status !== "pending") {
    throw new ApiError(400, "Yêu cầu đã được xử lý");
  }

  request.status = "approved";
  request.approvedBy = approvedBy;
  request.approvedAt = new Date();
  if (staffNotes) {
    request.staffNotes = staffNotes;
  }

  await request.save();

  // Gửi notification
  try {
    const notificationService = require("./notification.service");
    const populatedRequest = await ReturnRequest.findById(request._id).populate(
      "order"
    );
    await notificationService.send(request.customer, "RETURN_APPROVED", {
      type: "trả hàng",
      orderCode: populatedRequest.order?.code || "",
      returnRequestId: request._id,
      returnRequestCode: request.code,
    });
  } catch (error) {
    console.error("[Return] Lỗi gửi notification approved:", error.message);
  }

  return await request.populate([
    { path: "order" },
    { path: "customer", select: "name email phone" },
    { path: "approvedBy", select: "name" },
  ]);
};

/**
 * Admin từ chối yêu cầu
 */
const rejectReturnRequest = async (id, approvedBy, rejectionReason) => {
  const request = await ReturnRequest.findById(id);

  if (!request) {
    throw new ApiError(404, "Không tìm thấy yêu cầu");
  }

  if (request.status !== "pending") {
    throw new ApiError(400, "Yêu cầu đã được xử lý");
  }

  request.status = "rejected";
  request.approvedBy = approvedBy;
  request.approvedAt = new Date();
  request.rejectionReason = rejectionReason;

  await request.save();

  // Gửi notification
  try {
    const notificationService = require("./notification.service");
    const populatedRequest = await ReturnRequest.findById(request._id).populate(
      "order"
    );
    await notificationService.send(request.customer, "RETURN_REJECTED", {
      type: "trả hàng",
      orderCode: populatedRequest.order?.code || "",
      returnRequestId: request._id,
      returnRequestCode: request.code,
      rejectionReason: rejectionReason,
    });
  } catch (error) {
    console.error("[Return] Lỗi gửi notification rejected:", error.message);
  }

  return await request.populate([
    { path: "order" },
    { path: "customer", select: "name email phone" },
    { path: "approvedBy", select: "name" },
  ]);
};

/**
 * Admin gán shipper đi lấy hàng trả
 */
const assignShipperForReturn = async (id, shipperId, assignedBy) => {
  const request = await ReturnRequest.findById(id);

  if (!request) {
    throw new ApiError(404, "Không tìm thấy yêu cầu");
  }

  if (request.status !== "approved") {
    throw new ApiError(400, "Chỉ có thể gán shipper cho yêu cầu đã được duyệt");
  }

  // Kiểm tra shipper
  const shipper = await User.findOne({ _id: shipperId, role: "shipper" });
  if (!shipper) {
    throw new ApiError(404, "Không tìm thấy shipper");
  }

  if (!shipper.shipper?.isAvailable) {
    throw new ApiError(400, "Shipper không khả dụng");
  }

  request.status = "shipping";
  request.assignedShipper = shipperId;
  request.assignedAt = new Date();

  await request.save();

  // Gửi notification cho shipper
  try {
    const notificationService = require("./notification.service");
    await notificationService.send(shipperId, "RETURN_ASSIGNED_TO_SHIPPER", {
      returnRequestCode: request.code,
      returnRequestId: request._id,
    });
  } catch (error) {
    console.error("[Return] Lỗi gửi notification shipper:", error.message);
  }

  return await request.populate([
    { path: "order" },
    { path: "customer", select: "name email phone" },
    { path: "assignedShipper", select: "name phone" },
  ]);
};

/**
 * Shipper xác nhận đã lấy hàng về kho
 */
const shipperConfirmReceived = async (id, shipperId, note) => {
  const request = await ReturnRequest.findOne({
    _id: id,
    assignedShipper: shipperId,
    status: "shipping",
  });

  if (!request) {
    throw new ApiError(404, "Không tìm thấy yêu cầu hoặc không có quyền");
  }

  request.status = "received";
  request.receivedBy = shipperId;
  request.receivedAt = new Date();
  if (note) {
    request.staffNotes = (request.staffNotes || "") + `\nShipper note: ${note}`;
  }

  await request.save();

  // Hoàn hàng về kho
  try {
    const order = await Order.findById(request.order).populate({
      path: "orderItems.variant",
      select: "product",
    });

    for (const item of order.orderItems) {
      await inventoryService.stockIn(
        {
          product: item.variant.product,
          variant: item.variant._id,
          size: item.size,
          quantity: item.quantity,
          costPrice: 0,
          reason: "return",
          notes: `Trả hàng từ đơn ${order.code}`,
          reference: request._id.toString(),
        },
        shipperId
      );
    }

    // Đánh dấu order đã hoàn kho
    order.status = "returned";
    order.inventoryRestored = true;
    order.statusHistory.push({
      status: "returned",
      updatedAt: new Date(),
      updatedBy: shipperId,
      note: `Khách hàng trả hàng. Lý do: ${request.reason}`,
    });
    await order.save();
  } catch (error) {
    console.error("[Return] Lỗi hoàn kho:", error.message);
  }

  return await request.populate([
    { path: "order" },
    { path: "customer", select: "name email phone" },
    { path: "receivedBy", select: "name" },
  ]);
};

/**
 * Shipper xác nhận đã giao tiền hoàn cho khách (nếu refundMethod = cash)
 */
const shipperConfirmRefundDelivered = async (id, shipperId, note) => {
  const request = await ReturnRequest.findOne({
    _id: id,
    assignedShipper: shipperId,
    refundMethod: "cash",
    status: { $in: ["received", "refunded"] },
  });

  if (!request) {
    throw new ApiError(404, "Không tìm thấy yêu cầu hoặc không có quyền");
  }

  if (request.refundCollectedByShipper?.collected) {
    throw new ApiError(400, "Đã xác nhận giao tiền hoàn rồi");
  }

  request.refundCollectedByShipper = {
    collected: true,
    collectedAt: new Date(),
    shipperId: shipperId,
    note: note || "",
  };
  request.status = "completed";
  request.completedBy = shipperId;
  request.completedAt = new Date();

  await request.save();

  // Gửi notification cho khách
  try {
    const notificationService = require("./notification.service");
    await notificationService.send(request.customer, "RETURN_COMPLETED", {
      type: "trả hàng",
      returnRequestCode: request.code,
      refundAmount: request.refundAmount,
    });
  } catch (error) {
    console.error("[Return] Lỗi gửi notification completed:", error.message);
  }

  // Trừ điểm loyalty
  try {
    const loyaltyService = require("./loyalty.service");
    const LoyaltyTransaction = require("../models/loyaltyTransaction");
    const earnTransaction = await LoyaltyTransaction.findOne({
      user: request.customer,
      type: "EARN",
      source: "ORDER",
      order: request.order,
      isExpired: false,
    });

    if (earnTransaction && earnTransaction.points > 0) {
      await loyaltyService.deductPoints(
        request.customer,
        earnTransaction.points,
        {
          type: "DEDUCT",
          source: "RETURN",
          description: `Trừ điểm do trả hàng #${request.code}`,
        }
      );
    }
  } catch (error) {
    console.error("[Return] Lỗi trừ điểm loyalty:", error.message);
  }

  return await request.populate([
    { path: "order" },
    { path: "customer", select: "name email phone" },
    { path: "completedBy", select: "name" },
  ]);
};

/**
 * Admin xác nhận đã chuyển khoản hoàn tiền (nếu refundMethod = bank_transfer)
 */
const adminConfirmBankTransfer = async (id, adminId, note) => {
  const request = await ReturnRequest.findOne({
    _id: id,
    refundMethod: "bank_transfer",
    status: "received",
  });

  if (!request) {
    throw new ApiError(
      404,
      "Không tìm thấy yêu cầu hoặc trạng thái không hợp lệ"
    );
  }

  request.status = "completed";
  request.completedBy = adminId;
  request.completedAt = new Date();
  if (note) {
    request.staffNotes = (request.staffNotes || "") + `\nAdmin note: ${note}`;
  }

  await request.save();

  // Gửi notification
  try {
    const notificationService = require("./notification.service");
    await notificationService.send(request.customer, "RETURN_COMPLETED", {
      type: "trả hàng",
      returnRequestCode: request.code,
      refundAmount: request.refundAmount,
    });
  } catch (error) {
    console.error("[Return] Lỗi gửi notification completed:", error.message);
  }

  // Trừ điểm loyalty
  try {
    const loyaltyService = require("./loyalty.service");
    const LoyaltyTransaction = require("../models/loyaltyTransaction");
    const earnTransaction = await LoyaltyTransaction.findOne({
      user: request.customer,
      type: "EARN",
      source: "ORDER",
      order: request.order,
      isExpired: false,
    });

    if (earnTransaction && earnTransaction.points > 0) {
      await loyaltyService.deductPoints(
        request.customer,
        earnTransaction.points,
        {
          type: "DEDUCT",
          source: "RETURN",
          description: `Trừ điểm do trả hàng #${request.code}`,
        }
      );
    }
  } catch (error) {
    console.error("[Return] Lỗi trừ điểm loyalty:", error.message);
  }

  return await request.populate([
    { path: "order" },
    { path: "customer", select: "name email phone" },
    { path: "completedBy", select: "name" },
  ]);
};

/**
 * Khách hàng tự hủy yêu cầu
 */
const cancelReturnRequest = async (id, userId) => {
  const request = await ReturnRequest.findOne({
    _id: id,
    customer: userId,
  });

  if (!request) {
    throw new ApiError(404, "Không tìm thấy yêu cầu");
  }

  if (!["pending", "approved"].includes(request.status)) {
    throw new ApiError(
      400,
      "Chỉ có thể hủy yêu cầu đang chờ xử lý hoặc đã duyệt"
    );
  }

  request.status = "canceled";
  await request.save();

  return request;
};

/**
 * Lấy danh sách yêu cầu trả hàng được gán cho shipper
 */
const getShipperReturnRequests = async (shipperId, options = {}) => {
  const { status, page = 1, limit = 20 } = options;

  const query = { assignedShipper: shipperId };
  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const [requests, total] = await Promise.all([
    ReturnRequest.find(query)
      .populate("order")
      .populate("customer", "name phone")
      .sort({ assignedAt: -1 })
      .skip(skip)
      .limit(limit),
    ReturnRequest.countDocuments(query),
  ]);

  return {
    requests,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Thống kê đổi trả
 */
const getReturnStats = async () => {
  const [
    totalRequests,
    pendingRequests,
    approvedRequests,
    shippingRequests,
    receivedRequests,
    completedRequests,
    rejectedRequests,
  ] = await Promise.all([
    ReturnRequest.countDocuments(),
    ReturnRequest.countDocuments({ status: "pending" }),
    ReturnRequest.countDocuments({ status: "approved" }),
    ReturnRequest.countDocuments({ status: "shipping" }),
    ReturnRequest.countDocuments({ status: "received" }),
    ReturnRequest.countDocuments({ status: "completed" }),
    ReturnRequest.countDocuments({ status: "rejected" }),
  ]);

  return {
    totalRequests,
    pendingRequests,
    approvedRequests,
    shippingRequests,
    receivedRequests,
    completedRequests,
    rejectedRequests,
  };
};

module.exports = {
  createReturnRequest,
  getReturnRequests,
  getReturnRequestById,
  approveReturnRequest,
  rejectReturnRequest,
  assignShipperForReturn,
  shipperConfirmReceived,
  shipperConfirmRefundDelivered,
  adminConfirmBankTransfer,
  cancelReturnRequest,
  getShipperReturnRequests,
  getReturnStats,
  RETURN_SHIPPING_FEE,
};
