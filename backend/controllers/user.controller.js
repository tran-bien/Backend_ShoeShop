const asyncHandler = require("express-async-handler");
const User = require("../models/user.model");
const Product = require("../models/product.model");
const { uploadImage, deleteImage } = require("../utils/cloudinary");
const mongoose = require("mongoose");

// Nếu có dịch vụ notification riêng
// const { createNotification } = require("../services/notification.service");

// Lấy thông tin cá nhân
exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("-password")
    .populate("wishlist", "name price colors.images");

  res.json({
    success: true,
    user,
  });
});

// Cập nhật thông tin cá nhân
exports.updateProfile = asyncHandler(async (req, res) => {
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
    // Kiểm tra định dạng số điện thoại Việt Nam
    // Các định dạng chấp nhận: 0912345678, 84912345678, +84912345678
    const phoneRegex = /^(0|\+84|84)?([3|5|7|8|9])([0-9]{8})$/;
    if (phone !== "" && !phoneRegex.test(phone)) {
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

  const user = await User.findById(req.user._id);

  // Cập nhật thông tin
  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (gender) user.gender = gender;
  if (dateOfBirth) user.dateOfBirth = dateOfBirth;

  await user.save();

  res.json({
    success: true,
    message: "Đã cập nhật thông tin cá nhân",
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      isVerified: user.isVerified,
      role: user.role,
    },
  });
});

// Cập nhật ảnh đại diện
exports.updateAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng tải lên ảnh đại diện",
    });
  }

  const user = await User.findById(req.user._id);

  // Xóa ảnh cũ nếu có
  if (user.image) {
    try {
      const publicId = user.image.split("/").pop().split(".")[0];
      await deleteImage(publicId);
    } catch (error) {
      console.error("Lỗi khi xóa ảnh cũ:", error);
      // Vẫn tiếp tục tải lên ảnh mới ngay cả khi xóa ảnh cũ bị lỗi
    }
  }

  // Tải lên ảnh mới
  try {
    const result = await uploadImage(req.file.path, "avatars");
    user.image = result.url;
    await user.save();

    res.json({
      success: true,
      message: "Đã cập nhật ảnh đại diện",
      image: result.url,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể tải lên ảnh đại diện. Vui lòng thử lại!",
      error: error.message,
    });
  }
});

// Thêm địa chỉ mới
exports.addAddress = asyncHandler(async (req, res) => {
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

  // Kiểm tra định dạng số điện thoại (số điện thoại Việt Nam)
  const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({
      success: false,
      message: "Số điện thoại không hợp lệ",
    });
  }

  const user = await User.findById(req.user._id);

  // Thêm địa chỉ mới
  const newAddress = {
    fullName,
    phone,
    province,
    district,
    ward,
    addressDetail,
    isDefault: isDefault || false,
  };

  // Nếu là địa chỉ mặc định, cập nhật các địa chỉ khác
  if (isDefault) {
    user.addresses.forEach((address) => {
      address.isDefault = false;
    });
  }

  // Nếu đây là địa chỉ đầu tiên, đặt là mặc định
  if (user.addresses.length === 0) {
    newAddress.isDefault = true;
  }

  user.addresses.push(newAddress);
  await user.save();

  res.json({
    success: true,
    message: "Đã thêm địa chỉ mới",
    addresses: user.addresses,
  });
});

// Cập nhật địa chỉ
exports.updateAddress = asyncHandler(async (req, res) => {
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
  if (phone) {
    const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Số điện thoại không hợp lệ",
      });
    }
  }

  const user = await User.findById(req.user._id);

  // Tìm địa chỉ cần cập nhật
  const address = user.addresses.id(addressId);
  if (!address) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy địa chỉ",
    });
  }

  // Cập nhật thông tin
  if (fullName) address.fullName = fullName;
  if (phone) address.phone = phone;
  if (province) address.province = province;
  if (district) address.district = district;
  if (ward) address.ward = ward;
  if (addressDetail) address.addressDetail = addressDetail;
  if (isDefault !== undefined) {
    if (isDefault) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }
    address.isDefault = isDefault;
  }

  await user.save();

  res.json({
    success: true,
    message: "Đã cập nhật địa chỉ",
    addresses: user.addresses,
  });
});

// Xóa địa chỉ
exports.deleteAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params;

  const user = await User.findById(req.user._id);

  // Xóa địa chỉ
  user.addresses = user.addresses.filter(
    (address) => address._id.toString() !== addressId
  );
  await user.save();

  res.json({
    success: true,
    message: "Đã xóa địa chỉ",
    addresses: user.addresses,
  });
});

/**
 * @desc    Đặt địa chỉ mặc định
 * @route   PUT /api/users/address/:addressId/default
 * @access  Private
 */
exports.setDefaultAddress = asyncHandler(async (req, res) => {
  // Tìm user từ req.user đã được gắn trong middleware auth
  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ message: "Không tìm thấy người dùng" });
  }

  // Lấy addressId từ params
  const { addressId } = req.params;

  // Tìm địa chỉ trong danh sách địa chỉ của người dùng
  const address = user.addresses.id(addressId);
  if (!address) {
    return res.status(404).json({ message: "Không tìm thấy địa chỉ này" });
  }

  // Đặt tất cả địa chỉ thành không phải mặc định
  user.addresses.forEach((addr) => {
    addr.isDefault = false;
  });

  // Đặt địa chỉ được chọn thành mặc định
  address.isDefault = true;

  // Lưu thay đổi
  await user.save();

  res.status(200).json({
    success: true,
    message: "Đã đặt địa chỉ mặc định thành công",
    addresses: user.addresses,
  });
});

