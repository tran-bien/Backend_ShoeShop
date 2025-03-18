const jwt = require("jsonwebtoken");
const { User, Session } = require("@models");
const asyncHandler = require("express-async-handler");
const uaParser = require("ua-parser-js");
const { authService } = require("@services/auth.service");

// Bảo vệ các route yêu cầu đăng nhập
exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  // Lấy token từ header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

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

    // Lấy thông tin người dùng (loại bỏ trường password)
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản của bạn đã bị vô hiệu hóa.",
      });
    }

    // Đặt token và user vào request
    req.token = token;
    req.user = user;

    // Lấy thông tin thiết bị từ uaParser
    const userAgent = req.headers["user-agent"] || "Không xác định";
    const ip = req.ip || req.connection.remoteAddress || "Không xác định";
    const parsedDevice = uaParser(userAgent);

    // Tìm phiên hiện tại
    const session = await Session.findOne({
      user: user._id,
      token: token,
      isActive: true,
    });

    if (!session) {
      // Tạo refresh token mới cho phiên này
      const newRefreshToken = authService.generateRefreshToken(user._id);
      const newSession = await Session.create({
        user: user._id,
        token,
        refreshToken: newRefreshToken,
        userAgent,
        ip,
        device: parsedDevice, // Gán thông tin thiết bị từ uaParser
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 ngày
        isActive: true,
        lastActive: new Date(),
      });
      req.session = newSession;
    } else {
      // Cập nhật thời gian hoạt động mới nhất
      session.lastActive = new Date();
      await session.save();
      req.session = session;
    }

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token đã hết hạn, vui lòng đăng nhập lại",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ, vui lòng đăng nhập lại",
    });
  }
});

// Middleware cho Admin
exports.admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Bạn không có quyền admin",
    });
  }
};

// Loại bỏ phương thức verifyToken vì không cần thiết
