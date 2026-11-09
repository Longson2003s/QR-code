// File: src/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const connectDB = require('./config/db');
const { startPublicTunnel } = require('./utils/publicTunnel');

// Import Routes
const medicationRoutes = require('./routes/medication.routes');
const mediaRoutes = require('./routes/media.routes');
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

// API trả về thông tin kết nối LAN & Đường hầm 4G/5G Mạng ngoài
app.get('/api/network-info', (req, res) => {
  const port = process.env.PORT || 3000;
  let lanIp = '10.120.49.40';
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        lanIp = net.address;
        break;
      }
    }
  }
  const lanOrigin = `http://${lanIp}:${port}`;
  const publicOrigin = global.PUBLIC_TUNNEL_ORIGIN || null;
  res.json({
    success: true,
    lan_origin: lanOrigin,
    public_origin: publicOrigin,
    active_qr_base_url: global.PUBLIC_QR_BASE_URL || process.env.BASE_QR_URL || `${lanOrigin}/q`,
  });
});

// 4. Đăng ký các Routes tập trung vào Kho Thuốc Hướng Dẫn & In Mã QR Nhỏ Dán Hộp Thuốc
app.use('/api/medications', medicationRoutes); // Quản lý Kho thuốc hướng dẫn & In mã QR nhỏ từng loại thuốc
app.use('/api/media', mediaRoutes);            // Streaming Video MP4 (HTTP 206)
app.use('/q', qrViewerRoutes);                 // Cổng quét mã QR dán trên hộp thuốc (/q/:token)

