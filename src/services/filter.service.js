const {
  Product,
  Category,
  Brand,
  Color,
  Size,
  Variant,
  Tag,
  InventoryItem,
} = require("@models");
const ApiError = require("@utils/ApiError");

const filterService = {
  /**
   * Lấy tất cả thuộc tính dùng cho bộ lọc
   * Trả về danh sách categories, brands, colors, sizes và khoảng giá
   */
  getFilterAttributes: async () => {
    // Lấy các danh mục đang active
    const categories = await Category.find({ isActive: true, deletedAt: null })
      .select("name _id slug")
      .sort({ name: 1 });

    // Lấy các thương hiệu đang active
    const brands = await Brand.find({ isActive: true, deletedAt: null })
      .select("name logo _id slug")
      .sort({ name: 1 });

    // Lấy các màu sắc (chưa bị xóa mềm)
    const colors = await Color.find({ deletedAt: null })
      .select("name code type colors _id")
      .sort({ name: 1 });

    // Lấy các kích thước (chưa bị xóa mềm)
    const sizes = await Size.find({ deletedAt: null })
      .select("value type description _id")
      .sort({ value: 1 });

    // Lấy các tags đang active
    const tags = await Tag.find({ isActive: true, deletedAt: null })
      .select("name type description _id")
      .sort({ type: 1, name: 1 });

    // TÍNH KHOẢNG GIÁ TỪ INVENTORYITEM
    const priceRange = await InventoryItem.aggregate([
      {
        $match: {
          quantity: { $gt: 0 }, // Chỉ tính các sản phẩm còn hàng
        },
      },
      {
        $lookup: {
          from: "variants",
          localField: "variant",
          foreignField: "_id",
          as: "variantInfo",
        },
      },
      {
        $unwind: "$variantInfo",
      },
      {
        $match: {
          "variantInfo.isActive": true,
          "variantInfo.deletedAt": null,
        },
      },
      {
        $group: {
          _id: null,
          minPrice: { $min: "$finalPrice" },
          maxPrice: { $max: "$finalPrice" },
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

    // Chuyển đổi màu sắc để dễ sử dụng cho frontend
    const formattedColors = colors.map((color) => {
      const formattedColor = {
        _id: color._id,
        id: color._id,
        name: color.name,
        type: color.type,
      };

      if (color.type === "solid") {
        formattedColor.code = color.code;
      } else if (
        color.type === "half" &&
        Array.isArray(color.colors) &&
        color.colors.length === 2
      ) {
        formattedColor.colors = color.colors;
      }

      return formattedColor;
    });

    // Định dạng lại sizes để dễ sử dụng
    const formattedSizes = sizes.map((size) => ({
      _id: size._id,
      id: size._id,
      value: size.value,
      type: size.type,
      description: size.description,
    }));

    return {
      success: true,
      filters: {
        categories,
        brands,
        colors: formattedColors,
        sizes: formattedSizes,
        tags,
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
    const limitNum = Number(limit) || 5;

    // Tìm ID của các sản phẩm có biến thể hợp lệ (chưa bị xóa và đang active)
    const productIdsWithVariants = await Variant.distinct("product", {
      isActive: true,
      deletedAt: null,
    });

    // Tìm kiếm sản phẩm theo tên và chỉ lấy những sản phẩm có biến thể hợp lệ
    const productSuggestions = await Product.find({
      name: { $regex: sanitizedKeyword, $options: "i" },
      isActive: true,
      deletedAt: null,
      _id: { $in: productIdsWithVariants }, // Chỉ lấy sản phẩm có biến thể
    })
      .limit(limitNum)
      .select("name slug images")
      .lean();

    // Tìm kiếm danh mục theo tên
    const categorySuggestions = await Category.find({
      name: { $regex: sanitizedKeyword, $options: "i" },
      isActive: true,
      deletedAt: null,
    })
      .limit(3)
      .select("name slug")
      .lean();

    // Tìm kiếm thương hiệu theo tên
    const brandSuggestions = await Brand.find({
      name: { $regex: sanitizedKeyword, $options: "i" },
      isActive: true,
      deletedAt: null,
    })
      .limit(3)
      .select("name logo slug")
      .lean();

    // Tìm kiếm tags theo tên
    const tagSuggestions = await Tag.find({
      name: { $regex: sanitizedKeyword, $options: "i" },
      isActive: true,
      deletedAt: null,
    })
      .limit(5)
      .select("name type description")
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
      slug: brand.slug,
      logo: brand.logo,
    }));

    const formatTags = tagSuggestions.map((tag) => ({
      type: "tag",
      tagType: tag.type, // MATERIAL, USECASE, or CUSTOM
      id: tag._id,
      name: tag.name,
      description: tag.description,
    }));

    // Gộp và sắp xếp kết quả
    const suggestions = [
      ...formatProducts,
      ...formatCategories,
      ...formatBrands,
      ...formatTags,
    ].slice(0, limitNum);

    return {
      success: true,
      suggestions,
      keyword: sanitizedKeyword,
    };
  },
};

module.exports = filterService;
