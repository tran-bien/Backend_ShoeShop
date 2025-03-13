const express = require("express");
const { protect, admin } = require("../middlewares/auth.middleware");
const {
  getSizes,
  createSize,
  updateSize,
  deleteSize,
} = require("../controllers/size.controller");

const router = express.Router();

// Route công khai
router.get("/", getSizes);

// Route cho Admin - yêu cầu đăng nhập và quyền Admin
router.use(protect);
router.use(admin);

router.post("/", createSize);
router.put("/:sizeId", updateSize);
router.delete("/:sizeId", deleteSize);

module.exports = router;
