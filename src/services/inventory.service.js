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
 * Đồng bộ số lượng từ InventoryItem sang Variant.sizes[].quantity
 * DEPRECATED: Field variant.sizes[].quantity đã bị xóa khỏi schema
 * InventoryItem là single source of truth cho quantity
 * Function này giữ lại để tránh break code nhưng không làm gì
 */
const syncInventoryToVariant = async (inventoryItem) => {
  // DEPRECATED: Không còn sync quantity sang Variant schema
  // InventoryItem.quantity là single source of truth
  // Variant.sizes chỉ lưu reference đến Size, không lưu quantity

  console.log(
    `[DEPRECATED] syncInventoryToVariant called but skipped - InventoryItem is single source of truth`
  );
  return;

  /* ORIGINAL LOGIC - COMMENTED OUT
  try {
    const variant = await Variant.findById(inventoryItem.variant);
    if (!variant) {
      console.error(`Variant not found: ${inventoryItem.variant}`);
      return;
    }

    // Tìm size trong variant.sizes
    const sizeIndex = variant.sizes.findIndex(
      (s) => s.size.toString() === inventoryItem.size.toString()
    );

    if (sizeIndex === -1) {
      console.error(`Size not found in variant: ${inventoryItem.size}`);
      return;
    }

    // Cập nhật quantity
    variant.sizes[sizeIndex].quantity = inventoryItem.quantity;
    await variant.save();

    console.log(
      `Synced inventory: Variant ${variant._id}, Size ${inventoryItem.size}, Quantity: ${inventoryItem.quantity}`
    );
  } catch (error) {
    console.error("Error syncing inventory to variant:", error);
  }
  */
};

/**
 * Tính toán giá bán dựa trên giá nhập và % lợi nhuận
 */
const calculatePrice = (
  costPrice,
  targetProfitPercent,
  percentDiscount = 0
) => {
  // 1. Giá bán gốc = giá nhập + % lợi nhuận
  const basePrice = costPrice * (1 + targetProfitPercent / 100);

  // 2. Giá sau giảm = giá gốc - % giảm giá
  const finalPrice = basePrice * (1 - percentDiscount / 100);

  // 3. Lợi nhuận thực tế
  const profitPerItem = finalPrice - costPrice;

  // 4. Tỷ lệ margin (% lợi nhuận trên giá bán)
  const margin = (profitPerItem / finalPrice) * 100;

  // 5. Tỷ lệ markup (% lợi nhuận trên giá vốn)
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
 */
const getOrCreateInventoryItem = async (product, variant, size) => {
  let inventoryItem = await InventoryItem.findOne({
    product,
    variant,
    size,
  });

  if (!inventoryItem) {
    // Lấy thông tin để generate SKU
    const [productDoc, variantDoc, sizeDoc] = await Promise.all([
      Product.findById(product).select("name"),
      Variant.findById(variant)
        .populate("color", "name")
        .select("gender color"),
      Size.findById(size).select("value"),
    ]);

    if (!productDoc || !variantDoc || !sizeDoc) {
      throw new ApiError(404, "Không tìm thấy thông tin product/variant/size");
    }

    // Generate SKU
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
      sku, // Thêm SKU
      quantity: 0,
      costPrice: 0,
      averageCostPrice: 0,
    });

    // Đồng bộ SKU sang Variant.sizes[]
    await syncSKUToVariant(variant, size, sku);
  }

  return inventoryItem;
};

/**
 * Đồng bộ SKU từ InventoryItem sang Variant.sizes[]
 */
const syncSKUToVariant = async (variantId, sizeId, sku) => {
  try {
    const variant = await Variant.findById(variantId);
    if (!variant) {
      console.error(`Variant not found: ${variantId}`);
      return;
    }

    // Tìm size trong variant.sizes
    const sizeIndex = variant.sizes.findIndex(
      (s) => s.size.toString() === sizeId.toString()
    );

    if (sizeIndex === -1) {
      console.error(`Size not found in variant: ${sizeId}`);
      return;
    }

    // Cập nhật SKU
    variant.sizes[sizeIndex].sku = sku;
    await variant.save();

    console.log(
      `Synced SKU: Variant ${variantId}, Size ${sizeId}, SKU: ${sku}`
    );
  } catch (error) {
    console.error("Error syncing SKU to variant:", error);
  }
};

