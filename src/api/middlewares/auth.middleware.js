const jwt = require("jsonwebtoken");
// Tránh circular dependency bằng cách import trực tiếp
const User = require("../../models/user");
const Session = require("../../models/session");
const asyncHandler = require("express-async-handler");
const ApiError = require("@utils/ApiError");

// Bảo vệ các route yêu cầu đăng nhập
exports.protect = asyncHandler(async (req, res, next) => {
  const token = req.headers.authorization?.startsWith("Bearer")
    ? req.headers.authorization.split(" ")[1]
    : null;

  // Kiểm tra token
  if (!token) {
    throw new ApiError(401, "Không có quyền truy cập, vui lòng đăng nhập");
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Tìm người dùng
    const user = await User.findById(decoded.id).select("-password");

    // Không tìm thấy người dùng
    if (!user) {
      throw new ApiError(401, "Không tìm thấy người dùng");
    }

    // Người dùng bị khóa
    if (!user.isActive || user.blockedAt) {
      const blockReason = user.blockReason
        ? `Lý do: ${user.blockReason}`
        : "Vui lòng liên hệ quản trị viên để được hỗ trợ";

      throw new ApiError(
        401,
        `Tài khoản của bạn đã bị vô hiệu hóa. ${blockReason}`
      );
    }

    // Tìm session theo token chính xác
    const session = await Session.findOne({
      token,
      user: user._id,
      isActive: true,
    });

    // Nếu không có session hợp lệ
    if (!session) {
      throw new ApiError(
        401,
        "Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại"
      );
    }

    // Kiểm tra hết hạn
    if (new Date() > new Date(session.expiresAt)) {
      session.isActive = false;
      await session.save();
      throw new ApiError(
        401,
        "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại"
      );
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
    if (error instanceof ApiError) {
      throw error;
    }

    const errorMessage =
      error.name === "TokenExpiredError"
        ? "Token đã hết hạn, vui lòng đăng nhập lại"
        : "Token không hợp lệ, vui lòng đăng nhập lại";

    throw new ApiError(401, errorMessage);
  }
});

// Middleware cho Admin
exports.admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  throw new ApiError(403, "Bạn không có quyền admin");
};

// Middleware kiểm tra xác thực
exports.isAuthenticated = (req, res, next) => {
  if (!req.user) {
    throw new ApiError(401, "Bạn cần đăng nhập để thực hiện chức năng này");
  }
  next();
};
