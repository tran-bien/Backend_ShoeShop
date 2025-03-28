const { Color } = require("@models");
const paginate = require("@utils/pagination");

const colorService = {
  /**
   * Lấy danh sách màu sắc
   * @param {Object} queryOptions - Các tham số truy vấn
   * @param {boolean} includeDeleted - Có bao gồm các màu đã xóa không
   */
  getColors: async (queryOptions, includeDeleted = false) => {
    try {
      const { page = 1, limit = 10, name, type, sort } = queryOptions;

      // Xây dựng query
      const query = {};

      // Chỉ lấy những màu chưa bị xóa trừ khi có yêu cầu bao gồm cả đã xóa
      if (!includeDeleted) {
        query.deletedAt = null;
      }

      // Tìm theo tên
      if (name) {
        query.name = { $regex: name, $options: "i" };
      }

      // Tìm theo loại
      if (type) {
        query.type = type;
      }

      // Xử lý sắp xếp
      let sortOptions;
      try {
        sortOptions = sort ? JSON.parse(sort) : { createdAt: -1 };
      } catch (error) {
        console.error("Error parsing sort:", error);
        sortOptions = { createdAt: -1 };
      }

      // Các tùy chọn phân trang
      const options = {
        page,
        limit,
        sort: sortOptions,
      };

      // Thực hiện phân trang - sử dụng hàm paginate chung
      return await paginate(Color, query, options);
    } catch (error) {
      console.error("Error in getColors:", error);
      return {
        success: false,
        message: error.message || "Lỗi khi lấy danh sách màu sắc",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  },

  /**
   * Lấy danh sách màu sắc đã xóa
   * @param {Object} queryOptions - Các tham số truy vấn
   */
  getDeletedColors: async (queryOptions) => {
    try {
      const { page = 1, limit = 10, name, type, sort } = queryOptions;

      // Xây dựng query
      let filter = {};

      // Tìm theo tên
      if (name) {
        filter.name = { $regex: name, $options: "i" };
      }

      // Tìm theo loại
      if (type) {
        filter.type = type;
      }

      // Xử lý sắp xếp
      let sortOptions;
      try {
        sortOptions = sort ? JSON.parse(sort) : { deletedAt: -1 };
      } catch (error) {
        console.error("Error parsing sort:", error);
        sortOptions = { deletedAt: -1 };
      }

      // Lấy danh sách màu đã xóa với phân trang
      const colors = await Color.findDeleted(filter, {
        page,
        limit,
        sort: sortOptions,
      });

      // Đếm tổng số màu đã xóa
      const totalItems = await Color.countDeleted(filter);
      const totalPages = Math.ceil(totalItems / parseInt(limit));

      return {
        success: true,
        data: colors,
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
      console.error("Error in getDeletedColors:", error);
      return {
        success: false,
        message: error.message || "Lỗi khi lấy danh sách màu đã xóa",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  },

  /**
   * Lấy chi tiết màu sắc theo ID
   * @param {string} id - ID của màu sắc
   * @param {boolean} includeDeleted - Có bao gồm màu đã xóa không
   */
  getColorById: async (id, includeDeleted = false) => {
    const options = includeDeleted ? { includeDeleted: true } : {};
    const color = await Color.findById(id, null, options);

    if (!color) {
      return { success: false, message: "Không tìm thấy màu sắc" };
    }

    return { success: true, color };
  },

  /**
   * Tạo màu sắc mới
   * @param {Object} colorData - Dữ liệu màu sắc
   */
  createColor: async (colorData) => {
    // Kiểm tra xem màu sắc có tồn tại chưa theo tên
    const existingColorName = await Color.findOne({ name: colorData.name });
    if (existingColorName) {
      return { success: false, message: "Tên màu đã tồn tại" };
    }

    // Kiểm tra trùng mã màu cho màu solid
    if (colorData.type === "solid" && colorData.code) {
      const existingColorCode = await Color.findOne({
        code: colorData.code.toUpperCase(), // Đảm bảo so khớp in hoa
        type: "solid",
      });

      if (existingColorCode) {
        return {
          success: false,
          message: `Mã màu ${colorData.code} đã được sử dụng bởi màu "${existingColorCode.name}"`,
        };
      }
    }

    // Kiểm tra trùng mã màu cho màu half
    if (
      colorData.type === "half" &&
      Array.isArray(colorData.colors) &&
      colorData.colors.length === 2
    ) {
      // Chuẩn hóa mã màu sang chữ in hoa để so sánh
      const normalizedColors = colorData.colors.map((color) =>
        color.toUpperCase()
      );

      // Tìm tất cả màu half
      const halfColors = await Color.find({ type: "half" });

      // Kiểm tra từng màu half xem có bộ màu giống nhau không (bất kể thứ tự)
      for (const halfColor of halfColors) {
        if (!halfColor.colors || halfColor.colors.length !== 2) continue;

        const existingColors = halfColor.colors.map((color) =>
          color.toUpperCase()
        );

        // Kiểm tra nếu 2 mảng có cùng các phần tử (không quan tâm thứ tự)
        if (
          (normalizedColors[0] === existingColors[0] &&
            normalizedColors[1] === existingColors[1]) ||
          (normalizedColors[0] === existingColors[1] &&
            normalizedColors[1] === existingColors[0])
        ) {
          return {
            success: false,
            message: `Bộ màu này đã được sử dụng bởi màu "${halfColor.name}"`,
          };
        }
      }
    }

    // Tạo màu sắc mới
    const color = await Color.create(colorData);

    return {
      success: true,
      message: "Tạo màu sắc thành công",
      color,
    };
  },

  /**
   * Cập nhật màu sắc
   * @param {string} id - ID màu sắc
   * @param {Object} updateData - Dữ liệu cập nhật
   */
  updateColor: async (id, updateData) => {
    // Kiểm tra màu sắc tồn tại
    const color = await Color.findById(id);

    if (!color) {
      return { success: false, message: "Không tìm thấy màu sắc" };
    }

    // Kiểm tra nếu đang cập nhật tên, xem tên đã tồn tại chưa
    if (updateData.name && updateData.name !== color.name) {
      const existingColor = await Color.findOne({ name: updateData.name });

      if (existingColor) {
        return { success: false, message: "Tên màu đã tồn tại" };
      }
    }

    // Kiểm tra mã màu trùng lặp khi cập nhật màu solid
    if (updateData.type === "solid" && updateData.code) {
      const existingColorCode = await Color.findOne({
        code: updateData.code.toUpperCase(),
        type: "solid",
        _id: { $ne: id }, // Loại trừ chính màu hiện tại
      });

      if (existingColorCode) {
        return {
          success: false,
          message: `Mã màu ${updateData.code} đã được sử dụng bởi màu "${existingColorCode.name}"`,
        };
      }
    }

    // Kiểm tra bộ màu trùng lặp khi cập nhật màu half
    if (
      (updateData.type === "half" ||
        (!updateData.type && color.type === "half")) &&
      Array.isArray(updateData.colors) &&
      updateData.colors.length === 2
    ) {
      // Chuẩn hóa mã màu sang chữ in hoa để so sánh
      const normalizedColors = updateData.colors.map((color) =>
        color.toUpperCase()
      );

      // Tìm tất cả màu half
      const halfColors = await Color.find({
        type: "half",
        _id: { $ne: id }, // Loại trừ chính màu hiện tại
      });

      // Kiểm tra từng màu half xem có bộ màu giống nhau không
      for (const halfColor of halfColors) {
        if (!halfColor.colors || halfColor.colors.length !== 2) continue;

        const existingColors = halfColor.colors.map((color) =>
          color.toUpperCase()
        );

        // Kiểm tra nếu 2 mảng có cùng các phần tử (không quan tâm thứ tự)
        if (
          (normalizedColors[0] === existingColors[0] &&
            normalizedColors[1] === existingColors[1]) ||
          (normalizedColors[0] === existingColors[1] &&
            normalizedColors[1] === existingColors[0])
        ) {
          return {
            success: false,
            message: `Bộ màu này đã được sử dụng bởi màu "${halfColor.name}"`,
          };
        }
      }
    }

    // Cập nhật màu sắc
    const updatedColor = await Color.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return {
      success: true,
      message: "Cập nhật màu sắc thành công",
      color: updatedColor,
    };
  },

  /**
   * Xóa mềm màu sắc
   * @param {string} id - ID màu sắc
   * @param {string} userId - ID người dùng thực hiện xóa
   */
  deleteColor: async (id, userId) => {
    try {
      // Kiểm tra màu sắc tồn tại
      const color = await Color.findById(id);

      if (!color) {
        return { success: false, message: "Không tìm thấy màu sắc" };
      }

      // Thực hiện xóa mềm
      await color.softDelete(userId);

      return {
        success: true,
        message: "Xóa màu sắc thành công",
      };
    } catch (error) {
      console.error("Error in deleteColor:", error);
      return {
        success: false,
        message: error.message || "Lỗi khi xóa màu sắc",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  },

  /**
   * Khôi phục màu sắc đã xóa
   * @param {string} id - ID màu sắc
   */
  restoreColor: async (id) => {
    try {
      // Sử dụng phương thức tĩnh restoreById từ plugin
      const color = await Color.restoreById(id);

      return {
        success: true,
        message: "Khôi phục màu sắc thành công",
        color,
      };
    } catch (error) {
      console.error("Error in restoreColor:", error);
      return {
        success: false,
        message: error.message || "Lỗi khi khôi phục màu sắc",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  },
};

module.exports = colorService;
