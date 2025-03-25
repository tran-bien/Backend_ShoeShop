const asyncHandler = require("express-async-handler");
const { authService } = require("@services/auth.service");

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
  const { email, otp } = req.body;
  const result = await authService.verifyOTP({ email, otp, req });
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
});

// Đăng nhập
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.loginUser(email, password, req);
  res.json({
    success: true,
    message: "Đăng nhập thành công",
    data: result,
  });
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
    message: result.message,
  });
});

// Đặt lại mật khẩu
exports.resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, password, confirmPassword } = req.body;
  const result = await authService.resetPassword(
    resetToken,
    password,
    confirmPassword
  );
  res.status(200).json({
    success: true,
    message: result.message,
  });
});

// Đổi mật khẩu
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const result = await authService.changePassword(
    req.user._id,
    currentPassword,
    newPassword
  );
  res.status(200).json({
    success: true,
    message: result.message,
  });
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
  const result = await authService.logout(req.user._id, req.token);
  res.json({
    success: true,
    message: result.message || "Đăng xuất thành công",
  });
});

// Đăng xuất khỏi tất cả các thiết bị
exports.logoutAll = asyncHandler(async (req, res) => {
  const count = await authService.logoutAll(req.user._id);
  res.json({
    success: true,
    message: `Đã đăng xuất thành công khỏi tất cả thiết bị (${count} phiên)`,
  });
});
