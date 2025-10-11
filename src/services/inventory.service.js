const { InventoryItem, InventoryTransaction, Variant } = require("../models");
const ApiError = require("../utils/ApiError");

/**
 * Đồng bộ số lượng từ InventoryItem sang Variant.sizes[].quantity
 */
const syncInventoryToVariant = async (inventoryItem) => {
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
    inventoryItem = await InventoryItem.create({
      product,
      variant,
      size,
      quantity: 0,
      costPrice: 0,
      averageCostPrice: 0,
    });
  }

  return inventoryItem;
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

  // Cập nhật inventory item
  inventoryItem.quantity = quantityAfter;
  inventoryItem.costPrice = costPrice;
  inventoryItem.averageCostPrice = newAverageCostPrice;
  await inventoryItem.save();

  // Đồng bộ sang Variant.sizes[].quantity
  await syncInventoryToVariant(inventoryItem);

  // Tính giá bán
  const priceCalculation = calculatePrice(
    costPrice,
    targetProfitPercent,
    percentDiscount
  );

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
};
