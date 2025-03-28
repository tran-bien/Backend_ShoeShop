const { Size } = require("@models");
const paginate = require("@utils/pagination");

const sizeService = {
  /**
   * Lấy danh sách kích thước
   * @param {Object} queryOptions - Các tham số truy vấn
   * @param {boolean} includeDeleted - Có bao gồm các kích thước đã xóa không
   */
  getSizes: async (queryOptions, includeDeleted = false) => {
    try {
      const { page = 1, limit = 10, value, description, sort } = queryOptions;

      // Xây dựng query
      const query = {};

      // Chỉ lấy những kích thước chưa bị xóa trừ khi có yêu cầu bao gồm cả đã xóa
      if (!includeDeleted) {
        query.deletedAt = null;
      }

      // Tìm theo giá trị
      if (value !== undefined) {
        query.value = Number(value);
      }

      // Tìm theo mô tả
      if (description) {
        query.description = { $regex: description, $options: "i" };
      }

      // Xử lý sắp xếp
      let sortOptions;
      try {
        sortOptions = sort ? JSON.parse(sort) : { value: 1 };
      } catch (error) {
        console.error("Error parsing sort:", error);
        sortOptions = { value: 1 };
      }

      // Các tùy chọn phân trang
      const options = {
        page,
        limit,
        sort: sortOptions,
      };

      // Thực hiện phân trang - sử dụng hàm paginate chung
      return await paginate(Size, query, options);
    } catch (error) {
      console.error("Error in getSizes:", error);
      return {
        success: false,
        message: error.message || "Lỗi khi lấy danh sách kích thước",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  },

  /**
   * Lấy danh sách kích thước đã xóa
   * @param {Object} queryOptions - Các tham số truy vấn
   */
  getDeletedSizes: async (queryOptions) => {
    try {
      const { page = 1, limit = 10, value, description, sort } = queryOptions;

      // Xây dựng query
      let filter = {};

      // Tìm theo giá trị
      if (value !== undefined) {
        filter.value = Number(value);
      }

      // Tìm theo mô tả
      if (description) {
        filter.description = { $regex: description, $options: "i" };
      }

      // Xử lý sắp xếp
      let sortOptions;
      try {
        sortOptions = sort ? JSON.parse(sort) : { deletedAt: -1 };
      } catch (error) {
        console.error("Error parsing sort:", error);
        sortOptions = { deletedAt: -1 };
      }

      // Lấy danh sách kích thước đã xóa với phân trang
      const sizes = await Size.findDeleted(filter, {
        page,
        limit,
        sort: sortOptions,
      });

      // Đếm tổng số kích thước đã xóa
      const totalItems = await Size.countDeleted(filter);
      const totalPages = Math.ceil(totalItems / parseInt(limit));

      return {
        success: true,
        data: sizes,
        pagination: {
          totalItems,
          currentPage: parseInt(page),
          pageSize: parseInt(limit),
          totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
      };
    } catch (error) {
      console.error("Error in getDeletedSizes:", error);
      return {
        success: false,
        message: error.message || "Lỗi khi lấy danh sách kích thước đã xóa",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  },

  /**
   * Lấy chi tiết kích thước theo ID
   * @param {string} id - ID của kích thước
   * @param {boolean} includeDeleted - Có bao gồm kích thước đã xóa không
   */
  getSizeById: async (id, includeDeleted = false) => {
    const options = includeDeleted ? { includeDeleted: true } : {};
    const size = await Size.findById(id, null, options);

    if (!size) {
      return { success: false, message: "Không tìm thấy kích thước" };
    }

    return { success: true, size };
  },

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
      return { success: false, message: "Kích thước này đã tồn tại" };
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
      return { success: false, message: "Không tìm thấy kích thước" };
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
        return { success: false, message: "Kích thước này đã tồn tại" };
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
    try {
      // Kiểm tra kích thước tồn tại
      const size = await Size.findById(id);

      if (!size) {
        return { success: false, message: "Không tìm thấy kích thước" };
      }

      // Thực hiện xóa mềm
      await size.softDelete(userId);

      return {
        success: true,
        message: "Xóa kích thước thành công",
      };
    } catch (error) {
      console.error("Error in deleteSize:", error);
      return {
        success: false,
        message: error.message || "Lỗi khi xóa kích thước",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  },

  /**
   * Khôi phục kích thước đã xóa
   * @param {string} id - ID kích thước
   */
  restoreSize: async (id) => {
    try {
      // Sử dụng phương thức tĩnh restoreById từ plugin
      const size = await Size.restoreById(id);

      return {
        success: true,
        message: "Khôi phục kích thước thành công",
        size,
      };
    } catch (error) {
      console.error("Error in restoreSize:", error);
      return {
        success: false,
        message: error.message || "Lỗi khi khôi phục kích thước",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  },
};

module.exports = sizeService;
