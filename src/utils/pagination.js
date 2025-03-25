/**
 * Hàm phân trang cho Mongoose
 * @param {Object} model - Mongoose model cần truy vấn
 * @param {Object} query - Đối tượng lọc dữ liệu
 * @param {Object} options - Các tùy chọn phân trang: page, limit, sort, select, populate
 * @returns {Promise<Object>} - Kết quả phân trang chứa tổng số bản ghi, số trang, trang hiện tại và dữ liệu
 */
const paginate = async (model, query, options = {}) => {
  // Trang hiện tại (mặc định là 1 nếu không cung cấp)
  const page = parseInt(options.page, 10) || 1;
  // Số bản ghi mỗi trang (mặc định là 10 nếu không cung cấp)
  const limit = parseInt(options.limit, 10) || 10;
  // Tính toán số bản ghi cần bỏ qua
  const skip = (page - 1) * limit;

  // Xử lý truy vấn cơ bản
  let queryBuilder = model.find(query);

  // Thêm select để chỉ lấy các trường cần thiết
  if (options.select) {
    queryBuilder = queryBuilder.select(options.select);
  }

  // Thêm populate nếu cần
  if (options.populate) {
    if (Array.isArray(options.populate)) {
      options.populate.forEach((item) => {
        queryBuilder = queryBuilder.populate(item);
      });
    } else {
      queryBuilder = queryBuilder.populate(options.populate);
    }
  }

  // Thêm sắp xếp
  queryBuilder = queryBuilder.sort(options.sort || { createdAt: -1 });

  // Đếm tổng số bản ghi thỏa mãn query
  const countPromise = model.countDocuments(query);

  // Thêm phân trang
  queryBuilder = queryBuilder.skip(skip).limit(limit);

  // Thực hiện cả hai truy vấn đồng thời để tối ưu hiệu suất
  const [total, data] = await Promise.all([countPromise, queryBuilder]);

  // Tính tổng số trang
  const totalPages = Math.ceil(total / limit);

  // Trả về đối tượng kết quả
  return {
    success: true,
    count: data.length,
    total,
    totalPages,
    currentPage: page,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    data,
  };
};

module.exports = paginate;
