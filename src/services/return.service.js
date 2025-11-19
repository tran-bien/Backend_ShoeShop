const { ReturnRequest, Order, InventoryItem } = require("../models");
const ApiError = require("../utils/ApiError");
const inventoryService = require("./inventory.service");
const mongoose = require("mongoose");

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
  }).populate({
    path: "orderItems.variant",
    select: "product",
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

  // VALIDATION: CHỈ ĐỔI 1 LẦN DUY NHẤT - SỬ DỤNG TRANSACTION
  if (type === "EXCHANGE") {
    // Bắt đầu MongoDB Transaction để tránh race condition
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (const item of items) {
        const orderItem = order.orderItems.find(
          (oi) =>
            oi.variant.toString() === item.variant &&
            oi.size.toString() === item.size
        );

        if (!orderItem) {
          throw new ApiError(400, "Sản phẩm không tồn tại trong đơn hàng");
        }

        // FIXED: Sử dụng findOneAndUpdate với session để lock document
        const lockedOrder = await Order.findOneAndUpdate(
          {
            _id: orderId,
            "orderItems.variant": item.variant,
            "orderItems.size": item.size,
            "orderItems.hasBeenExchanged": false, // Optimistic lock
          },
          {
            $set: {
              "orderItems.$.lockVersion": Date.now(), // Temporary lock
            },
          },
          { session, new: true }
        );

        if (!lockedOrder) {
          throw new ApiError(
            400,
            `Sản phẩm "${orderItem.productName}" đã được đổi hoặc đang được xử lý bởi yêu cầu khác.`
          );
        }

        // Kiểm tra có yêu cầu đổi hàng nào đang pending/approved cho sản phẩm này không
        const existingExchangeRequest = await ReturnRequest.findOne(
          {
            order: orderId,
            type: "EXCHANGE",
            status: { $in: ["pending", "approved", "processing"] },
            "items.variant": item.variant,
            "items.size": item.size,
          },
          null,
          { session }
        );

        if (existingExchangeRequest) {
          throw new ApiError(
            400,
            `Đã có yêu cầu đổi hàng cho sản phẩm "${orderItem.productName}" đang được xử lý. Vui lòng đợi hoàn tất hoặc hủy yêu cầu cũ.`
          );
        }
      }

      // Commit transaction nếu tất cả validation pass
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // VALIDATE & TÍNH TOÁN - Partial return + shipping fee
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

    // FIXED: Hỗ trợ partial return - Kiểm tra số lượng trả
    if (item.quantity > orderItem.quantity) {
      throw new ApiError(400, "Số lượng trả vượt quá số lượng đã mua");
    }

    // Tính tiền hoàn cho item này
    refundAmount += orderItem.price * item.quantity;

    validatedItems.push({
      product: orderItem.variant.product, // FIXED: Lấy product ID từ populated variant
      variant: item.variant,
      size: item.size,
      quantity: item.quantity,
      priceAtPurchase: orderItem.price,
      exchangeToVariant: item.exchangeToVariant,
      exchangeToSize: item.exchangeToSize,
    });
  }

  // TÍNH PHÍ SHIP - Shipping fee handling
  const shippingFeeData = {
    customerPay: 30000, // Mặc định khách trả 30k ship về
    refundShippingFee: false,
    originalShippingFee: order.shippingFee || 0,
  };

  // Nếu lỗi do shop (defective, wrong_product, not_as_described) thì shop chịu phí ship
  if (["defective", "wrong_product", "not_as_described"].includes(reason)) {
    shippingFeeData.customerPay = 0; // Shop chịu phí ship về
    shippingFeeData.refundShippingFee = true; // Hoàn lại phí ship ban đầu
    refundAmount += shippingFeeData.originalShippingFee;
  }

  // TÍNH CHÊNH LỆCH GIÁ - Price difference for EXCHANGE
  let priceDifferenceData = {
    amount: 0,
    direction: "equal",
    isPaid: false,
  };

  if (type === "EXCHANGE") {
    // Tính chênh lệch giá giữa sản phẩm cũ và mới
    for (const item of validatedItems) {
      if (item.exchangeToVariant) {
        const Variant = mongoose.model("Variant");
        const Product = mongoose.model("Product");

        // Lấy giá sản phẩm mới
        const newVariant = await Variant.findById(
          item.exchangeToVariant
        ).populate("product");
        const newProduct = newVariant ? newVariant.product : null;

        if (newProduct) {
          const newPrice = newProduct.price || 0;
          const oldPrice = item.priceAtPurchase;
          const priceDiff = (newPrice - oldPrice) * item.quantity;

          priceDifferenceData.amount += priceDiff;
        }
      }
    }

    // Xác định hướng thanh toán
    if (priceDifferenceData.amount > 0) {
      priceDifferenceData.direction = "customer_pay"; // Khách phải trả thêm
    } else if (priceDifferenceData.amount < 0) {
      priceDifferenceData.direction = "refund_to_customer"; // Hoàn lại khách
      refundAmount += Math.abs(priceDifferenceData.amount);
    } else {
      priceDifferenceData.direction = "equal"; // Bằng nhau
    }
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
    shippingFee: shippingFeeData,
    priceDifference: priceDifferenceData,
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
  // AUTO-REJECT expired pending requests trước khi query
  const now = new Date();
  const expiredResult = await ReturnRequest.updateMany(
    {
      status: "pending",
      expiresAt: { $lt: now },
    },
    {
      $set: {
        status: "rejected",
        rejectionReason:
          "Tự động từ chối do quá thời hạn xử lý (7 ngày kể từ khi tạo)",
        autoRejectedAt: now,
      },
    }
  );

  if (expiredResult.modifiedCount > 0) {
    console.log(
      `[AUTO-REJECT] Đã tự động reject ${expiredResult.modifiedCount} return request(s) quá hạn`
    );
  }

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

  // VALIDATION: Kiểm tra trạng thái request
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

  // VALIDATION: Kiểm tra trạng thái đơn hàng
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

  // VALIDATION: Kiểm tra thời hạn trả hàng (7 ngày)
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
    {
      path: "items.variant",
      populate: { path: "product", select: "_id name" },
    },
    {
      path: "items.exchangeToVariant",
      populate: { path: "product", select: "_id name" },
    },
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
    // Verify exchangeToVariant exists và có đủ inventory
    if (!item.exchangeToVariant) {
      throw new ApiError(400, "Biến thể đổi sang không hợp lệ");
    }

    if (!item.exchangeToSize) {
      throw new ApiError(400, "Kích cỡ đổi sang không hợp lệ");
    }

    // Check inventory của sản phẩm mới trước khi xuất
    const newInventoryItem = await InventoryItem.findOne({
      product: item.exchangeToVariant.product,
      variant: item.exchangeToVariant._id,
      size: item.exchangeToSize,
    });

    if (!newInventoryItem || newInventoryItem.quantity < item.quantity) {
      throw new ApiError(
        400,
        `Không đủ tồn kho cho sản phẩm đổi. Còn lại: ${
          newInventoryItem?.quantity || 0
        }, cần: ${item.quantity}`
      );
    }

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
        reference: request._id, // ✅ FIXED: ObjectId thay vì object
        notes: `Đổi hàng mới cho đơn ${request.order.code}`,
      },
      processedBy
    );
  }

  // ============================================================
  // UPDATE ORDER: Đánh dấu orderItem đã được đổi
  // ============================================================
  const Order = require("../models").Order;
  const order = await Order.findById(request.order._id);

  for (const item of request.items) {
    // Tìm orderItem tương ứng
    const orderItemIndex = order.orderItems.findIndex(
      (oi) =>
        oi.variant.toString() === item.variant._id.toString() &&
        oi.size.toString() === item.size.toString()
    );

    if (orderItemIndex === -1) {
      throw new ApiError(400, "Không tìm thấy sản phẩm trong đơn hàng");
    }

    // ✅ FIXED: RE-VALIDATE hasBeenExchanged để tránh race condition
    if (order.orderItems[orderItemIndex].hasBeenExchanged) {
      throw new ApiError(
        400,
        `Sản phẩm đã được đổi bởi một request khác. Không thể xử lý.`
      );
    }

    // Đánh dấu đã đổi
    order.orderItems[orderItemIndex].hasBeenExchanged = true;

    // Thêm vào lịch sử đổi hàng
    order.orderItems[orderItemIndex].exchangeHistory.push({
      returnRequestId: request._id,
      exchangedAt: new Date(),
      fromVariant: item.variant._id,
      fromSize: item.size,
      toVariant: item.exchangeToVariant._id,
      toSize: item.exchangeToSize,
    });
  }

  // Lưu order
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

