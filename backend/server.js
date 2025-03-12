const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");
const connectDB = require("./config/db");
const { errorHandler } = require("./middlewares/error.middleware");
const Session = require("./models/session.model");

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Dọn dẹp session hết hạn khi khởi động server
const cleanupSessions = async () => {
  try {
    await Session.cleanExpiredSessions();

    // Thiết lập job định kỳ để dọn dẹp session hết hạn mỗi giờ
    setInterval(async () => {
      try {
        await Session.cleanExpiredSessions();
      } catch (error) {
        console.error("Lỗi khi dọn dẹp session hết hạn:", error);
      }
    }, 60 * 60 * 1000); // Mỗi giờ
  } catch (error) {
    console.error("Lỗi khi dọn dẹp session hết hạn:", error);
  }
};

// Initialize app
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

  // Xác thực người dùng
  socket.on("authenticate", (token) => {
    try {
      const jwt = require("jsonwebtoken");
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;

      // Thêm người dùng vào phòng cá nhân
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

// Đặt socket.io vào app để sử dụng trong controllers
app.set("io", io);

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan("dev"));

// Routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/products", require("./routes/product.routes"));
app.use("/api/categories", require("./routes/category.routes"));
app.use("/api/brands", require("./routes/brand.routes"));
app.use("/api/colors", require("./routes/color.routes"));
app.use("/api/sizes", require("./routes/size.routes"));
app.use("/api/orders", require("./routes/order.routes"));
app.use("/api/cart", require("./routes/cart.routes"));
app.use("/api/reviews", require("./routes/review.routes"));
app.use("/api/coupons", require("./routes/coupon.routes"));
app.use("/api/uploads", require("./routes/upload.routes"));
app.use("/api/payment", require("./routes/payment.routes"));
app.use("/api/statistics", require("./routes/statistic.routes"));
app.use("/api/notifications", require("./routes/notification.routes"));
app.use("/api/inventory", require("./routes/inventory.routes"));

// Serve static assets if in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static("client/build"));

  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "client", "build", "index.html"));
  });
}

// Error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Dọn dẹp session hết hạn khi khởi động server
  cleanupSessions();
});
