/**
 * Hàm phân trang cho Mongoose
 * @param {Object} model - Mongoose model cần truy vấn
 * @param {Object} query - Đối tượng lọc dữ liệu
 * @param {Object} options - Các tùy chọn phân trang: page, limit, sort
 * @returns {Promise<Object>} - Kết quả phân trang chứa tổng số bản ghi, số trang, trang hiện tại và dữ liệu
 */
const paginate = async (model, query, options) => {
  // Trang hiện tại (mặc định là 1 nếu không cung cấp)
  const page = parseInt(options.page, 10) || 1;
  // Số bản ghi mỗi trang (mặc định là 10 nếu không cung cấp)
  const limit = parseInt(options.limit, 10) || 10;
  // Tính toán số bản ghi cần bỏ qua
  const skip = (page - 1) * limit;

  // Đếm tổng số bản ghi thỏa mãn query
  const total = await model.countDocuments(query);
  // Tính tổng số trang
  const totalPages = Math.ceil(total / limit);
  // Lấy dữ liệu theo query với sắp xếp, bỏ qua và giới hạn bản ghi
  const results = await model
    .find(query)
    .sort(options.sort || {})
    .skip(skip)
    .limit(limit);

  // Trả về đối tượng kết quả
  return {
    total,
    totalPages,
    currentPage: page,
    data: results,
  };
};

module.exports = paginate;
