const { Product, User, Order, Variant } = require("@models");
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

      // ⚠️ WARNING: TÍNH COST KHÔNG CHÍNH XÁC ⚠️
      // Variant.costPrice đã bị XÓA khỏi schema
      // Cost giờ lưu trong InventoryItem và thay đổi theo từng lần nhập kho
      //
      // ĐỂ TÍNH COST CHÍNH XÁC, CẦN:
      // 1. Lookup OrderItem -> InventoryTransaction (tìm transaction OUT tại thời điểm bán)
      // 2. Lấy averageCostPrice từ InventoryItem tại thời điểm transaction
      // 3. Hoặc lưu costPrice vào OrderItem khi tạo đơn hàng
      //
      // HIỆN TẠI: totalCost = 0, totalProfit = totalRevenue (SAI)
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
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAfterDiscountAndShipping" },
            // ❌ BUG: Field "costPrice" KHÔNG TỒN TẠI trong Variant schema
            // Kết quả: totalCost = 0 (luôn luôn)
            totalCost: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$variantInfo.costPrice", 0] }, // ← Luôn trả về 0
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

      // ⚠️ WARNING: totalCost và totalProfit KHÔNG CHÍNH XÁC
      // Do Variant.costPrice không còn tồn tại → totalCost = 0
      // → totalProfit = totalRevenue (SAI HOÀN TOÀN)
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
          totalCost, // ← Luôn = 0 (BUG)
          totalProfit, // ← = totalRevenue (SAI)
          profitMargin:
            totalRevenue > 0
              ? Math.round((totalProfit / totalRevenue) * 100)
              : 0, // ← Luôn = 100% (SAI)
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
   * ⚠️ WARNING: Cost calculation KHÔNG CHÍNH XÁC ⚠️
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

      // ❌ BUG: Pipeline này query variant.costPrice (không tồn tại)
      // Kết quả: cost = 0, profit = revenue (SAI)
      const dailyFinancials = await Order.aggregate([
        {
          $match: {
            status: "delivered",
            deletedAt: null,
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $lookup: {
            from: "variants",
            localField: "orderItems.variant",
            foreignField: "_id",
            as: "variants",
          },
        },
        {
          $addFields: {
            // ❌ BUG: Kết hợp thông tin orderItems với variants để tính toán chi phí
            // Nhưng variant.costPrice KHÔNG TỒN TẠI → luôn trả về 0
            enrichedItems: {
              $map: {
                input: "$orderItems",
                as: "item",
                in: {
                  quantity: "$$item.quantity",
                  price: "$$item.price",
                  variantId: "$$item.variant",
                  // ❌ Tìm variant tương ứng để lấy costPrice (FIELD KHÔNG TỒN TẠI)
                  costPrice: {
                    $let: {
                      vars: {
                        variant: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$variants",
                                as: "v",
                                cond: { $eq: ["$$v._id", "$$item.variant"] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: { $ifNull: ["$$variant.costPrice", 0] }, // ← Luôn = 0
                    },
                  },
                },
              },
            },
          },
        },
        {
          $unwind: "$enrichedItems",
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$totalAfterDiscountAndShipping" },
            cost: {
              $sum: {
                $multiply: [
                  "$enrichedItems.costPrice", // ← Luôn = 0 (BUG)
                  "$enrichedItems.quantity",
                ],
              },
            },
            orderCount: { $addToSet: "$_id" },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            revenue: 1,
            cost: 1, // ← Luôn = 0
            profit: { $subtract: ["$revenue", "$cost"] }, // ← = revenue (SAI)
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

      // ❌ BUG: Tính doanh thu theo tháng với chi phí và lợi nhuận
      // Nhưng variant.costPrice KHÔNG TỒN TẠI → cost luôn = 0
      const monthlyFinancials = await Order.aggregate([
        {
          $match: {
            status: "delivered",
            deletedAt: null,
            $expr: { $eq: [{ $year: "$createdAt" }, selectedYear] },
          },
        },
        {
          $lookup: {
            from: "variants",
            localField: "orderItems.variant",
            foreignField: "_id",
            as: "variants",
          },
        },
        {
          $addFields: {
            enrichedItems: {
              $map: {
                input: "$orderItems",
                as: "item",
                in: {
                  quantity: "$$item.quantity",
                  price: "$$item.price",
                  variantId: "$$item.variant",
                  // ❌ Field costPrice KHÔNG TỒN TẠI → luôn = 0
                  costPrice: {
                    $let: {
                      vars: {
                        variant: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$variants",
                                as: "v",
                                cond: { $eq: ["$$v._id", "$$item.variant"] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: { $ifNull: ["$$variant.costPrice", 0] }, // ← Luôn = 0
                    },
                  },
                },
              },
            },
          },
        },
        {
          $unwind: "$enrichedItems",
        },
        {
          $group: {
            _id: { $month: "$createdAt" },
            revenue: { $sum: "$totalAfterDiscountAndShipping" },
            cost: {
              $sum: {
                $multiply: [
                  "$enrichedItems.costPrice",
                  "$enrichedItems.quantity",
                ],
              },
            },
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

      // Tính sản phẩm bán chạy
      const topProducts = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: now },
            status: { $in: ["delivered", "shipping", "confirmed"] },
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
            // ❌ BUG: variant.costPrice KHÔNG TỒN TẠI → totalCost luôn = 0
            totalCost: {
              $sum: {
                $multiply: ["$variant.costPrice", "$orderItems.quantity"], // ← costPrice = undefined
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
