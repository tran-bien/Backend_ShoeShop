const mongoose = require("mongoose");
const { Product, Variant, Category, Brand, Color, Size } = require("@models");
const redis = require("@config/redis"); // Giả sử bạn có Redis để cache kết quả tìm kiếm

const searchService = {
  /**
   * Tìm kiếm đa năng cho sản phẩm và biến thể
   * @param {Object} query - Các tham số truy vấn
   */
  advancedSearch: async (query) => {
    const {
      type = "product", // 'product' hoặc 'variant'
      page = 1,
      limit = 12,
      name,
      category,
      brand,
      color,
      size,
      minPrice,
      maxPrice,
      gender,
      inStock = false,
      isActive,
      sort,
    } = query;

    // Xác định loại tìm kiếm
    if (type === "product") {
      return await searchService._searchProducts(query);
    } else if (type === "variant") {
      return await searchService._searchVariants(query);
    } else {
      throw new Error(
        "Loại tìm kiếm không hợp lệ. Chỉ hỗ trợ 'product' hoặc 'variant'"
      );
    }
  },

  /**
   * Tìm kiếm gợi ý tự động
   * @param {String} keyword - Từ khóa tìm kiếm
   * @param {String} type - Loại gợi ý ('product', 'category', 'brand', hoặc 'all')
   */
  searchSuggestions: async (keyword, type = "all") => {
    if (!keyword || keyword.length < 2) {
      return { success: true, suggestions: [] };
    }

    // Tạo cache key
    const cacheKey = `suggestions:${type}:${keyword.toLowerCase()}`;

    // Kiểm tra cache
    try {
      const cachedResult = await redis.get(cacheKey);
      if (cachedResult) {
        return JSON.parse(cachedResult);
      }
    } catch (error) {
      console.error("Redis error:", error);
      // Tiếp tục thực hiện tìm kiếm nếu có lỗi với cache
    }

    const results = { success: true, suggestions: [] };
    const regex = new RegExp(keyword, "i");

    try {
      // Tìm kiếm sản phẩm
      if (type === "all" || type === "product") {
        const products = await Product.find(
          {
            name: regex,
            isActive: true,
            deletedAt: null,
          },
          { name: 1, slug: 1, images: 1 }
        ).limit(5);

        results.suggestions.push(
          ...products.map((product) => ({
            type: "product",
            id: product._id,
            name: product.name,
            slug: product.slug,
            image:
              product.images.find((img) => img.isMain)?.url ||
              product.images[0]?.url ||
              "",
          }))
        );
      }

      // Tìm kiếm danh mục
      if (type === "all" || type === "category") {
        const categories = await Category.find(
          {
            name: regex,
            isActive: true,
            deletedAt: null,
          },
          { name: 1, slug: 1 }
        ).limit(3);

        results.suggestions.push(
          ...categories.map((category) => ({
            type: "category",
            id: category._id,
            name: category.name,
            slug: category.slug,
          }))
        );
      }

      // Tìm kiếm thương hiệu
      if (type === "all" || type === "brand") {
        const brands = await Brand.find(
          {
            name: regex,
            isActive: true,
            deletedAt: null,
          },
          { name: 1, slug: 1, logo: 1 }
        ).limit(3);

        results.suggestions.push(
          ...brands.map((brand) => ({
            type: "brand",
            id: brand._id,
            name: brand.name,
            slug: brand.slug,
            image: brand.logo?.url || "",
          }))
        );
      }

      // Cache kết quả trong 30 phút
      try {
        await redis.set(cacheKey, JSON.stringify(results), "EX", 1800);
      } catch (error) {
        console.error("Redis cache error:", error);
      }

      return results;
    } catch (error) {
      throw new Error(`Lỗi tìm kiếm gợi ý: ${error.message}`);
    }
  },

  /**
   * Private method để tìm kiếm sản phẩm
   */
  _searchProducts: async (query) => {
    const {
      page = 1,
      limit = 12,
      name,
      category,
      brand,
      color,
      size,
      minPrice,
      maxPrice,
      gender,
      inStock = false,
      isActive = true,
      sort,
    } = query;

    // Xác định nếu là API admin hoặc public
    const isAdminEndpoint = query.isAdmin === true;

    // Xây dựng pipeline cơ bản
    const pipeline = [];

    // 1. Match cơ bản cho products
    const basicMatch = {};

    // Nếu là public API, chỉ lấy sản phẩm active và chưa xóa
    if (!isAdminEndpoint) {
      basicMatch.isActive = true;
      basicMatch.deletedAt = null;
    } else if (isAdminEndpoint && isActive !== undefined) {
      // Nếu là admin API và có filter isActive
      basicMatch.isActive = isActive === "true";
    }

    // Filter theo tên, danh mục, thương hiệu
    if (name) basicMatch.name = { $regex: name, $options: "i" };
    if (category) basicMatch.category = new mongoose.Types.ObjectId(category);
    if (brand) basicMatch.brand = new mongoose.Types.ObjectId(brand);

    pipeline.push({ $match: basicMatch });

    // 2. Lookup variants
    const variantMatch = {};
    if (!isAdminEndpoint) {
      variantMatch.isActive = true;
      variantMatch.deletedAt = null;
    }

    if (color) variantMatch.color = new mongoose.Types.ObjectId(color);
    if (gender) variantMatch.gender = gender;

    // Nếu cần lọc sản phẩm còn hàng
    const sizeMatch = {};
    if (size) sizeMatch["sizes.size"] = new mongoose.Types.ObjectId(size);
    if (inStock === "true") sizeMatch["sizes.quantity"] = { $gt: 0 };

    pipeline.push({
      $lookup: {
        from: "variants",
        localField: "variants",
        foreignField: "_id",
        as: "variantDetails",
        pipeline: [
          { $match: variantMatch },
          ...(Object.keys(sizeMatch).length > 0
            ? [{ $match: { $and: [sizeMatch] } }]
            : []),
        ],
      },
    });

    // 3. Lookup category và brand
    pipeline.push(
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      {
        $lookup: {
          from: "brands",
          localField: "brand",
          foreignField: "_id",
          as: "brandDetails",
        },
      }
    );

    // 4. Unwrap arrays và tạo fields bổ sung
    pipeline.push({
      $addFields: {
        category: { $arrayElemAt: ["$categoryDetails", 0] },
        brand: { $arrayElemAt: ["$brandDetails", 0] },
        minProductPrice: { $min: "$variantDetails.price" },
        maxProductPrice: { $max: "$variantDetails.price" },
        minFinalPrice: { $min: "$variantDetails.priceFinal" },
        maxFinalPrice: { $max: "$variantDetails.priceFinal" },
        variantsCount: { $size: "$variantDetails" },
        hasStock: {
          $gt: [
            {
              $sum: {
                $map: {
                  input: "$variantDetails",
                  as: "variant",
                  in: {
                    $sum: {
                      $map: {
                        input: "$$variant.sizes",
                        as: "size",
                        in: "$$size.quantity",
                      },
                    },
                  },
                },
              },
            },
            0,
          ],
        },
      },
    });

    // 5. Lọc theo khoảng giá
    if (minPrice || maxPrice) {
      const priceFilter = {};

      if (minPrice) {
        priceFilter.minFinalPrice = { $gte: parseFloat(minPrice) };
      }

      if (maxPrice) {
        priceFilter.maxFinalPrice = { $lte: parseFloat(maxPrice) };
      }

      pipeline.push({ $match: priceFilter });
    }

    // 6. Lọc sản phẩm có ít nhất 1 variant (đối với public API)
    if (!isAdminEndpoint) {
      pipeline.push({ $match: { variantsCount: { $gt: 0 } } });
    }

    // 7. Lọc chỉ sản phẩm còn hàng nếu yêu cầu
    if (inStock === "true") {
      pipeline.push({ $match: { hasStock: true } });
    }

    // 8. Xóa fields tạm
    pipeline.push({
      $project: {
        variantDetails: 0,
        categoryDetails: 0,
        brandDetails: 0,
      },
    });

    // 9. Sắp xếp
    const sortOption = sort ? JSON.parse(sort) : { createdAt: -1 };
    pipeline.push({ $sort: sortOption });

    // 10. Phân trang với Facet
    pipeline.push({
      $facet: {
        metadata: [
          { $count: "total" },
          {
            $addFields: {
              page: parseInt(page),
              limit: parseInt(limit),
              totalPages: {
                $ceil: {
                  $divide: ["$total", parseInt(limit)],
                },
              },
            },
          },
        ],
        data: [
          { $skip: (parseInt(page) - 1) * parseInt(limit) },
          { $limit: parseInt(limit) },
        ],
        // Thống kê bổ sung cho filters UI
        categoryStats: [
          {
            $group: {
              _id: "$category._id",
              name: { $first: "$category.name" },
              count: { $sum: 1 },
            },
          },
        ],
        brandStats: [
          {
            $group: {
              _id: "$brand._id",
              name: { $first: "$brand.name" },
              count: { $sum: 1 },
            },
          },
        ],
        priceRange: [
          {
            $group: {
              _id: null,
              minPrice: { $min: "$minFinalPrice" },
              maxPrice: { $max: "$maxFinalPrice" },
            },
          },
        ],
      },
    });

    // Thực hiện truy vấn
    const result = await Product.aggregate(pipeline);

    // Format kết quả
    const formattedResult = {
      success: true,
      data: result[0].data || [],
      metadata: result[0].metadata[0] || {
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: 0,
      },
      filters: {
        categories: result[0].categoryStats || [],
        brands: result[0].brandStats || [],
        priceRange: result[0].priceRange[0] || { minPrice: 0, maxPrice: 0 },
      },
    };

    return formattedResult;
  },

  /**
   * Private method để tìm kiếm variants
   */
  _searchVariants: async (query) => {
    const {
      page = 1,
      limit = 12,
      productId,
      color,
      size,
      minPrice,
      maxPrice,
      gender,
      inStock = false,
      isActive,
      sort,
    } = query;

    // Xác định nếu là API admin hoặc public
    const isAdminEndpoint = query.isAdmin === true;

    // Xây dựng pipeline
    const pipeline = [];

    // 1. Match cơ bản cho variants
    const basicMatch = {};

    // Nếu là public API, chỉ lấy variants active và chưa xóa
    if (!isAdminEndpoint) {
      basicMatch.isActive = true;
      basicMatch.deletedAt = null;
    } else if (isAdminEndpoint && isActive !== undefined) {
      basicMatch.isActive = isActive === "true";
    }

    // Filter theo sản phẩm, màu sắc, giới tính
    if (productId)
      basicMatch.productId = new mongoose.Types.ObjectId(productId);
    if (color) basicMatch.color = new mongoose.Types.ObjectId(color);
    if (gender) basicMatch.gender = gender;

    // Filter theo giá
    if (minPrice !== undefined) {
      basicMatch.priceFinal = basicMatch.priceFinal || {};
      basicMatch.priceFinal.$gte = parseFloat(minPrice);
    }

    if (maxPrice !== undefined) {
      basicMatch.priceFinal = basicMatch.priceFinal || {};
      basicMatch.priceFinal.$lte = parseFloat(maxPrice);
    }

    pipeline.push({ $match: basicMatch });

    // 2. Filter theo kích thước và tồn kho
    if (size || inStock === "true") {
      const sizeCondition = [];

      if (size) {
        sizeCondition.push({ "sizes.size": new mongoose.Types.ObjectId(size) });
      }

      if (inStock === "true") {
        sizeCondition.push({ "sizes.quantity": { $gt: 0 } });
      }

      if (sizeCondition.length > 0) {
        pipeline.push({
          $match: {
            sizes: {
              $elemMatch: {
                $and: sizeCondition,
              },
            },
          },
        });
      }
    }

    // 3. Lookup product, color và size
    pipeline.push(
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "productDetails",
          pipeline: [{ $project: { name: 1, slug: 1, images: 1 } }],
        },
      },
      {
        $lookup: {
          from: "colors",
          localField: "color",
          foreignField: "_id",
          as: "colorDetails",
        },
      }
    );

    // 4. Lookup sizes
    pipeline.push({
      $addFields: {
        sizes: {
          $map: {
            input: "$sizes",
            as: "sizeItem",
            in: {
              _id: "$$sizeItem._id",
              size: "$$sizeItem.size",
              quantity: "$$sizeItem.quantity",
              sku: "$$sizeItem.sku",
              isSizeAvailable: "$$sizeItem.isSizeAvailable",
            },
          },
        },
      },
    });

    pipeline.push({
      $lookup: {
        from: "sizes",
        localField: "sizes.size",
        foreignField: "_id",
        as: "sizeDetails",
      },
    });

    // 5. Unwrap arrays và tạo fields bổ sung
    pipeline.push({
      $addFields: {
        product: { $arrayElemAt: ["$productDetails", 0] },
        color: { $arrayElemAt: ["$colorDetails", 0] },
        totalStock: {
          $sum: "$sizes.quantity",
        },
        hasStock: {
          $gt: [{ $sum: "$sizes.quantity" }, 0],
        },
        // Map size details to each size item
        enrichedSizes: {
          $map: {
            input: "$sizes",
            as: "sizeItem",
            in: {
              _id: "$$sizeItem._id",
              sizeId: "$$sizeItem.size",
              quantity: "$$sizeItem.quantity",
              sku: "$$sizeItem.sku",
              isSizeAvailable: "$$sizeItem.isSizeAvailable",
              sizeDetails: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$sizeDetails",
                      cond: { $eq: ["$$this._id", "$$sizeItem.size"] },
                    },
                  },
                  0,
                ],
              },
            },
          },
        },
      },
    });

    // 6. Lọc variant có ít nhất 1 size còn hàng nếu yêu cầu
    if (inStock === "true") {
      pipeline.push({ $match: { hasStock: true } });
    }

    // 7. Xóa fields tạm
    pipeline.push({
      $project: {
        productDetails: 0,
        colorDetails: 0,
        sizeDetails: 0,
        sizes: 0,
      },
    });

    // 8. Sắp xếp
    const sortOption = sort ? JSON.parse(sort) : { createdAt: -1 };
    pipeline.push({ $sort: sortOption });

    // 9. Phân trang với Facet
    pipeline.push({
      $facet: {
        metadata: [
          { $count: "total" },
          {
            $addFields: {
              page: parseInt(page),
              limit: parseInt(limit),
              totalPages: {
                $ceil: {
                  $divide: ["$total", parseInt(limit)],
                },
              },
            },
          },
        ],
        data: [
          { $skip: (parseInt(page) - 1) * parseInt(limit) },
          { $limit: parseInt(limit) },
        ],
        // Thống kê bổ sung cho filters UI
        colorStats: [
          {
            $group: {
              _id: "$color._id",
              name: { $first: "$color.name" },
              count: { $sum: 1 },
            },
          },
        ],
        productStats: [
          {
            $group: {
              _id: "$product._id",
              name: { $first: "$product.name" },
              count: { $sum: 1 },
            },
          },
        ],
        genderStats: [{ $group: { _id: "$gender", count: { $sum: 1 } } }],
        priceRange: [
          {
            $group: {
              _id: null,
              minPrice: { $min: "$priceFinal" },
              maxPrice: { $max: "$priceFinal" },
            },
          },
        ],
      },
    });

    // Thực hiện truy vấn
    const result = await Variant.aggregate(pipeline);

    // Format kết quả
    const formattedResult = {
      success: true,
      data: result[0].data || [],
      metadata: result[0].metadata[0] || {
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: 0,
      },
      filters: {
        colors: result[0].colorStats || [],
        products: result[0].productStats || [],
        genders: result[0].genderStats || [],
        priceRange: result[0].priceRange[0] || { minPrice: 0, maxPrice: 0 },
      },
    };

    return formattedResult;
  },
};

module.exports = searchService;
