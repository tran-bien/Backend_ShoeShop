const { Product, User, Order, Variant, InventoryItem } = require("@models");
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

      //  FIXED: Tính cost từ InventoryItem.averageCostPrice
      // NOTE: Đây là cost TRUNG BÌNH, không phải cost tại thời điểm bán chính xác
      // Để có cost chính xác 100%, cần lưu costPrice vào OrderItem khi tạo đơn
      const financialResults = await Order.aggregate([
        {
          $match: {
            status: "delivered",
            deletedAt: null,
          },
        },
        {
          $unwind: "$orderItems",
        },
        {
          $lookup: {
            from: "variants",
            localField: "orderItems.variant",
            foreignField: "_id",
            as: "variantInfo",
          },
        },
        {
          $unwind: {
            path: "$variantInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        // FIX BUG #9: Filter deleted variants
        {
          $match: {
            "variantInfo.deletedAt": null,
          },
        },
        // Lookup InventoryItem để lấy averageCostPrice
        {
          $lookup: {
            from: "inventoryitems",
            let: {
              variantId: "$orderItems.variant",
              sizeId: "$orderItems.size",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$variant", "$$variantId"] },
                      { $eq: ["$size", "$$sizeId"] },
                      { $eq: [{ $ifNull: ["$deletedAt", null] }, null] },
                    ],
                  },
                },
              },
              {
                $project: {
                  averageCostPrice: 1,
                },
              },
            ],
            as: "inventoryInfo",
          },
        },
        {
          $unwind: {
            path: "$inventoryInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAfterDiscountAndShipping" },
            // Sử dụng averageCostPrice từ InventoryItem
            totalCost: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$inventoryInfo.averageCostPrice", 0] },
                  "$orderItems.quantity",
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalRevenue: 1,
            totalCost: 1,
            totalProfit: { $subtract: ["$totalRevenue", "$totalCost"] },
          },
        },
      ]);

      const totalRevenue =
        financialResults.length > 0 ? financialResults[0].totalRevenue : 0;

      // FIXED: Sử dụng averageCostPrice từ InventoryItem
      const totalCost =
        financialResults.length > 0 ? financialResults[0].totalCost : 0;
      const totalProfit =
        financialResults.length > 0 ? financialResults[0].totalProfit : 0;

      return {
        success: true,
        data: {
          totalProducts,
          totalUsers,
          totalOrders,
          totalRevenue,
          totalCost, //  Từ InventoryItem.averageCostPrice
          totalProfit, //  = totalRevenue - totalCost
          profitMargin:
            totalRevenue > 0
              ? Math.round((totalProfit / totalRevenue) * 100)
              : 0,
        },
      };
    } catch (error) {
      throw new ApiError(
        500,
        "Lỗi khi lấy thống kê tổng quan: " + error.message
      );
    }
  },

  /**
   * Lấy dữ liệu doanh thu theo ngày
   *
   * WARNING: Cost calculation KHÔNG CHÍNH XÁC
   * Variant.costPrice đã bị XÓA → cost/profit luôn = 0
   * Cần sửa: Lookup InventoryTransaction để lấy cost chính xác
   *
   * @param {Object} query - Các tham số truy vấn
   * @returns {Object} - Dữ liệu doanh thu theo ngày
   */
  getDailyRevenue: async (query = {}) => {
    try {
      const { startDate, endDate } = query;

      // Mặc định lấy doanh thu 7 ngày gần nhất nếu không chỉ định
      const start = startDate
        ? new Date(startDate)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      // Thiết lập start về đầu ngày và end về cuối ngày để đảm bảo bao gồm tất cả dữ liệu
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      // Kiểm tra ngày hợp lệ
      if (start > end) {
        throw new ApiError(400, "Ngày bắt đầu không thể sau ngày kết thúc");
      }

      // FIXED: Lookup InventoryItem để lấy averageCostPrice
      const dailyFinancials = await Order.aggregate([
        {
          $match: {
            status: "delivered",
            deletedAt: null,
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $unwind: "$orderItems",
        },
        // Lookup InventoryItem để lấy cost
        {
          $lookup: {
            from: "inventoryitems",
            let: {
              variantId: "$orderItems.variant",
              sizeId: "$orderItems.size",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$variant", "$$variantId"] },
                      { $eq: ["$size", "$$sizeId"] },
                      { $eq: [{ $ifNull: ["$deletedAt", null] }, null] },
                    ],
                  },
                },
              },
              {
                $project: {
                  averageCostPrice: 1,
                },
              },
            ],
            as: "inventoryInfo",
          },
        },
        {
          $unwind: {
            path: "$inventoryInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            itemCost: {
              $multiply: [
                { $ifNull: ["$inventoryInfo.averageCostPrice", 0] },
                "$orderItems.quantity",
              ],
            },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$totalAfterDiscountAndShipping" },
            cost: { $sum: "$itemCost" },
            orderCount: { $addToSet: "$_id" },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            revenue: 1,
            cost: 1,
            profit: { $subtract: ["$revenue", "$cost"] },
            count: { $size: "$orderCount" },
          },
        },
        {
          $sort: { date: 1 },
        },
      ]);

      // Đảm bảo có dữ liệu cho tất cả các ngày, kể cả ngày không có đơn hàng
      const allDates = [];
      const currentDate = new Date(start);

      // Tính tổng
      let totalRevenue = 0;
      let totalCost = 0;
      let totalProfit = 0;
      let totalOrders = 0;

      while (currentDate <= end) {
        const dateString = moment(currentDate).format("YYYY-MM-DD");
        const existingData = dailyFinancials.find(
          (item) => item.date === dateString
        );

        if (existingData) {
          totalRevenue += existingData.revenue;
          totalCost += existingData.cost;
          totalProfit += existingData.profit;
          totalOrders += existingData.count;

          allDates.push({
            ...existingData,
            profitMargin:
              existingData.revenue > 0
                ? Math.round((existingData.profit / existingData.revenue) * 100)
                : 0,
          });
        } else {
          allDates.push({
            date: dateString,
            revenue: 0,
            cost: 0,
            profit: 0,
            profitMargin: 0,
            count: 0,
          });
        }

        // Chuyển sang ngày tiếp theo
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return {
        success: true,
        summary: {
          totalRevenue,
          totalCost,
          totalProfit,
          totalOrders,
          profitMargin:
            totalRevenue > 0
              ? Math.round((totalProfit / totalRevenue) * 100)
              : 0,
          period: {
            startDate: moment(start).format("YYYY-MM-DD"),
            endDate: moment(end).format("YYYY-MM-DD"),
          },
        },
        data: allDates,
      };
    } catch (error) {
      console.error("Lỗi chi tiết:", error);
      throw new ApiError(
        500,
        "Lỗi khi lấy doanh thu theo ngày: " + error.message
      );
    }
  },

  /**
   * Lấy dữ liệu doanh thu theo tháng
   *
   * ⚠️ WARNING: Cost calculation KHÔNG CHÍNH XÁC ⚠️
   * Variant.costPrice đã bị XÓA → cost/profit luôn = 0
   *
   * @param {Object} query - Các tham số truy vấn
   * @returns {Object} - Dữ liệu doanh thu theo tháng
   */
  getMonthlyRevenue: async (query = {}) => {
    try {
      const { year } = query;

      // Mặc định lấy doanh thu trong năm hiện tại
      const selectedYear = year ? parseInt(year) : new Date().getFullYear();

      // FIXED: Lookup InventoryItem để lấy averageCostPrice
      const monthlyFinancials = await Order.aggregate([
        {
          $match: {
            status: "delivered",
            deletedAt: null,
            $expr: { $eq: [{ $year: "$createdAt" }, selectedYear] },
          },
        },
        {
          $unwind: "$orderItems",
        },
        // Lookup InventoryItem để lấy cost
        {
          $lookup: {
            from: "inventoryitems",
            let: {
              variantId: "$orderItems.variant",
              sizeId: "$orderItems.size",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$variant", "$$variantId"] },
                      { $eq: ["$size", "$$sizeId"] },
                      { $eq: [{ $ifNull: ["$deletedAt", null] }, null] },
                    ],
                  },
                },
              },
              {
                $project: {
                  averageCostPrice: 1,
                },
              },
            ],
            as: "inventoryInfo",
          },
        },
        {
          $unwind: {
            path: "$inventoryInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            itemCost: {
              $multiply: [
                { $ifNull: ["$inventoryInfo.averageCostPrice", 0] },
                "$orderItems.quantity",
              ],
            },
          },
        },
        {
          $group: {
            _id: { $month: "$createdAt" },
            revenue: { $sum: "$totalAfterDiscountAndShipping" },
            cost: { $sum: "$itemCost" },
            orderCount: { $addToSet: "$_id" },
          },
        },
        {
          $project: {
            _id: 0,
            month: "$_id",
            revenue: 1,
            cost: 1,
            profit: { $subtract: ["$revenue", "$cost"] },
            count: { $size: "$orderCount" },
          },
        },
        {
          $sort: { month: 1 },
        },
      ]);

      // Đảm bảo có dữ liệu cho tất cả các tháng, kể cả tháng không có đơn hàng
      const allMonths = [];
      let totalYearlyRevenue = 0;
      let totalYearlyCost = 0;
      let totalYearlyProfit = 0;
      let totalYearlyOrders = 0;

      for (let month = 1; month <= 12; month++) {
        const existingData = monthlyFinancials.find(
          (item) => item.month === month
        );

        if (existingData) {
          totalYearlyRevenue += existingData.revenue;
          totalYearlyCost += existingData.cost;
          totalYearlyProfit += existingData.profit;
          totalYearlyOrders += existingData.count;

          allMonths.push({
            ...existingData,
            profitMargin:
              existingData.revenue > 0
                ? Math.round((existingData.profit / existingData.revenue) * 100)
                : 0,
          });
        } else {
          allMonths.push({
            month,
            revenue: 0,
            cost: 0,
            profit: 0,
            profitMargin: 0,
            count: 0,
          });
        }
      }

      return {
        success: true,
        year: selectedYear,
        summary: {
          totalYearlyRevenue,
          totalYearlyCost,
          totalYearlyProfit,
          totalYearlyOrders,
          yearlyProfitMargin:
            totalYearlyRevenue > 0
              ? Math.round((totalYearlyProfit / totalYearlyRevenue) * 100)
              : 0,
        },
        data: allMonths,
      };
    } catch (error) {
      console.error("Lỗi chi tiết:", error);
      throw new ApiError(
        500,
        "Lỗi khi lấy doanh thu theo tháng: " + error.message
      );
    }
  },

  /**
   * Lấy thống kê sản phẩm bán chạy nhất
   *
   * ⚠️ WARNING: Cost calculation KHÔNG CHÍNH XÁC ⚠️
   * Variant.costPrice đã bị XÓA → totalCost/totalProfit luôn = 0
   *
   * @param {Object} query - Các tham số truy vấn (period: 'week', 'month', 'year')
   * @returns {Object} - Dữ liệu sản phẩm bán chạy
   */
  getTopSellingProducts: async (query = {}) => {
    try {
      const { period = "month", limit = 10 } = query;

      // Xác định khoảng thời gian
      let startDate = new Date();
      const now = new Date();

      switch (period) {
        case "week":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case "year":
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate.setMonth(startDate.getMonth() - 1); // Mặc định 1 tháng
      }

      // FIXED: Tính sản phẩm bán chạy với cost từ InventoryItem
      // FIXED Bug #13: Thay 'shipping' thành 'out_for_delivery' để match Order schema
      const topProducts = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: now },
            status: { $in: ["delivered", "out_for_delivery", "confirmed"] },
            deletedAt: null,
          },
        },
        {
          $unwind: "$orderItems",
        },
        {
          $lookup: {
            from: "variants",
            localField: "orderItems.variant",
            foreignField: "_id",
            as: "variant",
          },
        },
        {
          $unwind: "$variant",
        },
        {
          $lookup: {
            from: "products",
            localField: "variant.product",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: "$product",
        },
        // Lookup InventoryItem để lấy cost
        {
          $lookup: {
            from: "inventoryitems",
            let: {
              variantId: "$orderItems.variant",
              sizeId: "$orderItems.size",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$variant", "$$variantId"] },
                      { $eq: ["$size", "$$sizeId"] },
                      { $eq: [{ $ifNull: ["$deletedAt", null] }, null] },
                    ],
                  },
                },
              },
              {
                $project: {
                  averageCostPrice: 1,
                },
              },
            ],
            as: "inventoryInfo",
          },
        },
        {
          $unwind: {
            path: "$inventoryInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: "$variant.product",
            productName: { $first: "$product.name" },
            totalQuantity: { $sum: "$orderItems.quantity" },
            totalRevenue: {
              $sum: {
                $multiply: ["$orderItems.price", "$orderItems.quantity"],
              },
            },
            // Sử dụng averageCostPrice từ InventoryItem
            totalCost: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$inventoryInfo.averageCostPrice", 0] },
                  "$orderItems.quantity",
                ],
              },
            },
            image: {
              $first: {
                $cond: [
                  { $gt: [{ $size: { $ifNull: ["$product.images", []] } }, 0] },
                  { $arrayElemAt: ["$product.images.url", 0] },
                  null,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            productId: "$_id",
            productName: 1,
            totalQuantity: 1,
            totalRevenue: 1,
            totalCost: 1,
            totalProfit: { $subtract: ["$totalRevenue", "$totalCost"] },
            image: 1,
          },
        },
        {
          $sort: { totalQuantity: -1 },
        },
        {
          $limit: parseInt(limit),
        },
      ]);

      // Tính tổng số lượng bán và doanh thu
      const summary = topProducts.reduce(
        (acc, product) => {
          acc.totalQuantity += product.totalQuantity;
          acc.totalRevenue += product.totalRevenue;
          acc.totalCost += product.totalCost;
          acc.totalProfit += product.totalProfit;
          return acc;
        },
        { totalQuantity: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0 }
      );

      // Thêm phần trăm đóng góp vào doanh thu
      const enrichedProducts = topProducts.map((product) => ({
        ...product,
        percentage:
          summary.totalRevenue > 0
            ? Math.round((product.totalRevenue / summary.totalRevenue) * 100)
            : 0,
        profitMargin:
          product.totalRevenue > 0
            ? Math.round((product.totalProfit / product.totalRevenue) * 100)
            : 0,
      }));

      return {
        success: true,
        period,
        summary: {
          ...summary,
          profitMargin:
            summary.totalRevenue > 0
              ? Math.round((summary.totalProfit / summary.totalRevenue) * 100)
              : 0,
          period: {
            startDate: moment(startDate).format("YYYY-MM-DD"),
            endDate: moment(now).format("YYYY-MM-DD"),
          },
        },
        data: enrichedProducts,
      };
    } catch (error) {
      console.error("Lỗi chi tiết:", error);
      throw new ApiError(
        500,
        "Lỗi khi lấy dữ liệu sản phẩm bán chạy: " + error.message
      );
    }
  },
};

module.exports = dashboardService;
