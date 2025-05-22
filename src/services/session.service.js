const { Session } = require("@models");

/**
 * Dọn dẹp session hết hạn và session không hoạt động
 * @returns {Promise<void>}
 */
async function cleanSessions() {
  try {
    // Kiểm tra xem model Session có tồn tại không
    if (!Session) {
      console.error(
        "Model Session không tồn tại hoặc không được import đúng cách"
      );
      return;
    }

    const now = new Date();

    // 1. Xóa các session đã hết hạn
    let expiredResult = null;
    try {
      expiredResult = await Session.deleteMany({
        expiresAt: { $lte: now },
      });
    } catch (error) {
      console.error("Lỗi khi xóa session hết hạn:", error);
      expiredResult = { deletedCount: 0 };
    }

    // 2. Xóa các session không còn active sau 2 ngày
    const TWO_DAYS_AGO = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    let inactiveResult = null;
    try {
      inactiveResult = await Session.deleteMany({
        isActive: false,
        updatedAt: { $lte: TWO_DAYS_AGO },
      });
    } catch (error) {
      console.error("Lỗi khi xóa session không hoạt động:", error);
      inactiveResult = { deletedCount: 0 };
    }

    console.log(
      `[${now.toISOString().replace("T", " ").substring(0, 19)}] ` +
        `Đã dọn dẹp ${expiredResult.deletedCount} session hết hạn và ` +
        `${inactiveResult.deletedCount} session không hoạt động.`
    );
  } catch (error) {
    console.error("Lỗi tổng thể khi dọn dẹp session:", error);
    // Xử lý lỗi mà không throw để tránh crash ứng dụng
  }
}

/**
 * Xóa session cũ nếu người dùng có quá nhiều session active
 * @param {String} userId - ID người dùng
 * @param {Number} maxSessions - Số session tối đa cho phép
 */
async function limitActiveSessions(userId, maxSessions = 5) {
  try {
    // Kiểm tra xem model Session có tồn tại không
    if (!Session) {
      console.error(
        "Model Session không tồn tại hoặc không được import đúng cách"
      );
      return;
    }

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
const sessionService = {
  cleanSessions,
  limitActiveSessions,
  cleanExpiredSessions: cleanSessions,
};

module.exports = sessionService;
