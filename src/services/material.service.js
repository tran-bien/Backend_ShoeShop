const { Material, Product } = require("@models");
const mongoose = require("mongoose");
const paginate = require("@utils/pagination");
const paginateDeleted = require("@utils/paginationDeleted");
const {
  getVietnameseCollation,
  needsVietnameseCollation,
} = require("@utils/collation");
const ApiError = require("@utils/ApiError");

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

const materialService = {
  /**
   * Lấy danh sách tất cả chất liệu (có phân trang)
   */
  getAllMaterials: async (query = {}) => {
    const { page = 1, limit = 20, name, isActive, sort } = query;

    // Xây dựng filter
    const filter = {};

    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const { sortOption, collation } = sort
      ? getSortOption(sort)
      : { sortOption: { createdAt: -1 }, collation: null };

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: sortOption,
      collation: collation,
    };

    return await paginate(Material, filter, options);
  },

  /**
   * Lấy danh sách chất liệu đã xóa (soft delete)
   */
  getDeletedMaterials: async (query = {}) => {
    const { page = 1, limit = 20, name, sort } = query;

    const filter = { deletedAt: { $ne: null } };

    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    const { sortOption, collation } = sort
      ? getSortOption(sort)
      : { sortOption: { deletedAt: -1 }, collation: null };

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: sortOption,
      collation: collation,
      populate: "deletedBy",
    };

    return await paginateDeleted(Material, filter, options);
  },

  /**
   * Lấy thông tin chất liệu theo ID
   */
  getMaterialById: async (id) => {
    const material = await Material.findById(id);

    if (!material) {
      throw new ApiError(404, "Không tìm thấy chất liệu");
    }

    return { success: true, material };
  },

  /**
   * Tạo chất liệu mới
   */
  createMaterial: async (data) => {
    const { name, description, isActive = true } = data;

    // Kiểm tra chất liệu đã tồn tại chưa
    const existingMaterial = await Material.findOne({ name });
    if (existingMaterial) {
      throw new ApiError(409, "Chất liệu đã tồn tại");
    }

    const material = await Material.create({
      name,
      description,
      isActive,
    });

    return {
      success: true,
      message: "Tạo chất liệu thành công",
      material,
    };
  },

  /**
   * Cập nhật thông tin chất liệu
   */
  updateMaterial: async (id, updateData) => {
    const { name, description, isActive } = updateData;

    // Kiểm tra chất liệu tồn tại không
    const material = await Material.findById(id);
    if (!material) {
      throw new ApiError(404, "Không tìm thấy chất liệu");
    }

    // Nếu cập nhật tên, kiểm tra trùng lặp
    if (name && name !== material.name) {
      const existingMaterial = await Material.findOne({ name });
      if (existingMaterial) {
        throw new ApiError(409, "Chất liệu đã tồn tại");
      }
    }

    // Cập nhật thông tin
    if (name !== undefined) material.name = name;
    if (description !== undefined) material.description = description;
    if (isActive !== undefined) material.isActive = isActive;

    await material.save();

    return {
      success: true,
      message: "Cập nhật chất liệu thành công",
      material,
    };
  },

  /**
   * Xóa mềm chất liệu
   */
  deleteMaterial: async (id, userId) => {
    // Kiểm tra chất liệu tồn tại không
    const material = await Material.findById(id);
    if (!material) {
      throw new ApiError(404, "Không tìm thấy chất liệu");
    }

    // Kiểm tra chất liệu có đang được sử dụng không
    const productCount = await Product.countDocuments({
      material: id,
      deletedAt: null,
    });
    if (productCount > 0) {
      throw new ApiError(
        400,
        `Không thể xóa vì có ${productCount} sản phẩm đang sử dụng chất liệu này`
      );
    }

    // Thực hiện xóa mềm
    material.deletedAt = new Date();
    material.deletedBy = userId;
    material.isActive = false;

    await material.save();

    return {
      success: true,
      message: "Xóa chất liệu thành công",
    };
  },

  /**
   * Khôi phục chất liệu đã xóa mềm
   */
  restoreMaterial: async (id) => {
    // Kiểm tra chất liệu tồn tại không
    const material = await Material.findById(id).setOptions({
      includeDeleted: true,
    });
    if (!material) {
      throw new ApiError(404, "Không tìm thấy chất liệu");
    }

    if (!material.deletedAt) {
      throw new ApiError(409, "Chất liệu chưa bị xóa");
    }

    // Khôi phục
    material.deletedAt = null;
    material.deletedBy = null;

    await material.save();

    return {
      success: true,
      message: "Khôi phục chất liệu thành công",
      material,
    };
  },

  /**
   * Cập nhật trạng thái kích hoạt của chất liệu
   */
  updateMaterialStatus: async (id, isActive) => {
    // Kiểm tra chất liệu tồn tại không
    const material = await Material.findById(id);
    if (!material) {
      throw new ApiError(404, "Không tìm thấy chất liệu");
    }

    // Nếu đang vô hiệu hóa, kiểm tra chất liệu có đang được sử dụng không
    if (isActive === false) {
      const productCount = await Product.countDocuments({
        material: id,
        deletedAt: null,
      });

      if (productCount > 0) {
        throw new ApiError(
          400,
          `Không thể vô hiệu hóa vì có ${productCount} sản phẩm đang sử dụng chất liệu này`
        );
      }
    }

    // Cập nhật trạng thái
    material.isActive = isActive;
    await material.save();

    return {
      success: true,
      message: `${isActive ? "Kích hoạt" : "Vô hiệu hóa"} chất liệu thành công`,
      material,
    };
  },

  /**
   * Lấy danh sách chất liệu đang active cho public API
   */
  getPublicMaterials: async () => {
    const materials = await Material.find({
      isActive: true,
      deletedAt: null,
    })
      .select("name description")
      .sort("name")
      .collation(getVietnameseCollation());

    return {
      success: true,
      materials,
    };
  },
};

module.exports = materialService;
