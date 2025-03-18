const Session = require("../models/session");

async function cleanExpiredSessions() {
  try {
    const now = new Date();
    const result = await Session.deleteMany({ expiresAt: { $lte: now } });
    console.log(`Đã dọn dẹp ${result.deletedCount} session hết hạn.`);
  } catch (error) {
    console.error("Lỗi khi dọn dẹp session hết hạn:", error);
    throw error;
  }
}

module.exports = { cleanExpiredSessions };
