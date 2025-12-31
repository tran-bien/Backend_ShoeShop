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
      { id: "unisex", name: "Unisex" },
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

  /**
   * Lấy thuộc tính lọc động dựa trên các sản phẩm đã được lọc/tìm kiếm
   * Trả về chỉ những thuộc tính có trong kết quả tìm kiếm
   * @param {Object} query - Các tham số tìm kiếm (name, category, brand, colors, sizes, gender, minPrice, maxPrice)
   */
  getFilterAttributesBySearch: async (query = {}) => {
    const { name, category, brand, colors, sizes, gender, minPrice, maxPrice } =
      query;

    // Nếu không có tham số tìm kiếm nào, trả về tất cả thuộc tính
    if (
      !name &&
      !category &&
      !brand &&
      !colors &&
      !sizes &&
      !gender &&
      !minPrice &&
      !maxPrice
    ) {
      return filterService.getFilterAttributes();
    }

    const mongoose = require("mongoose");

    // Xây dựng filter cơ bản cho sản phẩm
    const productFilter = {
      isActive: true,
      deletedAt: null,
    };

    if (name) {
      productFilter.name = { $regex: name, $options: "i" };
    }

    // Xử lý category (có thể là array hoặc string)
    if (category) {
      const categoryIds = category
        .split(",")
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(String(id)));
      if (categoryIds.length > 0) {
        productFilter.category = { $in: categoryIds };
      }
    }

    // Xử lý brand (có thể là array hoặc string)
    if (brand) {
      const brandIds = brand
        .split(",")
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(String(id)));
      if (brandIds.length > 0) {
        productFilter.brand = { $in: brandIds };
      }
    }

    // Tìm các product IDs phù hợp với filter sản phẩm
    let matchedProducts = await Product.find(productFilter)
      .select("_id category brand")
      .lean();

    if (matchedProducts.length === 0) {
      // Không có sản phẩm nào phù hợp, trả về empty filters
      return {
        success: true,
        filters: {
          categories: [],
          brands: [],
          colors: [],
          sizes: [],
          tags: [],
          priceRange: { min: 0, max: 0 },
          genders: [],
        },
        isFiltered: true,
        matchedProductCount: 0,
      };
    }

    let productIds = matchedProducts.map((p) => p._id);

    // Xây dựng filter cho variants
    const variantFilter = {
      product: { $in: productIds },
      isActive: true,
      deletedAt: null,
    };

    // Xử lý colors filter
    if (colors) {
      const colorIds = colors
        .split(",")
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(String(id)));
      if (colorIds.length > 0) {
        variantFilter.color = { $in: colorIds };
      }
    }

    // Xử lý gender filter - Quan trọng: khi lọc Nam hoặc Nữ, cũng lấy cả Unisex
    if (gender) {
      const genderValues = gender.split(",");
      const expandedGenders = new Set(genderValues);

      // Nếu chọn male hoặc female, thêm unisex vào
      if (genderValues.includes("male") || genderValues.includes("female")) {
        expandedGenders.add("unisex");
      }

      variantFilter.gender = { $in: Array.from(expandedGenders) };
    }

    // Lấy variants phù hợp với filter
    let matchedVariants = await Variant.find(variantFilter)
      .select("product color sizes gender")
      .lean();

    // Xử lý sizes filter - lọc variants có size phù hợp
    if (sizes) {
      const sizeIds = sizes
        .split(",")
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => id);

      matchedVariants = matchedVariants.filter((v) =>
        (v.sizes || []).some((s) => sizeIds.includes(s.size?.toString()))
      );
    }

    // Lấy variant IDs để filter inventory
    const variantIds = matchedVariants.map((v) => v._id);

    // Xử lý price filter thông qua InventoryItem
    let inventoryFilter = {
      variant: { $in: variantIds },
      quantity: { $gt: 0 },
    };

    if (minPrice || maxPrice) {
      inventoryFilter.finalPrice = {};
      if (minPrice) {
        inventoryFilter.finalPrice.$gte = Number(minPrice);
      }
      if (maxPrice) {
        inventoryFilter.finalPrice.$lte = Number(maxPrice);
      }
    }

    // Lấy inventory items phù hợp
    const matchedInventory = await InventoryItem.find(inventoryFilter)
      .select("variant product")
      .lean();

    // Cập nhật lại matchedVariants dựa trên inventory có sẵn
    const validVariantIds = new Set(
      matchedInventory.map((inv) => inv.variant.toString())
    );
    matchedVariants = matchedVariants.filter((v) =>
      validVariantIds.has(v._id.toString())
    );

    // Cập nhật lại productIds dựa trên variants hợp lệ
    const validProductIds = new Set(
      matchedVariants.map((v) => v.product.toString())
    );
    matchedProducts = matchedProducts.filter((p) =>
      validProductIds.has(p._id.toString())
    );
    productIds = matchedProducts.map((p) => p._id);

    if (matchedProducts.length === 0) {
      return {
        success: true,
        filters: {
          categories: [],
          brands: [],
          colors: [],
          sizes: [],
          tags: [],
          priceRange: { min: 0, max: 0 },
          genders: [],
        },
        isFiltered: true,
        matchedProductCount: 0,
      };
    }

    // Thu thập các IDs duy nhất từ kết quả đã lọc
    const categoryIds = [
      ...new Set(
        matchedProducts.map((p) => p.category?.toString()).filter(Boolean)
      ),
    ];
    const brandIds = [
      ...new Set(
        matchedProducts.map((p) => p.brand?.toString()).filter(Boolean)
      ),
    ];
    const colorIds = [
      ...new Set(
        matchedVariants.map((v) => v.color?.toString()).filter(Boolean)
      ),
    ];
    const sizeIds = [
      ...new Set(
        matchedVariants.flatMap((v) =>
          (v.sizes || []).map((s) => s.size?.toString()).filter(Boolean)
        )
      ),
    ];
    const genderSet = new Set(
      matchedVariants.map((v) => v.gender).filter(Boolean)
    );

    // Lấy thông tin chi tiết các danh mục
    const categories = await Category.find({
      _id: { $in: categoryIds },
      isActive: true,
      deletedAt: null,
    })
      .select("name _id slug")
      .sort({ name: 1 });

    // Lấy thông tin chi tiết các thương hiệu
    const brands = await Brand.find({
      _id: { $in: brandIds },
      isActive: true,
      deletedAt: null,
    })
      .select("name logo _id slug")
      .sort({ name: 1 });

    // Lấy thông tin chi tiết các màu sắc
    const colorsResult = await Color.find({
      _id: { $in: colorIds },
      deletedAt: null,
    })
      .select("name code type colors _id")
      .sort({ name: 1 });

    // Lấy thông tin chi tiết các kích thước
    const sizesResult = await Size.find({
      _id: { $in: sizeIds },
      deletedAt: null,
    })
      .select("value type description _id")
      .sort({ value: 1 });

    // Tính khoảng giá từ InventoryItem của các sản phẩm phù hợp (không filter theo price)
    const priceRange = await InventoryItem.aggregate([
      {
        $match: {
          variant: { $in: variantIds },
          quantity: { $gt: 0 },
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

    const calculatedMinPrice =
      priceRange.length > 0 ? Math.floor(priceRange[0].minPrice) : 0;
    const calculatedMaxPrice =
      priceRange.length > 0 ? Math.ceil(priceRange[0].maxPrice) : 0;

    // Chuyển đổi màu sắc để dễ sử dụng cho frontend
    const formattedColors = colorsResult.map((color) => {
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

    // Định dạng lại sizes
    const formattedSizes = sizesResult.map((size) => ({
      _id: size._id,
      id: size._id,
      value: size.value,
      type: size.type,
      description: size.description,
    }));

    // Giá trị giới tính - luôn thêm unisex nếu có male hoặc female
    const allGenders = [
      { id: "male", name: "Nam" },
      { id: "female", name: "Nữ" },
      { id: "unisex", name: "Unisex" },
    ];
    const genders = allGenders.filter((g) => genderSet.has(g.id));

    return {
      success: true,
      filters: {
        categories,
        brands,
        colors: formattedColors,
        sizes: formattedSizes,
        tags: [], // Tags có thể thêm sau nếu cần
        priceRange: { min: calculatedMinPrice, max: calculatedMaxPrice },
        genders,
      },
      isFiltered: true,
      matchedProductCount: matchedProducts.length,
    };
  },
};

module.exports = filterService;
