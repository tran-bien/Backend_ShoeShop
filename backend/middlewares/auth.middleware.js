const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const Session = require("../models/session.model");
const asyncHandler = require("express-async-handler");

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
    console.log("No token found");
    return res.status(401).json({
      success: false,
      message: "Không có quyền truy cập, vui lòng đăng nhập",
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token decoded:", decoded);

    // Lấy thông tin người dùng (bao gồm role)
    req.user = await User.findById(decoded.id).select("-password");
    console.log(
      "User found:",
      req.user ? req.user.email : "No user",
      "Role:",
      req.user ? req.user.role : "No role"
    );

    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    if (!req.user || !req.user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản của bạn đã bị vô hiệu hóa.",
      });
    }

    // Đặt token hiện tại
    req.token = token;

    // Tìm session hiện tại
    const session = await Session.findOne({
      user: req.user._id, // Sử dụng trường user (ObjectId) thay vì userId
      token: token,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      console.log("No active session found for token");

      // Kiểm tra xem có phải session đã hết hạn
      const expiredSession = await Session.findOne({
        user: req.user._id, // Sử dụng trường user thay vì userId
        token: token,
      });

      if (expiredSession) {
        if (!expiredSession.isActive) {
          return res.status(401).json({
            success: false,
            message: "Phiên đăng nhập đã bị đăng xuất, vui lòng đăng nhập lại",
          });
        } else if (expiredSession.expiresAt <= new Date()) {
          return res.status(401).json({
            success: false,
            message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại",
          });
        }
      }

      return res.status(401).json({
        success: false,
        message:
          "Không tìm thấy phiên đăng nhập hợp lệ. Vui lòng đăng nhập lại.",
      });
    }

    // Cập nhật thời gian hoạt động mới nhất
    session.lastActive = new Date();
    await session.save();

    req.session = session;
    console.log("User authenticated:", req.user.email);

    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({
      success: false,
      message: "Không có quyền truy cập, token không hợp lệ",
    });
  }
});

// Phân quyền truy cập
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập",
      });
    }
    next();
  };
};

// Middleware cho Admin
exports.admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403);
    throw new Error("Bạn không có quyền admin");
  }
};

// Middleware không yêu cầu đăng nhập nhưng vẫn lấy thông tin user nếu có
exports.optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  // Lấy token từ Authorization header hoặc từ cookie
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Nếu không có token, vẫn cho phép truy cập
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Lấy thông tin user
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      req.user = null;
      return next();
    }

    const session = await Session.findOne({
      user: user._id, // Sử dụng trường user thay vì userId
      token: token,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      req.user = null;
      return next();
    }

    // Cập nhật thời gian hoạt động mới nhất
    session.lastActive = new Date();
    await session.save();

    // Gắn thông tin user vào request
    req.user = user;
    req.session = session;

    next();
  } catch (error) {
    // Nếu có lỗi, vẫn cho phép truy cập nhưng không có thông tin user
    req.user = null;
    next();
  }
});
