const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const randomstring = require("randomstring");
const asyncHandler = require("express-async-handler");
const User = require("../models/user.model");
const LoginHistory = require("../models/login.history.model");
const emailUtils = require("../utils/email");
const { uploadImage } = require("../utils/cloudinary");
const Session = require("../models/session.model");
const UAParser = require("ua-parser-js");

// Tạo token JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// Tạo mã OTP ngẫu nhiên
const generateOTP = () => {
  return randomstring.generate({
    length: 6,
    charset: "numeric",
  });
};

// Tạo refresh token
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });
};

// Tạo phiên đăng nhập mới
const createSession = async (userId, req, token, refreshToken) => {
  try {
    // Parse user agent để lấy thông tin thiết bị
    const parser = new UAParser(req.headers["user-agent"]);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();

    // Tính thời gian hết hạn
    const expiresIn = process.env.JWT_EXPIRES_IN || "30d";
    let expiresAt = new Date();

    if (expiresIn.includes("d")) {
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresIn));
    } else if (expiresIn.includes("h")) {
      expiresAt.setHours(expiresAt.getHours() + parseInt(expiresIn));
    } else {
      // Mặc định 30 ngày
      expiresAt.setDate(expiresAt.getDate() + 30);
    }

    // Tạo phiên mới
    return await Session.create({
      userId,
      token,
      refreshToken,
      deviceInfo: {
        deviceName: device.vendor
          ? `${device.vendor} ${device.model}`
          : "Unknown",
        deviceType: device.type || "desktop",
        browser: browser.name || "Unknown",
        os: `${os.name || ""} ${os.version || ""}`,
        ipAddress: req.ip || req.connection.remoteAddress,
      },
      expiresAt,
    });
  } catch (error) {
    console.error("Lỗi khi tạo phiên đăng nhập:", error);
    // Không throw lỗi, chỉ log - đảm bảo đăng nhập vẫn hoạt động nếu có lỗi
    return null;
  }
};

// Đăng ký người dùng
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  // Kiểm tra định dạng email
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Email không hợp lệ hoặc không đúng định dạng",
    });
  }

  // Kiểm tra email đã tồn tại chưa
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: "Email đã được sử dụng",
    });
  }

  // Tạo mã OTP
  const otp = generateOTP();
  const otpExpiry = new Date();
  otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // OTP hết hạn sau 10 phút

  // Tạo người dùng mới
  const user = await User.create({
    name,
    email,
    password,
    otp: {
      code: otp,
      expiredAt: otpExpiry,
    },
  });

  try {
    // Gửi email xác nhận
    await emailUtils.sendVerificationEmail(email, name, otp);
  } catch (error) {
    console.error("Error sending verification email:", error);
    // Ghi log lỗi nhưng vẫn cho đăng ký thành công
  }

  res.status(201).json({
    success: true,
    message:
      "Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.",
    userId: user._id,
    // trả về OTP trong response (chỉ cho môi trường phát triển)
    otp: process.env.NODE_ENV === "production" ? undefined : otp,
  });
});