/**
 * Nhập kho
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

  if (quantity <= 0) {
    throw new ApiError(400, "Số lượng nhập phải lớn hơn 0");
  }

  // Lấy hoặc tạo inventory item
  const inventoryItem = await getOrCreateInventoryItem(product, variant, size);

  const quantityBefore = inventoryItem.quantity;
  const quantityAfter = quantityBefore + quantity;

  // Cập nhật giá nhập trung bình
  const totalCost = costPrice * quantity;
  const previousTotalCost = inventoryItem.averageCostPrice * quantityBefore;
  const newAverageCostPrice =
    quantityAfter > 0 ? (previousTotalCost + totalCost) / quantityAfter : 0;

  // Tính giá bán
  const priceCalculation = calculatePrice(
    costPrice,
    targetProfitPercent,
    percentDiscount
  );

  // Cập nhật inventory item với giá bán (Fix CRITICAL Issue #1)
  inventoryItem.quantity = quantityAfter;
  inventoryItem.costPrice = costPrice;
  inventoryItem.averageCostPrice = newAverageCostPrice;
  inventoryItem.sellingPrice = priceCalculation.calculatedPrice;
  inventoryItem.discountPercent = percentDiscount;
  inventoryItem.finalPrice = priceCalculation.calculatedPriceFinal;
  inventoryItem.lastPriceUpdate = new Date();
  await inventoryItem.save();

  // Tạo transaction
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

  // Cập nhật Product stock status
  await updateProductStockFromInventory(product);

  return {
    inventoryItem: await inventoryItem.populate("product variant size"),
    transaction,
    priceCalculation,
  };
};

/**
 * Xuất kho
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

  // Lấy inventory item
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

  const quantityBefore = inventoryItem.quantity;
  const quantityAfter = quantityBefore - quantity;

  // Cập nhật inventory item
  inventoryItem.quantity = quantityAfter;
  await inventoryItem.save();

  // Đồng bộ sang Variant.sizes[].quantity
  await syncInventoryToVariant(inventoryItem);

  // Tạo transaction
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

  // Cập nhật Product stock status
  await updateProductStockFromInventory(product);

  return {
    inventoryItem: await inventoryItem.populate("product variant size"),
    transaction,
  };
};

/**
 * Điều chỉnh kho (thủ công)
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

  // Đồng bộ sang Variant.sizes[].quantity
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

  // Cập nhật Product stock status
  await updateProductStockFromInventory(product);

  return {
    inventoryItem: await inventoryItem.populate("product variant size"),
    transaction,
  };
};

/**
 * Lấy danh sách tồn kho
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
 * Lấy thông tin chi tiết một mục tồn kho
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
 * Cập nhật ngưỡng cảnh báo tồn kho thấp
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
 * Lấy lịch sử giao dịch
 */
const getTransactionHistory = async (filter = {}, options = {}) => {
  const {
    page = 1,
    limit = 50,
    sortBy = "createdAt",
    sortOrder = "desc",
    type,
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
 * Thống kê kho hàng
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
 * MỚI: Lấy pricing cho một variant + size cụ thể
 * @param {String} variantId - ID variant
 * @param {String} sizeId - ID size
 * @returns {Object} - Pricing info hoặc null
 */
const getVariantSizePricing = async (variantId, sizeId) => {
  const inventoryItem = await InventoryItem.findOne({
    variant: variantId,
    size: sizeId,
  });

  if (!inventoryItem) {
    return null;
  }

  // Lấy transaction gần nhất để có pricing info
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
 * MỚI: Lấy price range cho một product
 * @param {String} productId - ID product
 * @returns {Object} - Min/max pricing info
 */
const getProductPricing = async (productId) => {
  const inventoryItems = await InventoryItem.find({
    product: productId,
    quantity: { $gt: 0 }, // Chỉ tính items còn hàng
  });

  if (inventoryItems.length === 0) {
    return {
      min: 0,
      max: 0,
      hasStock: false,
    };
  }

  // Lấy pricing từ transactions
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
 * MỚI: Cập nhật Product stock info từ InventoryItems
 * Gọi sau mỗi lần stock in/out
 */
const updateProductStockFromInventory = async (productId) => {
  const Product = require("../models").Product;
  const { updateProductStockInfo } = require("../models/product/middlewares");

  await updateProductStockInfo(productId);
};

/**
 * MỚI: Tính toán động totalQuantity và stockStatus cho Product từ InventoryItem
 * @param {String} productId - ID của product
 * @returns {Object} - { totalQuantity, stockStatus }
 */
const getProductStockInfo = async (productId) => {
  const mongoose = require("mongoose");

  // Aggregate từ InventoryItem để tính tổng
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

  // Xác định stock status
  let stockStatus = "out_of_stock";
  if (totalQuantity > 0) {
    // Kiểm tra xem có item nào low stock không
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
 * Lấy thông tin giá bán và tồn kho của một variant
 * @param {String} variantId - ID của variant
 * @returns {Object} - { pricing, quantities, hasInventory }
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

  // Lấy giá từ item đầu tiên (giả sử tất cả sizes cùng giá)
  const firstItem = inventoryItems[0];
  const pricing = {
    sellingPrice: firstItem.sellingPrice || 0,
    discountPercent: firstItem.discountPercent || 0,
    finalPrice: firstItem.finalPrice || 0,
    calculatedPrice: firstItem.sellingPrice || 0,
    calculatedPriceFinal: firstItem.finalPrice || 0,
    percentDiscount: firstItem.discountPercent || 0,
  };

  // Tạo danh sách số lượng theo size
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
  //  NEW: Pricing helpers
  getVariantSizePricing,
  getVariantPricing, // NEW: Get pricing and quantities for a variant
  getProductPricing,
  updateProductStockFromInventory,
  getProductStockInfo, // NEW: Tính toán stock info động
};
