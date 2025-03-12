const asyncHandler = require("express-async-handler");
const Order = require("../models/order.model");
const Product = require("../models/product.model");
const User = require("../models/user.model");

// Thống kê doanh thu
exports.getRevenueStatistics = asyncHandler(async (req, res) => {
  const { startDate, endDate, type = "day" } = req.query;

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

  let groupStage = {};
  if (type === "month") {
    groupStage = {
      _id: {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      },
    };
  } else if (type === "year") {
    groupStage = {
      _id: {
        year: { $year: "$createdAt" },
      },
    };
  } else {
    groupStage = {
      _id: {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      },
    };
  }

  // Tính doanh thu và lợi nhuận
  const statistics = await Order.aggregate([
    { $match: matchStage },
    // Unwrap các sản phẩm trong đơn hàng để tính toán lợi nhuận
    { $unwind: "$items" },
    {
      $group: {
        _id: groupStage._id,
        totalRevenue: { $sum: "$totalAmount" },
        totalOrders: { $sum: 1 },
        totalProfit: {
          $sum: {
            $multiply: [
              { $subtract: ["$items.price", "$items.costPrice"] },
              "$items.quantity",
            ],
          },
        },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
  ]);

  res.json({
    success: true,
    statistics,
  });
});

// Thống kê sản phẩm
exports.getProductStatistics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const matchStage = {
    status: "delivered",
    createdAt: {},
  };

  if (startDate) {
    matchStage.createdAt.$gte = new Date(startDate);
  }
  if (endDate) {
    matchStage.createdAt.$lte = new Date(endDate);
  }

  const statistics = await Order.aggregate([
    { $match: matchStage },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        totalSold: { $sum: "$items.quantity" },
        totalRevenue: {
          $sum: { $multiply: ["$items.price", "$items.quantity"] },
        },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $project: {
        productName: "$product.name",
        totalSold: 1,
        totalRevenue: 1,
        averagePrice: { $divide: ["$totalRevenue", "$totalSold"] },
      },
    },
    { $sort: { totalSold: -1 } },
  ]);

  res.json({
    success: true,
    statistics,
  });
});

// Thống kê khách hàng
exports.getCustomerStatistics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const matchStage = {
    status: "delivered",
    createdAt: {},
  };

  if (startDate) {
    matchStage.createdAt.$gte = new Date(startDate);
  }
  if (endDate) {
    matchStage.createdAt.$lte = new Date(endDate);
  }

  const statistics = await Order.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$userId",
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: "$totalAmount" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        customerName: "$user.name",
        customerEmail: "$user.email",
        totalOrders: 1,
        totalSpent: 1,
        averageOrderValue: { $divide: ["$totalSpent", "$totalOrders"] },
      },
    },
    { $sort: { totalSpent: -1 } },
  ]);

  res.json({
    success: true,
    statistics,
  });
});

// Thống kê tổng quan
exports.getDashboardStatistics = asyncHandler(async (req, res) => {
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
});
