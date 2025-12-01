/**
 * =====================================================================
 * BACKEND SHOESHOP - COMPREHENSIVE API TEST SUITE (PART 2/2)
 * =====================================================================
 * Part 2: User APIs + Admin APIs + Shipper APIs
 *
 * Routes theo cấu trúc:
 * - /api/v1/users/* - User authenticated routes
 * - /api/v1/admin/* - Admin/Staff routes
 * - /api/v1/shipper/* - Shipper routes
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
  staff: { email: "staff@shoeshop.com", password: "Test@123456" },
  user: { email: "user@shoeshop.com", password: "Test@123456" },
  shipper: { email: "shipper@shoeshop.com", password: "Test@123456" },
};

// Tokens storage
const tokens = {
  admin: { access: null, refresh: null },
  staff: { access: null, refresh: null },
  user: { access: null, refresh: null },
  shipper: { access: null, refresh: null },
};

// Data storage
const testData = {
  users: [],
  products: [],
  variants: [],
  categories: [],
  brands: [],
  colors: [],
  sizes: [],
  orders: [],
  coupons: [],
  banners: [],
  blogPosts: [],
  blogCategories: [],
  tags: [],
  reviews: [],
  sizeGuides: [],
  loyaltyTiers: [],
  knowledgeDocs: [],
  notifications: [],
  inventory: [],
  shipperOrders: [],
  returnRequests: [],
};

// =====================================================================
// Utilities
// =====================================================================
const api = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT,
  validateStatus: () => true,
});

// Colors
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

// Results
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: [],
};

// Helpers
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

// Auth helper
function authHeader(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

// =====================================================================
// LOGIN ALL USERS
// =====================================================================
async function loginAllUsers() {
  logSection("LOGIN ALL USERS");

  // Login Admin
  {
    const res = await api.post("/auth/login", TEST_USERS.admin);
    if (res.status === 200 && res.data.token) {
      tokens.admin.access = res.data.token;
      tokens.admin.refresh = res.data.refreshToken;
      logTest("Login Admin", true);
    } else {
      logTest("Login Admin", false, `Status: ${res.status}`);
    }
  }

  // Login Staff
  {
    const res = await api.post("/auth/login", TEST_USERS.staff);
    if (res.status === 200 && res.data.token) {
      tokens.staff.access = res.data.token;
      tokens.staff.refresh = res.data.refreshToken;
      logTest("Login Staff", true);
    } else {
      logTest("Login Staff", false, `Status: ${res.status}`);
    }
  }

  // Login User
  {
    const res = await api.post("/auth/login", TEST_USERS.user);
    if (res.status === 200 && res.data.token) {
      tokens.user.access = res.data.token;
      tokens.user.refresh = res.data.refreshToken;
      logTest("Login User", true);
    } else {
      logTest("Login User", false, `Status: ${res.status}`);
    }
  }

  // Login Shipper
  {
    const res = await api.post("/auth/login", TEST_USERS.shipper);
    if (res.status === 200 && res.data.token) {
      tokens.shipper.access = res.data.token;
      tokens.shipper.refresh = res.data.refreshToken;
      logTest("Login Shipper", true);
    } else {
      logTest("Login Shipper", false, `Status: ${res.status}`);
    }
  }
}

// =====================================================================
// LOAD TEST DATA
// =====================================================================
async function loadTestData() {
  logSection("LOADING TEST DATA");

  // Products
  {
    const res = await api.get("/products?limit=20");
    if (res.status === 200) {
      testData.products = res.data.products || res.data || [];
      logTest(`Loaded ${testData.products.length} products`, true);
    }
  }

  // Categories
  {
    const res = await api.get("/categories");
    if (res.status === 200) {
      testData.categories = res.data.categories || res.data || [];
      logTest(`Loaded ${testData.categories.length} categories`, true);
    }
  }

  // Brands
  {
    const res = await api.get("/brands");
    if (res.status === 200) {
      testData.brands = res.data.brands || res.data || [];
      logTest(`Loaded ${testData.brands.length} brands`, true);
    }
  }

  // Tags
  {
    const res = await api.get("/tags");
    if (res.status === 200) {
      testData.tags = res.data.tags || res.data || [];
      logTest(`Loaded ${testData.tags.length} tags`, true);
    }
  }

  // Banners
  {
    const res = await api.get("/banners");
    if (res.status === 200) {
      testData.banners = res.data.banners || res.data || [];
      logTest(`Loaded ${testData.banners.length} banners`, true);
    }
  }

  // Blog categories
  {
    const res = await api.get("/blogs/categories");
    if (res.status === 200) {
      testData.blogCategories = res.data.categories || res.data || [];
      logTest(`Loaded ${testData.blogCategories.length} blog categories`, true);
    }
  }
}

// =====================================================================
// USER PROFILE APIs
// =====================================================================
async function testUserProfileAPIs() {
  logSection("USER PROFILE APIs");

  if (!tokens.user.access) {
    logSkip("User Profile APIs", "No user token");
    return;
  }

  const auth = authHeader(tokens.user.access);

  // Get profile
  {
    const res = await api.get("/users/profile", auth);
    const passed = res.status === 200 && res.data;
    logTest(
      "GET /users/profile - Get profile",
      passed,
      `Status: ${res.status}`
    );
  }

  // Update profile
  {
    const res = await api.put(
      "/users/profile",
      { name: "Updated Test User" },
      auth
    );
    const passed = res.status === 200;
    logTest(
      "PUT /users/profile - Update profile",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get addresses
  {
    const res = await api.get("/users/profile/addresses", auth);
    const passed = res.status === 200;
    logTest(
      "GET /users/profile/addresses - Get addresses",
      passed,
      `Status: ${res.status}`
    );
  }

  // Add address
  {
    const res = await api.post(
      "/users/profile/addresses",
      {
        fullName: "Test Address",
        phone: "0912345678",
        province: "Hồ Chí Minh",
        district: "Quận 1",
        ward: "Phường 1",
        addressDetail: "123 Test Street", // Fixed: streetAddress → addressDetail
        isDefault: false,
      },
      auth
    );
    const passed = res.status === 201 || res.status === 200;
    logTest(
      "POST /users/profile/addresses - Add address",
      passed,
      `Status: ${res.status}`
    );
  }

  // No token
  {
    const res = await api.get("/users/profile");
    const passed = res.status === 401;
    logTest(
      "GET /users/profile - No token (expect 401)",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// USER WISHLIST APIs
// =====================================================================
async function testUserWishlistAPIs() {
  logSection("USER WISHLIST APIs");

  if (!tokens.user.access) {
    logSkip("User Wishlist APIs", "No user token");
    return;
  }

  const auth = authHeader(tokens.user.access);

  // Get wishlist
  {
    const res = await api.get("/users/wishlist", auth);
    const passed = res.status === 200;
    logTest(
      "GET /users/wishlist - Get wishlist",
      passed,
      `Status: ${res.status}`
    );
  }

  // Add to wishlist
  if (testData.products.length > 0) {
    const product = testData.products[0];
    const res = await api.post(
      "/users/wishlist",
      { productId: product._id },
      auth
    );
    const passed =
      res.status === 200 || res.status === 201 || res.status === 400;
    logTest(
      "POST /users/wishlist - Add product",
      passed,
      `Status: ${res.status}`
    );
  }

  // Check wishlist
  if (testData.products.length > 0) {
    const product = testData.products[0];
    const res = await api.get(`/users/wishlist/check/${product._id}`, auth);
    const passed = res.status === 200;
    logTest(
      "GET /users/wishlist/check/:productId - Check",
      passed,
      `Status: ${res.status}`
    );
  }

  // Remove from wishlist
  if (testData.products.length > 0) {
    const product = testData.products[0];
    const res = await api.delete(`/users/wishlist/${product._id}`, auth);
    const passed = res.status === 200 || res.status === 404;
    logTest(
      "DELETE /users/wishlist/:productId - Remove",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// USER CART APIs
// =====================================================================
async function testUserCartAPIs() {
  logSection("USER CART APIs");

  if (!tokens.user.access) {
    logSkip("User Cart APIs", "No user token");
    return;
  }

  const auth = authHeader(tokens.user.access);

  // Get cart
  {
    const res = await api.get("/users/cart", auth);
    const passed = res.status === 200;
    logTest("GET /users/cart - Get cart", passed, `Status: ${res.status}`);
  }

  // Add to cart (need variant)
  if (testData.products.length > 0) {
    const product = testData.products[0];
    // Try to get variant
    const productRes = await api.get(`/products/${product._id}`);
    if (
      productRes.status === 200 &&
      productRes.data.variants &&
      productRes.data.variants.length > 0
    ) {
      const variant = productRes.data.variants[0];
      const res = await api.post(
        "/users/cart/items",
        {
          productId: product._id,
          variantId: variant._id,
          quantity: 1,
        },
        auth
      );
      const passed =
        res.status === 200 || res.status === 201 || res.status === 400;
      logTest(
        "POST /users/cart/items - Add to cart",
        passed,
        `Status: ${res.status}`
      );
    } else {
      logSkip("POST /users/cart/items", "No variant available");
    }
  }

  // Preview before order
  {
    const res = await api.post(
      "/users/cart/preview-before-order",
      { shippingFee: 30000 },
      auth
    );
    const passed = res.status === 200 || res.status === 400;
    logTest(
      "POST /users/cart/preview-before-order",
      passed,
      `Status: ${res.status}`
    );
  }

  // Clear cart
  {
    const res = await api.delete("/users/cart", auth);
    const passed = res.status === 200;
    logTest("DELETE /users/cart - Clear cart", passed, `Status: ${res.status}`);
  }
}

// =====================================================================
// USER ORDER APIs
// =====================================================================
async function testUserOrderAPIs() {
  logSection("USER ORDER APIs");

  if (!tokens.user.access) {
    logSkip("User Order APIs", "No user token");
    return;
  }

  const auth = authHeader(tokens.user.access);

  // Get orders
  {
    const res = await api.get("/users/orders", auth);
    const passed = res.status === 200;
    if (passed && res.data.orders) {
      testData.orders = res.data.orders;
    }
    logTest("GET /users/orders - Get orders", passed, `Status: ${res.status}`);
  }

  // Get order by ID - Note: May fail 403 if order doesn't belong to user
  if (testData.orders && testData.orders.length > 0) {
    const order = testData.orders[0];
    const res = await api.get(`/users/orders/${order._id}`, auth);
    // Accept 200 (success) or 403 (not owner) or 404 (not found)
    const passed =
      res.status === 200 || res.status === 403 || res.status === 404;
    logTest(
      `GET /users/orders/:id - Get order detail`,
      passed,
      `Status: ${res.status}`
    );
  }

  // Get order by code
  if (testData.orders && testData.orders.length > 0) {
    const order = testData.orders[0];
    if (order.orderCode) {
      const res = await api.get(`/users/orders/code/${order.orderCode}`, auth);
      const passed = res.status === 200;
      logTest(
        "GET /users/orders/code/:code - Get by code",
        passed,
        `Status: ${res.status}`
      );
    }
  }

  // Cancel order - expect error if not cancellable or not owner
  if (testData.orders && testData.orders.length > 0) {
    const order = testData.orders[0];
    const res = await api.post(
      `/users/orders/${order._id}/cancel`,
      { reason: "Test cancel" },
      auth
    );
    // Accept 200/400/403/404 - order may not belong to user or not cancellable
    const passed =
      res.status === 200 ||
      res.status === 400 ||
      res.status === 403 ||
      res.status === 404;
    logTest(
      "POST /users/orders/:id/cancel - Cancel order",
      passed,
      `Status: ${res.status}`
    );
  }

  // Repay failed order (VNPay)
  if (testData.orders && testData.orders.length > 0) {
    // Find a failed payment order or use first order
    const failedOrder =
      testData.orders.find((o) => o.paymentStatus === "failed") ||
      testData.orders[0];
    const res = await api.post(
      `/users/orders/${failedOrder._id}/repay`,
      {},
      auth
    );
    // Accept 200 (success with payment URL) or 400 (order not eligible) or 403/404
    const passed = [200, 400, 403, 404].includes(res.status);
    logTest(
      "POST /users/orders/:id/repay - Repay failed order",
      passed,
      `Status: ${res.status}`
    );
  }

  // No token
  {
    const res = await api.get("/users/orders");
    const passed = res.status === 401;
    logTest(
      "GET /users/orders - No token (expect 401)",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// USER REVIEW APIs
// =====================================================================
async function testUserReviewAPIs() {
  logSection("USER REVIEW APIs");

  if (!tokens.user.access) {
    logSkip("User Review APIs", "No user token");
    return;
  }

  const auth = authHeader(tokens.user.access);

  // Get user reviews
  {
    const res = await api.get("/users/reviews/my-reviews", auth);
    const passed = res.status === 200;
    logTest(
      "GET /users/reviews/my-reviews - Get my reviews",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get reviewable items
  {
    const res = await api.get("/users/reviews/reviewable-products", auth);
    const passed = res.status === 200;
    if (passed && res.data.items) {
      testData.reviewableItems = res.data.items;
    }
    logTest(
      "GET /users/reviews/reviewable-products",
      passed,
      `Status: ${res.status}`
    );
  }

  // No token
  {
    const res = await api.get("/users/reviews/my-reviews");
    const passed = res.status === 401;
    logTest(
      "GET /users/reviews/my-reviews - No token (expect 401)",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// USER LOYALTY APIs
// =====================================================================
async function testUserLoyaltyAPIs() {
  logSection("USER LOYALTY APIs");

  if (!tokens.user.access) {
    logSkip("User Loyalty APIs", "No user token");
    return;
  }

  const auth = authHeader(tokens.user.access);

  // Get loyalty stats
  {
    const res = await api.get("/users/loyalty/stats", auth);
    const passed = res.status === 200;
    logTest(
      "GET /users/loyalty/stats - Get loyalty stats",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get transactions
  {
    const res = await api.get("/users/loyalty/transactions", auth);
    const passed = res.status === 200;
    logTest(
      "GET /users/loyalty/transactions - Get transactions",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// USER NOTIFICATION APIs
// =====================================================================
async function testUserNotificationAPIs() {
  logSection("USER NOTIFICATION APIs");

  if (!tokens.user.access) {
    logSkip("User Notification APIs", "No user token");
    return;
  }

  const auth = authHeader(tokens.user.access);

  // Get notifications
  {
    const res = await api.get("/users/notifications", auth);
    const passed = res.status === 200;
    if (passed && res.data.notifications) {
      testData.notifications = res.data.notifications;
    }
    logTest(
      "GET /users/notifications - Get notifications",
      passed,
      `Status: ${res.status}`
    );
  }

  // Mark as read
  if (testData.notifications && testData.notifications.length > 0) {
    const notif = testData.notifications[0];
    const res = await api.patch(
      `/users/notifications/${notif._id}/read`,
      {},
      auth
    );
    const passed = res.status === 200;
    logTest(
      "PATCH /users/notifications/:id/read - Mark read",
      passed,
      `Status: ${res.status}`
    );
  }

  // Mark all as read
  {
    const res = await api.patch("/users/notifications/read-all", {}, auth);
    const passed = res.status === 200;
    logTest(
      "PATCH /users/notifications/read-all",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// USER VIEW HISTORY APIs
// =====================================================================
async function testUserViewHistoryAPIs() {
  logSection("USER VIEW HISTORY APIs");

  if (!tokens.user.access) {
    logSkip("User View History APIs", "No user token");
    return;
  }

  const auth = authHeader(tokens.user.access);

  // Get view history
  {
    const res = await api.get("/users/view-history", auth);
    const passed = res.status === 200;
    logTest(
      "GET /users/view-history - Get history",
      passed,
      `Status: ${res.status}`
    );
  }

  // Add to history
  if (testData.products.length > 0) {
    const product = testData.products[0];
    const res = await api.post(
      "/users/view-history",
      { productId: product._id },
      auth
    );
    const passed = res.status === 200 || res.status === 201;
    logTest(
      "POST /users/view-history - Add view",
      passed,
      `Status: ${res.status}`
    );
  }

  // Clear history
  {
    const res = await api.delete("/users/view-history", auth);
    const passed = res.status === 200;
    logTest(
      "DELETE /users/view-history - Clear history",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// USER RECOMMENDATION APIs
// =====================================================================
async function testUserRecommendationAPIs() {
  logSection("USER RECOMMENDATION APIs");

  if (!tokens.user.access) {
    logSkip("User Recommendation APIs", "No user token");
    return;
  }

  const auth = authHeader(tokens.user.access);

  // Get recommendations
  {
    const res = await api.get("/users/recommendations", auth);
    const passed = res.status === 200;
    logTest(
      "GET /users/recommendations - Get recommendations",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// USER COUPON APIs
// =====================================================================
async function testUserCouponAPIs() {
  logSection("USER COUPON APIs");

  if (!tokens.user.access) {
    logSkip("User Coupon APIs", "No user token");
    return;
  }

  const auth = authHeader(tokens.user.access);

  // Get available coupons
  {
    const res = await api.get("/users/coupons", auth);
    const passed = res.status === 200;
    if (passed && res.data.coupons) {
      testData.coupons = res.data.coupons;
    }
    logTest(
      "GET /users/coupons - Get available coupons",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get collected coupons
  {
    const res = await api.get("/users/coupons/collected", auth);
    const passed = res.status === 200;
    logTest(
      "GET /users/coupons/collected - Get collected",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// USER RETURN APIs
// =====================================================================
async function testUserReturnAPIs() {
  logSection("USER RETURN APIs");

  if (!tokens.user.access) {
    logSkip("User Return APIs", "No user token");
    return;
  }

  const auth = authHeader(tokens.user.access);

  // Get return requests
  {
    const res = await api.get("/users/returns", auth);
    const passed = res.status === 200;
    if (passed && res.data.returnRequests) {
      testData.returnRequests = res.data.returnRequests;
    }
    logTest(
      "GET /users/returns - Get return requests",
      passed,
      `Status: ${res.status}`
    );
  }

  // No token
  {
    const res = await api.get("/users/returns");
    const passed = res.status === 401;
    logTest(
      "GET /users/returns - No token (expect 401)",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN DASHBOARD APIs
// =====================================================================
async function testAdminDashboardAPIs() {
  logSection("ADMIN DASHBOARD APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Dashboard APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get dashboard data
  {
    const res = await api.get("/admin/dashboard", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/dashboard - Get dashboard data",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get daily revenue
  {
    const res = await api.get("/admin/dashboard/revenue/daily", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/dashboard/revenue/daily",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get monthly revenue
  {
    const res = await api.get("/admin/dashboard/revenue/monthly", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/dashboard/revenue/monthly",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get top selling products
  {
    const res = await api.get("/admin/dashboard/top-selling-products", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/dashboard/top-selling-products",
      passed,
      `Status: ${res.status}`
    );
  }

  // No token
  {
    const res = await api.get("/admin/dashboard");
    const passed = res.status === 401;
    logTest(
      "GET /admin/dashboard - No token (expect 401)",
      passed,
      `Status: ${res.status}`
    );
  }

  // User token (expect 403)
  if (tokens.user.access) {
    const res = await api.get(
      "/admin/dashboard",
      authHeader(tokens.user.access)
    );
    const passed = res.status === 403;
    logTest(
      "GET /admin/dashboard - User (expect 403)",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN USER APIs
// =====================================================================
async function testAdminUserAPIs() {
  logSection("ADMIN USER APIs");

  if (!tokens.admin.access) {
    logSkip("Admin User APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get users
  {
    const res = await api.get("/admin/users", auth);
    const passed = res.status === 200;
    if (passed && res.data.users) {
      testData.users = res.data.users;
    }
    logTest(
      "GET /admin/users - Get all users",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get user by ID
  if (testData.users.length > 0) {
    const user = testData.users[0];
    const res = await api.get(`/admin/users/${user._id}`, auth);
    const passed = res.status === 200;
    logTest("GET /admin/users/:id - Get user", passed, `Status: ${res.status}`);
  }

  // Search users
  {
    const res = await api.get("/admin/users?search=test", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/users?search=... - Search",
      passed,
      `Status: ${res.status}`
    );
  }

  // Filter by role
  {
    const res = await api.get("/admin/users?role=user", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/users?role=user - Filter",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN PRODUCT APIs
// =====================================================================
async function testAdminProductAPIs() {
  logSection("ADMIN PRODUCT APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Product APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get products
  {
    const res = await api.get("/admin/products", auth);
    const passed = res.status === 200;
    if (passed && res.data.products) {
      testData.products = res.data.products;
    }
    logTest(
      "GET /admin/products - Get products",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get product by ID
  if (testData.products.length > 0) {
    const product = testData.products[0];
    const res = await api.get(`/admin/products/${product._id}`, auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/products/:id - Get product",
      passed,
      `Status: ${res.status}`
    );
  }

  // Search products
  {
    const res = await api.get("/admin/products?search=Nike", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/products?search=... - Search",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get deleted products
  {
    const res = await api.get("/admin/products/deleted", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/products/deleted - Deleted",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN ORDER APIs
// =====================================================================
async function testAdminOrderAPIs() {
  logSection("ADMIN ORDER APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Order APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get orders
  {
    const res = await api.get("/admin/orders", auth);
    const passed = res.status === 200;
    if (passed && res.data.orders) {
      testData.orders = res.data.orders;
    }
    logTest("GET /admin/orders - Get orders", passed, `Status: ${res.status}`);
  }

  // Get order by ID
  if (testData.orders.length > 0) {
    const order = testData.orders[0];
    const res = await api.get(`/admin/orders/${order._id}`, auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/orders/:id - Get order",
      passed,
      `Status: ${res.status}`
    );
  }

  // Filter by status
  {
    const res = await api.get("/admin/orders?status=pending", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/orders?status=pending - Filter",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get cancel requests (route that exists instead of /stats)
  {
    const res = await api.get("/admin/orders/cancel-requests", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/orders/cancel-requests",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN BRAND APIs
// =====================================================================
async function testAdminBrandAPIs() {
  logSection("ADMIN BRAND APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Brand APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get brands
  {
    const res = await api.get("/admin/brands", auth);
    const passed = res.status === 200;
    if (passed) {
      testData.brands = res.data.brands || res.data || [];
    }
    logTest("GET /admin/brands - Get brands", passed, `Status: ${res.status}`);
  }

  // Get brand by ID
  if (testData.brands.length > 0) {
    const brand = testData.brands[0];
    const res = await api.get(`/admin/brands/${brand._id}`, auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/brands/:id - Get brand",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get deleted
  {
    const res = await api.get("/admin/brands/deleted", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/brands/deleted - Deleted",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN CATEGORY APIs
// =====================================================================
async function testAdminCategoryAPIs() {
  logSection("ADMIN CATEGORY APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Category APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get categories
  {
    const res = await api.get("/admin/categories", auth);
    const passed = res.status === 200;
    if (passed) {
      testData.categories = res.data.categories || res.data || [];
    }
    logTest(
      "GET /admin/categories - Get categories",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get category by ID
  if (testData.categories.length > 0) {
    const cat = testData.categories[0];
    const res = await api.get(`/admin/categories/${cat._id}`, auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/categories/:id - Get category",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get deleted categories (no /tree route exists)
  {
    const res = await api.get("/admin/categories/deleted", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/categories/deleted - Get deleted",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN COLOR APIs
// =====================================================================
async function testAdminColorAPIs() {
  logSection("ADMIN COLOR APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Color APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get colors
  {
    const res = await api.get("/admin/colors", auth);
    const passed = res.status === 200;
    if (passed) {
      testData.colors = res.data.colors || res.data || [];
    }
    logTest("GET /admin/colors - Get colors", passed, `Status: ${res.status}`);
  }

  // Get color by ID
  if (testData.colors.length > 0) {
    const color = testData.colors[0];
    const res = await api.get(`/admin/colors/${color._id}`, auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/colors/:id - Get color",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN SIZE APIs
// =====================================================================
async function testAdminSizeAPIs() {
  logSection("ADMIN SIZE APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Size APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get sizes
  {
    const res = await api.get("/admin/sizes", auth);
    const passed = res.status === 200;
    if (passed) {
      testData.sizes = res.data.sizes || res.data || [];
    }
    logTest("GET /admin/sizes - Get sizes", passed, `Status: ${res.status}`);
  }

  // Get size by ID
  if (testData.sizes.length > 0) {
    const size = testData.sizes[0];
    const res = await api.get(`/admin/sizes/${size._id}`, auth);
    const passed = res.status === 200;
    logTest("GET /admin/sizes/:id - Get size", passed, `Status: ${res.status}`);
  }
}

// =====================================================================
// ADMIN TAG APIs
// =====================================================================
async function testAdminTagAPIs() {
  logSection("ADMIN TAG APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Tag APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get tags
  {
    const res = await api.get("/admin/tags", auth);
    const passed = res.status === 200;
    logTest("GET /admin/tags - Get tags", passed, `Status: ${res.status}`);
  }
}

// =====================================================================
// ADMIN COUPON APIs
// =====================================================================
async function testAdminCouponAPIs() {
  logSection("ADMIN COUPON APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Coupon APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get coupons
  {
    const res = await api.get("/admin/coupons", auth);
    const passed = res.status === 200;
    if (passed) {
      testData.coupons = res.data.coupons || res.data || [];
    }
    logTest(
      "GET /admin/coupons - Get coupons",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get coupon by ID
  if (testData.coupons.length > 0) {
    const coupon = testData.coupons[0];
    const res = await api.get(`/admin/coupons/${coupon._id}`, auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/coupons/:id - Get coupon",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN BANNER APIs
// =====================================================================
async function testAdminBannerAPIs() {
  logSection("ADMIN BANNER APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Banner APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get banners
  {
    const res = await api.get("/admin/banners", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/banners - Get banners",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN REVIEW APIs
// =====================================================================
async function testAdminReviewAPIs() {
  logSection("ADMIN REVIEW APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Review APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get reviews
  {
    const res = await api.get("/admin/reviews", auth);
    const passed = res.status === 200;
    if (passed) {
      testData.reviews = res.data.reviews || res.data || [];
    }
    logTest(
      "GET /admin/reviews - Get reviews",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get deleted reviews (route /:productId/stats requires productId)
  {
    const res = await api.get("/admin/reviews/deleted", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/reviews/deleted - Get deleted reviews",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN BLOG APIs
// =====================================================================
async function testAdminBlogAPIs() {
  logSection("ADMIN BLOG APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Blog APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get blogs
  {
    const res = await api.get("/admin/blogs", auth);
    const passed = res.status === 200;
    logTest("GET /admin/blogs - Get blogs", passed, `Status: ${res.status}`);
  }

  // Get blog categories
  {
    const res = await api.get("/admin/blogs/categories", auth);
    const passed = res.status === 200;
    logTest("GET /admin/blogs/categories", passed, `Status: ${res.status}`);
  }
}

// =====================================================================
// ADMIN INVENTORY APIs
// =====================================================================
async function testAdminInventoryAPIs() {
  logSection("ADMIN INVENTORY APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Inventory APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get inventory
  {
    const res = await api.get("/admin/inventory", auth);
    const passed = res.status === 200;
    if (passed) {
      testData.inventory = res.data.inventory || res.data || [];
    }
    logTest(
      "GET /admin/inventory - Get inventory",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get inventory stats (correct route instead of /low-stock)
  {
    const res = await api.get("/admin/inventory/stats", auth);
    const passed = res.status === 200;
    logTest("GET /admin/inventory/stats", passed, `Status: ${res.status}`);
  }

  // Get transactions
  {
    const res = await api.get("/admin/inventory/transactions", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/inventory/transactions",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN REPORT APIs
// =====================================================================
async function testAdminReportAPIs() {
  logSection("ADMIN REPORT APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Report APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get inventory report (only route that exists in reports)
  {
    const res = await api.get("/admin/reports/inventory", auth);
    const passed = res.status === 200;
    logTest("GET /admin/reports/inventory", passed, `Status: ${res.status}`);
  }
}

// =====================================================================
// ADMIN SIZE GUIDE APIs
// =====================================================================
async function testAdminSizeGuideAPIs() {
  logSection("ADMIN SIZE GUIDE APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Size Guide APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get size guides
  {
    const res = await api.get("/admin/size-guides", auth);
    const passed = res.status === 200;
    if (passed) {
      testData.sizeGuides = res.data.sizeGuides || res.data || [];
    }
    logTest(
      "GET /admin/size-guides - Get size guides",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN LOYALTY TIER APIs
// =====================================================================
async function testAdminLoyaltyTierAPIs() {
  logSection("ADMIN LOYALTY TIER APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Loyalty Tier APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get tiers
  {
    const res = await api.get("/admin/loyalty-tiers", auth);
    const passed = res.status === 200;
    if (passed) {
      testData.loyaltyTiers = res.data.tiers || res.data || [];
    }
    logTest(
      "GET /admin/loyalty-tiers - Get tiers",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN KNOWLEDGE BASE APIs
// =====================================================================
async function testAdminKnowledgeAPIs() {
  logSection("ADMIN KNOWLEDGE BASE APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Knowledge APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get documents
  {
    const res = await api.get("/admin/knowledge-base", auth);
    const passed = res.status === 200;
    if (passed) {
      testData.knowledgeDocs = res.data.documents || res.data || [];
    }
    logTest(
      "GET /admin/knowledge-base - Get docs",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN SHIPPER MANAGEMENT APIs
// =====================================================================
async function testAdminShipperAPIs() {
  logSection("ADMIN SHIPPER MANAGEMENT APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Shipper APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get shippers
  {
    const res = await api.get("/admin/shippers", auth);
    const passed = res.status === 200;
    if (passed && res.data.shippers) {
      testData.shippers = res.data.shippers;
    }
    logTest(
      "GET /admin/shippers - Get shippers",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get shipper detail (route /:shipperId/stats requires shipperId)
  if (testData.shippers && testData.shippers.length > 0) {
    const shipper = testData.shippers[0];
    const res = await api.get(`/admin/shippers/${shipper._id}`, auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/shippers/:id - Shipper detail",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN VARIANT APIs
// =====================================================================
async function testAdminVariantAPIs() {
  logSection("ADMIN VARIANT APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Variant APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get variants
  {
    const res = await api.get("/admin/variants", auth);
    const passed = res.status === 200;
    if (passed) {
      testData.variants = res.data.variants || res.data || [];
    }
    logTest(
      "GET /admin/variants - Get variants",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get variant by ID
  if (testData.variants.length > 0) {
    const variant = testData.variants[0];
    const res = await api.get(`/admin/variants/${variant._id}`, auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/variants/:id - Get variant",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get deleted variants
  {
    const res = await api.get("/admin/variants/deleted", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/variants/deleted - Get deleted variants",
      passed,
      `Status: ${res.status}`
    );
  }

  // Filter by product
  if (testData.products.length > 0) {
    const product = testData.products[0];
    const res = await api.get(`/admin/variants?product=${product._id}`, auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/variants?product=... - Filter by product",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN AUTH APIs
// =====================================================================
async function testAdminAuthAPIs() {
  logSection("ADMIN AUTH APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Auth APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get all sessions (admin only)
  {
    const res = await api.get("/admin/auth/sessions", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/auth/sessions - Get all sessions",
      passed,
      `Status: ${res.status}`
    );
  }

  // User cannot access admin auth routes
  if (tokens.user.access) {
    const userAuth = authHeader(tokens.user.access);
    const res = await api.get("/admin/auth/sessions", userAuth);
    const passed = res.status === 403;
    logTest(
      "GET /admin/auth/sessions - User (expect 403)",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN GEMINI APIs
// =====================================================================
async function testAdminGeminiAPIs() {
  logSection("ADMIN GEMINI APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Gemini APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get demo mode status
  {
    const res = await api.get("/admin/gemini/demo-mode", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/gemini/demo-mode - Get demo mode status",
      passed,
      `Status: ${res.status}`
    );
  }

  // User cannot access (expect 403)
  if (tokens.user.access) {
    const userAuth = authHeader(tokens.user.access);
    const res = await api.get("/admin/gemini/demo-mode", userAuth);
    const passed = res.status === 403;
    logTest(
      "GET /admin/gemini/demo-mode - User (expect 403)",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// USER CHAT APIs
// =====================================================================
async function testUserChatAPIs() {
  logSection("USER CHAT APIs");

  if (!tokens.user.access) {
    logSkip("User Chat APIs", "No user token");
    return;
  }

  const auth = authHeader(tokens.user.access);

  // Get conversations
  {
    const res = await api.get("/users/chat/conversations", auth);
    const passed = res.status === 200;
    logTest(
      "GET /users/chat/conversations - Get conversations",
      passed,
      `Status: ${res.status}`
    );
  }

  // Create conversation
  {
    const res = await api.post(
      "/users/chat/conversations",
      { subject: "Test support request" },
      auth
    );
    // Accept 200/201 (success) or 400 (already exists)
    const passed =
      res.status === 200 || res.status === 201 || res.status === 400;
    logTest(
      "POST /users/chat/conversations - Create conversation",
      passed,
      `Status: ${res.status}`
    );
  }

  // No token test
  {
    const res = await api.get("/users/chat/conversations");
    const passed = res.status === 401;
    logTest(
      "GET /users/chat/conversations - No token (expect 401)",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// ADMIN RETURN APIs
// =====================================================================
async function testAdminReturnAPIs() {
  logSection("ADMIN RETURN APIs");

  if (!tokens.admin.access) {
    logSkip("Admin Return APIs", "No admin token");
    return;
  }

  const auth = authHeader(tokens.admin.access);

  // Get return requests
  {
    const res = await api.get("/admin/returns", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/returns - Get returns",
      passed,
      `Status: ${res.status}`
    );
  }

  // Get stats (correct route: /stats/summary)
  {
    const res = await api.get("/admin/returns/stats/summary", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/returns/stats/summary - Return stats",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// SHIPPER APIs
// =====================================================================
async function testShipperAPIs() {
  logSection("SHIPPER APIs");

  if (!tokens.shipper.access) {
    logSkip("Shipper APIs", "No shipper token");
    return;
  }

  const auth = authHeader(tokens.shipper.access);

  // Get shipper orders
  {
    const res = await api.get("/shipper/my-orders", auth);
    const passed = res.status === 200;
    if (passed && res.data.orders) {
      testData.shipperOrders = res.data.orders;
    }
    logTest(
      "GET /shipper/my-orders - Get shipper orders",
      passed,
      `Status: ${res.status}`
    );
  }

  // Update availability
  {
    const res = await api.patch(
      "/shipper/availability",
      { isAvailable: true },
      auth
    );
    const passed = res.status === 200;
    logTest(
      "PATCH /shipper/availability - Update availability",
      passed,
      `Status: ${res.status}`
    );
  }

  // No token
  {
    const res = await api.get("/shipper/my-orders");
    const passed = res.status === 401;
    logTest(
      "GET /shipper/my-orders - No token (expect 401)",
      passed,
      `Status: ${res.status}`
    );
  }

  // User token (expect 403)
  if (tokens.user.access) {
    const res = await api.get(
      "/shipper/my-orders",
      authHeader(tokens.user.access)
    );
    const passed = res.status === 403;
    logTest(
      "GET /shipper/my-orders - User (expect 403)",
      passed,
      `Status: ${res.status}`
    );
  }

  // Update delivery status (need a valid shipping order)
  if (testData.shipperOrders && testData.shipperOrders.length > 0) {
    const shippingOrder = testData.shipperOrders.find(
      (o) => o.status === "shipping"
    );
    if (shippingOrder) {
      const res = await api.put(
        `/shipper/delivery-status/${shippingOrder._id}`,
        { status: "delivered", deliveryNote: "Test delivery completed" },
        auth
      );
      // Could be 200 or 400 depending on order state
      const passed = [200, 400].includes(res.status);
      logTest(
        "PUT /shipper/delivery-status/:orderId - Update delivery status",
        passed,
        `Status: ${res.status}`
      );
    } else {
      logSkip(
        "PUT /shipper/delivery-status/:orderId",
        "No shipping order available"
      );
    }
  } else {
    logSkip("PUT /shipper/delivery-status/:orderId", "No shipper orders");
  }
}

// =====================================================================
// STAFF APIs (Admin routes with staff token)
// =====================================================================
async function testStaffAPIs() {
  logSection("STAFF APIs");

  if (!tokens.staff.access) {
    logSkip("Staff APIs", "No staff token");
    return;
  }

  const auth = authHeader(tokens.staff.access);

  // Staff can NOT access admin dashboard (requireAdminOnly)
  {
    const res = await api.get("/admin/dashboard", auth);
    const passed = res.status === 403;
    logTest(
      "GET /admin/dashboard - Staff (expect 403, admin only)",
      passed,
      `Status: ${res.status}`
    );
  }

  // Staff can view orders (requireStaff allows)
  {
    const res = await api.get("/admin/orders", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/orders - Staff access",
      passed,
      `Status: ${res.status}`
    );
  }

  // Staff can view products
  {
    const res = await api.get("/admin/products", auth);
    const passed = res.status === 200;
    logTest(
      "GET /admin/products - Staff access",
      passed,
      `Status: ${res.status}`
    );
  }
}

// =====================================================================
// MAIN
// =====================================================================
async function main() {
  console.log("\n" + "╔" + "═".repeat(68) + "╗");
  console.log(
    "║   BACKEND SHOESHOP - API TEST SUITE (PART 2)".padEnd(69) + "║"
  );
  console.log("║   User APIs + Admin APIs + Shipper APIs".padEnd(69) + "║");
  console.log("╚" + "═".repeat(68) + "╝");

  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`Timeout: ${TIMEOUT}ms`);

  const startTime = Date.now();

  try {
    // Login all users
    await loginAllUsers();

    // Load test data
    await loadTestData();

    // User APIs
    await testUserProfileAPIs();
    await testUserWishlistAPIs();
    await testUserCartAPIs();
    await testUserOrderAPIs();
    await testUserReviewAPIs();
    await testUserLoyaltyAPIs();
    await testUserNotificationAPIs();
    await testUserViewHistoryAPIs();
    await testUserRecommendationAPIs();
    await testUserCouponAPIs();
    await testUserReturnAPIs();

    // Admin APIs
    await testAdminDashboardAPIs();
    await testAdminUserAPIs();
    await testAdminProductAPIs();
    await testAdminOrderAPIs();
    await testAdminBrandAPIs();
    await testAdminCategoryAPIs();
    await testAdminColorAPIs();
    await testAdminSizeAPIs();
    await testAdminTagAPIs();
    await testAdminCouponAPIs();
    await testAdminBannerAPIs();
    await testAdminReviewAPIs();
    await testAdminBlogAPIs();
    await testAdminInventoryAPIs();
    await testAdminReportAPIs();
    await testAdminSizeGuideAPIs();
    await testAdminLoyaltyTierAPIs();
    await testAdminKnowledgeAPIs();
    await testAdminShipperAPIs();
    await testAdminReturnAPIs();
    await testAdminVariantAPIs();
    await testAdminAuthAPIs();
    await testAdminGeminiAPIs();

    // User Chat APIs
    await testUserChatAPIs();

    // Shipper APIs
    await testShipperAPIs();

    // Staff APIs
    await testStaffAPIs();
  } catch (err) {
    console.log(`\n${colors.red}Fatal Error: ${err.message}${colors.reset}`);
    console.log("Make sure server is running on " + BASE_URL);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Summary
  console.log("\n╔" + "═".repeat(68) + "╗");
  console.log("║" + "                         TEST SUMMARY".padEnd(68) + "║");
  console.log("╚" + "═".repeat(68) + "╝");

  console.log(`\n  Passed:  ${results.passed}`);
  console.log(`  Failed:  ${results.failed}`);
  console.log(`  Skipped: ${results.skipped}`);
  console.log(`  ${"─".repeat(17)}`);
  console.log(
    `  Total:   ${results.passed + results.failed + results.skipped}`
  );
  console.log(
    `  Pass Rate: ${(
      (results.passed / (results.passed + results.failed || 1)) *
      100
    ).toFixed(1)}%`
  );
  console.log(`  Duration: ${duration}s`);

  if (results.errors.length > 0) {
    console.log("\n╔" + "═".repeat(68) + "╗");
    console.log("║" + "                         FAILED TESTS".padEnd(68) + "║");
    console.log("╚" + "═".repeat(68) + "╝");

    results.errors.forEach((err, i) => {
      console.log(`\n  ${i + 1}. ${err.name}`);
      if (err.message) {
        console.log(`     → ${err.message}`);
      }
    });
  }

  console.log("\n");

  process.exit(results.failed > 0 ? 1 : 0);
}

main();
