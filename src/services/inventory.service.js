const {
  InventoryItem,
  InventoryTransaction,
  Variant,
  Product,
  Color,
  Size,
} = require("../models");
const ApiError = require("../utils/ApiError");
const { generateSKU } = require("../utils/skuGenerator");

/**
 * DEPRECATED - Variant không còn lưu quantity
 * InventoryItem là single source of truth
 */
const syncInventoryToVariant = async (inventoryItem) => {
  return;
};

/**
 * Tính giá bán từ giá vốn
 * @param {Number} costPrice - Giá nhập
 * @param {Number} targetProfitPercent - % Lợi nhuận mong muốn (0-1000)
 * @param {Number} percentDiscount - % Giảm giá (0-100)
 * @returns {Object} { calculatedPrice, calculatedPriceFinal, profitPerItem, margin, markup }
 *
 * Formula:
 * - basePrice = costPrice × (1 + targetProfitPercent/100)
 * - finalPrice = basePrice × (1 - percentDiscount/100)
 * - profit = finalPrice - costPrice
 * - margin = (profit / finalPrice) × 100
 * - markup = (profit / costPrice) × 100
 */
const calculatePrice = (
  costPrice,
  targetProfitPercent,
  percentDiscount = 0
) => {
  const basePrice = costPrice * (1 + targetProfitPercent / 100);
  const finalPrice = basePrice * (1 - percentDiscount / 100);
  const profitPerItem = finalPrice - costPrice;
  const margin = (profitPerItem / finalPrice) * 100;
  const markup = (profitPerItem / costPrice) * 100;

  return {
    calculatedPrice: Math.round(basePrice),
    calculatedPriceFinal: Math.round(finalPrice),
    profitPerItem: Math.round(profitPerItem),
    margin: parseFloat(margin.toFixed(2)),
    markup: parseFloat(markup.toFixed(2)),
  };
};

/**
 * Lấy hoặc tạo InventoryItem
 * Unique constraint: product + variant + size
 * Auto generate SKU nếu chưa có
 * @param {ObjectId} product - Product ID
 * @param {ObjectId} variant - Variant ID
 * @param {ObjectId} size - Size ID
 * @returns {InventoryItem}
 */
const getOrCreateInventoryItem = async (product, variant, size) => {
  console.log("===== getOrCreateInventoryItem DEBUG =====");
  console.log("Received product:", product);
  console.log("Received variant:", variant);
  console.log("Received size:", size);

  let inventoryItem = await InventoryItem.findOne({
    product,
    variant,
    size,
  });

  if (!inventoryItem) {
    const [productDoc, variantDoc, sizeDoc] = await Promise.all([
      Product.findById(product).select("name"),
      Variant.findById(variant)
        .populate("color", "name")
        .select("gender color"),
      Size.findById(size).select("value").setOptions({ includeDeleted: true }),
    ]);

    console.log("Found productDoc:", productDoc);
    console.log("Found variantDoc:", variantDoc);
    console.log("Found sizeDoc:", sizeDoc);

    if (!productDoc || !variantDoc || !sizeDoc) {
      throw new ApiError(404, "Không tìm thấy thông tin product/variant/size");
    }

    const sku = generateSKU({
      productName: productDoc.name,
      colorName: variantDoc.color?.name || "Unknown",
      gender: variantDoc.gender,
      sizeValue: sizeDoc.value,
      productId: product.toString(),
    });

    inventoryItem = await InventoryItem.create({
      product,
      variant,
      size,
      sku,
      quantity: 0,
      costPrice: 0,
      averageCostPrice: 0,
    });

    await syncSKUToVariant(variant, size, sku);
  }

  return inventoryItem;
};

/**
 * Đồng bộ SKU lên Variant.sizes[].sku
 * @param {ObjectId} variantId
 * @param {ObjectId} sizeId
 * @param {String} sku
 */
