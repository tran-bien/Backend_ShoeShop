require("module-alias/register");
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");

// Sử dụng đường dẫn mới theo cấu trúc thư mục trong src
const connectDB = require("@config/db");
const errorHandler = require("@middlewares/error.middleware");
const { cleanSessions } = require("@services/session.service");
const routes = require("@routes");

// Load biến môi trường từ file .env
dotenv.config();

// Kết nối đến CSDL
connectDB();

const cleanupSessions = async () => {
  try {
    await cleanSessions();

    // Thiết lập job định kỳ để dọn dẹp session
    setInterval(async () => {
      try {
        await cleanSessions();
      } catch (error) {
        console.error("Lỗi khi dọn dẹp session:", error);
      }
    }, 60 * 60 * 1000); // Mỗi giờ
  } catch (error) {
    console.error("Lỗi khi dọn dẹp session ban đầu:", error);
  }
};

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log("Người dùng đã kết nối:", socket.id);

  // Xác thực người dùng qua token
  socket.on("authenticate", (token) => {
    try {
      const jwt = require("jsonwebtoken");
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;

      // Thêm người dùng vào phòng cá nhân dựa trên id
      socket.join(`user_${decoded.id}`);
      console.log(`Người dùng ${decoded.id} đã xác thực`);
    } catch (error) {
      console.error("Lỗi xác thực socket:", error);
    }
  });

  // Xử lý khi người dùng ngắt kết nối
  socket.on("disconnect", () => {
    console.log("Người dùng đã ngắt kết nối:", socket.id);
  });
});

// Đặt socket.io vào app để sử dụng trong các controller
app.set("io", io);

// Các middleware
app.use(cors());
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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Dọn dẹp session hết hạn khi khởi động server
  cleanupSessions();
});
