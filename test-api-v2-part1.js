/**
 * =====================================================================
 * BACKEND SHOESHOP - COMPREHENSIVE API TEST SUITE (PART 1/2)
 * =====================================================================
 * Part 1: Auth APIs + Public APIs
 * - Authentication (Register, Login, Verify OTP, Refresh Token, Logout)
 * - Brands, Categories, Products, Reviews, Banners, Blogs, Tags
 * - Coupons, Filter, Compare, Gemini AI
 *
 * Routes theo cấu trúc:
 * - /api/auth/* - Auth routes
 * - /api/brands/* - Public brands
 * - /api/categories/* - Public categories
 * - /api/products/* - Public products
 * - /api/reviews/* - Public reviews
 * - /api/banners/* - Public banners
 * - /api/blogs/* - Public blogs
 * - /api/blogs/categories/* - Blog categories
 * - /api/tags/* - Public tags
 * - /api/coupons/* - Public coupon validation
 * - /api/filters/* - Filter options
 * - /api/compare/* - Product comparison
 * - /api/public/ai-chat - Gemini AI chat
 * =====================================================================
 */

const axios = require("axios");

// =====================================================================
// Configuration
// =====================================================================
const BASE_URL = process.env.API_URL || "http://localhost:5005/api/v1";
const TIMEOUT = 30000;

// Test credentials
const TEST_USERS = {
  admin: { email: "admin@shoeshop.com", password: "Test@123456" },
  user: { email: "user@shoeshop.com", password: "Test@123456" },
  shipper: { email: "shipper@shoeshop.com", password: "Test@123456" },
};

// Tokens storage
const tokens = {
  admin: { access: null, refresh: null },
  user: { access: null, refresh: null },
  shipper: { access: null, refresh: null },
};

// Data storage for tests
const testData = {
  products: [],
  categories: [],
  brands: [],
  banners: [],
  blogPosts: [],
  blogCategories: [],
  tags: [],
};

// =====================================================================
// Utilities
// =====================================================================
const api = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT,
  validateStatus: () => true, // Don't throw on any status
});

// Colors for console
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

// Test result tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: [],
};

// Logging utilities
function logSection(title) {
  console.log(`\n${colors.cyan}${"═".repeat(70)}${colors.reset}`);
  console.log(`${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.cyan}${"═".repeat(70)}${colors.reset}`);
}

function logTest(name, passed, message = "") {
  if (passed) {
    results.passed++;
    console.log(`${colors.green}  ✓ ${name}${colors.reset}`);
  } else {
    results.failed++;
    results.errors.push({ name, message });
    console.log(`${colors.red}  ✗ ${name}${colors.reset}`);
    if (message) {
      console.log(`${colors.dim}    → ${message}${colors.reset}`);
    }
  }
}

function logSkip(name, reason) {
  results.skipped++;
  console.log(
    `${colors.yellow}  ○ ${name} (skipped: ${reason})${colors.reset}`
  );
}

// =====================================================================
// Schema validators for FE compatibility
// =====================================================================
const schemas = {
  productListItem: (product) => {
    const errors = [];
    if (!product._id) errors.push("product._id missing");
    if (!product.name) errors.push("product.name missing");
    if (!product.slug) errors.push("product.slug missing");
    return errors;
  },

  category: (cat) => {
    const errors = [];
    if (!cat._id) errors.push("category._id missing");
    if (!cat.name) errors.push("category.name missing");
    if (!cat.slug) errors.push("category.slug missing");
    return errors;
  },

  brand: (brand) => {
    const errors = [];
    if (!brand._id) errors.push("brand._id missing");
    if (!brand.name) errors.push("brand.name missing");
    if (!brand.slug) errors.push("brand.slug missing");
    return errors;
  },

  banner: (banner) => {
    const errors = [];
    if (!banner._id) errors.push("banner._id missing");
    if (!banner.title) errors.push("banner.title missing");
    return errors;
  },

  blogPost: (post) => {
    const errors = [];
    if (!post._id) errors.push("blogPost._id missing");
    if (!post.title) errors.push("blogPost.title missing");
    if (!post.slug) errors.push("blogPost.slug missing");
    return errors;
  },

  authLogin: (data) => {
    const errors = [];
    if (!data.token) errors.push("token missing");
    if (!data.refreshToken) errors.push("refreshToken missing");
    if (!data._id) errors.push("_id missing");
    if (!data.email) errors.push("email missing");
    return errors;
  },
};

