const asyncHandler = require("express-async-handler");
const Order = require("../models/order.model");
const Product = require("../models/product.model");
const User = require("../models/user.model");
const statisticService = require("../services/statistic.service");

// Thống kê doanh thu
exports.getRevenueStatistics = asyncHandler(async (req, res) => {
  try {
    // Sử dụng statisticService để lấy thống kê doanh thu
    const statistics = await statisticService.getRevenueStatistics(req.query);

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy thống kê doanh thu",
    });
  }
});

// Thống kê sản phẩm
exports.getProductStatistics = asyncHandler(async (req, res) => {
  try {
    // Sử dụng statisticService để lấy thống kê sản phẩm
    const statistics = await statisticService.getTopSellingProducts(req.query);

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy thống kê sản phẩm",
    });
  }
});

// Thống kê khách hàng
exports.getCustomerStatistics = asyncHandler(async (req, res) => {
  try {
    // Sử dụng statisticService để lấy thống kê khách hàng
    const statistics = await statisticService.getNewCustomerStatistics(
      req.query
    );

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy thống kê khách hàng",
    });
  }
});

// Thống kê tổng quan
exports.getDashboardStatistics = asyncHandler(async (req, res) => {
  try {
    // Lấy thời gian từ query params hoặc mặc định lấy 30 ngày gần nhất
    const { startDate, endDate } = req.query;

    // Xác định khoảng thời gian
    const currentDate = new Date();
    const queryStartDate = startDate
      ? new Date(startDate)
      : new Date(currentDate.setDate(currentDate.getDate() - 30));
    const queryEndDate = endDate ? new Date(endDate) : new Date();

    // Thêm thời gian cuối ngày cho endDate
    queryEndDate.setHours(23, 59, 59, 999);

    // Tạo stage match với khoảng thời gian
    const timeRangeMatch = {
      createdAt: {
        $gte: queryStartDate,
        $lte: queryEndDate,
      },
    };

    // Thống kê đơn hàng
    const orderStats = await Order.aggregate([
      {
        $match: timeRangeMatch,
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ["$status", "delivered"] }, "$totalAmount", 0],
            },
          },
          pendingOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending"] }, 1, 0],
            },
          },
          confirmedOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0],
            },
          },
          shippingOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "shipping"] }, 1, 0],
            },
          },
          deliveredOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "delivered"] }, 1, 0],
            },
          },
          cancelledOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
            },
          },
          totalProfit: { $sum: "$totalProfit" },
        },
      },
    ]);

    // Thống kê doanh thu theo ngày
    const dailyRevenue = await Order.aggregate([
      {
        $match: {
          ...timeRangeMatch,
          status: "delivered",
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: {
            day: { $dayOfMonth: "$createdAt" },
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          totalRevenue: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1,
        },
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: "$_id.day",
            },
          },
          totalRevenue: 1,
          count: 1,
        },
      },
    ]);

    // Thống kê sản phẩm
    const productStats = await Product.aggregate([
      {
        $match: { createdAt: { $gte: queryStartDate, $lte: queryEndDate } },
      },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          lowStockProducts: {
            $sum: {
              $cond: [{ $lt: ["$totalQuantity", 10] }, 1, 0],
            },
          },
          totalStock: { $sum: "$totalQuantity" },
        },
      },
    ]);

    // Thống kê khách hàng
    const userStats = await User.aggregate([
      {
        $match: {
          role: "user",
          createdAt: { $gte: queryStartDate, $lte: queryEndDate },
        },
      },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          newCustomers: {
            $sum: {
              $cond: [
                {
                  $gte: [
                    "$createdAt",
                    new Date(new Date().setDate(new Date().getDate() - 7)),
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Sản phẩm bán chạy
    const topProducts = await Order.aggregate([
      {
        $match: {
          ...timeRangeMatch,
          status: { $in: ["delivered", "confirmed", "shipping"] },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          name: { $first: "$items.productName" },
          totalSold: { $sum: "$items.quantity" },
          totalRevenue: {
            $sum: { $multiply: ["$items.price", "$items.quantity"] },
          },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      success: true,
      statistics: {
        timeRange: {
          startDate: queryStartDate,
          endDate: queryEndDate,
        },
        orders: orderStats[0] || {
          totalOrders: 0,
          totalRevenue: 0,
          pendingOrders: 0,
          confirmedOrders: 0,
          shippingOrders: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
          totalProfit: 0,
        },
        products: productStats[0] || {
          totalProducts: 0,
          lowStockProducts: 0,
          totalStock: 0,
        },
        customers: userStats[0] || {
          totalCustomers: 0,
          newCustomers: 0,
        },
        dailyRevenue: dailyRevenue || [],
        topProducts: topProducts || [],
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy thống kê tổng quan",
    });
  }
});