// Cổng Web Admin trực quan cho Dược sĩ quản lý Kho thuốc & In tem QR (/admin)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// 5. Trang chủ Bảng điều khiển nhanh (Quick Portal cho Kho Thuốc Hướng Dẫn)
app.get('/', (req, res) => {
  const port = process.env.PORT || 3000;
  const publicOrigin = global.PUBLIC_TUNNEL_ORIGIN;
  const lanOrigin = `http://10.120.49.40:${port}`;

  res.send(`<!DOCTYPE html>
  <html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hệ Thống Kho Thuốc Hướng Dẫn & In Mã QR Nhỏ Dán Hộp Thuốc</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-slate-50 text-slate-800 p-6">
    <div class="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg border border-slate-200 p-6 space-y-6">
      <div class="border-b pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <span class="bg-sky-100 text-sky-800 text-xs font-bold px-2.5 py-1 rounded">KHO THUỐC HƯỚNG DẪN & TEM QR NHỎ DÁN HỘP THUỐC</span>
          <h1 class="text-2xl font-extrabold text-slate-900 mt-2">Hệ Thống QR Code Hướng Dẫn Sử Dụng Thuốc</h1>
          <p class="text-sm text-slate-600 mt-1">Mỗi loại thuốc có một mã QR nhỏ riêng biệt để in dán vào hộp thuốc (Hỗ trợ Văn bản, Hình ảnh & Video MP4)</p>
        </div>
        <a href="/admin" class="bg-sky-700 hover:bg-sky-800 text-white font-bold px-5 py-3 rounded-xl shadow transition text-sm">
          ⚙️ Quản Trị Kho Thuốc (/admin) &rarr;
        </a>
      </div>

      <!-- Khung trạng thái kết nối 4G/5G Mạng Ngoài & Mạng Nội Bộ -->
      <div class="rounded-xl border-2 ${publicOrigin ? 'border-emerald-500 bg-emerald-50/70' : 'border-amber-400 bg-amber-50'} p-4 space-y-2">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="font-bold text-sm ${publicOrigin ? 'text-emerald-900' : 'text-amber-900'}">
            🌍 TRẠNG THÁI TRUY CẬP 4G/5G & MẠNG NGOÀI (PUBLIC INTERNET)
          </div>
          <span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${publicOrigin ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}">
            ${publicOrigin ? 'ĐANG HOẠT ĐỘNG (4G/5G OK)' : 'ĐANG KHỞI TẠO TUNNEL...'}
          </span>
        </div>
        ${
          publicOrigin
            ? `<div class="text-xs text-slate-700 space-y-1">
                <div>🔗 <b>Link Mạng Ngoài / 4G / 5G (Toàn cầu):</b> <a href="${publicOrigin}" target="_blank" class="text-emerald-700 font-mono font-bold underline">${publicOrigin}</a></div>
                <div>📱 <b>Link Quét QR Hộp Thuốc Mẫu (4G/5G):</b> <a href="${publicOrigin}/q/m_symbicort" target="_blank" class="text-sky-700 font-mono font-bold underline">${publicOrigin}/q/m_symbicort</a></div>
                <div>🏢 <b>Link Mạng Nội Bộ (LAN Server):</b> <a href="${lanOrigin}" class="font-mono text-slate-600 underline">${lanOrigin}</a></div>
              </div>`
            : `<div class="text-xs text-slate-700">
                Hệ thống đang kết nối Cloudflare Tunnel để mở đường truyền 4G/5G (vui lòng tải lại trang sau vài giây). Địa chỉ LAN nội bộ: <b>${lanOrigin}</b>
              </div>`
        }
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        <a href="/admin"
           class="block p-4 rounded-xl border-2 border-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition md:col-span-2">
          <div class="font-bold text-indigo-900 text-lg">💻 1. CỔNG QUẢN TRỊ KHO THUỐC HƯỚNG DẪN (/admin)</div>
          <p class="text-xs text-slate-700 mt-1">Thêm loại thuốc mới, tải lên Video MP4 / Hình ảnh hướng dẫn từng bước, xem mã QR riêng của từng thuốc và chọn in tem QR nhỏ dán vào hộp thuốc.</p>
        </a>

        <a href="/api/medications/MED_SYMBICORT_160/print-qr" target="_blank"
           class="block p-4 rounded-xl border-2 border-sky-600 bg-sky-50 hover:bg-sky-100 transition">
          <div class="font-bold text-sky-900 text-base">🖨️ 2. In Tem QR Nhỏ: Bình Hít Symbicort</div>
          <p class="text-xs text-slate-600 mt-1">Mở trang in mã QR nhỏ riêng của Symbicort (Tùy chọn cỡ siêu nhỏ 22x22mm, 35x22mm, 50x30mm) để dán vào hộp thuốc.</p>
        </a>

        <a href="/api/medications/MED_INSULIN_FLEXPEN/print-qr" target="_blank"
           class="block p-4 rounded-xl border-2 border-sky-600 bg-sky-50 hover:bg-sky-100 transition">
          <div class="font-bold text-sky-900 text-base">🖨️ 3. In Tem QR Nhỏ: Bút Tiêm Insulin</div>
          <p class="text-xs text-slate-600 mt-1">Mở trang in mã QR nhỏ riêng của Bút tiêm Insulin Mixtard 30 để dán lên vỏ hộp bút tiêm.</p>
        </a>

        <a href="/q/m_symbicort" target="_blank"
           class="block p-4 rounded-xl border border-slate-300 hover:bg-slate-100 transition">
          <div class="font-bold text-slate-800">📱 4. Xem Trang Quét Hộp Thuốc: Symbicort</div>
          <p class="text-xs text-slate-600 mt-1">Giao diện hướng dẫn khi người dùng quét mã QR dán trên hộp bình hít (/q/m_symbicort).</p>
        </a>

        <a href="/q/m_insulin" target="_blank"
           class="block p-4 rounded-xl border border-slate-300 hover:bg-slate-100 transition">
          <div class="font-bold text-slate-800">📱 5. Xem Trang Quét Hộp Thuốc: Bút Tiêm Insulin</div>
          <p class="text-xs text-slate-600 mt-1">Giao diện hướng dẫn khi người dùng quét mã QR dán trên hộp bút tiêm (/q/m_insulin).</p>
        </a>
      </div>
    </div>
  </body>
  </html>`);
});

// 6. Khởi động máy chủ & Tự động bật đường hầm Public HTTPS
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log('============================================================');
  console.log(`🚀 Server Kho Thuốc (LAN)         : http://10.120.49.40:${PORT}`);
  console.log(`💻 Quản Trị Kho Thuốc & In QR     : http://10.120.49.40:${PORT}/admin`);
  console.log('⏳ Đang khởi tạo đường hầm Public HTTPS cho mạng ngoài (4G/5G)...');

  const publicOrigin = await startPublicTunnel(PORT);
  if (publicOrigin) {
    console.log(`🌍 LINK MẠNG NGOÀI / 4G / 5G      : ${publicOrigin}`);
    console.log(`🛠️ Cổng Admin từ Mạng Ngoài       : ${publicOrigin}/admin`);
    console.log(`📱 Link Quét QR Hộp Thuốc Mẫu     : ${publicOrigin}/q/m_symbicort`);
  } else {
    console.log(`📶 Địa chỉ mạng LAN dự phòng      : ${process.env.BASE_QR_URL || `http://10.120.49.40:${PORT}/q`}`);
  }
  console.log(`🖨️ Trang In Tem QR Nhỏ Mẫu        : http://10.120.49.40:${PORT}/api/medications/MED_SYMBICORT_160/print-qr`);
  console.log('============================================================');
});
