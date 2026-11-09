// File: src/controllers/qrViewer.controller.js
const Medication = require('../models/Medication.model');
const QrScanLog = require('../models/QrScanLog.model');

/**
 * Ghi nhận lượt quét mã QR trên hộp thuốc bất đồng bộ
 */
const recordMedicationScanAsync = async ({ token, medication, req }) => {
  try {
    await Promise.all([
      Medication.findByIdAndUpdate(medication._id, {
        $inc: { 'scan_stats.total_scans': 1 },
        $set: { 'scan_stats.last_scanned_at': new Date() },
      }),
      QrScanLog.create({
        qr_token: token,
        medication_id: medication._id,
        medication_code: medication.code,
        medication_name: medication.name,
        device_info: req.headers['user-agent'] || 'Mobile Scanner',
        ip_address: req.ip || '',
      }),
    ]);
  } catch (err) {
    console.error('[QrScanLog] Lỗi ghi log quét QR hộp thuốc:', err.message);
  }
};

/**
 * Tra cứu loại thuốc từ mã QR dán trên hộp thuốc (Theo qr_token, code hoặc _id)
 */
const resolveMedicationFromToken = async (token) => {
  const cleanToken = (token || '').trim();
  if (!cleanToken) return null;

  if (/^[0-9a-fA-F]{24}$/.test(cleanToken)) {
    const byId = await Medication.findById(cleanToken);
    if (byId) return byId;
  }

  return await Medication.findOne({
    $or: [
      { qr_token: cleanToken },
      { qr_token: cleanToken.toLowerCase() },
      { code: cleanToken.toUpperCase() },
    ],
  });
};

/**
 * 1. API trả về JSON khi truy vấn thông tin mã QR của loại thuốc
 */
