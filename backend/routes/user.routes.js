const express = require("express");
const { protect, admin } = require("../middlewares/auth.middleware");
const {
  uploadSingle,
  handleUploadError,
} = require("../middlewares/upload.middleware");
const {
  getProfile,
  updateProfile,
  updateAvatar,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  getUserCoupons,
  blockUser,
  unblockUser,
} = require("../controllers/user.controller");

const router = express.Router();

// Tất cả các route đều yêu cầu xác thực
router.use(protect);

// Quản lý thông tin cá nhân
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put("/avatar", uploadSingle, handleUploadError, updateAvatar);

// Quản lý địa chỉ
router.post("/address", addAddress);
router.put("/address/:addressId", updateAddress);
router.delete("/address/:addressId", deleteAddress);
router.put("/address/:addressId/default", setDefaultAddress);

// Quản lý danh sách yêu thích
router.get("/wishlist", getWishlist);
router.post("/wishlist", addToWishlist);
router.delete("/wishlist/:productId", removeFromWishlist);

// Quản lý mã giảm giá
router.get("/coupons", getUserCoupons);

// Thêm các route mới
router.put("/block/:userId", protect, admin, blockUser);
router.put("/unblock/:userId", protect, admin, unblockUser);

module.exports = router;
