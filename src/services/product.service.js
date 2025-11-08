const { Product, Variant, Category, Brand, Order, Tag } = require("@models");
const mongoose = require("mongoose");
const { createSlug } = require("@utils/slugify");
const paginate = require("@utils/pagination");
const paginateDeleted = require("@utils/paginationDeleted");
const {
  getVietnameseCollation,
  needsVietnameseCollation,
} = require("@utils/collation");
const { updateProductStockInfo } = require("@models/product/middlewares");
const ApiError = require("@utils/ApiError");
const variantService = require("@services/variant.service");

// Hàm hỗ trợ xử lý các case sắp xếp
const getSortOption = (sortParam) => {
  let sortOption = { createdAt: -1 };
  let collation = null;

  if (sortParam) {
    switch (sortParam) {
      case "created_at_asc":
        sortOption = { createdAt: 1 };
        break;
      case "created_at_desc":
        sortOption = { createdAt: -1 };
        break;
      case "name_asc":
        sortOption = { name: 1 };
        collation = getVietnameseCollation();
        break;
      case "name_desc":
        sortOption = { name: -1 };
        collation = getVietnameseCollation();
        break;
      default:
        try {
          sortOption = JSON.parse(sortParam);
          // Kiểm tra nếu sort theo name thì thêm collation
          if (needsVietnameseCollation(JSON.stringify(sortOption))) {
            collation = getVietnameseCollation();
          }
        } catch (err) {
          sortOption = { createdAt: -1 };
        }
        break;
    }
  }

  return { sortOption, collation };
};

/**
 * Helper: Tạo biến thể tóm tắt cho các sản phẩm
 */
const createVariantSummary = (variants) => {
  // Khởi tạo thông tin tóm tắt
  const variantSummary = {
    total: 0,
    active: 0,
    colors: [],
    colorCount: 0,
    sizeCount: 0,
    priceRange: { min: null, max: null, isSinglePrice: true },
    discount: { hasDiscount: false, maxPercent: 0 },
  };

  // Tập hợp để lưu trữ các ID duy nhất
  const colorSet = new Set();
  const sizeSet = new Set();

  // Xử lý thông tin từ variants nếu có
  if (variants && variants.length > 0) {
    variantSummary.total = variants.length;

    // Variables to calculate price range and discount across variants
    let minPrice = null;
    let maxPrice = null;
    let hasDiscount = false;
    let maxDiscountPercent = 0;

    variants.forEach((variant) => {
      // Đếm variants active
      if (variant.isActive) {
        variantSummary.active++;
      }

      // Thu thập thông tin màu sắc
      if (variant.color && variant.color._id) {
        colorSet.add(variant.color._id.toString());
        // Lưu lại thông tin màu để hiển thị
        if (
          !variantSummary.colors.some(
            (c) => c._id?.toString() === variant.color._id.toString()
          )
        ) {
          variantSummary.colors.push({
            _id: variant.color._id,
            name: variant.color.name,
            code: variant.color.code,
            // Map code -> hexCode for FE compatibility. If code is missing (e.g. half type),
            // fallback to first color in colors array when available
            hexCode:
              variant.color.code ||
              (Array.isArray(variant.color.colors) &&
                variant.color.colors[0]) ||
              null,
            type: variant.color.type,
            colors: variant.color.colors || [],
          });
        }
      }

      // Thu thập thông tin kích thước
      if (variant.sizes && Array.isArray(variant.sizes)) {
        variant.sizes.forEach((sizeObj) => {
          if (sizeObj.size && sizeObj.size._id) {
            const sizeId = sizeObj.size._id.toString();
            sizeSet.add(sizeId);
          }
        });
      }

      // REMOVED: variant.priceFinal/price/percentDiscount đã bị xóa khỏi schema
      // Giá được quản lý bởi InventoryItem, try to extract pricing from
      // variant.inventorySummary if available so variantSummary.priceRange can be built
      const pricing = variant.inventorySummary?.pricing || {};
      const vMin =
        pricing.minPrice ??
        pricing.calculatedPrice ??
        pricing.sellingPrice ??
        null;
      const vMax =
        pricing.maxPrice ??
        pricing.calculatedPrice ??
        pricing.finalPrice ??
        null;
      const vPercent = pricing.percentDiscount ?? pricing.discountPercent ?? 0;

      if (vMin !== null && vMin !== undefined) {
        if (minPrice === null || vMin < minPrice) minPrice = vMin;
      }
      if (vMax !== null && vMax !== undefined) {
        if (maxPrice === null || vMax > maxPrice) maxPrice = vMax;
      }
      if (vPercent && vPercent > 0) {
        hasDiscount = true;
        if (vPercent > maxDiscountPercent) maxDiscountPercent = vPercent;
      }

      // Note: If inventory pricing is not populated here, transformProductForPublic
      // or calling code should populate inventory summaries before calling this helper.
    });

    // Cập nhật số lượng màu và kích thước
    variantSummary.colorCount = colorSet.size;
    variantSummary.sizeCount = sizeSet.size;

    // Assign computed priceRange and discount info
    variantSummary.priceRange.min = minPrice;
    variantSummary.priceRange.max = maxPrice;
    variantSummary.priceRange.isSinglePrice =
      minPrice !== null && maxPrice !== null && minPrice === maxPrice;
    variantSummary.discount.hasDiscount = hasDiscount;
    variantSummary.discount.maxPercent = maxDiscountPercent;

    // Kiểm tra xem tất cả các biến thể có cùng mức giá hay không
    variantSummary.priceRange.isSinglePrice =
      variantSummary.priceRange.min === variantSummary.priceRange.max;
  }

  return variantSummary;
};

/**
 * Helper: Chuyển đổi dữ liệu sản phẩm cho Admin
 * - Giữ lại thông tin quản trị
 */
const transformProductForAdmin = (product) => {
  const productObj = product.toObject ? product.toObject() : { ...product };
  return productObj;
};

/**
 * Helper: Chuyển đổi dữ liệu sản phẩm cho Public
 * - Loại bỏ thông tin quản trị nhạy cảm
 *
 * WARNING: This function is SYNCHRONOUS and expects variants to already have
 * inventorySummary populated. Do NOT use this for data from DB queries.
 * Use it only AFTER variants have been processed with await calculateInventorySummary()
 */
const transformProductForPublic = (product) => {
  const productObj = product.toObject ? product.toObject() : { ...product };

  // Loại bỏ thông tin nhạy cảm, chỉ giữ lại những gì cần thiết cho client
  const publicData = {
    _id: productObj._id,
    name: productObj.name,
    slug: productObj.slug,
    description: productObj.description,
    category: productObj.category
      ? {
          _id: productObj.category._id,
          name: productObj.category.name,
        }
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
    images: Array.isArray(productObj.images) ? productObj.images : [],
    // rating và numReviews sẽ được tính toán hoặc gán từ bên ngoài
    rating: productObj.rating || 0,
    numReviews: productObj.numReviews || 0,
    averageRating: productObj.rating || 0, // Alias for compatibility
    reviewCount: productObj.numReviews || 0, // Alias for compatibility
    // stockStatus và totalQuantity sẽ được tính toán hoặc gán từ bên ngoài
    stockStatus: productObj.stockStatus || "out_of_stock",
    totalQuantity: productObj.totalQuantity || 0,
    isActive: productObj.isActive,
    createdAt: productObj.createdAt,
    isNew: false, // Calculate based on creation date if needed
  };

  // Xử lý variants cho public
  if (productObj.variants && productObj.variants.length > 0) {
    publicData.variants = productObj.variants
      .filter((v) => v.isActive)
      .map((variant) => {
        // FIXED: inventorySummary phải được populate TRƯỚC KHI gọi transform
        // Không thể gọi async function trong map() synchronous
        const inventorySummary = variant.inventorySummary || {
          totalQuantity: 0,
          availableSizes: 0,
          totalSizes: 0,
          stockStatus: "out_of_stock",
          sizeInventory: [],
          pricing: {
            minPrice: 0,
            maxPrice: 0,
            hasDiscount: false,
            maxDiscountPercent: 0,
            isSinglePrice: true,
          },
        };

        return {
          _id: variant._id,
          color: {
            _id: variant.color?._id,
            name: variant.color?.name,
            code: variant.color?.code,
            type: variant.color?.type,
            colors: variant.color?.colors || [],
          },
          // REMOVED: variant.price, variant.percentDiscount, variant.priceFinal đã xóa
          // Giá được lấy từ InventoryItem thông qua inventorySummary
          gender: variant.gender,
          images: variant.imagesvariant,
          inventorySummary,
          sizes: variant.sizes?.map((size) => ({
            _id: size._id,
            sizeInfo: size.size
              ? {
                  _id: size.size._id,
                  value: size.size.value,
                  description: size.size.description,
                }
              : null,
            quantity: size.quantity,
            sku: size.sku,
            isAvailable: size.isAvailable, // Fix: was size.isSizeAvailable
            isLowStock: size.isLowStock,
            isOutOfStock: size.isOutOfStock,
          })),
        };
      });

    // FIXED: Tính toán thông tin giá từ inventorySummary thay vì variant fields đã xóa
    const priceInfo = productObj.variants.reduce(
      (info, variant) => {
        // Lấy giá từ inventorySummary (được tính từ InventoryItem)
        const pricing = variant.inventorySummary?.pricing || {};
        const finalPrice = pricing.minPrice || 0;
        const originalPrice = pricing.maxPrice || finalPrice;
        const discount = 0; // Discount được tính trong InventoryItem

        if (!info.minPrice || (finalPrice > 0 && finalPrice < info.minPrice)) {
          info.minPrice = finalPrice;
          info.originalPrice = originalPrice;
          info.discountPercent = discount;
        }

        if (discount > info.maxDiscountPercent) {
          info.maxDiscountPercent = discount;
        }

        return info;
      },
      {
        minPrice: null,
        originalPrice: null,
        discountPercent: 0,
        maxDiscountPercent: 0,
      }
    );

    publicData.price = priceInfo.minPrice || 0;
    publicData.originalPrice = priceInfo.originalPrice || 0;
    publicData.discountPercent = priceInfo.discountPercent || 0;
    publicData.hasDiscount = (priceInfo.discountPercent || 0) > 0;
    publicData.maxDiscountPercent = priceInfo.maxDiscountPercent || 0;
    publicData.salePercentage = priceInfo.maxDiscountPercent || 0; // Alias for compatibility

    // Add priceRange for ProductCard compatibility
    publicData.priceRange = {
      min: priceInfo.minPrice || 0,
      max: Math.max(
        ...productObj.variants.map(
          (v) =>
            v.inventorySummary?.pricing?.maxPrice ||
            v.inventorySummary?.pricing?.minPrice ||
            0
        ),
        priceInfo.minPrice || 0
      ),
      isSinglePrice:
        productObj.variants.length === 1 ||
        productObj.variants.every(
          (v) =>
            (v.inventorySummary?.pricing?.minPrice || 0) ===
            (priceInfo.minPrice || 0)
        ),
    };

    // Tìm ảnh chính - handle cases where images might be undefined
    if (!publicData.images || publicData.images.length === 0) {
      const variantWithImages = productObj.variants.find(
        (v) => v.imagesvariant && v.imagesvariant.length > 0
      );

      if (variantWithImages) {
        const mainImage =
          variantWithImages.imagesvariant.find((img) => img.isMain) ||
          variantWithImages.imagesvariant[0];
        publicData.mainImage = mainImage?.url || "";
      }
    } else {
      const mainImage =
        publicData.images.find((img) => img.isMain) || publicData.images[0];
      publicData.mainImage = mainImage?.url || "";
    }
  } else {
    // No variants case - set default values
    publicData.variants = [];
    publicData.price = 0;
    publicData.originalPrice = 0;
    publicData.discountPercent = 0;
    publicData.hasDiscount = false;
    publicData.maxDiscountPercent = 0;
    publicData.salePercentage = 0;
    publicData.priceRange = {
      min: 0,
      max: 0,
      isSinglePrice: true,
    };
    publicData.mainImage = publicData.images?.[0]?.url || "";
  }

  return publicData;
};

