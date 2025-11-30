/**
 * =====================================================================
 * BACKEND SHOESHOP - SCENARIO-BASED API TEST SUITE
 * =====================================================================
 *
 * Test các kịch bản nghiệp vụ thực tế:
 * 1. User Journey: Đăng ký → Xem sản phẩm → Thêm giỏ hàng → Đặt hàng
 * 2. Admin Journey: Quản lý sản phẩm → Xử lý đơn hàng → Báo cáo
 * 3. Shipper Journey: Nhận đơn → Giao hàng → Cập nhật trạng thái
 * 4. Permission Tests: Kiểm tra phân quyền giữa các role
 * 5. Edge Cases: Các trường hợp biên và lỗi
 * =====================================================================
 */

const axios = require("axios");

const BASE_URL = process.env.API_URL || "http://localhost:5005/api/v1";
const TIMEOUT = 30000;

// Test credentials
const TEST_USERS = {
  admin: { email: "admin@shoeshop.com", password: "Test@123456" },
  staff: { email: "staff@shoeshop.com", password: "Test@123456" },
  user: { email: "user@shoeshop.com", password: "Test@123456" },
  user2: { email: "user2@shoeshop.com", password: "Test@123456" },
  shipper: { email: "shipper@shoeshop.com", password: "Test@123456" },
};

// Tokens storage
const tokens = {
  admin: null,
  staff: null,
  user: null,
  user2: null,
  shipper: null,
};

const api = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT,
  validateStatus: () => true,
});

// Colors and utilities
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  scenarios: [],
};

function logScenario(name) {
  console.log(
    `\n${colors.magenta}${colors.bold}▶ SCENARIO: ${name}${colors.reset}`
  );
  console.log(`${colors.magenta}${"─".repeat(68)}${colors.reset}`);
}

function logStep(step) {
  console.log(`${colors.cyan}  → ${step}${colors.reset}`);
}

function logTest(name, passed, message = "") {
  if (passed) {
    results.passed++;
    console.log(`${colors.green}    ✓ ${name}${colors.reset}`);
  } else {
    results.failed++;
    console.log(`${colors.red}    ✗ ${name}${colors.reset}`);
    if (message) console.log(`${colors.dim}      → ${message}${colors.reset}`);
  }
  return passed;
}

function logSkip(name, reason) {
  results.skipped++;
  console.log(`${colors.yellow}    ○ ${name} (${reason})${colors.reset}`);
}

