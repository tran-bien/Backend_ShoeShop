const asyncHandler = require("express-async-handler");
const authService = require("@services/auth.service");

const authController = {
  /**
   * @desc    Đăng ký tài khoản mới
   * @route   POST /api/auth/register
   * @access  Public
   */
  register: asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  }),

  /**
   * @desc    Đăng nhập tài khoản
   * @route   POST /api/auth/login
   * @access  Public
   */
  login: asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    res.json(result);
  }),

  /**
   * @desc    Làm mới access token bằng refresh token
   * @route   POST /api/auth/refresh-token
   * @access  Public
   */
  refreshToken: asyncHandler(async (req, res) => {
    const result = await authService.refreshToken(req.body.refreshToken);
    res.json(result);
  }),

  /**
   * @desc    Đăng xuất tài khoản
   * @route   POST /api/auth/logout
   * @access  Public
   */
  logout: asyncHandler(async (req, res) => {
    const result = await authService.logout(req.body.refreshToken);
    res.json(result);
  }),

  /**
   * @desc    Yêu cầu đặt lại mật khẩu
   * @route   POST /api/auth/forgot-password
   * @access  Public
   */
  forgotPassword: asyncHandler(async (req, res) => {
    const result = await authService.forgotPassword(req.body.email);
    res.json(result);
  }),

  /**
   * @desc    Đặt lại mật khẩu bằng token
   * @route   POST /api/auth/reset-password
   * @access  Public
   */
  resetPassword: asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(
      req.body.token,
      req.body.password
    );
    res.json(result);
  }),

  /**
   * @desc    Xác thực email
   * @route   GET /api/auth/verify-email
   * @access  Public
   */
  verifyEmail: asyncHandler(async (req, res) => {
    const result = await authService.verifyEmail(req.query.token);
    res.json(result);
  }),
};

module.exports = authController;
