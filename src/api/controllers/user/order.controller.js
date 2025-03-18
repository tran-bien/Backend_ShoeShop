// controllers/order.controller.js
const asyncHandler = require("express-async-handler");
const orderService = require("../services/order.service");

// Lấy danh sách đơn hàng của người dùng
exports.getUserOrders = asyncHandler(async (req, res) => {
  try {
    const options = {
      userId: req.user.id,
      page: req.query.page,
      limit: req.query.limit,
      sort: req.query.sort,
      status: req.query.status,
    };

    const orders = await orderService.getUserOrders(options);
    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    res.status(500);
    throw new Error(error.message);
  }
});

// Lấy chi tiết đơn hàng
exports.getOrderDetails = asyncHandler(async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.id, req.user.id);
    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(404);
    throw new Error(error.message);
  }
});

// Tạo đơn hàng mới
exports.createOrder = asyncHandler(async (req, res) => {
  try {
    const orderData = {
      ...req.body,
      user: req.user.id,
    };

    const newOrder = await orderService.createOrder(orderData);
    res.status(201).json({
      success: true,
      data: newOrder,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// Hủy đơn hàng
exports.cancelOrder = asyncHandler(async (req, res) => {
  try {
    const order = await orderService.cancelOrder(
      req.params.id,
      req.user.id,
      req.body.reason
    );
    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});
