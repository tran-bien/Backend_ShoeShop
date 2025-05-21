const { Product, User, Order } = require("@models");
const mongoose = require("mongoose");
const moment = require("moment");
const ApiError = require("@utils/ApiError");

const dashboardService = {
  /**
   * Lấy dữ liệu tổng quan của dashboard
   * @returns {Object} - Dữ liệu thống kê tổng quan
   */
  getDashboardData: async () => {
    try {
      // Đếm tổng sản phẩm
      const totalProducts = await Product.countDocuments({ deletedAt: null });
      
      // Đếm tổng người dùng
      const totalUsers = await User.countDocuments({ deletedAt: null });
      
      // Đếm tổng đơn hàng
      const totalOrders = await Order.countDocuments({ deletedAt: null });

      // Tổng doanh thu từ đơn hàng đã giao
      const revenueResult = await Order.aggregate([
        {
          $match: {
            status: "delivered",
            deletedAt: null
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAfterDiscountAndShipping" }
          }
        }
      ]);

      const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

      return {
        success: true,
        data: {
          totalProducts,
          totalUsers,
          totalOrders,
          totalRevenue
        }
      };
    } catch (error) {
      throw new ApiError(500, "Lỗi khi lấy thống kê tổng quan: " + error.message);
    }
  },

  /**
   * Lấy dữ liệu doanh thu theo ngày
   * @param {Object} query - Các tham số truy vấn
   * @returns {Object} - Dữ liệu doanh thu theo ngày
   */
  getDailyRevenue: async (query = {}) => {
    try {
      const { startDate, endDate } = query;
      
      // Mặc định lấy doanh thu 7 ngày gần nhất nếu không chỉ định
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();
      
      // Kiểm tra ngày hợp lệ
      if (start > end) {
        throw new ApiError(400, "Ngày bắt đầu không thể sau ngày kết thúc");
      }
      
      // Tính doanh thu theo ngày
      const dailyRevenue = await Order.aggregate([
        {
          $match: {
            status: "delivered",
            deletedAt: null,
            createdAt: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$totalAfterDiscountAndShipping" },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            revenue: 1,
            count: 1
          }
        }
      ]);

      // Tính tổng doanh thu
      const totalRevenue = dailyRevenue.reduce((sum, item) => sum + item.revenue, 0);

      // Đảm bảo có dữ liệu cho tất cả các ngày, kể cả ngày không có đơn hàng
      const allDates = [];
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateString = moment(currentDate).format('YYYY-MM-DD');
        const existingData = dailyRevenue.find(item => item.date === dateString);
        
        if (existingData) {
          allDates.push(existingData);
        } else {
          allDates.push({ date: dateString, revenue: 0, count: 0 });
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return {
        success: true,
        data: {
          totalRevenue,
          allDates
        }
      };
    } catch (error) {
      throw new ApiError(500, "Lỗi khi lấy doanh thu theo ngày: " + error.message);
    }
  },

  /**
   * Lấy dữ liệu doanh thu theo tháng
   * @param {Object} query - Các tham số truy vấn
   * @returns {Object} - Dữ liệu doanh thu theo tháng
   */
  getMonthlyRevenue: async (query = {}) => {
    try {
      const { year } = query;
      
      // Mặc định lấy doanh thu trong năm hiện tại
      const selectedYear = year ? parseInt(year) : new Date().getFullYear();
      
      // Tính doanh thu theo tháng
      const monthlyRevenue = await Order.aggregate([
        {
          $match: {
            status: "delivered",
            deletedAt: null,
            $expr: { $eq: [{ $year: "$createdAt" }, selectedYear] }
          }
        },
        {
          $group: {
            _id: { $month: "$createdAt" },
            revenue: { $sum: "$totalAfterDiscountAndShipping" },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        },
        {
          $project: {
            _id: 0,
            month: "$_id",
            revenue: 1,
            count: 1
          }
        }
      ]);

      // Đảm bảo có dữ liệu cho tất cả các tháng, kể cả tháng không có đơn hàng
      const allMonths = [];
      for (let month = 1; month <= 12; month++) {
        const existingData = monthlyRevenue.find(item => item.month === month);
        
        if (existingData) {
          allMonths.push(existingData);
        } else {
          allMonths.push({ month, revenue: 0, count: 0 });
        }
      }

      return {
        success: true,
        year: selectedYear,
        data: allMonths
      };
    } catch (error) {
      throw new ApiError(500, "Lỗi khi lấy doanh thu theo tháng: " + error.message);
    }
  }
};

module.exports = dashboardService;
        