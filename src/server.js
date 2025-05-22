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

const app = express();

// Các middleware
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));

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
});
