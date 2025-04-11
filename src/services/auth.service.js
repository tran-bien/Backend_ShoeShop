const jwt = require("jsonwebtoken");
const { User, Session } = require("@models");
const crypto = require("crypto");
const emailUtils = require("@utils/email");
const bcrypt = require("bcryptjs");
const uaParser = require("ua-parser-js");
const { limitActiveSessions } = require("./session.service");
const ApiError = require("@utils/ApiError");

const authService = {
  /**
   * Tạo mã JWT token
   * @param {String} id - ID người dùng
   * @returns {String} - JWT token
   */
  generateToken: (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "10d",
    });
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
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "30d" }
    );
  },

  /**
   * Tạo và quản lý phiên đăng nhập cho người dùng
   * @param {String} userId - ID người dùng
   * @param {Object} req - Request object
   * @returns {Object} - Đối tượng phiên đăng nhập
   */
  manageUserSession: async (userId, req) => {
    const token = authService.generateToken(userId);
    const refreshToken = authService.generateRefreshToken(userId);

    const userAgent = req.headers["user-agent"] || "Không xác định";
    const ip = req.ip || req.connection.remoteAddress || "Không xác định";
    const parsedDevice = uaParser(userAgent);

    // Tìm session hiện tại theo thiết bị
    const existingSession = await Session.findOne({
      user: userId,
      userAgent,
      ip,
      isActive: true,
    });

    if (existingSession) {
      // Cập nhật session đã có
      existingSession.token = token;
      existingSession.refreshToken = refreshToken;
      existingSession.lastActive = new Date();
      existingSession.expiresAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      );
      await existingSession.save();

      console.log(
        `Cập nhật session cho user ${userId}, thiết bị: ${userAgent.substring(
          0,
          30
        )}...`
      );
      return { token, refreshToken, session: existingSession };
    }

    // Tạo session mới nếu không tìm thấy
    const newSession = await Session.create({
      user: userId,
      token,
      refreshToken,
      userAgent,
      ip,
      device: parsedDevice,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
      lastActive: new Date(),
    });

    console.log(
      `Tạo mới session cho user ${userId}, thiết bị: ${userAgent.substring(
        0,
        30
      )}...`
    );
    await limitActiveSessions(userId, 5); // Giới hạn tối đa 5 session active
    return { token, refreshToken, session: newSession };
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
   * Tạo hoặc cập nhật phiên đăng nhập
   * @param {String} userId - ID người dùng
   * @param {String} token - JWT token
   * @param {String} refreshToken - Refresh token
   * @param {Object} req - Request object (nếu cần)
   * @returns {Object} - Đối tượng phiên
   */
  createSession: async (userId, token, refreshToken, req = {}) => {
    const existingSession = await Session.findOne({ user: userId, token });
    if (existingSession) {
      existingSession.isActive = true;
      existingSession.lastActive = Date.now();
      await existingSession.save();
      return existingSession;
    }

    const userAgent = req.headers["user-agent"] || "Không xác định";
    const ip = req.ip || req.connection.remoteAddress || "Không xác định";
    const parsedDevice = uaParser(userAgent) || {
      ua: "Không xác định",
      browser: { name: "Không xác định", version: "Không xác định" },
      os: { name: "Không xác định", version: "Không xác định" },
      device: {
        type: "Không xác định",
        model: "Không xác định",
        vendor: "Không xác định",
      },
    };

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return await Session.create({
      user: userId,
      token,
      refreshToken,
      userAgent,
      ip,
      device: parsedDevice,
      expiresAt,
      isActive: true,
      lastActive: new Date(),
    });
  },

  /**
   * So sánh mật khẩu với mật khẩu đã hash
   * @param {String} password - Mật khẩu chưa hash
   * @param {String} hashedPassword - Mật khẩu đã hash
   * @returns {Boolean} - Kết quả so sánh
   */
  verifyPassword: async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
  },

  /**
   * Tạo token khôi phục mật khẩu
   * @returns {Object} - Token khôi phục mật khẩu và token đã hash
   */
  generateResetPasswordToken: () => {
    // Tạo token ngẫu nhiên
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Hash và lưu token
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    return { resetToken, hashedToken };
  },

  /**
   * Đăng ký người dùng mới
   * @param {Object} userData - Thông tin người dùng mới
   * @returns {Object} - Thông tin người dùng đã đăng ký
   */
  registerUser: async (userData) => {
    const { name, email, password } = userData;

    // Kiểm tra nếu email đã tồn tại
    let user = await User.findOne({ email });
    if (user) {
      if (!user.isVerified) {
        // Nếu người dùng chưa xác thực, cập nhật mã OTP mới và gửi lại email xác thực
        const otpCode = authService.generateOTP();
        user.otp = {
          code: otpCode,
          expiredAt: Date.now() + 10 * 60 * 1000, // Hết hạn sau 10 phút
        };
        await user.save();
        await emailUtils.sendVerificationEmail(user.email, user.name, otpCode);
        console.log(
          "Người dùng đã tồn tại nhưng chưa xác thực. Đã gửi lại mã OTP:",
          otpCode
        );
        return user;
      }
      // Nếu người dùng đã xác thực, trả về lỗi
      throw new ApiError(409, "Email đã được đăng ký");
    }

    // Nếu email chưa tồn tại, tạo mới người dùng
    const otpCode = authService.generateOTP();
    console.log("mã otp được tạo:", otpCode); // Để debug

    user = await User.create({
      name,
      email,
      password, // Middleware sẽ tự động hash khi save
      isVerified: false,
      otp: {
        code: otpCode,
        expiredAt: Date.now() + 10 * 60 * 1000, // Hết hạn sau 10 phút
      },
    });

    await emailUtils.sendVerificationEmail(
      user.email,
      user.name,
      user.otp.code
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
    // Tìm user theo email
    const user = await User.findOne({ email });

    // Kiểm tra email có tồn tại không
    if (!user) {
      throw new ApiError(404, "Email không tồn tại");
    }

    // Kiểm tra tài khoản có bị khóa không
    if (!user.isActive || user.blockedAt) {
      const blockReason = user.blockReason
        ? `Lý do: ${user.blockReason}`
        : "Vui lòng liên hệ quản trị viên để được hỗ trợ";

      throw new ApiError(403, `Tài khoản đã bị vô hiệu hóa. ${blockReason}`);
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

      throw new ApiError(
        403,
        "Email chưa được xác thực. Vui lòng kiểm tra email để xác thực"
      );
    }

    // Kiểm tra mật khẩu có đúng không
    const isPasswordMatch = await authService.verifyPassword(
      password,
      user.password
    );
    if (!isPasswordMatch) {
      throw new ApiError(401, "Mật khẩu không đúng");
    }

    const { token, refreshToken } = await authService.manageUserSession(
      user._id,
      req
    );

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      avatar: user.avatar,
      token,
      refreshToken,
    };
  },

  /**
   * Làm mới token
   * @param {String} refreshToken - Refresh token
   * @returns {Object} - Token mới
   */
  refreshToken: async (refreshToken) => {
    // Kiểm tra refresh token
    const session = await Session.findOne({ refreshToken, isActive: true });
    if (!session) {
      throw new ApiError(401, "Refresh token không hợp lệ hoặc đã hết hạn");
    }

    // Tìm người dùng
    const user = await User.findById(session.user);

    if (!user) {
      throw new ApiError(404, "Người dùng không tồn tại");
    }

    // Kiểm tra tài khoản có bị khóa không
    if (!user.isActive || user.blockedAt) {
      // Vô hiệu hóa session
      session.isActive = false;
      await session.save();

      throw new ApiError(403, "Tài khoản đã bị vô hiệu hóa");
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
   * Khởi tạo quy trình đặt lại mật khẩu
   * @param {String} email - Email người dùng
   * @returns {Object} - Thông tin token đặt lại mật khẩu
   */
  forgotPassword: async (email) => {
    // Tìm user
    const user = await User.findOne({ email });

    if (!user) {
      throw new ApiError(404, "Không tìm thấy tài khoản với email này");
    }

    // Kiểm tra tài khoản có bị khóa không
    if (!user.isActive || user.blockedAt) {
      throw new ApiError(
        403,
        "Tài khoản đã bị vô hiệu hóa, không thể đặt lại mật khẩu"
      );
    }

    // Tạo reset token và thiết lập thời gian hết hạn
    const { resetToken, hashedToken } =
      authService.generateResetPasswordToken();
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // Hết hạn sau 10 phút
    await user.save();

    console.log("Reset Password Token:", resetToken);
    await emailUtils.sendResetPasswordEmail(user.email, user.name, resetToken);
    return { message: "Email đặt lại mật khẩu đã được gửi" };
  },

  /**
   * Đặt lại mật khẩu
   * @param {String} resetToken - Token đặt lại mật khẩu
   * @param {String} newPassword - Mật khẩu mới
   * @param {String} confirmPassword - Xác nhận mật khẩu
   * @returns {Object} - Kết quả đặt lại mật khẩu
   */
  resetPassword: async (resetToken, newPassword, confirmPassword) => {
    console.log("Bắt đầu quá trình đặt lại mật khẩu với token:", resetToken);

    // Hash token để khớp với cách nó được lưu trong database
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Tìm user với reset token đã hash
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      throw new ApiError(
        400,
        "Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn"
      );
    }

    console.log("Đã tìm thấy người dùng:", user.email);

    // Kiểm tra mật khẩu mới trùng với mật khẩu cũ không
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new ApiError(
        400,
        "Mật khẩu mới trùng với mật khẩu cũ. Vui lòng chọn mật khẩu khác!"
      );
    }

    // Gán mật khẩu mới trực tiếp (middleware sẽ hash khi save)
    user.password = newPassword;

    // Xóa reset token
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    // Lưu người dùng (middleware sẽ hash mật khẩu)
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
   * @returns {Object} - Kết quả thay đổi mật khẩu
   */
  changePassword: async (userId, currentPassword, newPassword) => {
    console.log("Bắt đầu quá trình thay đổi mật khẩu cho người dùng:", userId);

    // Kiểm tra người dùng
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "Không tìm thấy người dùng");
    }

    // Kiểm tra mật khẩu hiện tại
    const isPasswordMatch = await authService.verifyPassword(
      currentPassword,
      user.password
    );
    if (!isPasswordMatch) {
      throw new ApiError(
        401,
        "Mật khẩu hiện tại không đúng, không thể thay đổi mật khẩu"
      );
    }

    // Gán mật khẩu mới (middleware sẽ hash khi save)
    user.password = newPassword;
    await user.save();

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
      throw new ApiError(404, "Phiên đăng nhập không tồn tại");
    }

    // Kiểm tra quyền (chỉ có thể đăng xuất khỏi phiên của chính mình)
    if (session.user.toString() !== userId.toString()) {
      throw new ApiError(403, "Bạn không có quyền đăng xuất khỏi phiên này");
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
    return result.modifiedCount || 0;
  },

  /**
   * Xác thực OTP
   * @param {Object} data - Dữ liệu xác thực (userId hoặc email và OTP)
   * @returns {Object} - Thông tin người dùng và token
   */
  verifyOTP: async (data) => {
    const { userId, email, otp, req } = data;

    let user;
    // Tìm người dùng
    if (userId) {
      user = await User.findById(userId);
    } else if (email) {
      user = await User.findOne({ email });
    }

    if (!user) {
      throw new ApiError(404, "Người dùng không tồn tại");
    }

    // Kiểm tra tài khoản có bị khóa không
    if (!user.isActive || user.blockedAt) {
      throw new ApiError(403, "Tài khoản đã bị vô hiệu hóa");
    }

    if (!user.otp || user.otp.code !== otp) {
      throw new ApiError(400, "Mã OTP không hợp lệ");
    }

    if (new Date() > new Date(user.otp.expiredAt)) {
      throw new ApiError(400, "Mã OTP đã hết hạn");
    }

    user.isVerified = true;
    user.otp = undefined;
    await user.save();

    // Tạo phiên đăng nhập
    const { token, refreshToken, session } =
      await authService.manageUserSession(user._id, req);

    return { user, token, refreshToken };
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
    // Kiểm tra xem có phiên hiện tại không
    const session = await Session.findOne({
      user: userId,
      token: token,
      isActive: true,
    });

    if (!session) {
      return { success: true, message: "Đã đăng xuất thành công" };
    }

    // Vô hiệu hóa session
    session.isActive = false;
    await session.save();

    return { success: true, message: "Đăng xuất thành công" };
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

    return result.modifiedCount || 0;
  },

  /**
   * Lấy tất cả session đang hoạt động của mọi user (Admin)
   * @returns {Array} - Danh sách session
   */
  getAllSessions: async () => {
    return await Session.find({ isActive: true }).populate(
      "user",
      "name email role"
    );
  },
};

module.exports = authService;