/**
 * Helper: Chuyển đổi dữ liệu sản phẩm cho danh sách public
 * - Loại bỏ chi tiết variants, chỉ giữ thông tin tóm tắt
 */
const transformProductForPublicList = (product) => {
  const publicData = transformProductForPublic(product);

  // Với danh sách, loại bỏ chi tiết variants để giảm kích thước dữ liệu
  if (publicData.variants && publicData.variants.length > 0) {
    // Tạo variantSummary giống như API admin để đồng nhất
    publicData.variantSummary = createVariantSummary(product.variants);

    // Thêm thông tin tổng số lượng tồn kho
    publicData.totalInventory = publicData.variants.reduce((total, variant) => {
      return total + (variant.inventorySummary?.totalQuantity || 0);
    }, 0);

    delete publicData.variants;
  } else {
    // Nếu không có variants, tạo một variantSummary rỗng nhưng đầy đủ cấu trúc
    publicData.variantSummary = {
      total: 0,
      active: 0,
      colors: [],
      colorCount: 0,
      sizeCount: 0,
      priceRange: { min: null, max: null, isSinglePrice: true },
      discount: { hasDiscount: false, maxPercent: 0 },
    };
    publicData.totalInventory = 0;
  }

  return publicData;
};

/**
 * Helper tổng hợp thuộc tính sản phẩm
 * @param {Object} product - Sản phẩm đã được populate các thông tin liên quan
 */
const getProductAttributesHelper = async (product) => {
  // Kiểm tra nếu sản phẩm không có variants
  if (!product.variants || product.variants.length === 0) {
    return {
      colors: [],
      sizes: [],
      priceRange: { min: 0, max: 0 },
      genders: [],
      sizesCountByColor: {},
      sizeInventoryByColor: {},
      variantsByColor: {},
      inventoryMatrix: {
        colors: [],
        sizes: [],
        genders: [],
        stock: {},
      },
    };
  }

  // Trích xuất các màu sắc có sẵn cho sản phẩm
  const availableColors = {};
  const availableSizes = {};
  const availableGenders = new Set();
  const sizesCountByColor = {};
  const sizeInventoryByColor = {};
  const variantsByColor = {};
  const variantsByGender = {};
  const variantsByColorAndGender = {};

  // Phân loại variants theo màu sắc và kích thước
  product.variants.forEach((variant) => {
    // Bỏ qua nếu variant không có màu
    if (!variant.color) return;

    const colorId = variant.color._id.toString();
    const gender = variant.gender || "unisex";

    // Thêm gender vào danh sách
    availableGenders.add(gender);

    // Lưu thông tin màu
    if (!availableColors[colorId]) {
      availableColors[colorId] = variant.color;
    }

    // Phân loại variants theo giới tính
    if (!variantsByGender[gender]) {
      variantsByGender[gender] = [];
    }
    variantsByGender[gender].push(variant);

    // Phân loại variants theo màu
    if (!variantsByColor[colorId]) {
      variantsByColor[colorId] = [];
    }
    variantsByColor[colorId].push(variant);

    // Phân loại variants theo màu và giới tính
    const colorGenderKey = `${colorId}-${gender}`;
    if (!variantsByColorAndGender[colorGenderKey]) {
      variantsByColorAndGender[colorGenderKey] = [];
    }
    variantsByColorAndGender[colorGenderKey].push(variant);

    // Đếm số lượng sizes theo màu
    if (!sizesCountByColor[colorId]) {
      sizesCountByColor[colorId] = 0;
    }

    // Khởi tạo size inventory theo màu
    if (!sizeInventoryByColor[colorId]) {
      sizeInventoryByColor[colorId] = {};
    }

    // Lưu thông tin kích thước
    variant.sizes.forEach((sizeItem) => {
      if (sizeItem.size) {
        const sizeId = sizeItem.size._id.toString();

        if (!availableSizes[sizeId]) {
          availableSizes[sizeId] = sizeItem.size;
        }

        // Khởi tạo thông tin inventory cho size này
        if (!sizeInventoryByColor[colorId][sizeId]) {
          sizeInventoryByColor[colorId][sizeId] = {
            sizeId,
            sizeValue: sizeItem.size.value,
            sizeDescription: sizeItem.size.description || "",
            quantity: 0,
            isAvailable: false,
            variantId: variant._id.toString(),
            gender: gender,
          };
        }

        // Tăng số lượng kích thước có sẵn theo màu và cập nhật số lượng
        if (sizeItem.quantity > 0 && sizeItem.isAvailable) {
          // Fix: was sizeItem.isSizeAvailable
          sizesCountByColor[colorId]++;
          sizeInventoryByColor[colorId][sizeId].quantity += sizeItem.quantity;
          sizeInventoryByColor[colorId][sizeId].isAvailable = true;
        }
      }
    });
  });

  // Chuyển đổi dữ liệu sang mảng để trả về
  const colors = Object.values(availableColors);
  const sizes = Object.values(availableSizes);
  const genders = Array.from(availableGenders);

  // Lấy khoảng giá từ InventoryItem
  const inventoryService = require("@services/inventory.service");
  const productPricing = await inventoryService.getProductPricing(product._id);

  const priceRange = {
    min: productPricing.min || 0,
    max: productPricing.max || 0,
  };

  // Chuyển đổi sizeInventoryByColor từ object sang array
  const formattedSizeInventory = {};
  for (const [colorId, sizeMap] of Object.entries(sizeInventoryByColor)) {
    formattedSizeInventory[colorId] = Object.values(sizeMap);
  }

  // Tạo ma trận tồn kho theo màu, kích thước và giới tính
  const inventoryMatrix = {
    colors: colors.map((color) => ({
      id: color._id.toString(),
      name: color.name,
      code: color.code,
      type: color.type,
      colors: color.colors || [],
    })),
    sizes: sizes.map((size) => ({
      id: size._id.toString(),
      value: size.value,
      description: size.description || "",
    })),
    genders: genders.map((gender) => ({
      id: gender,
      name: gender === "male" ? "Nam" : gender === "female" ? "Nữ" : "Unisex",
    })),
    // Ma trận tồn kho: {gender: {colorId: {sizeId: {quantity, isAvailable, variantId, sku}}}}
    stock: {},
  };

  // Khởi tạo ma trận tồn kho
  genders.forEach((gender) => {
    inventoryMatrix.stock[gender] = {};

    colors.forEach((color) => {
      const colorId = color._id.toString();
      inventoryMatrix.stock[gender][colorId] = {};

      sizes.forEach((size) => {
        const sizeId = size._id.toString();
        // Mặc định số lượng là 0
        inventoryMatrix.stock[gender][colorId][sizeId] = {
          quantity: 0,
          isAvailable: false,
          variantId: null,
          sku: null,
        };
      });
    });
  });

  // Điền thông tin vào ma trận tồn kho
  product.variants.forEach((variant) => {
    if (!variant.color) return;

    const colorId = variant.color._id.toString();
    const gender = variant.gender || "unisex";
    const variantId = variant._id.toString();

    variant.sizes.forEach((sizeItem) => {
      if (!sizeItem.size) return;

      const sizeId = sizeItem.size._id.toString();
      const quantity = sizeItem.quantity || 0;
      const isAvailable = quantity > 0 && sizeItem.isAvailable; // Fix: was sizeItem.isSizeAvailable

      if (
        inventoryMatrix.stock[gender] &&
        inventoryMatrix.stock[gender][colorId] &&
        inventoryMatrix.stock[gender][colorId][sizeId]
      ) {
        inventoryMatrix.stock[gender][colorId][sizeId] = {
          quantity: quantity,
          isAvailable: isAvailable,
          variantId: variantId,
          sku: sizeItem.sku || null,
        };
      }
    });
  });

  // Thêm thông tin tổng hợp tồn kho
  inventoryMatrix.summary = {
    byGender: {},
    byColor: {},
    bySize: {},
    total: 0,
  };

  // Tính tổng số lượng tồn kho theo giới tính
  genders.forEach((gender) => {
    inventoryMatrix.summary.byGender[gender] = 0;

    colors.forEach((color) => {
      const colorId = color._id.toString();

      sizes.forEach((size) => {
        const sizeId = size._id.toString();
        const quantity =
          inventoryMatrix.stock[gender][colorId][sizeId].quantity;

        // Cộng dồn tổng số lượng
        inventoryMatrix.summary.byGender[gender] += quantity;
        inventoryMatrix.summary.total += quantity;

        // Tính tổng số lượng theo màu
        if (!inventoryMatrix.summary.byColor[colorId]) {
          inventoryMatrix.summary.byColor[colorId] = 0;
        }
        inventoryMatrix.summary.byColor[colorId] += quantity;

        // Tính tổng số lượng theo kích thước
        if (!inventoryMatrix.summary.bySize[sizeId]) {
          inventoryMatrix.summary.bySize[sizeId] = 0;
        }
        inventoryMatrix.summary.bySize[sizeId] += quantity;
      });
    });
  });

  return {
    colors,
    sizes,
    priceRange,
    genders: genders.map((gender) => ({
      id: gender,
      name: gender === "male" ? "Nam" : gender === "female" ? "Nữ" : "Unisex",
    })),
    sizesCountByColor,
    sizeInventoryByColor: formattedSizeInventory,
    variantsByColor,
    variantsByGender,
    inventoryMatrix, // Ma trận tồn kho mới
  };
};