const syncSKUToVariant = async (variantId, sizeId, sku) => {
  try {
    const variant = await Variant.findById(variantId);
    if (!variant) return;

    const sizeIndex = variant.sizes.findIndex(
      (s) => s.size.toString() === sizeId.toString()
    );

    if (sizeIndex === -1) return;

    variant.sizes[sizeIndex].sku = sku;
    await variant.save();
  } catch (error) {
    console.error("Error syncing SKU:", error.message);
  }
};

/**
 * NHẬP KHO (Stock In)
 * - Tăng số lượng tồn kho
 * - Tính weighted average cost
 * - Tính giá bán (basePrice, finalPrice, profit, margin, markup)
 * - Tạo InventoryTransaction (type: IN)
 * - Cập nhật Product.totalQuantity và stockStatus
 *
 * @param {Object} data - { product, variant, size, quantity, costPrice, targetProfitPercent, percentDiscount, reason, notes }
 * @param {ObjectId} performedBy - User ID thực hiện
 * @returns {Object} { inventoryItem, transaction, priceCalculation }
 */
const stockIn = async (data, performedBy) => {
  const {
    product,
    variant,
    size,
    quantity,
    costPrice,
    targetProfitPercent = 30,
    percentDiscount = 0,
    reason = "restock",
    notes,
  } = data;

  // FIXED: VALIDATE costPrice - Tránh lỗi weighted average cost
  if (!costPrice || costPrice <= 0) {
    throw new ApiError(
      400,
      "Giá nhập (costPrice) phải lớn hơn 0. Vui lòng kiểm tra lại."
    );
  }

  if (typeof costPrice !== "number" || isNaN(costPrice)) {
    throw new ApiError(400, "Giá nhập (costPrice) phải là một số hợp lệ");
  }

  // Validate quantity
  if (!quantity || quantity <= 0) {
    throw new ApiError(400, "Số lượng nhập (quantity) phải lớn hơn 0");
  }

  const inventoryItem = await getOrCreateInventoryItem(product, variant, size);

  const quantityBefore = inventoryItem.quantity;
  const quantityAfter = quantityBefore + quantity;

  const totalCost = costPrice * quantity;
  const previousTotalCost = inventoryItem.averageCostPrice * quantityBefore;
  const newAverageCostPrice =
    quantityAfter > 0 ? (previousTotalCost + totalCost) / quantityAfter : 0;

  const priceCalculation = calculatePrice(
    costPrice,
    targetProfitPercent,
    percentDiscount
  );

  inventoryItem.quantity = quantityAfter;
  inventoryItem.costPrice = costPrice;
  inventoryItem.averageCostPrice = newAverageCostPrice;
  inventoryItem.sellingPrice = priceCalculation.calculatedPrice;
  inventoryItem.discountPercent = percentDiscount;
  inventoryItem.finalPrice = priceCalculation.calculatedPriceFinal;
  inventoryItem.lastPriceUpdate = new Date();
  await inventoryItem.save();

  const transaction = await InventoryTransaction.create({
    type: "IN",
    inventoryItem: inventoryItem._id,
    quantityBefore,
    quantityChange: quantity,
    quantityAfter,
    costPrice,
    totalCost,
    targetProfitPercent,
    percentDiscount,
    ...priceCalculation,
    reason,
    performedBy,
    notes,
  });

  await updateProductStockFromInventory(product);

  return {
    inventoryItem: await inventoryItem.populate("product variant size"),
    transaction,
    priceCalculation,
  };
};

/**
 * XUẤT KHO (Stock Out)
 * - Kiểm tra số lượng tồn kho đủ không
 * - Kiểm tra duplicate transaction (nếu có reference là orderId)
 * - Trừ số lượng
 * - Tạo InventoryTransaction (type: OUT)
 * - Cập nhật Product.totalQuantity và stockStatus
 *
 * Use cases:
 * - Auto: Gán shipper cho order (reason: "sale")
 * - Manual: Xuất hàng hư hỏng, mất mát (reason: "damage")
 *
 * @param {Object} data - { product, variant, size, quantity, reason, reference, notes }
 * @param {ObjectId} performedBy - User ID thực hiện
 * @returns {Object} { inventoryItem, transaction }
 */
