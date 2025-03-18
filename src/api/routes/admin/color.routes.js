const express = require("express");

const {
  getAllColors,
  getColorDetails,
  createColor,
  updateColor,
  deleteColor,
  checkDeletableColor,
} = require("../controllers/color.controller");
const { protect, admin } = require("../../middlewares/auth.middleware");

const router = express.Router();

// Route công khai
router.get("/", getAllColors);
router.get("/:colorId", getColorDetails);

// Route yêu cầu xác thực
router.use(protect);

// Route cho Admin - yêu cầu quyền Admin
router.use(admin);
router.post("/", createColor);
router.put("/:colorId", updateColor);
router.delete("/:colorId", deleteColor);
router.get("/check-delete/:colorId", checkDeletableColor);

module.exports = router;