const productService = {
  // === ADMIN API METHODS ===

  /**
   * [ADMIN] Lấy danh sách sản phẩm (có phân trang, filter) kèm thông tin tóm tắt về variants
   * @param {Object} query Tham số truy vấn
   */
  getAdminProducts: async (query) => {
    const {
      page = 1,
      limit = 50,
      name,
      category,
      brand,
      stockStatus,
      isActive,
      sort,
    } = query;

    const filter = { deletedAt: null }; // Mặc định chỉ lấy chưa xóa
    // Lọc theo tên
    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }
    // Lọc theo danh mục
    if (category) {
      filter.category = mongoose.Types.ObjectId.isValid(category)
        ? new mongoose.Types.ObjectId(String(category))
        : null;
    }

    // Lọc theo thương hiệu
    if (brand) {
      filter.brand = mongoose.Types.ObjectId.isValid(brand)
        ? new mongoose.Types.ObjectId(String(brand))
        : null;
    }

    // Không lọc theo stockStatus tại query level nữa vì field không còn
    // Sẽ lọc sau khi tính toán

    // Lọc theo trạng thái active
    if (isActive !== undefined) {
      filter.isActive = isActive === "true" || isActive === true;
    }

    const { sortOption, collation } = sort
      ? getSortOption(sort)
      : { sortOption: { createdAt: -1 }, collation: null };

    const options = {
      page,
      limit,
      sort: sortOption,
      collation: collation,
      populate: [
        { path: "category", select: "name" },
        { path: "brand", select: "name logo" },
        { path: "tags", select: "name type description" },
        // Populate variants với các trường cần thiết cho thông tin tóm tắt
        {
          path: "variants",
          select:
            "color sizes isActive price priceFinal percentDiscount gender",
          populate: [
            { path: "color", select: "name code type colors" },
            { path: "sizes.size", select: "value" },
          ],
        },
      ],
    };

    // Lấy kết quả từ database với variants được populate
    const results = await paginate(Product, filter, options);

    // Lấy thông tin tồn kho cho từng sản phẩm
    const inventoryService = require("@services/inventory.service");

    const productsWithStock = await Promise.all(
      results.data.map(async (product) => {
        const productObj = product.toObject
          ? product.toObject()
          : { ...product };

        // Tính toán stock info động
        const stockInfo = await inventoryService.getProductStockInfo(
          product._id
        );
        productObj.totalQuantity = stockInfo.totalQuantity;
        productObj.stockStatus = stockInfo.stockStatus;

        // Tính toán rating info động
        const reviewService = require("@services/review.service");
        const ratingInfo = await reviewService.getProductRatingInfo(
          product._id
        );
        productObj.rating = ratingInfo.rating;
        productObj.numReviews = ratingInfo.numReviews;

        // Thêm thông tin tóm tắt về variants
        productObj.variantSummary = createVariantSummary(productObj.variants);

        // Xóa chi tiết variants để giảm dung lượng dữ liệu
        delete productObj.variants;

        return productObj;
      })
    );

    // Lọc theo stockStatus nếu có (sau khi tính toán)
    let filteredData = productsWithStock;
    if (stockStatus) {
      filteredData = productsWithStock.filter(
        (p) => p.stockStatus === stockStatus
      );
    }

    return {
      ...results,
      data: filteredData,
      count: filteredData.length,
    };
  },

  /**
   * [ADMIN] Lấy chi tiết sản phẩm theo ID (kèm variants kể cả đã xóa)
   * @param {String} id ID của sản phẩm
   */
  getAdminProductById: async (id) => {
    // Đầu tiên tìm sản phẩm, bao gồm cả đã xóa mềm
    const product = await Product.findById(id)
      .populate("category", "name")
      .populate("brand", "name logo")
      .populate("tags", "name type description")
      .populate("deletedBy", "name email")
      .setOptions({ includeDeleted: true });

    if (!product) {
      throw new ApiError(404, "Không tìm thấy sản phẩm");
    }

    // Tìm tất cả variants của sản phẩm này, bao gồm cả đã xóa
    const variants = await Variant.find({ product: id })
      .populate("color", "name type code colors")
      .populate("sizes.size", "value type description")
      .populate("deletedBy", "firstName lastName email")
      .setOptions({ includeDeleted: true });

    // Gán variants vào product
    product.variants = variants;

    // Tạo thống kê về variants
    const variantStats = {
      total: variants.length,
      active: 0,
      inactive: 0,
      deleted: 0,
    };

    // Thống kê theo trạng thái
    variants.forEach((variant) => {
      if (variant.deletedAt) {
        variantStats.deleted++;

        // Thêm thông tin người xóa c
        if (variant.deletedBy) {
          variant._doc.deletedByInfo = {
            name: variant.deletedBy.name,
            email: variant.deletedBy.email,
          };
        }
      } else if (variant.isActive) {
        variantStats.active++;
      } else {
        variantStats.inactive++;
      }
    });

    // Chuyển đổi product và thêm thống kê
    const productData = transformProductForAdmin(product);
    productData.variantStats = variantStats;

    // Thêm trạng thái xóa
    productData.isDeleted = !!product.deletedAt;

    return {
      success: true,
      product: productData,
    };
  },

  /**
   * [ADMIN] Lấy danh sách sản phẩm đã xóa
   * @param {Object} query Tham số truy vấn
   */
  getDeletedProducts: async (query) => {
    const { page = 1, limit = 10, name, category, brand, sort } = query;

    const filter = {};

    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    if (category) {
      filter.category = mongoose.Types.ObjectId.isValid(category)
        ? new mongoose.Types.ObjectId(String(category))
        : null;
    }

    if (brand) {
      filter.brand = mongoose.Types.ObjectId.isValid(brand)
        ? new mongoose.Types.ObjectId(String(brand))
        : null;
    }

    const { sortOption, collation } = sort
      ? getSortOption(sort)
      : { sortOption: { deletedAt: -1 }, collation: null };

    const options = {
      page,
      limit,
      sort: sortOption,
      collation: collation,
      populate: [
        { path: "category", select: "name" },
        { path: "brand", select: "name" },
        { path: "deletedBy", select: "name email" },
      ],
    };

    const results = await paginateDeleted(Product, filter, options);

    // Xử lý thông tin tóm tắt cho các sản phẩm đã xóa
    results.data = results.data.map((product) => {
      const productObj = product.toObject ? product.toObject() : { ...product };

      // Thêm thông tin về người xóa nếu có
      if (productObj.deletedBy) {
        productObj.deletedByName = `${productObj.deletedBy.firstName || ""} ${
          productObj.deletedBy.lastName || ""
        }`.trim();
        productObj.deletedByEmail = productObj.deletedBy.email;
      }

      return productObj;
    });

    return results;
  },

  /**
   * Tạo sản phẩm mới
   * @param {Object} productData Thông tin sản phẩm
   */
  createProduct: async (productData) => {
    // Kiểm tra category và brand tồn tại
    const categoryExists = await Category.findById(productData.category);
    if (!categoryExists) {
      throw new ApiError(404, `Danh mục ${productData.category} không tồn tại`);
    }

    const brandExists = await Brand.findById(productData.brand);
    if (!brandExists) {
      throw new ApiError(404, `Thương hiệu ${productData.brand} không tồn tại`);
    }

    // Kiểm tra tags tồn tại (nếu có)
    if (productData.tags && Array.isArray(productData.tags)) {
      for (const tagId of productData.tags) {
        const tagExists = await Tag.findById(tagId);
        if (!tagExists) {
          throw new ApiError(404, `Tag ${tagId} không tồn tại`);
        }
      }
    }

    // Tạo slug từ tên sản phẩm (để kiểm tra trùng lặp)
    const potentialSlug = createSlug(productData.name);

    // Kiểm tra sản phẩm trùng lặp (bao gồm cả sản phẩm đã bị xóa mềm)
    const duplicateActiveProduct = await Product.findOne({
      name: productData.name,
      category: productData.category,
      brand: productData.brand,
      deletedAt: null,
    });

    if (duplicateActiveProduct) {
      throw new ApiError(
        409,
        `Đã tồn tại sản phẩm "${productData.name}" với thông tin này trong dữ liệu`
      );
    }

    // Kiểm tra slug bị trùng với sản phẩm đã bị xóa mềm
    const slugExists = await Product.findOne({
      slug: potentialSlug,
      deletedAt: { $ne: null },
    }).setOptions({ includeDeleted: true });

    if (slugExists) {
      throw new ApiError(
        409,
        `Không thể tạo sản phẩm với tên này vì trùng với sản phẩm đã xóa mềm "${slugExists.name}". Vui lòng sử dụng tên khác hoặc khôi phục sản phẩm đã xóa.`
      );
    }

    // Tạo sản phẩm mới
    const product = new Product({
      name: productData.name,
      description: productData.description,
      category: productData.category,
      brand: productData.brand,
      tags: productData.tags || [],
      isActive:
        productData.isActive !== undefined ? productData.isActive : true,
    });

    // Lưu sản phẩm - các middleware sẽ tự động tạo slug
    await product.save();

    return {
      success: true,
      message: "Tạo sản phẩm thành công",
      product: transformProductForAdmin(product),
    };
  },

  /**
   * Cập nhật thông tin sản phẩm
   * @param {String} id ID sản phẩm
   * @param {Object} updateData Dữ liệu cập nhật
   */
  updateProduct: async (id, updateData) => {
    const product = await Product.findById(id);
    if (!product) {
      throw new ApiError(404, `Không tìm thấy sản phẩm với ID: ${id}`);
    }

    // Kiểm tra nếu cập nhật category
    if (updateData.category) {
      const categoryExists = await Category.findById(updateData.category);
      if (!categoryExists) {
        throw new ApiError(
          404,
          `Danh mục ${updateData.category} không tồn tại`
        );
      }
    }

    // Kiểm tra nếu cập nhật brand
    if (updateData.brand) {
      const brandExists = await Brand.findById(updateData.brand);
      if (!brandExists) {
        throw new ApiError(
          404,
          `Thương hiệu ${updateData.brand} không tồn tại`
        );
      }
    }

    // Kiểm tra nếu cập nhật tags
    if (updateData.tags && Array.isArray(updateData.tags)) {
      for (const tagId of updateData.tags) {
        const tagExists = await Tag.findById(tagId);
        if (!tagExists) {
          throw new ApiError(404, `Tag ${tagId} không tồn tại`);
        }
      }
    }

    // Nếu đang cập nhật tên (sẽ ảnh hưởng đến slug)
    if (updateData.name && updateData.name !== product.name) {
      const potentialSlug = createSlug(updateData.name);

      // Kiểm tra slug bị trùng với bất kỳ sản phẩm nào (kể cả đã xóa mềm)
      const slugExists = await Product.findOne({
        slug: potentialSlug,
        _id: { $ne: id },
      }).setOptions({ includeDeleted: true });

      if (slugExists) {
        throw new ApiError(
          409,
          `Không thể đổi tên sản phẩm thành "${updateData.name}" vì sẽ tạo ra slug trùng với sản phẩm "${slugExists._id}"`
        );
      }
    }

    // Cập nhật các trường
    const allowedFields = [
      "name",
      "description",
      "category",
      "brand",
      "tags",
      "isActive",
    ];

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        product[key] = value;
      }
    }

    // Lưu sản phẩm - các middleware sẽ cập nhật slug nếu tên thay đổi
    await product.save();

    return {
      success: true,
      message: `Cập nhật sản phẩm với ID: ${product._id} thành công`,
      product: transformProductForAdmin(product),
    };
  },

  /**
   * Xóa sản phẩm hoặc vô hiệu hóa nếu liên quan đến đơn hàng
   * @param {String} id ID sản phẩm
   * @param {String} userId ID người thực hiện
   */
  deleteProduct: async (id, userId) => {
    const product = await Product.findById(id);
    if (!product) {
      throw new ApiError(404, `Không tìm thấy sản phẩm với ID: ${id}`);
    }

    // Kiểm tra xem sản phẩm có đang được sử dụng trong bất kỳ đơn hàng nào
    // Cần join qua variant vì orderItems không có trực tiếp product field
    const hasOrderItems = await Order.aggregate([
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
      { $match: { "variantData.product": new mongoose.Types.ObjectId(id) } },
      { $limit: 1 },
    ]);

    // Nếu có đơn hàng liên quan, chỉ vô hiệu hóa sản phẩm và các biến thể thay vì xóa
    if (hasOrderItems.length > 0) {
      // Vô hiệu hóa sản phẩm và các biến thể
      product.isActive = false;
      await product.save();
      await Variant.updateMany({ product: id }, { $set: { isActive: false } });

      return {
        success: true,
        message: `Sản phẩm với ID: ${product._id} đang được sử dụng trong đơn hàng nên đã được vô hiệu hóa`,
        isDeactivated: true,
      };
    }

    // Soft delete sản phẩm sử dụng plugin softDelete
    await product.softDelete(userId);

    // Vô hiệu hóa các variant liên quan thay vì xóa mềm
    await Variant.updateMany({ product: id }, { $set: { isActive: false } });

    return {
      success: true,
      message: `Xóa sản phẩm ID: ${product._id} thành công`,
      isDeleted: true,
    };
  },

  /**
   * Khôi phục sản phẩm đã xóa - với hỗ trợ khôi phục cascade
   * @param {String} id ID sản phẩm
   * @param {Boolean} restoreVariants Có khôi phục các variant không
   */
  restoreProduct: async (id, restoreVariants = true) => {
    // Khôi phục sản phẩm - middleware sẽ kiểm tra slug trùng lặp và tạo slug mới nếu cần
    const product = await Product.restoreById(id);
    if (!product) {
      throw new ApiError(
        404,
        `Không tìm thấy sản phẩm với ID: ${id} để khôi phục`
      );
    }

    // Kích hoạt trạng thái sản phẩm
    product.isActive = true;
    await product.save();

    let restoredVariants = 0;

    // CASCADE RESTORE: Khôi phục các biến thể liên quan
    if (restoreVariants) {
      // Lấy danh sách các biến thể đã xóa của sản phẩm này
      const deletedVariants = await Variant.find({
        product: id,
        deletedAt: { $ne: null },
      }).setOptions({ includeDeleted: true });

      // Khôi phục từng biến thể
      for (const variant of deletedVariants) {
        try {
          // Kiểm tra xem có biến thể trùng màu không
          const existingVariant = await Variant.findOne({
            product: id,
            color: variant.color,
            _id: { $ne: variant._id },
            deletedAt: null,
          });

          if (!existingVariant) {
            await Variant.findByIdAndUpdate(variant._id, {
              $set: {
                deletedAt: null,
                isActive: true,
              },
            });
            restoredVariants++;
          }
        } catch (error) {
          console.error(
            `Không thể khôi phục biến thể ${variant._id}:`,
            error.message
          );
        }
      }

      // Cập nhật thông tin tồn kho
      await updateProductStockInfo(product);
    }

    return {
      success: true,
      message: restoreVariants
        ? `Khôi phục sản phẩm thành công. Đã khôi phục ${restoredVariants} biến thể liên quan.`
        : "Khôi phục sản phẩm thành công mà không khôi phục các biến thể.",
      product: transformProductForAdmin(product),
      restoredVariants,
    };
  },

  /**
   * Cập nhật trạng thái active của sản phẩm
   * @param {String} id ID sản phẩm
   * @param {Boolean} isActive Trạng thái active
   * @param {Boolean} cascade Cập nhật cả variants
   */
  updateProductStatus: async (id, isActive, cascade = true) => {
    const product = await Product.findById(id);
    if (!product) {
      throw new ApiError(404, `Không tìm thấy sản phẩm với ID: ${id}`);
    }

    // Cập nhật trạng thái product
    product.isActive = isActive;
    await product.save();

    let affectedVariants = 0;

    // CASCADE: Chỉ cập nhật variants khi cascade = true
    if (cascade && product.variants?.length > 0) {
      const result = await Variant.updateMany(
        { product: id, deletedAt: null },
        { $set: { isActive: isActive } }
      );
      affectedVariants = result.modifiedCount;
    }

    const statusMsg = isActive ? "kích hoạt" : "vô hiệu hóa";
    return {
      success: true,
      message: cascade
        ? `Sản phẩm đã được ${statusMsg}. Đã ${statusMsg} ${affectedVariants} biến thể liên quan.`
        : `Sản phẩm đã được ${statusMsg} mà không ảnh hưởng đến biến thể.`,
      product: transformProductForAdmin(product),
    };
  },

  /**
   * Cập nhật trạng thái tồn kho của sản phẩm
   * @param {string} id - ID sản phẩm cần cập nhật
   * @returns {Promise<Object>} - Thông tin sản phẩm đã cập nhật
   */
  updateProductStockStatus: async (id) => {
    // Tìm sản phẩm với variants đã populate
    const product = await Product.findById(id).populate({
      path: "variants",
      select: "sizes",
      match: { deletedAt: null, isActive: true },
    });

    if (!product) {
      throw new ApiError(404, `Không tìm thấy sản phẩm với ID: ${id}`);
    }

    // Cập nhật thông tin tồn kho sử dụng hàm từ middleware
    await updateProductStockInfo(product);

    // Lấy sản phẩm đã cập nhật
    const updatedProduct = await Product.findById(id);
    return {
      success: true,
      message: `Cập nhật trạng thái tồn kho sản phẩm với ID: ${updatedProduct._id} thành công`,
      product: transformProductForAdmin(updatedProduct),
    };
  },

  // === PUBLIC API METHODS ===
  /**
   * [PUBLIC] Lấy danh sách sản phẩm (có phân trang, filter) với thông tin tóm tắt
   * @param {Object} query Tham số truy vấn
   * @return {Promise<Object>} Kết quả phân trang
   */
  getPublicProducts: async (query) => {
    const {
      page = 1,
      limit = 18,
      name,
      category,
      brand,
      minPrice,
      maxPrice,
      colors,
      sizes,
      gender,
      sort = "newest",
    } = query;

    // Chuyển đổi page và limit sang số
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 18;

    // Bắt đầu xây dựng pipeline aggregation
    const pipeline = [];

    // Stage 1: Lọc sản phẩm cơ bản
    const matchStage = {
      isActive: true,
      deletedAt: null,
    };

    if (name) {
      matchStage.name = { $regex: name, $options: "i" };
    }

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      matchStage.category = new mongoose.Types.ObjectId(String(category));
    }

    if (brand && mongoose.Types.ObjectId.isValid(brand)) {
      matchStage.brand = new mongoose.Types.ObjectId(String(brand));
    }

    pipeline.push({ $match: matchStage });

    // Stage 2: Lookup variants và chỉ lấy các variants active
    pipeline.push({
      $lookup: {
        from: "variants",
        let: { productId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$product", "$$productId"] },
              isActive: true,
              deletedAt: null,
            },
          },
        ],
        as: "activeVariants",
      },
    });

    // Stage 3: Filter theo các điều kiện variant (lọc nâng cao)
    if (
      minPrice !== undefined ||
      maxPrice !== undefined ||
      colors ||
      sizes ||
      gender
    ) {
      let variantMatch = { $and: [] };

      // Lọc theo giá
      if (minPrice !== undefined || maxPrice !== undefined) {
        const priceFilter = {};
        if (minPrice !== undefined) priceFilter.$gte = Number(minPrice);
        if (maxPrice !== undefined) priceFilter.$lte = Number(maxPrice);
        variantMatch.$and.push({ priceFinal: priceFilter });
      }

      // Lọc theo màu
      if (colors) {
        const colorIds = colors
          .split(",")
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));
        if (colorIds.length > 0) {
          variantMatch.$and.push({ color: { $in: colorIds } });
        }
      }

      // Lọc theo size
      if (sizes) {
        const sizeIds = sizes
          .split(",")
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));
        if (sizeIds.length > 0) {
          variantMatch.$and.push({ "sizes.size": { $in: sizeIds } });
        }
      }

      // Lọc theo gender
      if (gender && ["male", "female"].includes(gender)) {
        variantMatch.$and.push({ gender: gender });
      }

      // Thêm pipeline lọc biến thể
      if (variantMatch.$and.length > 0) {
        pipeline.push({
          $addFields: {
            filteredVariants: {
              $filter: {
                input: "$activeVariants",
                as: "variant",
                cond: {
                  $and: variantMatch.$and.map((condition) => {
                    // Chuyển đổi điều kiện cho $filter
                    return Object.entries(condition).reduce(
                      (result, [key, value]) => {
                        if (key === "priceFinal") {
                          // ✅ REMOVED: variant.priceFinal không tồn tại
                          // Price filtering được xử lý riêng thông qua InventoryItem
                          // Skip price condition trong variant filter
                          // (Price range filter được handle bởi filter.service.js)
                        } else if (key === "color") {
                          result = {
                            ...result,
                            $in: ["$$variant.color", value.$in],
                          };
                        } else if (key === "sizes.size") {
                          // Đối với sizes cần logic khác
                          result = {
                            $gt: [
                              {
                                $size: {
                                  $filter: {
                                    input: "$$variant.sizes",
                                    as: "size",
                                    cond: { $in: ["$$size.size", value.$in] },
                                  },
                                },
                              },
                              0,
                            ],
                          };
                        } else {
                          result = {
                            ...result,
                            $eq: ["$$variant." + key, value],
                          };
                        }
                        return result;
                      },
                      {}
                    );
                  }),
                },
              },
            },
          },
        });
      } else {
        pipeline.push({
          $addFields: {
            filteredVariants: "$activeVariants",
          },
        });
      }
    } else {
      // Nếu không có lọc nâng cao, tất cả variants đều phù hợp
      pipeline.push({
        $addFields: {
          filteredVariants: "$activeVariants",
        },
      });
    }

    // Stage 4: Chỉ giữ lại sản phẩm có ít nhất 1 variant thỏa mãn điều kiện
    pipeline.push({
      $match: {
        "filteredVariants.0": { $exists: true },
      },
    }); // Stage 5: Project để giữ các trường cần thiết và tính giá min/max
    pipeline.push({
      $project: {
        _id: 1,
        name: 1,
        slug: 1,
        description: 1,
        category: 1,
        brand: 1,
        isActive: 1,
        // REMOVED: rating, numReviews - fields không tồn tại trong Product schema
        stockStatus: 1,
        totalQuantity: 1,
        images: 1,
        createdAt: 1,
        filteredVariantsCount: { $size: "$filteredVariants" },
        // REMOVED: Không thể tính price từ variant.priceFinal (field đã xóa)
        // Price sẽ được tính sau từ InventoryItem cho mỗi product
        filteredVariants: 1, // Giữ lại để dùng sau này
      },
    });

    // Sắp xếp
    let sortOption = { createdAt: -1 }; // Mặc định theo mới nhất
    switch (sort) {
      case "price-asc":
        // CHANGED: Sort by createdAt vì không có minPrice trong schema
        sortOption = { createdAt: 1 }; // Fallback: sắp xếp theo thời gian
        break;
      case "price-desc":
        // CHANGED: Sort by createdAt vì không có maxPrice trong schema
        sortOption = { createdAt: -1 }; // Fallback: sắp xếp theo thời gian mới nhất
        break;
      case "popular":
        sortOption = { totalQuantity: -1 };
        break;
      case "rating":
        // CHANGED: rating field không tồn tại, sort by totalQuantity thay thế
        sortOption = { totalQuantity: -1 }; // Fallback: sản phẩm bán chạy
        break;
    }

    sortOption._id = 1; // Đảm bảo sắp xếp ổn định
    pipeline.push({ $sort: sortOption });

    // Tạo pipeline đếm tổng
    const countPipeline = [...pipeline];
    countPipeline.push({ $count: "total" });

    // Thêm phân trang vào pipeline chính
    pipeline.push({ $skip: (pageNum - 1) * limitNum });
    pipeline.push({ $limit: limitNum });

    // Thêm lookup để lấy đầy đủ thông tin
    pipeline.push(
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "brands",
          localField: "brand",
          foreignField: "_id",
          as: "brand",
        },
      },
      { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } }
    );

    // Lookup variants chi tiết cho display
    pipeline.push({
      $lookup: {
        from: "variants",
        let: { productId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$product", "$$productId"] },
              isActive: true,
              deletedAt: null,
            },
          },
          {
            $lookup: {
              from: "colors",
              localField: "color",
              foreignField: "_id",
              as: "color",
            },
          },
          { $unwind: { path: "$color", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "sizes",
              localField: "sizes.size",
              foreignField: "_id",
              as: "allSizes",
            },
          },
          {
            $addFields: {
              sizes: {
                $map: {
                  input: "$sizes",
                  as: "sizeItem",
                  in: {
                    _id: "$$sizeItem._id",
                    size: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$allSizes",
                            as: "s",
                            cond: { $eq: ["$$s._id", "$$sizeItem.size"] },
                          },
                        },
                        0,
                      ],
                    },
                    quantity: "$$sizeItem.quantity",
                    sku: "$$sizeItem.sku",
                    // REMOVED: isSizeAvailable - field không còn tồn tại trong Variant schema
                    // Availability sẽ được tính từ InventoryItem sau aggregation
                  },
                },
              },
            },
          },
          { $project: { allSizes: 0 } },
        ],
        as: "variants",
      },
    });

    // Thực hiện aggregation
    const [countResult, products] = await Promise.all([
      Product.aggregate(countPipeline),
      Product.aggregate(pipeline),
    ]);

    const totalCount = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / limitNum));

    // Chuyển đổi kết quả và tính stock info động
    const inventoryService = require("@services/inventory.service");
    const reviewService = require("@services/review.service");
    const variantService = require("@services/variant.service");
    const transformedData = await Promise.all(
      products.map(async (product) => {
        // Bỏ trường trung gian
        delete product.filteredVariantsCount;
        delete product.filteredVariants;
        delete product.minPrice;
        delete product.maxPrice;

        // Tính stock info động từ InventoryItem
        const stockInfo = await inventoryService.getProductStockInfo(
          product._id
        );
        product.totalQuantity = stockInfo.totalQuantity;
        product.stockStatus = stockInfo.stockStatus;

        // Tính rating info động từ Review
        const ratingInfo = await reviewService.getProductRatingInfo(
          product._id
        );
        // FIXED: Gán vào temporary fields cho transform function (không lưu vào DB)
        const productWithRating = product.toObject
          ? product.toObject()
          : { ...product };
        productWithRating.rating = ratingInfo.rating;
        productWithRating.numReviews = ratingInfo.numReviews;

        // ✅ CRITICAL FIX: Tính inventorySummary cho mỗi variant trước khi transform
        if (
          productWithRating.variants &&
          productWithRating.variants.length > 0
        ) {
          productWithRating.variants = await Promise.all(
            productWithRating.variants.map(async (variant) => {
              const inventorySummary =
                await variantService.calculateInventorySummary(variant);
              return {
                ...variant,
                inventorySummary,
              };
            })
          );
        }

        // Sử dụng hàm chuyển đổi hiện có
        return transformProductForPublicList(productWithRating);
      })
    );

    return {
      success: true,
      count: transformedData.length,
      total: totalCount,
      totalPages: totalPages,
      currentPage: pageNum,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
      data: transformedData,
    };
  },

  /**
   * [PUBLIC] Lấy chi tiết sản phẩm theo ID
   * @param {String} id ID của sản phẩm
   */
  getPublicProductById: async (id) => {
    const product = await Product.findOne({
      _id: id,
      isActive: true,
      deletedAt: null,
    }).populate([
      {
        path: "category",
        select: "name slug",
        match: { isActive: true, deletedAt: null },
      },
      {
        path: "brand",
        select: "name logo slug",
        match: { isActive: true, deletedAt: null },
      },
      {
        path: "variants",
        match: { isActive: true, deletedAt: null },
        select: "color gender imagesvariant sizes",
        populate: [
          { path: "color", select: "name code type colors" },
          { path: "sizes.size", select: "value description" },
        ],
      },
    ]);

    if (!product) {
      throw new ApiError(404, `Không tìm thấy sản phẩm`);
    }

    // GET INVENTORY DATA FOR ALL VARIANTS
    const inventoryService = require("@services/inventory.service");
    const inventoryDataPromises = product.variants.map(async (variant) => {
      const pricing = await inventoryService.getVariantPricing(variant._id);
      return {
        variantId: variant._id.toString(),
        pricing: pricing.pricing,
        quantities: pricing.quantities,
        hasInventory: pricing.hasInventory,
      };
    });
    const inventoryData = await Promise.all(inventoryDataPromises);

    // MAP INVENTORY DATA TO VARIANTS
    product.variants = product.variants.map((v) => {
      const variantObj = v.toObject ? v.toObject() : { ...v };
      const inventory = inventoryData.find(
        (i) => i.variantId === variantObj._id.toString()
      );

      // Map sizes with inventory quantities
      const sizesWithInventory = variantObj.sizes.map((size) => {
        const sizeInventory = inventory?.quantities?.find(
          (q) => q.sizeId.toString() === size.size._id.toString()
        );
        return {
          size: size.size,
          quantity: sizeInventory?.quantity || 0,
          isAvailable: sizeInventory?.isAvailable || false,
          isLowStock: sizeInventory?.isLowStock || false,
          isOutOfStock: sizeInventory?.isOutOfStock || true,
          sku: sizeInventory?.sku || null,
        };
      });

      // Add pricing from inventory
      return {
        ...variantObj,
        sizes: sizesWithInventory,
        price: inventory?.pricing?.calculatedPrice || 0,
        priceFinal: inventory?.pricing?.calculatedPriceFinal || 0,
        percentDiscount: inventory?.pricing?.percentDiscount || 0,
      };
    });

    // ✅ CRITICAL FIX: Tính inventorySummary cho mỗi variant trước khi transform
    const variantService = require("@services/variant.service");
    product.variants = await Promise.all(
      product.variants.map(async (variant) => {
        const inventorySummary = await variantService.calculateInventorySummary(
          variant
        );
        return {
          ...variant,
          inventorySummary,
        };
      })
    );

    // Tính toán ma trận tồn kho và thông tin cơ bản
    const productAttributes = await getProductAttributesHelper(product);

    // Xử lý thông tin sản phẩm
    const publicProduct = transformProductForPublic(product);

    // Tạo collection ảnh từ tất cả các biến thể
    const variantImages = {};

    // Tạo thông tin biến thể
    const variantsInfo = {};

    // Nhóm ảnh theo màu sắc và giới tính
    if (product.variants && product.variants.length > 0) {
      product.variants.forEach((variant) => {
        const colorId = variant.color?._id?.toString();
        const gender = variant.gender;
        const variantId = variant._id.toString();

        if (!colorId) return;

        // Tạo khóa cho màu và giới tính
        const key = `${gender}-${colorId}`;

        // Chuẩn bị thông tin sizes với số lượng (Fix CRITICAL Bug)
        const sizesWithQuantity = variant.sizes.map((size) => {
          return {
            sizeId: size.size?._id?.toString(),
            sizeValue: size.size?.value,
            sizeDescription: size.size?.description,
            quantity: size.quantity,
            sku: size.sku,
            isAvailable: size.isAvailable, //  FIXED: was size.isSizeAvailable
            isLowStock: size.isLowStock, // ADDED: expose low stock status
            isOutOfStock: size.isOutOfStock, //  ADDED: expose out of stock status
            // CRITICAL FIX: Add pricing information from InventoryItem
            price: variant.price || 0, // calculatedPrice from inventory
            finalPrice: variant.priceFinal || 0, // calculatedPriceFinal from inventory
            discountPercent: variant.percentDiscount || 0, // percentDiscount from inventory
          };
        });

        // Lưu thông tin biến thể với sizes đầy đủ - getPublicProductById
        variantsInfo[key] = {
          id: variantId,
          colorId: colorId,
          colorName: variant.color?.name || "",
          gender: gender,
          // ✅ REMOVED: variant.price, variant.priceFinal, variant.percentDiscount đã xóa
          // Giá được lấy từ InventoryItem trong sizesWithQuantity
          sizes: sizesWithQuantity, // Thêm thông tin sizes chi tiết (có price từ InventoryItem)
          totalQuantity: sizesWithQuantity.reduce(
            (sum, size) => sum + (size.quantity || 0),
            0
          ),
        };

        if (!variantImages[key]) {
          variantImages[key] = [];
        }

        // Thêm ảnh của biến thể vào collection
        if (variant.imagesvariant && variant.imagesvariant.length > 0) {
          // Sắp xếp ảnh với ảnh chính đầu tiên, sau đó theo displayOrder
          const sortedImages = [...variant.imagesvariant].sort((a, b) => {
            if (a.isMain && !b.isMain) return -1;
            if (!a.isMain && b.isMain) return 1;
            return a.displayOrder - b.displayOrder;
          });

          variantImages[key] = sortedImages.map((img) => ({
            url: img.url,
            public_id: img.public_id,
            isMain: img.isMain,
            gender: variant.gender,
            colorId: colorId,
            colorName: variant.color?.name || "",
            variantId: variantId,
          }));
        }
      });
    }

    // Nếu không có ảnh biến thể nào, thêm ảnh sản phẩm vào một key mặc định
    if (
      Object.keys(variantImages).length === 0 &&
      publicProduct.images &&
      publicProduct.images.length > 0
    ) {
      variantImages["default"] = publicProduct.images.map((img) => ({
        url: img.url,
        public_id: img.public_id,
        isMain: img.isMain,
        isProductImage: true,
      }));
    }

    // Tối ưu dữ liệu trả về - chỉ giữ lại cấu trúc cần thiết
    const optimizedAttributes = {
      // Danh sách tham khảo đơn giản
      colors: productAttributes.colors,
      sizes: productAttributes.sizes,
      genders: productAttributes.genders,
      priceRange: productAttributes.priceRange,

      // Ma trận tồn kho (chứa tất cả thông tin cần thiết)
      inventoryMatrix: productAttributes.inventoryMatrix,
    };

    // Thêm thông tin tổng hợp quan trọng, bỏ các giá trị dễ tính từ client
    const summary = {
      totalInventory: productAttributes.inventoryMatrix.summary.total,
      priceRange: productAttributes.priceRange,
      stockStatus: publicProduct.stockStatus,
    };

    // Tính toán stock info động từ InventoryItem
    const stockInfo = await inventoryService.getProductStockInfo(product._id);
    publicProduct.totalQuantity = stockInfo.totalQuantity;
    publicProduct.stockStatus = stockInfo.stockStatus;
    summary.stockStatus = stockInfo.stockStatus;

    // Tính toán rating info động từ Review
    const reviewService = require("@services/review.service");
    const ratingInfo = await reviewService.getProductRatingInfo(product._id);
    publicProduct.rating = ratingInfo.rating;
    publicProduct.numReviews = ratingInfo.numReviews;
    publicProduct.averageRating = ratingInfo.rating;
    publicProduct.reviewCount = ratingInfo.numReviews;

    return {
      success: true,
      product: publicProduct,
      attributes: optimizedAttributes,
      summary: summary,
      images: variantImages,
      variants: variantsInfo, // Thêm thông tin biến thể với sizes chi tiết
    };
  },

  /**
   * [PUBLIC] Lấy chi tiết sản phẩm theo slug
   * @param {String} slug Slug của sản phẩm
   */
  getPublicProductBySlug: async (slug) => {
    const product = await Product.findOne({
      slug,
      isActive: true,
      deletedAt: null,
    }).populate([
      {
        path: "category",
        select: "name slug",
        match: { isActive: true, deletedAt: null },
      },
      {
        path: "brand",
        select: "name logo slug",
        match: { isActive: true, deletedAt: null },
      },
      {
        path: "variants",
        match: { isActive: true, deletedAt: null },
        select: "color gender imagesvariant sizes",
        populate: [
          { path: "color", select: "name code type colors" },
          { path: "sizes.size", select: "value description" },
        ],
      },
    ]);

    if (!product) {
      throw new ApiError(404, `Không tìm thấy sản phẩm`);
    }

    // GET INVENTORY DATA FOR ALL VARIANTS
    const inventoryService = require("@services/inventory.service");
    const inventoryDataPromises = product.variants.map(async (variant) => {
      const pricing = await inventoryService.getVariantPricing(variant._id);
      return {
        variantId: variant._id.toString(),
        pricing: pricing.pricing,
        quantities: pricing.quantities,
        hasInventory: pricing.hasInventory,
      };
    });
    const inventoryData = await Promise.all(inventoryDataPromises);

    // MAP INVENTORY DATA TO VARIANTS
    product.variants = product.variants.map((v) => {
      const variantObj = v.toObject ? v.toObject() : { ...v };
      const inventory = inventoryData.find(
        (i) => i.variantId === variantObj._id.toString()
      );

      // Map sizes with inventory quantities
      const sizesWithInventory = variantObj.sizes.map((size) => {
        const sizeInventory = inventory?.quantities?.find(
          (q) => q.sizeId.toString() === size.size._id.toString()
        );
        return {
          size: size.size,
          quantity: sizeInventory?.quantity || 0,
          isAvailable: sizeInventory?.isAvailable || false,
          isLowStock: sizeInventory?.isLowStock || false, // Added
          isOutOfStock: sizeInventory?.isOutOfStock || true, // Added
          sku: sizeInventory?.sku || null,
        };
      });

      // Add pricing from inventory
      return {
        ...variantObj,
        sizes: sizesWithInventory,
        price: inventory?.pricing?.calculatedPrice || 0,
        priceFinal: inventory?.pricing?.calculatedPriceFinal || 0,
        percentDiscount: inventory?.pricing?.percentDiscount || 0,
      };
    });

    //  CRITICAL FIX: Tính inventorySummary cho mỗi variant trước khi transform
    const variantService = require("@services/variant.service");
    product.variants = await Promise.all(
      product.variants.map(async (variant) => {
        const inventorySummary = await variantService.calculateInventorySummary(
          variant
        );
        return {
          ...variant,
          inventorySummary,
        };
      })
    );

    // Tính toán ma trận tồn kho và thông tin cơ bản
    const productAttributes = await getProductAttributesHelper(product);

    // Xử lý thông tin sản phẩm
    const publicProduct = transformProductForPublic(product);

    // Tạo collection ảnh từ tất cả các biến thể
    const variantImages = {};

    // Tạo thông tin biến thể
    const variantsInfo = {};

    // Nhóm ảnh theo màu sắc và giới tính
    if (product.variants && product.variants.length > 0) {
      product.variants.forEach((variant) => {
        const colorId = variant.color?._id?.toString();
        const gender = variant.gender;
        const variantId = variant._id.toString();

        if (!colorId) return;

        // Tạo khóa cho màu và giới tính
        const key = `${gender}-${colorId}`;

        // Chuẩn bị thông tin sizes với số lượng (Fix CRITICAL Bug)
        const sizesWithQuantity = variant.sizes.map((size) => {
          return {
            sizeId: size.size?._id?.toString(),
            sizeValue: size.size?.value,
            sizeDescription: size.size?.description,
            quantity: size.quantity,
            sku: size.sku,
            isAvailable: size.isAvailable, // FIXED: was size.isSizeAvailable
            isLowStock: size.isLowStock, // ADDED
            isOutOfStock: size.isOutOfStock, // ADDED
            // ✅ CRITICAL FIX: Add pricing information from InventoryItem
            price: variant.price || 0, // calculatedPrice from inventory
            finalPrice: variant.priceFinal || 0, // calculatedPriceFinal from inventory
            discountPercent: variant.percentDiscount || 0, // percentDiscount from inventory
          };
        });

        // Lưu thông tin biến thể với sizes đầy đủ - getPublicProductBySlug
        variantsInfo[key] = {
          id: variantId,
          colorId: colorId,
          colorName: variant.color?.name || "",
          gender: gender,
          // REMOVED: variant.price, variant.priceFinal, variant.percentDiscount đã xóa
          // Giá được lấy từ InventoryItem trong sizesWithQuantity
          sizes: sizesWithQuantity, // Thêm thông tin sizes chi tiết (có price từ InventoryItem)
          totalQuantity: sizesWithQuantity.reduce(
            (sum, size) => sum + (size.quantity || 0),
            0
          ),
        };

        if (!variantImages[key]) {
          variantImages[key] = [];
        }

        // Thêm ảnh của biến thể vào collection
        if (variant.imagesvariant && variant.imagesvariant.length > 0) {
          // Sắp xếp ảnh với ảnh chính đầu tiên, sau đó theo displayOrder
          const sortedImages = [...variant.imagesvariant].sort((a, b) => {
            if (a.isMain && !b.isMain) return -1;
            if (!a.isMain && b.isMain) return 1;
            return a.displayOrder - b.displayOrder;
          });

          variantImages[key] = sortedImages.map((img) => ({
            url: img.url,
            public_id: img.public_id,
            isMain: img.isMain,
            gender: variant.gender,
            colorId: colorId,
            colorName: variant.color?.name || "",
            variantId: variantId,
          }));
        }
      });
    }

    // Nếu không có ảnh biến thể nào, thêm ảnh sản phẩm vào một key mặc định
    if (
      Object.keys(variantImages).length === 0 &&
      publicProduct.images &&
      publicProduct.images.length > 0
    ) {
      variantImages["default"] = publicProduct.images.map((img) => ({
        url: img.url,
        public_id: img.public_id,
        isMain: img.isMain,
        isProductImage: true,
      }));
    }

    // Tối ưu dữ liệu trả về - chỉ giữ lại cấu trúc cần thiết
    const optimizedAttributes = {
      // Danh sách tham khảo đơn giản
      colors: productAttributes.colors,
      sizes: productAttributes.sizes,
      genders: productAttributes.genders,
      priceRange: productAttributes.priceRange,

      // Ma trận tồn kho (chứa tất cả thông tin cần thiết)
      inventoryMatrix: productAttributes.inventoryMatrix,
    };

    // Thêm thông tin tổng hợp quan trọng, bỏ các giá trị dễ tính từ client
    const summary = {
      totalInventory: productAttributes.inventoryMatrix.summary.total, // FIXED TYPO: was totalInventity
      priceRange: productAttributes.priceRange,
      stockStatus: publicProduct.stockStatus,
    };

    // Tính toán stock info động từ InventoryItem
    const stockInfo = await inventoryService.getProductStockInfo(product._id);
    publicProduct.totalQuantity = stockInfo.totalQuantity;
    publicProduct.stockStatus = stockInfo.stockStatus;
    summary.stockStatus = stockInfo.stockStatus;

    // Tính toán rating info động từ Review
    const reviewService = require("@services/review.service");
    const ratingInfo = await reviewService.getProductRatingInfo(product._id);
    publicProduct.rating = ratingInfo.rating;
    publicProduct.numReviews = ratingInfo.numReviews;
    publicProduct.averageRating = ratingInfo.rating;
    publicProduct.reviewCount = ratingInfo.numReviews;

    return {
      success: true,
      product: publicProduct,
      attributes: optimizedAttributes,
      summary: summary,
      images: variantImages,
      variants: variantsInfo, // Thêm thông tin biến thể với sizes chi tiết
    };
  },

  /**
   * [PUBLIC] Lấy sản phẩm nổi bật (theo rating cao)
   * @param {Number} limit Số lượng sản phẩm trả về
   */
  getFeaturedProducts: async (limit = 20) => {
    // FIXED: Product.rating/numReviews đã bị xóa - không thể query/sort trực tiếp
    // Lấy tất cả sản phẩm active, sau đó tính rating động và sort trong memory
    const products = await Product.find({
      isActive: true,
      deletedAt: null,
    })
      .limit(Number(limit) * 3) // Lấy nhiều hơn để filter sau
      // EMOVED: .sort({ rating: -1, numReviews: -1 }) - fields không tồn tại
      .populate("category", "name")
      .populate("brand", "name logo")
      .populate("tags", "name type description")
      .populate({
        path: "variants",
        match: { isActive: true, deletedAt: null },
        // REMOVED: price, priceFinal, percentDiscount - fields đã xóa - getFeaturedProducts
        select: "color imagesvariant sizes isActive gender",
        populate: [
          { path: "color", select: "name code type colors" },
          { path: "sizes.size", select: "value description" },
        ],
      });

    // Lọc bỏ các sản phẩm không có variants hợp lệ
    const filteredProducts = products.filter(
      (product) => product.variants && product.variants.length > 0
    );

    // Giới hạn số lượng sản phẩm trả về theo limit
    const limitedProducts = filteredProducts.slice(0, Number(limit));

    // Tính stock info và rating info cho từng sản phẩm
    const inventoryService = require("@services/inventory.service");
    const reviewService = require("@services/review.service");
    const variantService = require("@services/variant.service");
    const productsWithStockAndRating = await Promise.all(
      limitedProducts.map(async (product) => {
        const productObj = product.toObject
          ? product.toObject()
          : { ...product };

        // Tính stock info
        const stockInfo = await inventoryService.getProductStockInfo(
          product._id
        );
        productObj.totalQuantity = stockInfo.totalQuantity;
        productObj.stockStatus = stockInfo.stockStatus;

        // Tính rating info
        const ratingInfo = await reviewService.getProductRatingInfo(
          product._id
        );
        productObj.rating = ratingInfo.rating;
        productObj.numReviews = ratingInfo.numReviews;
        productObj.averageRating = ratingInfo.rating;
        productObj.reviewCount = ratingInfo.numReviews;

        // CRITICAL FIX: Tính inventorySummary cho mỗi variant để có priceRange
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

        return transformProductForPublicList(productObj);
      })
    );

    const result = {
      success: true,
      products: productsWithStockAndRating,
    };

    return result;
  },

  /**
   * [PUBLIC] Lấy sản phẩm mới nhất
   * @param {Number} limit Số lượng sản phẩm trả về
   */
  getNewArrivals: async (limit = 20) => {
    // Lấy sản phẩm mới nhất đang active và không bị xóa mềm
    const products = await Product.find({
      isActive: true,
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .limit(Number(limit)) // Lấy nhiều hơn để lọc nếu không đủ sau khi filter
      .populate("category", "name")
      .populate("brand", "name logo")
      .populate("tags", "name type description")
      .populate({
        path: "variants",
        match: { isActive: true, deletedAt: null },
        // REMOVED: price, priceFinal, percentDiscount - fields đã xóa - getNewArrivals
        select: "color imagesvariant sizes isActive gender",
        populate: [
          { path: "color", select: "name code type colors" },
          { path: "sizes.size", select: "value description" },
        ],
      });

    // Lọc bỏ các sản phẩm không có variants hợp lệ
    const filteredProducts = products.filter(
      (product) => product.variants && product.variants.length > 0
    );

    // Giới hạn số lượng sản phẩm trả về theo limit
    const limitedProducts = filteredProducts.slice(0, Number(limit));

    // Tính stock info và rating info cho từng sản phẩm
    const inventoryService = require("@services/inventory.service");
    const reviewService = require("@services/review.service");
    const variantService = require("@services/variant.service");
    const productsWithStockAndRating = await Promise.all(
      limitedProducts.map(async (product) => {
        const productObj = product.toObject
          ? product.toObject()
          : { ...product };

        // Tính stock info
        const stockInfo = await inventoryService.getProductStockInfo(
          product._id
        );
        productObj.totalQuantity = stockInfo.totalQuantity;
        productObj.stockStatus = stockInfo.stockStatus;

        // Tính rating info
        const ratingInfo = await reviewService.getProductRatingInfo(
          product._id
        );
        productObj.rating = ratingInfo.rating;
        productObj.numReviews = ratingInfo.numReviews;
        productObj.averageRating = ratingInfo.rating;
        productObj.reviewCount = ratingInfo.numReviews;

        // CRITICAL FIX: Tính inventorySummary cho mỗi variant để có priceRange
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

        return transformProductForPublicList(productObj);
      })
    );

    const result = {
      success: true,
      products: productsWithStockAndRating,
    };

    return result;
  },

  /**
   * [PUBLIC] Lấy sản phẩm bán chạy (dựa trên tổng số lượng đã bán từ đơn hàng)
   * @param {Number} limit Số lượng sản phẩm trả về
   */
  getBestSellers: async (limit = 20) => {
    try {
      // 1. Tính tổng số lượng biến thể đã bán từ các đơn hàng đã giao thành công
      const variantSales = await Order.aggregate([
        // Chỉ lấy đơn hàng đã giao thành công (trạng thái delivered)
        {
          $match: {
            status: "delivered", // Chỉ tính đơn hàng hoàn tất giao dịch
          },
        },
        // Tách mỗi sản phẩm trong orderItems thành một document riêng
        { $unwind: "$orderItems" },
        // Nhóm theo variant và tính tổng số lượng đã bán
        {
          $group: {
            _id: "$orderItems.variant", // Thay đổi từ product sang variant
            totalSold: { $sum: "$orderItems.quantity" },
          },
        },
        // Sắp xếp theo số lượng bán giảm dần
        { $sort: { totalSold: -1 } },
        // Giới hạn số lượng kết quả
        { $limit: Number(limit) * 2 }, // Lấy nhiều hơn để lọc sản phẩm không hợp lệ
      ]);

      if (variantSales.length === 0) {
        // Nếu không có dữ liệu bán hàng, lấy sản phẩm mới nhất thay thế
        return await productService.getNewArrivals(limit);
      }

      // 2. Lấy thông tin product từ variant
      const Variant = mongoose.model("Variant");
      const variantIds = variantSales
        .filter((item) => item._id !== null && item._id !== undefined)
        .map((item) => item._id);

      // Lấy thông tin variant kèm product
      const variants = await Variant.find({
        _id: { $in: variantIds },
        isActive: true,
        deletedAt: null,
      }).select("product");

      // Tạo map lưu tổng số lượng bán của từng variant
      const variantSalesMap = {};
      variantSales.forEach((item) => {
        if (item._id) {
          // Kiểm tra null/undefined
          variantSalesMap[item._id.toString()] = item.totalSold;
        }
      });

      // Tạo map từ variant sang product và tính tổng số lượng bán cho mỗi product
      const productSalesMap = {};
      variants.forEach((variant) => {
        if (variant.product) {
          const productId = variant.product.toString();
          const variantId = variant._id.toString();
          const soldCount = variantSalesMap[variantId] || 0;

          if (!productSalesMap[productId]) {
            productSalesMap[productId] = 0;
          }
          productSalesMap[productId] += soldCount;
        }
      });

      // Chuyển map thành mảng để sắp xếp
      const productSales = Object.entries(productSalesMap).map(
        ([productId, totalSold]) => ({
          _id: productId,
          totalSold,
        })
      );

      // Sắp xếp theo số lượng bán giảm dần
      productSales.sort((a, b) => b.totalSold - a.totalSold);

      // Lấy danh sách ID product - SỬA DÒNG GÂY LỖI Ở ĐÂY
      const productIds = productSales.map(
        (item) => new mongoose.Types.ObjectId(item._id)
      );

      if (productIds.length === 0) {
        // Nếu không có sản phẩm hợp lệ, trả về danh sách trống
        return { success: true, products: [] };
      }

      // 3. Lấy thông tin chi tiết của những sản phẩm bán chạy
      const products = await Product.find({
        _id: { $in: productIds },
        isActive: true,
        deletedAt: null,
      })
        .populate("category", "name")
        .populate("brand", "name logo")
        .populate("tags", "name type description")
        .populate({
          path: "variants",
          match: { isActive: true, deletedAt: null },
          // REMOVED: price, priceFinal, percentDiscount - fields đã xóa - getBestSellingProducts
          select: "color imagesvariant sizes isActive gender",
          populate: [
            { path: "color", select: "name code type colors" },
            { path: "sizes.size", select: "value description" },
          ],
        });

      // Lọc bỏ các sản phẩm không có variants hợp lệ
      const filteredProducts = products.filter(
        (product) => product.variants && product.variants.length > 0
      );

      // 4. Sắp xếp lại đúng thứ tự theo số lượng bán
      const sortedProducts = filteredProducts.sort((a, b) => {
        const aSold = productSalesMap[a._id.toString()] || 0;
        const bSold = productSalesMap[b._id.toString()] || 0;
        return bSold - aSold;
      });

      // Giới hạn số lượng sản phẩm trả về theo limit
      const limitedProducts = sortedProducts.slice(0, Number(limit));

      // 5. Chuyển đổi và trả về kết quả
      const inventoryService = require("@services/inventory.service");
      const reviewService = require("@services/review.service");
      const variantService = require("@services/variant.service");

      const transformedProducts = await Promise.all(
        limitedProducts.map(async (product) => {
          const productObj = product.toObject
            ? product.toObject()
            : { ...product };

          // Tính stock info
          const stockInfo = await inventoryService.getProductStockInfo(
            product._id
          );
          productObj.totalQuantity = stockInfo.totalQuantity;
          productObj.stockStatus = stockInfo.stockStatus;

          // Tính rating info
          const ratingInfo = await reviewService.getProductRatingInfo(
            product._id
          );
          productObj.rating = ratingInfo.rating;
          productObj.numReviews = ratingInfo.numReviews;
          productObj.averageRating = ratingInfo.rating;
          productObj.reviewCount = ratingInfo.numReviews;

          // ✅ CRITICAL FIX: Tính inventorySummary cho mỗi variant để có priceRange
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

          const transformedProduct = transformProductForPublicList(productObj);
          // Thêm thông tin số lượng đã bán vào kết quả để frontend có thể hiển thị
          transformedProduct.totalSold =
            productSalesMap[product._id.toString()] || 0;
          return transformedProduct;
        })
      );

      const result = {
        success: true,
        products: transformedProducts,
      };

      return result;
    } catch (error) {
      console.error("Lỗi khi lấy sản phẩm bán chạy:", error);
      return {
        success: false,
        error: error.message,
        products: [],
      };
    }
  },

  /**
   * [PUBLIC] Lấy sản phẩm liên quan (cùng danh mục) chỉ lấy các sản phẩm có biến thể hoạt động
   * @param {String} id ID sản phẩm
   * @param {Number} limit Số lượng sản phẩm trả về
   */
  getRelatedProducts: async (id, limit = 20) => {
    const product = await Product.findById(id);
    if (!product) {
      throw new ApiError(404, `Không tìm thấy sản phẩm`);
    }

    // 1. Lấy các sản phẩm cùng danh mục, sắp xếp theo rating
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: id },
      isActive: true,
      deletedAt: null,
    })
      .sort({ rating: -1 })
      .populate("category", "name")
      .populate("brand", "name logo")
      .populate("tags", "name type description")
      .populate({
        path: "variants",
        match: { isActive: true, deletedAt: null },
        // REMOVED: price, priceFinal, percentDiscount - fields đã xóa - getRelatedProducts
        select: "color imagesvariant sizes isActive gender",
        populate: [
          { path: "color", select: "name code type colors" },
          { path: "sizes.size", select: "value description" },
        ],
      });

    // 2. Chỉ giữ các sản phẩm có ít nhất một biến thể hoạt động
    const filteredProducts = relatedProducts.filter(
      (p) => Array.isArray(p.variants) && p.variants.length > 0
    );

    // 3. Giới hạn số lượng sản phẩm trả về
    const limitedProducts = filteredProducts.slice(0, Number(limit));

    // 4. Chuyển đổi và trả về kết quả
    const result = {
      success: true,
      products: limitedProducts.map(transformProductForPublicList),
    };

    return result;
  },
};

module.exports = productService;
