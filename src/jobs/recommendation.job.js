const { User, Order } = require("@models");
const ViewHistory = require("../models/viewHistory");
const UserBehavior = require("../models/userBehavior");
const RecommendationCache = require("../models/recommendationCache");
const mongoose = require("mongoose");

/**
 * Cronjob: Cập nhật user behavior từ view history và orders
 * Chạy mỗi ngày lúc 3:00 AM
 */
const updateUserBehaviors = async () => {
  try {
    console.log("[CRONJOB] Bắt đầu cập nhật user behaviors...");

    const users = await User.find({ isActive: true, role: "user" }).select(
      "_id"
    );

    let updatedCount = 0;

    for (const user of users) {
      try {
        // Lấy view history (30 ngày gần nhất)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const viewHistory = await ViewHistory.find({
          user: user._id,
          createdAt: { $gte: thirtyDaysAgo },
        }).populate({
          path: "product",
          select: "category brand",
        });

        // Lấy orders (delivered)
        const orders = await Order.find({
          user: user._id,
          status: "delivered",
        }).populate({
          path: "orderItems.variant",
          select: "product gender",
          populate: {
            path: "product",
            select: "category brand",
          },
        });

        // Calculate preferences
        const categoryScores = {};
        const brandScores = {};
        const genderScores = {};
        let totalPrice = 0;
        let minPrice = Infinity;
        let maxPrice = 0;

        // Score từ view history (weight: 1)
        viewHistory.forEach((view) => {
          if (view.product) {
            const catId = view.product.category?.toString();
            const brandId = view.product.brand?.toString();

            if (catId) categoryScores[catId] = (categoryScores[catId] || 0) + 1;
            if (brandId) brandScores[brandId] = (brandScores[brandId] || 0) + 1;
          }
        });

        // Score từ orders (weight: 5)
        orders.forEach((order) => {
          totalPrice += order.totalAfterDiscountAndShipping;
          minPrice = Math.min(minPrice, order.totalAfterDiscountAndShipping);
          maxPrice = Math.max(maxPrice, order.totalAfterDiscountAndShipping);

          order.orderItems.forEach((item) => {
            if (item.variant?.product) {
              const catId = item.variant.product.category?.toString();
              const brandId = item.variant.product.brand?.toString();
              const gender = item.variant.gender;

              if (catId)
                categoryScores[catId] = (categoryScores[catId] || 0) + 5;
              if (brandId)
                brandScores[brandId] = (brandScores[brandId] || 0) + 5;
              if (gender)
                genderScores[gender] = (genderScores[gender] || 0) + 1;
            }
          });
        });

        // Determine preferred gender
        let preferredGender = "unisex";
        if (Object.keys(genderScores).length > 0) {
          preferredGender = Object.entries(genderScores).sort(
            (a, b) => b[1] - a[1]
          )[0][0];
        }

        // Update behavior
        await UserBehavior.findOneAndUpdate(
          { user: user._id },
          {
            favoriteCategories: Object.entries(categoryScores)
              .map(([cat, score]) => ({
                category: cat,
                score,
              }))
              .sort((a, b) => b.score - a.score)
              .slice(0, 5),

            favoriteBrands: Object.entries(brandScores)
              .map(([brand, score]) => ({
                brand,
                score,
              }))
              .sort((a, b) => b.score - a.score)
              .slice(0, 5),

            avgPriceRange: {
              min: minPrice === Infinity ? 0 : minPrice,
              max: maxPrice === 0 ? 1000000 : maxPrice,
            },

            avgOrderValue:
              orders.length > 0 ? Math.floor(totalPrice / orders.length) : 0,
            purchaseFrequency: orders.length,
            preferredGender,
            lastUpdated: new Date(),
          },
          { upsert: true, new: true }
        );

        updatedCount++;
      } catch (error) {
        console.error(`Lỗi update behavior user ${user._id}:`, error.message);
      }
    }

    console.log(
      `[CRONJOB] Đã cập nhật behavior cho ${updatedCount}/${users.length} user(s)`
    );

    return {
      success: true,
      updatedCount,
      totalUsers: users.length,
    };
  } catch (error) {
    console.error("[CRONJOB ERROR] updateUserBehaviors:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Cronjob: Clear recommendation cache cũ
 * Chạy mỗi ngày
 */
const clearExpiredCache = async () => {
  try {
    console.log("[CRONJOB] Clearing expired recommendation cache...");

    const result = await RecommendationCache.deleteMany({
      expiresAt: { $lt: new Date() },
    });

    console.log(
      `[CRONJOB] Đã xóa ${result.deletedCount} recommendation cache(s) cũ`
    );

    return {
      success: true,
      deletedCount: result.deletedCount,
    };
  } catch (error) {
    console.error("[CRONJOB ERROR] clearExpiredCache:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  updateUserBehaviors,
  clearExpiredCache,
};

