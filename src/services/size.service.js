const { Size } = require("@models");
const paginate = require("@utils/pagination");
const paginateDeleted = require("@utils/paginationDeleted");

const sizeService = {
  // === ADMIN API METHODS ===

  /**
   * [ADMIN] Lấy tất cả kích thước (bao gồm cả đã xóa nếu chỉ định)
   * @param {Object} query - Các tham số truy vấn
   */
  getAdminSizes: async (query) => {
    const { page = 1, limit = 10, value, description, sort } = query;
    const filter = { deletedAt: null }; // Mặc định chỉ lấy các kích thước chưa xóa

    // Tìm theo giá trị
    if (value !== undefined) {
      filter.value = Number(value);
    }

    // Tìm theo mô tả
    if (description) {
      filter.description = { $regex: description, $options: "i" };
    }

    const options = {
      page,
      limit,
      sort: sort ? JSON.parse(sort) : { createdAt: -1 },
    };

    return await paginate(Size, filter, options);
  },

  /**
   * [ADMIN] Lấy kích thước theo ID (bao gồm cả đã xóa mềm)
   * @param {string} id - ID của kích thước
   */
  getAdminSizeById: async (id) => {
    // Sử dụng setOptions để bao gồm cả kích thước đã xóa
    const size = await Size.findById(id).setOptions({
      includeDeleted: true,
    });

    if (!size) {
      const error = new Error("Không tìm thấy kích thước");
      error.statusCode = 404; // Not Found
      throw error;
    }

    return { success: true, size };
  },

  /**
   * [ADMIN] Lấy danh sách kích thước đã xóa
   * @param {Object} query - Các tham số truy vấn
   */
  getDeletedSizes: async (query) => {
    const { page = 1, limit = 10, value, description, sort } = query;
    const filter = {};

    if (value !== undefined) {
      filter.value = Number(value);
    }

    if (description) {
      filter.description = { $regex: description, $options: "i" };
    }

    const options = {
      page,
      limit,
      sort: sort ? JSON.parse(sort) : { deletedAt: -1 },
    };

    return await paginateDeleted(Size, filter, options);
  },

  // === COMMON OPERATIONS ===

  /**
   * Tạo kích thước mới
   * @param {Object} sizeData - Dữ liệu kích thước
   */
  createSize: async (sizeData) => {
    // Kiểm tra xem kích thước có tồn tại chưa (same value and description)
    const existingSize = await Size.findOne({
      value: sizeData.value,
      description: sizeData.description,
    });

    if (existingSize) {
      const error = new Error("Kích thước này đã tồn tại");
      error.statusCode = 409; // Conflict
      throw error;
    }

    // Tạo kích thước mới
    const size = await Size.create(sizeData);

    return {
      success: true,
      message: "Tạo kích thước thành công",
      size,
    };
  },

  /**
   * Cập nhật kích thước
   * @param {string} id - ID kích thước
   * @param {Object} updateData - Dữ liệu cập nhật
   */
  updateSize: async (id, updateData) => {
    // Kiểm tra kích thước tồn tại
    const size = await Size.findById(id);

    if (!size) {
      const error = new Error("Không tìm thấy kích thước");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Kiểm tra xem kích thước sau khi cập nhật có trùng với kích thước khác không
    if (
      updateData.value !== undefined ||
      updateData.description !== undefined
    ) {
      const valueToCheck =
        updateData.value !== undefined ? updateData.value : size.value;
      const descriptionToCheck =
        updateData.description !== undefined
          ? updateData.description
          : size.description;

      const existingSize = await Size.findOne({
        value: valueToCheck,
        description: descriptionToCheck,
        _id: { $ne: id },
      });

      if (existingSize) {
        const error = new Error("Kích thước này đã tồn tại");
        error.statusCode = 409; // Conflict
        throw error;
      }
    }

    // Cập nhật kích thước
    const updatedSize = await Size.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return {
      success: true,
      message: "Cập nhật kích thước thành công",
      size: updatedSize,
    };
  },

  /**
   * Xóa mềm kích thước
   * @param {string} id - ID kích thước
   * @param {string} userId - ID người dùng thực hiện xóa
   */
  deleteSize: async (id, userId) => {
    // Kiểm tra kích thước tồn tại
    const size = await Size.findById(id);

    if (!size) {
      const error = new Error("Không tìm thấy kích thước");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Thực hiện xóa mềm
    await size.softDelete(userId);

    return {
      success: true,
      message: "Xóa kích thước thành công",
    };
  },

  /**
   * Khôi phục kích thước đã xóa
   * @param {string} id - ID kích thước
   */
  restoreSize: async (id) => {
    // Sử dụng phương thức tĩnh restoreById từ plugin
    const size = await Size.restoreById(id);

    return {
      success: true,
      message: "Khôi phục kích thước thành công",
      size,
    };
  },
};

module.exports = sizeService;
