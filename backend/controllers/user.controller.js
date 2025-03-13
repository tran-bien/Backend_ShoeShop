const asyncHandler = require("express-async-handler");
const userService = require("../services/user.service");
const mongoose = require("mongoose");
const { isValidPhoneNumber } = require("../utils/validators");

// Nếu có dịch vụ notification riêng
// const { createNotification } = require("../services/notification.service");

// Lấy thông tin cá nhân
exports.getProfile = asyncHandler(async (req, res) => {
  try {
    const user = await userService.getUserProfile(req.user._id);

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy thông tin người dùng",
    });
  }
});

// Cập nhật thông tin cá nhân
exports.updateProfile = asyncHandler(async (req, res) => {
  try {
    const { name, phone, gender, dateOfBirth } = req.body;

    // Kiểm tra điều kiện đầu vào
    const errors = {};

    // Kiểm tra tên
    if (name !== undefined) {
      if (name.trim() === "") {
        errors.name = ["Tên không được để trống"];
      } else if (name.length > 50) {
        errors.name = ["Tên không được vượt quá 50 ký tự"];
      }
    }

    // Kiểm tra số điện thoại
    if (phone !== undefined) {
      if (phone !== "" && !isValidPhoneNumber(phone)) {
        errors.phone = ["Số điện thoại không hợp lệ"];
      }
    }

    // Kiểm tra giới tính
    if (gender !== undefined) {
      const allowedGenders = ["male", "female", "other"];
      if (gender !== "" && !allowedGenders.includes(gender)) {
        errors.gender = ["Giới tính không hợp lệ"];
      }
    }

    // Kiểm tra ngày sinh
    if (dateOfBirth !== undefined) {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();

      if (isNaN(birthDate.getTime())) {
        // Kiểm tra nếu là ngày hợp lệ
        errors.dateOfBirth = ["Ngày sinh không hợp lệ"];
      } else if (birthDate > today) {
        errors.dateOfBirth = [
          "Ngày sinh không hợp lệ không được lớn hơn ngày hiện tại",
        ];
      }
    }

    // Nếu có lỗi, trả về thông báo lỗi
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Thông tin không hợp lệ",
        errors,
      });
    }

    // Sử dụng userService để cập nhật thông tin
    const updatedUser = await userService.updateUserProfile(req.user._id, {
      name,
      phone,
      gender,
      birthday: dateOfBirth,
    });

    res.json({
      success: true,
      message: "Đã cập nhật thông tin cá nhân",
      data: updatedUser,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật thông tin cá nhân",
    });
  }
});

// Cập nhật ảnh đại diện
exports.updateAvatar = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng tải lên ảnh đại diện",
      });
    }

    // Sử dụng userService để cập nhật avatar
    const result = await userService.updateAvatar(req.user._id, req.file);

    res.json({
      success: true,
      message: "Đã cập nhật ảnh đại diện",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error.message || "Không thể tải lên ảnh đại diện. Vui lòng thử lại!",
    });
  }
});

// Thêm địa chỉ mới
exports.addAddress = asyncHandler(async (req, res) => {
  try {
    const {
      fullName,
      phone,
      province,
      district,
      ward,
      addressDetail,
      isDefault,
    } = req.body;

    // Kiểm tra các trường bắt buộc
    if (
      !fullName ||
      !phone ||
      !province ||
      !district ||
      !ward ||
      !addressDetail
    ) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp đầy đủ thông tin địa chỉ",
      });
    }

    // Kiểm tra định dạng số điện thoại
    if (!isValidPhoneNumber(phone)) {
      return res.status(400).json({
        success: false,
        message: "Số điện thoại không hợp lệ",
      });
    }

    // Sử dụng userService để thêm địa chỉ mới
    const result = await userService.addUserAddress(req.user._id, {
      fullName,
      phone,
      province,
      district,
      ward,
      street: addressDetail,
      isDefault: isDefault || false,
    });

    res.json({
      success: true,
      message: "Đã thêm địa chỉ mới",
      addresses: result.addresses,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi thêm địa chỉ mới",
    });
  }
});

// Cập nhật địa chỉ
exports.updateAddress = asyncHandler(async (req, res) => {
  try {
    const { addressId } = req.params;
    const {
      fullName,
      phone,
      province,
      district,
      ward,
      addressDetail,
      isDefault,
    } = req.body;

    // Kiểm tra địa chỉ ID
    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp ID địa chỉ",
      });
    }

    // Kiểm tra định dạng số điện thoại nếu có
    if (phone && !isValidPhoneNumber(phone)) {
      return res.status(400).json({
        success: false,
        message: "Số điện thoại không hợp lệ",
      });
    }

    // Sử dụng userService để cập nhật địa chỉ
    const result = await userService.updateUserAddress(
      req.user._id,
      addressId,
      {
        fullName,
        phone,
        province,
        district,
        ward,
        street: addressDetail,
        isDefault,
      }
    );

    // Lấy danh sách địa chỉ đã cập nhật
    const user = await userService.getUserProfile(req.user._id);

    res.json({
      success: true,
      message: "Đã cập nhật địa chỉ",
      addresses: user.addresses,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật địa chỉ",
    });
  }
});

// Xóa địa chỉ
exports.deleteAddress = asyncHandler(async (req, res) => {
  try {
    const { addressId } = req.params;

    // Sử dụng userService để xóa địa chỉ
    await userService.deleteUserAddress(req.user._id, addressId);

    // Lấy danh sách địa chỉ đã cập nhật
    const user = await userService.getUserProfile(req.user._id);

    res.json({
      success: true,
      message: "Đã xóa địa chỉ",
      addresses: user.addresses,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi xóa địa chỉ",
    });
  }
});

