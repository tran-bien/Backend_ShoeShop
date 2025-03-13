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
const authService = require("../services/auth.service");

// Tạo token JWT
const generateToken = (id) => {
  return authService.generateToken(id);
};

// Tạo mã OTP ngẫu nhiên
const generateOTP = () => {
  return authService.generateOTP();
};

// Tạo refresh token
const generateRefreshToken = (id) => {
  return authService.generateRefreshToken(id);
};

// Tạo phiên đăng nhập mới
const createSession = async (userId, req, token, refreshToken) => {
  return await authService.createSession(userId, req, token, refreshToken);
};

// Đăng ký người dùng
exports.register = asyncHandler(async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Kiểm tra định dạng email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Email không hợp lệ hoặc không đúng định dạng",
      });
    }

    // Sử dụng authService để đăng ký
    const user = await authService.registerUser({
      name,
      email,
      password,
      phone,
    });

    // Tạo mã OTP
    const otp = authService.generateOTP();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // OTP hết hạn sau 10 phút

    // Cập nhật OTP cho user
    user.otp = {
      code: otp,
      expiredAt: otpExpiry,
    };
    await user.save();

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
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Đăng ký thất bại. Vui lòng thử lại sau.",
    });
  }
});

// Xác nhận OTP
exports.verifyOTP = asyncHandler(async (req, res) => {
  try {
    const { userId, email, otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mã OTP",
      });
    }

    if (!userId && !email) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp userId hoặc email",
      });
    }

    // Sử dụng authService để xác thực OTP
    const result = await authService.verifyOTP({ userId, email, otp });

    res.status(200).json({
      success: true,
      message: "Xác thực thành công!",
      token: result.token,
      refreshToken: result.refreshToken,
      user: {
        _id: result.user._id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Xác thực thất bại",
    });
  }
});

// Đăng nhập
exports.login = asyncHandler(async (req, res) => {
  try {
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

    // Sử dụng authService để đăng nhập
    const userData = await authService.loginUser(email, password, req);

    // Tạo JWT token và refresh token
    const token = authService.generateToken(userData.user._id);
    const refreshToken = authService.generateRefreshToken(userData.user._id);

    // Tạo phiên đăng nhập
    await authService.createSession(
      userData.user._id,
      req,
      token,
      refreshToken
    );

    // Lưu lịch sử đăng nhập thành công
    try {
      await LoginHistory.create({
        userId: userData.user._id,
        status: "success",
        ipAddress: req.ip || "Unknown",
        userAgent: req.headers["user-agent"] || "Unknown",
      });
    } catch (error) {
      console.error("Error creating login history:", error.message);
    }

    res.json({
      success: true,
      message: "Đăng nhập thành công",
      token,
      refreshToken,
      user: {
        _id: userData.user._id,
        name: userData.user.name,
        email: userData.user.email,
        phone: userData.user.phone,
        isAdmin: userData.user.isAdmin,
        isVerified: userData.user.isVerified,
        avatar: userData.user.avatar,
      },
    });
  } catch (error) {
    // Lưu lịch sử đăng nhập thất bại
    try {
      await LoginHistory.create({
        userId: null,
        status: "failed",
        reason: error.message,
        ipAddress: req.ip || "Unknown",
        userAgent: req.headers["user-agent"] || "Unknown",
      });
    } catch (historyError) {
      console.error("Error creating login history:", historyError.message);
    }

    res.status(401).json({
      success: false,
      message: error.message || "Đăng nhập thất bại. Vui lòng thử lại.",
    });
  }
});

// Thêm endpoint để làm mới token
exports.refreshToken = asyncHandler(async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res
        .status(401)
        .json({ success: false, message: "Refresh token không hợp lệ" });
    }

    // Sử dụng authService để làm mới token
    const result = await authService.refreshToken(refreshToken, req);

    res.json({
      success: true,
      accessToken: result.token,
    });
  } catch (error) {
    res.status(403).json({
      success: false,
      message: error.message || "Refresh token không hợp lệ",
    });
  }
});

// Quên mật khẩu
exports.forgotPassword = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;

    // Kiểm tra định dạng email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Email không hợp lệ hoặc không đúng định dạng",
      });
    }

    // Sử dụng authService để xử lý quên mật khẩu
    const result = await authService.forgotPassword(email);

    // Gửi email đặt lại mật khẩu
    await emailUtils.sendPasswordResetEmail(
      result.user.email,
      result.user.name,
      result.resetToken
    );

    res.status(200).json({
      success: true,
      message: "Email hướng dẫn đặt lại mật khẩu đã được gửi!",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Lỗi khi gửi email đặt lại mật khẩu",
    });
  }
});

// Đặt lại mật khẩu
exports.resetPassword = asyncHandler(async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp token và mật khẩu mới",
      });
    }

    // Sử dụng authService để đặt lại mật khẩu
    await authService.resetPassword(token, password);

    res.status(200).json({
      success: true,
      message: "Mật khẩu đã được đặt lại thành công!",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Token không hợp lệ hoặc đã hết hạn",
    });
  }
});

// Đổi mật khẩu
exports.changePassword = asyncHandler(async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới",
      });
    }

    // Sử dụng authService để đổi mật khẩu
    await authService.changePassword(req.user.id, currentPassword, newPassword);

    res.status(200).json({
      success: true,
      message: "Mật khẩu đã được thay đổi thành công!",
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.message || "Không thể thay đổi mật khẩu",
    });
  }
});

// Lấy danh sách phiên đăng nhập hiện tại
exports.getCurrentSessions = asyncHandler(async (req, res) => {
  try {
    const sessions = await authService.getCurrentSessions(
      req.user._id,
      req.session._id
    );

    res.json({
      success: true,
      sessions: sessions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách phiên đăng nhập",
      error: error.message,
    });
  }
});

// Đăng xuất khỏi phiên cụ thể
exports.logoutSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  // Kiểm tra sessionId
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp ID phiên đăng nhập",
    });
  }

  try {
    // Sử dụng authService để đăng xuất khỏi phiên
    const result = await authService.logoutSession(sessionId, req.user._id);

    res.json({
      success: true,
      message: result.message,
      currentSession: result.isCurrentSession,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Lỗi khi đăng xuất khỏi phiên đăng nhập",
    });
  }
});

// Đăng xuất khỏi tất cả phiên trừ phiên hiện tại
exports.logoutAllOtherSessions = asyncHandler(async (req, res) => {
  try {
    // Sử dụng authService để đăng xuất khỏi tất cả phiên khác
    await authService.logoutAll(req.user._id);

    res.json({
      success: true,
      message: "Đã đăng xuất khỏi tất cả các thiết bị khác",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi đăng xuất khỏi các thiết bị khác",
      error: error.message,
    });
  }
});

// Đăng xuất
exports.logout = asyncHandler(async (req, res) => {
  try {
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

    // Sử dụng authService để đăng xuất
    await authService.logout(req.user.id, token);

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
