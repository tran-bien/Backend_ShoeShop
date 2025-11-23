const { Session } = require("@models");

/**
 * Dọn dẹp session không hoạt động (inactive sessions)
 *
 * NOTE: Expired sessions are automatically deleted by MongoDB TTL index every 60 seconds.
 * This function ONLY handles inactive sessions because TTL can't handle compound conditions.
 *
 * HYBRID CLEANUP STRATEGY:
 * - TTL Index: Deletes expired sessions (expiresAt <= now) automatically
 * - This function: Deletes inactive sessions (isActive=false AND updatedAt > 2 days)
 *
 * @returns {Promise<Object>} Cleanup statistics
 */
async function cleanSessions() {
  try {
    // Kiểm tra xem model Session có tồn tại không
    if (!Session) {
      console.error(
        "Model Session không tồn tại hoặc không được import đúng cách"
      );
      return { inactiveDeleted: 0 };
    }

    const now = new Date();

    // REMOVED: Expired session cleanup (TTL index handles this automatically)
    // MongoDB TTL index deletes expired sessions every 60 seconds with zero app overhead

    // ONLY: Delete inactive sessions (TTL can't handle compound conditions)
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

    if (inactiveResult.deletedCount > 0) {
      console.log(
        `[${now.toISOString().replace("T", " ").substring(0, 19)}] ` +
          `Đã dọn dẹp ${inactiveResult.deletedCount} session không hoạt động. ` +
          `(Session hết hạn được MongoDB TTL index tự động xóa mỗi 60 giây)`
      );
    }

    return {
      inactiveDeleted: inactiveResult.deletedCount,
      note: "Expired sessions are auto-deleted by MongoDB TTL index",
    };
  } catch (error) {
    console.error("Lỗi tổng thể khi dọn dẹp session:", error);
    return { inactiveDeleted: 0, error: error.message };
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
