const asyncHandler = require("express-async-handler");
const { authService } = require("@services/auth.service");

//  Admin: Lấy toàn bộ session của tất cả user
exports.getAllSessions = asyncHandler(async (req, res) => {
  const sessions = await authService.getAllSessions();
  res.json({ success: true, sessions });
});

//  Admin: Đăng xuất user bất kỳ khỏi tất cả thiết bị
exports.adminLogoutUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const count = await authService.logoutAll(userId);
  res.json({
    success: true,
    message: `Đã buộc đăng xuất ${count} phiên của user ${userId}`,
  });
});
