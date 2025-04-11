const asyncHandler = require("express-async-handler");
const authService = require("@services/auth.service");

const authController = {
  /**
   * @desc    Đăng ký người dùng
   * @route   POST /api/auth/register
   * @access  Public
   */
  register: asyncHandler(async (req, res) => {
    const result = await authService.registerUser(req.body);
    res.status(201).json({
      success: true,
      message: "Đăng ký thành công",
      data: result,
    });
  }),

  /**
   * @desc    Xác nhận OTP
   * @route   POST /api/auth/verify-otp
   * @access  Public
   */
  verifyOTP: asyncHandler(async (req, res) => {
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
  }),

  /**
   * @desc    Đăng nhập
   * @route   POST /api/auth/login
   * @access  Public
   */
  login: asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password, req);
    res.json({
      success: true,
      message: "Đăng nhập thành công",
      data: result,
    });
  }),

  /**
   * @desc    Làm mới token
   * @route   POST /api/auth/refresh-token
   * @access  Public
   */
  refreshToken: asyncHandler(async (req, res) => {
    const result = await authService.refreshToken(req.body.refreshToken);
    res.json({
      success: true,
      accessToken: result.token,
    });
  }),

  /**
   * @desc    Quên mật khẩu
   * @route   POST /api/auth/forgot-password
   * @access  Public
   */
  forgotPassword: asyncHandler(async (req, res) => {
    const result = await authService.forgotPassword(req.body.email);
    res.json({
      success: true,
      message: result.message,
    });
  }),

  /**
   * @desc    Đặt lại mật khẩu
   * @route   POST /api/auth/reset-password
   * @access  Public
   */
  resetPassword: asyncHandler(async (req, res) => {
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
  }),

  /**
   * @desc    Đổi mật khẩu
   * @route   POST /api/auth/change-password
   * @access  Private
   */
  changePassword: asyncHandler(async (req, res) => {
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
  }),

  /**
   * @desc    Lấy danh sách phiên đăng nhập hiện tại
   * @route   GET /api/auth/sessions
   * @access  Private
   */
  getCurrentSessions: asyncHandler(async (req, res) => {
    const sessions = await authService.getCurrentSessions(
      req.user._id,
      req.token
    );
    res.json({
      success: true,
      sessions: sessions,
    });
  }),

  /**
   * @desc    Đăng xuất khỏi phiên cụ thể
   * @route   DELETE /api/auth/sessions/:sessionId
   * @access  Private
   */
  logoutSession: asyncHandler(async (req, res) => {
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
  }),

  /**
   * @desc    Đăng xuất khỏi tất cả phiên trừ phiên hiện tại
   * @route   DELETE /api/auth/sessions
   * @access  Private
   */
  logoutAllOtherSessions: asyncHandler(async (req, res) => {
    const count = await authService.logoutAllOtherSessions(
      req.user._id,
      req.token
    );
    res.json({
      success: true,
      message: `Đã đăng xuất khỏi ${count} phiên trên các thiết bị khác`,
    });
  }),

  /**
   * @desc    Đăng xuất
   * @route   POST /api/auth/logout
   * @access  Private
   */
  logout: asyncHandler(async (req, res) => {
    const result = await authService.logout(req.user._id, req.token);
    res.json({
      success: true,
      message: result.message || "Đăng xuất thành công",
    });
  }),

  /**
   * @desc    Đăng xuất khỏi tất cả các thiết bị
   * @route   DELETE /api/auth/logout-all
   * @access  Private
   */
  logoutAll: asyncHandler(async (req, res) => {
    const count = await authService.logoutAll(req.user._id);
    res.json({
      success: true,
      message: `Đã đăng xuất thành công khỏi tất cả thiết bị (${count} phiên)`,
    });
  }),
};

module.exports = authController;
