const { Product, Category, Brand, Color, Size, Variant } = require("@models");
const ApiError = require("@utils/ApiError");
const filterService = {
  /**
   * Lấy tất cả thuộc tính dùng cho bộ lọc
   * Trả về danh sách categories, brands, colors, sizes và khoảng giá
   */
  getFilterAttributes: async () => {
    // Lấy các danh mục đang active
    const categories = await Category.find({ isActive: true }).select(
      "name _id"
    );

    // Lấy các thương hiệu đang active
    const brands = await Brand.find({ isActive: true }).select("name logo _id");

    // Lấy các màu sắc đang active
    const colors = await Color.find({ isActive: true }).select(
      "name code type colors _id"
    );

    // Lấy các kích thước đang active
    const sizes = await Size.find({ isActive: true }).select(
      "value description _id"
    );

    // Tính khoảng giá từ variants có sẵn (chỉ lấy các variant đang active)
    const priceRange = await Variant.aggregate([
      { $match: { isActive: true, deletedAt: null } },
      {
        $group: {
          _id: null,
          minPrice: { $min: "$priceFinal" },
          maxPrice: { $max: "$priceFinal" },
        },
      },
    ]);

    // Nếu không có variants nào, sử dụng giá trị mặc định
    const minPrice =
      priceRange.length > 0 ? Math.floor(priceRange[0].minPrice) : 0;
    const maxPrice =
      priceRange.length > 0 ? Math.ceil(priceRange[0].maxPrice) : 10000000;

    // Giá trị giới tính
    const genders = [
      { id: "male", name: "Nam" },
      { id: "female", name: "Nữ" },
    ];

    return {
      success: true,
      filters: {
        categories,
        brands,
        colors,
        sizes,
        priceRange: { min: minPrice, max: maxPrice },
        genders,
      },
    };
  },

  /**
   * Gợi ý tìm kiếm dựa trên từ khóa
   * @param {String} keyword - Từ khóa tìm kiếm
   * @param {Number} limit - Số lượng kết quả trả về
   */
  getSuggestions: async (keyword, limit = 5) => {
    if (!keyword || keyword.trim().length < 2) {
      return {
        success: true,
        suggestions: [],
      };
    }

    const sanitizedKeyword = keyword.trim();

    // Tìm kiếm sản phẩm theo tên
    const productSuggestions = await Product.find({
      name: { $regex: sanitizedKeyword, $options: "i" },
      isActive: true,
      deletedAt: null,
    })
      .limit(Number(limit))
      .select("name slug images")
      .lean();

    // Tìm kiếm danh mục theo tên
    const categorySuggestions = await Category.find({
      name: { $regex: sanitizedKeyword, $options: "i" },
      isActive: true,
    })
      .limit(3)
      .select("name slug")
      .lean();

    // Tìm kiếm thương hiệu theo tên
    const brandSuggestions = await Brand.find({
      name: { $regex: sanitizedKeyword, $options: "i" },
      isActive: true,
    })
      .limit(3)
      .select("name logo")
      .lean();

    // Định dạng kết quả gợi ý
    const formatProducts = productSuggestions.map((product) => ({
      type: "product",
      id: product._id,
      name: product.name,
      slug: product.slug,
      image:
        product.images && product.images.length > 0
          ? product.images.find((img) => img.isMain)?.url ||
            product.images[0].url
          : null,
    }));

    const formatCategories = categorySuggestions.map((category) => ({
      type: "category",
      id: category._id,
      name: category.name,
      slug: category.slug,
    }));

    const formatBrands = brandSuggestions.map((brand) => ({
      type: "brand",
      id: brand._id,
      name: brand.name,
      logo: brand.logo,
    }));

    // Gộp và sắp xếp kết quả
    const suggestions = [
      ...formatProducts,
      ...formatCategories,
      ...formatBrands,
    ].slice(0, Number(limit));

    return {
      success: true,
      suggestions,
      keyword: sanitizedKeyword,
    };
  },
};

module.exports = filterService;