exports.getQrGuideJson = async (req, res) => {
  try {
    const { token } = req.params;
    const medication = await resolveMedicationFromToken(token);

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Mã QR thuốc không tồn tại trong kho hướng dẫn.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: medication._id,
        code: medication.code,
        qr_token: medication.qr_token,
        name: medication.name,
        active_ingredient: medication.active_ingredient,
        dosage_form: medication.dosage_form,
        unit: medication.unit,
        standard_usage: medication.standard_usage,
        storage_instruction: medication.storage_instruction,
        general_warning: medication.general_warning,
        hotline_support: medication.hotline_support,
        guides: medication.guides || [],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. Giao diện Mobile Web-View khi quét mã QR dán trên hộp thuốc (/q/:token)
 * Hỗ trợ: Văn bản chữ lớn, Cách dùng & Bảo quản hộp thuốc, Hình ảnh từng bước và Video MP4
 */
exports.renderPatientQrPage = async (req, res) => {
  try {
    const { token } = req.params;
    const medication = await resolveMedicationFromToken(token);

    if (!medication) {
      return res.status(404).send(`<!DOCTYPE html>
      <html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Không tìm thấy mã QR thuốc</title>
      <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-slate-100 text-slate-800 p-6">
        <div class="max-w-md mx-auto bg-white rounded-2xl shadow-md p-6 text-center space-y-3 border border-red-200 mt-10">
          <div class="text-4xl">⚠️</div>
          <h2 class="text-lg font-extrabold text-red-600">Không tìm thấy thông tin mã QR thuốc này</h2>
          <p class="text-sm text-slate-600">Mã QR <b>${token}</b> chưa được đăng ký trong Kho thuốc hướng dẫn hoặc đã bị xóa.</p>
          <a href="/" class="inline-block bg-sky-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl mt-2">Về Trang Chủ Kho Thuốc</a>
        </div>
      </body></html>`);
    }

    // Ghi log lượt quét bất đồng bộ
    recordMedicationScanAsync({
      token: medication.qr_token || medication.code,
      medication,
      req,
    });

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>Hướng Dẫn Sử Dụng: ${medication.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 text-slate-900 pb-14">
  <!-- Header Bệnh viện / Kho Thuốc Hướng Dẫn -->
  <header class="bg-sky-700 text-white shadow-md sticky top-0 z-20">
    <div class="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
      <div>
        <div class="text-xs uppercase tracking-wider text-sky-200 font-semibold">Kho Thuốc Hướng Dẫn Sử Dụng</div>
        <h1 class="text-base font-bold">Thông Tin & Cách Dùng Thuốc</h1>
      </div>
      <span class="bg-sky-900 text-xs px-2.5 py-1 rounded-full font-mono">${medication.code}</span>
    </div>
  </header>

  <main class="max-w-xl mx-auto px-3 pt-4 space-y-4">
    <!-- Thông tin chính của hộp thuốc vừa quét -->
    <article class="bg-white rounded-2xl shadow-md border-2 border-sky-600 overflow-hidden">
      <div class="bg-sky-600 text-white p-4">
        <div class="flex items-center justify-between text-xs text-sky-100 mb-1">
          <span>${medication.dosage_form || 'Thuốc hướng dẫn sử dụng'}</span>
          <span class="bg-white text-sky-800 font-bold px-2.5 py-0.5 rounded-full">Đơn vị: ${medication.unit}</span>
        </div>
        <h2 class="text-xl font-extrabold leading-snug">${medication.name}</h2>
        ${
          medication.active_ingredient
            ? `<p class="text-xs text-sky-100 mt-1">🧪 Hoạt chất: <b>${medication.active_ingredient}</b></p>`
            : ''
        }
      </div>

      <div class="p-4 space-y-4">
        <!-- Cách dùng / Liều dùng khuyến cáo chung -->
        ${
          medication.standard_usage
            ? `<div class="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-3.5">
                 <div class="text-xs font-bold uppercase text-emerald-800 tracking-wide">📌 CÁCH DÙNG & LIỀU DÙNG THÔNG THƯỜNG:</div>
                 <div class="text-base font-bold text-slate-900 mt-1 leading-relaxed">${medication.standard_usage}</div>
               </div>`
            : ''
        }

        <!-- Hướng dẫn bảo quản hộp thuốc -->
        ${
          medication.storage_instruction
            ? `<div class="bg-sky-50 border border-sky-200 rounded-xl p-3 text-sm text-sky-950">
                 <strong class="text-sky-800">❄️ Bảo quản hộp thuốc:</strong> ${medication.storage_instruction}
               </div>`
            : ''
        }

        <!-- Cảnh báo an toàn chung của thuốc -->
        ${
          medication.general_warning
            ? `<div class="bg-red-50 border-2 border-red-400 rounded-xl p-3.5 text-sm text-red-950">
                 <div class="font-extrabold text-red-700 uppercase text-xs mb-1">⚠️ LƯU Ý QUAN TRỌNG KHI SỬ DỤNG:</div>
                 <div class="font-semibold leading-relaxed">${medication.general_warning}</div>
               </div>`
            : ''
        }

        <!-- Các bước hướng dẫn: Video MP4, Hình ảnh minh họa & Văn bản -->
        <div class="space-y-4 pt-1">
          <h3 class="text-base font-extrabold text-slate-800 border-b pb-2">
            📖 Các bước thao tác sử dụng thuốc (${(medication.guides || []).length} bước):
          </h3>

          ${
            (medication.guides || []).length === 0
              ? `<div class="text-sm text-slate-500 italic py-4 text-center">Đang cập nhật các bước hướng dẫn chi tiết cho loại thuốc này.</div>`
              : (medication.guides || [])
                  .map((guide) => {
                    let mediaBlock = '';
                    if (guide.media_type === 'VIDEO_MP4' && guide.media_url) {
                      const filename = guide.media_url.split('/').pop();
                      const streamUrl = guide.media_url.startsWith('/api/media/videos/')
                        ? guide.media_url
                        : `/api/media/videos/${filename}`;

                      mediaBlock = `
                      <div class="mt-3 rounded-xl overflow-hidden bg-black shadow">
                        <video
                          controls
                          playsinline
                          preload="metadata"
                          ${guide.thumbnail_url ? `poster="${guide.thumbnail_url}"` : ''}
                          class="w-full max-h-80 object-contain"
                        >
                          <source src="${streamUrl}" type="video/mp4" />
                          Trình duyệt của bạn không hỗ trợ phát Video MP4.
                        </video>
                        <div class="bg-slate-900 text-slate-200 text-xs px-3 py-2 flex justify-between">
                          <span>🎬 Video hướng dẫn trực quan (MP4)</span>
                          ${guide.duration_seconds ? `<span>Thời lượng: ${guide.duration_seconds} giây</span>` : ''}
                        </div>
                      </div>`;
                    } else if (guide.media_type === 'IMAGE' && guide.media_url) {
                      mediaBlock = `
                      <div class="mt-3 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                        <img
                          src="${guide.media_url}"
                          alt="${guide.title}"
                          loading="lazy"
                          class="w-full max-h-72 object-contain mx-auto"
                          onerror="this.outerHTML='<div class=\\'p-4 text-center text-xs text-slate-400 bg-slate-100\\'>[Hình ảnh minh họa: ${guide.title}]</div>'"
                        />
                      </div>`;
                    }

                    return `
                    <div class="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
                      <div class="flex items-center gap-2">
                        <span class="bg-sky-700 text-white text-xs font-bold px-2.5 py-1 rounded-md">Bước ${guide.step_order}</span>
                        <h4 class="font-bold text-base text-slate-900">${guide.title}</h4>
                      </div>
                      <p class="text-base text-slate-700 mt-2 leading-relaxed">${guide.content_text}</p>
                      ${mediaBlock}
                    </div>`;
                  })
                  .join('')
          }
        </div>

        <!-- Hotline hỗ trợ & In tem QR -->
        <div class="pt-3 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600">
          <span>☎️ Tư vấn Dược: <b>${medication.hotline_support || '1900-6868'}</b></span>
          <a href="/api/medications/${encodeURIComponent(medication.code)}/print-qr" target="_blank"
             class="bg-slate-100 hover:bg-slate-200 text-sky-700 font-bold px-3 py-1.5 rounded-lg border border-slate-300">
            🖨️ In tem QR nhỏ dán hộp thuốc
          </a>
        </div>
      </div>
    </article>
  </main>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send(`Lỗi hiển thị hướng dẫn thuốc: ${error.message}`);
  }
};
