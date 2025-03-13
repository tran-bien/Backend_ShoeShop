const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const Session = require("../models/session.model");
const crypto = require("crypto");

const authService = {
  /**
   * Tạo mã JWT token
   * @param {String} id - ID người dùng
   * @returns {String} - JWT token
   */
  generateToken: (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });
  },

  /**
   * Tạo mã OTP ngẫu nhiên
   * @returns {String} - Mã OTP 6 chữ số
   */
  generateOTP: () => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    return otp;
  },

  /**
   * Tạo refresh token
   * @param {String} id - ID người dùng
   * @returns {String} - Refresh token
   */
  generateRefreshToken: (id) => {
    return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
    });
  },

  /**
   * Tạo hoặc cập nhật phiên đăng nhập
   * @param {String} userId - ID người dùng
   * @param {Object} req - Request object
   * @param {String} token - JWT token
   * @param {String} refreshToken - Refresh token
   * @returns {Object} - Đối tượng phiên
   */
  createSession: async (userId, req, token, refreshToken) => {
    const userAgent = req.headers["user-agent"] || "Không xác định";
    const ip = req.ip || req.connection.remoteAddress || "Không xác định";

    // Tạo một phiên mới
    const session = await Session.create({
      user: userId,
      token,
      refreshToken,
      userAgent,
      ip,
      isActive: true,
    });

    return session;
  },

  /**
   * Đăng ký người dùng mới
   * @param {Object} userData - Thông tin người dùng mới
   * @returns {Object} - Thông tin người dùng đã đăng ký
   */
  registerUser: async (userData) => {
    const { name, email, phone, password } = userData;

    // Kiểm tra email đã tồn tại
    const userExistsByEmail = await User.findOne({ email });
    if (userExistsByEmail) {
      throw new Error("Email đã được sử dụng");
    }

    // Kiểm tra số điện thoại đã tồn tại
    if (phone) {
      const userExistsByPhone = await User.findOne({ phone });
      if (userExistsByPhone) {
        throw new Error("Số điện thoại đã được sử dụng");
      }
    }

    // Tạo người dùng mới
    const user = await User.create({
      name,
      email,
      phone,
      password,
    });

    return user;
  },

  /**
   * Đăng nhập người dùng
   * @param {String} email - Email
   * @param {String} password - Mật khẩu
   * @param {Object} req - Request object
   * @returns {Object} - Thông tin người dùng và token
   */
  loginUser: async (email, password, req) => {
    // Tìm người dùng theo email
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("Email không tồn tại");
    }

    // Kiểm tra mật khẩu
    const isPasswordMatch = await user.matchPassword(password);
    if (!isPasswordMatch) {
      throw new Error("Mật khẩu không đúng");
    }

    // Kiểm tra trạng thái người dùng
    if (user.isBlocked) {
      throw new Error("Tài khoản của bạn đã bị khóa");
    }

    // Tạo token và refresh token
    const token = authService.generateToken(user._id);
    const refreshToken = authService.generateRefreshToken(user._id);

    // Tạo phiên đăng nhập
    await authService.createSession(user._id, req, token, refreshToken);

    // Cập nhật thông tin đăng nhập cuối cùng
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
      token,
      refreshToken,
    };
  },

  /**
   * Làm mới token
   * @param {String} refreshToken - Refresh token
   * @param {Object} req - Request object
   * @returns {Object} - Token mới
   */
  refreshToken: async (refreshToken, req) => {
    if (!refreshToken) {
      throw new Error("Không tìm thấy refresh token");
    }

    // Tìm phiên với refresh token
    const session = await Session.findOne({ refreshToken, isActive: true });
    if (!session) {
      throw new Error("Phiên không hợp lệ hoặc đã hết hạn");
    }

    try {
      // Xác thực refresh token
      const decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET
      );

      // Kiểm tra người dùng
      const user = await User.findById(decoded.id);
      if (!user) {
        throw new Error("Không tìm thấy người dùng");
      }

      // Tạo token mới
      const newToken = authService.generateToken(user._id);

      // Cập nhật token trong phiên
      session.token = newToken;
      await session.save();

      return { token: newToken };
    } catch (error) {
      // Vô hiệu hóa phiên nếu có lỗi
      session.isActive = false;
      await session.save();

      throw new Error("Refresh token không hợp lệ hoặc đã hết hạn");
    }
  },

  /**
   * Đăng xuất
   * @param {String} userId - ID người dùng
   * @param {String} token - JWT token
   * @returns {Boolean} - Kết quả đăng xuất
   */
  logout: async (userId, token) => {
    // Vô hiệu hóa phiên hiện tại
    const session = await Session.findOneAndUpdate(
      { user: userId, token, isActive: true },
      { isActive: false },
      { new: true }
    );

    return !!session;
  },

  /**
   * Đăng xuất khỏi tất cả các thiết bị
   * @param {String} userId - ID người dùng
   * @returns {Number} - Số phiên đã vô hiệu hóa
   */
  logoutAll: async (userId) => {
    const result = await Session.updateMany(
      { user: userId, isActive: true },
      { isActive: false }
    );

    return result.nModified || 0;
  },

  /**
   * Khởi tạo quy trình đặt lại mật khẩu
   * @param {String} email - Email người dùng
   * @returns {Object} - Thông tin token đặt lại mật khẩu
   */
  forgotPassword: async (email) => {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("Không tìm thấy email trong hệ thống");
    }

    // Tạo token đặt lại mật khẩu
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Mã hóa token trước khi lưu trữ
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Lưu token và thời gian hết hạn
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 phút

    await user.save({ validateBeforeSave: false });

    return {
      resetToken,
      user: {
        name: user.name,
        email: user.email,
      },
    };
  },

  /**
   * Đặt lại mật khẩu
   * @param {String} token - Token đặt lại mật khẩu
   * @param {String} newPassword - Mật khẩu mới
   * @returns {Boolean} - Kết quả đặt lại mật khẩu
   */
  resetPassword: async (token, newPassword) => {
    // Mã hóa token để so sánh
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Tìm người dùng với token hợp lệ
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new Error("Token không hợp lệ hoặc đã hết hạn");
    }

    // Cập nhật mật khẩu mới
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    // Đăng xuất khỏi tất cả các thiết bị
    await authService.logoutAll(user._id);

    return true;
  },

  /**
   * Thay đổi mật khẩu
   * @param {String} userId - ID người dùng
   * @param {String} currentPassword - Mật khẩu hiện tại
   * @param {String} newPassword - Mật khẩu mới
   * @returns {Boolean} - Kết quả thay đổi mật khẩu
   */
  changePassword: async (userId, currentPassword, newPassword) => {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    // Kiểm tra mật khẩu hiện tại
    const isPasswordMatch = await user.matchPassword(currentPassword);
    if (!isPasswordMatch) {
      throw new Error("Mật khẩu hiện tại không đúng");
    }

    // Cập nhật mật khẩu mới
    user.password = newPassword;
    await user.save();

    // Đăng xuất khỏi các thiết bị khác
    await Session.updateMany(
      {
        user: userId,
        isActive: true,
        token: { $ne: user.token }, // Không đăng xuất khỏi phiên hiện tại
      },
      { isActive: false }
    );

    return true;
  },
};

module.exports = authService;
