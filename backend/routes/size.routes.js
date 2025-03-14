const express = require("express");
const { protect, admin } = require("../middlewares/auth.middleware");
const {
  getAllSizes,
  createSize,
  updateSize,
  deleteSize,
  checkDeletableSize,
  getSizeDetails,
} = require("../controllers/size.controller");

const router = express.Router();

// Route công khai
router.get("/", getAllSizes);
router.get("/:sizeId", getSizeDetails);

// Route cho Admin - yêu cầu đăng nhập và quyền Admin
router.use(protect);
router.use(admin);

router.post("/", createSize);
router.put("/:sizeId", updateSize);
router.delete("/:sizeId", deleteSize);
router.get("/check-delete/:sizeId", checkDeletableSize);
module.exports = router;
