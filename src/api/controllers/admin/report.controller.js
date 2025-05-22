const { Order, Product, Variant } = require("@models");
const mongoose = require("mongoose");

/**
 * Thống kê tổng quan cho dashboard
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    );

    // Tính tổng số đơn hàng - không tính đơn đã xóa mềm (nếu Order có xóa mềm)
    const totalOrders = await Order.countDocuments();

    // Tính tổng số đơn hàng trong tháng
    const ordersThisMonth = await Order.countDocuments({
      createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
    });

    // Tính tổng doanh thu từ đơn hàng đã giao
    const revenueResult = await Order.aggregate([
      {
        $match: { status: "delivered" },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAfterDiscountAndShipping" },
        },
      },
    ]);
    const totalRevenue =
      revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    // Tính doanh thu tháng này từ đơn hàng đã giao
    const revenueThisMonthResult = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAfterDiscountAndShipping" },
        },
      },
    ]);
    const revenueThisMonth =
      revenueThisMonthResult.length > 0
        ? revenueThisMonthResult[0].totalRevenue
        : 0;

    // Tính số sản phẩm đã bán từ đơn hàng đã giao
    const productsSoldResult = await Order.aggregate([
      {
        $match: { status: "delivered" },
      },
      {
        $unwind: "$orderItems",
      },
      {
        $group: {
          _id: null,
          totalSold: { $sum: "$orderItems.quantity" },
        },
      },
    ]);
    const totalProductsSold =
      productsSoldResult.length > 0 ? productsSoldResult[0].totalSold : 0;

    // Tính số sản phẩm đã bán trong tháng từ đơn hàng đã giao
    const productsSoldThisMonthResult = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
        },
      },
      {
        $unwind: "$orderItems",
      },
      {
        $group: {
          _id: null,
          totalSold: { $sum: "$orderItems.quantity" },
        },
      },
    ]);
    const productsSoldThisMonth =
      productsSoldThisMonthResult.length > 0
        ? productsSoldThisMonthResult[0].totalSold
        : 0;

    // Đếm số sản phẩm active và không bị xóa mềm
    const totalProducts = await Product.countDocuments({
      isActive: true,
      deletedAt: null,
    });

    // Đếm số sản phẩm hết hàng (active, không bị xóa mềm, nhưng hết hàng)
    const outOfStockProducts = await Product.countDocuments({
      isActive: true,
      deletedAt: null,
      totalQuantity: 0,
    });

    // Lấy 5 đơn hàng gần nhất
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("user", "name email");

    // Thống kê đơn hàng theo trạng thái
    const orderStatusStats = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Chuyển đổi kết quả thành đối tượng
    const ordersByStatus = {
      pending: 0,
      confirmed: 0,
      shipping: 0,
      delivered: 0,
      cancelled: 0,
    };

    orderStatusStats.forEach((stat) => {
      if (stat._id in ordersByStatus) {
        ordersByStatus[stat._id] = stat.count;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        orders: {
          total: totalOrders,
          thisMonth: ordersThisMonth,
          byStatus: ordersByStatus,
        },
        revenue: {
          total: totalRevenue,
          thisMonth: revenueThisMonth,
        },
        products: {
          total: totalProducts,
          outOfStock: outOfStockProducts,
          sold: {
            total: totalProductsSold,
            thisMonth: productsSoldThisMonth,
          },
        },
        recentOrders,
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy thống kê dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thống kê dashboard",
      error: error.message,
    });
  }
};

/**
 * Báo cáo doanh thu
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getRevenueReport = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query;

    // Xác định khoảng thời gian báo cáo
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Tạo match stage cho aggregate
    const matchStage = {
      $match: {
        status: "delivered",
        createdAt: { $gte: start, $lte: end },
      },
    };

    // Xác định cách nhóm dữ liệu
    let groupStage = {};
    if (groupBy === "day") {
      groupStage = {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$totalAfterDiscountAndShipping" },
          count: { $sum: 1 },
        },
      };
    } else if (groupBy === "month") {
      groupStage = {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          revenue: { $sum: "$totalAfterDiscountAndShipping" },
          count: { $sum: 1 },
        },
      };
    } else if (groupBy === "year") {
      groupStage = {
        $group: {
          _id: { $dateToString: { format: "%Y", date: "$createdAt" } },
          revenue: { $sum: "$totalAfterDiscountAndShipping" },
          count: { $sum: 1 },
        },
      };
    }

    // Thực hiện truy vấn
    const revenueData = await Order.aggregate([
      matchStage,
      groupStage,
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          revenue: 1,
          count: 1,
        },
      },
    ]);

    // Tính tổng doanh thu và số đơn hàng
    const totals = await Order.aggregate([
      matchStage,
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAfterDiscountAndShipping" },
          totalCount: { $sum: 1 },
        },
      },
    ]);

    const totalRevenue = totals.length > 0 ? totals[0].totalRevenue : 0;
    const totalOrders = totals.length > 0 ? totals[0].totalCount : 0;

    // Thống kê theo phương thức thanh toán
    const paymentMethodStats = await Order.aggregate([
      matchStage,
      {
        $group: {
          _id: "$payment.method",
          count: { $sum: 1 },
          revenue: { $sum: "$totalAfterDiscountAndShipping" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        revenueData,
        summary: {
          totalRevenue,
          totalOrders,
          averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        },
        paymentMethods: paymentMethodStats,
        timeframe: {
          start,
          end,
          groupBy,
        },
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy báo cáo doanh thu:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy báo cáo doanh thu",
      error: error.message,
    });
  }
};

/**
 * Báo cáo sản phẩm bán chạy
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTopSellingProducts = async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    // Xác định khoảng thời gian báo cáo
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Lấy sản phẩm bán chạy nhất từ đơn hàng đã giao
    const topProducts = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $unwind: "$orderItems",
      },
      {
        $group: {
          _id: "$orderItems.product",
          productName: { $first: "$orderItems.productName" },
          totalSold: { $sum: "$orderItems.quantity" },
          totalRevenue: {
            $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] },
          },
        },
      },
      {
        $sort: { totalSold: -1 },
      },
      {
        $limit: parseInt(limit),
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
        $unwind: {
          path: "$productDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          productName: 1,
          totalSold: 1,
          totalRevenue: 1,
          category: "$productDetails.category",
          brand: "$productDetails.brand",
          isActive: "$productDetails.isActive",
          images: "$productDetails.images",
        },
      },
    ]);

    // Populate danh mục và thương hiệu
    if (topProducts.length > 0) {
      const productIds = topProducts.map((p) => p._id);
      const products = await Product.find({
        _id: { $in: productIds },
      })
        .populate("category", "name")
        .populate("brand", "name logo")
        .lean();

      // Bổ sung thông tin danh mục và thương hiệu
      const productInfoMap = {};
      products.forEach((p) => {
        productInfoMap[p._id.toString()] = {
          category: p.category,
          brand: p.brand,
        };
      });

      topProducts.forEach((product) => {
        const productInfo = productInfoMap[product._id.toString()];
        if (productInfo) {
          product.categoryName = productInfo.category
            ? productInfo.category.name
            : null;
          product.brandName = productInfo.brand ? productInfo.brand.name : null;
          product.brandLogo =
            productInfo.brand && productInfo.brand.logo
              ? productInfo.brand.logo.url
              : null;
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        topProducts,
        timeframe: {
          start,
          end,
        },
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy báo cáo sản phẩm bán chạy:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy báo cáo sản phẩm bán chạy",
      error: error.message,
    });
  }
};

/**
 * Báo cáo tồn kho
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getInventoryReport = async (req, res) => {
  try {
    const {
      lowStock = 5,
      category,
      sortBy = "stock",
      order = "asc",
      includeInactive = "false",
    } = req.query;

    // Xây dựng pipeline để lấy báo cáo tồn kho
    const pipeline = [
      // Chỉ lấy sản phẩm chưa bị xóa mềm
      {
        $match: {
          deletedAt: null,
        },
      },
      // Thêm lọc theo trạng thái active nếu cần
      includeInactive === "false"
        ? {
            $match: {
              isActive: true,
            },
          }
        : { $match: {} },
      // Lookup variants không bị xóa mềm
      {
        $lookup: {
          from: "variants",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$product", "$$productId"] },
                deletedAt: null,
              },
            },
          ],
          as: "variants",
        },
      },
      {
        $unwind: {
          path: "$variants",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Chỉ lấy variants active nếu không bao gồm inactive
      includeInactive === "false"
        ? {
            $match: {
              $or: [
                { variants: { $exists: false } },
                { "variants.isActive": true },
              ],
            },
          }
        : { $match: {} },
      {
        $unwind: {
          path: "$variants.sizes",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "sizes",
          localField: "variants.sizes.size",
          foreignField: "_id",
          as: "sizeDetails",
        },
      },
      {
        $unwind: {
          path: "$sizeDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "colors",
          localField: "variants.color",
          foreignField: "_id",
          as: "colorDetails",
        },
      },
      {
        $unwind: {
          path: "$colorDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$_id",
          name: { $first: "$name" },
          slug: { $first: "$slug" },
          category: { $first: "$category" },
          brand: { $first: "$brand" },
          isActive: { $first: "$isActive" },
          totalQuantity: { $first: "$totalQuantity" },
          totalStock: { $sum: "$variants.sizes.quantity" },
          variants: {
            $push: {
              variantId: "$variants._id",
              colorName: "$colorDetails.name",
              colorCode: "$colorDetails.code",
              isActive: "$variants.isActive",
              sizes: {
                sizeId: "$variants.sizes.size",
                sizeName: "$sizeDetails.value",
                sizeDescription: "$sizeDetails.description",
                quantity: "$variants.sizes.quantity",
                sku: "$variants.sizes.sku",
              },
            },
          },
        },
      },
    ];

    // Thêm filter theo category nếu có
    if (category && mongoose.Types.ObjectId.isValid(category)) {
      pipeline.unshift({
        $match: {
          category: mongoose.Types.ObjectId(category),
        },
      });
    }

    // Xử lý bộ lọc low stock
    if (lowStock) {
      pipeline.push({
        $match: {
          totalStock: { $lte: parseInt(lowStock) },
        },
      });
    }

    // Thêm sort stage
    const sortOrder = order === "desc" ? -1 : 1;
    let sortStage = {};

    if (sortBy === "stock") {
      sortStage = {
        $sort: { totalStock: sortOrder },
      };
    } else if (sortBy === "name") {
      sortStage = {
        $sort: { name: sortOrder },
      };
    }

    pipeline.push(sortStage);

    // Thực hiện truy vấn
    const inventoryData = await Product.aggregate(pipeline);

    // Populate thông tin category và brand
    const productIds = inventoryData.map((p) => p._id);
    const productsWithCategories = await Product.find({
      _id: { $in: productIds },
    })
      .populate("category", "name")
      .populate("brand", "name logo")
      .lean();

    // Tạo map cho thông tin category và brand
    const productInfoMap = {};
    productsWithCategories.forEach((p) => {
      productInfoMap[p._id.toString()] = {
        category: p.category,
        brand: p.brand,
      };
    });

    // Bổ sung thông tin category và brand
    inventoryData.forEach((product) => {
      const productInfo = productInfoMap[product._id.toString()];
      if (productInfo) {
        product.categoryName = productInfo.category
          ? productInfo.category.name
          : null;
        product.brandName = productInfo.brand ? productInfo.brand.name : null;
        product.brandLogo =
          productInfo.brand && productInfo.brand.logo
            ? productInfo.brand.logo.url
            : null;
      }
    });

    // Tính tổng số lượng sản phẩm trong kho
    const totalInventory = inventoryData.reduce(
      (sum, product) => sum + product.totalStock,
      0
    );

    // Đếm số sản phẩm hết hàng
    const outOfStockCount = inventoryData.filter(
      (product) => product.totalStock === 0
    ).length;

    // Đếm số sản phẩm sắp hết hàng
    const lowStockCount = inventoryData.filter(
      (product) =>
        product.totalStock > 0 && product.totalStock <= parseInt(lowStock)
    ).length;

    res.status(200).json({
      success: true,
      data: {
        inventoryData,
        summary: {
          totalProducts: inventoryData.length,
          totalInventory,
          outOfStockCount,
          lowStockCount,
        },
        filters: {
          lowStock: parseInt(lowStock),
          category,
          sortBy,
          order,
          includeInactive: includeInactive === "true",
        },
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy báo cáo tồn kho:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy báo cáo tồn kho",
      error: error.message,
    });
  }
};

module.exports = {
  getDashboardStats,
  getRevenueReport,
  getTopSellingProducts,
  getInventoryReport,
};
