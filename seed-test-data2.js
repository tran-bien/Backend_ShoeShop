/**
 * ============================================================================
 * COMPREHENSIVE SEED TEST DATA SCRIPT
 * ============================================================================
 * Tạo dữ liệu test đầy đủ cho tất cả APIs
 * - Users: Admin, Staff, User, Shipper
 * - Products với nhiều variants
 * - Orders với nhiều status
 * - Coupons, Banners, Blogs, Reviews
 * - Return Requests, Cancel Requests
 * - Loyalty Tiers, Notifications
 * ============================================================================
 */

require("module-alias/register");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");

dotenv.config();

// Import models
const {
  User,
  Product,
  Variant,
  Brand,
  Category,
  Color,
  Size,
  Order,
  Cart,
  Review,
  Coupon,
  InventoryItem,
  Banner,
  BlogPost,
  BlogCategory,
  Tag,
  SizeGuide,
  LoyaltyTier,
  Notification,
  KnowledgeDocument,
} = require("../src/models");

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  section: (msg) =>
    console.log(`\n${colors.magenta}═══ ${msg} ═══${colors.reset}`),
};

async function seedTestData() {
  console.log("\n" + "=".repeat(70));
  console.log("   BACKEND SHOESHOP - COMPREHENSIVE SEED TEST DATA");
  console.log("=".repeat(70));

  try {
    // Connect to MongoDB
    log.info("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    log.success("Connected to MongoDB");

    // ================================================================
    // 1. Tạo Sizes
    // ================================================================
    log.section("Creating Sizes");
    const sizesData = [
      { value: 36, description: "Size 36 EU" },
      { value: 37, description: "Size 37 EU" },
      { value: 38, description: "Size 38 EU" },
      { value: 39, description: "Size 39 EU" },
      { value: 40, description: "Size 40 EU" },
      { value: 41, description: "Size 41 EU" },
      { value: 42, description: "Size 42 EU" },
      { value: 43, description: "Size 43 EU" },
      { value: 44, description: "Size 44 EU" },
      { value: 45, description: "Size 45 EU" },
    ];

    const sizes = [];
    for (const sizeData of sizesData) {
      let size = await Size.findOne({ value: sizeData.value });
      if (!size) {
        size = await Size.create(sizeData);
        log.success(`Created size: ${sizeData.value}`);
      } else {
        log.info(`Size ${sizeData.value} already exists`);
      }
      sizes.push(size);
    }

    // ================================================================
    // 2. Tạo Colors
    // ================================================================
    log.section("Creating Colors");
    const colorsData = [
      { name: "Đen", code: "#000000", type: "solid" },
      { name: "Trắng", code: "#FFFFFF", type: "solid" },
      { name: "Đỏ", code: "#FF0000", type: "solid" },
      { name: "Xanh Navy", code: "#000080", type: "solid" },
      { name: "Xám", code: "#808080", type: "solid" },
      { name: "Nâu", code: "#8B4513", type: "solid" },
      { name: "Xanh Lá", code: "#228B22", type: "solid" },
      { name: "Hồng", code: "#FFC0CB", type: "solid" },
    ];

    const colorDocs = [];
    for (const colorData of colorsData) {
      let color = await Color.findOne({ name: colorData.name });
      if (!color) {
        color = await Color.create(colorData);
        log.success(`Created color: ${colorData.name}`);
      } else {
        log.info(`Color ${colorData.name} already exists`);
      }
      colorDocs.push(color);
    }

    // ================================================================
    // 3. Tạo Categories (với parent-child)
    // ================================================================
    log.section("Creating Categories");
    const categoriesData = [
      {
        name: "Giày Nam",
        slug: "giay-nam",
        description: "Các loại giày dành cho nam",
        isActive: true,
      },
      {
        name: "Giày Nữ",
        slug: "giay-nu",
        description: "Các loại giày dành cho nữ",
        isActive: true,
      },
      {
        name: "Giày Thể Thao",
        slug: "giay-the-thao",
        description: "Giày thể thao, sneaker",
        isActive: true,
      },
      {
        name: "Giày Chạy Bộ",
        slug: "giay-chay-bo",
        description: "Giày chuyên dụng chạy bộ",
        isActive: true,
      },
      {
        name: "Giày Cao Gót",
        slug: "giay-cao-got",
        description: "Giày cao gót nữ",
        isActive: true,
      },
    ];

    const categories = [];
    for (const catData of categoriesData) {
      let category = await Category.findOne({ slug: catData.slug });
      if (!category) {
        category = await Category.create(catData);
        log.success(`Created category: ${catData.name}`);
      } else {
        log.info(`Category ${catData.name} already exists`);
      }
      categories.push(category);
    }

    // ================================================================
    // 4. Tạo Brands
    // ================================================================
    log.section("Creating Brands");
    const brandsData = [
      {
        name: "Nike",
        slug: "nike",
        description:
          "Nike - Just Do It. Thương hiệu giày thể thao hàng đầu thế giới.",
        logo: "https://example.com/nike-logo.png",
        isActive: true,
      },
      {
        name: "Adidas",
        slug: "adidas",
        description:
          "Adidas - Impossible is Nothing. Giày thể thao và lifestyle.",
        logo: "https://example.com/adidas-logo.png",
        isActive: true,
      },
      {
        name: "Puma",
        slug: "puma",
        description: "Puma - Forever Faster. Giày thể thao năng động.",
        logo: "https://example.com/puma-logo.png",
        isActive: true,
      },
      {
        name: "New Balance",
        slug: "new-balance",
        description: "New Balance - Fearlessly Independent Since 1906",
        logo: "https://example.com/nb-logo.png",
        isActive: true,
      },
      {
        name: "Converse",
        slug: "converse",
        description: "Converse - Chuck Taylor và nhiều sản phẩm iconic khác",
        logo: "https://example.com/converse-logo.png",
        isActive: true,
      },
    ];

    const brands = [];
    for (const brandData of brandsData) {
      let brand = await Brand.findOne({ slug: brandData.slug });
      if (!brand) {
        brand = await Brand.create(brandData);
        log.success(`Created brand: ${brandData.name}`);
      } else {
        log.info(`Brand ${brandData.name} already exists`);
      }
      brands.push(brand);
    }

    // ================================================================
    // 5. Tạo Tags
    // ================================================================
    log.section("Creating Tags");
    const tagsData = [
      { name: "Bán chạy", slug: "ban-chay", isActive: true },
      { name: "Mới nhất", slug: "moi-nhat", isActive: true },
      { name: "Sale", slug: "sale", isActive: true },
      { name: "Hot", slug: "hot", isActive: true },
      { name: "Limited", slug: "limited", isActive: true },
    ];

    const tags = [];
    for (const tagData of tagsData) {
      let tag = await Tag.findOne({ slug: tagData.slug });
      if (!tag) {
        tag = await Tag.create(tagData);
        log.success(`Created tag: ${tagData.name}`);
      } else {
        log.info(`Tag ${tagData.name} already exists`);
      }
      tags.push(tag);
    }

    // ================================================================
    // 6. Tạo Users (Admin, Staff, User, Shipper)
    // ================================================================
    log.section("Creating Users");
    const hashedPassword = await bcrypt.hash("Test@123456", 12);

    const usersData = [
      {
        email: "admin@shoeshop.com",
        password: hashedPassword,
        name: "Admin User",
        phone: "0901234567",
        role: "admin",
        isActive: true,
        isVerified: true,
      },
      {
        email: "staff@shoeshop.com",
        password: hashedPassword,
        name: "Staff User",
        phone: "0901234570",
        role: "staff",
        isActive: true,
        isVerified: true,
      },
      {
        email: "user@shoeshop.com",
        password: hashedPassword,
        name: "Test User",
        phone: "0901234568",
        role: "user",
        isActive: true,
        isVerified: true,
        addresses: [
          {
            fullName: "Test User",
            phone: "0901234568",
            province: "Hồ Chí Minh",
            district: "Quận 1",
            ward: "Phường Bến Nghé",
            addressDetail: "123 Nguyễn Huệ",
            isDefault: true,
          },
          {
            fullName: "Test User (Nhà)",
            phone: "0901234568",
            province: "Hồ Chí Minh",
            district: "Quận 3",
            ward: "Phường 7",
            addressDetail: "456 Điện Biên Phủ",
            isDefault: false,
          },
        ],
      },
      {
        email: "user2@shoeshop.com",
        password: hashedPassword,
        name: "Test User 2",
        phone: "0901234571",
        role: "user",
        isActive: true,
        isVerified: true,
        addresses: [
          {
            fullName: "Test User 2",
            phone: "0901234571",
            province: "Hà Nội",
            district: "Hoàn Kiếm",
            ward: "Phường Hàng Bạc",
            addressDetail: "789 Hàng Ngang",
            isDefault: true,
          },
        ],
      },
      {
        email: "shipper@shoeshop.com",
        password: hashedPassword,
        name: "Shipper User",
        phone: "0901234569",
        role: "shipper",
        isActive: true,
        isVerified: true,
        shipperInfo: {
          isAvailable: true,
          vehicleType: "motorbike",
          licensePlate: "59A1-12345",
        },
      },
      {
        email: "shipper2@shoeshop.com",
        password: hashedPassword,
        name: "Shipper User 2",
        phone: "0901234572",
        role: "shipper",
        isActive: true,
        isVerified: true,
        shipperInfo: {
          isAvailable: false,
          vehicleType: "motorbike",
          licensePlate: "59A1-67890",
        },
      },
    ];

    const users = [];
    for (const userData of usersData) {
      let user = await User.findOne({ email: userData.email });
      if (!user) {
        user = await User.create(userData);
        log.success(`Created user: ${userData.email} (${userData.role})`);
      } else {
        // Đảm bảo user active và có đầy đủ dữ liệu
        user.isActive = true;
        user.isVerified = true;
        if (userData.addresses) user.addresses = userData.addresses;
        if (userData.shipperInfo) user.shipperInfo = userData.shipperInfo;
        await user.save();
        log.info(`Updated existing user: ${userData.email}`);
      }
      users.push(user);
    }

    const adminUser = users.find((u) => u.role === "admin");
    const staffUser = users.find((u) => u.role === "staff");
    const testUser = users.find((u) => u.email === "user@shoeshop.com");
    const testUser2 = users.find((u) => u.email === "user2@shoeshop.com");
    const shipperUser = users.find((u) => u.email === "shipper@shoeshop.com");

    // ================================================================
    // 7. Tạo Products và Variants
    // ================================================================
    log.section("Creating Products & Variants");

    const generateSKU = (productSlug, colorName, gender, sizeValue) => {
      const brandPart = productSlug.substring(0, 3).toUpperCase();
      const colorPart = colorName.substring(0, 3).toUpperCase();
      const genderPart =
        gender === "male" ? "M" : gender === "female" ? "F" : "U";
      const randomPart = Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase();
      return `${brandPart}-${colorPart}-${genderPart}-${sizeValue}-${randomPart}`;
    };

    const productsData = [
      {
        name: "Nike Air Max 90",
        slug: "nike-air-max-90",
        description:
          "Giày Nike Air Max 90 chính hãng. Thiết kế iconic, thoải mái suốt ngày dài.",
        category: categories[2]._id,
        brand: brands[0]._id,
        tags: [tags[0]._id, tags[3]._id],
        isFeatured: true,
        isActive: true,
        variants: [
          { color: colorDocs[0], gender: "male", sizesRaw: sizes.slice(2, 7) },
          { color: colorDocs[1], gender: "male", sizesRaw: sizes.slice(2, 7) },
          { color: colorDocs[2], gender: "male", sizesRaw: sizes.slice(2, 6) },
        ],
        basePrice: 3500000,
      },
      {
        name: "Nike Air Force 1",
        slug: "nike-air-force-1",
        description:
          "Nike Air Force 1 Low - Classic. Biểu tượng sneaker huyền thoại.",
        category: categories[0]._id,
        brand: brands[0]._id,
        tags: [tags[0]._id, tags[1]._id],
        isFeatured: true,
        isActive: true,
        variants: [
          {
            color: colorDocs[1],
            gender: "unisex",
            sizesRaw: sizes.slice(0, 8),
          },
          {
            color: colorDocs[0],
            gender: "unisex",
            sizesRaw: sizes.slice(0, 8),
          },
        ],
        basePrice: 2800000,
      },
      {
        name: "Adidas Stan Smith",
        slug: "adidas-stan-smith",
        description:
          "Giày Adidas Stan Smith classic. Phong cách tối giản, sang trọng.",
        category: categories[2]._id,
        brand: brands[1]._id,
        tags: [tags[1]._id],
        isFeatured: false,
        isActive: true,
        variants: [
          {
            color: colorDocs[1],
            gender: "unisex",
            sizesRaw: sizes.slice(0, 7),
          },
          {
            color: colorDocs[6],
            gender: "unisex",
            sizesRaw: sizes.slice(0, 6),
          },
        ],
        basePrice: 2500000,
      },
      {
        name: "Adidas Ultraboost 22",
        slug: "adidas-ultraboost-22",
        description:
          "Adidas Ultraboost 22 - Giày chạy bộ cao cấp với công nghệ Boost.",
        category: categories[3]._id,
        brand: brands[1]._id,
        tags: [tags[3]._id, tags[4]._id],
        isFeatured: true,
        isActive: true,
        variants: [
          { color: colorDocs[0], gender: "male", sizesRaw: sizes.slice(2, 8) },
          { color: colorDocs[4], gender: "male", sizesRaw: sizes.slice(2, 8) },
        ],
        basePrice: 4200000,
      },
      {
        name: "Puma RS-X",
        slug: "puma-rs-x",
        description: "Giày Puma RS-X phong cách retro-futuristic độc đáo.",
        category: categories[2]._id,
        brand: brands[2]._id,
        tags: [tags[2]._id],
        isFeatured: false,
        isActive: true,
        variants: [
          {
            color: colorDocs[0],
            gender: "unisex",
            sizesRaw: sizes.slice(1, 6),
          },
          {
            color: colorDocs[1],
            gender: "unisex",
            sizesRaw: sizes.slice(1, 6),
          },
        ],
        basePrice: 2200000,
      },
      {
        name: "New Balance 574",
        slug: "new-balance-574",
        description:
          "New Balance 574 - Classic. Sự kết hợp hoàn hảo giữa phong cách và thoải mái.",
        category: categories[2]._id,
        brand: brands[3]._id,
        tags: [tags[0]._id],
        isFeatured: true,
        isActive: true,
        variants: [
          {
            color: colorDocs[3],
            gender: "unisex",
            sizesRaw: sizes.slice(0, 7),
          },
          {
            color: colorDocs[4],
            gender: "unisex",
            sizesRaw: sizes.slice(0, 7),
          },
          {
            color: colorDocs[5],
            gender: "unisex",
            sizesRaw: sizes.slice(0, 6),
          },
        ],
        basePrice: 2600000,
      },
      {
        name: "Converse Chuck Taylor All Star",
        slug: "converse-chuck-taylor",
        description:
          "Converse Chuck Taylor All Star - Biểu tượng sneaker vượt thời gian.",
        category: categories[2]._id,
        brand: brands[4]._id,
        tags: [tags[0]._id, tags[1]._id],
        isFeatured: false,
        isActive: true,
        variants: [
          {
            color: colorDocs[0],
            gender: "unisex",
            sizesRaw: sizes.slice(0, 9),
          },
          {
            color: colorDocs[1],
            gender: "unisex",
            sizesRaw: sizes.slice(0, 9),
          },
          {
            color: colorDocs[2],
            gender: "unisex",
            sizesRaw: sizes.slice(0, 8),
          },
        ],
        basePrice: 1500000,
      },
      {
        name: "Nike Zoom Pegasus 39",
        slug: "nike-zoom-pegasus-39",
        description:
          "Nike Zoom Pegasus 39 - Giày chạy bộ nhẹ nhàng, êm ái cho mọi cung đường.",
        category: categories[3]._id,
        brand: brands[0]._id,
        tags: [tags[1]._id, tags[3]._id],
        isFeatured: true,
        isActive: true,
        variants: [
          { color: colorDocs[0], gender: "male", sizesRaw: sizes.slice(2, 8) },
          {
            color: colorDocs[7],
            gender: "female",
            sizesRaw: sizes.slice(0, 5),
          },
        ],
        basePrice: 3200000,
      },
    ];

    const products = [];
    const variants = [];

    for (const prodData of productsData) {
      let product = await Product.findOne({ slug: prodData.slug });
      if (!product) {
        const { variants: variantsData, basePrice, ...productInfo } = prodData;
        product = await Product.create(productInfo);
        log.success(`Created product: ${prodData.name}`);
        products.push(product); // Push mới tạo

        for (const varData of variantsData) {
          const sizesWithSku = varData.sizesRaw.map((sizeDoc) => ({
            size: sizeDoc._id,
            sku: generateSKU(
              prodData.slug,
              varData.color.name,
              varData.gender,
              sizeDoc.value
            ),
          }));

          const variant = await Variant.create({
            product: product._id,
            color: varData.color._id,
            gender: varData.gender,
            sizes: sizesWithSku,
            imagesvariant: [
              {
                url: `https://example.com/${
                  prodData.slug
                }-${varData.color.name.toLowerCase()}.jpg`,
                public_id: `${
                  prodData.slug
                }-${varData.color.name.toLowerCase()}`,
                isMain: true,
              },
            ],
            isActive: true,
          });
          variants.push(variant);
          log.success(
            `  - Created variant: ${varData.color.name} (${varData.gender})`
          );

          // Tạo InventoryItems
          for (const sizeWithSku of sizesWithSku) {
            const existingInv = await InventoryItem.findOne({
              product: product._id,
              variant: variant._id,
              size: sizeWithSku.size,
            });

            if (!existingInv) {
              const randomStock = Math.floor(Math.random() * 50) + 10;
              const discount =
                Math.random() > 0.7 ? Math.floor(Math.random() * 20) + 5 : 0;
              await InventoryItem.create({
                product: product._id,
                variant: variant._id,
                size: sizeWithSku.size,
                quantity: randomStock,
                sellingPrice: basePrice,
                costPrice: Math.floor(basePrice * 0.6),
                importPrice: Math.floor(basePrice * 0.6),
                finalPrice:
                  discount > 0
                    ? Math.floor(basePrice * (1 - discount / 100))
                    : basePrice,
                percentDiscount: discount,
                sku: sizeWithSku.sku,
              });
            }
          }
        }
      } else {
        log.info(`Product ${prodData.name} already exists`);
        const existingVariants = await Variant.find({
          product: product._id,
          deletedAt: null,
        });
        variants.push(...existingVariants);
      }
      products.push(product);
    }

    // ================================================================
    // 8. Tạo Coupons
    // ================================================================
    log.section("Creating Coupons");
    const couponsData = [
      {
        code: "WELCOME10",
        name: "Chào mừng khách hàng mới",
        description: "Giảm 10% cho đơn hàng đầu tiên",
        type: "percent",
        value: 10,
        maxDiscount: 200000,
        minOrderValue: 500000,
        usageLimit: 1000,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true,
        isPublic: true,
      },
      {
        code: "SAVE50K",
        name: "Giảm 50K",
        description: "Giảm ngay 50.000đ cho đơn từ 300K",
        type: "fixed",
        value: 50000,
        minOrderValue: 300000,
        usageLimit: 500,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
        isPublic: true,
      },
      {
        code: "VIP20",
        name: "VIP 20%",
        description: "Giảm 20% cho khách VIP",
        type: "percent",
        value: 20,
        maxDiscount: 500000,
        minOrderValue: 1000000,
        usageLimit: 100,
        startDate: new Date(),
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        isActive: true,
        isPublic: false,
      },
      {
        code: "FREESHIP",
        name: "Miễn phí vận chuyển",
        description: "Miễn phí vận chuyển cho đơn từ 500K",
        type: "fixed",
        value: 30000,
        minOrderValue: 500000,
        usageLimit: 200,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        isActive: true,
        isPublic: true,
      },
    ];

    for (const couponData of couponsData) {
      let coupon = await Coupon.findOne({ code: couponData.code });
      if (!coupon) {
        await Coupon.create(couponData);
        log.success(`Created coupon: ${couponData.code}`);
      } else {
        log.info(`Coupon ${couponData.code} already exists`);
      }
    }

    // ================================================================
    // 9. Tạo Banners
    // ================================================================
    log.section("Creating Banners");
    const bannersData = [
      {
        title: "Summer Sale 2024",
        image: {
          url: "https://example.com/banner-summer-sale.jpg",
          public_id: "banner-summer-sale",
        },
        link: "/sale",
        displayOrder: 1,
        isActive: true,
      },
      {
        title: "Bộ sưu tập Nike mới",
        image: {
          url: "https://example.com/banner-nike.jpg",
          public_id: "banner-nike",
        },
        link: "/brands/nike",
        displayOrder: 2,
        isActive: true,
      },
      {
        title: "Adidas Ultraboost",
        image: {
          url: "https://example.com/banner-adidas.jpg",
          public_id: "banner-adidas",
        },
        link: "/products/adidas-ultraboost-22",
        displayOrder: 3,
        isActive: true,
      },
    ];

    for (const bannerData of bannersData) {
      let banner = await Banner.findOne({ title: bannerData.title });
      if (!banner) {
        await Banner.create(bannerData);
        log.success(`Created banner: ${bannerData.title}`);
      } else {
        log.info(`Banner ${bannerData.title} already exists`);
      }
    }

    // ================================================================
    // 10. Tạo Blog Categories & Posts
    // ================================================================
    log.section("Creating Blog Categories & Posts");

    const blogCategoriesData = [
      {
        name: "Tin tức",
        slug: "tin-tuc",
        description: "Tin tức về giày dép",
        isActive: true,
      },
      {
        name: "Hướng dẫn",
        slug: "huong-dan",
        description: "Hướng dẫn chọn size, bảo quản",
        isActive: true,
      },
      {
        name: "Review",
        slug: "review",
        description: "Review sản phẩm chi tiết",
        isActive: true,
      },
    ];

    const blogCategories = [];
    for (const catData of blogCategoriesData) {
      let blogCat = await BlogCategory.findOne({ slug: catData.slug });
      if (!blogCat) {
        blogCat = await BlogCategory.create(catData);
        log.success(`Created blog category: ${catData.name}`);
      } else {
        log.info(`Blog category ${catData.name} already exists`);
      }
      blogCategories.push(blogCat);
    }

    const blogPostsData = [
      {
        title: "Cách chọn size giày chuẩn nhất",
        slug: "cach-chon-size-giay-chuan-nhat",
        content: "Hướng dẫn chi tiết cách đo chân và chọn size giày phù hợp...",
        excerpt: "Hướng dẫn chi tiết cách đo chân và chọn size giày",
        category: blogCategories[1]._id,
        author: adminUser._id,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      {
        title: "Top 10 giày thể thao bán chạy 2024",
        slug: "top-10-giay-the-thao-ban-chay-2024",
        content:
          "Danh sách 10 đôi giày thể thao được yêu thích nhất năm 2024...",
        excerpt: "Danh sách 10 đôi giày thể thao được yêu thích nhất",
        category: blogCategories[2]._id,
        author: adminUser._id,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      {
        title: "Nike ra mắt Air Max mới",
        slug: "nike-ra-mat-air-max-moi",
        content:
          "Nike vừa công bố phiên bản Air Max mới nhất với nhiều cải tiến...",
        excerpt: "Nike vừa công bố phiên bản Air Max mới nhất",
        category: blogCategories[0]._id,
        author: adminUser._id,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      {
        title: "Bảo quản giày đúng cách",
        slug: "bao-quan-giay-dung-cach",
        content: "Hướng dẫn bảo quản giày để giữ được độ bền và vẻ đẹp...",
        excerpt: "Hướng dẫn bảo quản giày đúng cách",
        category: blogCategories[1]._id,
        author: adminUser._id,
        status: "DRAFT",
      },
    ];

    for (const postData of blogPostsData) {
      let post = await BlogPost.findOne({ slug: postData.slug });
      if (!post) {
        await BlogPost.create(postData);
        log.success(`Created blog post: ${postData.title}`);
      } else {
        log.info(`Blog post ${postData.title} already exists`);
      }
    }

    // ================================================================
    // 11. Tạo Orders với nhiều status
    // ================================================================
    log.section("Creating Orders");

    const firstVariant = variants[0];
    const firstSize = sizes[2];
    const invItem = await InventoryItem.findOne({
      variant: firstVariant._id,
      size: firstSize._id,
    });
    const orderPrice = invItem?.finalPrice || 3500000;
    const costPrice = invItem?.costPrice || 2100000;

    const ordersData = [
      {
        status: "pending",
        payment: { method: "COD", paymentStatus: "pending" },
      },
      {
        status: "confirmed",
        payment: { method: "COD", paymentStatus: "pending" },
      },
      {
        status: "assigned_to_shipper",
        payment: { method: "VNPAY", paymentStatus: "paid", paidAt: new Date() },
        shipper: shipperUser._id,
      },
      {
        status: "out_for_delivery",
        payment: { method: "COD", paymentStatus: "pending" },
        shipper: shipperUser._id,
      },
      {
        status: "delivered",
        payment: { method: "COD", paymentStatus: "paid", paidAt: new Date() },
      },
      {
        status: "cancelled",
        payment: { method: "COD", paymentStatus: "pending" },
      },
      {
        status: "returned",
        payment: { method: "COD", paymentStatus: "paid", paidAt: new Date() },
      },
    ];

    for (let i = 0; i < ordersData.length; i++) {
      const orderData = ordersData[i];
      const existingOrder = await Order.findOne({
        user: testUser._id,
        status: orderData.status,
      });
      if (!existingOrder) {
        const order = await Order.create({
          user: testUser._id,
          orderItems: [
            {
              variant: firstVariant._id,
              size: firstSize._id,
              quantity: 1,
              price: orderPrice,
              costPrice: costPrice,
              productName: products[0]?.name || "Test Product",
              image: "https://example.com/product-image.jpg",
            },
          ],
          subTotal: orderPrice,
          totalAfterDiscountAndShipping: orderPrice + 30000,
          status: orderData.status,
          payment: orderData.payment,
          shipper: orderData.shipper,
          shippingAddress: {
            name: "Test User",
            phone: "0901234568",
            province: "Hồ Chí Minh",
            district: "Quận 1",
            ward: "Phường Bến Nghé",
            detail: "123 Nguyễn Huệ",
          },
        });
        log.success(`Created order with status: ${orderData.status}`);
      } else {
        log.info(`Order with status ${orderData.status} already exists`);
      }
    }

    // ================================================================
    // 12. Tạo Reviews
    // ================================================================
    log.section("Creating Reviews");

    // Lấy tất cả orders đã delivered để có nhiều orderItems
    const deliveredOrders = await Order.find({
      status: "delivered",
    });

    if (deliveredOrders.length > 0) {
      // Tạo review cho mỗi orderItem unique
      for (const order of deliveredOrders) {
        for (const orderItem of order.orderItems) {
          // Kiểm tra unique user + orderItem
          const existingReview = await Review.findOne({
            user: order.user,
            orderItem: orderItem._id,
          });
          if (!existingReview) {
            // Lấy product từ variant
            const variant = await Variant.findById(orderItem.variant);
            if (variant) {
              await Review.create({
                user: order.user,
                product: variant.product,
                orderItem: orderItem._id,
                rating: Math.floor(Math.random() * 2) + 4, // 4-5 stars
                content: `Sản phẩm ${orderItem.productName} rất tốt, đúng size và giao hàng nhanh!`,
                isActive: true,
              });
              log.success(`Created review for orderItem in order ${order._id}`);
            }
          }
        }
      }
    }

    // ================================================================
    // 13. Tạo Loyalty Tiers
    // ================================================================
    log.section("Creating Loyalty Tiers");

    const loyaltyTiersData = [
      {
        name: "Bronze",
        slug: "bronze",
        minSpending: 0,
        maxSpending: 999999,
        minPoints: 0,
        displayOrder: 1,
        benefits: {
          pointsMultiplier: 1,
          prioritySupport: false,
        },
        isActive: true,
      },
      {
        name: "Silver",
        slug: "silver",
        minSpending: 1000000,
        maxSpending: 4999999,
        minPoints: 1000,
        displayOrder: 2,
        benefits: {
          pointsMultiplier: 1.5,
          prioritySupport: false,
        },
        isActive: true,
      },
      {
        name: "Gold",
        slug: "gold",
        minSpending: 5000000,
        maxSpending: 14999999,
        minPoints: 5000,
        displayOrder: 3,
        benefits: {
          pointsMultiplier: 2,
          prioritySupport: true,
        },
        isActive: true,
      },
      {
        name: "Platinum",
        slug: "platinum",
        minSpending: 15000000,
        maxSpending: null,
        minPoints: 15000,
        displayOrder: 4,
        benefits: {
          pointsMultiplier: 3,
          prioritySupport: true,
        },
        isActive: true,
      },
    ];

    for (const tierData of loyaltyTiersData) {
      let tier = await LoyaltyTier.findOne({ name: tierData.name });
      if (!tier) {
        await LoyaltyTier.create(tierData);
        log.success(`Created loyalty tier: ${tierData.name}`);
      } else {
        log.info(`Loyalty tier ${tierData.name} already exists`);
      }
    }

    // ================================================================
    // 14. Tạo Size Guides (1 per product, unique)
    // ================================================================
    log.section("Creating Size Guides");

    // Lấy 3 products đầu tiên để tạo size guides
    const productsForSizeGuide = products.slice(0, 3);
    for (const product of productsForSizeGuide) {
      const existingGuide = await SizeGuide.findOne({ product: product._id });
      if (!existingGuide) {
        await SizeGuide.create({
          product: product._id,
          sizeChart: {
            image: {
              url: "https://example.com/size-chart.jpg",
              public_id: `size-chart-${product.slug}`,
            },
            description: `Bảng size cho ${product.name}:\n- Size 38: 24cm\n- Size 39: 24.5cm\n- Size 40: 25cm\n- Size 41: 25.5cm\n- Size 42: 26cm\n- Size 43: 27cm`,
          },
          measurementGuide: {
            image: {
              url: "https://example.com/measure-guide.jpg",
              public_id: `measure-guide-${product.slug}`,
            },
            description:
              "Hướng dẫn đo chân:\n1. Đặt chân lên giấy trắng\n2. Vẽ theo hình bàn chân\n3. Đo từ gót đến ngón dài nhất",
          },
          isActive: true,
          createdBy: adminUser._id,
        });
        log.success(`Created size guide for: ${product.name}`);
      } else {
        log.info(`Size guide for ${product.name} already exists`);
      }
    }

    // ================================================================
    // 15. Tạo Knowledge Documents (cho AI chatbot)
    // ================================================================
    log.section("Creating Knowledge Documents");

    const knowledgeData = [
      {
        title: "Chính sách đổi trả",
        content:
          "ShoeShop hỗ trợ đổi trả trong vòng 7 ngày kể từ ngày nhận hàng. Sản phẩm phải còn nguyên tem, tag, chưa qua sử dụng.",
        category: "policy",
        tags: ["đổi trả", "hoàn hàng", "chính sách"],
        isActive: true,
      },
      {
        title: "Phương thức thanh toán",
        content:
          "Chúng tôi hỗ trợ: COD (thanh toán khi nhận hàng), VNPAY (chuyển khoản ngân hàng, QR code, ví điện tử).",
        category: "policy",
        tags: ["thanh toán", "cod", "vnpay"],
        isActive: true,
      },
      {
        title: "Thời gian giao hàng",
        content:
          "Nội thành HCM và Hà Nội: 1-2 ngày. Các tỉnh thành khác: 3-5 ngày làm việc.",
        category: "policy",
        tags: ["giao hàng", "vận chuyển", "thời gian"],
        isActive: true,
      },
      {
        title: "Hướng dẫn chọn size giày",
        content:
          "Để chọn size chính xác, hãy đo chiều dài bàn chân và tra cứu bảng size tương ứng với từng thương hiệu.",
        category: "how_to_size",
        tags: ["size", "chọn size", "hướng dẫn"],
        isActive: true,
      },
      {
        title: "Câu hỏi thường gặp",
        content:
          "Q: Làm sao để kiểm tra đơn hàng? A: Vào Tài khoản > Đơn hàng của tôi để theo dõi trạng thái đơn hàng.",
        category: "faq",
        tags: ["faq", "hỏi đáp", "trợ giúp"],
        isActive: true,
      },
    ];

    for (const docData of knowledgeData) {
      let doc = await KnowledgeDocument.findOne({ title: docData.title });
      if (!doc) {
        await KnowledgeDocument.create(docData);
        log.success(`Created knowledge doc: ${docData.title}`);
      } else {
        log.info(`Knowledge doc ${docData.title} already exists`);
      }
    }

    // ================================================================
    // 16. Tạo Notifications cho test user
    // ================================================================
    log.section("Creating Notifications");

    const notificationsData = [
      {
        user: testUser._id,
        title: "Đơn hàng đã được xác nhận",
        message:
          "Đơn hàng #123456 của bạn đã được xác nhận và đang được chuẩn bị.",
        type: "ORDER_CONFIRMED",
        isRead: false,
      },
      {
        user: testUser._id,
        title: "Khuyến mãi đặc biệt",
        message: "Giảm 20% toàn bộ sản phẩm Nike trong tuần này!",
        type: "PROMOTION",
        isRead: false,
      },
      {
        user: testUser._id,
        title: "Đơn hàng đang giao",
        message: "Đơn hàng #123456 đang được vận chuyển đến bạn.",
        type: "ORDER_SHIPPING",
        isRead: true,
      },
      {
        user: testUser._id,
        title: "Thông báo hệ thống",
        message: "Hệ thống sẽ bảo trì vào 22h tối nay.",
        type: "SYSTEM",
        isRead: false,
      },
    ];

    for (const notiData of notificationsData) {
      const existingNoti = await Notification.findOne({
        user: notiData.user,
        title: notiData.title,
      });
      if (!existingNoti) {
        await Notification.create(notiData);
        log.success(`Created notification: ${notiData.title}`);
      } else {
        log.info(`Notification ${notiData.title} already exists`);
      }
    }

    // ================================================================
    // 17. Tạo Cart cho test user
    // ================================================================
    log.section("Creating Cart for Test User");

    if (testUser && variants.length > 1) {
      let cart = await Cart.findOne({ user: testUser._id });
      if (!cart) {
        const secondVariant = variants[1];
        const secondSize = sizes[3];
        const invItem2 = await InventoryItem.findOne({
          variant: secondVariant._id,
          size: secondSize._id,
        });

        cart = await Cart.create({
          user: testUser._id,
          cartItems: [
            {
              variant: firstVariant._id,
              size: firstSize._id,
              quantity: 2,
              price: invItem?.finalPrice || 3500000,
              productName: products[0]?.name || "Test Product 1",
              image: "https://example.com/product-1.jpg",
              isSelected: true,
              isAvailable: true,
            },
            {
              variant: secondVariant._id,
              size: secondSize._id,
              quantity: 1,
              price: invItem2?.finalPrice || 2800000,
              productName: products[1]?.name || "Test Product 2",
              image: "https://example.com/product-2.jpg",
              isSelected: true,
              isAvailable: true,
            },
          ],
        });
        log.success(`Created cart for user: ${testUser.email}`);
      } else {
        log.info(`Cart for user ${testUser.email} already exists`);
      }
    }

    // ================================================================
    // SUMMARY
    // ================================================================
    console.log("\n" + "=".repeat(70));
    console.log("   SEED DATA SUMMARY");
    console.log("=".repeat(70));
    log.success(`Sizes: ${sizes.length}`);
    log.success(`Colors: ${colorDocs.length}`);
    log.success(`Categories: ${categories.length}`);
    log.success(`Brands: ${brands.length}`);
    log.success(`Tags: ${tags.length}`);
    log.success(`Users: ${users.length}`);
    log.success(`Products: ${products.length}`);
    log.success(`Variants: ${variants.length}`);

    console.log("\n" + "=".repeat(70));
    log.info("Test Credentials:");
    console.log(`   Admin:   admin@shoeshop.com / Test@123456`);
    console.log(`   Staff:   staff@shoeshop.com / Test@123456`);
    console.log(`   User:    user@shoeshop.com / Test@123456`);
    console.log(`   User 2:  user2@shoeshop.com / Test@123456`);
    console.log(`   Shipper: shipper@shoeshop.com / Test@123456`);
    console.log("=".repeat(70));
  } catch (error) {
    log.error(`Fatal error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    log.info("Disconnected from MongoDB");
    process.exit(0);
  }
}

seedTestData();
