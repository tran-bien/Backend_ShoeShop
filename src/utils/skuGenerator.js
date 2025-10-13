/**
 * SKU Generator Utility
 *
 * Tạo SKU (Stock Keeping Unit) cho quản lý kho
 * Format: {PRODUCT_CODE}-{COLOR_CODE}-{GENDER}-{SIZE}-{RANDOM}
 * Example: NKE-BLK-M-40-A1B2
 */

/**
 * Chuẩn hóa string thành code
 * @param {String} str - String cần chuẩn hóa
 * @param {Number} length - Độ dài code
 * @returns {String} - Code đã chuẩn hóa
 */
const normalizeToCode = (str, length = 3) => {
  if (!str) return "XXX".substring(0, length);

  // Xóa dấu tiếng Việt
  const normalized = str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (normalized.length >= length) {
    return normalized.substring(0, length);
  }

  // Nếu quá ngắn, pad với X
  return normalized.padEnd(length, "X");
};

/**
 * Lấy gender code
 * @param {String} gender - male, female, unisex
 * @returns {String} - M, F, hoặc U
 */
const getGenderCode = (gender) => {
  const genderMap = {
    male: "M",
    female: "F",
    unisex: "U",
  };
  return genderMap[gender?.toLowerCase()] || "U";
};

/**
 * Generate random string
 * @param {Number} length - Độ dài
 * @returns {String} - Random string
 */
const generateRandomCode = (length = 4) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generate SKU cho variant size
 * @param {Object} params - Tham số
 * @param {String} params.productName - Tên sản phẩm
 * @param {String} params.colorName - Tên màu sắc
 * @param {String} params.gender - Giới tính (male/female/unisex)
 * @param {String} params.sizeValue - Giá trị size (38, 39, 40, M, L, XL...)
 * @param {String} params.productId - ID sản phẩm (optional, để tạo unique)
 * @returns {String} - SKU duy nhất
 *
 * @example
 * generateSKU({
 *   productName: "Nike Air Max",
 *   colorName: "Black",
 *   gender: "male",
 *   sizeValue: "40"
 * })
 * // Returns: "NIK-BLA-M-40-A1B2"
 */
const generateSKU = ({
  productName,
  colorName,
  gender,
  sizeValue,
  productId,
}) => {
  // Product code - 3 ký tự đầu của tên sản phẩm
  const productCode = normalizeToCode(productName, 3);

  // Color code - 3 ký tự đầu của màu
  const colorCode = normalizeToCode(colorName, 3);

  // Gender code - 1 ký tự
  const genderCode = getGenderCode(gender);

  // Size value - chuẩn hóa
  const sizeCode = normalizeToCode(sizeValue.toString(), 3);

  // Random code để đảm bảo unique - 4 ký tự
  const randomCode = generateRandomCode(4);

  // Kết hợp thành SKU
  const sku = `${productCode}-${colorCode}-${genderCode}-${sizeCode}-${randomCode}`;

  return sku;
};

/**
 * Validate SKU format
 * @param {String} sku - SKU cần validate
 * @returns {Boolean} - true nếu hợp lệ
 */
const isValidSKU = (sku) => {
  if (!sku || typeof sku !== "string") return false;

  // Format: XXX-XXX-X-XXX-XXXX
  const skuPattern =
    /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z]-[A-Z0-9]{1,3}-[A-Z0-9]{4}$/;
  return skuPattern.test(sku);
};

/**
 * Parse SKU thành components
 * @param {String} sku - SKU cần parse
 * @returns {Object} - Components của SKU
 */
const parseSKU = (sku) => {
  if (!isValidSKU(sku)) {
    return null;
  }

  const parts = sku.split("-");
  return {
    productCode: parts[0],
    colorCode: parts[1],
    genderCode: parts[2],
    sizeCode: parts[3],
    randomCode: parts[4],
  };
};

module.exports = {
  generateSKU,
  isValidSKU,
  parseSKU,
  normalizeToCode,
  getGenderCode,
  generateRandomCode,
};
