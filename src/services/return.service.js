const { ReturnRequest, Order } = require("../models");
const ApiError = require("../utils/ApiError");
const inventoryService = require("./inventory.service");

/**
 * Tạo yêu cầu đổi/trả hàng
 */
const createReturnRequest = async (data, userId) => {
  const {
    orderId,
    type,
    items,
    reason,
    reasonDetail,
    images,
    refundMethod,
    bankInfo,
  } = data;

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
    throw new ApiError(400, "Đã quá thời hạn đổi/trả hàng (7 ngày)");
  }

  // Tính tổng tiền hoàn
  let refundAmount = 0;
  const validatedItems = [];

  for (const item of items) {
    const orderItem = order.orderItems.find(
      (oi) =>
        oi.variant.toString() === item.variant &&
        oi.size.toString() === item.size
    );

    if (!orderItem) {
      throw new ApiError(400, "Sản phẩm không tồn tại trong đơn hàng");
    }

    if (item.quantity > orderItem.quantity) {
      throw new ApiError(400, "Số lượng trả vượt quá số lượng đã mua");
    }

    refundAmount += orderItem.price * item.quantity;

    validatedItems.push({
      product: orderItem.variant, // Will be populated to get product
      variant: item.variant,
      size: item.size,
      quantity: item.quantity,
      priceAtPurchase: orderItem.price,
      exchangeToVariant: item.exchangeToVariant,
      exchangeToSize: item.exchangeToSize,
    });
  }

  // Tạo yêu cầu
  const returnRequest = await ReturnRequest.create({
    order: orderId,
    customer: userId,
    type,
    items: validatedItems,
    reason,
    reasonDetail,
    images: images || [],
    refundMethod: type === "RETURN" ? refundMethod : undefined,
    refundAmount: type === "RETURN" ? refundAmount : undefined,
    bankInfo: refundMethod === "bank_transfer" ? bankInfo : undefined,
    status: "pending",
  });

  return await returnRequest.populate([
    { path: "order" },
    { path: "customer", select: "name email phone" },
    { path: "items.variant" },
    { path: "items.size" },
  ]);
};

/**
 * Lấy danh sách yêu cầu đổi/trả
 */
