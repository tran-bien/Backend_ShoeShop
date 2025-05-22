const asyncHandler = require("express-async-handler");
const userService = require("@services/user.service");

const profileController = {
  /**
   * @route   GET /api/users/profile
   * @desc    Lấy thông tin cá nhân
   * @access  Private
   */
  getUserProfile: asyncHandler(async (req, res) => {
    const { user } = req;
    const result = await userService.getUserProfile(user._id);

    res.json({
      success: true,
      user: result.user,
    });
  }),

  /**
   * @route   PUT /api/users/profile
   * @desc    Cập nhật thông tin cá nhân
   * @access  Private
   */
  updateUserProfile: asyncHandler(async (req, res) => {
    const { user } = req;
    const userData = req.body;

    const result = await userService.updateUserProfile(user._id, userData);

    res.json({
      success: true,
      message: result.message,
      user: result.user,
    });
  }),

  /**
   * @route   GET /api/users/addresses
   * @desc    Lấy danh sách địa chỉ
   * @access  Private
   */
  getUserAddresses: asyncHandler(async (req, res) => {
    const { user } = req;
    const result = await userService.getUserAddresses(user._id);

    res.json({
      success: true,
      addresses: result.addresses,
    });
  }),

  /**
   * @route   POST /api/users/addresses
   * @desc    Thêm địa chỉ mới
   * @access  Private
   */
  addUserAddress: asyncHandler(async (req, res) => {
    const { user } = req;
    const addressData = req.body;

    const result = await userService.addUserAddress(user._id, addressData);

    res.status(201).json({
      success: true,
      message: result.message,
      address: result.address,
    });
  }),

  /**
   * @route   PUT /api/users/addresses/:id
   * @desc    Cập nhật địa chỉ
   * @access  Private
   */
  updateUserAddress: asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;
    const addressData = req.body;

    const result = await userService.updateUserAddress(
      user._id,
      id,
      addressData
    );

    res.json({
      success: true,
      message: result.message,
      address: result.address,
    });
  }),

  /**
   * @route   DELETE /api/users/addresses/:id
   * @desc    Xóa địa chỉ
   * @access  Private
   */
  deleteUserAddress: asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;

    const result = await userService.deleteUserAddress(user._id, id);

    res.json({
      success: true,
      message: result.message,
    });
  }),

  /**
   * @route   PUT /api/users/addresses/:id/default
   * @desc    Đặt địa chỉ mặc định
   * @access  Private
   */
  setDefaultAddress: asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;

    const result = await userService.setDefaultAddress(user._id, id);

    res.json({
      success: true,
      message: result.message,
    });
  }),
};

module.exports = profileController;
