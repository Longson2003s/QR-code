// File: src/controllers/qrViewer.controller.js
const Prescription = require('../models/Prescription.model');
const Medication = require('../models/Medication.model');
const QrScanLog = require('../models/QrScanLog.model');

/**
 * Ghi nhận lượt quét QR bất đồng bộ (Không làm chậm tốc độ mở trang của bệnh nhân)
 */
const recordScanActivityAsync = async ({
  token,
  targetType,
  prescriptionId,
  medicationId,
  req,
}) => {
  try {
    await Promise.all([
      Prescription.findByIdAndUpdate(prescriptionId, {
        $inc: { 'scan_stats.total_scans': 1 },
        $set: { 'scan_stats.last_scanned_at': new Date() },
      }),
      QrScanLog.create({
        qr_token: token,
        target_type: targetType,
        prescription_id: prescriptionId,
        medication_id: medicationId || null,
        device_info: req.headers['user-agent'] || 'Mobile Scanner',
        ip_address: req.ip || '',
      }),
    ]);
  } catch (err) {
    console.error('[QrScanLog] Lỗi ghi log quét QR:', err.message);
  }
};

/**
 * Tra cứu dữ liệu từ QR Token (Dùng chung cho cả Web View và API JSON)
 */
const resolveTokenData = async (token) => {
  const cleanToken = (token || '').trim();

  // Trường hợp 1: Quét QR Tổng trên sổ khám / đơn thuốc (bắt đầu bằng 'p_')
  let prescription = await Prescription.findOne({ master_qr_token: cleanToken });
  let targetType = 'MASTER_PRESCRIPTION';
  let focusedItemToken = null;

  // Trường hợp 2: Quét QR dán lẻ trên từng lọ thuốc (bắt đầu bằng 'i_')
  if (!prescription) {
    prescription = await Prescription.findOne({
      'items.item_qr_token': cleanToken,
    });
    if (prescription) {
      targetType = 'SINGLE_ITEM';
      focusedItemToken = cleanToken;
    }
  }

  if (!prescription) return null;

  // Lấy toàn bộ thông tin hướng dẫn (Text, Ảnh, Video MP4) từ bảng Medication
  const medIds = prescription.items.map((item) => item.medication_id);
  const medications = await Medication.find({ _id: { $in: medIds } });
  const medMap = {};
  medications.forEach((m) => {
    medMap[m._id.toString()] = m;
  });

  // Lọc danh sách thuốc cần hiển thị (Nếu quét lọ lẻ thì ưu tiên hiển thị đúng lọ đó lên đầu)
  const fullItems = prescription.items.map((item) => {
    const medDetail = medMap[item.medication_id.toString()] || {};
    return {
      item_id: item._id,
      item_qr_token: item.item_qr_token,
      is_focused: focusedItemToken ? item.item_qr_token === focusedItemToken : true,
      quantity: item.quantity,
      dosage_instruction: item.dosage_instruction,
      usage_timing: item.usage_timing,
      custom_note: item.custom_note,
      medication: {
        id: medDetail._id,
        code: medDetail.code || item.medication_snapshot.code,
        name: medDetail.name || item.medication_snapshot.name,
        active_ingredient: medDetail.active_ingredient || '',
        dosage_form: medDetail.dosage_form || item.medication_snapshot.dosage_form,
        unit: medDetail.unit || item.medication_snapshot.unit,
        general_warning: medDetail.general_warning || '',
        hotline_support: medDetail.hotline_support || '1900-6868',
        guides: medDetail.guides || [],
      },
    };
  });

  return {
    targetType,
    focusedItemToken,
    prescription,
    fullItems,
  };
};

/**
 * 1. API trả về JSON khi truy vấn thông tin mã QR
 */
