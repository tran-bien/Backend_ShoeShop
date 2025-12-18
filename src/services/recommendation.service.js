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

      console.log(
        `[HYBRID] collaborative: ${collaborative.length}, contentBased: ${contentBased.length}, trending: ${trending.length}`
      );

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
      let recommendations = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([productId, score]) => ({
          product: productId,
          score,
        }));

      // FALLBACK: Nếu không có recommendations, lấy sản phẩm mới nhất
      if (recommendations.length === 0) {
        console.log(
          `[HYBRID] No recommendations found, falling back to newest products`
        );
        const newestProducts = await Product.find({
          isActive: true,
          deletedAt: null,
        })
          .sort({ createdAt: -1 })
          .limit(10)
          .select("_id");

        recommendations = newestProducts.map((p, i) => ({
          product: p._id.toString(),
          score: 10 - i,
        }));
      }

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

      // FIX: Enrich products từ cache (cache chỉ lưu ObjectIds)
      const products = await recommendationService._enrichProducts(
        cached.products
      );

      // FIX: Nếu cache có products nhưng không tìm thấy active products, regenerate
      if (products.length === 0) {
        console.log(
          `[RECOMMENDATION] Cache products không còn active, regenerating...`
        );
        // Xóa cache cũ
        await RecommendationCache.deleteOne({ user: userId, algorithm });
        // Fall through để regenerate
      } else {
        return {
          success: true,
          products,
          fromCache: true,
        };
      }
    }

    console.log(`[RECOMMENDATION CACHE MISS] User ${userId}, ${algorithm}`);

    // Generate new recommendations
    let recommendations = [];

    switch (algorithm) {
      case "COLLABORATIVE":
        recommendations =
          await recommendationService.getCollaborativeRecommendations(userId);
        // Fallback: nếu không có kết quả collaborative (user chưa mua hàng), dùng trending
        if (recommendations.length === 0) {
          console.log(
            `[RECOMMENDATION] COLLABORATIVE empty, falling back to TRENDING`
          );
          recommendations = await recommendationService.getTrendingProducts();
        }
        break;
      case "CONTENT_BASED":
        recommendations =
          await recommendationService.getContentBasedRecommendations(userId);
        // Fallback: nếu không có kết quả content-based, dùng trending
        if (recommendations.length === 0) {
          console.log(
            `[RECOMMENDATION] CONTENT_BASED empty, falling back to TRENDING`
          );
          recommendations = await recommendationService.getTrendingProducts();
        }
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

    let products = await recommendationService._enrichProducts(productIds);

    // FALLBACK: Nếu enrichProducts trả về rỗng (do products không có variants), fallback
    if (products.length === 0 && productIds.length > 0) {
      console.log(
        `[RECOMMENDATION] Enriched products empty, falling back to featured products`
      );
      const productService = require("@services/product.service");
      const featuredResult = await productService.getFeaturedProducts(10);
      products = featuredResult.products || [];
    }

    return {
      success: true,
      products,
      fromCache: false,
    };
  },

  /**
   * Helper: Enrich products với variants, inventory, rating info
   * Giống như getFeaturedProducts trong product.service.js
   */
  _enrichProducts: async (productIds) => {
    const inventoryService = require("@services/inventory.service");
    const reviewService = require("@services/review.service");
    const variantService = require("@services/variant.service");

    // Lấy products cơ bản
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
      deletedAt: null,
    })
      .populate("category", "name")
      .populate("brand", "name logo")
      .populate("tags", "name type description")
      .lean();

    if (products.length === 0) {
      return [];
    }

    // Lookup variants từ Variant model
    const activeVariants = await Variant.find({
      product: { $in: productIds },
      isActive: true,
      deletedAt: null,
    })
      .populate("color", "name code type colors")
      .populate("sizes.size", "value type description")
      .lean();

    // Gom variants theo productId
    const variantsByProduct = {};
    activeVariants.forEach((variant) => {
      const productId = variant.product.toString();
      if (!variantsByProduct[productId]) {
        variantsByProduct[productId] = [];
      }
      variantsByProduct[productId].push(variant);
    });

    // Gán variants vào products
    const productsWithVariants = products
      .map((product) => ({
        ...product,
        variants: variantsByProduct[product._id.toString()] || [],
      }))
      .filter((product) => product.variants.length > 0);

    // Batch load rating info
    const productIdStrs = productsWithVariants.map((p) => p._id.toString());
    const ratingInfoMap = await reviewService.getBatchProductRatingInfo(
      productIdStrs
    );

    // Transform và enrich products
    const enrichedProducts = await Promise.all(
      productsWithVariants.map(async (product) => {
        const productObj = { ...product };
        const productIdStr = product._id.toString();

        // Tính stock info
        const stockInfo = await inventoryService.getProductStockInfo(
          product._id
        );
        productObj.totalQuantity = stockInfo.totalQuantity;
        productObj.stockStatus = stockInfo.stockStatus;

        // Rating info
        const ratingInfo = ratingInfoMap[productIdStr] || {
          rating: 0,
          numReviews: 0,
        };
        productObj.rating = ratingInfo.rating;
        productObj.numReviews = ratingInfo.numReviews;
        productObj.averageRating = ratingInfo.rating;
        productObj.reviewCount = ratingInfo.numReviews;

        // Tính inventorySummary cho mỗi variant
        if (productObj.variants && productObj.variants.length > 0) {
          productObj.variants = await Promise.all(
            productObj.variants.map(async (variant) => {
              const inventorySummary =
                await variantService.calculateInventorySummary(variant);
              return {
                ...variant,
                inventorySummary,
              };
            })
          );
        }

        // Transform for public list
        return recommendationService._transformProductForPublicList(productObj);
      })
    );

    return enrichedProducts;
  },

  /**
   * Helper: Transform product for public list (copy từ product.service.js)
   */
  _transformProductForPublicList: (product) => {
    const productObj = { ...product };

    // Build priceRange from variants
    let minPrice = null;
    let maxPrice = null;

    if (productObj.variants && productObj.variants.length > 0) {
      productObj.variants.forEach((variant) => {
        const pricing = variant.inventorySummary?.pricing || {};
        const vMin = pricing.minPrice || 0;
        const vMax = pricing.maxPrice || vMin;

        if (vMin > 0 && (minPrice === null || vMin < minPrice)) minPrice = vMin;
        if (vMax > 0 && (maxPrice === null || vMax > maxPrice)) maxPrice = vMax;
      });
    }

    // Build variantSummary
    const colorSet = new Set();
    const sizeSet = new Set();
    const colors = [];

    if (productObj.variants && productObj.variants.length > 0) {
      productObj.variants.forEach((variant) => {
        if (variant.color && variant.color._id) {
          const colorId = variant.color._id.toString();
          if (!colorSet.has(colorId)) {
            colorSet.add(colorId);
            colors.push({
              _id: variant.color._id,
              name: variant.color.name,
              code: variant.color.code,
              hexCode: variant.color.code || null,
              type: variant.color.type,
              colors: variant.color.colors || [],
            });
          }
        }

        if (variant.sizes && Array.isArray(variant.sizes)) {
          variant.sizes.forEach((sizeObj) => {
            if (sizeObj.size && sizeObj.size._id) {
              sizeSet.add(sizeObj.size._id.toString());
            }
          });
        }
      });
    }

    // Get main image
    let mainImage = "";
    if (productObj.images && productObj.images.length > 0) {
      const main =
        productObj.images.find((img) => img.isMain) || productObj.images[0];
      mainImage = main?.url || "";
    } else if (productObj.variants && productObj.variants.length > 0) {
      const variantWithImages = productObj.variants.find(
        (v) => v.imagesvariant && v.imagesvariant.length > 0
      );
      if (variantWithImages) {
        const main =
          variantWithImages.imagesvariant.find((img) => img.isMain) ||
          variantWithImages.imagesvariant[0];
        mainImage = main?.url || "";
      }
    }

    return {
      _id: productObj._id,
      name: productObj.name,
      slug: productObj.slug,
      description: productObj.description,
      category: productObj.category
        ? { _id: productObj.category._id, name: productObj.category.name }
        : { _id: "", name: "Chưa phân loại" },
      brand: productObj.brand
        ? {
            _id: productObj.brand._id,
            name: productObj.brand.name,
            logo: productObj.brand.logo,
          }
        : { _id: "", name: "Chưa có thương hiệu" },
      tags: Array.isArray(productObj.tags)
        ? productObj.tags.map((tag) => ({
            _id: tag._id,
            name: tag.name,
            type: tag.type,
            description: tag.description,
          }))
        : [],
      images: productObj.images || [],
      rating: productObj.rating || 0,
      numReviews: productObj.numReviews || 0,
      averageRating: productObj.rating || 0,
      reviewCount: productObj.numReviews || 0,
      stockStatus: productObj.stockStatus || "out_of_stock",
      totalQuantity: productObj.totalQuantity || 0,
      isActive: productObj.isActive,
      createdAt: productObj.createdAt,
      isNew: false,
      price: minPrice || 0,
      originalPrice: maxPrice || 0,
      discountPercent: 0,
      hasDiscount: false,
      maxDiscountPercent: 0,
      salePercentage: 0,
      priceRange: {
        min: minPrice || 0,
        max: maxPrice || 0,
        isSinglePrice: minPrice === maxPrice,
      },
      mainImage,
      variantSummary: {
        total: productObj.variants?.length || 0,
        active:
          productObj.variants?.filter((v) => v.isActive !== false).length || 0,
        colors,
        colorCount: colorSet.size,
        sizeCount: sizeSet.size,
        priceRange: {
          min: minPrice || 0,
          max: maxPrice || 0,
          isSinglePrice: minPrice === maxPrice,
        },
        discount: { hasDiscount: false, maxPercent: 0 },
      },
      totalInventory: 0,
    };
  },
};

module.exports = recommendationService;
