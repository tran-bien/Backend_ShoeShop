const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const Session = require("../models/session.model");
const crypto = require("crypto");
const emailUtils = require("../utils/email");
const bcrypt = require("bcryptjs");
const {
  isValidEmail,
  checkPasswordRequirements,
} = require("../utils/validators");
const mongoose = require("mongoose");

const authService = {
  /**
   * Tạo mã JWT token
   * @param {String} id - ID người dùng
   * @returns {String} - JWT token
   */
  generateToken: (id) => {
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
   * Tạo refresh token
   * @param {String} id - ID người dùng
   * @returns {String} - Refresh token
   */
  generateRefreshToken: (id) => {
    return jwt.sign(
      { id },
      process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "60d" }
    );
  },

  /**
   * Tạo hoặc cập nhật phiên đăng nhập
   * @param {String} userId - ID người dùng
   * @param {String} token - JWT token
   * @param {String} refreshToken - Refresh token
   * @param {Object} req - Request object (nếu cần)
   * @returns {Object} - Đối tượng phiên
   */
  createSession: async (userId, token, refreshToken, req = {}) => {
    try {
      // Kiểm tra nếu có session với token này, hãy cập nhật nó
      const existingSession = await Session.findOne({
        user: userId,
        token: token,
      });

      if (existingSession) {
        // Nếu đã tồn tại, chỉ cập nhật trạng thái hoạt động và thời gian
        existingSession.isActive = true;
        existingSession.lastActive = Date.now();
        await existingSession.save();
        return existingSession;
      }

      // Lấy thông tin client
      const userAgent =
        req && req.headers ? req.headers["user-agent"] : "Không xác định";
      const ip = req
        ? req.ip ||
          (req.connection ? req.connection.remoteAddress : "Không xác định")
        : "Không xác định";

      // Tính thời gian hết hạn dựa trên thời gian sống của token
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 ngày

      // Tạo một phiên mới
      const session = await Session.create({
        user: userId,
        userId: userId.toString(),
        token,
        refreshToken,
        userAgent,
        ip,
        expiresAt,
        isActive: true,
      });

      return session;
    } catch (error) {
      console.error("Lỗi khi tạo phiên đăng nhập:", error);
      throw new Error("Không thể tạo phiên đăng nhập. Vui lòng thử lại sau.");
    }
  },

  /**
   * Đăng ký người dùng mới
   * @param {Object} userData - Thông tin người dùng mới
   * @returns {Object} - Thông tin người dùng đã đăng ký
   */
  registerUser: async (userData) => {
    const { name, email, password } = userData;

    // Kiểm tra tên có hợp lệ không
    if (!name || name.trim().length === 0) {
      throw new Error("Tên không được để trống");
    }

    // Kiểm tra email đã tồn tại
    const userExistsByEmail = await User.findOne({ email });
    if (userExistsByEmail) {
      throw new Error("Email đã được sử dụng");
    }

    // Kiểm tra mật khẩu có hợp lệ không
    if (!checkPasswordRequirements(password)) {
      throw new Error(
        "Mật khẩu phải có ít nhất 8 ký tự, bao gồm 1 chữ cái và 1 số"
      );
    }

    // Tạo mã OTP trước
    const otpCode = authService.generateOTP();
    console.log("Đang tạo mã OTP:", otpCode); // Để debug

    // Mã hóa mật khẩu trước khi lưu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Tạo người dùng mới
    const user = await User.create({
      name,
      email,
      password: hashedPassword, // Lưu mật khẩu đã mã hóa
      isVerified: false,
      otp: {
        code: otpCode,
        expiredAt: Date.now() + 10 * 60 * 1000, // Hết hạn sau 10 phút
      },
    });

    // Gửi mã OTP đến email
    await emailUtils.sendVerificationEmail(
      user.email, // Email của người dùng
      user.name, // Tên của người dùng
      user.otp.code // Mã OTP
    );

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
  loginUser: async (email, password, req = {}) => {
    // Kiểm tra đầu vào
    const validateInput = (email, password) => {
      if (!email) {
        throw new Error("Vui lòng cung cấp email");
      }
      if (!password) {
        throw new Error("Vui lòng cung cấp mật khẩu");
      }
    };

    // Kiểm tra đầu vào
    validateInput(email, password);

    // Tìm user theo email
    const user = await User.findOne({ email });

    // Kiểm tra email có tồn tại không
    if (!user) {
      throw new Error("Email không tồn tại");
    }

    // Kiểm tra mật khẩu có đúng không - sử dụng bcrypt trực tiếp để debug
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    console.log("Mật khẩu nhập vào:", password);
    console.log("Mật khẩu trong DB:", user.password);
    console.log("Mật khẩu có khớp không:", isPasswordMatch);

    if (!isPasswordMatch) {
      throw new Error("Mật khẩu không đúng");
    }

    // Kiểm tra email có được xác thực không
    if (!user.isVerified) {
      // Kiểm tra và tạo OTP mới nếu cần
      if (
        !user.otp ||
        !user.otp.code ||
        new Date() > new Date(user.otp.expiredAt)
      ) {
        const otpCode = authService.generateOTP();
        user.otp = {
          code: otpCode,
          expiredAt: Date.now() + 10 * 60 * 1000, // Hết hạn sau 10 phút
        };
        await user.save();
      }

      console.log("Mã OTP:", user.otp.code);

      // Gửi mã OTP
      await emailUtils.sendVerificationEmail(
        user.email,
        user.name,
        user.otp.code
      );

      throw new Error(
        "Email chưa được xác thực. Vui lòng kiểm tra email để xác thực"
      );
    }

    // Tạo token và refreshToken
    const token = authService.generateToken(user._id);
    const refreshToken = authService.generateRefreshToken(user._id);

    try {
      // Tìm phiên hiện tại để cập nhật hoặc tạo mới
      await authService.createSession(user._id, token, refreshToken, req);
    } catch (error) {
      console.error("Lỗi khi tạo phiên đăng nhập:", error);
      // Không ném lỗi, vẫn cho phép đăng nhập
    }

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      image: user.image,
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
    const { userId, email, otp, req } = data;

    // Kiểm tra đầu vào
    if (!otp || (!userId && !email)) {
      throw new Error(
        !otp
          ? "Vui lòng cung cấp mã OTP"
          : "Vui lòng cung cấp userId hoặc email"
      );
    }

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

    // Tạo token và refreshToken
    const token = authService.generateToken(user._id);
    const refreshToken = authService.generateRefreshToken(user._id);

    try {
      // Tạo session mới
      await Session.create({
        user: user._id,
        userId: user._id.toString(),
        token,
        refreshToken,
        userAgent:
          req && req.headers ? req.headers["user-agent"] : "Không xác định",
        ip: req
          ? req.ip ||
            (req.connection ? req.connection.remoteAddress : "Không xác định")
          : "Không xác định",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
        lastActive: new Date(),
      });
    } catch (error) {
      console.error("Lỗi khi tạo phiên đăng nhập:", error);
      // Không ném lỗi, vẫn cho phép đăng nhập
    }

    return {
      user,
      token,
      refreshToken,
    };
  },

  /**
   * Lấy danh sách phiên đăng nhập hiện tại
   * @param {String} userId - ID người dùng
   * @param {String} currentToken - Token hiện tại
   * @returns {Array} - Danh sách phiên đăng nhập
   */
  getCurrentSessions: async (userId, currentToken) => {
    const sessions = await Session.find({
      user: userId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    }).sort({ lastActive: -1 });

    // Đánh dấu phiên hiện tại
    const sessionsWithCurrentFlag = sessions.map((session) => {
      const sessionObj = session.toObject();
      sessionObj.isCurrentSession = session.token === currentToken;
      return sessionObj;
    });

    return sessionsWithCurrentFlag;
  },

  /**
   * Đăng xuất
   * @param {String} userId - ID người dùng
   * @param {String} token - JWT token
   * @returns {Object} - Kết quả đăng xuất
   */
  logout: async (userId, token) => {
    try {
      // Kiểm tra xem có phiên hiện tại không
      const session = await Session.findOne({
        user: userId,
        token: token,
        isActive: true,
      });

      if (!session) {
        // Thay vì ném lỗi, trả về thông báo đăng xuất thành công
        console.log(
          `Không tìm thấy phiên đăng nhập cho user: ${userId} với token hiện tại`
        );
        return { success: true, message: "Đã đăng xuất thành công" };
      }

      // Vô hiệu hóa session
      session.isActive = false;
      await session.save();

      return { success: true, message: "Đăng xuất thành công" };
    } catch (error) {
      console.error("Lỗi trong service logout:", error);
      throw new Error("Không thể đăng xuất. Vui lòng thử lại sau.");
    }
  },

  /**
   * Đăng xuất khỏi tất cả các thiết bị trừ thiết bị hiện tại
   * @param {String} userId - ID người dùng
   * @param {String} currentToken - Token hiện tại (không đăng xuất)
   * @returns {Number} - Số phiên đã vô hiệu hóa
   */
  logoutAllOtherSessions: async (userId, currentToken) => {
    const result = await Session.updateMany(
      {
        user: userId,
        isActive: true,
        token: { $ne: currentToken }, // Loại trừ phiên hiện tại
      },
      { isActive: false }
    );

    return result.modifiedCount || 0; // Sử dụng modifiedCount thay vì nModified
  },

  /**
   * Khởi tạo quy trình đặt lại mật khẩu
   * @param {String} email - Email người dùng
   * @returns {Object} - Thông tin token đặt lại mật khẩu
   */
  forgotPassword: async (email) => {
    // Kiểm tra email có hợp lệ không
    if (!email) {
      throw new Error("Vui lòng cung cấp email");
    }

    if (!isValidEmail(email)) {
      throw new Error("Email không hợp lệ");
    }

    // Kiểm tra user tồn tại
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("Không tìm thấy tài khoản với email này");
    }

    // Tạo reset token và thiết lập thời gian hết hạn
    const resetToken = user.getResetPasswordToken();
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // Hết hạn sau 10 phút
    await user.save();

    // Log token để kiểm tra
    console.log("Reset Password Token:", resetToken);

    // Gửi email
    await emailUtils.sendResetPasswordEmail(user.email, user.name, resetToken);

    return { message: "Email đặt lại mật khẩu đã được gửi" };
  },

  /**
   * Đặt lại mật khẩu
   * @param {String} token - Token đặt lại mật khẩu
   * @param {String} newPassword - Mật khẩu mới
   * @returns {Boolean} - Kết quả đặt lại mật khẩu
   */
  resetPassword: async (resetToken, newPassword, confirmPassword) => {
    console.log("Bắt đầu quá trình đặt lại mật khẩu với token:", resetToken);

    // Kiểm tra token
    if (!resetToken) {
      throw new Error("Vui lòng cung cấp token đặt lại mật khẩu");
    }

    // Hàm kiểm tra mật khẩu
    const validatePasswords = (password, confirmPassword) => {
      if (!checkPasswordRequirements(password)) {
        throw new Error(
          "Mật khẩu phải có ít nhất 8 ký tự, bao gồm 1 chữ cái và 1 số"
        );
      }
      if (password !== confirmPassword) {
        throw new Error("Mật khẩu mới và xác nhận mật khẩu không khớp");
      }
    };

    // Kiểm tra mật khẩu mới và xác nhận mật khẩu
    validatePasswords(newPassword, confirmPassword);

    // Hash token để khớp với cách nó được lưu trong database
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    console.log("Token đã hash để tìm kiếm:", hashedToken);

    // Tìm user với reset token đã hash
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      throw new Error("Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");
    }

    console.log("Đã tìm thấy người dùng:", user.email);

    // Mã hóa mật khẩu mới - sử dụng cùng cách mã hóa như khi đăng ký
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // In ra để debug
    console.log("Mật khẩu mới (chưa hash):", newPassword);
    console.log("Mật khẩu mới (đã hash):", hashedPassword);

    // Cập nhật mật khẩu trực tiếp
    user.password = hashedPassword;

    // Xóa reset token
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    // Lưu người dùng
    await user.save();

    // Đăng xuất khỏi tất cả các thiết bị
    await authService.logoutAll(user._id);

    console.log(
      "Mật khẩu đã được đặt lại thành công cho người dùng:",
      user.email
    );
    return { message: "Mật khẩu đã được đặt lại thành công" };
  },

  /**
   * Thay đổi mật khẩu
   * @param {String} userId - ID người dùng
   * @param {String} currentPassword - Mật khẩu hiện tại
   * @param {String} newPassword - Mật khẩu mới
   * @returns {Boolean} - Kết quả thay đổi mật khẩu
   */
  changePassword: async (userId, currentPassword, newPassword) => {
    console.log("Bắt đầu quá trình thay đổi mật khẩu cho người dùng:", userId);

    // Kiểm tra người dùng
    const user = await User.findById(userId);
    if (!user) {
      console.log("Không tìm thấy người dùng với ID:", userId);
      throw new Error("Không tìm thấy người dùng");
    }

    console.log("Đã tìm thấy người dùng:", user.email);

    // Kiểm tra mật khẩu hiện tại
    const isPasswordMatch = await user.matchPassword(currentPassword);
    if (!isPasswordMatch) {
      console.log("Mật khẩu hiện tại không đúng cho người dùng:", user.email);
      throw new Error(
        "Mật khẩu hiện tại không đúng, không thể thay đổi mật khẩu"
      );
    }

    console.log("Mật khẩu hiện tại đã được xác minh");

    // Kiểm tra yêu cầu mật khẩu mới
    if (!checkPasswordRequirements(newPassword)) {
      throw new Error(
        "Mật khẩu phải có ít nhất 8 ký tự, bao gồm 1 chữ cái và 1 số"
      );
    }

    // Kiểm tra xem mật khẩu mới có giống mật khẩu cũ không
    if (await user.matchPassword(newPassword)) {
      throw new Error("Mật khẩu mới không được giống mật khẩu cũ");
    }

    // Cập nhật mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    console.log(
      "Mật khẩu đã được thay đổi thành công cho người dùng:",
      user.email
    );

    // Đăng xuất khỏi tất cả các thiết bị
    const logoutResult = await authService.logoutAll(user._id);
    console.log(`Đã đăng xuất khỏi ${logoutResult} phiên`);

    return { message: "Mật khẩu đã được thay đổi thành công" };
  },

  /**
   * Đăng xuất khỏi phiên cụ thể
   * @param {String} sessionId - ID phiên đăng nhập
   * @param {String} userId - ID người dùng
   * @param {String} currentToken - Token hiện tại
   * @returns {Object} - Kết quả đăng xuất
   */
  logoutSession: async (sessionId, userId, currentToken) => {
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

    // Kiểm tra xem đây có phải là phiên hiện tại hay không
    const isCurrentSession = currentToken && session.token === currentToken;

    return {
      isCurrentSession,
      message: "Đã đăng xuất khỏi phiên này",
    };
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
    return result.modifiedCount || 0; // Sử dụng modifiedCount thay vì nModified
  },
};

/**
 * Kiểm tra xem người dùng có phải là admin không
 * @param {String} token - Token từ header
 * @returns {Promise<Boolean>} - Trả về true nếu là admin, false nếu không
 */
const isAdmin = async (token) => {
  if (token && token.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      return user && user.role === "admin";
    } catch (error) {
      console.log("Token verification failed:", error);
      return false; // Nếu token không hợp lệ, trả về false
    }
  }
  return false; // Nếu không có token, trả về false
};

module.exports = {
  authService,
  isAdmin,
};
