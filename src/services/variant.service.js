const { Variant, Product, Color, Size, Order } = require("@models");
const mongoose = require("mongoose");
const { updateProductStockInfo } = require("@models/product/middlewares");
const paginate = require("@utils/pagination");
const paginateDeleted = require("@utils/paginationDeleted");
const ApiError = require("@utils/ApiError");

// Hàm hỗ trợ xử lý các case sắp xếp
const getSortOption = (sortParam) => {
  let sortOption = { createdAt: -1 };
  if (sortParam) {
    switch (sortParam) {
      case "created_at_asc":
        sortOption = { createdAt: 1 };
        break;
      case "created_at_desc":
        sortOption = { createdAt: -1 };
        break;
      case "price_asc":
        sortOption = { createdAt: 1 }; //  Giá không còn ở variant, sort by createdAt
        break;
      case "price_desc":
        sortOption = { createdAt: -1 }; // Giá không còn ở variant, sort by createdAt
        break;
      default:
        try {
          sortOption = JSON.parse(sortParam);
        } catch (err) {
          sortOption = { createdAt: -1 };
        }
        break;
    }
  }
  return sortOption;
};

const variantService = {
  /**
   * [ADMIN] Lấy danh sách biến thể (có phân trang, filter)
   * @param {Object} query Tham số truy vấn
   */
  getAdminVariants: async (query) => {
    const {
      page = 1,
      limit = 90,
      productId,
      color,
      gender,
      isActive,
      sort,
    } = query;

    const filter = { deletedAt: null }; // Mặc định chỉ lấy chưa xóa

    // Lọc theo sản phẩm
    if (productId) {
      filter.product = mongoose.Types.ObjectId.isValid(productId)
        ? new mongoose.Types.ObjectId(String(productId))
        : null;
    }

    // Lọc theo màu sắc
    if (color) {
      filter.color = mongoose.Types.ObjectId.isValid(color)
        ? new mongoose.Types.ObjectId(String(color))
        : null;
    }

    // Lọc theo giới tính
    if (gender && ["male", "female"].includes(gender)) {
      filter.gender = gender;
    }

    // ❌ REMOVED: Lọc theo giá - Giá không còn ở Variant
    // ✅ Giá được quản lý bởi InventoryItem và InventoryTransaction

    // Lọc theo trạng thái active
    if (isActive !== undefined) {
      filter.isActive = isActive === "true" || isActive === true;
    }

    const options = {
      page,
      limit,
      sort: getSortOption(sort),
      populate: [
        { path: "color", select: "name code type colors" },
        {
          path: "sizes.size",
          select: "value description",
        },
        {
          path: "product",
          select: "name category brand",
          populate: [
            { path: "category", select: "name" },
            { path: "brand", select: "name" },
          ],
        },
      ],
    };

    const results = await paginate(Variant, filter, options);

    // Bổ sung thông tin tổng hợp tồn kho cho mỗi biến thể
    results.data = await Promise.all(
      results.data.map(async (variant) => {
        const variantObj = variant.toObject
          ? variant.toObject()
          : { ...variant };

        // Tính tổng hợp tồn kho từ InventoryItem
        const inventorySummary = await variantService.calculateInventorySummary(
          variant
        );

        return {
          ...variantObj,
          inventorySummary,
        };
      })
    );

    return results;
  },

  /**
   * [ADMIN] Lấy chi tiết biến thể theo ID
   * @param {String} id ID của biến thể
   */
  getAdminVariantById: async (id) => {
    const variant = await Variant.findById(id)
      .populate("color", "name code type colors")
      .populate("sizes.size", "value type description")
      .populate({
        path: "product",
        select: "name category brand images",
        populate: [
          { path: "category", select: "name" },
          { path: "brand", select: "name logo" },
        ],
      })
      .setOptions({ includeDeleted: true });

    if (!variant) {
      throw new ApiError(404, `Không tìm thấy biến thể với ID: ${id}`);
    }

    // GET PRICING FROM INVENTORY
    const inventoryService = require("@services/inventory.service");
    const pricingData = await inventoryService.getVariantPricing(variant._id);

    // Bổ sung thông tin tổng hợp tồn kho từ InventoryItem
    const variantObj = variant.toObject ? variant.toObject() : { ...variant };
    const inventorySummary = await variantService.calculateInventorySummary(
      variant
    );

    // Map pricing and quantities to sizes
    const sizesWithPricing = variantObj.sizes.map((size) => {
      const sizeInventory = pricingData.quantities.find(
        (q) => q.sizeId.toString() === size.size._id.toString()
      );
      return {
        ...size,
        quantity: sizeInventory?.quantity || 0,
        sku: sizeInventory?.sku || null,
        isAvailable: sizeInventory?.isAvailable || false,
      };
    });

    return {
      success: true,
      variant: {
        ...variantObj,
        sizes: sizesWithPricing,
        // Add pricing info for admin view
        price: pricingData.pricing.calculatedPrice || 0,
        priceFinal: pricingData.pricing.calculatedPriceFinal || 0,
        percentDiscount: pricingData.pricing.percentDiscount || 0,
        costPrice: pricingData.pricing.costPrice || 0, // Admin can see cost
        inventorySummary,
      },
    };
  },

  /**
   * [ADMIN] Lấy danh sách biến thể đã xóa (có phân trang, filter)
   * @param {Object} query Tham số truy vấn
   */
  getAdminDeletedVariants: async (query) => {
    const {
      page = 1,
      limit = 10,
      productId,
      color,
      gender,
      isActive,
      sort,
    } = query;

    const filter = { deletedAt: { $ne: null } }; // Chỉ lấy các biến thể đã xóa

    // Lọc theo sản phẩm
    if (productId) {
      filter.product = mongoose.Types.ObjectId.isValid(productId)
        ? new mongoose.Types.ObjectId(String(productId))
        : null;
    }

    // Lọc theo màu sắc
    if (color) {
      filter.color = mongoose.Types.ObjectId.isValid(color)
        ? new mongoose.Types.ObjectId(String(color))
        : null;
    }

    // Lọc theo giới tính
    if (gender && ["male", "female"].includes(gender)) {
      filter.gender = gender;
    }

    // REMOVED: Lọc theo giá - Giá không còn ở Variant

    // Lọc theo trạng thái active
    if (isActive !== undefined) {
      filter.isActive = isActive === "true" || isActive === true;
    }

    const options = {
      page,
      limit,
      sort: getSortOption(sort),
      populate: [
        { path: "color", select: "name code type colors" },
        { path: "sizes.size", select: "value description" },
        { path: "product", select: "name category brand" },
      ],
    };

    return await paginateDeleted(Variant, filter, options);
  },

  /**
   * Tạo biến thể mới hoặc cập nhật biến thể hiện có nếu đã tồn tại
   * @param {Object} variantData Thông tin biến thể
   */
  createVariant: async (variantData) => {
    // Kiểm tra dữ liệu đầu vào
    const productId = variantData.product;
    const colorId = variantData.color;

    // Kiểm tra xem sản phẩm, màu sắc và sizes có hợp lệ hay không
    if (
      !mongoose.Types.ObjectId.isValid(productId) ||
      !mongoose.Types.ObjectId.isValid(colorId) ||
      !Array.isArray(variantData.sizes) ||
      variantData.sizes.length === 0
    ) {
      throw new ApiError(400, "Dữ liệu không hợp lệ");
    }

    // Lấy dữ liệu sản phẩm và màu sắc song song
    const [product, color] = await Promise.all([
      Product.findById(productId),
      Color.findById(colorId),
    ]);

    if (!product) {
      throw new ApiError(404, `Không tìm thấy sản phẩm với ID: ${productId}`);
    }

    if (!color) {
      throw new ApiError(404, `Không tìm thấy màu sắc với ID: ${colorId}`);
    }

    // Kiểm tra size hợp lệ
    const sizeIds = variantData.sizes.map((s) => s.size.toString());
    const sizes = await Size.find({ _id: { $in: sizeIds } });

    if (sizes.length !== sizeIds.length) {
      const foundSizeIds = sizes.map((s) => s._id.toString());
      const missingSizeIds = sizeIds.filter((id) => !foundSizeIds.includes(id));
      throw new ApiError(
        404,
        `Không tìm thấy kích thước: ${missingSizeIds.join(", ")}`
      );
    }

    // Tìm biến thể hiện có với cùng sản phẩm và màu sắc và giới tính và
    let existingVariant = await Variant.findOne({
      product: productId,
      color: colorId,
      gender: variantData.gender,
      deletedAt: null,
    }).populate("sizes.size");

    // Biến để theo dõi các thay đổi
    let newVariant = null;
    let updatedSizes = [];
    let newSizes = [];
    let message = "";

    // TH1: Biến thể với màu và giới tính này đã tồn tại
    if (existingVariant) {
      // Tạo Map để dễ dàng tìm kiếm size đã tồn tại
      const existingSizeMap = new Map(
        existingVariant.sizes.map((s) => [s.size._id.toString(), s])
      );

      // Xử lý từng size trong dữ liệu mới
      for (const sizeData of variantData.sizes) {
        const sizeId = sizeData.size.toString();
        const existingSize = existingSizeMap.get(sizeId);

        if (existingSize) {
          // Size đã tồn tại, cập nhật số lượng
          if (existingSize.quantity !== sizeData.quantity) {
            existingSize.quantity = sizeData.quantity;
            existingSize.isSizeAvailable = sizeData.quantity > 0;
            updatedSizes.push(sizeId);
          }
        } else {
          // Size chưa tồn tại, thêm mới vào biến thể
          existingVariant.sizes.push({
            size: sizeId,
            quantity: sizeData.quantity || 0,
            isSizeAvailable: (sizeData.quantity || 0) > 0,
          });
          newSizes.push(sizeId);
        }
      }

      // Chỉ cập nhật gender (price/costPrice được quản lý bởi InventoryItem)
      if (variantData.gender !== undefined) {
        existingVariant.gender = variantData.gender;
      }

      // Lưu thay đổi
      await existingVariant.save();

      // Tạo thông báo phù hợp
      const updates = [];
      if (newSizes.length > 0) {
        updates.push(`thêm ${newSizes.length} kích thước mới`);
      }
      if (updatedSizes.length > 0) {
        updates.push(`cập nhật ${updatedSizes.length} kích thước đã tồn tại`);
      }

      message =
        updates.length > 0
          ? `Đã ${updates.join(" và ")} cho biến thể màu ${color.name}`
          : `Không có thay đổi nào cho biến thể màu ${color.name}`;
    }
    // TH2: Chưa có biến thể với màu và giới tính này, tạo mới hoàn toàn
    else {
      // Chuẩn bị dữ liệu size (CHỈ reference, KHÔNG có quantity)
      const sizesData = variantData.sizes.map((sizeData) => ({
        size: sizeData.size,
        // REMOVED: quantity, isSizeAvailable
        // Quantity được quản lý bởi InventoryItem
      }));

      // Tạo biến thể mới (CHỈ reference data)
      newVariant = new Variant({
        product: productId,
        color: colorId,
        gender: variantData.gender || "male",
        isActive:
          variantData.isActive !== undefined ? variantData.isActive : true,
        sizes: sizesData,
        // REMOVED: price, costPrice, percentDiscount
      });

      // Lưu biến thể mới
      await newVariant.save();

      // Cập nhật sản phẩm
      await Product.findByIdAndUpdate(productId, {
        $addToSet: { variants: newVariant._id },
      });

      message = `Đã tạo biến thể màu ${color.name} và giới tính ${variantData.gender} mới với ${sizesData.length} kích thước. Hãy stock in để thêm giá và số lượng.`;
      existingVariant = newVariant;
    }

    // Lấy biến thể đã populated đầy đủ để trả về
    const populatedVariant = await Variant.findById(existingVariant._id)
      .populate("color", "name code type colors")
      .populate("sizes.size", "value type description")
      .populate({
        path: "product",
        select: "name category brand",
        populate: [
          { path: "category", select: "name" },
          { path: "brand", select: "name" },
        ],
      });

    //   Tính toán thông tin tồn kho từ InventoryItem
    const inventorySummary = await variantService.calculateInventorySummary(
      populatedVariant
    );

    return {
      success: true,
      message,
      isNewVariant: newVariant !== null,
      updatedSizes: updatedSizes.length,
      newSizes: newSizes.length,
      variant: populatedVariant,
      inventory: inventorySummary,
    };
  },

  /**
   * Cập nhật thông tin biến thể
   * @param {String} id ID biến thể
   * @param {Object} updateData Dữ liệu cập nhật
   */
  updateVariant: async (id, updateData) => {
    const variant = await Variant.findById(id);
    if (!variant) {
      throw new ApiError(404, `Không tìm thấy biến thể với ID: ${id}`);
    }

    // Kiểm tra màu sắc tồn tại nếu có cập nhật
    if (updateData.color) {
      const colorExists = await Color.findById(updateData.color);
      if (!colorExists) {
        throw new ApiError(
          404,
          `Không tìm thấy màu sắc với ID: ${updateData.color}`
        );
      }
    }

    // Kiểm tra kích thước tồn tại nếu có cập nhật sizes
    if (updateData.sizes && Array.isArray(updateData.sizes)) {
      const sizesData = [];
      for (const sizeData of updateData.sizes) {
        if (!mongoose.Types.ObjectId.isValid(sizeData.size)) {
          throw new ApiError(400, "ID kích thước không hợp lệ");
        }

        const sizeExists = await Size.findById(sizeData.size);
        if (!sizeExists) {
          throw new ApiError(
            404,
            `Không tìm thấy kích thước với ID: ${sizeData.size}`
          );
        }

        // Kiểm tra xem size này đã tồn tại trong variant chưa để giữ lại SKU
        const existingSize = variant.sizes.find(
          (s) => s.size.toString() === sizeData.size.toString()
        );

        sizesData.push({
          size: sizeData.size,
          quantity: sizeData.quantity || 0,
          sku: existingSize ? existingSize.sku : undefined,
          // isSizeAvailable sẽ được tính lại bởi middleware
        });
      }
      updateData.sizes = sizesData;
    }

    // Cập nhật các trường (CHỈ reference data, KHÔNG có price/cost)
    const allowedFields = [
      "color",
      "gender",
      "sizes", // Chỉ update reference, không update quantity
      "isActive",
    ];
    // REMOVED: price, costPrice, percentDiscount

    const updateFields = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        updateFields[key] = value;
      }
    }

    // Cập nhật biến thể - middleware sẽ tự động tính lại các trường phụ thuộc
    const updatedVariant = await Variant.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .populate("color", "name code type colors")
      .populate("sizes.size", "value type description")
      .populate({
        path: "product",
        select: "name category brand",
        populate: [
          { path: "category", select: "name" },
          { path: "brand", select: "name" },
        ],
      });

    return {
      success: true,
      message: `Cập nhật biến thể thành công`,
      variant: updatedVariant,
    };
  },

  /**
   * Vô hiệu hóa biến thể thay vì xóa mềm khi liên quan đến đơn hàng
   * @param {String} id ID biến thể
   * @param {String} userId ID người thực hiện
   */
  deleteVariant: async (id, userId) => {
    // Tìm biến thể
    const variant = await Variant.findById(id);
    if (!variant) {
      throw new ApiError(404, `Không tìm thấy biến thể với ID: ${id}`);
    }

    // Lưu lại thông tin productId để cập nhật sau
    const productId = variant.product;

    // Kiểm tra xem biến thể có được sử dụng trong đơn hàng không
    const hasOrderItems = await Order.exists({
      "orderItems.variant": id,
    });

    // Vô hiệu hóa nếu liên quan đến đơn hàng
    if (hasOrderItems) {
      // Vô hiệu hóa thay vì xóa mềm
      variant.isActive = false;
      await variant.save();

      // Cập nhật thông tin tồn kho của sản phẩm
      if (productId) {
        const product = await Product.findById(productId);
        if (product) {
          await updateProductStockInfo(product);
        }
      }

      return {
        success: true,
        message: `Biến thể ${variant._id} đang được sử dụng trong ${hasOrderItems.length} đơn hàng nên đã được vô hiệu hóa`,
        variant: {
          variant: variant,
          isDeactivated: true,
        },
      };
    }

    // Xóa mềm nếu không liên quan đến đơn hàng
    await variant.softDelete(userId);

    // Cập nhật trạng thái sản phẩm liên quan
    const product = await Product.findById(productId);
    if (product) {
      // Kiểm tra nếu tất cả biến thể của sản phẩm đều đã bị xóa mềm và không còn sản phẩm nào khác ẩn sản phẩm
      const remainingVariants = await Variant.countDocuments({
        product: productId,
        deletedAt: null,
      });
      if (remainingVariants === 0) {
        product.isActive = false;
        await product.save();
      }
    }

    return {
      success: true,
      message: `Xóa biến thể ${variant._id} thành công`,
      variant: variant,
    };
  },

  /**
   * Khôi phục biến thể đã xóa - với kiểm tra ràng buộc màu sắc
   * @param {String} id ID biến thể
   */
  restoreVariant: async (id) => {
    // Tìm biến thể đã xóa
    const variant = await Variant.findById(id).setOptions({
      includeDeleted: true,
    });
    if (!variant || !variant.deletedAt) {
      throw new ApiError(
        404,
        `Không tìm thấy biến thể để khôi phục với ID: ${id}`
      );
    }

    // Kiểm tra xem sản phẩm đã có biến thể với màu này chưa
    const existingVariantWithColor = await Variant.findOne({
      product: variant.product,
      color: variant.color,
      _id: { $ne: id },
      deletedAt: null,
    });

    if (existingVariantWithColor) {
      throw new ApiError(
        409,
        `Sản phẩm ${variant.product._id} đã có biến thể với màu sắc ${variant.color._id} nên không thể khôi phục biến thể đã xóa.`
      );
    }

    // Khôi phục biến thể
    variant.deletedAt = null;
    variant.isActive = true; // Kích hoạt lại khi khôi phục
    await variant.save();

    // Cập nhật thông tin tồn kho của sản phẩm sau khi khôi phục biến thể
    if (variant.product) {
      const product = await Product.findById(variant.product);
      if (product) {
        await updateProductStockInfo(product);
      }
    }

    return {
      success: true,
      message: `Khôi phục biến thể ${variant._id} thành công`,
      variant,
    };
  },

  /**
   * Cập nhật số lượng tồn kho của biến thể theo size
   * @param {String} id ID biến thể
   * @param {Array} sizesData Dữ liệu cập nhật số lượng theo kích thước
   */
  updateVariantInventory: async (id, sizesData) => {
    const variant = await Variant.findById(id);
    if (!variant) {
      throw new ApiError(404, `Không tìm thấy biến thể với ID: ${id}`);
    }

    if (!Array.isArray(sizesData) || sizesData.length === 0) {
      throw new ApiError(400, "Dữ liệu cập nhật tồn kho không hợp lệ");
    }

    // Kiểm tra xem size có tồn tại không
    const sizeIds = sizesData.map((item) => item.sizeId);
    const sizes = await Size.find({ _id: { $in: sizeIds } });
    if (sizes.length !== sizeIds.length) {
      const foundSizeIds = sizes.map((s) => s._id.toString());
      const missingSizeIds = sizeIds.filter((id) => !foundSizeIds.includes(id));
      throw new ApiError(
        404,
        `Không tìm thấy kích thước: ${missingSizeIds.join(", ")}`
      );
    }

    // Cập nhật số lượng cho từng size
    const updatedSizes = variant.sizes.map((size) => {
      const sizeId = size.size.toString();
      const updateData = sizesData.find((item) => item.sizeId === sizeId);

      if (
        updateData &&
        typeof updateData.quantity === "number" &&
        updateData.quantity >= 0
      ) {
        return {
          ...size.toObject(),
          quantity: updateData.quantity,
          isSizeAvailable: updateData.quantity > 0,
        };
      }

      return size;
    });

    // Cập nhật biến thể
    const updatedVariant = await Variant.findByIdAndUpdate(
      id,
      { $set: { sizes: updatedSizes } },
      { new: true, runValidators: true }
    )
      .populate("color", "name code type colors")
      .populate("sizes.size", "value type description");

    // Cập nhật thông tin tồn kho của sản phẩm
    if (variant.product) {
      const product = await Product.findById(variant.product);
      if (product) {
        const {
          updateProductStockInfo,
        } = require("@models/product/middlewares");
        await updateProductStockInfo(product);
      }
    }

    return {
      success: true,
      message: "Cập nhật tồn kho thành công",
      variant: updatedVariant,
    };
  },

  /**
   * Cập nhật trạng thái active của biến thể
   * @param {String} id ID biến thể
   * @param {Boolean} isActive Trạng thái active
   */
  updateVariantStatus: async (id, isActive) => {
    const variant = await Variant.findById(id);
    if (!variant) {
      throw new ApiError(404, `Không tìm thấy biến thể với ID: ${id}`);
    }

    // Cập nhật trạng thái
    const updatedVariant = await Variant.findByIdAndUpdate(
      id,
      { $set: { isActive: isActive } },
      { new: true }
    ).populate("color", "name code type colors");

    // Cập nhật thông tin tồn kho của sản phẩm
    if (variant.product) {
      const product = await Product.findById(variant.product);
      if (product) {
        const {
          updateProductStockInfo,
        } = require("@models/product/middlewares");
        await updateProductStockInfo(product);
      }
    }

    const statusMsg = isActive ? "kích hoạt" : "vô hiệu hóa";
    return {
      success: true,
      message: `Biến thể ${updatedVariant._id} đã được ${statusMsg} thành công`,
      variant: updatedVariant,
    };
  },

  /**
   * ✅ Tính tổng số lượng tồn kho của biến thể từ INVENTORYITEM
   * @param {Object} variant Biến thể cần tính tổng số lượng
   * @returns {Promise<Object>} Thông tin tồn kho tổng hợp
   */
  calculateInventorySummary: async (variant) => {
    const InventoryItem = require("@models").InventoryItem;

    // ĐỌC TỪ INVENTORYITEM thay vì variant.sizes[].quantity
    const inventoryItems = await InventoryItem.find({
      variant: variant._id,
    }).populate("size", "value description");

    let totalQuantity = 0;
    const sizeInventory = [];

    for (const item of inventoryItems) {
      totalQuantity += item.quantity || 0;

      sizeInventory.push({
        sizeId: item.size._id,
        sizeValue: item.size.value || "",
        sizeDescription: item.size.description || "",
        quantity: item.quantity || 0,
        isAvailable: item.quantity > 0,
        sku: item.sku || "",
        isLowStock: item.isLowStock,
        isOutOfStock: item.isOutOfStock,
      });
    }

    // Số lượng kích thước có sẵn
    const availableSizes = sizeInventory.filter((s) => s.quantity > 0).length;

    // Xác định trạng thái tồn kho
    let stockStatus = "out_of_stock";
    if (totalQuantity > 0) {
      stockStatus = totalQuantity > 10 ? "in_stock" : "low_stock";
    }

    return {
      totalQuantity,
      availableSizes,
      totalSizes: inventoryItems.length,
      stockStatus,
      sizeInventory,
    };
  },
};

module.exports = variantService;