// =====================================================================
// AUTH API TESTS
// =====================================================================
async function testAuthAPIs() {
  logSection("AUTH APIs");

  // Test 1: Login as Admin
  {
    const res = await api.post("/auth/login", TEST_USERS.admin);
    const passed = res.status === 200 && res.data.token;
    if (passed) {
      tokens.admin.access = res.data.token;
      tokens.admin.refresh = res.data.refreshToken;
    }
    const schemaErrors = passed ? schemas.authLogin(res.data) : [];
    logTest(
      "POST /auth/login - Admin login",
      passed && schemaErrors.length === 0,
      schemaErrors.join(", ")
    );
  }

  // Test 2: Login as User
  {
    const res = await api.post("/auth/login", TEST_USERS.user);
    const passed = res.status === 200 && res.data.token;
    if (passed) {
      tokens.user.access = res.data.token;
      tokens.user.refresh = res.data.refreshToken;
    }
    logTest("POST /auth/login - User login", passed);
  }

  // Test 3: Login as Shipper
  {
    const res = await api.post("/auth/login", TEST_USERS.shipper);
    const passed = res.status === 200 && res.data.token;
    if (passed) {
      tokens.shipper.access = res.data.token;
      tokens.shipper.refresh = res.data.refreshToken;
    }
    logTest("POST /auth/login - Shipper login", passed);
  }

  // Test 4: Login with invalid credentials
  {
    const res = await api.post("/auth/login", {
      email: "invalid@test.com",
      password: "wrongpass",
    });
    const passed =
      res.status === 401 || res.status === 400 || res.status === 404;
    logTest(
      "POST /auth/login - Invalid credentials (expect 4xx)",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 5: Login validation - empty email
  {
    const res = await api.post("/auth/login", {
      email: "",
      password: "Test@123456",
    });
    const passed = res.status === 400 || res.status === 422;
    logTest(
      "POST /auth/login - Empty email (expect 400/422)",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 6: Refresh token
  if (tokens.user.refresh) {
    const res = await api.post("/auth/refresh-token", {
      refreshToken: tokens.user.refresh,
    });
    const passed = res.status === 200 && res.data.token;
    if (passed) {
      tokens.user.access = res.data.token;
    }
    logTest("POST /auth/refresh-token - Valid refresh", passed);
  } else {
    logSkip("POST /auth/refresh-token", "No refresh token");
  }

  // Test 7: Refresh with invalid token
  {
    const res = await api.post("/auth/refresh-token", {
      refreshToken: "invalid-token",
    });
    const passed =
      res.status === 401 || res.status === 403 || res.status === 400;
    logTest(
      "POST /auth/refresh-token - Invalid token (expect 4xx)",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 8: Get sessions (protected)
  if (tokens.user.access) {
    const res = await api.get("/auth/sessions", {
      headers: { Authorization: `Bearer ${tokens.user.access}` },
    });
    const passed = res.status === 200;
    logTest(
      "GET /auth/sessions - Get login sessions",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 9: Access protected without token
  {
    const res = await api.get("/auth/sessions");
    const passed = res.status === 401;
    logTest(
      "GET /auth/sessions - No token (expect 401)",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 10: Register - existing email
  {
    const res = await api.post("/auth/register", {
      name: "Test User",
      email: TEST_USERS.user.email,
      password: "Test@123456",
      phone: "0901234567",
    });
    const passed =
      res.status === 400 || res.status === 409 || res.status === 422;
    logTest(
      "POST /auth/register - Existing email (expect 4xx)",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 11: Forgot password - non-existent
  {
    const res = await api.post("/auth/forgot-password", {
      email: "nonexistent@test.com",
    });
    const passed =
      res.status === 200 || res.status === 404 || res.status === 400;
    logTest(
      "POST /auth/forgot-password - Non-existent email",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 12: Reset password - invalid token
  {
    const res = await api.post("/auth/reset-password", {
      token: "invalid-token",
      newPassword: "NewPass@123456",
    });
    const passed =
      res.status === 400 || res.status === 401 || res.status === 404;
    logTest(
      "POST /auth/reset-password - Invalid token (expect 4xx)",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 13: Logout
  if (tokens.admin.access) {
    const res = await api.delete("/auth/logout", {
      headers: { Authorization: `Bearer ${tokens.admin.access}` },
    });
    const passed = res.status === 200 || res.status === 204;
    logTest(
      "DELETE /auth/logout - Admin logout",
      passed,
      `Status: ${res.status}`
    );

    // Re-login admin
    const loginRes = await api.post("/auth/login", TEST_USERS.admin);
    if (loginRes.status === 200) {
      tokens.admin.access = loginRes.data.token;
      tokens.admin.refresh = loginRes.data.refreshToken;
    }
  }

  // Test 14: Change password - wrong current
  if (tokens.user.access) {
    const res = await api.post(
      "/auth/change-password",
      { currentPassword: "wrongpass", newPassword: "NewTest@123456" },
      { headers: { Authorization: `Bearer ${tokens.user.access}` } }
    );
    const passed = res.status === 400 || res.status === 401;
    logTest(
      "POST /auth/change-password - Wrong current password",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// PUBLIC BRAND APIs
// =====================================================================
async function testBrandAPIs() {
  logSection("PUBLIC BRAND APIs");

  // Test 1: Get all brands
  {
    const res = await api.get("/brands");
    const passed = res.status === 200 && res.data;
    if (passed) {
      testData.brands = res.data.brands || res.data;
    }
    logTest("GET /brands - List all brands", passed, `Status: ${res.status}`);
  }

  // Test 2: Get brand by slug
  if (testData.brands.length > 0) {
    const brand = testData.brands[0];
    const res = await api.get(`/brands/slug/${brand.slug}`);
    const passed = res.status === 200;
    logTest(
      `GET /brands/slug/${brand.slug} - Get brand`,
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 3: Invalid slug
  {
    const res = await api.get("/brands/slug/invalid-brand-slug-12345");
    const passed = res.status === 404;
    logTest(
      "GET /brands/slug/:slug - Invalid slug (expect 404)",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 4: Validate format
  if (testData.brands.length > 0) {
    const errors = schemas.brand(testData.brands[0]);
    logTest("Brand response format", errors.length === 0, errors.join(", "));
  }
}

// =====================================================================
// PUBLIC CATEGORY APIs
// =====================================================================
async function testCategoryAPIs() {
  logSection("PUBLIC CATEGORY APIs");

  // Test 1: Get all categories
  {
    const res = await api.get("/categories");
    const passed = res.status === 200 && res.data;
    if (passed) {
      testData.categories = res.data.categories || res.data;
    }
    logTest(
      "GET /categories - List all categories",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 2: Get by slug
  if (testData.categories.length > 0) {
    const cat = testData.categories[0];
    const res = await api.get(`/categories/slug/${cat.slug}`);
    const passed = res.status === 200;
    logTest(
      `GET /categories/slug/${cat.slug} - Get category`,
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 3: Invalid slug
  {
    const res = await api.get("/categories/slug/invalid-category-12345");
    const passed = res.status === 404;
    logTest(
      "GET /categories/slug/:slug - Invalid (expect 404)",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 4: Validate format
  if (testData.categories.length > 0) {
    const errors = schemas.category(testData.categories[0]);
    logTest("Category response format", errors.length === 0, errors.join(", "));
  }
}

// =====================================================================
// PUBLIC PRODUCT APIs
// =====================================================================
async function testProductAPIs() {
  logSection("PUBLIC PRODUCT APIs");

  // Test 1: Get all products
  {
    const res = await api.get("/products");
    const passed = res.status === 200 && res.data;
    if (passed) {
      testData.products = res.data.products || res.data;
    }
    logTest(
      "GET /products - List all products",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 2: Pagination
  {
    const res = await api.get("/products?page=1&limit=5");
    const passed = res.status === 200;
    logTest(
      "GET /products?page=1&limit=5 - Pagination",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 3: Category filter
  if (testData.categories.length > 0) {
    const cat = testData.categories[0];
    const res = await api.get(`/products?category=${cat._id}`);
    const passed = res.status === 200;
    logTest(
      "GET /products?category=... - Filter by category",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 4: Brand filter
  if (testData.brands.length > 0) {
    const brand = testData.brands[0];
    const res = await api.get(`/products?brand=${brand._id}`);
    const passed = res.status === 200;
    logTest(
      "GET /products?brand=... - Filter by brand",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 5: Price filter
  {
    const res = await api.get("/products?minPrice=100000&maxPrice=5000000");
    const passed = res.status === 200;
    logTest(
      "GET /products?minPrice&maxPrice - Price filter",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 6: Search
  {
    const res = await api.get("/products?search=Nike");
    const passed = res.status === 200;
    logTest(
      "GET /products?search=Nike - Search",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 7: Get by slug
  if (testData.products.length > 0) {
    const product = testData.products[0];
    const res = await api.get(`/products/slug/${product.slug}`);
    const passed = res.status === 200;
    logTest(
      `GET /products/slug/${product.slug} - Get product`,
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 8: Invalid slug
  {
    const res = await api.get("/products/slug/invalid-product-12345");
    const passed = res.status === 404;
    logTest(
      "GET /products/slug/:slug - Invalid (expect 404)",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 9: Featured products
  {
    const res = await api.get("/products?isFeatured=true");
    const passed = res.status === 200;
    logTest(
      "GET /products?isFeatured=true - Featured",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 10: Size guide
  if (testData.products.length > 0) {
    const product = testData.products[0];
    const res = await api.get(`/products/${product._id}/size-guide`);
    const passed = res.status === 200 || res.status === 404;
    logTest(
      "GET /products/:id/size-guide - Size guide",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 11: Validate format
  if (testData.products.length > 0) {
    const errors = schemas.productListItem(testData.products[0]);
    logTest("Product response format", errors.length === 0, errors.join(", "));
  }
}

// =====================================================================
// PUBLIC REVIEW APIs
// =====================================================================
async function testReviewAPIs() {
  logSection("PUBLIC REVIEW APIs");

  // Test 1: Get reviews for product
  if (testData.products.length > 0) {
    const product = testData.products[0];
    const res = await api.get(`/reviews/product/${product._id}`);
    const passed = res.status === 200;
    logTest(
      "GET /reviews/product/:id - Product reviews",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 2: Pagination
  if (testData.products.length > 0) {
    const product = testData.products[0];
    const res = await api.get(`/reviews/product/${product._id}?page=1&limit=5`);
    const passed = res.status === 200;
    logTest(
      "GET /reviews/product/:id?page&limit - Pagination",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 3: Rating filter
  if (testData.products.length > 0) {
    const product = testData.products[0];
    const res = await api.get(`/reviews/product/${product._id}?rating=5`);
    const passed = res.status === 200;
    logTest(
      "GET /reviews/product/:id?rating=5 - Rating filter",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 4: Invalid product
  {
    const res = await api.get("/reviews/product/000000000000000000000000");
    const passed = res.status === 200 || res.status === 404;
    logTest(
      "GET /reviews/product/:id - Invalid product",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// PUBLIC BANNER APIs
// =====================================================================
async function testBannerAPIs() {
  logSection("PUBLIC BANNER APIs");

  // Test 1: Get all banners
  {
    const res = await api.get("/banners");
    const passed = res.status === 200 && res.data;
    if (passed) {
      testData.banners = res.data.banners || res.data;
    }
    logTest("GET /banners - List all banners", passed, `Status: ${res.status}`);
  }

  // Test 2: Active only
  {
    const res = await api.get("/banners?isActive=true");
    const passed = res.status === 200;
    logTest(
      "GET /banners?isActive=true - Active banners",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 3: Validate format
  if (testData.banners.length > 0) {
    const errors = schemas.banner(testData.banners[0]);
    logTest("Banner response format", errors.length === 0, errors.join(", "));
  }
}

// =====================================================================
// PUBLIC BLOG APIs
// =====================================================================
async function testBlogAPIs() {
  logSection("PUBLIC BLOG APIs");

  // Test 1: Get all posts
  {
    const res = await api.get("/blogs");
    const passed = res.status === 200 && res.data;
    if (passed) {
      testData.blogPosts = res.data.posts || res.data.blogs || res.data;
    }
    logTest("GET /blogs - List blog posts", passed, `Status: ${res.status}`);
  }

  // Test 2: Pagination
  {
    const res = await api.get("/blogs?page=1&limit=5");
    const passed = res.status === 200;
    logTest(
      "GET /blogs?page=1&limit=5 - Pagination",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 3: Get by slug
  if (testData.blogPosts.length > 0) {
    const post = testData.blogPosts[0];
    const res = await api.get(`/blogs/${post.slug}`);
    const passed = res.status === 200;
    logTest(
      `GET /blogs/${post.slug} - Get post`,
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 4: Invalid slug
  {
    const res = await api.get("/blogs/invalid-blog-12345");
    const passed = res.status === 404;
    logTest(
      "GET /blogs/:slug - Invalid (expect 404)",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 5: Get categories
  {
    const res = await api.get("/blogs/categories");
    const passed = res.status === 200;
    if (passed) {
      testData.blogCategories = res.data.categories || res.data;
    }
    logTest(
      "GET /blogs/categories - Blog categories",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 6: Filter by category
  if (testData.blogCategories.length > 0) {
    const cat = testData.blogCategories[0];
    const res = await api.get(`/blogs?category=${cat._id}`);
    const passed = res.status === 200;
    logTest(
      "GET /blogs?category=... - Filter by category",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 7: Validate format
  if (testData.blogPosts.length > 0) {
    const errors = schemas.blogPost(testData.blogPosts[0]);
    logTest(
      "Blog post response format",
      errors.length === 0,
      errors.join(", ")
    );
  }
}

// =====================================================================
// PUBLIC TAG APIs
// =====================================================================
async function testTagAPIs() {
  logSection("PUBLIC TAG APIs");

  // Test 1: Get all tags
  {
    const res = await api.get("/tags");
    const passed = res.status === 200 && res.data;
    if (passed) {
      testData.tags = res.data.tags || res.data;
    }
    logTest("GET /tags - List all tags", passed, `Status: ${res.status}`);
  }

  // Test 2: Get by ID
  if (testData.tags.length > 0) {
    const tag = testData.tags[0];
    const res = await api.get(`/tags/${tag._id}`);
    const passed = res.status === 200;
    logTest(
      `GET /tags/${tag._id} - Get tag by ID`,
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 3: Products by tag
  if (testData.tags.length > 0) {
    const tag = testData.tags[0];
    const res = await api.get(`/products?tag=${tag._id}`);
    const passed = res.status === 200;
    logTest(
      "GET /products?tag=... - Filter by tag",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// PUBLIC COUPON APIs
// =====================================================================
async function testCouponAPIs() {
  logSection("PUBLIC COUPON APIs");

  // Test 1: Get public coupons
  {
    const res = await api.get("/coupons/public");
    const passed = res.status === 200;
    logTest(
      "GET /coupons/public - List public coupons",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 2: User collect coupon (requires auth) - expect 401
  {
    const res = await api.post("/users/coupons/invalid-id/collect");
    const passed = res.status === 401;
    logTest(
      "POST /users/coupons/:id/collect - No auth (expect 401)",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 3: User collected coupons (requires auth) - expect 401
  {
    const res = await api.get("/users/coupons/collected");
    const passed = res.status === 401;
    logTest(
      "GET /users/coupons/collected - No auth (expect 401)",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// PUBLIC FILTER APIs
// =====================================================================
async function testFilterAPIs() {
  logSection("PUBLIC FILTER APIs");

  // Test 1: Get attributes
  {
    const res = await api.get("/filters/attributes");
    const passed = res.status === 200;
    logTest(
      "GET /filters/attributes - Filter attributes",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 2: Suggestions
  {
    const res = await api.get("/filters/suggestions?q=nike");
    const passed = res.status === 200 || res.status === 404;
    logTest(
      "GET /filters/suggestions?q=nike - Suggestions",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// PUBLIC COMPARE APIs
// =====================================================================
async function testCompareAPIs() {
  logSection("PUBLIC COMPARE APIs");

  // Test 1: Compare 2 products
  if (testData.products.length >= 2) {
    const productIds = testData.products.slice(0, 2).map((p) => p._id);
    const res = await api.post("/compare", { productIds });
    const passed = res.status === 200;
    logTest(
      "POST /compare - Compare 2 products",
      passed,
      `Status: ${res.status}`
    );
  } else {
    logSkip("POST /compare", "Not enough products");
  }

  // Test 2: Invalid IDs
  {
    const res = await api.post("/compare", {
      productIds: ["000000000000000000000000", "000000000000000000000001"],
    });
    const passed =
      res.status === 200 || res.status === 400 || res.status === 404;
    logTest(
      "POST /compare - Invalid product IDs",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// PUBLIC GEMINI AI APIs
// =====================================================================
async function testGeminiAPIs() {
  logSection("PUBLIC GEMINI AI APIs");

  // Test 1: Chat with AI
  {
    const res = await api.post("/public/ai-chat", {
      message: "Xin chào, có giày nào đang sale không?",
    });
    const passed =
      res.status === 200 ||
      res.status === 400 ||
      res.status === 429 ||
      res.status === 503;
    logTest(
      "POST /public/ai-chat - Chat with AI",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 2: Empty message
  {
    const res = await api.post("/public/ai-chat", { message: "" });
    const passed = res.status === 400 || res.status === 422;
    logTest(
      "POST /public/ai-chat - Empty message (expect 4xx)",
      passed,
      `Status: ${res.status}`
    );
  }

  // Test 3: Feedback
  {
    const res = await api.post("/public/ai-chat/feedback", {
      responseId: "test-id",
      rating: 5,
      feedback: "Helpful!",
    });
    const passed =
      res.status === 200 || res.status === 400 || res.status === 404;
    logTest(
      "POST /public/ai-chat/feedback - Submit feedback",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// Main Test Runner
// =====================================================================
async function runTests() {
  console.log(`
${colors.cyan}╔════════════════════════════════════════════════════════════════════╗
║   BACKEND SHOESHOP - API TEST SUITE (PART 1)                       ║
║   Auth APIs + Public APIs                                          ║
╚════════════════════════════════════════════════════════════════════╝${colors.reset}
`);

  console.log(`${colors.dim}Base URL: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.dim}Timeout: ${TIMEOUT}ms${colors.reset}`);

  const startTime = Date.now();

  try {
    await testAuthAPIs();
    await testBrandAPIs();
    await testCategoryAPIs();
    await testProductAPIs();
    await testReviewAPIs();
    await testBannerAPIs();
    await testBlogAPIs();
    await testTagAPIs();
    await testCouponAPIs();
    await testFilterAPIs();
    await testCompareAPIs();
    await testGeminiAPIs();
  } catch (error) {
    console.log(`\n${colors.red}Fatal Error: ${error.message}${colors.reset}`);
    if (error.code === "ECONNREFUSED") {
      console.log(
        `${colors.yellow}Make sure server is running on ${BASE_URL}${colors.reset}`
      );
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`
${colors.cyan}╔════════════════════════════════════════════════════════════════════╗
║                         TEST SUMMARY                               ║
╚════════════════════════════════════════════════════════════════════╝${colors.reset}
`);

  const total = results.passed + results.failed + results.skipped;
  const passRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;

  console.log(`  ${colors.green}Passed:  ${results.passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed:  ${results.failed}${colors.reset}`);
  console.log(`  ${colors.yellow}Skipped: ${results.skipped}${colors.reset}`);
  console.log(`  ${colors.dim}─────────────────${colors.reset}`);
  console.log(`  Total:   ${total}`);
  console.log(`  Pass Rate: ${passRate}%`);
  console.log(`  Duration: ${duration}s`);

  if (results.errors.length > 0) {
    console.log(`
${colors.red}╔════════════════════════════════════════════════════════════════════╗
║                         FAILED TESTS                               ║
╚════════════════════════════════════════════════════════════════════╝${colors.reset}
`);
    results.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.name}`);
      if (err.message) {
        console.log(`     ${colors.dim}→ ${err.message}${colors.reset}`);
      }
    });
  }

  console.log(
    `\n${colors.cyan}Part 2: User APIs, Admin APIs, Shipper APIs${colors.reset}\n`
  );

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests();