// Xác nhận OTP
exports.verifyOTP = asyncHandler(async (req, res) => {
  const { userId, email, otp } = req.body;

  let user;

  // Tìm user bằng userId hoặc email
  if (userId) {
    user = await User.findById(userId);
  } else if (email) {
    user = await User.findOne({ email });
  } else {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp userId hoặc email",
    });
  }

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Người dùng không tồn tại",
    });
  }

  // Kiểm tra OTP
  if (!user.otp || user.otp.code !== otp) {
    return res.status(400).json({
      success: false,
      message: "Mã OTP không hợp lệ",
    });
  }

  // Kiểm tra thời hạn OTP
  if (new Date() > new Date(user.otp.expiredAt)) {
    return res.status(400).json({
      success: false,
      message: "Mã OTP đã hết hạn",
    });
  }

  // Xác nhận người dùng
  user.isVerified = true;
  user.otp = undefined;
  await user.save();

  // Tạo token
  const token = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id); // Tạo refresh token

  // Lưu refreshToken vào cơ sở dữ liệu (nếu cần)
  user.refreshToken = refreshToken;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Xác thực thành công!",
    token,
    refreshToken, // Trả về refresh token
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// Đăng nhập
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Kiểm tra email và mật khẩu
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp email và mật khẩu",
    });
  }

  // Kiểm tra định dạng email
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    try {
      await LoginHistory.create({
        userId: null,
        status: "failed",
        reason: "Email không đúng định dạng",
        ipAddress: req.ip || "Unknown",
        userAgent: req.headers["user-agent"] || "Unknown",
      });
    } catch (error) {
      console.error("Error creating login history:", error.message);
    }

    return res.status(400).json({
      success: false,
      message: "Email không đúng định dạng",
    });
  }

  // Tìm người dùng
  const user = await User.findOne({ email });
  if (!user) {
    // Lưu lịch sử đăng nhập thất bại
    try {
      await LoginHistory.create({
        userId: null,
        status: "failed",
        reason: "Email chưa được đăng ký trong hệ thống",
        ipAddress: req.ip || "Unknown",
        userAgent: req.headers["user-agent"] || "Unknown",
      });
    } catch (error) {
      // Bỏ qua lỗi khi tạo LoginHistory
      console.error("Error creating login history:", error.message);
    }

    return res.status(401).json({
      success: false,
      message: "Email chưa được đăng ký trong hệ thống",
    });
  }

  // Kiểm tra trạng thái tài khoản
  if (!user.isActive) {
    await LoginHistory.create({
      userId: user._id,
      status: "failed",
      reason: "Tài khoản bị khóa",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(401).json({
      success: false,
      message:
        "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ với quản trị viên.",
    });
  }

  // Kiểm tra mật khẩu
  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    await LoginHistory.create({
      userId: user._id,
      status: "failed",
      reason: "Mật khẩu không đúng",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(401).json({
      success: false,
      message: "Mật khẩu không đúng",
    });
  }

  // Kiểm tra xác thực
  if (!user.isVerified) {
    // Tạo OTP mới
    const otp = generateOTP();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);

    user.otp = {
      code: otp,
      expiredAt: otpExpiry,
    };
    await user.save();

    // Gửi email xác nhận
    await emailUtils.sendVerificationEmail(user.email, user.name, otp);

    return res.status(403).json({
      success: false,
      message:
        "Tài khoản chưa được xác thực. Vui lòng kiểm tra email để xác thực tài khoản.",
      userId: user._id,
    });
  }

  // Tạo token
  const token = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id); // Tạo refresh token

  // Lưu refreshToken vào cơ sở dữ liệu (nếu cần)
  user.refreshToken = refreshToken;
  await user.save();

  try {
    // Tạo session và lưu vào database
    const session = await createSession(user._id, req, token, refreshToken);

    // Lưu lịch sử đăng nhập thành công
    await LoginHistory.create({
      userId: user._id,
      status: "success",
      ipAddress: req.ip || "Unknown",
      userAgent: req.headers["user-agent"] || "Unknown",
      browser: req.headers["user-agent"]
        ? req.headers["user-agent"].split("/")[0]
        : "Unknown",
      device: req.headers["user-agent"] || "Unknown",
    });

    // Trả về thông tin user và token
    return res.json({
      success: true,
      token,
      refreshToken, // Trả về refresh token
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          phone: user.phone,
        },
        session,
      },
    });
  } catch (error) {
    console.error("Error creating session:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi tạo phiên đăng nhập",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Thêm endpoint để làm mới token
exports.refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res
      .status(401)
      .json({ success: false, message: "Refresh token không hợp lệ" });
  }

  // Kiểm tra refreshToken
  const user = await User.findOne({ refreshToken });
  if (!user) {
    return res
      .status(403)
      .json({ success: false, message: "Refresh token không hợp lệ" });
  }

  // Tạo accessToken mới
  const accessToken = generateToken(user._id);

  res.json({
    success: true,
    accessToken,
  });
});

// Quên mật khẩu
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Kiểm tra định dạng email
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Email không hợp lệ hoặc không đúng định dạng",
    });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy người dùng với email này",
    });
  }

  // Tạo token đặt lại mật khẩu
  const resetToken = crypto.randomBytes(32).toString("hex");
  user.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 phút

  await user.save();

  // Gửi email đặt lại mật khẩu
  try {
    await emailUtils.sendPasswordResetEmail(user.email, user.name, resetToken);

    res.status(200).json({
      success: true,
      message: "Email hướng dẫn đặt lại mật khẩu đã được gửi!",
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(500).json({
      success: false,
      message: "Không thể gửi email. Vui lòng thử lại sau!",
    });
  }
});

