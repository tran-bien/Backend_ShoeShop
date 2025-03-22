const jwt = require("jsonwebtoken");
const { User, Session } = require("@models");
const asyncHandler = require("express-async-handler");

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

    // Tìm người dùng kể cả đã xóa mềm để phân biệt thông báo lỗi
    const user = await User.findOne({
      _id: decoded.id,
      includeDeleted: true, // Cho phép tìm cả người dùng đã xóa mềm
    }).select("-password");

    // Không tìm thấy người dùng
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    // Người dùng đã bị xóa mềm
    if (user.deletedAt) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản đã bị xóa khỏi hệ thống",
      });
    }

    // Người dùng bị khóa
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản của bạn đã bị vô hiệu hóa",
      });
    }

    // Tìm session theo token chính xác
    const session = await Session.findOne({
      token,
      user: user._id,
      isActive: true,
    });

    // Nếu không có session hợp lệ
    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại",
      });
    }

    // Kiểm tra hết hạn
    if (new Date() > new Date(session.expiresAt)) {
      session.isActive = false;
      await session.save();
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại",
      });
    }

    // Cập nhật thời gian hoạt động
    session.lastActive = new Date();
    await session.save();

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

// Middleware cho Admin (không cần thay đổi)
exports.admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: "Bạn không có quyền admin",
  });
};
