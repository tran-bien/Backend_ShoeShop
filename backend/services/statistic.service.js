const Order = require("../models/order.model");
const Product = require("../models/product.model");
const User = require("../models/user.model");
const mongoose = require("mongoose");

const statisticService = {
  /**
   * Thống kê doanh thu
   * @param {Object} queryParams - Các tham số truy vấn
   * @returns {Object} - Dữ liệu thống kê doanh thu
   */
  getRevenueStatistics: async (queryParams) => {
    const { startDate, endDate, type = "day" } = queryParams;

    const matchStage = {
      status: "delivered",
      paymentStatus: "paid",
      createdAt: {},
    };

    if (startDate) {
      matchStage.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      matchStage.createdAt.$lte = new Date(endDate);
    }

    let groupConfig = {};
    let sortConfig = {};

    switch (type) {
      case "day":
        groupConfig = {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          label: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        };
        sortConfig = { _id: 1 };
        break;
      case "month":
        groupConfig = {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          label: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        };
        sortConfig = { _id: 1 };
        break;
      case "year":
        groupConfig = {
          _id: { $dateToString: { format: "%Y", date: "$createdAt" } },
          label: { $dateToString: { format: "%Y", date: "$createdAt" } },
        };
        sortConfig = { _id: 1 };
        break;
      default:
        throw new Error("Loại thống kê không hợp lệ");
    }

    // Thêm các trường tính toán
    groupConfig.revenue = { $sum: "$totalAmount" };
    groupConfig.orders = { $sum: 1 };
    groupConfig.profit = {
      $sum: { $subtract: ["$totalAmount", "$costAmount"] },
    };

    const revenueData = await Order.aggregate([
      { $match: matchStage },
      { $group: groupConfig },
      { $sort: sortConfig },
    ]);

    return revenueData;
  },

  /**
   * Thống kê sản phẩm bán chạy
   * @param {Object} queryParams - Các tham số truy vấn
   * @returns {Array} - Danh sách sản phẩm bán chạy
   */
  getTopSellingProducts: async (queryParams) => {
    const { limit = 10, startDate, endDate } = queryParams;

    const matchStage = {
      status: { $in: ["delivered", "shipping"] },
    };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const topProducts = await Order.aggregate([
      { $match: matchStage },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.product",
          name: { $first: "$orderItems.name" },
          totalSold: { $sum: "$orderItems.quantity" },
          totalRevenue: {
            $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] },
          },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      {
        $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          totalSold: 1,
          totalRevenue: 1,
          thumbnail: "$productDetails.thumbnail",
          costPrice: { $ifNull: ["$productDetails.costPrice", 0] },
        },
      },
      {
        $addFields: {
          profit: {
            $subtract: [
              "$totalRevenue",
              { $multiply: ["$costPrice", "$totalSold"] },
            ],
          },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: parseInt(limit) },
    ]);

    return topProducts;
  },

  /**
   * Thống kê đơn hàng theo trạng thái
   * @param {Object} queryParams - Các tham số truy vấn
   * @returns {Object} - Dữ liệu thống kê đơn hàng
   */
  getOrderStatistics: async (queryParams) => {
    const { startDate, endDate } = queryParams;

    const matchStage = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const orderStats = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
      {
        $project: {
          status: "$_id",
          count: 1,
          totalAmount: 1,
          _id: 0,
        },
      },
    ]);

    // Tính tổng số đơn hàng
    const totalOrders = await Order.countDocuments(matchStage);

    // Tính tổng doanh thu
    const totalRevenue = orderStats.reduce(
      (acc, curr) => acc + curr.totalAmount,
      0
    );

    // Tính doanh thu trung bình mỗi đơn hàng
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      ordersByStatus: orderStats,
      totalOrders,
      totalRevenue,
      averageOrderValue,
    };
  },

  /**
   * Thống kê tổng quan
   * @returns {Object} - Dữ liệu thống kê tổng quan
   */
  getOverviewStatistics: async () => {
    // Thống kê tổng số đơn hàng
    const totalOrders = await Order.countDocuments();

    // Thống kê tổng doanh thu từ đơn hàng đã giao và đã thanh toán
    const revenueStats = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalCost: { $sum: "$costAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalRevenue = revenueStats[0]?.totalRevenue || 0;
    const totalProfit =
      revenueStats[0]?.totalRevenue - revenueStats[0]?.totalCost || 0;
    const profitMargin =
      totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Thống kê tổng số khách hàng
    const totalCustomers = await User.countDocuments({ role: "user" });

    // Thống kê tổng số sản phẩm
    const totalProducts = await Product.countDocuments();

    // Thống kê đơn hàng mới trong 7, 30 ngày gần đây
    const today = new Date();
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const newOrdersLast7Days = await Order.countDocuments({
      createdAt: { $gte: last7Days },
    });

    const newOrdersLast30Days = await Order.countDocuments({
      createdAt: { $gte: last30Days },
    });

    // Thống kê đơn hàng chưa xử lý
    const pendingOrders = await Order.countDocuments({
      status: "pending",
    });

    // Thống kê đơn hàng đang xử lý
    const processingOrders = await Order.countDocuments({
      status: { $in: ["confirmed", "shipping"] },
    });

    return {
      totalOrders,
      totalRevenue,
      totalProfit,
      profitMargin,
      totalCustomers,
      totalProducts,
      newOrdersLast7Days,
      newOrdersLast30Days,
      pendingOrders,
      processingOrders,
    };
  },

  /**
   * Thống kê theo danh mục sản phẩm
   * @returns {Array} - Dữ liệu thống kê theo danh mục
   */
  getCategoryStatistics: async () => {
    const categoryStats = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: "$categoryInfo" },
      {
        $group: {
          _id: "$category",
          name: { $first: "$categoryInfo.name" },
          count: { $sum: 1 },
          avgPrice: { $avg: "$price" },
          minPrice: { $min: "$price" },
          maxPrice: { $max: "$price" },
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "orderItems.product.category",
          as: "orders",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          count: 1,
          avgPrice: 1,
          minPrice: 1,
          maxPrice: 1,
          totalOrders: { $size: "$orders" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return categoryStats;
  },

  /**
   * Thống kê doanh thu theo phương thức thanh toán
   * @param {Object} queryParams - Các tham số truy vấn
   * @returns {Array} - Dữ liệu thống kê theo phương thức thanh toán
   */
  getPaymentMethodStatistics: async (queryParams) => {
    const { startDate, endDate } = queryParams;

    const matchStage = {
      status: "delivered",
      paymentStatus: "paid",
    };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const paymentStats = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
      {
        $project: {
          method: "$_id",
          count: 1,
          totalAmount: 1,
          percentage: {
            $multiply: [{ $divide: ["$count", { $sum: "$count" }] }, 100],
          },
          _id: 0,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    return paymentStats;
  },

  /**
   * Thống kê khách hàng mới
   * @param {Object} queryParams - Các tham số truy vấn
   * @returns {Object} - Dữ liệu thống kê khách hàng mới
   */
  getNewCustomerStatistics: async (queryParams) => {
    const { type = "day", period = 30 } = queryParams;

    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - parseInt(period));

    let groupConfig = {};
    let sortConfig = { _id: 1 };

    switch (type) {
      case "day":
        groupConfig = {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          label: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        };
        break;
      case "week":
        groupConfig = {
          _id: { $week: "$createdAt" },
          label: {
            $concat: [
              "Week ",
              { $toString: { $week: "$createdAt" } },
              " ",
              { $toString: { $year: "$createdAt" } },
            ],
          },
        };
        break;
      case "month":
        groupConfig = {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          label: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        };
        break;
      default:
        throw new Error("Loại thống kê không hợp lệ");
    }

    // Thêm trường đếm
    groupConfig.count = { $sum: 1 };

    const newCustomerData = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: today },
          role: "user",
        },
      },
      { $group: groupConfig },
      { $sort: sortConfig },
    ]);

    // Tính tổng số khách hàng mới
    const totalNewCustomers = newCustomerData.reduce(
      (acc, curr) => acc + curr.count,
      0
    );

    return {
      data: newCustomerData,
      total: totalNewCustomers,
      period,
      type,
    };
  },
};

module.exports = statisticService;