const stockOut = async (data, performedBy) => {
  const {
    product,
    variant,
    size,
    quantity,
    reason = "sale",
    reference,
    notes,
  } = data;

  if (quantity <= 0) {
    throw new ApiError(400, "Số lượng xuất phải lớn hơn 0");
  }

  const inventoryItem = await InventoryItem.findOne({
    product,
    variant,
    size,
  });

  if (!inventoryItem) {
    throw new ApiError(404, "Không tìm thấy sản phẩm trong kho");
  }

  if (inventoryItem.quantity < quantity) {
    throw new ApiError(
      400,
      `Không đủ hàng trong kho. Hiện có: ${inventoryItem.quantity}, yêu cầu: ${quantity}`
    );
  }

  // KIỂM TRA DUPLICATE TRANSACTION (nếu có reference là orderId)
  if (reference) {
    const existingTransaction = await InventoryTransaction.findOne({
      inventoryItem: inventoryItem._id,
      type: "OUT",
      reason,
      reference,
    });

    if (existingTransaction) {
      throw new ApiError(
        409,
        `Giao dịch xuất kho cho đơn hàng này đã tồn tại (Transaction ID: ${existingTransaction._id})`
      );
    }
  }

  const quantityBefore = inventoryItem.quantity;
  const quantityAfter = quantityBefore - quantity;

  inventoryItem.quantity = quantityAfter;
  await inventoryItem.save();

  await syncInventoryToVariant(inventoryItem);

  const transaction = await InventoryTransaction.create({
    type: "OUT",
    inventoryItem: inventoryItem._id,
    quantityBefore,
    quantityChange: -quantity,
    quantityAfter,
    costPrice: inventoryItem.averageCostPrice,
    totalCost: inventoryItem.averageCostPrice * quantity,
    reason,
    reference,
    performedBy,
    notes,
  });

  await updateProductStockFromInventory(product);

  return {
    inventoryItem: await inventoryItem.populate("product variant size"),
    transaction,
  };
};

/**
 * ĐIỀU CHỈNH KHO (Adjust Stock)
 * - Đặt số lượng mới trực tiếp (không cộng/trừ)
 * - Tạo InventoryTransaction (type: ADJUST)
 * - quantityChange có thể dương (tăng) hoặc âm (giảm)
 *
 * Use cases:
 * - Kiểm kê định kỳ
 * - Sửa sai số liệu
 * - Hàng hư hỏng/mất mát
 *
 * @param {Object} data - { product, variant, size, newQuantity, reason, notes }
 * @param {ObjectId} performedBy - User ID thực hiện
 * @returns {Object} { inventoryItem, transaction }
 */
const adjustStock = async (data, performedBy) => {
  const {
    product,
    variant,
    size,
    newQuantity,
    reason = "adjustment",
    notes,
  } = data;

  const inventoryItem = await getOrCreateInventoryItem(product, variant, size);

  const quantityBefore = inventoryItem.quantity;
  const quantityChange = newQuantity - quantityBefore;

  inventoryItem.quantity = newQuantity;
  await inventoryItem.save();

  await syncInventoryToVariant(inventoryItem);

  const transaction = await InventoryTransaction.create({
    type: "ADJUST",
    inventoryItem: inventoryItem._id,
    quantityBefore,
    quantityChange,
    quantityAfter: newQuantity,
    costPrice: inventoryItem.averageCostPrice,
    totalCost: inventoryItem.averageCostPrice * Math.abs(quantityChange),
    reason,
    performedBy,
    notes,
  });

  await updateProductStockFromInventory(product);

  return {
    inventoryItem: await inventoryItem.populate("product variant size"),
    transaction,
  };
};

/**
 * Lấy danh sách tồn kho với filter và phân trang
 * @param {Object} filter - (deprecated, không dùng)
 * @param {Object} options - { page, limit, sortBy, sortOrder, product, lowStock, outOfStock }
 * @returns {Object} { items, pagination: { total, page, limit, totalPages } }
 */
