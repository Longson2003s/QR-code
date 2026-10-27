// File: src/config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 50, // Đảm bảo chịu tải cao khi hàng trăm bệnh nhân quét QR cùng lúc
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`[MongoDB] Kết nối thành công tới máy chủ: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[MongoDB] Lỗi kết nối cơ sở dữ liệu: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
