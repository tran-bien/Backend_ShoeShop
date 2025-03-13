const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const Session = require("../models/session.model");
const crypto = require("crypto");
const emailUtils = require("../utils/email");

const authService = {
  /**
   * Tạo mã JWT token
   * @param {String} id - ID người dùng
   * @returns {String} - JWT token
   */
  generateToken: (id) => {
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET không được cấu hình!");
      throw new Error("Lỗi cấu hình token, vui lòng liên hệ quản trị viên");
    }
    return jwt.sign({ id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "30d",
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
   * Gửi lại mã OTP
   * @param {String} email - Email người dùng
   * @returns {String} - Mã OTP mới
   */
  resendOTP: async (email) => {
    // Tìm người dùng theo email
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("Người dùng không tồn tại");
    }

    // Tạo mã OTP mới
    user.otp.code = authService.generateOTP();
    user.otp.expiredAt = Date.now() + 10 * 60 * 1000; // Cập nhật thời gian hết hạn

    // Lưu thông tin người dùng
    await user.save();

    // Gửi mã OTP đến email
    await emailUtils.sendVerificationEmail(
      user.email,
      user.name,
      user.otp.code
    );

    return user.otp.code; // Trả về mã OTP mới
  },

  /**
   * Tạo refresh token
   * @param {String} id - ID người dùng
   * @returns {String} - Refresh token
   */
  generateRefreshToken: (id) => {
    if (!process.env.REFRESH_TOKEN_SECRET) {
      console.error("REFRESH_TOKEN_SECRET không được cấu hình!");
      throw new Error("Lỗi cấu hình token, vui lòng liên hệ quản trị viên");
    }
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

    // Tính thời gian hết hạn dựa trên thời gian sống của token
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 ngày

    // Tạo một phiên mới
    const session = await Session.create({
      user: userId,
      token,
      refreshToken,
      userAgent,
      ip,
      expiresAt, // Thêm trường expiresAt
      userId: userId, // Đảm bảo userId được cung cấp
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
    const { name, email, password } = userData;

    // Kiểm tra email đã tồn tại
    const userExistsByEmail = await User.findOne({ email });
    if (userExistsByEmail) {
      throw new Error("Email đã được sử dụng");
    }

    // Tạo mã OTP trước
    const otpCode = authService.generateOTP();
    console.log("Đang tạo mã OTP:", otpCode); // Để debug

    // Tạo người dùng mới
    const user = await User.create({
      name,
      email,
      password,
      isVerified: false,
      otp: {
        code: otpCode,
        expiredAt: Date.now() + 10 * 60 * 1000, // Hết hạn sau 10 phút
      },
    });

    console.log("Người dùng đã được tạo với OTP:", user.otp); // Để debug

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
      isVerified: user.isVerified,
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
    // Kiểm tra refresh token
    const session = await Session.findOne({ refreshToken, isActive: true });
    if (!session) {
      throw new Error("Refresh token không hợp lệ hoặc đã hết hạn");
    }

    // Kiểm tra người dùng
    const user = await User.findById(session.user);
    if (!user) {
      throw new Error("Người dùng không tồn tại");
    }

    // Tạo token mới
    const newToken = authService.generateToken(user._id);

    // Cập nhật session
    session.token = newToken;
    session.lastActive = Date.now();
    await session.save();

    return { token: newToken };
  },

  /**
   * Xác thực OTP
   * @param {Object} data - Dữ liệu xác thực (userId hoặc email và OTP)
   * @returns {Object} - Thông tin người dùng và token
   */
  verifyOTP: async (data) => {
    const { userId, email, otp } = data;
    console.log("Đang xác thực OTP:", { userId, email, otp }); // Để debug

    let user;

    // Tìm user bằng userId hoặc email
    if (userId) {
      user = await User.findById(userId);
    } else if (email) {
      user = await User.findOne({ email });
    } else {
      throw new Error("Vui lòng cung cấp userId hoặc email");
    }

    if (!user) {
      throw new Error("Người dùng không tồn tại");
    }

    console.log("Thông tin OTP của người dùng:", user.otp); // Để debug

    // Kiểm tra OTP
    if (!user.otp || user.otp.code !== otp) {
      throw new Error("Mã OTP không hợp lệ");
    }

    // Kiểm tra thời hạn OTP
    if (new Date() > new Date(user.otp.expiredAt)) {
      throw new Error("Mã OTP đã hết hạn");
    }

    // Xác nhận người dùng
    user.isVerified = true;
    user.otp = undefined;
    await user.save();

    // Tạo token
    try {
      const token = authService.generateToken(user._id);
      const refreshToken = authService.generateRefreshToken(user._id);
      return { user, token, refreshToken };
    } catch (error) {
      console.error("Lỗi khi tạo token:", error);
      throw error;
    }
  },

  /**
   * Đăng xuất
   * @param {String} userId - ID người dùng
   * @param {String} token - JWT token
   * @returns {Object} - Kết quả đăng xuất
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

  /**
   * Lấy danh sách phiên đăng nhập hiện tại
   * @param {String} userId - ID người dùng
   * @param {String} currentSessionId - ID phiên hiện tại
   * @returns {Array} - Danh sách phiên đăng nhập
   */
  getCurrentSessions: async (userId, currentSessionId) => {
    const sessions = await Session.find({
      user: userId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    }).sort({ lastActive: -1 });

    // Đánh dấu phiên hiện tại
    const sessionsWithCurrentFlag = sessions.map((session) => {
      const sessionObj = session.toObject();
      sessionObj.isCurrentSession =
        session._id.toString() === currentSessionId.toString();
      return sessionObj;
    });

    return sessionsWithCurrentFlag;
  },

  /**
   * Đăng xuất khỏi phiên cụ thể
   * @param {String} sessionId - ID phiên đăng nhập
   * @param {String} userId - ID người dùng
   * @returns {Object} - Kết quả đăng xuất
   */
  logoutSession: async (sessionId, userId) => {
    // Kiểm tra phiên tồn tại
    const session = await Session.findById(sessionId);
    if (!session) {
      throw new Error("Phiên đăng nhập không tồn tại");
    }

    // Kiểm tra quyền (chỉ có thể đăng xuất khỏi phiên của chính mình)
    if (session.user.toString() !== userId.toString()) {
      throw new Error("Bạn không có quyền đăng xuất khỏi phiên này");
    }

    // Đánh dấu phiên là không còn hoạt động
    session.isActive = false;
    await session.save();

    return {
      isCurrentSession: false,
      message: "Đã đăng xuất khỏi phiên này",
    };
  },
};

module.exports = authService;
