const { Session } = require("@models");

/**
 * Dọn dẹp session hết hạn và session không hoạt động
 * @returns {Promise<void>}
 */
async function cleanSessions() {
  try {
    const now = new Date();

    // 1. Xóa các session đã hết hạn
    const expiredResult = await Session.deleteMany({
      expiresAt: { $lte: now },
    });

    // 2. Xóa các session không còn active sau 2 ngày
    const TWO_DAYS_AGO = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const inactiveResult = await Session.deleteMany({
      isActive: false,
      updatedAt: { $lte: TWO_DAYS_AGO },
    });

    console.log(
      `[${now.toISOString().replace("T", " ").substring(0, 19)}] ` +
        `Đã dọn dẹp ${expiredResult.deletedCount} session hết hạn và ` +
        `${inactiveResult.deletedCount} session không hoạt động.`
    );
  } catch (error) {
    console.error("Lỗi khi dọn dẹp session:", error);
    throw error;
  }
}

/**
 * Xóa session cũ nếu người dùng có quá nhiều session active
 * @param {String} userId - ID người dùng
 * @param {Number} maxSessions - Số session tối đa cho phép
 */
async function limitActiveSessions(userId, maxSessions = 5) {
  try {
    // Lấy tất cả session active của user, sắp xếp theo thời gian hoạt động mới nhất
    const activeSessions = await Session.find({
      user: userId,
      isActive: true,
    }).sort({ lastActive: -1 });

    // Nếu số lượng session vượt quá giới hạn
    if (activeSessions.length > maxSessions) {
      // Lấy các session cũ để vô hiệu hóa
      const oldestSessions = activeSessions.slice(maxSessions);

      // Vô hiệu hóa các session cũ
      for (const session of oldestSessions) {
        session.isActive = false;
        await session.save();
      }

      console.log(
        `Đã vô hiệu hóa ${oldestSessions.length} session cũ của user ${userId}`
      );
    }
  } catch (error) {
    console.error("Lỗi khi giới hạn session:", error);
  }
}

// Xuất tất cả các hàm
module.exports = {
  cleanSessions,
  limitActiveSessions,
  cleanExpiredSessions: cleanSessions, // Giữ tương thích với code cũ
};
