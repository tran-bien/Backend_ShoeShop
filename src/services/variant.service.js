const { Variant, Product, Color, Size } = require("@models");
const mongoose = require("mongoose");
const paginate = require("@utils/pagination");
const paginateDeleted = require("@utils/paginationDeleted");

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
      minPrice,
      maxPrice,
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

    // Lọc theo khoảng giá
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.priceFinal = {};

      if (minPrice !== undefined) {
        filter.priceFinal.$gte = Number(minPrice);
      }

      if (maxPrice !== undefined) {
        filter.priceFinal.$lte = Number(maxPrice);
      }
    }

    // Lọc theo trạng thái active
    if (isActive !== undefined) {
      filter.isActive = isActive === "true" || isActive === true;
    }

    const options = {
      page,
      limit,
      sort: sort ? JSON.parse(sort) : { createdAt: -1 },
      populate: [
        { path: "color", select: "name code type" },
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

    return await paginate(Variant, filter, options);
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
      throw new Error("Không tìm thấy biến thể");
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
      minPrice,
      maxPrice,
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

    // Lọc theo khoảng giá
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.priceFinal = {};

      if (minPrice !== undefined) {
        filter.priceFinal.$gte = Number(minPrice);
      }

      if (maxPrice !== undefined) {
        filter.priceFinal.$lte = Number(maxPrice);
      }
    }

    // Lọc theo trạng thái active
    if (isActive !== undefined) {
      filter.isActive = isActive === "true" || isActive === true;
    }

    const options = {
      page,
      limit,
      sort: sort ? JSON.parse(sort) : { createdAt: -1 },
      populate: [
        { path: "color", select: "name code type" },
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
      throw new Error("Không tìm thấy sản phẩm");
    }

    const color = await Color.findById(colorId);
    if (!color) {
      throw new Error("Không tìm thấy màu sắc");
    }

    // Kiểm tra kích thước tồn tại và tạo mảng sizes hợp lệ
    if (
      !variantData.sizes ||
      !Array.isArray(variantData.sizes) ||
      variantData.sizes.length === 0
    ) {
      throw new Error("Phải có ít nhất một kích thước");
    }

    // Kiểm tra xem sản phẩm đã có biến thể với màu này chưa
    const existingVariantWithColor = await Variant.findOne({
      product: productId,
      color: colorId,
      deletedAt: null,
    });

    if (existingVariantWithColor) {
      throw new Error("Sản phẩm đã có biến thể với màu sắc này");
    }

    const sizesData = [];
    for (const sizeData of variantData.sizes) {
      const sizeExists = await Size.findById(sizeData.size);
      if (!sizeExists) {
        throw new Error(`Không tìm thấy kích thước với ID: ${sizeData.size}`);
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

    return {
      success: true,
      message: "Tạo biến thể thành công",
      variant,
    };
  },

  /**
   * Cập nhật thông tin biến thể
   * @param {String} id ID biến thể
   * @param {Object} updateData Dữ liệu cập nhật
   */
  updateVariant: async (id, updateData) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID biến thể không hợp lệ");
    }

    const variant = await Variant.findById(id);
    if (!variant) {
      throw new Error("Không tìm thấy biến thể");
    }

    // Kiểm tra màu sắc tồn tại nếu có cập nhật
    if (updateData.color) {
      if (!mongoose.Types.ObjectId.isValid(updateData.color)) {
        throw new Error("ID màu sắc không hợp lệ");
      }

      const colorExists = await Color.findById(updateData.color);
      if (!colorExists) {
        throw new Error("Không tìm thấy màu sắc");
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
          throw new Error("Sản phẩm đã có biến thể với màu sắc này");
        }
      }
    }

    // Kiểm tra kích thước tồn tại nếu có cập nhật sizes
    if (updateData.sizes && Array.isArray(updateData.sizes)) {
      const sizesData = [];
      for (const sizeData of updateData.sizes) {
        if (!mongoose.Types.ObjectId.isValid(sizeData.size)) {
          throw new Error("ID kích thước không hợp lệ");
        }

        const sizeExists = await Size.findById(sizeData.size);
        if (!sizeExists) {
          throw new Error(`Không tìm thấy kích thước với ID: ${sizeData.size}`);
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
      .populate("color", "name code type")
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
      message: "Cập nhật biến thể thành công",
      variant: updatedVariant,
    };
  },

  /**
   * Xóa mềm biến thể
   * @param {String} id ID biến thể
   * @param {String} userId ID người xóa
   */
  deleteVariant: async (id, userId) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID biến thể không hợp lệ");
    }

    const variant = await Variant.findById(id);
    if (!variant) {
      throw new Error("Không tìm thấy biến thể");
    }

    // Lưu lại ID sản phẩm để cập nhật tồn kho sau khi xóa
    const productId = variant.product;

    // Soft delete biến thể
    await variant.softDelete(userId);

    // Cập nhật thông tin tồn kho của sản phẩm sau khi xóa biến thể
    if (productId) {
      const product = await Product.findById(productId);
      if (product) {
        const {
          updateProductStockInfo,
        } = require("@models/product/middlewares");
        await updateProductStockInfo(product);
      }
    }

    return {
      success: true,
      message: "Xóa biến thể thành công",
    };
  },

  /**
   * Khôi phục biến thể đã xóa
   * @param {String} id ID biến thể
   */
  restoreVariant: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID biến thể không hợp lệ");
    }

    const variant = await Variant.restoreById(id);
    if (!variant) {
      throw new Error("Không tìm thấy biến thể để khôi phục");
    }

    // Kiểm tra xem sản phẩm đã có biến thể với màu này chưa
    const existingVariantWithColor = await Variant.findOne({
      product: variant.product,
      color: variant.color,
      _id: { $ne: id },
      deletedAt: null,
    });

    if (existingVariantWithColor) {
      // Nếu tồn tại thì xóa lại biến thể vừa khôi phục
      await Variant.findByIdAndUpdate(id, { deletedAt: new Date() });
      throw new Error("Sản phẩm đã có biến thể với màu sắc này");
    }

    // Cập nhật thông tin tồn kho của sản phẩm sau khi khôi phục biến thể
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
      message: "Khôi phục biến thể thành công",
      variant,
    };
  },

  /**
   * Cập nhật số lượng tồn kho của biến thể
   * @param {String} id ID biến thể
   * @param {Array} sizesData Dữ liệu cập nhật số lượng theo kích thước
   */
  updateVariantInventory: async (id, sizesData) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID biến thể không hợp lệ");
    }

    const variant = await Variant.findById(id);
    if (!variant) {
      throw new Error("Không tìm thấy biến thể");
    }

    if (!Array.isArray(sizesData) || sizesData.length === 0) {
      throw new Error("Dữ liệu cập nhật tồn kho không hợp lệ");
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
      .populate("color", "name code type")
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
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID biến thể không hợp lệ");
    }

    const variant = await Variant.findById(id);
    if (!variant) {
      throw new Error("Không tìm thấy biến thể");
    }

    // Cập nhật trạng thái
    const updatedVariant = await Variant.findByIdAndUpdate(
      id,
      { $set: { isActive: isActive } },
      { new: true }
    );

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
      message: `Biến thể đã được ${statusMsg} thành công`,
      variant: updatedVariant,
    };
  },
};

module.exports = variantService;
