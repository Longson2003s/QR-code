// File: src/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { startPublicTunnel } = require('./utils/publicTunnel');

// Import Routes từ các Module
const medicationRoutes = require('./routes/medication.routes');
const mediaRoutes = require('./routes/media.routes');
const prescriptionRoutes = require('./routes/prescription.routes');
const qrViewerRoutes = require('./routes/qrViewer.routes');

const app = express();

// 1. Kết nối cơ sở dữ liệu MongoDB
connectDB();

// 2. Middlewares cơ bản
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 3. Phục vụ file tĩnh (Hình ảnh hướng dẫn & Giao diện Admin)
app.use('/public', express.static(path.join(__dirname, '../public')));

// 4. Đăng ký các Routes theo đúng kiến trúc 5 Module đã chốt
app.use('/api/medications', medicationRoutes);     // Module 2: Quản lý Kho thuốc & Upload Ảnh/MP4
app.use('/api/media', mediaRoutes);                // Module 2: Streaming Video MP4 (HTTP 206)
app.use('/api/prescriptions', prescriptionRoutes); // Module 3: Tạo đơn thuốc & In tem nhiệt QR
app.use('/q', qrViewerRoutes);                     // Module 4: Cổng Bệnh nhân quét mã QR (/q/:token)

// Module 5: Cổng Web Admin trực quan cho Dược sĩ & Bác sĩ (/admin)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// 5. Trang chủ Bảng điều khiển nhanh (Quick Demo Portal cho Giám đốc & Dược sĩ)
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
  <html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hệ Thống QR Code Hướng Dẫn Sử Dụng Thuốc - Bệnh Viện</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-slate-50 text-slate-800 p-6">
    <div class="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg border border-slate-200 p-6 space-y-6">
      <div class="border-b pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <span class="bg-sky-100 text-sky-800 text-xs font-bold px-2.5 py-1 rounded">HỆ THỐNG ĐÃ HOÀN THIỆN ĐỦ 5 MODULE</span>
          <h1 class="text-2xl font-extrabold text-slate-900 mt-2">Hệ Thống QR Code Hướng Dẫn Sử Dụng Thuốc</h1>
          <p class="text-sm text-slate-600 mt-1">Hỗ trợ Văn bản, Hình ảnh trực quan từng bước và Streaming Video MP4</p>
        </div>
        <a href="/admin" class="bg-sky-700 hover:bg-sky-800 text-white font-bold px-5 py-3 rounded-xl shadow transition text-sm">
          ⚙️ Mở Cổng Quản Trị Dược Sĩ (/admin) &rarr;
        </a>
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        <a href="/admin"
           class="block p-4 rounded-xl border-2 border-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition md:col-span-2">
          <div class="font-bold text-indigo-900 text-lg">💻 CỔNG WEB ADMIN DƯỢC LÂM SÀNG (MỚI - MODULE 5)</div>
          <p class="text-xs text-slate-700 mt-1">Giao diện trực quan để Dược sĩ bấm thêm thuốc, chọn upload file Video MP4 / Ảnh từ máy tính, kê đơn thuốc mới và xem thống kê lượt quét QR của Giám đốc.</p>
        </a>

        <a href="/api/prescriptions/BA20261027_00158/print-labels" target="_blank"
           class="block p-4 rounded-xl border-2 border-sky-600 bg-sky-50 hover:bg-sky-100 transition">
          <div class="font-bold text-sky-900 text-lg">🖨️ 1. Xem & In Tem Nhiệt QR Mẫu</div>
          <p class="text-xs text-slate-600 mt-1">Mở bản in tem QR dán vào Hồ sơ bệnh án (BA20261027_00158) và tem dán từng lọ thuốc.</p>
        </a>

        <a href="/q/p_demo123456" target="_blank"
           class="block p-4 rounded-xl border-2 border-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition">
          <div class="font-bold text-emerald-900 text-lg">📱 2. Giả lập Bệnh nhân Quét QR Hồ Sơ</div>
          <p class="text-xs text-slate-600 mt-1">Mở giao diện Mobile khi bệnh nhân quét mã QR tổng trên đơn thuốc (/q/p_demo123456).</p>
        </a>

        <a href="/q/i_symbicort01" target="_blank"
           class="block p-4 rounded-xl border border-slate-300 hover:bg-slate-100 transition">
          <div class="font-bold text-slate-800">💨 3. Quét QR Lẻ: Bình hít Symbicort</div>
          <p class="text-xs text-slate-600 mt-1">Khi bệnh nhân quét tem dán trên vỏ bình xịt hen suyễn (/q/i_symbicort01).</p>
        </a>

        <a href="/q/i_insulin02" target="_blank"
           class="block p-4 rounded-xl border border-slate-300 hover:bg-slate-100 transition">
          <div class="font-bold text-slate-800">💉 4. Quét QR Lẻ: Bút tiêm Insulin</div>
          <p class="text-xs text-slate-600 mt-1">Khi bệnh nhân quét tem dán trên hộp bút tiêm tiểu đường (/q/i_insulin02).</p>
        </a>
      </div>
    </div>
  </body>
  </html>`);
});

// 6. Khởi động máy chủ & Tự động bật đường hầm Public HTTPS (Quét QR bằng 4G/5G mọi nơi)
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log('============================================================');
  console.log(`🚀 Server Bệnh viện đang chạy tại : http://localhost:${PORT}`);
  console.log(`💻 Cổng Web Admin Dược sĩ         : http://localhost:${PORT}/admin`);
  console.log('⏳ Đang khởi tạo đường hầm Public HTTPS (4G/5G)...');

  const publicOrigin = await startPublicTunnel(PORT);
  if (publicOrigin) {
    console.log(`🌍 ĐƯỜNG HẦM 4G/5G TOÀN CẦU (HTTPS): ${publicOrigin}`);
    console.log(`📱 Link QR 4G/5G cho Bệnh nhân     : ${publicOrigin}/q/p_demo123456`);
  } else {
    console.log(`📶 Địa chỉ mạng LAN dự phòng      : ${process.env.BASE_QR_URL || `http://localhost:${PORT}/q`}`);
  }
  console.log(`🖨️ Trang In Tem QR Mẫu            : http://localhost:${PORT}/api/prescriptions/BA20261027_00158/print-labels`);
  console.log('============================================================');
});
