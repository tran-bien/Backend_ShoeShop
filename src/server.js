require("module-alias/register");
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

// Sử dụng đường dẫn mới theo cấu trúc thư mục trong src
const connectDB = require("@config/db");
const errorHandler = require("@middlewares/error.middleware");
const sessionService = require("@services/session.service");
const routes = require("@routes");
const returnRequestJob = require("./jobs/returnRequest.job");
const loyaltyJob = require("./jobs/loyalty.job");
const recommendationJob = require("./jobs/recommendation.job");

// Load biến môi trường từ file .env
dotenv.config();

// Kết nối đến CSDL
connectDB();

// Dọn dẹp session định kỳ để tránh quá tải database
const setupSessionCleanup = () => {
  // Đầu tiên dọn dẹp ngay khi server khởi động
  sessionService.cleanSessions().catch((error) => {
    console.error("Không thể dọn dẹp session khi khởi động:", error);
  });

  // Sau đó thiết lập lịch trình dọn dẹp định kỳ
  setInterval(() => {
    sessionService.cleanSessions().catch((error) => {
      console.error("Lỗi trong quá trình dọn dẹp session định kỳ:", error);
    });
  }, 60 * 60 * 1000); // Mỗi giờ

  console.log("Đã thiết lập lịch trình dọn dẹp session định kỳ");
};

// ============================================================
// CRONJOBS - Các tác vụ định kỳ
// ============================================================
const setupCronjobs = () => {
  // === RETURN REQUEST CRONJOBS ===

  // 1. Auto-reject return requests quá hạn - Chạy mỗi 6 giờ
  setInterval(() => {
    returnRequestJob.autoRejectExpiredRequests().catch((error) => {
      console.error("Lỗi cronjob auto-reject return requests:", error);
    });
  }, 6 * 60 * 60 * 1000);

  returnRequestJob.autoRejectExpiredRequests().catch((error) => {
    console.error("Lỗi khi chạy auto-reject lần đầu:", error);
  });

  // 2. Cleanup return requests cũ - Chạy mỗi tuần
  setInterval(() => {
    returnRequestJob.cleanupOldCompletedRequests().catch((error) => {
      console.error("Lỗi cronjob cleanup return requests:", error);
    });
  }, 7 * 24 * 60 * 60 * 1000);

  // 3. Nhắc nhở admin về pending requests - Chạy mỗi ngày
  setInterval(() => {
    returnRequestJob.remindPendingRequests().catch((error) => {
      console.error("Lỗi cronjob remind pending requests:", error);
    });
  }, 24 * 60 * 60 * 1000);

  // === LOYALTY CRONJOBS ===

  // 4. Expire loyalty points - Chạy mỗi ngày lúc 1 AM
  setInterval(() => {
    loyaltyJob.expirePoints().catch((error) => {
      console.error("Lỗi cronjob expire points:", error);
    });
  }, 24 * 60 * 60 * 1000);

  // 5. Remind expiring points - Chạy mỗi tuần
  setInterval(() => {
    loyaltyJob.remindExpiringPoints().catch((error) => {
      console.error("Lỗi cronjob remind expiring points:", error);
    });
  }, 7 * 24 * 60 * 60 * 1000);

  // 6. Update user tiers - Chạy mỗi tuần
  setInterval(() => {
    loyaltyJob.updateAllUserTiers().catch((error) => {
      console.error("Lỗi cronjob update tiers:", error);
    });
  }, 7 * 24 * 60 * 60 * 1000);

  // === RECOMMENDATION CRONJOBS ===

  // 7. Update user behaviors - Chạy mỗi ngày lúc 3 AM
  setInterval(() => {
    recommendationJob.updateUserBehaviors().catch((error) => {
      console.error("Lỗi cronjob update behaviors:", error);
    });
  }, 24 * 60 * 60 * 1000);

  // 8. Clear expired cache - Chạy mỗi ngày
  setInterval(() => {
    recommendationJob.clearExpiredCache().catch((error) => {
      console.error("Lỗi cronjob clear cache:", error);
    });
  }, 24 * 60 * 60 * 1000);

  console.log("✅ Đã thiết lập tất cả cronjobs");
};

const app = express();

// Các middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan("dev"));

// Sử dụng các routes từ thư mục src/api/routes
app.use("/api/v1", routes);

// Serve static assets nếu đang trong môi trường production
if (process.env.NODE_ENV === "production") {
  app.use(express.static("client/build"));

  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "client", "build", "index.html"));
  });
}

// Error handler middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Thiết lập dọn dẹp session
  setupSessionCleanup();
  // Thiết lập cronjobs
  setupCronjobs();
});