/**
 * Kiểm tra orderItem có thể đổi hàng không
 * @param {String} orderId - ID đơn hàng
 * @param {String} variantId - ID variant
 * @param {String} sizeId - ID size
 * @param {String} userId - ID user (để verify ownership)
 * @returns {Object} - { canExchange: boolean, reason: string }
 */
const checkItemExchangeEligibility = async (
  orderId,
  variantId,
  sizeId,
  userId
) => {
  // Kiểm tra đơn hàng
  const order = await Order.findOne({
    _id: orderId,
    user: userId,
  });

  if (!order) {
    return {
      canExchange: false,
      reason: "Không tìm thấy đơn hàng hoặc bạn không có quyền truy cập",
    };
  }

  // Kiểm tra trạng thái đơn hàng
  if (order.status !== "delivered") {
    return {
      canExchange: false,
      reason: `Đơn hàng phải ở trạng thái "delivered". Hiện tại: ${order.status}`,
    };
  }

  // Kiểm tra thời hạn (7 ngày)
  if (!order.deliveredAt) {
    return {
      canExchange: false,
      reason: "Đơn hàng chưa có thông tin ngày giao hàng",
    };
  }

  const daysSinceDelivery = Math.floor(
    (new Date() - order.deliveredAt) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceDelivery > 7) {
    return {
      canExchange: false,
      reason: `Đã quá thời hạn đổi hàng (7 ngày). Đơn hàng được giao ${daysSinceDelivery} ngày trước.`,
    };
  }

  // Tìm orderItem
  const orderItem = order.orderItems.find(
    (item) =>
      item.variant.toString() === variantId && item.size.toString() === sizeId
  );

  if (!orderItem) {
    return {
      canExchange: false,
      reason: "Sản phẩm không tồn tại trong đơn hàng",
    };
  }

  // Kiểm tra đã đổi chưa
  if (orderItem.hasBeenExchanged) {
    return {
      canExchange: false,
      reason: `Sản phẩm "${orderItem.productName}" đã được đổi trước đó. Mỗi sản phẩm chỉ được đổi 1 lần.`,
      exchangeHistory: orderItem.exchangeHistory,
    };
  }

  // Kiểm tra có yêu cầu đang xử lý không
  const pendingRequest = await ReturnRequest.findOne({
    order: orderId,
    type: "EXCHANGE",
    status: { $in: ["pending", "approved", "processing"] },
    "items.variant": variantId,
    "items.size": sizeId,
  });

  if (pendingRequest) {
    return {
      canExchange: false,
      reason: `Đã có yêu cầu đổi hàng cho sản phẩm này đang được xử lý (Status: ${pendingRequest.status})`,
      pendingRequestId: pendingRequest._id,
    };
  }

  // Tất cả điều kiện OK
  return {
    canExchange: true,
    reason: "Sản phẩm đủ điều kiện để đổi hàng",
    daysRemaining: 7 - daysSinceDelivery,
    orderItem: {
      productName: orderItem.productName,
      quantity: orderItem.quantity,
      price: orderItem.price,
    },
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
  checkItemExchangeEligibility,
};
