const { Material, Product } = require("@models");
const mongoose = require("mongoose");
const paginate = require("@utils/pagination");
const paginateDeleted = require("@utils/paginationDeleted");
const ApiError = require("@utils/ApiError");

const materialService = {
  /**
   * Lấy danh sách tất cả chất liệu (có phân trang)
   */
  getAllMaterials: async (query = {}) => {
    const { page = 1, limit = 20, name, isActive, sort = "name" } = query;

    // Xây dựng filter
    const filter = {};

    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: sort || "name",
    };

    return await paginate(Material, filter, options);
  },

  /**
   * Lấy danh sách chất liệu đã xóa (soft delete)
   */
  getDeletedMaterials: async (query = {}) => {
    const { page = 1, limit = 20, name, sort = "deletedAt" } = query;

    const filter = { deletedAt: { $ne: null } };

    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: sort || "-deletedAt",
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
      throw new ApiError(400, "Chất liệu đã tồn tại");
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
        throw new ApiError(400, "Chất liệu đã tồn tại");
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
      throw new ApiError(400, "Chất liệu chưa bị xóa");
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
   * Lấy danh sách chất liệu đang active cho public API
   */
  getPublicMaterials: async () => {
    const materials = await Material.find({
      isActive: true,
      deletedAt: null,
    })
      .select("name description")
      .sort("name");

    return {
      success: true,
      materials,
    };
  },
};

module.exports = materialService;
