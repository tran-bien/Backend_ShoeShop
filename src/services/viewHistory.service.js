const ViewHistory = require("../models/viewHistory");
const { Product, Variant } = require("@models");
const ApiError = require("@utils/ApiError");

const viewHistoryService = {
  /**
   * Track product view (từ client event)
   */
  trackView: async (data) => {
    const { productId, variantId, viewDuration, source, userId, sessionId, deviceInfo } = data;

    // Validate
    if (!productId) {
      throw new ApiError(400, "Product ID là bắt buộc");
    }

    if (!userId && !sessionId) {
      throw new ApiError(400, "Cần userId hoặc sessionId");
    }

    // Lấy thông tin sản phẩm để denormalize
    const product = await Product.findById(productId).select("name images");
    const variant = variantId
      ? await Variant.findById(variantId).select("imagesvariant")
      : null;

    const productImage =
      variant?.imagesvariant?.[0]?.url ||
      product?.images?.[0]?.url ||
      "";

    // Lấy giá từ InventoryItem (simplified - có thể optimize sau)
    const InventoryItem = require("@models").InventoryItem;
    const inventoryItem = await InventoryItem.findOne({
      product: productId,
    }).sort({ finalPrice: 1 });

    const productPrice = inventoryItem?.finalPrice || 0;

    // Tạo view history
    const viewHistory = await ViewHistory.create({
      user: userId || null,
      sessionId: sessionId || null,
      product: productId,
      variant: variantId || null,
      productName: product?.name || "",
      productImage,
      productPrice,
      viewDuration: viewDuration || 0,
      source: source || "DIRECT",
      deviceInfo: deviceInfo || "",
    });

    return {
      success: true,
      viewHistory,
    };
  },

  /**
   * Lấy lịch sử xem của user
   */
  getUserViewHistory: async (userId, query = {}) => {
    const { page = 1, limit = 20 } = query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [history, total] = await Promise.all([
      ViewHistory.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("product", "name slug images isActive")
        .populate("variant", "color"),
      ViewHistory.countDocuments({ user: userId }),
    ]);

    // Filter out deleted products
    const validHistory = history.filter((h) => h.product && h.product.isActive);

    return {
      success: true,
      history: validHistory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    };
  },

  /**
   * Merge anonymous history khi user login
   */
  mergeAnonymousHistory: async (userId, sessionId) => {
    if (!sessionId) return { success: true, mergedCount: 0 };

    const anonymousHistory = await ViewHistory.find({ sessionId });

    let mergedCount = 0;

    for (const view of anonymousHistory) {
      // Kiểm tra user đã xem product này chưa
      const existing = await ViewHistory.findOne({
        user: userId,
        product: view.product,
      }).sort({ createdAt: -1 });

      // Nếu chưa xem hoặc xem cách đây > 1 ngày, tạo mới
      if (
        !existing ||
        new Date() - existing.createdAt > 24 * 60 * 60 * 1000
      ) {
        await ViewHistory.create({
          user: userId,
          product: view.product,
          variant: view.variant,
          productName: view.productName,
          productImage: view.productImage,
          productPrice: view.productPrice,
          viewDuration: view.viewDuration,
          source: view.source,
          deviceInfo: view.deviceInfo,
        });

        mergedCount++;
      }
    }

    // Xóa anonymous history
    await ViewHistory.deleteMany({ sessionId });

    console.log(
      `[VIEW HISTORY] Merged ${mergedCount} anonymous views for user ${userId}`
    );

    return {
      success: true,
      mergedCount,
    };
  },

  /**
   * Clear history của user
   */
  clearHistory: async (userId) => {
    const result = await ViewHistory.deleteMany({ user: userId });

    return {
      success: true,
      deletedCount: result.deletedCount,
    };
  },
};

module.exports = viewHistoryService;

