const { UseCase, Product } = require("@models");
const mongoose = require("mongoose");
const paginate = require("@utils/pagination");
const paginateDeleted = require("@utils/paginationDeleted");
const ApiError = require("@utils/ApiError");

const useCaseService = {
  /**
   * Lấy danh sách tất cả nhu cầu sử dụng (có phân trang)
   */
  getAllUseCases: async (query = {}) => {
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

    return await paginate(UseCase, filter, options);
  },

  /**
   * Lấy danh sách nhu cầu đã xóa (soft delete)
   */
  getDeletedUseCases: async (query = {}) => {
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

    return await paginateDeleted(UseCase, filter, options);
  },

  /**
   * Lấy thông tin nhu cầu theo ID
   */
  getUseCaseById: async (id) => {
    const useCase = await UseCase.findById(id);

    if (!useCase) {
      throw new ApiError(404, "Không tìm thấy nhu cầu sử dụng");
    }

    return { success: true, useCase };
  },

  /**
   * Tạo nhu cầu sử dụng mới
   */
  createUseCase: async (data) => {
    const { name, description, isActive = true } = data;

    // Kiểm tra nhu cầu đã tồn tại chưa
    const existingUseCase = await UseCase.findOne({ name });
    if (existingUseCase) {
      throw new ApiError(400, "Nhu cầu sử dụng đã tồn tại");
    }

    const useCase = await UseCase.create({
      name,
      description,
      isActive,
    });

    return {
      success: true,
      message: "Tạo nhu cầu sử dụng thành công",
      useCase,
    };
  },

  /**
   * Cập nhật thông tin nhu cầu sử dụng
   */
  updateUseCase: async (id, updateData) => {
    const { name, description, isActive } = updateData;

    // Kiểm tra nhu cầu tồn tại không
    const useCase = await UseCase.findById(id);
    if (!useCase) {
      throw new ApiError(404, "Không tìm thấy nhu cầu sử dụng");
    }

    // Nếu cập nhật tên, kiểm tra trùng lặp
    if (name && name !== useCase.name) {
      const existingUseCase = await UseCase.findOne({ name });
      if (existingUseCase) {
        throw new ApiError(400, "Nhu cầu sử dụng đã tồn tại");
      }
    }

    // Cập nhật thông tin
    if (name !== undefined) useCase.name = name;
    if (description !== undefined) useCase.description = description;
    if (isActive !== undefined) useCase.isActive = isActive;

    await useCase.save();

    return {
      success: true,
      message: "Cập nhật nhu cầu sử dụng thành công",
      useCase,
    };
  },

  /**
   * Xóa mềm nhu cầu sử dụng
   */
  deleteUseCase: async (id, userId) => {
    // Kiểm tra nhu cầu tồn tại không
    const useCase = await UseCase.findById(id);
    if (!useCase) {
      throw new ApiError(404, "Không tìm thấy nhu cầu sử dụng");
    }

    // Kiểm tra nhu cầu có đang được sử dụng không
    const productCount = await Product.countDocuments({
      useCase: id,
      deletedAt: null,
    });
    if (productCount > 0) {
      throw new ApiError(
        400,
        `Không thể xóa vì có ${productCount} sản phẩm đang sử dụng nhu cầu này`
      );
    }

    // Thực hiện xóa mềm
    useCase.deletedAt = new Date();
    useCase.deletedBy = userId;
    useCase.isActive = false;

    await useCase.save();

    return {
      success: true,
      message: "Xóa nhu cầu sử dụng thành công",
    };
  },

  /**
   * Khôi phục nhu cầu sử dụng đã xóa mềm
   */
  restoreUseCase: async (id) => {
    // Kiểm tra nhu cầu tồn tại không
    const useCase = await UseCase.findById(id).setOptions({
      includeDeleted: true,
    });
    if (!useCase) {
      throw new ApiError(404, "Không tìm thấy nhu cầu sử dụng");
    }

    if (!useCase.deletedAt) {
      throw new ApiError(400, "Nhu cầu sử dụng chưa bị xóa");
    }

    // Khôi phục
    useCase.deletedAt = null;
    useCase.deletedBy = null;

    await useCase.save();

    return {
      success: true,
      message: "Khôi phục nhu cầu sử dụng thành công",
      useCase,
    };
  },

  /**
   * Lấy danh sách nhu cầu sử dụng đang active cho public API
   */
  getPublicUseCases: async () => {
    const useCases = await UseCase.find({
      isActive: true,
      deletedAt: null,
    })
      .select("name description")
      .sort("name");

    return {
      success: true,
      useCases,
    };
  },
};

module.exports = useCaseService;
