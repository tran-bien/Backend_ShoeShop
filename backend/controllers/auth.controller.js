const asyncHandler = require("express-async-handler");
const { authService } = require("../services/auth.service");

// Đăng ký người dùng
exports.register = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body);
  res.status(201).json({
    success: true,
    message: "Đăng ký thành công",
    data: result,
  });
});

// Xác nhận OTP
exports.verifyOTP = asyncHandler(async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Gọi service để xác thực OTP
    const result = await authService.verifyOTP({ email, otp, req });

    // Nếu xác thực thành công, trả về token và thông tin người dùng
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

    const result = await authService.loginUser(email, password, req);

    res.json({
      success: true,
      message: "Đăng nhập thành công",
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi đăng nhập, vui lòng thử lại",
    });
  }
});

// Làm mới token
exports.refreshToken = asyncHandler(async (req, res) => {
  const result = await authService.refreshToken(req.body.refreshToken);
  res.json({
    success: true,
    accessToken: result.token,
  });
});

// Quên mật khẩu
exports.forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  res.json({
    success: true,
    message: "Email đặt lại mật khẩu đã được gửi",
    data: result,
  });
});

// Đặt lại mật khẩu
exports.resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, password, confirmPassword } = req.body;

  try {
    await authService.resetPassword(resetToken, password, confirmPassword);
    res.status(200).json({
      success: true,
      message: "Mật khẩu đã được đặt lại thành công",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi đặt lại mật khẩu, vui lòng thử lại",
    });
  }
});

// Đổi mật khẩu
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  // Kiểm tra mật khẩu mới và xác nhận mật khẩu
  if (!newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp mật khẩu mới và xác nhận mật khẩu",
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Mật khẩu mới và xác nhận mật khẩu không khớp",
    });
  }

  try {
    await authService.changePassword(
      req.user._id,
      currentPassword,
      newPassword
    );
    res.status(200).json({
      success: true,
      message: "Mật khẩu đã được thay đổi thành công",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi thay đổi mật khẩu, vui lòng thử lại",
    });
  }
});

// Lấy danh sách phiên đăng nhập hiện tại
exports.getCurrentSessions = asyncHandler(async (req, res) => {
  const sessions = await authService.getCurrentSessions(
    req.user._id,
    req.token
  );
  res.json({
    success: true,
    sessions: sessions,
  });
});

// Đăng xuất khỏi phiên cụ thể
exports.logoutSession = asyncHandler(async (req, res) => {
  const result = await authService.logoutSession(
    req.params.sessionId,
    req.user._id,
    req.token
  );
  res.json({
    success: true,
    message: result.message,
    currentSession: result.isCurrentSession,
  });
});

// Đăng xuất khỏi tất cả phiên trừ phiên hiện tại
exports.logoutAllOtherSessions = asyncHandler(async (req, res) => {
  const count = await authService.logoutAllOtherSessions(
    req.user._id,
    req.token
  );
  res.json({
    success: true,
    message: `Đã đăng xuất khỏi ${count} phiên trên các thiết bị khác`,
  });
});

// Đăng xuất
exports.logout = asyncHandler(async (req, res) => {
  try {
    const result = await authService.logout(req.user._id, req.token);

    res.json({
      success: true,
      message: result.message || "Đăng xuất thành công",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Không thể đăng xuất. Vui lòng thử lại sau.",
    });
  }
});

// Đăng xuất khỏi tất cả các thiết bị
exports.logoutAll = asyncHandler(async (req, res) => {
  const count = await authService.logoutAll(req.user._id);
  res.json({
    success: true,
    message: `Đã đăng xuất thành công khỏi tất cả thiết bị (${count} phiên)`,
  });
});
