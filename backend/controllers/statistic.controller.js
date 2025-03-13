const asyncHandler = require("express-async-handler");
const statisticService = require("../services/statistic.service");

// Thống kê tổng quan cho dashboard
exports.getDashboardStatistics = asyncHandler(async (req, res) => {
  try {
    // Lấy thời gian từ query params
    const { startDate, endDate, period = "30" } = req.query;

    // Lấy thống kê tổng quan
    const overview = await statisticService.getOverviewStatistics();

    // Lấy thống kê doanh thu
    const revenue = await statisticService.getRevenueStatistics({
      startDate,
      endDate,
      type: "day",
    });

    // Lấy thống kê sản phẩm bán chạy
    const topProducts = await statisticService.getTopSellingProducts({
      startDate,
      endDate,
      limit: 5,
    });

    // Lấy thống kê khách hàng mới
    const newCustomers = await statisticService.getNewCustomerStatistics({
      type: "day",
      period: parseInt(period),
    });

    // Lấy thống kê theo phương thức thanh toán
    const paymentMethods = await statisticService.getPaymentMethodStatistics({
      startDate,
      endDate,
    });

    // Trả về kết quả tổng hợp
    res.json({
      success: true,
      data: {
        overview,
        revenue,
        topProducts,
        newCustomers,
        paymentMethods,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy thống kê tổng quan",
    });
  }
});

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

// Thống kê lợi nhuận theo thời gian
exports.getProfitStatistics = asyncHandler(async (req, res) => {
  try {
    // Sử dụng statisticService để lấy thống kê lợi nhuận
    const { startDate, endDate, type = "day" } = req.query;

    // Lấy dữ liệu doanh thu (đã bao gồm lợi nhuận)
    const revenueData = await statisticService.getRevenueStatistics({
      startDate,
      endDate,
      type,
    });

    // Tính tổng lợi nhuận trong khoảng thời gian
    const totalProfit = revenueData.reduce((acc, item) => acc + item.profit, 0);
    const totalRevenue = revenueData.reduce(
      (acc, item) => acc + item.revenue,
      0
    );
    const profitMargin =
      totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    res.json({
      success: true,
      data: {
        profitByTime: revenueData,
        summary: {
          totalProfit,
          totalRevenue,
          profitMargin: parseFloat(profitMargin.toFixed(2)),
          timeRange: {
            startDate,
            endDate,
            type,
          },
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy thống kê lợi nhuận",
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

// Thống kê theo danh mục sản phẩm
exports.getCategoryStatistics = asyncHandler(async (req, res) => {
  try {
    // Sử dụng statisticService để lấy thống kê theo danh mục
    const statistics = await statisticService.getCategoryStatistics();

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy thống kê theo danh mục",
    });
  }
});

// Thống kê theo phương thức thanh toán
exports.getPaymentMethodStatistics = asyncHandler(async (req, res) => {
  try {
    // Sử dụng statisticService để lấy thống kê theo phương thức thanh toán
    const statistics = await statisticService.getPaymentMethodStatistics(
      req.query
    );

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error.message || "Lỗi khi lấy thống kê theo phương thức thanh toán",
    });
  }
});
