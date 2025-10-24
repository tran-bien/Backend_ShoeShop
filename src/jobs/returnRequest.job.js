const { ReturnRequest } = require("../models");

/**
 * Cronjob: Tự động từ chối các yêu cầu đổi/trả quá hạn (7 ngày)
 * Chạy mỗi ngày lúc 2:00 AM
 */
const autoRejectExpiredRequests = async () => {
  try {
    console.log("[CRONJOB] Bắt đầu kiểm tra return requests quá hạn...");

    const now = new Date();

    // Tìm các requests pending quá hạn (expiresAt < now)
    const expiredRequests = await ReturnRequest.find({
      status: "pending",
      expiresAt: { $lt: now },
    });

    if (expiredRequests.length === 0) {
      console.log("[CRONJOB] Không có return request nào quá hạn");
      return {
        success: true,
        rejectedCount: 0,
      };
    }

    console.log(
      `[CRONJOB] Tìm thấy ${expiredRequests.length} return request(s) quá hạn`
    );

    // Update tất cả requests quá hạn
    const result = await ReturnRequest.updateMany(
      {
        status: "pending",
        expiresAt: { $lt: now },
      },
      {
        $set: {
          status: "rejected",
          rejectionReason:
            "Tự động từ chối do quá thời hạn xử lý (7 ngày kể từ khi tạo)",
          autoRejectedAt: now,
        },
      }
    );

    console.log(
      `[CRONJOB] Đã tự động từ chối ${result.modifiedCount} return request(s)`
    );

    return {
      success: true,
      rejectedCount: result.modifiedCount,
      expiredRequests: expiredRequests.map((r) => ({
        id: r._id,
        order: r.order,
        customer: r.customer,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      })),
    };
  } catch (error) {
    console.error("[CRONJOB ERROR] autoRejectExpiredRequests:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Cronjob: Cleanup các return requests đã hoàn thành quá 90 ngày
 * Soft delete để giảm kích thước database
 * Chạy mỗi tuần
 */
const cleanupOldCompletedRequests = async () => {
  try {
    console.log("[CRONJOB] Bắt đầu cleanup return requests cũ...");

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const result = await ReturnRequest.updateMany(
      {
        status: { $in: ["completed", "rejected", "canceled"] },
        updatedAt: { $lt: ninetyDaysAgo },
        deletedAt: null, // Chưa bị xóa
      },
      {
        $set: {
          deletedAt: new Date(),
        },
      }
    );

    console.log(
      `[CRONJOB] Đã soft delete ${result.modifiedCount} return request(s) cũ`
    );

    return {
      success: true,
      deletedCount: result.modifiedCount,
    };
  } catch (error) {
    console.error("[CRONJOB ERROR] cleanupOldCompletedRequests:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Cronjob: Gửi nhắc nhở cho admin về các return requests pending
 * Chạy mỗi ngày lúc 9:00 AM
 */
const remindPendingRequests = async () => {
  try {
    console.log("[CRONJOB] Kiểm tra return requests cần xử lý...");

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Tìm các requests pending > 3 ngày
    const pendingRequests = await ReturnRequest.find({
      status: "pending",
      createdAt: { $lt: threeDaysAgo },
    })
      .populate("customer", "name email")
      .populate("order", "code");

    if (pendingRequests.length === 0) {
      console.log("[CRONJOB] Không có return request nào cần nhắc nhở");
      return {
        success: true,
        reminderCount: 0,
      };
    }

    console.log(
      `[CRONJOB] Tìm thấy ${pendingRequests.length} return request(s) chờ xử lý > 3 ngày`
    );

    // TODO: Gửi email/notification cho admin
    // Có thể implement sau khi có notification service

    return {
      success: true,
      reminderCount: pendingRequests.length,
      requests: pendingRequests.map((r) => ({
        id: r._id,
        orderCode: r.order?.code,
        customerName: r.customer?.name,
        createdAt: r.createdAt,
        daysWaiting: Math.floor(
          (new Date() - r.createdAt) / (1000 * 60 * 60 * 24)
        ),
      })),
    };
  } catch (error) {
    console.error("[CRONJOB ERROR] remindPendingRequests:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  autoRejectExpiredRequests,
  cleanupOldCompletedRequests,
  remindPendingRequests,
};

