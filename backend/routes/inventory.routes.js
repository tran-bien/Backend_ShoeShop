const express = require("express");
const { protect, admin } = require("../middlewares/auth.middleware");
const {
  getInventory,
  getInventoryItem,
  getInventoryStats,
  updateInventoryItem,
  bulkUpdateInventory,
} = require("../controllers/inventory.controller");

const router = express.Router();

// Tất cả routes yêu cầu quyền admin
router.use(protect);
router.use(admin);

// Routes quản lý tồn kho
router.get("/", getInventory);
router.get("/stats", getInventoryStats);
router.get("/:id/:colorId/:sizeId", getInventoryItem);
router.put("/bulk-update", bulkUpdateInventory);
router.put("/:id/:colorId/:sizeId", updateInventoryItem);

module.exports = router;
