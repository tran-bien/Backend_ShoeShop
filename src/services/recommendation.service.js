const { Product, Order, Variant, InventoryItem } = require("@models");
const ViewHistory = require("../models/viewHistory");
const UserBehavior = require("../models/userBehavior");
const RecommendationCache = require("../models/recommendationCache");
const mongoose = require("mongoose");

const recommendationService = {
  /**
   * 1. Collaborative Filtering - "Người mua X cũng mua Y"
   */
  getCollaborativeRecommendations: async (userId) => {
    // Lấy các sản phẩm user đã mua
    const userOrders = await Order.find({
      user: userId,
      status: "delivered",
    }).populate({
      path: "orderItems.variant",
      select: "product",
    });

    const userProductIds = new Set();
    userOrders.forEach((order) => {
      order.orderItems.forEach((item) => {
        if (item.variant?.product) {
          userProductIds.add(item.variant.product.toString());
        }
      });
    });

    if (userProductIds.size === 0) {
      return [];
    }

    // Tìm users khác cũng mua những sản phẩm này
    const similarOrders = await Order.aggregate([
      {
        $match: {
          user: { $ne: new mongoose.Types.ObjectId(userId) },
          status: "delivered",
          deletedAt: null,
        },
      },
      { $unwind: "$orderItems" },
      {
        $lookup: {
          from: "variants",
          localField: "orderItems.variant",
          foreignField: "_id",
          as: "variantData",
        },
      },
      { $unwind: "$variantData" },
      {
        $match: {
          "variantData.product": {
            $in: Array.from(userProductIds).map(
              (id) => new mongoose.Types.ObjectId(id)
            ),
          },
        },
      },
      {
        $group: {
          _id: "$user",
          commonProducts: { $addToSet: "$variantData.product" },
          orders: { $push: "$orderItems" },
        },
      },
      { $sort: { commonProducts: -1 } },
      { $limit: 10 },
    ]);

    // Đếm frequency của products mà similar users mua
    const productFreq = {};

    // Tối ưu: Dùng aggregate thay vì loop N+1 query
    const similarUserIds = similarOrders.map((u) => u._id);
    const allSimilarUserOrders = await Order.aggregate([
      {
        $match: {
          user: { $in: similarUserIds },
          status: "delivered",
          deletedAt: null,
        },
      },
      { $unwind: "$orderItems" },
      {
        $lookup: {
          from: "variants",
          localField: "orderItems.variant",
          foreignField: "_id",
          as: "variantData",
        },
      },
      { $unwind: "$variantData" },
      {
        $group: {
          _id: "$variantData.product",
          count: { $sum: "$orderItems.quantity" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Filter out products user already bought
    allSimilarUserOrders.forEach((item) => {
      const pid = item._id.toString();
      if (!userProductIds.has(pid)) {
        productFreq[pid] = item.count;
      }
    });

    // Sort và trả về top 10
    const recommendations = Object.entries(productFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([productId, score]) => ({
        product: productId,
        score,
      }));

    return recommendations;
  },

  /**
   * 2. Content-based - Dựa trên sở thích
   */
  getContentBasedRecommendations: async (userId) => {
    const behavior = await UserBehavior.findOne({ user: userId });

    // FIX BUG #5: Fallback sang TRENDING nếu chưa có behavior
    if (!behavior) {
      console.log(
        `[RECOMMENDATION] User ${userId} chưa có behavior, fallback sang TRENDING`
      );
      return await recommendationService.getTrendingProducts();
    }

    const query = {
      isActive: true,
      deletedAt: null,
    };

    // Filter theo favorite categories (top 3)
    if (behavior.favoriteCategories && behavior.favoriteCategories.length > 0) {
      const topCategories = behavior.favoriteCategories
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((c) => c.category);

      query.category = { $in: topCategories };
    }

    // Filter theo favorite brands (top 3)
    if (behavior.favoriteBrands && behavior.favoriteBrands.length > 0) {
      const topBrands = behavior.favoriteBrands
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((b) => b.brand);

      query.brand = { $in: topBrands };
    }

    // Lấy products
    let products = await Product.find(query).limit(20).select("_id");

    // Filter theo price range
    if (behavior.avgPriceRange && products.length > 0) {
      const productIds = products.map((p) => p._id);

      const inventoryItems = await InventoryItem.find({
        product: { $in: productIds },
        finalPrice: {
          $gte: behavior.avgPriceRange.min * 0.8,
          $lte: behavior.avgPriceRange.max * 1.2,
        },
      }).distinct("product");

      products = products.filter((p) =>
        inventoryItems.some((inv) => inv.toString() === p._id.toString())
      );
    }

    // Loại bỏ products user đã mua gần đây
    const recentOrders = await Order.find({
      user: userId,
      status: "delivered",
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    }).populate({
      path: "orderItems.variant",
      select: "product",
    });

    const recentProductIds = new Set();
    recentOrders.forEach((order) => {
      order.orderItems.forEach((item) => {
        if (item.variant?.product) {
          recentProductIds.add(item.variant.product.toString());
        }
      });
    });

    products = products.filter((p) => !recentProductIds.has(p._id.toString()));

    return products
      .slice(0, 10)
      .map((p, i) => ({ product: p._id, score: 10 - i }));
  },

  /**
   * 3. Trending Products - Sản phẩm hot 7 ngày qua
   */
  getTrendingProducts: async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const trending = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          createdAt: { $gte: sevenDaysAgo },
          deletedAt: null,
        },
      },
      { $unwind: "$orderItems" },
      {
        $lookup: {
          from: "variants",
          localField: "orderItems.variant",
          foreignField: "_id",
          as: "variantData",
        },
      },
      { $unwind: "$variantData" },
      {
        $group: {
          _id: "$variantData.product",
          soldCount: { $sum: "$orderItems.quantity" },
          revenue: {
            $sum: {
              $multiply: ["$orderItems.price", "$orderItems.quantity"],
            },
          },
        },
      },
      { $sort: { soldCount: -1 } },
      { $limit: 10 },
    ]);

    return trending.map((t, i) => ({
      product: t._id,
      score: 10 - i,
      soldCount: t.soldCount,
    }));
  },

  /**
   * 4. Hybrid - Kết hợp tất cả algorithms
   */
  getHybridRecommendations: async (userId) => {
    try {
      const [collaborative, contentBased, trending] = await Promise.all([
        recommendationService
          .getCollaborativeRecommendations(userId)
          .catch(() => []),
        recommendationService
          .getContentBasedRecommendations(userId)
          .catch(() => []),
        recommendationService.getTrendingProducts().catch(() => []),
      ]);

      // Merge với trọng số
      const scores = {};

      // Collaborative: 40%
      collaborative.forEach((r) => {
        scores[r.product] = (scores[r.product] || 0) + r.score * 0.4;
      });

      // Content-based: 40%
      contentBased.forEach((r) => {
        scores[r.product] = (scores[r.product] || 0) + r.score * 0.4;
      });

      // Trending: 20%
      trending.forEach((r) => {
        scores[r.product] = (scores[r.product] || 0) + r.score * 0.2;
      });

      // Sort và lấy top 10
      const recommendations = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([productId, score]) => ({
          product: productId,
          score,
        }));

      return recommendations;
    } catch (error) {
      console.error("Lỗi hybrid recommendations:", error);
      return [];
    }
  },

  /**
   * Get recommendations với cache
   */
  getRecommendations: async (userId, algorithm = "HYBRID") => {
    // Check cache
    const cached = await RecommendationCache.findOne({
      user: userId,
      algorithm,
    });

    if (cached && cached.products.length > 0) {
      console.log(`[RECOMMENDATION CACHE HIT] User ${userId}, ${algorithm}`);
      return {
        success: true,
        products: cached.products,
        fromCache: true,
      };
    }

    console.log(`[RECOMMENDATION CACHE MISS] User ${userId}, ${algorithm}`);

    // Generate new recommendations
    let recommendations = [];

    switch (algorithm) {
      case "COLLABORATIVE":
        recommendations =
          await recommendationService.getCollaborativeRecommendations(userId);
        break;
      case "CONTENT_BASED":
        recommendations =
          await recommendationService.getContentBasedRecommendations(userId);
        break;
      case "TRENDING":
        recommendations = await recommendationService.getTrendingProducts();
        break;
      default:
        recommendations = await recommendationService.getHybridRecommendations(
          userId
        );
    }

    // Cache for 24h (TTL handled by generatedAt index)
    // FIX BUG #13: Use upsert to prevent duplicate cache entries
    await RecommendationCache.findOneAndUpdate(
      { user: userId, algorithm },
      {
        $set: {
          products: recommendations.map((r) =>
            typeof r.product === "string" ? r.product : r.product._id
          ),
          scores: recommendations.map((r) => r.score || 0),
          generatedAt: new Date(), // Reset TTL
        },
      },
      { upsert: true, new: true }
    );

    // Populate product details
    const productIds = recommendations.map((r) =>
      typeof r.product === "string" ? r.product : r.product._id
    );

    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
      deletedAt: null,
    })
      .populate("category", "name")
      .populate("brand", "name logo")
      .limit(10);

    return {
      success: true,
      products,
      fromCache: false,
    };
  },
};

module.exports = recommendationService;