// Đặt lại mật khẩu
exports.resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, password } = req.body;

  // Mã hóa token
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: "Token không hợp lệ hoặc đã hết hạn",
    });
  }

  // Kiểm tra xem mật khẩu mới có trùng với mật khẩu cũ không
  const isPasswordMatch = await user.comparePassword(password);
  if (isPasswordMatch) {
    return res.status(400).json({
      success: false,
      message: "Mật khẩu mới không được trùng với mật khẩu cũ",
    });
  }

  // Cập nhật mật khẩu
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Mật khẩu đã được đặt lại thành công!",
  });
});

// Đổi mật khẩu
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id);

  // Kiểm tra mật khẩu hiện tại
  const isPasswordMatch = await user.comparePassword(currentPassword);
  if (!isPasswordMatch) {
    return res.status(401).json({
      success: false,
      message: "Mật khẩu hiện tại không đúng",
    });
  }

  // Cập nhật mật khẩu
  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Mật khẩu đã được thay đổi thành công!",
  });
});

// Lấy danh sách phiên đăng nhập hiện tại
exports.getCurrentSessions = asyncHandler(async (req, res) => {
  const sessions = await Session.find({
    userId: req.user._id,
    isActive: true,
    expiresAt: { $gt: new Date() },
  }).sort({ lastActive: -1 });

  // Đánh dấu phiên hiện tại
  const currentSessionId = req.session._id;
  const sessionsWithCurrentFlag = sessions.map((session) => {
    const sessionObj = session.toObject();
    sessionObj.isCurrentSession =
      session._id.toString() === currentSessionId.toString();
    return sessionObj;
  });

  res.json({
    success: true,
    sessions: sessionsWithCurrentFlag,
  });
});

// Đăng xuất khỏi phiên cụ thể
exports.logoutSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  // Kiểm tra sessionId
  if (!sessionId) {
    console.error("Không có sessionId được cung cấp");
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp ID phiên đăng nhập",
    });
  }

  console.log("Đang cố gắng đăng xuất khỏi phiên:", sessionId);

  try {
    // Kiểm tra quyền (chỉ có thể đăng xuất khỏi phiên của chính mình)
    const session = await Session.findById(sessionId);

    if (!session) {
      console.log("Không tìm thấy phiên với ID:", sessionId);
      return res.status(404).json({
        success: false,
        message: "Phiên đăng nhập không tồn tại",
      });
    }

    if (session.userId.toString() !== req.user._id.toString()) {
      console.log("Người dùng không có quyền đăng xuất khỏi phiên này");
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền đăng xuất khỏi phiên này",
      });
    }

    // Nếu đăng xuất khỏi phiên hiện tại
    if (session._id.toString() === req.session._id.toString()) {
      console.log("Đăng xuất khỏi phiên hiện tại");
      session.isActive = false;
      await session.save();

      return res.json({
        success: true,
        message: "Đã đăng xuất khỏi phiên hiện tại",
        currentSession: true,
      });
    }

    // Nếu đăng xuất khỏi phiên khác
    console.log("Đăng xuất khỏi phiên khác");
    session.isActive = false;
    await session.save();

    res.json({
      success: true,
      message: "Đã đăng xuất khỏi phiên này",
    });
  } catch (error) {
    console.error("Lỗi khi đăng xuất khỏi phiên:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi đăng xuất khỏi phiên đăng nhập",
      error: error.message,
    });
  }
});

// Đăng xuất khỏi tất cả phiên trừ phiên hiện tại
exports.logoutAllOtherSessions = asyncHandler(async (req, res) => {
  await Session.updateMany(
    {
      userId: req.user._id,
      _id: { $ne: req.session._id },
      isActive: true,
    },
    { isActive: false }
  );

  res.json({
    success: true,
    message: "Đã đăng xuất khỏi tất cả các thiết bị khác",
  });
});

// Đăng xuất
exports.logout = asyncHandler(async (req, res) => {
  // Lấy token từ header
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Không có token, không thể đăng xuất",
    });
  }

  try {
    // Tìm session với token này
    const session = await Session.findOne({ token, isActive: true });

    if (session) {
      // Đánh dấu session là không còn hoạt động
      session.isActive = false;
      await session.save();
    }

    res.status(200).json({
      success: true,
      message: "Đăng xuất thành công",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi đăng xuất",
      error: error.message,
    });
  }
});
