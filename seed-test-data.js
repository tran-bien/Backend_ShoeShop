/**
 * Seed Test Data Script
 * Tạo dữ liệu test để chạy API tests
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
  console.log("\n" + "=".repeat(60));
  console.log("   BACKEND SHOESHOP - SEED TEST DATA");
  console.log("=".repeat(60));

  try {
    // Connect to MongoDB
    log.info("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    log.success("Connected to MongoDB");

    // 1. Tạo Sizes
    log.section("Creating Sizes");
    const sizesData = [
      { value: 38, description: "Size 38 EU" },
      { value: 39, description: "Size 39 EU" },
      { value: 40, description: "Size 40 EU" },
      { value: 41, description: "Size 41 EU" },
      { value: 42, description: "Size 42 EU" },
      { value: 43, description: "Size 43 EU" },
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

    // 2. Tạo Colors
    log.section("Creating Colors");
    const colorsData = [
      { name: "Đen", code: "#000000", type: "solid" },
      { name: "Trắng", code: "#FFFFFF", type: "solid" },
      { name: "Đỏ", code: "#FF0000", type: "solid" },
      { name: "Xanh Navy", code: "#000080", type: "solid" },
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

    // 3. Tạo Categories
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

    // 4. Tạo Brands
    log.section("Creating Brands");
    const brandsData = [
      {
        name: "Nike",
        slug: "nike",
        description: "Nike - Just Do It",
        logo: "https://example.com/nike-logo.png",
        isActive: true,
      },
      {
        name: "Adidas",
        slug: "adidas",
        description: "Adidas - Impossible is Nothing",
        logo: "https://example.com/adidas-logo.png",
        isActive: true,
      },
      {
        name: "Puma",
        slug: "puma",
        description: "Puma - Forever Faster",
        logo: "https://example.com/puma-logo.png",
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

    // 5. Tạo Users (Admin, User, Shipper)
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
        email: "user@shoeshop.com",
        password: hashedPassword,
        name: "Test User",
        phone: "0901234568",
        role: "user",
        isActive: true,
        isVerified: true,
        addresses: [
          {
            name: "Test User",
            phone: "0901234568",
            province: "Hồ Chí Minh",
            district: "Quận 1",
            ward: "Phường Bến Nghé",
            detail: "123 Nguyễn Huệ",
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
      },
    ];

    const users = [];
    for (const userData of usersData) {
      let user = await User.findOne({ email: userData.email });
      if (!user) {
        user = await User.create(userData);
        log.success(`Created user: ${userData.email} (${userData.role})`);
      } else {
        // Đảm bảo user active
        if (!user.isActive) {
          user.isActive = true;
          await user.save();
          log.info(`Activated existing user: ${userData.email}`);
        } else {
          log.info(`User ${userData.email} already exists`);
        }
      }
      users.push(user);
    }

    // Lấy user objects riêng
    const adminUser = users.find((u) => u.role === "admin");
    const testUser = users.find((u) => u.role === "user");
    const shipperUser = users.find((u) => u.role === "shipper");

    // 6. Tạo Products và Variants
    log.section("Creating Products & Variants");

    // Helper function để tạo SKU
    const generateSKU = (productSlug, colorName, gender, sizeValue) => {
      const brandPart = productSlug.substring(0, 3).toUpperCase();
      const colorPart = colorName.substring(0, 3).toUpperCase();
      const genderPart =
        gender === "male" ? "M" : gender === "female" ? "F" : "U";
      const sizePart = sizeValue.toString();
      const randomPart = Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase();
      return `${brandPart}-${colorPart}-${genderPart}-${sizePart}-${randomPart}`;
    };

    const productsData = [
      {
        name: "Nike Air Max 90",
        slug: "nike-air-max-90",
        description: "Giày Nike Air Max 90 chính hãng",
        category: categories[2]._id, // Giày Thể Thao
        brand: brands[0]._id, // Nike
        isActive: true,
        variants: [
          {
            color: colorDocs[0], // Đen (full object)
            gender: "male",
            sizesRaw: sizes.slice(0, 4), // 4 sizes
            images: [
              {
                url: "https://example.com/nike-am90-black-1.jpg",
                public_id: "nike-am90-black-1",
                isMain: true,
              },
              {
                url: "https://example.com/nike-am90-black-2.jpg",
                public_id: "nike-am90-black-2",
              },
            ],
            isActive: true,
          },
          {
            color: colorDocs[1], // Trắng
            gender: "male",
            sizesRaw: sizes.slice(0, 4),
            images: [
              {
                url: "https://example.com/nike-am90-white-1.jpg",
                public_id: "nike-am90-white-1",
                isMain: true,
              },
            ],
            isActive: true,
          },
        ],
      },
      {
        name: "Adidas Stan Smith",
        slug: "adidas-stan-smith",
        description: "Giày Adidas Stan Smith classic",
        category: categories[2]._id,
        brand: brands[1]._id, // Adidas
        isActive: true,
        variants: [
          {
            color: colorDocs[1], // Trắng
            gender: "unisex",
            sizesRaw: sizes.slice(0, 4),
            images: [
              {
                url: "https://example.com/adidas-ss-white-1.jpg",
                public_id: "adidas-ss-white-1",
                isMain: true,
              },
            ],
            isActive: true,
          },
        ],
      },
      {
        name: "Puma RS-X",
        slug: "puma-rs-x",
        description: "Giày Puma RS-X phong cách",
        category: categories[2]._id,
        brand: brands[2]._id, // Puma
        isActive: true,
        variants: [
          {
            color: colorDocs[0], // Đen
            gender: "unisex",
            sizesRaw: sizes.slice(0, 3),
            images: [
              {
                url: "https://example.com/puma-rsx-black-1.jpg",
                public_id: "puma-rsx-black-1",
                isMain: true,
              },
            ],
            isActive: true,
          },
        ],
      },
    ];

    const products = [];
    const variants = [];

    for (const prodData of productsData) {
      let product = await Product.findOne({ slug: prodData.slug });
      if (!product) {
        const { variants: variantsData, ...productInfo } = prodData;
        product = await Product.create(productInfo);
        log.success(`Created product: ${prodData.name}`);

        // Tạo variants cho product
        for (const varData of variantsData) {
          // Build sizes array with SKU
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
            imagesvariant: varData.images,
            isActive: varData.isActive,
          });
          variants.push(variant);
          log.success(`  - Created variant: ${variant._id}`);

          // Tạo InventoryItem cho mỗi size của variant
          for (const sizeWithSku of sizesWithSku) {
            const existingInv = await InventoryItem.findOne({
              product: product._id,
              variant: variant._id,
              size: sizeWithSku.size,
            });

            if (!existingInv) {
              await InventoryItem.create({
                product: product._id,
                variant: variant._id,
                size: sizeWithSku.size,
                quantity: 50,
                sellingPrice: 2500000,
                costPrice: 1500000,
                importPrice: 1500000,
                finalPrice: 2500000,
                sku: sizeWithSku.sku,
              });
            }
          }
          log.success(`    - Created inventory items for variant`);
        }
      } else {
        log.info(`Product ${prodData.name} already exists`);
        // Lấy variants của product
        const existingVariants = await Variant.find({
          product: product._id,
          isActive: true,
          deletedAt: null,
        });
        variants.push(...existingVariants);
      }
      products.push(product);
    }

    // 7. Tạo Cart cho test user
    log.section("Creating Cart for Test User");
    if (testUser && variants.length > 0) {
      let cart = await Cart.findOne({ user: testUser._id });
      if (!cart) {
        const firstVariant = variants[0];
        const firstSize = sizes[0];
        const firstProduct = products[0];

        // Lấy giá từ InventoryItem
        const invItem = await InventoryItem.findOne({
          variant: firstVariant._id,
          size: firstSize._id,
        });

        cart = await Cart.create({
          user: testUser._id,
          cartItems: [
            {
              variant: firstVariant._id,
              size: firstSize._id,
              quantity: 2,
              price: invItem?.finalPrice || 2500000,
              productName: firstProduct?.name || "Test Product",
              image: "https://example.com/product-image.jpg",
              isSelected: true,
              isAvailable: true,
            },
          ],
          totalItems: 2,
          subTotal: (invItem?.finalPrice || 2500000) * 2,
        });
        log.success(`Created cart for user: ${testUser.email}`);
      } else {
        log.info(`Cart for user ${testUser.email} already exists`);
      }
    }

    // 8. Tạo Order cho test user
    log.section("Creating Orders for Test User");
    if (testUser && variants.length > 0) {
      const existingOrder = await Order.findOne({ user: testUser._id });
      if (!existingOrder) {
        const firstVariant = variants[0];
        const firstSize = sizes[0];
        const firstProduct = products[0];
        const invItem = await InventoryItem.findOne({
          variant: firstVariant._id,
          size: firstSize._id,
        });

        const orderPrice = invItem?.finalPrice || 2500000;
        const costPrice = invItem?.costPrice || 1500000;

        // Order pending
        const pendingOrder = await Order.create({
          user: testUser._id,
          orderItems: [
            {
              variant: firstVariant._id,
              size: firstSize._id,
              quantity: 1,
              price: orderPrice,
              costPrice: costPrice,
              productName: firstProduct?.name || "Test Product",
              image: "https://example.com/product-image.jpg",
            },
          ],
          subTotal: orderPrice,
          totalAfterDiscountAndShipping: orderPrice,
          status: "pending",
          payment: {
            method: "COD",
            paymentStatus: "pending",
          },
          shippingAddress: {
            name: "Test User",
            phone: "0901234568",
            province: "Hồ Chí Minh",
            district: "Quận 1",
            ward: "Phường Bến Nghé",
            detail: "123 Nguyễn Huệ",
          },
        });
        log.success(`Created pending order: ${pendingOrder._id}`);

        // Order delivered (để test review)
        const deliveredOrder = await Order.create({
          user: testUser._id,
          orderItems: [
            {
              variant: firstVariant._id,
              size: firstSize._id,
              quantity: 1,
              price: orderPrice,
              costPrice: costPrice,
              productName: firstProduct?.name || "Test Product",
              image: "https://example.com/product-image.jpg",
            },
          ],
          subTotal: orderPrice,
          totalAfterDiscountAndShipping: orderPrice,
          status: "delivered",
          payment: {
            method: "COD",
            paymentStatus: "paid",
            paidAt: new Date(),
          },
          shippingAddress: {
            name: "Test User",
            phone: "0901234568",
            province: "Hồ Chí Minh",
            district: "Quận 1",
            ward: "Phường Bến Nghé",
            detail: "123 Nguyễn Huệ",
          },
        });
        log.success(`Created delivered order: ${deliveredOrder._id}`);
      } else {
        log.info(`Order for user ${testUser.email} already exists`);
      }
    }

    // 9. Tạo Coupon
    log.section("Creating Coupons");
    const couponData = {
      code: "TESTDISCOUNT10",
      name: "Giảm 10%",
      description: "Giảm 10% cho đơn hàng test",
      type: "percent",
      value: 10,
      maxDiscount: 200000,
      minOrderValue: 500000,
      usageLimit: 100,
      usedCount: 0,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      isActive: true,
    };

    let coupon = await Coupon.findOne({ code: couponData.code });
    if (!coupon) {
      coupon = await Coupon.create(couponData);
      log.success(`Created coupon: ${couponData.code}`);
    } else {
      log.info(`Coupon ${couponData.code} already exists`);
    }

    // 10. Tạo Review cho product
    log.section("Creating Reviews");
    if (testUser && products.length > 0) {
      const existingReview = await Review.findOne({
        user: testUser._id,
        product: products[0]._id,
      });
      if (!existingReview) {
        const deliveredOrder = await Order.findOne({
          user: testUser._id,
          status: "delivered",
        });
        if (deliveredOrder && deliveredOrder.orderItems.length > 0) {
          const orderItemId = deliveredOrder.orderItems[0]._id;
          await Review.create({
            user: testUser._id,
            product: products[0]._id,
            orderItem: orderItemId,
            rating: 5,
            content: "Sản phẩm rất tốt, đúng size và giao hàng nhanh!",
            isActive: true,
          });
          log.success(`Created review for product: ${products[0].name}`);
        } else {
          log.warn("No delivered order with items found for review");
        }
      } else {
        log.info(`Review for product ${products[0].name} already exists`);
      }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("   SEED DATA SUMMARY");
    console.log("=".repeat(60));
    log.success(`Sizes: ${sizes.length}`);
    log.success(`Colors: ${colorDocs.length}`);
    log.success(`Categories: ${categories.length}`);
    log.success(`Brands: ${brands.length}`);
    log.success(`Users: ${users.length}`);
    log.success(`Products: ${products.length}`);
    log.success(`Variants: ${variants.length}`);

    console.log("\n" + "=".repeat(60));
    log.info("Test Credentials:");
    console.log(`   Admin: admin@shoeshop.com / Test@123456`);
    console.log(`   User:  user@shoeshop.com / Test@123456`);
    console.log(`   Shipper: shipper@shoeshop.com / Test@123456`);
    console.log("=".repeat(60));
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