exports.getQrGuideJson = async (req, res) => {
  try {
    const { token } = req.params;
    const result = await resolveTokenData(token);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Mã QR không tồn tại hoặc đã hết hạn.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        scan_mode: result.targetType,
        prescription_code: result.prescription.prescription_code,
        patient_masked_name: result.prescription.patient.masked_name,
        patient_birth_year: result.prescription.patient.birth_year,
        doctor: result.prescription.doctor,
        general_note: result.prescription.general_note,
        items: result.fullItems,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. Giao diện Mobile Web-View cho Bệnh nhân khi quét mã QR (/q/:token)
 * Hỗ trợ: Văn bản chữ lớn, Hình ảnh trực quan từng bước, và Trình phát Video MP4
 */
exports.renderPatientQrPage = async (req, res) => {
  try {
    const { token } = req.params;
    const showAll = req.query.all === '1';
    const result = await resolveTokenData(token);

    if (!result) {
      return res.status(404).send(`<!DOCTYPE html>
      <html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Không tìm thấy mã QR</title></head>
      <body style="font-family:sans-serif; text-align:center; padding:40px 20px;">
        <h2 style="color:#dc2626;">⚠️ Mã QR không hợp lệ hoặc đã hết hạn</h2>
        <p>Vui lòng kiểm tra lại tem QR trên đơn thuốc hoặc liên hệ Quầy Dược Bệnh viện để được hỗ trợ.</p>
      </body></html>`);
    }

    const { targetType, focusedItemToken, prescription, fullItems } = result;
    const focusedItem = fullItems.find((i) => i.item_qr_token === focusedItemToken);

    // Ghi log lượt quét bất đồng bộ
    recordScanActivityAsync({
      token,
      targetType,
      prescriptionId: prescription._id,
      medicationId: focusedItem ? focusedItem.medication.id : null,
      req,
    });

    // Nếu bệnh nhân quét tem trên 1 lọ thuốc lẻ (SINGLE_ITEM) và chưa bấm "Xem cả đơn" -> Chỉ hiện đúng thuốc đó cho đỡ rối
    const itemsToDisplay =
      targetType === 'SINGLE_ITEM' && !showAll
        ? fullItems.filter((i) => i.is_focused)
        : fullItems;

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>Hướng Dẫn Sử Dụng Thuốc - ${prescription.patient.masked_name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 text-slate-900 pb-14">
  <!-- Header Bệnh viện -->
  <header class="bg-sky-700 text-white shadow-md sticky top-0 z-20">
    <div class="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
      <div>
        <div class="text-xs uppercase tracking-wider text-sky-200 font-semibold">Cổng Dược Lâm Sàng Bệnh Viện</div>
        <h1 class="text-lg font-bold">Hướng Dẫn Sử Dụng Thuốc</h1>
      </div>
      <span class="bg-sky-900 text-xs px-2.5 py-1 rounded-full font-mono">${prescription.prescription_code}</span>
    </div>
  </header>

  <main class="max-w-xl mx-auto px-3 pt-4 space-y-5">
    <!-- Thông tin bệnh nhân & Lời dặn chung -->
    <section class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
      <div class="flex justify-between items-start border-b border-slate-100 pb-3">
        <div>
          <p class="text-xs text-slate-500">Người bệnh</p>
          <p class="text-lg font-bold text-slate-800">${prescription.patient.masked_name} <span class="text-sm font-normal text-slate-500">(NS: ${prescription.patient.birth_year})</span></p>
        </div>
        <div class="text-right">
          <p class="text-xs text-slate-500">${prescription.doctor.department}</p>
          <p class="text-sm font-semibold text-sky-700">${prescription.doctor.name}</p>
        </div>
      </div>
      ${
        prescription.general_note
          ? `<div class="mt-3 bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-lg text-sm text-amber-900">
               <strong>📋 Lời dặn của Bác sĩ:</strong> ${prescription.general_note}
             </div>`
          : ''
      }
      ${
        targetType === 'SINGLE_ITEM' && !showAll
          ? `<div class="mt-3 pt-2 flex items-center justify-between text-sm">
               <span class="text-emerald-700 font-medium">🎯 Đang hiển thị thuốc bạn vừa quét trên lọ</span>
               <a href="/q/${prescription.master_qr_token}" class="text-sky-700 font-bold underline">Xem toàn bộ đơn (${fullItems.length} thuốc) &rarr;</a>
             </div>`
          : ''
      }
    </section>

    <!-- Danh sách từng thuốc kèm Văn bản, Hình ảnh và Video MP4 -->
    ${itemsToDisplay
      .map(
        (item, index) => `
    <article class="bg-white rounded-2xl shadow-md border-2 border-sky-600 overflow-hidden">
      <!-- Tiêu đề thuốc & Liều dùng cá nhân hóa -->
      <div class="bg-sky-600 text-white p-4">
        <div class="flex items-center justify-between text-xs text-sky-100 mb-1">
          <span>THUỐC #${index + 1} • ${item.medication.dosage_form}</span>
          <span class="bg-white text-sky-800 font-bold px-2.5 py-0.5 rounded-full">Số lượng: ${item.quantity} ${item.medication.unit}</span>
        </div>
        <h2 class="text-xl font-extrabold leading-snug">${item.medication.name}</h2>
        ${
          item.medication.active_ingredient
            ? `<p class="text-xs text-sky-100 mt-0.5">Hoạt chất: ${item.medication.active_ingredient}</p>`
            : ''
        }
      </div>

      <div class="p-4 space-y-4">
        <!-- Khung Liều Dùng Của Riêng Bệnh Nhân (Chữ cực to cho người lớn tuổi) -->
        <div class="bg-red-50 border-2 border-red-500 rounded-xl p-3.5">
          <div class="text-xs font-bold uppercase text-red-700 tracking-wide">⏰ LIỀU DÙNG CỦA BẠN:</div>
          <div class="text-xl font-extrabold text-red-700 mt-1">${item.dosage_instruction}</div>
          ${
            item.usage_timing
              ? `<div class="text-sm font-medium text-slate-800 mt-1">👉 <b>Thời điểm dùng:</b> ${item.usage_timing}</div>`
              : ''
          }
          ${
            item.custom_note
              ? `<div class="text-sm text-red-800 mt-1.5 bg-red-100/80 p-2 rounded-lg">💡 <b>Lưu ý riêng:</b> ${item.custom_note}</div>`
              : ''
          }
        </div>

        <!-- Cảnh báo an toàn chung của thuốc -->
        ${
          item.medication.general_warning
            ? `<div class="bg-amber-50 border border-amber-300 rounded-xl p-3 text-sm text-amber-950">
                 <strong class="text-amber-800">⚠️ LƯU Ý QUAN TRỌNG:</strong> ${item.medication.general_warning}
               </div>`
            : ''
        }

        <!-- Các bước hướng dẫn: Video MP4, Hình ảnh minh họa & Văn bản -->
        <div class="space-y-4 pt-1">
          <h3 class="text-base font-bold text-slate-800 border-b pb-2">📖 Các bước hướng dẫn sử dụng chi tiết:</h3>

          ${item.medication.guides
            .map((guide) => {
              let mediaBlock = '';
              if (guide.media_type === 'VIDEO_MP4' && guide.media_url) {
                // Tự động chuyển đường dẫn file video sang chuẩn Streaming HTTP 206 nếu cần
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
            .join('')}
        </div>

        <!-- Hotline hỗ trợ Dược lâm sàng -->
        <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Hỗ trợ tư vấn thuốc: <b>${item.medication.hotline_support}</b></span>
          <a href="/api/prescriptions/${prescription.prescription_code}/print-labels" class="text-sky-600 underline">Xem tem QR</a>
        </div>
      </div>
    </article>`
      )
      .join('')}
  </main>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send(`Lỗi hiển thị hướng dẫn: ${error.message}`);
  }
};