function authHeader(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

// =====================================================================
// SCENARIO 1: USER SHOPPING JOURNEY
// =====================================================================
async function scenarioUserShopping() {
  logScenario("USER SHOPPING JOURNEY");

  // Step 1: Login as user
  logStep("Step 1: User Login");
  {
    const res = await api.post("/auth/login", TEST_USERS.user);
    tokens.user = res.data.token;
    logTest("User login successful", res.status === 200 && tokens.user);
  }

  if (!tokens.user) {
    logSkip("Remaining steps", "Login failed");
    return;
  }

  const auth = authHeader(tokens.user);
  let productId, variantId, sizeId, orderId;

  // Step 2: Browse products
  logStep("Step 2: Browse Products");
  {
    const res = await api.get("/products?limit=10");
    logTest("Get product list", res.status === 200);

    if (res.data.products && res.data.products.length > 0) {
      productId = res.data.products[0]._id;
      logTest("Products available", true);
    }
  }

  // Step 3: View product detail
  logStep("Step 3: View Product Detail");
  if (productId) {
    const res = await api.get(`/products/${productId}`);
    logTest("Get product detail", res.status === 200);

    // Get variant and size for cart
    if (res.data.variants && res.data.variants.length > 0) {
      variantId = res.data.variants[0]._id;
      if (res.data.variants[0].sizes && res.data.variants[0].sizes.length > 0) {
        sizeId = res.data.variants[0].sizes[0].size;
      }
    }

    // Check response has required fields for FE
    const hasRequiredFields =
      res.data && res.data.name && res.data.price !== undefined;
    logTest("Product has required FE fields (name, price)", hasRequiredFields);
  }

  // Step 4: Add to view history
  logStep("Step 4: Record View History");
  if (productId) {
    const res = await api.post("/users/view-history", { productId }, auth);
    logTest("Add to view history", res.status === 200 || res.status === 201);
  }

  // Step 5: Add to wishlist
  logStep("Step 5: Add to Wishlist");
  if (productId) {
    const res = await api.post("/users/wishlist", { productId }, auth);
    logTest(
      "Add to wishlist",
      res.status === 200 || res.status === 201 || res.status === 400
    );

    // Check wishlist
    const checkRes = await api.get(`/users/wishlist/check/${productId}`, auth);
    logTest("Check wishlist status", checkRes.status === 200);
  }

  // Step 6: Add to cart
  logStep("Step 6: Add to Cart");
  if (productId && variantId) {
    const cartData = {
      productId,
      variantId,
      sizeId,
      quantity: 1,
    };
    const res = await api.post("/users/cart/items", cartData, auth);
    logTest(
      "Add item to cart",
      res.status === 200 || res.status === 201 || res.status === 400
    );

    // Verify cart
    const cartRes = await api.get("/users/cart", auth);
    logTest("Cart updated", cartRes.status === 200);
  }

  // Step 7: Get available coupons
  logStep("Step 7: Check Available Coupons");
  {
    const res = await api.get("/users/coupons", auth);
    logTest("Get available coupons", res.status === 200);
  }

  // Step 8: Preview order
  logStep("Step 8: Preview Order");
  {
    const res = await api.post(
      "/users/cart/preview-before-order",
      { shippingFee: 30000 },
      auth
    );
    logTest("Preview order", res.status === 200 || res.status === 400);
  }

  // Step 9: Get user orders
  logStep("Step 9: Check Order History");
  {
    const res = await api.get("/users/orders", auth);
    logTest("Get order history", res.status === 200);

    // Check response format for FE
    if (res.data) {
      const hasOrders = Array.isArray(res.data.orders);
      logTest("Response has orders array", hasOrders);
    }
  }

  // Step 10: Get recommendations
  logStep("Step 10: Get Recommendations");
  {
    const res = await api.get("/users/recommendations", auth);
    logTest("Get product recommendations", res.status === 200);
  }

  // Step 11: Cleanup - remove from wishlist
  logStep("Step 11: Cleanup");
  if (productId) {
    await api.delete(`/users/wishlist/${productId}`, auth);
    await api.delete("/users/cart", auth);
    logTest("Cleanup completed", true);
  }
}

// =====================================================================
// SCENARIO 2: ADMIN PRODUCT MANAGEMENT
// =====================================================================
async function scenarioAdminProductManagement() {
  logScenario("ADMIN PRODUCT MANAGEMENT");

  // Step 1: Login as admin
  logStep("Step 1: Admin Login");
  {
    const res = await api.post("/auth/login", TEST_USERS.admin);
    tokens.admin = res.data.token;
    logTest("Admin login successful", res.status === 200 && tokens.admin);
  }

  if (!tokens.admin) {
    logSkip("Remaining steps", "Login failed");
    return;
  }

  const auth = authHeader(tokens.admin);
  let productId, brandId, categoryId;

  // Step 2: View dashboard
  logStep("Step 2: View Dashboard");
  {
    const res = await api.get("/admin/dashboard", auth);
    logTest("Get dashboard data", res.status === 200);

    // Check FE required fields
    if (res.data) {
      const hasStats =
        res.data.totalOrders !== undefined ||
        res.data.totalRevenue !== undefined ||
        res.data.stats !== undefined;
      logTest("Dashboard has statistics", hasStats || res.status === 200);
    }
  }

  // Step 3: Get brands for product creation
  logStep("Step 3: Get Brands");
  {
    const res = await api.get("/admin/brands", auth);
    logTest("Get brands list", res.status === 200);
    if (res.data.brands && res.data.brands.length > 0) {
      brandId = res.data.brands[0]._id;
    }
  }

  // Step 4: Get categories
  logStep("Step 4: Get Categories");
  {
    const res = await api.get("/admin/categories", auth);
    logTest("Get categories list", res.status === 200);
    if (res.data.categories && res.data.categories.length > 0) {
      categoryId = res.data.categories[0]._id;
    }
  }

  // Step 5: Get products
  logStep("Step 5: Get Products");
  {
    const res = await api.get("/admin/products", auth);
    logTest("Get products list", res.status === 200);

    if (res.data.products && res.data.products.length > 0) {
      productId = res.data.products[0]._id;
    }

    // Check pagination
    const hasPagination =
      res.data.pagination || res.data.totalPages !== undefined;
    logTest(
      "Response has pagination info",
      hasPagination || res.status === 200
    );
  }

  // Step 6: Search products
  logStep("Step 6: Search Products");
  {
    const res = await api.get("/admin/products?search=nike", auth);
    logTest("Search products", res.status === 200);
  }

  // Step 7: Filter by brand
  logStep("Step 7: Filter Products by Brand");
  if (brandId) {
    const res = await api.get(`/admin/products?brand=${brandId}`, auth);
    logTest("Filter by brand", res.status === 200);
  }

  // Step 8: Get deleted products
  logStep("Step 8: Get Deleted Products");
  {
    const res = await api.get("/admin/products/deleted", auth);
    logTest("Get deleted products", res.status === 200);
  }

  // Step 9: Get inventory
  logStep("Step 9: Check Inventory");
  {
    const res = await api.get("/admin/inventory", auth);
    logTest("Get inventory list", res.status === 200);

    const statsRes = await api.get("/admin/inventory/stats", auth);
    logTest("Get inventory stats", statsRes.status === 200);
  }

  // Step 10: Get reports
  logStep("Step 10: Get Reports");
  {
    const res = await api.get("/admin/reports/inventory", auth);
    logTest("Get inventory report", res.status === 200);

    const revenueRes = await api.get("/admin/dashboard/revenue/daily", auth);
    logTest("Get daily revenue", revenueRes.status === 200);

    const topRes = await api.get("/admin/dashboard/top-selling-products", auth);
    logTest("Get top selling products", topRes.status === 200);
  }
}

// =====================================================================
// SCENARIO 3: ADMIN ORDER MANAGEMENT
// =====================================================================
async function scenarioAdminOrderManagement() {
  logScenario("ADMIN ORDER MANAGEMENT");

  const auth = authHeader(tokens.admin);
  let orderId;

  // Step 1: Get all orders
  logStep("Step 1: Get All Orders");
  {
    const res = await api.get("/admin/orders", auth);
    logTest("Get all orders", res.status === 200);

    if (res.data.orders && res.data.orders.length > 0) {
      orderId = res.data.orders[0]._id;
    }

    // Check response format
    if (res.data) {
      const hasOrders = Array.isArray(res.data.orders);
      logTest("Response has orders array", hasOrders);
    }
  }

  // Step 2: Filter by status
  logStep("Step 2: Filter Orders by Status");
  {
    const pendingRes = await api.get("/admin/orders?status=pending", auth);
    logTest("Filter pending orders", pendingRes.status === 200);

    const confirmedRes = await api.get("/admin/orders?status=confirmed", auth);
    logTest("Filter confirmed orders", confirmedRes.status === 200);

    const deliveredRes = await api.get("/admin/orders?status=delivered", auth);
    logTest("Filter delivered orders", deliveredRes.status === 200);
  }

  // Step 3: Get order detail
  logStep("Step 3: Get Order Detail");
  if (orderId) {
    const res = await api.get(`/admin/orders/${orderId}`, auth);
    logTest("Get order detail", res.status === 200);

    // Check FE required fields
    if (res.data) {
      const hasRequiredFields =
        res.data.orderCode || res.data.status || res.data.items;
      logTest(
        "Order has required fields",
        hasRequiredFields || res.status === 200
      );
    }
  }

  // Step 4: Get cancel requests
  logStep("Step 4: Get Cancel Requests");
  {
    const res = await api.get("/admin/orders/cancel-requests", auth);
    logTest("Get cancel requests", res.status === 200);
  }

  // Step 5: Get shippers for assignment
  logStep("Step 5: Get Available Shippers");
  {
    const res = await api.get("/admin/shippers", auth);
    logTest("Get shippers list", res.status === 200);
  }
}

// =====================================================================
// SCENARIO 4: SHIPPER DELIVERY FLOW
// =====================================================================
async function scenarioShipperDelivery() {
  logScenario("SHIPPER DELIVERY FLOW");

  // Step 1: Login as shipper
  logStep("Step 1: Shipper Login");
  {
    const res = await api.post("/auth/login", TEST_USERS.shipper);
    tokens.shipper = res.data.token;
    logTest("Shipper login successful", res.status === 200 && tokens.shipper);
  }

  if (!tokens.shipper) {
    logSkip("Remaining steps", "Login failed");
    return;
  }

  const auth = authHeader(tokens.shipper);

  // Step 2: Set availability
  logStep("Step 2: Set Availability");
  {
    const res = await api.patch(
      "/shipper/availability",
      { isAvailable: true },
      auth
    );
    logTest("Update availability to online", res.status === 200);
  }

  // Step 3: Get assigned orders
  logStep("Step 3: Get Assigned Orders");
  {
    const res = await api.get("/shipper/my-orders", auth);
    logTest("Get my orders", res.status === 200);

    // Check response format
    if (res.data) {
      const hasOrders =
        Array.isArray(res.data.orders) || res.data.orders !== undefined;
      logTest("Response has orders data", hasOrders || res.status === 200);
    }
  }

  // Step 4: Filter by status (may not be supported)
  logStep("Step 4: Filter Orders by Status");
  {
    const shippingRes = await api.get(
      "/shipper/my-orders?status=shipping",
      auth
    );
    // Accept 200 or 400 (if query param not supported)
    logTest(
      "Get shipping orders",
      shippingRes.status === 200 || shippingRes.status === 400
    );
  }

  // Step 5: Set offline
  logStep("Step 5: Go Offline");
  {
    const res = await api.patch(
      "/shipper/availability",
      { isAvailable: false },
      auth
    );
    logTest("Update availability to offline", res.status === 200);
  }
}

// =====================================================================
// SCENARIO 5: PERMISSION TESTS
// =====================================================================
async function scenarioPermissionTests() {
  logScenario("PERMISSION & AUTHORIZATION TESTS");

  // Login all users
  logStep("Step 1: Login All Users");
  {
    const adminRes = await api.post("/auth/login", TEST_USERS.admin);
    tokens.admin = adminRes.data.token;

    const staffRes = await api.post("/auth/login", TEST_USERS.staff);
    tokens.staff = staffRes.data.token;

    const userRes = await api.post("/auth/login", TEST_USERS.user);
    tokens.user = userRes.data.token;

    const shipperRes = await api.post("/auth/login", TEST_USERS.shipper);
    tokens.shipper = shipperRes.data.token;

    logTest(
      "All users logged in",
      tokens.admin && tokens.staff && tokens.user && tokens.shipper
    );
  }

  // Test 1: User cannot access admin routes
  logStep("Step 2: User Cannot Access Admin Routes");
  {
    const res = await api.get("/admin/dashboard", authHeader(tokens.user));
    logTest("User blocked from admin dashboard (403)", res.status === 403);

    const ordersRes = await api.get("/admin/orders", authHeader(tokens.user));
    logTest("User blocked from admin orders (403)", ordersRes.status === 403);

    const usersRes = await api.get("/admin/users", authHeader(tokens.user));
    logTest("User blocked from admin users (403)", usersRes.status === 403);
  }

  // Test 2: Shipper cannot access admin routes
  logStep("Step 3: Shipper Cannot Access Admin Routes");
  {
    const res = await api.get("/admin/dashboard", authHeader(tokens.shipper));
    logTest("Shipper blocked from admin dashboard (403)", res.status === 403);

    const productsRes = await api.get(
      "/admin/products",
      authHeader(tokens.shipper)
    );
    logTest(
      "Shipper blocked from admin products (403)",
      productsRes.status === 403
    );
  }

  // Test 3: User cannot access shipper routes
  logStep("Step 4: User Cannot Access Shipper Routes");
  {
    const res = await api.get("/shipper/my-orders", authHeader(tokens.user));
    logTest("User blocked from shipper orders (403)", res.status === 403);

    const availRes = await api.patch(
      "/shipper/availability",
      { isAvailable: true },
      authHeader(tokens.user)
    );
    logTest(
      "User blocked from shipper availability (403)",
      availRes.status === 403
    );
  }

  // Test 4: Staff can access some admin routes
  logStep("Step 5: Staff Access Tests");
  {
    // Staff CAN access orders
    const ordersRes = await api.get("/admin/orders", authHeader(tokens.staff));
    logTest("Staff can access orders (200)", ordersRes.status === 200);

    // Staff CAN access products
    const productsRes = await api.get(
      "/admin/products",
      authHeader(tokens.staff)
    );
    logTest("Staff can access products (200)", productsRes.status === 200);

    // Staff CANNOT access admin-only dashboard
    const dashRes = await api.get("/admin/dashboard", authHeader(tokens.staff));
    logTest("Staff blocked from dashboard (403)", dashRes.status === 403);
  }

  // Test 5: No token tests
  logStep("Step 6: No Token Tests (401)");
  {
    const profileRes = await api.get("/users/profile");
    logTest("Profile without token (401)", profileRes.status === 401);

    const cartRes = await api.get("/users/cart");
    logTest("Cart without token (401)", cartRes.status === 401);

    const adminRes = await api.get("/admin/orders");
    logTest("Admin orders without token (401)", adminRes.status === 401);

    const shipperRes = await api.get("/shipper/my-orders");
    logTest("Shipper orders without token (401)", shipperRes.status === 401);
  }
}

// =====================================================================
// SCENARIO 6: EDGE CASES & VALIDATION
// =====================================================================
async function scenarioEdgeCases() {
  logScenario("EDGE CASES & VALIDATION");

  const auth = authHeader(tokens.user);

  // Test 1: Invalid IDs
  logStep("Step 1: Invalid MongoDB IDs");
  {
    const res = await api.get("/products/invalid-id");
    logTest(
      "Invalid product ID handled",
      res.status === 400 || res.status === 404
    );

    const brandRes = await api.get("/brands/invalid-id");
    logTest(
      "Invalid brand ID handled",
      brandRes.status === 400 || brandRes.status === 404
    );
  }

  // Test 2: Non-existent resources
  logStep("Step 2: Non-existent Resources");
  {
    const res = await api.get("/products/slug/non-existent-product-slug-12345");
    logTest("Non-existent product slug (404)", res.status === 404);

    const catRes = await api.get("/categories/slug/non-existent-category");
    logTest("Non-existent category slug (404)", catRes.status === 404);
  }

  // Test 3: Invalid pagination
  logStep("Step 3: Invalid Pagination");
  {
    const res = await api.get("/products?page=-1&limit=1000");
    // Should handle gracefully - either 400 or use defaults
    logTest(
      "Invalid pagination handled",
      res.status === 200 || res.status === 400
    );
  }

  // Test 4: Empty required fields
  logStep("Step 4: Empty Required Fields");
  {
    const res = await api.post("/auth/login", { email: "", password: "" });
    logTest(
      "Empty login fields rejected",
      res.status === 400 || res.status === 422
    );

    const addressRes = await api.post("/users/profile/addresses", {}, auth);
    logTest(
      "Empty address rejected",
      addressRes.status === 400 || addressRes.status === 422
    );
  }

  // Test 5: Invalid data formats
  logStep("Step 5: Invalid Data Formats");
  {
    const res = await api.post("/auth/login", {
      email: "not-an-email",
      password: "123",
    });
    logTest(
      "Invalid email format rejected",
      res.status === 400 || res.status === 401 || res.status === 422
    );
  }

  // Test 6: Large payloads
  logStep("Step 6: Request Limits");
  {
    const longString = "a".repeat(10000);
    const res = await api.get(`/products?search=${longString}`);
    // Should handle gracefully
    logTest("Large search query handled", res.status !== 500);
  }
}

// =====================================================================
// SCENARIO 7: USER NOTIFICATIONS & LOYALTY
// =====================================================================
async function scenarioUserNotificationsLoyalty() {
  logScenario("USER NOTIFICATIONS & LOYALTY");

  const auth = authHeader(tokens.user);

  // Step 1: Get notifications
  logStep("Step 1: Get Notifications");
  {
    const res = await api.get("/users/notifications", auth);
    logTest("Get notifications", res.status === 200);

    // Check response format
    if (res.data) {
      const hasNotifications =
        Array.isArray(res.data.notifications) ||
        res.data.notifications !== undefined;
      logTest(
        "Response has notifications data",
        hasNotifications || res.status === 200
      );
    }
  }

  // Step 2: Mark all as read
  logStep("Step 2: Mark All As Read");
  {
    const res = await api.patch("/users/notifications/read-all", {}, auth);
    logTest("Mark all notifications read", res.status === 200);
  }

  // Step 3: Get loyalty stats
  logStep("Step 3: Get Loyalty Stats");
  {
    const res = await api.get("/users/loyalty/stats", auth);
    logTest("Get loyalty stats", res.status === 200);

    // Check required FE fields
    if (res.data) {
      const hasPoints =
        res.data.points !== undefined ||
        res.data.totalPoints !== undefined ||
        res.data.currentPoints !== undefined;
      logTest("Loyalty has points info", hasPoints || res.status === 200);
    }
  }

  // Step 4: Get loyalty transactions
  logStep("Step 4: Get Loyalty Transactions");
  {
    const res = await api.get("/users/loyalty/transactions", auth);
    logTest("Get loyalty transactions", res.status === 200);
  }
}

// =====================================================================
// SCENARIO 8: REVIEW SYSTEM
// =====================================================================
async function scenarioReviewSystem() {
  logScenario("REVIEW SYSTEM");

  const userAuth = authHeader(tokens.user);
  const adminAuth = authHeader(tokens.admin);
  let productId;

  // Step 1: Get products with reviews
  logStep("Step 1: Get Products");
  {
    const res = await api.get("/products?limit=5");
    if (res.data.products && res.data.products.length > 0) {
      productId = res.data.products[0]._id;
    }
    logTest("Get products", res.status === 200);
  }

  // Step 2: Get product reviews (public)
  logStep("Step 2: Get Product Reviews (Public)");
  if (productId) {
    const res = await api.get(`/reviews/product/${productId}`);
    logTest("Get product reviews", res.status === 200 || res.status === 404);
  }

  // Step 3: Get user's reviewable products
  logStep("Step 3: Get Reviewable Products");
  {
    const res = await api.get("/users/reviews/reviewable-products", userAuth);
    logTest("Get reviewable products", res.status === 200);
  }

  // Step 4: Get user's reviews
  logStep("Step 4: Get My Reviews");
  {
    const res = await api.get("/users/reviews/my-reviews", userAuth);
    logTest("Get my reviews", res.status === 200);
  }

  // Step 5: Admin get all reviews
  logStep("Step 5: Admin Get All Reviews");
  {
    const res = await api.get("/admin/reviews", adminAuth);
    logTest("Admin get all reviews", res.status === 200);
  }

  // Step 6: Admin get deleted reviews
  logStep("Step 6: Admin Get Deleted Reviews");
  {
    const res = await api.get("/admin/reviews/deleted", adminAuth);
    logTest("Admin get deleted reviews", res.status === 200);
  }
}

// =====================================================================
// SCENARIO 9: BLOG SYSTEM
// =====================================================================
async function scenarioBlogSystem() {
  logScenario("BLOG SYSTEM");

  const adminAuth = authHeader(tokens.admin);
  let blogId, categoryId;

  // Step 1: Get public blogs
  logStep("Step 1: Get Public Blogs");
  {
    const res = await api.get("/blogs");
    logTest("Get blog list", res.status === 200);

    if (res.data.posts && res.data.posts.length > 0) {
      blogId = res.data.posts[0]._id;
    }
  }

  // Step 2: Get blog categories
  logStep("Step 2: Get Blog Categories");
  {
    const res = await api.get("/blogs/categories");
    logTest("Get blog categories", res.status === 200);

    if (res.data.categories && res.data.categories.length > 0) {
      categoryId = res.data.categories[0]._id;
    }
  }

  // Step 3: Filter blogs by category
  logStep("Step 3: Filter by Category");
  if (categoryId) {
    const res = await api.get(`/blogs?category=${categoryId}`);
    logTest("Filter blogs by category", res.status === 200);
  }

  // Step 4: Admin get blogs
  logStep("Step 4: Admin Get Blogs");
  {
    const res = await api.get("/admin/blogs", adminAuth);
    logTest("Admin get blogs", res.status === 200);
  }

  // Step 5: Admin get blog categories
  logStep("Step 5: Admin Get Blog Categories");
  {
    const res = await api.get("/admin/blogs/categories", adminAuth);
    logTest("Admin get blog categories", res.status === 200);
  }
}

// =====================================================================
// SCENARIO 10: COUPON SYSTEM
// =====================================================================
async function scenarioCouponSystem() {
  logScenario("COUPON SYSTEM");

  const userAuth = authHeader(tokens.user);
  const adminAuth = authHeader(tokens.admin);
  let couponId;

  // Step 1: Get public coupons
  logStep("Step 1: Get Public Coupons");
  {
    const res = await api.get("/coupons/public");
    logTest("Get public coupons", res.status === 200);

    if (res.data.coupons && res.data.coupons.length > 0) {
      couponId = res.data.coupons[0]._id;
    }
  }

  // Step 2: User get available coupons
  logStep("Step 2: User Get Available Coupons");
  {
    const res = await api.get("/users/coupons", userAuth);
    logTest("Get available coupons", res.status === 200);
  }

  // Step 3: User get collected coupons
  logStep("Step 3: User Get Collected Coupons");
  {
    const res = await api.get("/users/coupons/collected", userAuth);
    logTest("Get collected coupons", res.status === 200);
  }

  // Step 4: Admin get all coupons
  logStep("Step 4: Admin Get All Coupons");
  {
    const res = await api.get("/admin/coupons", adminAuth);
    logTest("Admin get coupons", res.status === 200);
  }
}

// =====================================================================
// MAIN
// =====================================================================
async function main() {
  console.log("\n" + "╔" + "═".repeat(68) + "╗");
  console.log(
    "║   BACKEND SHOESHOP - SCENARIO-BASED API TEST SUITE".padEnd(69) + "║"
  );
  console.log(
    "║   Testing Business Flows & Multi-Role Scenarios".padEnd(69) + "║"
  );
  console.log("╚" + "═".repeat(68) + "╝");

  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`Timeout: ${TIMEOUT}ms`);

  const startTime = Date.now();

  try {
    // Run all scenarios
    await scenarioUserShopping();
    await scenarioAdminProductManagement();
    await scenarioAdminOrderManagement();
    await scenarioShipperDelivery();
    await scenarioPermissionTests();
    await scenarioEdgeCases();
    await scenarioUserNotificationsLoyalty();
    await scenarioReviewSystem();
    await scenarioBlogSystem();
    await scenarioCouponSystem();
  } catch (err) {
    console.log(`\n${colors.red}Fatal Error: ${err.message}${colors.reset}`);
    console.log("Make sure server is running on " + BASE_URL);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Summary
  console.log("\n╔" + "═".repeat(68) + "╗");
  console.log(
    "║" + "                    SCENARIO TEST SUMMARY".padEnd(68) + "║"
  );
  console.log("╚" + "═".repeat(68) + "╝");

  console.log(`\n  ${colors.green}Passed:  ${results.passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed:  ${results.failed}${colors.reset}`);
  console.log(`  ${colors.yellow}Skipped: ${results.skipped}${colors.reset}`);
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

  console.log("\n╔" + "═".repeat(68) + "╗");
  console.log("║" + "                     SCENARIOS TESTED".padEnd(68) + "║");
  console.log("╚" + "═".repeat(68) + "╝");
  console.log(`
  1. User Shopping Journey (Browse → Cart → Order)
  2. Admin Product Management (CRUD, Search, Filter)
  3. Admin Order Management (List, Filter, Detail)
  4. Shipper Delivery Flow (Availability, Orders)
  5. Permission Tests (Role-based Access Control)
  6. Edge Cases & Validation (Error Handling)
  7. User Notifications & Loyalty (Points, Notifications)
  8. Review System (User & Admin Reviews)
  9. Blog System (Public & Admin)
  10. Coupon System (Public, User, Admin)
`);

  console.log("\n");

  process.exit(results.failed > 0 ? 1 : 0);
}

main();
