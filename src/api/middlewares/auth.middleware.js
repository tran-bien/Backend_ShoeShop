const jwt = require("jsonwebtoken");
const { User, Session } = require("@models");
const asyncHandler = require("express-async-handler");
const uaParser = require("ua-parser-js");
const { authService } = require("@services/auth.service");

// Bảo vệ các route yêu cầu đăng nhập
exports.protect = asyncHandler(async (req, res, next) => {
  const token = req.headers.authorization?.startsWith("Bearer")
    ? req.headers.authorization.split(" ")[1]
    : null;

  // Kiểm tra token
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Không có quyền truy cập, vui lòng đăng nhập",
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: user
          ? "Tài khoản của bạn đã bị vô hiệu hóa."
          : "Không tìm thấy người dùng",
      });
    }

    // Lấy thông tin thiết bị từ uaParser
    const userAgent = req.headers["user-agent"] || "Không xác định";
    const ip = req.ip || req.connection.remoteAddress || "Không xác định";
    const parsedDevice = uaParser(userAgent);

    // Tìm session hiện tại hoặc tạo mới
    let session =
      (await Session.findOne({ user: user._id, token, isActive: true })) ||
      (await Session.findOne({
        user: user._id,
        isActive: true,
        userAgent,
        ip,
      }));

    if (session) {
      // Cập nhật session
      session.token = token;
      session.lastActive = new Date();
      await session.save();
    } else {
      // Tạo session mới
      const newRefreshToken = authService.generateRefreshToken(user._id);
      session = await Session.create({
        user: user._id,
        token,
        refreshToken: newRefreshToken,
        userAgent,
        ip,
        device: parsedDevice,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 ngày
        isActive: true,
        lastActive: new Date(),
      });
    }

    // Đặt session vào req
    req.token = token;
    req.user = user;
    req.session = session;

    next();
  } catch (error) {
    const errorMessage =
      error.name === "TokenExpiredError"
        ? "Token đã hết hạn, vui lòng đăng nhập lại"
        : "Token không hợp lệ, vui lòng đăng nhập lại";

    return res.status(401).json({
      success: false,
      message: errorMessage,
    });
  }
});

// Middleware cho Admin
exports.admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: "Bạn không có quyền admin",
  });
};