const getReturnRequests = async (filter = {}, options = {}) => {
  const {
    page = 1,
    limit = 20,
    status,
    type,
    customerId,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  const query = {};

  if (status) {
    query.status = status;
  }

  if (type) {
    query.type = type;
  }

  if (customerId) {
    query.customer = customerId;
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

  const [requests, total] = await Promise.all([
    ReturnRequest.find(query)
      .populate("order")
      .populate("customer", "name email phone")
      .populate("items.variant")
      .populate("items.size")
      .populate("approvedBy", "name")
      .populate("processedBy", "name")
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
    .populate("order")
    .populate("customer", "name email phone")
    .populate("items.variant")
    .populate("items.size")
    .populate("items.exchangeToVariant")
    .populate("items.exchangeToSize")
    .populate("approvedBy", "name")
    .populate("processedBy", "name");

  if (!request) {
    throw new ApiError(404, "Không tìm thấy yêu cầu đổi/trả");
  }

  return request;
};

/**
 * Phê duyệt yêu cầu đổi/trả
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

  return await request.populate([
    { path: "order" },
    { path: "customer", select: "name email phone" },
    { path: "approvedBy", select: "name" },
  ]);
};

/**
 * Từ chối yêu cầu đổi/trả
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

  return await request.populate([
    { path: "order" },
    { path: "customer", select: "name email phone" },
    { path: "approvedBy", select: "name" },
  ]);
};

/**
 * Xử lý trả hàng (nhận hàng về kho và hoàn tiền)
 */
const processReturn = async (id, processedBy) => {
  const request = await ReturnRequest.findById(id).populate([
    { path: "order" },
    {
      path: "items.variant",
      populate: { path: "product", select: "_id name" },
    },
  ]);

  if (!request) {
    throw new ApiError(404, "Không tìm thấy yêu cầu");
  }

  // ============================================================
  // VALIDATION: Kiểm tra trạng thái request
  // ============================================================
  if (request.status === "completed") {
    throw new ApiError(400, "Yêu cầu đã được xử lý hoàn tất trước đó");
  }

  if (request.status === "cancelled") {
    throw new ApiError(400, "Yêu cầu đã bị hủy, không thể xử lý");
  }

  if (request.status !== "approved") {
    throw new ApiError(400, "Yêu cầu chưa được phê duyệt");
  }

  if (request.type !== "RETURN") {
    throw new ApiError(400, "Yêu cầu này không phải là trả hàng");
  }

  // ============================================================
  // VALIDATION: Kiểm tra trạng thái đơn hàng
  // ============================================================
  const order = await Order.findById(request.order);

  if (!order) {
    throw new ApiError(404, "Không tìm thấy đơn hàng liên kết");
  }

  // Chỉ cho phép trả hàng từ các trạng thái hợp lệ
  const allowedOrderStatuses = ["delivered", "returning_to_warehouse"];
  if (!allowedOrderStatuses.includes(order.status)) {
    throw new ApiError(
      400,
      `Đơn hàng đang ở trạng thái "${
        order.status
      }", không thể xử lý trả hàng. Chỉ chấp nhận: ${allowedOrderStatuses.join(
        ", "
      )}`
    );
  }

  // ============================================================
  // VALIDATION: Kiểm tra thời hạn trả hàng (7 ngày)
  // ============================================================
  if (!order.deliveredAt) {
    throw new ApiError(400, "Đơn hàng chưa được giao, không thể trả hàng");
  }

  const daysSinceDelivery = Math.floor(
    (new Date() - new Date(order.deliveredAt)) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceDelivery > 7) {
    throw new ApiError(
      400,
      `Đã quá thời hạn trả hàng (7 ngày). Đơn hàng được giao ${daysSinceDelivery} ngày trước.`
    );
  }

  request.status = "processing";
  await request.save();

  // Nhập hàng về kho
  for (const item of request.items) {
    await inventoryService.stockIn(
      {
        product: item.variant.product,
        variant: item.variant._id,
        size: item.size,
        quantity: item.quantity,
        costPrice: item.priceAtPurchase * 0.8, // Giả sử giá nhập = 80% giá bán
        reason: "return",
        notes: `Trả hàng từ đơn ${request.order.code}`,
      },
      processedBy
    );
  }

  // Cập nhật trạng thái đơn hàng
  order.status = "returned";
  order.statusHistory.push({
    status: "returned",
    updatedAt: new Date(),
    updatedBy: processedBy,
    note: `Khách hàng trả hàng. Lý do: ${request.reason}`,
  });
  await order.save();

  // Hoàn thành yêu cầu
  request.status = "completed";
  request.processedBy = processedBy;
  request.processedAt = new Date();
  request.completedAt = new Date();
  await request.save();

  return await request.populate([
    { path: "customer", select: "name email phone" },
    { path: "processedBy", select: "name" },
  ]);
};

/**
 * Xử lý đổi hàng
 */
const processExchange = async (id, processedBy) => {
  const request = await ReturnRequest.findById(id).populate([
    { path: "order" },
    { path: "items.variant" },
    { path: "items.exchangeToVariant" },
  ]);

  if (!request) {
    throw new ApiError(404, "Không tìm thấy yêu cầu");
  }

  if (request.status !== "approved") {
    throw new ApiError(400, "Yêu cầu chưa được phê duyệt");
  }

  if (request.type !== "EXCHANGE") {
    throw new ApiError(400, "Yêu cầu này không phải là đổi hàng");
  }

  request.status = "processing";
  await request.save();

  // Nhập hàng cũ về kho và xuất hàng mới
  for (const item of request.items) {
    // Nhập hàng cũ
    await inventoryService.stockIn(
      {
        product: item.variant.product,
        variant: item.variant._id,
        size: item.size,
        quantity: item.quantity,
        costPrice: item.priceAtPurchase * 0.8,
        reason: "exchange",
        notes: `Đổi hàng từ đơn ${request.order.code}`,
      },
      processedBy
    );

    // Xuất hàng mới
    await inventoryService.stockOut(
      {
        product: item.exchangeToVariant.product,
        variant: item.exchangeToVariant._id,
        size: item.exchangeToSize,
        quantity: item.quantity,
        reason: "exchange",
        reference: {
          type: "ReturnRequest",
          id: request._id,
        },
        notes: `Đổi hàng mới cho đơn ${request.order.code}`,
      },
      processedBy
    );
  }

  // Hoàn thành yêu cầu
  request.status = "completed";
  request.processedBy = processedBy;
  request.processedAt = new Date();
  request.completedAt = new Date();
  await request.save();

  return await request.populate([
    { path: "customer", select: "name email phone" },
    { path: "processedBy", select: "name" },
  ]);
};

/**
 * Hủy yêu cầu (khách hàng tự hủy)
 */
const cancelReturnRequest = async (id, userId) => {
  const request = await ReturnRequest.findOne({
    _id: id,
    customer: userId,
  });

  if (!request) {
    throw new ApiError(404, "Không tìm thấy yêu cầu");
  }

  if (request.status !== "pending") {
    throw new ApiError(400, "Chỉ có thể hủy yêu cầu đang chờ xử lý");
  }

  request.status = "canceled";
  await request.save();

  return request;
};

/**
 * Thống kê đổi trả
 */
const getReturnStats = async () => {
  const [
    totalRequests,
    pendingRequests,
    approvedRequests,
    completedRequests,
    rejectedRequests,
    returnRequests,
    exchangeRequests,
  ] = await Promise.all([
    ReturnRequest.countDocuments(),
    ReturnRequest.countDocuments({ status: "pending" }),
    ReturnRequest.countDocuments({ status: "approved" }),
    ReturnRequest.countDocuments({ status: "completed" }),
    ReturnRequest.countDocuments({ status: "rejected" }),
    ReturnRequest.countDocuments({ type: "RETURN" }),
    ReturnRequest.countDocuments({ type: "EXCHANGE" }),
  ]);

  return {
    totalRequests,
    pendingRequests,
    approvedRequests,
    completedRequests,
    rejectedRequests,
    returnRequests,
    exchangeRequests,
  };
};

module.exports = {
  createReturnRequest,
  getReturnRequests,
  getReturnRequestById,
  approveReturnRequest,
  rejectReturnRequest,
  processReturn,
  processExchange,
  cancelReturnRequest,
  getReturnStats,
};