const getInventoryList = async (filter = {}, options = {}) => {
  const {
    page = 1,
    limit = 20,
    sortBy = "updatedAt",
    sortOrder = "desc",
    product,
    lowStock,
    outOfStock,
  } = options;

  const query = {};

  if (product) {
    query.product = product;
  }

  if (lowStock) {
    query.$expr = { $lte: ["$quantity", "$lowStockThreshold"] };
  }

  if (outOfStock) {
    query.quantity = 0;
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

  const [items, total] = await Promise.all([
    InventoryItem.find(query)
      .populate("product variant size")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    InventoryItem.countDocuments(query),
  ]);

  return {
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Lấy thông tin chi tiết một InventoryItem
 * @param {ObjectId} id - InventoryItem ID
 * @returns {Object} InventoryItem (populated với product, variant, size)
 * @throws {ApiError} 404 nếu không tìm thấy
 */
const getInventoryById = async (id) => {
  const inventory = await InventoryItem.findById(id).populate(
    "product variant size"
  );

  if (!inventory) {
    throw new ApiError(404, "Không tìm thấy mục tồn kho");
  }

  return inventory;
};

/**
 * CẬP NHẬT NGƯỠNG CẢNH BÁO HẾT HÀNG
 * - Sửa lowStockThreshold cho một InventoryItem
 * - Mặc định: 10
 *
 * @param {ObjectId} id - InventoryItem ID
 * @param {Number} lowStockThreshold - Ngưỡng cảnh báo mới
 * @returns {Object} InventoryItem đã cập nhật
 * @throws {ApiError} 404 nếu không tìm thấy
 */
const updateLowStockThreshold = async (id, lowStockThreshold) => {
  const inventory = await InventoryItem.findById(id);

  if (!inventory) {
    throw new ApiError(404, "Không tìm thấy mục tồn kho");
  }

  inventory.lowStockThreshold = lowStockThreshold;
  await inventory.save();

  return inventory;
};

/**
 * LỊCH SỬ GIAO DỊCH KHO HÀNG
 * - Lấy danh sách InventoryTransaction
 * - Filter theo: type (IN/OUT/ADJUST), productId, variantId, sizeId, inventoryItem, startDate, endDate
 *
 * Logic filter productId/variantId/sizeId:
 * 1. Tìm các InventoryItem phù hợp
 * 2. Lấy transactions có inventoryItem.$in
 *
 * @param {Object} options - { page, limit, sortBy, sortOrder, type, productId, variantId, sizeId, inventoryItem, startDate, endDate }
 * @returns {Object} { transactions, pagination: { total, page, limit, totalPages } }
 */
const getTransactionHistory = async (options = {}) => {
  const {
    page = 1,
    limit = 50,
    sortBy = "createdAt",
    sortOrder = "desc",
    type,
    productId,
    variantId,
    sizeId,
    inventoryItem,
    startDate,
    endDate,
  } = options;

  const query = {};

  if (type) {
    query.type = type;
  }

  if (inventoryItem) {
    query.inventoryItem = inventoryItem;
  } else if (productId || variantId || sizeId) {
    const inventoryQuery = {};
    if (productId) inventoryQuery.product = productId;
    if (variantId) inventoryQuery.variant = variantId;
    if (sizeId) inventoryQuery.size = sizeId;

    const inventoryItems = await InventoryItem.find(inventoryQuery).select(
      "_id"
    );
    const inventoryItemIds = inventoryItems.map((item) => item._id);

    if (inventoryItemIds.length > 0) {
      query.inventoryItem = { $in: inventoryItemIds };
    } else {
      return {
        transactions: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
    }
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

  const [transactions, total] = await Promise.all([
    InventoryTransaction.find(query)
      .populate({
        path: "inventoryItem",
        populate: "product variant size",
      })
      .populate("performedBy", "name email")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    InventoryTransaction.countDocuments(query),
  ]);

  return {
    transactions,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * THỐNG KÊ TỒN KHO - DASHBOARD ADMIN
 * - Tổng số InventoryItem
 * - Số lượng sắp hết hàng (quantity ≤ lowStockThreshold)
 * - Số lượng hết hàng (quantity = 0)
 * - Tổng giá trị kho (quantity * averageCostPrice)
 *
 * @returns {Object} { totalItems, lowStockItems, outOfStockItems, totalValue }
 */
const getInventoryStats = async () => {
  const [totalItems, lowStockItems, outOfStockItems, totalValue] =
    await Promise.all([
      InventoryItem.countDocuments(),
      InventoryItem.countDocuments({
        $expr: { $lte: ["$quantity", "$lowStockThreshold"] },
      }),
      InventoryItem.countDocuments({ quantity: 0 }),
      InventoryItem.aggregate([
        {
          $group: {
            _id: null,
            total: {
              $sum: { $multiply: ["$quantity", "$averageCostPrice"] },
            },
          },
        },
      ]),
    ]);

  return {
    totalItems,
    lowStockItems,
    outOfStockItems,
    totalValue: totalValue[0]?.total || 0,
  };
};

/**
 * LẤY PRICING CHO MỘT SIZE CỦA VARIANT
 * - Tìm InventoryItem theo variantId + sizeId
 * - Trả về: quantity, cost, pricing từ transaction mới nhất (type: IN)
 *
 * @param {ObjectId} variantId - Variant ID
 * @param {ObjectId} sizeId - Size ID
 * @returns {Object|null} { quantity, costPrice, averageCostPrice, price, pricing }
 */
const getVariantSizePricing = async (variantId, sizeId) => {
  const inventoryItem = await InventoryItem.findOne({
    variant: variantId,
    size: sizeId,
  });

  if (!inventoryItem) {
    return null;
  }

  const latestTransaction = await InventoryTransaction.findOne({
    inventoryItem: inventoryItem._id,
    type: "IN",
  }).sort({ createdAt: -1 });

  if (!latestTransaction) {
    return {
      quantity: inventoryItem.quantity,
      costPrice: inventoryItem.costPrice,
      averageCostPrice: inventoryItem.averageCostPrice,
      price: null,
      priceFinal: null,
      percentDiscount: 0,
    };
  }

  return {
    quantity: inventoryItem.quantity,
    costPrice: inventoryItem.costPrice,
    averageCostPrice: inventoryItem.averageCostPrice,
    price: latestTransaction.calculatedPrice,
    priceFinal: latestTransaction.calculatedPriceFinal,
    percentDiscount: latestTransaction.percentDiscount,
    profitPerItem: latestTransaction.profitPerItem,
    margin: latestTransaction.margin,
    markup: latestTransaction.markup,
  };
};

/**
 * LẤY PRICING CHO TOÀN BỘ PRODUCT
 * - Tìm tất cả InventoryItem có quantity > 0 thuộc product
 * - Lấy giá từ transaction mới nhất (type: IN) của mỗi item
 * - Trả về: min, max, hasStock, itemsCount
 *
 * @param {ObjectId} productId - Product ID
 * @returns {Object} { min, max, hasStock, itemsCount }
 */
const getProductPricing = async (productId) => {
  const inventoryItems = await InventoryItem.find({
    product: productId,
    quantity: { $gt: 0 },
  });

  if (inventoryItems.length === 0) {
    return {
      min: 0,
      max: 0,
      hasStock: false,
    };
  }

  const pricePromises = inventoryItems.map(async (item) => {
    const latestTransaction = await InventoryTransaction.findOne({
      inventoryItem: item._id,
      type: "IN",
    }).sort({ createdAt: -1 });

    return latestTransaction?.calculatedPriceFinal || 0;
  });

  const prices = (await Promise.all(pricePromises)).filter((p) => p > 0);

  if (prices.length === 0) {
    return {
      min: 0,
      max: 0,
      hasStock: true,
      itemsCount: inventoryItems.length,
    };
  }

  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    hasStock: true,
    itemsCount: inventoryItems.length,
  };
};

/**
 * CẬP NHẬT Product.totalQuantity VÀ Product.stockStatus
 * - Gọi middleware updateProductStockInfo()
 * - Tự động chạy sau mỗi stockIn/stockOut/adjustStock
 *
 * @param {ObjectId} productId - Product ID
 */
const updateProductStockFromInventory = async (productId) => {
  const Product = require("../models").Product;
  const { updateProductStockInfo } = require("../models/product/middlewares");

  await updateProductStockInfo(productId);
};

/**
 * TÍNH TOÁN THÔNG TIN TỒN KHO CỦA PRODUCT
 * - Aggregate tổng quantity từ tất cả InventoryItem của product
 * - Xác định stockStatus: out_of_stock / low_stock / in_stock
 *
 * Thresholds:
 * - out_of_stock: totalQuantity = 0
 * - low_stock: totalQuantity > 0 && totalQuantity <= 10
 * - in_stock: totalQuantity > 10
 *
 * @param {ObjectId} productId - Product ID
 * @returns {Object} { totalQuantity, stockStatus }
 */
const getProductStockInfo = async (productId) => {
  const mongoose = require("mongoose");

  const result = await InventoryItem.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
      },
    },
    {
      $group: {
        _id: "$product",
        totalQuantity: { $sum: "$quantity" },
      },
    },
  ]);

  const totalQuantity = result.length > 0 ? result[0].totalQuantity : 0;

  let stockStatus = "out_of_stock";
  if (totalQuantity > 0) {
    const hasLowStock = await InventoryItem.exists({
      product: productId,
      $expr: { $lte: ["$quantity", "$lowStockThreshold"] },
      quantity: { $gt: 0 },
    });

    stockStatus = hasLowStock ? "low_stock" : "in_stock";
  }

  return { totalQuantity, stockStatus };
};

/**
 * LẤY PRICING VÀ QUANTITIES CHO TOÀN BỘ VARIANT
 * - Tìm tất cả InventoryItem thuộc variant
 * - Pricing: Lấy từ item đầu tiên (sellingPrice, discountPercent, finalPrice)
 * - Quantities: Array { sizeId, sizeValue, quantity, isAvailable, isLowStock, isOutOfStock }
 *
 * Use case: ProductDetail page - hiển thị giá và size picker
 *
 * @param {ObjectId} variantId - Variant ID
 * @returns {Object} { pricing, quantities, hasInventory }
 */
const getVariantPricing = async (variantId) => {
  const inventoryItems = await InventoryItem.find({
    variant: variantId,
  }).populate("size", "value description");

  if (!inventoryItems || inventoryItems.length === 0) {
    return {
      pricing: {
        sellingPrice: 0,
        discountPercent: 0,
        finalPrice: 0,
        calculatedPrice: 0,
        calculatedPriceFinal: 0,
        percentDiscount: 0,
      },
      quantities: [],
      hasInventory: false,
    };
  }

  const firstItem = inventoryItems[0];
  const pricing = {
    sellingPrice: firstItem.sellingPrice || 0,
    discountPercent: firstItem.discountPercent || 0,
    finalPrice: firstItem.finalPrice || 0,
    calculatedPrice: firstItem.sellingPrice || 0,
    calculatedPriceFinal: firstItem.finalPrice || 0,
    percentDiscount: firstItem.discountPercent || 0,
  };

  const quantities = inventoryItems.map((item) => ({
    sizeId: item.size._id,
    sizeValue: item.size.value || "",
    sizeDescription: item.size.description || "",
    quantity: item.quantity || 0,
    isAvailable: item.quantity > 0,
    isLowStock: item.isLowStock,
    isOutOfStock: item.isOutOfStock,
    sku: item.sku || "",
  }));

  return {
    pricing,
    quantities,
    hasInventory: true,
  };
};

module.exports = {
  calculatePrice,
  stockIn,
  stockOut,
  adjustStock,
  getInventoryList,
  getInventoryById,
  updateLowStockThreshold,
  getTransactionHistory,
  getInventoryStats,
  syncInventoryToVariant,
  getOrCreateInventoryItem,
  getVariantSizePricing,
  getVariantPricing,
  getProductPricing,
  updateProductStockFromInventory,
  getProductStockInfo,
};