/**
 * @desc    Đặt địa chỉ mặc định
 * @route   PUT /api/users/address/:addressId/default
 * @access  Private
 */
exports.setDefaultAddress = asyncHandler(async (req, res) => {
  try {
    const { addressId } = req.params;

    // Sử dụng userService để đặt địa chỉ mặc định
    await userService.setDefaultAddress(req.user._id, addressId);

    // Lấy thông tin người dùng đã cập nhật
    const user = await userService.getUserProfile(req.user._id);

    res.status(200).json({
      success: true,
      message: "Đã đặt địa chỉ mặc định thành công",
      addresses: user.addresses,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi đặt địa chỉ mặc định",
    });
  }
});

// Thêm sản phẩm vào danh sách yêu thích
exports.addToWishlist = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.body;

    // Sử dụng userService để thêm sản phẩm vào danh sách yêu thích
    const wishlist = await userService.addToWishlist(req.user._id, productId);

    res.json({
      success: true,
      message: "Đã thêm vào danh sách yêu thích",
      wishlist,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi thêm vào danh sách yêu thích",
    });
  }
});

// Xóa sản phẩm khỏi danh sách yêu thích
exports.removeFromWishlist = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;

    // Sử dụng userService để xóa sản phẩm khỏi danh sách yêu thích
    const wishlist = await userService.removeFromWishlist(
      req.user._id,
      productId
    );

    res.json({
      success: true,
      message: "Đã xóa khỏi danh sách yêu thích",
      wishlist,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi xóa khỏi danh sách yêu thích",
    });
  }
});

/**
 * @desc    Lấy danh sách sản phẩm yêu thích của người dùng
 * @route   GET /api/users/wishlist
 * @access  Private
 */
exports.getWishlist = asyncHandler(async (req, res) => {
  try {
    // Sử dụng userService để lấy danh sách sản phẩm yêu thích
    const wishlist = await userService.getWishlist(req.user._id);

    res.status(200).json({
      success: true,
      count: wishlist.length,
      data: wishlist,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi lấy danh sách yêu thích",
    });
  }
});

// Lấy danh sách mã giảm giá của người dùng
exports.getUserCoupons = asyncHandler(async (req, res) => {
  try {
    // Sử dụng userService để lấy danh sách mã giảm giá
    const coupons = await userService.getUserCoupons(req.user._id);

    res.status(200).json({
      success: true,
      count: coupons.length,
      coupons,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi lấy danh sách mã giảm giá",
    });
  }
});

// Khóa tài khoản người dùng - Chỉ Admin
exports.blockUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    // Kiểm tra quyền admin (mặc dù middleware admin đã kiểm tra)
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thực hiện hành động này",
      });
    }

    // Sử dụng userService để khóa tài khoản
    const user = await userService.blockUser(userId, reason);

    // Đăng xuất người dùng khỏi tất cả các thiết bị nếu có model Session
    try {
      // Kiểm tra xem model Session có tồn tại không trước khi sử dụng
      if (
        mongoose &&
        mongoose.modelNames &&
        mongoose.modelNames().includes("Session")
      ) {
        const Session = mongoose.model("Session");
        await Session.deleteMany({ userId: user._id });
      }
    } catch (sessionError) {
      console.error("Lỗi khi đăng xuất người dùng:", sessionError);
      // Không cần throw lỗi, chỉ log và tiếp tục
    }

    // Gửi thông báo đến người dùng
    try {
      if (
        mongoose &&
        mongoose.modelNames &&
        mongoose.modelNames().includes("Notification")
      ) {
        const Notification = mongoose.model("Notification");
        await Notification.create({
          userId: user._id,
          title: "Tài khoản bị khóa",
          message: `Tài khoản của bạn đã bị khóa với lý do: ${
            user.blockReason || "Vi phạm chính sách người dùng"
          }. Vui lòng liên hệ quản trị viên để biết thêm chi tiết.`,
          type: "user",
          entityId: user._id,
        });
      }
    } catch (notificationError) {
      console.error("Lỗi khi tạo thông báo:", notificationError);
      // Không cần throw lỗi, chỉ log và tiếp tục
    }

    res.status(200).json({
      success: true,
      message: "Đã khóa tài khoản người dùng thành công",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi khóa tài khoản người dùng",
    });
  }
});

// Mở khóa tài khoản người dùng - Chỉ Admin
exports.unblockUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    // Kiểm tra quyền admin (mặc dù middleware admin đã kiểm tra)
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thực hiện hành động này",
      });
    }

    // Sử dụng userService để mở khóa tài khoản
    const user = await userService.unblockUser(userId);

    // Gửi thông báo đến người dùng
    try {
      if (
        mongoose &&
        mongoose.modelNames &&
        mongoose.modelNames().includes("Notification")
      ) {
        const Notification = mongoose.model("Notification");
        await Notification.create({
          userId: user._id,
          title: "Tài khoản đã được mở khóa",
          message:
            "Tài khoản của bạn đã được mở khóa và có thể sử dụng bình thường.",
          type: "user",
          entityId: user._id,
        });
      }
    } catch (notificationError) {
      console.error("Lỗi khi tạo thông báo:", notificationError);
      // Không cần throw lỗi, chỉ log và tiếp tục
    }

    res.status(200).json({
      success: true,
      message: "Đã mở khóa tài khoản người dùng thành công",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi mở khóa tài khoản người dùng",
    });
  }
});
