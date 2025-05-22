const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    console.log("Đang kết nối đến MongoDB Atlas...");
    console.log(
      `URI: ${process.env.MONGO_URI.replace(/\/\/(.+):(.+)@/, "//***:***@")}`
    );

    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected Successfully: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`Lỗi kết nối MongoDB: ${error.message}`);
    console.error(`Chi tiết lỗi: ${error.stack}`);
    return false;
  }
};

module.exports = connectDB;
