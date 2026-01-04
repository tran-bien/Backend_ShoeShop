const ViewHistory = require("../models/viewHistory");
const { Product, Variant } = require("@models");
const ApiError = require("@utils/ApiError");

const viewHistoryService = {
  /**
   * Track product view (từ client event)
   */
  trackView: async (data) => {
    const {
      productId,
      variantId,
      viewDuration,
      source,
      userId,
      sessionId,
      deviceInfo,
    } = data;

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
      variant?.imagesvariant?.[0]?.url || product?.images?.[0]?.url || "";

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

    // Cập nhật user behavior nếu có userId
    if (userId) {
      try {
        const userBehaviorService = require("./userBehavior.service");
        await userBehaviorService.updateFromView(userId, productId);
      } catch (error) {
        console.error("[ViewHistory] Lỗi update user behavior:", error.message);
      }
    }

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
        .populate({
          path: "product",
          select: "name slug images isActive stockStatus brand totalQuantity",
          populate: {
            path: "brand",
            select: "name",
          },
        })
        .populate("variant", "color"),
      ViewHistory.countDocuments({ user: userId }),
    ]);

    // Filter out deleted products
    const validHistory = history.filter((h) => h.product && h.product.isActive);

    // Enrich products with pricing from InventoryItem
    const { InventoryItem } = require("@models");
    const enrichedHistory = await Promise.all(
      validHistory.map(async (item) => {
        const historyObj = item.toObject ? item.toObject() : { ...item };

        // Get pricing from InventoryItem for this product
        const inventoryItems = await InventoryItem.find({
          product: historyObj.product._id,
          quantity: { $gt: 0 },
        }).select("finalPrice sellingPrice discountPercent");

        let minPrice = 0;
        let maxPrice = 0;
        let hasDiscount = false;
        let maxDiscountPercent = 0;

        if (inventoryItems.length > 0) {
          const prices = inventoryItems
            .map((inv) => inv.finalPrice || inv.sellingPrice || 0)
            .filter((p) => p > 0);

          if (prices.length > 0) {
            minPrice = Math.min(...prices);
            maxPrice = Math.max(...prices);
          }

          inventoryItems.forEach((inv) => {
            if (inv.discountPercent && inv.discountPercent > 0) {
              hasDiscount = true;
              if (inv.discountPercent > maxDiscountPercent) {
                maxDiscountPercent = inv.discountPercent;
              }
            }
          });
        }

        // Get main image
        let mainImage = "";
        if (historyObj.product.images && historyObj.product.images.length > 0) {
          const main =
            historyObj.product.images.find((img) => img.isMain) ||
            historyObj.product.images[0];
          mainImage = main?.url || "";
        }

        // Enrich product with pricing
        historyObj.product = {
          ...historyObj.product,
          price: minPrice,
          originalPrice: maxPrice > minPrice ? maxPrice : null,
          priceRange: {
            min: minPrice,
            max: maxPrice,
            isSinglePrice: minPrice === maxPrice,
          },
          hasDiscount,
          salePercentage: maxDiscountPercent,
          mainImage,
          averageRating: 0,
          reviewCount: 0,
        };

        return historyObj;
      })
    );

    const totalPages = Math.ceil(total / parseInt(limit));
    const currentPage = parseInt(page);

    return {
      success: true,
      history: enrichedHistory,
      pagination: {
        page: currentPage,
        limit: parseInt(limit),
        total,
        totalPages,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
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

    // FIX BUG #9: Dùng bulkWrite với upsert để tránh race condition
    const bulkOps = [];

    for (const view of anonymousHistory) {
      // Tính toán thời gian 24h trước
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Dùng updateOne với upsert - chỉ insert nếu chưa có hoặc cũ > 1 ngày
      bulkOps.push({
        updateOne: {
          filter: {
            user: userId,
            product: view.product,
            createdAt: { $lt: oneDayAgo }, // Chỉ update nếu view cũ > 1 ngày
          },
          update: {
            $setOnInsert: {
              user: userId,
              product: view.product,
              variant: view.variant,
              productName: view.productName,
              productImage: view.productImage,
              productPrice: view.productPrice,
              viewDuration: view.viewDuration,
              source: view.source,
              deviceInfo: view.deviceInfo,
              createdAt: view.createdAt || new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    // Execute bulk operations atomically
    if (bulkOps.length > 0) {
      try {
        const result = await ViewHistory.bulkWrite(bulkOps, { ordered: false });
        mergedCount = result.upsertedCount || 0;
      } catch (error) {
        // Lỗi duplicate key được mong đợi và an toàn để bỏ qua
        if (error.code !== 11000) {
          console.error("[VIEW HISTORY] Error during bulk merge:", error);
        }
      }
    }

    // Xóa anonymous history sau khi merge thành công
    await ViewHistory.deleteMany({ sessionId });

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
