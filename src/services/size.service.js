const { Size, Variant } = require("@models");
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
      case "value_asc":
        sortOption = { value: 1 };
        break;
      case "value_desc":
        sortOption = { value: -1 };
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

const sizeService = {
  // === ADMIN API METHODS ===

  /**
   * [ADMIN] Lấy tất cả kích thước (bao gồm cả đã xóa nếu chỉ định)
   * @param {Object} query - Các tham số truy vấn
   */
  getAdminSizes: async (query) => {
    const { page = 1, limit = 50, value, description, sort } = query;
    
    // Chuyển đổi page và limit sang number
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 50;
    
    const filter = { deletedAt: null }; // Mặc định chỉ lấy các kích thước chưa xóa

    // Tìm theo giá trị
    if (value !== undefined) {
      filter.value = Number(value);
    }

    // Tìm theo mô tả
    if (description) {
      filter.description = { $regex: description, $options: "i" };
    }

    // Đếm tổng số kích thước thỏa mãn điều kiện
    const total = await Size.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    // Tính toán skip để phân trang
    const skip = (pageNum - 1) * limitNum;
    
    // Sắp xếp
    const sortOption = sort ? getSortOption(sort) : { createdAt: -1 };

    // Lấy dữ liệu với phân trang
    const sizes = await Size.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum);

    // Trả về kết quả với thông tin phân trang chính xác
    return {
      success: true,
      count: sizes.length,
      total,
      totalPages,
      currentPage: pageNum,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
      data: sizes,
    };
  },

  /**
   * [ADMIN] Lấy kích thước theo ID (bao gồm cả đã xóa mềm)
   * @param {string} id - ID của kích thước
   */
  getAdminSizeById: async (id) => {
    // Sử dụng setOptions để bao gồm cả kích thước đã xóa
    const size = await Size.findById(id)
      .setOptions({
        includeDeleted: true,
      })
      .populate("deletedBy", "name email");

    if (!size) {
      throw new ApiError(404, `Không tìm thấy kích thước id: ${id}`);
    }

    return { success: true, size };
  },

  /**
   * [ADMIN] Lấy danh sách kích thước đã xóa
   * @param {Object} query - Các tham số truy vấn
   */
  getDeletedSizes: async (query) => {
    const { page = 1, limit = 15, value, description, sort } = query;
    
    // Chuyển đổi page và limit sang number
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 15;
    
    // Xây dựng query cho các kích thước đã xóa
    const filter = { deletedAt: { $ne: null } };

    if (value !== undefined) {
      filter.value = Number(value);
    }

    if (description) {
      filter.description = { $regex: description, $options: "i" };
    }

    // Đếm tổng số kích thước đã xóa thỏa mãn điều kiện
    const total = await Size.countDocuments(filter).setOptions({ includeDeleted: true });
    const totalPages = Math.ceil(total / limitNum);

    // Tính toán skip để phân trang
    const skip = (pageNum - 1) * limitNum;
    
    // Sắp xếp
    const sortOption = sort ? getSortOption(sort) : { deletedAt: -1 };

    // Lấy dữ liệu với phân trang
    const sizes = await Size.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .populate("deletedBy", "name email")
      .setOptions({ includeDeleted: true });

    // Trả về kết quả với thông tin phân trang chính xác
    return {
      success: true,
      count: sizes.length,
      total,
      totalPages,
      currentPage: pageNum,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
      data: sizes,
    };
  },

  // === ADMIN OPERATIONS ===

  /**
   * Tạo kích thước mới
   * @param {Object} sizeData - Dữ liệu kích thước
   */
  createSize: async (sizeData) => {
    // Kiểm tra xem kích thước có tồn tại chưa (bao gồm cả đã xóa mềm)
    const existingSize = await Size.findOne({
      value: sizeData.value,
      description: sizeData.description,
    }).setOptions({ includeDeleted: true });

    if (existingSize) {
      // Phân biệt thông báo dựa trên trạng thái xóa
      if (existingSize.deletedAt) {
        throw new ApiError(
          409,
          `Kích thước value: ${sizeData.value} và description: ${sizeData.description} đã tồn tại trong một kích thước đã xóa. Vui lòng khôi phục hoặc chọn giá trị khác.`
        );
      } else {
        throw new ApiError(
          409,
          `Kích thước value: ${sizeData.value} và description: ${sizeData.description} đã tồn tại`
        );
      }
    }

    // Tạo kích thước mới
    const size = await Size.create(sizeData);

    return {
      success: true,
      message: `Tạo kích thước value: ${size.value} thành công`,
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
      throw new ApiError(404, "Không tìm thấy kích thước");
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

      // Kiểm tra bao gồm cả các kích thước đã xóa mềm
      const existingSize = await Size.findOne({
        value: valueToCheck,
        description: descriptionToCheck,
        _id: { $ne: id },
      }).setOptions({ includeDeleted: true });

      if (existingSize) {
        // Phân biệt thông báo dựa trên trạng thái xóa
        if (existingSize.deletedAt) {
          throw new ApiError(
            409,
            `Kích thước value: ${valueToCheck} và description: ${descriptionToCheck} đã tồn tại trong một kích thước đã xóa. Vui lòng khôi phục hoặc chọn giá trị khác.`
          );
        } else {
          throw new ApiError(
            409,
            `Kích thước value: ${valueToCheck} và description: ${descriptionToCheck} đã tồn tại`
          );
        }
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
      message: `Cập nhật kích thước value: ${updatedSize.value} thành công`,
      size: updatedSize,
    };
  },

  /**
   * Xóa mềm kích thước - với kiểm tra ràng buộc
   * @param {string} id - ID kích thước
   * @param {string} userId - ID người dùng thực hiện xóa
   */
  deleteSize: async (id, userId) => {
    // Kiểm tra kích thước tồn tại
    const size = await Size.findById(id);

    if (!size) {
      throw new ApiError(404, "Không tìm thấy kích thước");
    }

    // Kiểm tra xem kích thước có được sử dụng trong biến thể nào không
    const variantCount = await Variant.countDocuments({
      "sizes.size": id
    });

    // Nếu có biến thể liên kết, thông báo lỗi và không cho xóa
    if (variantCount > 0) {
      throw new ApiError(
        409,
        `Kích thước đang được sử dụng trong ${variantCount} biến thể sản phẩm nên không thể xóa.`
      );
    }

    // Nếu không có biến thể liên kết, tiến hành xóa mềm
    await size.softDelete(userId);

    return {
      success: true,
      message: `Xóa kích thước value: ${size.value} thành công`,
      isDeleted: true,
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
      message: `Khôi phục kích thước value: ${size.value} thành công`,
      size,
    };
  },
};

module.exports = sizeService;