const LoyaltyTransaction = require("../models/loyaltyTransaction");
const loyaltyService = require("@services/loyalty.service");

/**
 * Cronjob: Tự động expire các điểm hết hạn
 * Chạy mỗi ngày lúc 1:00 AM
 */
const expirePoints = async () => {
  try {
    console.log("[CRONJOB] Bắt đầu expire loyalty points...");

    const now = new Date();

    // Tìm các transactions đã hết hạn
    const expiredTransactions = await LoyaltyTransaction.find({
      type: "EARN",
      isExpired: false,
      expiresAt: { $lt: now },
    });

    if (expiredTransactions.length === 0) {
      console.log("[CRONJOB] Không có điểm nào hết hạn");
      return { success: true, expiredCount: 0 };
    }

    console.log(
      `[CRONJOB] Tìm thấy ${expiredTransactions.length} transaction(s) hết hạn`
    );

    let totalExpired = 0;

    for (const tx of expiredTransactions) {
      try {
        // Trừ điểm của user
        await loyaltyService.deductPoints(tx.user, tx.points, {
          type: "EXPIRE",
          source: tx.source,
          description: `Hết hạn ${tx.points} điểm từ ${tx.source}`,
        });

        // Đánh dấu đã expire
        tx.isExpired = true;
        await tx.save();

        totalExpired += tx.points;
      } catch (error) {
        console.error(
          `Lỗi khi expire transaction ${tx._id}:`,
          error.message
        );
      }
    }

    console.log(`[CRONJOB] Đã expire tổng ${totalExpired} điểm`);

    return {
      success: true,
      expiredCount: expiredTransactions.length,
      totalPoints: totalExpired,
    };
  } catch (error) {
    console.error("[CRONJOB ERROR] expirePoints:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Cronjob: Gửi thông báo điểm sắp hết hạn
 * Chạy mỗi tuần
 */
const remindExpiringPoints = async () => {
  try {
    console.log("[CRONJOB] Kiểm tra điểm sắp hết hạn...");

    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const expiringTransactions = await LoyaltyTransaction.find({
      type: "EARN",
      isExpired: false,
      expiresAt: { $lte: thirtyDaysFromNow, $gt: new Date() },
    })
      .populate("user", "email name")
      .sort({ expiresAt: 1 });

    if (expiringTransactions.length === 0) {
      console.log("[CRONJOB] Không có điểm nào sắp hết hạn");
      return { success: true, reminderCount: 0 };
    }

    // Group by user
    const userPointsMap = {};
    expiringTransactions.forEach((tx) => {
      const userId = tx.user._id.toString();
      if (!userPointsMap[userId]) {
        userPointsMap[userId] = {
          user: tx.user,
          points: 0,
          earliestExpiry: tx.expiresAt,
        };
      }
      userPointsMap[userId].points += tx.points;
    });

    console.log(
      `[CRONJOB] ${Object.keys(userPointsMap).length} user(s) có điểm sắp hết hạn`
    );

    // TODO: Gửi email/notification
    // for (const userId in userPointsMap) {
    //   const data = userPointsMap[userId];
    //   await notificationService.send(userId, "POINTS_EXPIRE_SOON", data);
    // }

    return {
      success: true,
      reminderCount: Object.keys(userPointsMap).length,
      users: Object.values(userPointsMap).map((d) => ({
        email: d.user.email,
        name: d.user.name,
        points: d.points,
        expiresAt: d.earliestExpiry,
      })),
    };
  } catch (error) {
    console.error("[CRONJOB ERROR] remindExpiringPoints:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Cronjob: Tính toán và cập nhật tier cho tất cả users
 * Chạy mỗi tuần
 */
const updateAllUserTiers = async () => {
  try {
    console.log("[CRONJOB] Cập nhật tier cho tất cả users...");

    const users = await User.find({ isActive: true });
    let updatedCount = 0;

    for (const user of users) {
      try {
        const result = await loyaltyService.updateUserTier(user._id);
        if (result?.tierChanged) {
          updatedCount++;
        }
      } catch (error) {
        console.error(`Lỗi update tier cho user ${user._id}:`, error.message);
      }
    }

    console.log(`[CRONJOB] Đã cập nhật tier cho ${updatedCount} user(s)`);

    return {
      success: true,
      updatedCount,
      totalUsers: users.length,
    };
  } catch (error) {
    console.error("[CRONJOB ERROR] updateAllUserTiers:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  expirePoints,
  remindExpiringPoints,
  updateAllUserTiers,
};