// Thêm sản phẩm vào danh sách yêu thích
exports.addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  const user = await User.findById(req.user._id);

  // Kiểm tra sản phẩm đã có trong danh sách chưa
  if (user.wishlist.includes(productId)) {
    return res.status(400).json({
      success: false,
      message: "Sản phẩm đã có trong danh sách yêu thích",
    });
  }

  // Thêm vào danh sách yêu thích
  user.wishlist.push(productId);
  await user.save();

  res.json({
    success: true,
    message: "Đã thêm vào danh sách yêu thích",
    wishlist: user.wishlist,
  });
});

// Xóa sản phẩm khỏi danh sách yêu thích
exports.removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const user = await User.findById(req.user._id);

  // Xóa khỏi danh sách yêu thích
  user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
  await user.save();

  res.json({
    success: true,
    message: "Đã xóa khỏi danh sách yêu thích",
    wishlist: user.wishlist,
  });
});

/**
 * @desc    Lấy danh sách sản phẩm yêu thích của người dùng
 * @route   GET /api/users/wishlist
 * @access  Private
 */
exports.getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: "wishlist",
    select:
      "name price images description category brand gender totalSold rating",
    populate: [
      { path: "category", select: "name" },
      { path: "brand", select: "name" },
    ],
  });

  if (!user) {
    res.status(404);
    throw new Error("Không tìm thấy người dùng");
  }

  res.status(200).json({
    success: true,
    count: user.wishlist.length,
    data: user.wishlist,
  });
});

// Lấy danh sách mã giảm giá của người dùng
exports.getUserCoupons = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate("coupons");

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy người dùng",
    });
  }

  res.status(200).json({
    success: true,
    count: user.coupons.length,
    coupons: user.coupons,
  });
});

// Khóa tài khoản người dùng - Chỉ Admin
exports.blockUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;

  // Kiểm tra quyền admin (mặc dù middleware admin đã kiểm tra)
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền thực hiện hành động này",
    });
  }

  // Tìm người dùng
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy người dùng",
    });
  }

  // Kiểm tra xem người dùng đã bị khóa chưa
  if (user.isActive === false) {
    return res.status(400).json({
      success: false,
      message: "Tài khoản này đã bị khóa",
    });
  }

  // Không cho phép khóa tài khoản admin khác
  if (user.role === "admin") {
    return res.status(400).json({
      success: false,
      message: "Không thể khóa tài khoản admin",
    });
  }

  // Cập nhật trạng thái và lý do khóa
  user.isActive = false;
  user.blockReason = reason || "Vi phạm chính sách người dùng";
  user.blockedAt = Date.now();

  await user.save();

  // Đăng xuất người dùng khỏi tất cả các thiết bị nếu có model Session
  try {
    if (mongoose.modelNames().includes("Session")) {
      const Session = mongoose.model("Session");
      await Session.deleteMany({ userId: user._id });
    }
  } catch (error) {
    console.error("Lỗi khi đăng xuất người dùng:", error);
  }

  // Gửi thông báo đến người dùng nếu có hàm createNotification
  try {
    if (typeof createNotification === "function") {
      await createNotification(
        user._id,
        "Tài khoản bị khóa",
        `Tài khoản của bạn đã bị khóa với lý do: ${user.blockReason}. Vui lòng liên hệ quản trị viên để biết thêm chi tiết.`,
        "user",
        user._id
      );
    } else {
      // Tạo thông báo bằng model Notification nếu có
      if (mongoose.modelNames().includes("Notification")) {
        const Notification = mongoose.model("Notification");
        await Notification.create({
          userId: user._id,
          title: "Tài khoản bị khóa",
          message: `Tài khoản của bạn đã bị khóa với lý do: ${user.blockReason}. Vui lòng liên hệ quản trị viên để biết thêm chi tiết.`,
          type: "user",
          entityId: user._id,
        });
      }
    }
  } catch (error) {
    console.error("Lỗi khi tạo thông báo:", error);
  }

  res.status(200).json({
    success: true,
    message: "Đã khóa tài khoản người dùng thành công",
  });
});

// Mở khóa tài khoản người dùng - Chỉ Admin
exports.unblockUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Kiểm tra quyền admin (mặc dù middleware admin đã kiểm tra)
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền thực hiện hành động này",
    });
  }

  // Tìm người dùng
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy người dùng",
    });
  }

  // Kiểm tra xem người dùng đã bị khóa chưa
  if (user.isActive === true) {
    return res.status(400).json({
      success: false,
      message: "Tài khoản này đang hoạt động",
    });
  }

  // Cập nhật trạng thái và xóa lý do khóa
  user.isActive = true;
  user.blockReason = undefined;
  user.blockedAt = undefined;

  await user.save();

  // Gửi thông báo đến người dùng nếu có hàm createNotification
  try {
    if (typeof createNotification === "function") {
      await createNotification(
        user._id,
        "Tài khoản đã được mở khóa",
        "Tài khoản của bạn đã được mở khóa và có thể sử dụng bình thường.",
        "user",
        user._id
      );
    } else {
      // Tạo thông báo bằng model Notification
      if (mongoose.modelNames().includes("Notification")) {
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
    }
  } catch (error) {
    console.error("Lỗi khi tạo thông báo:", error);
  }

  res.status(200).json({
    success: true,
    message: "Đã mở khóa tài khoản người dùng thành công",
  });
});
