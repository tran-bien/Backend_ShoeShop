/**
 * Service xử lý phân trang chung cho các API
 */
const paginationService = {
  /**
   * Tạo truy vấn phân trang từ các tham số yêu cầu
   * @param {Object} reqQuery - Các tham số truy vấn từ request
   * @param {Object} options - Các tùy chọn bổ sung cho phân trang
   * @returns {Object} - Các tham số phân trang và sắp xếp đã được xử lý
   */
  createPaginationQuery: (reqQuery, options = {}) => {
    // Mặc định page = 1, limit = 10
    const page = parseInt(reqQuery.page) || 1;
    const limit = parseInt(reqQuery.limit) || 10;
    const skip = (page - 1) * limit;

    // Xử lý sắp xếp
    let sortBy = reqQuery.sortBy || options.defaultSortField || "createdAt";
    let sortOrder = reqQuery.sortOrder || options.defaultSortOrder || "desc";

    // Đảm bảo sortOrder chỉ là 'asc' hoặc 'desc'
    sortOrder = ["asc", "desc"].includes(sortOrder.toLowerCase())
      ? sortOrder.toLowerCase()
      : "desc";

    // Tạo đối tượng sắp xếp
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    return {
      pagination: {
        page,
        limit,
        skip,
      },
      sort,
    };
  },

  /**
   * Tạo phản hồi phân trang
   * @param {Array} data - Dữ liệu đã phân trang
   * @param {number} total - Tổng số bản ghi
   * @param {Object} pagination - Thông tin phân trang
   * @returns {Object} - Phản hồi được định dạng với thông tin phân trang
   */
  createPaginationResponse: (data, total, pagination) => {
    const { page, limit } = pagination;
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data,
      pagination: {
        total,
        totalPages,
        page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  },

  /**
   * Áp dụng các tùy chọn tìm kiếm và lọc vào truy vấn
   * @param {Object} reqQuery - Các tham số truy vấn từ request
   * @param {Object} searchOptions - Cấu hình các trường có thể tìm kiếm
   * @returns {Object} - Đối tượng truy vấn MongoDB
   */
  applyFilters: (reqQuery, searchOptions = {}) => {
    const query = {};
    const filters = { ...reqQuery };

    // Loại bỏ các tham số phân trang và sắp xếp
    const excludedFields = [
      "page",
      "limit",
      "sortBy",
      "sortOrder",
      "search",
      "searchFields",
    ];
    excludedFields.forEach((field) => delete filters[field]);

    // Xử lý tìm kiếm
    if (
      reqQuery.search &&
      searchOptions.searchableFields &&
      searchOptions.searchableFields.length > 0
    ) {
      // Xác định các trường cần tìm kiếm
      const searchFields = reqQuery.searchFields
        ? reqQuery.searchFields
            .split(",")
            .filter((field) => searchOptions.searchableFields.includes(field))
        : searchOptions.searchableFields;

      if (searchFields.length > 0) {
        // Tạo truy vấn tìm kiếm cho nhiều trường
        query.$or = searchFields.map((field) => ({
          [field]: { $regex: reqQuery.search, $options: "i" },
        }));
      }
    }

    // Thêm các bộ lọc khác
    Object.keys(filters).forEach((key) => {
      if (
        searchOptions.filterableFields &&
        searchOptions.filterableFields.includes(key)
      ) {
        // Xử lý các phép so sánh đặc biệt (gt, gte, lt, lte)
        if (typeof filters[key] === "string" && filters[key].includes(",")) {
          // Xử lý trường hợp nhiều giá trị (IN)
          query[key] = { $in: filters[key].split(",") };
        } else if (
          searchOptions.numericFields &&
          searchOptions.numericFields.includes(key)
        ) {
          // Xử lý trường số
          query[key] = parseFloat(filters[key]);
        } else if (
          searchOptions.booleanFields &&
          searchOptions.booleanFields.includes(key)
        ) {
          // Xử lý trường boolean
          query[key] = filters[key] === "true";
        } else {
          query[key] = filters[key];
        }
      }
    });

    return query;
  },
};

module.exports = paginationService;
