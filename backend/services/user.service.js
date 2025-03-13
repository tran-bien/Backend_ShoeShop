const User = require("../models/user.model");
const mongoose = require("mongoose");
const paginationService = require("./pagination.service");
const { uploadImage, deleteImage } = require("../utils/cloudinary");

const userService = {
  /**
   * Lấy thông tin chi tiết của người dùng
   * @param {String} userId - ID người dùng
   * @returns {Object} - Thông tin người dùng
   */
  getUserProfile: async (userId) => {
    const user = await User.findById(userId).select("-password");
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }
    return user;
  },

  /**
   * Cập nhật thông tin cá nhân của người dùng
   * @param {String} userId - ID người dùng
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Object} - Thông tin người dùng đã cập nhật
   */
  updateUserProfile: async (userId, updateData) => {
    const { name, phone, gender, birthday, address } = updateData;

    // Kiểm tra người dùng tồn tại
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    // Cập nhật thông tin
    if (name) user.name = name;
    if (phone) {
      // Kiểm tra số điện thoại đã tồn tại
      const phoneExists = await User.findOne({ phone, _id: { $ne: userId } });
      if (phoneExists) {
        throw new Error("Số điện thoại đã được sử dụng bởi tài khoản khác");
      }
      user.phone = phone;
    }
    if (gender !== undefined) user.gender = gender;
    if (birthday) user.birthday = new Date(birthday);
    if (address) {
      user.address = {
        ...user.address,
        ...address,
      };
    }

    // Lưu thông tin người dùng
    await user.save();

    // Trả về thông tin đã cập nhật (không bao gồm mật khẩu)
    const updatedUser = await User.findById(userId).select("-password");
    return updatedUser;
  },

  /**
   * Cập nhật avatar người dùng
   * @param {String} userId - ID người dùng
   * @param {Object} file - File hình ảnh
   * @returns {Object} - Thông tin avatar đã cập nhật
   */
  updateAvatar: async (userId, file) => {
    if (!file) {
      throw new Error("Vui lòng cung cấp hình ảnh");
    }

    // Tìm người dùng
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    // Xóa avatar cũ nếu có
    if (user.avatar && user.avatar.public_id) {
      try {
        await deleteImage(user.avatar.public_id);
      } catch (error) {
        console.error("Lỗi khi xóa avatar cũ:", error);
      }
    }

    // Tải lên avatar mới
    const uploadedImage = await uploadImage(file);

    // Cập nhật thông tin avatar
    user.avatar = {
      url: uploadedImage.url,
      public_id: uploadedImage.public_id,
    };

    await user.save();

    return {
      avatar: user.avatar,
    };
  },

  /**
   * Lấy danh sách địa chỉ của người dùng
   * @param {String} userId - ID người dùng
   * @returns {Array} - Danh sách địa chỉ
   */
  getUserAddresses: async (userId) => {
    const user = await User.findById(userId).select("addresses");
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }
    return user.addresses || [];
  },

  /**
   * Thêm địa chỉ mới cho người dùng
   * @param {String} userId - ID người dùng
   * @param {Object} addressData - Dữ liệu địa chỉ
   * @returns {Object} - Địa chỉ đã thêm
   */
  addUserAddress: async (userId, addressData) => {
    const { fullName, phone, province, district, ward, street, isDefault } =
      addressData;

    // Kiểm tra các trường bắt buộc
    if (!fullName || !phone || !province || !district || !ward || !street) {
      throw new Error("Vui lòng điền đầy đủ thông tin địa chỉ");
    }

    // Tìm người dùng
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    // Tạo ID cho địa chỉ mới
    const addressId = new mongoose.Types.ObjectId();

    // Khởi tạo mảng addresses nếu chưa có
    if (!user.addresses) {
      user.addresses = [];
    }

    // Nếu là địa chỉ mặc định, cập nhật tất cả địa chỉ khác thành không mặc định
    if (isDefault) {
      user.addresses.forEach((address) => {
        address.isDefault = false;
      });
    }

    // Thêm địa chỉ mới
    const newAddress = {
      _id: addressId,
      fullName,
      phone,
      province,
      district,
      ward,
      street,
      isDefault: isDefault || user.addresses.length === 0, // Mặc định là true nếu là địa chỉ đầu tiên
    };

    user.addresses.push(newAddress);
    await user.save();

    return newAddress;
  },

  /**
   * Cập nhật địa chỉ của người dùng
   * @param {String} userId - ID người dùng
   * @param {String} addressId - ID địa chỉ
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Object} - Địa chỉ đã cập nhật
   */
  updateUserAddress: async (userId, addressId, updateData) => {
    const { fullName, phone, province, district, ward, street, isDefault } =
      updateData;

    // Tìm người dùng
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    // Tìm địa chỉ cần cập nhật
    const addressIndex = user.addresses.findIndex(
      (address) => address._id.toString() === addressId
    );

    if (addressIndex === -1) {
      throw new Error("Không tìm thấy địa chỉ");
    }

    // Nếu đặt làm địa chỉ mặc định, cập nhật tất cả địa chỉ khác
    if (isDefault) {
      user.addresses.forEach((address) => {
        address.isDefault = false;
      });
    }

    // Cập nhật thông tin địa chỉ
    if (fullName) user.addresses[addressIndex].fullName = fullName;
    if (phone) user.addresses[addressIndex].phone = phone;
    if (province) user.addresses[addressIndex].province = province;
    if (district) user.addresses[addressIndex].district = district;
    if (ward) user.addresses[addressIndex].ward = ward;
    if (street) user.addresses[addressIndex].street = street;
    if (isDefault !== undefined)
      user.addresses[addressIndex].isDefault = isDefault;

    await user.save();

    return user.addresses[addressIndex];
  },

  /**
   * Xóa địa chỉ của người dùng
   * @param {String} userId - ID người dùng
   * @param {String} addressId - ID địa chỉ
   * @returns {Boolean} - Kết quả xóa
   */
  deleteUserAddress: async (userId, addressId) => {
    // Tìm người dùng
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    // Tìm địa chỉ cần xóa
    const addressIndex = user.addresses.findIndex(
      (address) => address._id.toString() === addressId
    );

    if (addressIndex === -1) {
      throw new Error("Không tìm thấy địa chỉ");
    }

    // Kiểm tra nếu là địa chỉ mặc định
    const isDefault = user.addresses[addressIndex].isDefault;

    // Xóa địa chỉ
    user.addresses.splice(addressIndex, 1);

    // Nếu xóa địa chỉ mặc định và còn địa chỉ khác, đặt địa chỉ đầu tiên làm mặc định
    if (isDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    return true;
  },

  /**
   * Đặt địa chỉ mặc định cho người dùng
   * @param {String} userId - ID người dùng
   * @param {String} addressId - ID địa chỉ
   * @returns {Boolean} - Kết quả cập nhật
   */
  setDefaultAddress: async (userId, addressId) => {
    // Tìm người dùng
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    // Kiểm tra địa chỉ tồn tại
    const addressExists = user.addresses.find(
      (address) => address._id.toString() === addressId
    );

    if (!addressExists) {
      throw new Error("Không tìm thấy địa chỉ");
    }

    // Cập nhật tất cả địa chỉ thành không mặc định
    user.addresses.forEach((address) => {
      address.isDefault = address._id.toString() === addressId;
    });

    await user.save();

    return true;
  },

  /**
   * Lấy danh sách người dùng (phân trang)
   * @param {Object} queryParams - Các tham số truy vấn
   * @returns {Object} - Danh sách người dùng phân trang
   */
  getUsers: async (queryParams) => {
    // Tạo các tùy chọn tìm kiếm và lọc
    const searchOptions = {
      searchableFields: ["name", "email", "phone"],
      filterableFields: ["role", "isBlocked", "isEmailVerified"],
      booleanFields: ["isBlocked", "isEmailVerified"],
    };

    // Áp dụng các bộ lọc từ request
    const filterQuery = paginationService.applyFilters(
      queryParams,
      searchOptions
    );

    // Tạo thông tin phân trang và sắp xếp
    const { pagination, sort } = paginationService.createPaginationQuery(
      queryParams,
      {
        defaultSortField: "createdAt",
        defaultSortOrder: "desc",
      }
    );

    // Thực hiện truy vấn với phân trang
    const users = await User.find(filterQuery)
      .select("-password")
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit);

    // Đếm tổng số bản ghi
    const total = await User.countDocuments(filterQuery);

    // Tạo response phân trang
    return paginationService.createPaginationResponse(users, total, pagination);
  },

  /**
   * Khóa/mở khóa tài khoản người dùng
   * @param {String} userId - ID người dùng
   * @param {Boolean} isBlocked - Trạng thái khóa
   * @returns {Object} - Thông tin người dùng đã cập nhật
   */
  toggleBlockUser: async (userId, isBlocked) => {
    // Kiểm tra người dùng tồn tại
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    // Không thể khóa tài khoản admin
    if (user.role === "admin") {
      throw new Error("Không thể khóa tài khoản admin");
    }

    // Cập nhật trạng thái khóa
    user.isBlocked = isBlocked;
    await user.save();

    const updatedUser = await User.findById(userId).select("-password");
    return updatedUser;
  },

  /**
   * Khóa tài khoản người dùng
   * @param {String} userId - ID người dùng
   * @param {String} reason - Lý do khóa
   * @returns {Object} - Thông tin người dùng đã cập nhật
   */
  blockUser: async (userId, reason) => {
    // Tìm người dùng
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    // Kiểm tra xem người dùng đã bị khóa chưa
    if (user.isActive === false) {
      throw new Error("Tài khoản này đã bị khóa");
    }

    // Không cho phép khóa tài khoản admin
    if (user.role === "admin") {
      throw new Error("Không thể khóa tài khoản admin");
    }

    // Cập nhật trạng thái và lý do khóa
    user.isActive = false;
    user.blockReason = reason || "Vi phạm chính sách người dùng";
    user.blockedAt = Date.now();

    await user.save();
    return user;
  },

  /**
   * Mở khóa tài khoản người dùng
   * @param {String} userId - ID người dùng
   * @returns {Object} - Thông tin người dùng đã cập nhật
   */
  unblockUser: async (userId) => {
    // Tìm người dùng
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    // Kiểm tra xem người dùng đã bị khóa chưa
    if (user.isActive === true) {
      throw new Error("Tài khoản này đang hoạt động");
    }

    // Cập nhật trạng thái và xóa lý do khóa
    user.isActive = true;
    user.blockReason = undefined;
    user.blockedAt = undefined;

    await user.save();
    return user;
  },

  /**
   * Cập nhật vai trò của người dùng
   * @param {String} userId - ID người dùng
   * @param {String} role - Vai trò mới
   * @returns {Object} - Thông tin người dùng đã cập nhật
   */
  updateUserRole: async (userId, role) => {
    // Kiểm tra vai trò hợp lệ
    const validRoles = ["user", "admin"];
    if (!validRoles.includes(role)) {
      throw new Error("Vai trò không hợp lệ");
    }

    // Tìm và cập nhật người dùng
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    user.role = role;
    await user.save();

    return user;
  },

  /**
   * Xóa người dùng
   * @param {String} userId - ID người dùng
   * @returns {Boolean} - Kết quả xóa
   */
  deleteUser: async (userId) => {
    const result = await User.findByIdAndDelete(userId);
    if (!result) {
      throw new Error("Không tìm thấy người dùng");
    }
    return true;
  },

  /**
   * Thêm sản phẩm vào danh sách yêu thích
   * @param {String} userId - ID người dùng
   * @param {String} productId - ID sản phẩm
   * @returns {Array} - Danh sách sản phẩm yêu thích
   */
  addToWishlist: async (userId, productId) => {
    // Tìm người dùng
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    // Kiểm tra sản phẩm đã có trong danh sách chưa
    if (user.wishlist.includes(productId)) {
      throw new Error("Sản phẩm đã có trong danh sách yêu thích");
    }

    // Thêm vào danh sách yêu thích
    user.wishlist.push(productId);
    await user.save();

    return user.wishlist;
  },

  /**
   * Xóa sản phẩm khỏi danh sách yêu thích
   * @param {String} userId - ID người dùng
   * @param {String} productId - ID sản phẩm
   * @returns {Array} - Danh sách sản phẩm yêu thích
   */
  removeFromWishlist: async (userId, productId) => {
    // Tìm người dùng
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    // Xóa khỏi danh sách yêu thích
    user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
    await user.save();

    return user.wishlist;
  },

  /**
   * Lấy danh sách sản phẩm yêu thích
   * @param {String} userId - ID người dùng
   * @returns {Array} - Danh sách sản phẩm yêu thích
   */
  getWishlist: async (userId) => {
    // Tìm người dùng và populate danh sách yêu thích
    const user = await User.findById(userId).populate({
      path: "wishlist",
      select:
        "name price images description category brand gender totalSold rating",
      populate: [
        { path: "category", select: "name" },
        { path: "brand", select: "name" },
      ],
    });

    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    return user.wishlist;
  },

  /**
   * Lấy danh sách mã giảm giá của người dùng
   * @param {String} userId - ID người dùng
   * @returns {Array} - Danh sách mã giảm giá
   */
  getUserCoupons: async (userId) => {
    // Tìm người dùng và populate danh sách mã giảm giá
    const user = await User.findById(userId).populate("coupons");
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    return user.coupons;
  },
};

module.exports = userService;
