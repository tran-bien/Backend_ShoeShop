const express = require("express");
const { protect, admin } = require("../middlewares/auth.middleware");
const {
  getAllColors,
  createColor,
  updateColor,
  deleteColor,
  checkDeletableColor,
} = require("../controllers/color.controller");

const router = express.Router();

// Route công khai
router.get("/", getAllColors);

// Route cho Admin - yêu cầu đăng nhập và quyền Admin
router.use(protect);
router.use(admin);

router.post("/", createColor);
router.put("/:colorId", updateColor);
router.delete("/:colorId", deleteColor);
router.get("/check-delete/:colorId", checkDeletableColor);

module.exports = router;
