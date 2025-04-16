const { Variant, Product, Color, Size } = require("@models");
const mongoose = require("mongoose");
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
        sortOption = { priceFinal: 1 };
        break;
      case "price_desc":
        sortOption = { priceFinal: -1 };
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
      limit = 10,
      productId,
      color,
      gender,
      // Các tham số lọc giá nhập
      costPriceMin,
      costPriceMax,
      // Các tham số lọc giá bán gốc
      priceMin,
      priceMax,
      // Các tham số lọc giá cuối
      finalPriceMin,
      finalPriceMax,
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

    // === LỌC THEO GIÁ NHẬP (COST PRICE) ===
    if (costPriceMin !== undefined || costPriceMax !== undefined) {
      filter.costPrice = {};
      if (costPriceMin !== undefined) {
        filter.costPrice.$gte = Number(costPriceMin);
      }
      if (costPriceMax !== undefined) {
        filter.costPrice.$lte = Number(costPriceMax);
      }
    }

    // === LỌC THEO GIÁ BÁN GỐC (PRICE) ===
    if (priceMin !== undefined || priceMax !== undefined) {
      filter.price = {};
      if (priceMin !== undefined) {
        filter.price.$gte = Number(priceMin);
      }
      if (priceMax !== undefined) {
        filter.price.$lte = Number(priceMax);
      }
    }

    // === LỌC THEO GIÁ BÁN CUỐI (PRICE FINAL) ===
    if (finalPriceMin !== undefined || finalPriceMax !== undefined) {
      filter.priceFinal = {};
      if (finalPriceMin !== undefined) {
        filter.priceFinal.$gte = Number(finalPriceMin);
      }
      if (finalPriceMax !== undefined) {
        filter.priceFinal.$lte = Number(finalPriceMax);
      }
    }

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
    results.data = results.data.map((variant) => {
      const variantObj = variant.toObject ? variant.toObject() : { ...variant };

      // Tính tổng hợp tồn kho
      const inventorySummary =
        variantService.calculateInventorySummary(variant);

      return {
        ...variantObj,
        inventorySummary,
      };
    });

    return results;
  },

  /**
   * [ADMIN] Lấy chi tiết biến thể theo ID
   * @param {String} id ID của biến thể
   */
  getAdminVariantById: async (id) => {
    const variant = await Variant.findById(id)
      .populate("color", "name code type colors")
      .populate("sizes.size", "value description")
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

    return {
      success: true,
      variant,
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
      // Các tham số lọc giá nhập
      costPriceMin,
      costPriceMax,
      // Các tham số lọc giá bán gốc
      priceMin,
      priceMax,
      // Các tham số lọc giá cuối
      finalPriceMin,
      finalPriceMax,
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

    // === LỌC THEO GIÁ NHẬP (COST PRICE) ===
    if (costPriceMin !== undefined || costPriceMax !== undefined) {
      filter.costPrice = {};
      if (costPriceMin !== undefined) {
        filter.costPrice.$gte = Number(costPriceMin);
      }
      if (costPriceMax !== undefined) {
        filter.costPrice.$lte = Number(costPriceMax);
      }
    }

    // === LỌC THEO GIÁ BÁN GỐC (PRICE) ===
    if (priceMin !== undefined || priceMax !== undefined) {
      filter.price = {};
      if (priceMin !== undefined) {
        filter.price.$gte = Number(priceMin);
      }
      if (priceMax !== undefined) {
        filter.price.$lte = Number(priceMax);
      }
    }

    // === LỌC THEO GIÁ BÁN CUỐI (PRICE FINAL) ===
    if (finalPriceMin !== undefined || finalPriceMax !== undefined) {
      filter.priceFinal = {};
      if (finalPriceMin !== undefined) {
        filter.priceFinal.$gte = Number(finalPriceMin);
      }
      if (finalPriceMax !== undefined) {
        filter.priceFinal.$lte = Number(finalPriceMax);
      }
    }

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
   * Tạo biến thể mới
   * @param {Object} variantData Thông tin biến thể
   */
  createVariant: async (variantData) => {
    // Kiểm tra sản phẩm tồn tại
    const productId = variantData.product;
    const colorId = variantData.color;

    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, `Không tìm thấy sản phẩm với ID: ${productId}`);
    }

    const color = await Color.findById(colorId);
    if (!color) {
      throw new ApiError(404, `Không tìm thấy màu sắc với ID: ${colorId}`);
    }

    // Kiểm tra kích thước tồn tại và tạo mảng sizes hợp lệ
    if (
      !variantData.sizes ||
      !Array.isArray(variantData.sizes) ||
      variantData.sizes.length === 0
    ) {
      throw new ApiError(400, "Phải có ít nhất một kích thước");
    }

    // Kiểm tra xem sản phẩm đã có biến thể với màu này chưa
    const existingVariantWithColor = await Variant.findOne({
      product: productId,
      color: colorId,
      deletedAt: null,
    });

    if (existingVariantWithColor) {
      throw new ApiError(
        409,
        `Sản phẩm ${product.name} đã có biến thể với màu sắc ${color.name}`
      );
    }

    const sizesData = [];
    for (const sizeData of variantData.sizes) {
      const sizeExists = await Size.findById(sizeData.size);
      if (!sizeExists) {
        throw new ApiError(
          404,
          `Không tìm thấy kích thước với ID: ${sizeData.size}`
        );
      }

      // Thêm size vào mảng
      sizesData.push({
        size: sizeData.size,
        quantity: sizeData.quantity || 0,
        // Không cần gán SKU và isSizeAvailable, middleware sẽ xử lý
      });
    }

    // Tạo biến thể mới với dữ liệu đã validate
    const variant = new Variant({
      product: productId,
      color: colorId,
      price: variantData.price,
      costPrice: variantData.costPrice,
      gender: variantData.gender || "male",
      percentDiscount: variantData.percentDiscount || 0,
      isActive:
        variantData.isActive !== undefined ? variantData.isActive : true,
      sizes: sizesData,
      // Các trường khác như profit, profitPercentage, priceFinal sẽ được tính tự động bởi middleware
    });

    // Lưu biến thể
    await variant.save();

    // Cập nhật sản phẩm liên quan
    await Product.findByIdAndUpdate(
      productId,
      { $addToSet: { variants: variant._id } },
      { new: true }
    );

    // Thêm populate cho các trường liên quan trước khi trả về
    const populatedVariant = await Variant.findById(variant._id)
      .populate({ path: "color", select: "name code type colors" })
      .populate({ path: "sizes.size", select: "value description" })
      .populate({ path: "product", select: "name category brand" });

    return {
      success: true,
      message: "Tạo biến thể thành công",
      variant: populatedVariant,
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

      // Kiểm tra xem sản phẩm đã có biến thể với màu này chưa (nếu đang thay đổi màu)
      if (updateData.color.toString() !== variant.color.toString()) {
        const existingVariantWithColor = await Variant.findOne({
          product: variant.product,
          color: updateData.color,
          _id: { $ne: id },
          deletedAt: null,
        });

        if (existingVariantWithColor) {
          throw new ApiError(
            409,
            `Sản phẩm ${variant.product.name} đã có biến thể với màu sắc ${colorExists.name}`
          );
        }
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

    // Cập nhật các trường
    const allowedFields = [
      "color",
      "price",
      "costPrice",
      "percentDiscount",
      "gender",
      "sizes",
      "isActive",
    ];

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
      .populate("sizes.size", "value description")
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
      message: `Cập nhật biến thể ${updatedVariant.name} thành công`,
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
        message: `Biến thể ${variant.name} đang được sử dụng trong ${hasOrderItems.length} đơn hàng nên đã được vô hiệu hóa`,
        variant: {
          _id: variant._id,
          name: variant.name,
          isDeactivated: true,
        },
      };
    }

    // Xóa mềm nếu không liên quan đến đơn hàng
    await variant.softDelete(userId);

    // Cập nhật trạng thái sản phẩm liên quan
    const product = await Product.findById(productId);
    if (product) {
      // Kiểm tra nếu tất cả biến thể của sản phẩm đều đã bị xóa mềm
      const remainingVariants = await Variant.countDocuments({
        product: productId,
        isDeleted: false,
      });

      // Thông báo cho client
      return {
        success: true,
        message: `Xóa biến thể ${variant.name} thành công`,
        variant: {
          _id: variant._id,
          name: variant.name,
          isDeleted: true,
        },
        affectedProduct:
          remainingVariants === 0
            ? {
                _id: product._id,
                name: product.name,
                warning: `Tất cả biến thể của sản phẩm ${product.name} đã bị xóa. Sản phẩm sẽ không hiển thị cho người dùng.`,
              }
            : null,
      };
    }

    return {
      success: true,
      message: `Xóa biến thể ${variant.name} thành công`,
      variant: {
        _id: variant._id,
        name: variant.name,
        isDeleted: true,
      },
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
        `Sản phẩm ${variant.product.name} đã có biến thể với màu sắc ${variant.color.name} nên không thể khôi phục biến thể đã xóa.`
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
      message: `Khôi phục biến thể ${variant.name} thành công`,
      variant,
    };
  },

  /**
   * Cập nhật số lượng tồn kho của biến thể
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
      .populate("sizes.size", "value description");

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
      message: `Biến thể ${updatedVariant.name} đã được ${statusMsg} thành công`,
      variant: updatedVariant,
    };
  },

  /**
   * Tính tổng số lượng tồn kho của biến thể
   * @param {Object} variant Biến thể cần tính tổng số lượng
   * @returns {Object} Thông tin tồn kho tổng hợp
   */
  calculateInventorySummary: (variant) => {
    // Tổng số lượng có sẵn
    const totalQuantity = variant.sizes.reduce(
      (sum, size) => sum + (size.quantity || 0),
      0
    );

    // Số lượng kích thước có sẵn
    const availableSizes = variant.sizes.filter(
      (size) => size.quantity > 0 && size.isSizeAvailable
    ).length;

    // Số lượng tồn kho theo kích thước
    const sizeInventory = variant.sizes.map((size) => {
      return {
        sizeId: size.size._id || size.size,
        sizeValue: size.size.value || "",
        sizeDescription: size.size.description || "",
        quantity: size.quantity || 0,
        isAvailable: size.isSizeAvailable,
        sku: size.sku || "",
      };
    });

    // Xác định trạng thái tồn kho
    let stockStatus = "out_of_stock";
    if (totalQuantity > 0) {
      stockStatus = totalQuantity > 10 ? "in_stock" : "low_stock";
    }

    return {
      totalQuantity,
      availableSizes,
      totalSizes: variant.sizes.length,
      stockStatus,
      sizeInventory,
    };
  },

  /**
   * [PUBLIC] Lấy tổng quan tồn kho cho biến thể
   * @param {String} id ID biến thể
   * @returns {Promise<Object>} Thông tin tồn kho
   */
  getVariantInventorySummary: async (id) => {
    const variant = await Variant.findOne({
      _id: id,
      isActive: true,
      deletedAt: null,
    })
      .populate("color", "name code type colors")
      .populate("sizes.size", "value description")
      .populate({
        path: "product",
        select: "name category brand slug",
        populate: [
          { path: "category", select: "name" },
          { path: "brand", select: "name" },
        ],
      });

    if (!variant) {
      throw new ApiError(404, `Không tìm thấy biến thể với ID: ${id}`);
    }

    // Tính số lượng tồn kho
    const inventorySummary = variantService.calculateInventorySummary(variant);

    return {
      success: true,
      inventory: {
        variantId: variant._id,
        productId: variant.product._id,
        productName: variant.product.name,
        productSlug: variant.product.slug,
        colorId: variant.color._id,
        colorName: variant.color.name,
        colorCode: variant.color.code,
        colorType: variant.color.type,
        gender: variant.gender,
        price: variant.price,
        priceFinal: variant.priceFinal,
        percentDiscount: variant.percentDiscount,
        ...inventorySummary,
      },
    };
  },

  /**
   * [PUBLIC] Lấy biến thể theo sản phẩm, màu và kích thước
   * @param {Object} options Tùy chọn tìm kiếm (productId, colorId, sizeId)
   * @returns {Promise<Object>} Biến thể tương ứng hoặc null nếu không tìm thấy
   */
  getVariantByCriteria: async (options) => {
    const { productId, colorId, sizeId } = options;
    // Tạo điều kiện tìm kiếm cơ bản
    const query = {
      product: productId,
      isActive: true,
      deletedAt: null,
    };

    // Thêm điều kiện tìm kiếm theo màu sắc
    if (colorId && mongoose.Types.ObjectId.isValid(colorId)) {
      query.color = colorId;
    }

    // Lấy các biến thể phù hợp
    const variants = await Variant.find(query)
      .populate("color", "name code type colors")
      .populate("sizes.size", "value description")
      .populate({
        path: "product",
        select: "name slug",
      });

    if (!variants || variants.length === 0) {
      return {
        success: false,
        message: "Không tìm thấy biến thể phù hợp",
        inventory: null,
      };
    }

    // Nếu có sizeId, tiếp tục lọc theo kích thước
    if (sizeId && mongoose.Types.ObjectId.isValid(sizeId)) {
      // Lọc các biến thể có kích thước này và số lượng > 0
      const filteredVariants = variants.filter((variant) => {
        return variant.sizes.some(
          (size) =>
            size.size._id.toString() === sizeId &&
            size.quantity > 0 &&
            size.isSizeAvailable
        );
      });

      if (filteredVariants.length === 0) {
        return {
          success: false,
          message:
            "Không có biến thể phù hợp với kích thước này hoặc đã hết hàng",
          inventory: null,
        };
      }

      // Lấy biến thể đầu tiên có kích thước phù hợp
      const variant = filteredVariants[0];
      const inventorySummary =
        variantService.calculateInventorySummary(variant);

      // Lọc ra chỉ size được chọn
      const selectedSize = variant.sizes.find(
        (size) => size.size._id.toString() === sizeId
      );

      return {
        success: true,
        variant: {
          id: variant._id,
          productId: variant.product._id,
          productName: variant.product.name,
          productSlug: variant.product.slug,
          colorId: variant.color._id,
          colorName: variant.color.name,
          colorCode: variant.color.code,
          gender: variant.gender,
          price: variant.price,
          priceFinal: variant.priceFinal,
          percentDiscount: variant.percentDiscount,
          images: variant.imagesvariant,
          size: {
            id: selectedSize.size._id,
            value: selectedSize.size.value,
            description: selectedSize.size.description,
            quantity: selectedSize.quantity,
            isAvailable: selectedSize.isSizeAvailable,
          },
          totalQuantity: inventorySummary.totalQuantity,
        },
      };
    }

    // Nếu không có sizeId, trả về tổng quan các biến thể
    const result = variants.map((variant) => {
      const inventorySummary =
        variantService.calculateInventorySummary(variant);
      return {
        id: variant._id,
        colorId: variant.color._id,
        colorName: variant.color.name,
        colorCode: variant.color.code,
        gender: variant.gender,
        price: variant.price,
        priceFinal: variant.priceFinal,
        percentDiscount: variant.percentDiscount,
        totalQuantity: inventorySummary.totalQuantity,
        availableSizes: inventorySummary.availableSizes,
        sizeInventory: inventorySummary.sizeInventory,
      };
    });

    return {
      success: true,
      variants: result,
    };
  },
};

module.exports = variantService;
