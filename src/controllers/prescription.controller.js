// File: src/controllers/prescription.controller.js
const QRCode = require('qrcode');
const Prescription = require('../models/Prescription.model');
const Medication = require('../models/Medication.model');
const QrScanLog = require('../models/QrScanLog.model');

/**
 * Hàm phụ trợ: Sinh ảnh QR Code dạng DataURL (Base64) sắc nét để hiển thị và in tem
 */
const buildQrDataUrl = async (token) => {
  const baseUrl = process.env.BASE_QR_URL || 'http://localhost:3000/q';
  const scanUrl = `${baseUrl}/${token}`;
  const qrDataUrl = await QRCode.toDataURL(scanUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 220,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
  return { scanUrl, qrDataUrl };
};

/**
 * 1. Tạo mới đơn thuốc (từ Dược sĩ hoặc tích hợp HIS) & Tự động sinh mã QR
 */
exports.createPrescription = async (req, res) => {
  try {
    const {
      prescription_code,
      patient,
      doctor,
      diagnosis,
      general_note,
      items,
    } = req.body;

    const existing = await Prescription.findOne({
      prescription_code: prescription_code.trim(),
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Mã đơn thuốc ${prescription_code} đã tồn tại.`,
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Đơn thuốc phải bao gồm ít nhất 1 loại thuốc.',
      });
    }

    // Đối chiếu từng thuốc trong đơn với danh mục Medication (theo medication_id hoặc medication_code)
    const enrichedItems = [];
    for (const rawItem of items) {
      let medDoc = null;
      if (rawItem.medication_id) {
        medDoc = await Medication.findById(rawItem.medication_id);
      } else if (rawItem.medication_code) {
        medDoc = await Medication.findOne({
          code: rawItem.medication_code.toUpperCase().trim(),
        });
      }

      if (!medDoc) {
        return res.status(404).json({
          success: false,
          message: `Không tìm thấy thuốc (${rawItem.medication_code || rawItem.medication_id}) trong kho hướng dẫn.`,
        });
      }

      enrichedItems.push({
        medication_id: medDoc._id,
        medication_snapshot: {
          code: medDoc.code,
          name: medDoc.name,
          unit: medDoc.unit,
          dosage_form: medDoc.dosage_form,
        },
        quantity: rawItem.quantity,
        dosage_instruction: rawItem.dosage_instruction,
        usage_timing: rawItem.usage_timing || '',
        custom_note: rawItem.custom_note || '',
      });
    }

    const prescription = await Prescription.create({
      prescription_code: prescription_code.trim(),
      patient,
      doctor,
      diagnosis,
      general_note,
      items: enrichedItems,
    });

    // Sinh thông tin QR trả về ngay cho HIS / Phần mềm nhà thuốc
    const masterQr = await buildQrDataUrl(prescription.master_qr_token);

    return res.status(201).json({
      success: true,
      message: 'Tạo đơn thuốc và sinh mã QR thành công.',
      data: {
        prescription,
        master_qr_url: masterQr.scanUrl,
        master_qr_image_base64: masterQr.qrDataUrl,
        print_labels_url: `/api/prescriptions/${prescription.prescription_code}/print-labels`,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * 2. Lấy danh sách các đơn thuốc gần nhất
 */
exports.getAllPrescriptions = async (req, res) => {
  try {
    const prescriptions = await Prescription.find({})
      .sort({ created_at: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      count: prescriptions.length,
      data: prescriptions,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. Lấy chi tiết đơn thuốc kèm toàn bộ mã QR (JSON) để gửi Zalo ZNS / SMS hoặc hiển thị
 */
exports.getPrescriptionQrDetails = async (req, res) => {
  try {
    const { codeOrId } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(codeOrId);
    const query = isObjectId ? { _id: codeOrId } : { prescription_code: codeOrId.trim() };

    const prescription = await Prescription.findOne(query);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hồ sơ đơn thuốc này.',
      });
    }

    const masterQr = await buildQrDataUrl(prescription.master_qr_token);
    const itemQrs = await Promise.all(
      prescription.items.map(async (item) => {
        const qr = await buildQrDataUrl(item.item_qr_token);
        return {
          item_id: item._id,
          medication_name: item.medication_snapshot.name,
          quantity: item.quantity,
          unit: item.medication_snapshot.unit,
          dosage_instruction: item.dosage_instruction,
          item_qr_token: item.item_qr_token,
          scan_url: qr.scanUrl,
          qr_image_base64: qr.qrDataUrl,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        prescription_code: prescription.prescription_code,
        patient: prescription.patient,
        doctor: prescription.doctor,
        scan_stats: prescription.scan_stats,
        master_qr: {
          token: prescription.master_qr_token,
          scan_url: masterQr.scanUrl,
          qr_image_base64: masterQr.qrDataUrl,
        },
        item_qrs: itemQrs,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. Trang In Tem Nhiệt QR Code (Dán vào Hồ sơ bệnh án & Dán lên từng lọ thuốc)
 * Chuẩn kích thước tem nhiệt bệnh viện (50mm x 30mm hoặc in trên trang A4)
 */
exports.renderPrintLabelsPage = async (req, res) => {
  try {
    const { codeOrId } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(codeOrId);
    const query = isObjectId ? { _id: codeOrId } : { prescription_code: codeOrId.trim() };

    const prescription = await Prescription.findOne(query);
    if (!prescription) {
      return res.status(404).send('<h3>Không tìm thấy đơn thuốc để in tem QR!</h3>');
    }

    const masterQr = await buildQrDataUrl(prescription.master_qr_token);
    const itemLabels = await Promise.all(
      prescription.items.map(async (item) => {
        const qr = await buildQrDataUrl(item.item_qr_token);
        return {
          name: item.medication_snapshot.name,
          qty: `${item.quantity} ${item.medication_snapshot.unit}`,
          dosage: item.dosage_instruction,
          timing: item.usage_timing,
          token: item.item_qr_token,
          qrDataUrl: qr.qrDataUrl,
          scanUrl: qr.scanUrl,
        };
      })
    );

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>In Tem QR Hướng Dẫn Dùng Thuốc - ${prescription.prescription_code}</title>
  <style>
    * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
    body { background: #f1f5f9; margin: 0; padding: 20px; color: #111827; }
    .toolbar {
      max-width: 820px; margin: 0 auto 20px auto; background: #fff; padding: 15px 20px;
      border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      display: flex; justify-content: space-between; align-items: center;
    }
    .btn-print {
      background: #0284c7; color: #fff; border: none; padding: 10px 20px;
      font-size: 15px; font-weight: bold; border-radius: 6px; cursor: pointer;
    }
    .btn-print:hover { background: #0369a1; }
    .labels-grid {
      max-width: 820px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 16px;
    }
    /* Chuẩn kích thước tem nhiệt 70mm x 40mm sắc nét */
    .thermal-label {
      width: 320px; min-height: 175px; background: #fff; border: 2px dashed #334155;
      border-radius: 8px; padding: 10px; display: flex; flex-direction: row;
      align-items: center; gap: 10px; page-break-inside: avoid;
    }
    .thermal-label.master-label {
      border: 2px solid #0284c7; background: #f0f9ff;
    }
    .qr-box { text-align: center; flex-shrink: 0; width: 110px; }
    .qr-box img { width: 105px; height: 105px; display: block; margin: 0 auto; }
    .qr-code-text { font-size: 10px; color: #475569; margin-top: 2px; font-family: monospace; }
    .info-box { flex: 1; font-size: 12px; line-height: 1.35; overflow: hidden; }
    .badge {
      display: inline-block; background: #0284c7; color: #fff; font-size: 10px;
      font-weight: bold; padding: 2px 6px; border-radius: 4px; margin-bottom: 4px;
    }
    .badge.item-badge { background: #059669; }
    .med-title { font-weight: bold; font-size: 13px; color: #0f172a; margin-bottom: 4px; }
    .dosage { font-weight: bold; color: #b91c1c; margin-top: 4px; font-size: 12px; }
    @media print {
      body { background: #fff; padding: 0; }
      .toolbar { display: none; }
      .thermal-label { border: 1px solid #000; background: #fff !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <h2 style="margin:0 0 4px 0; font-size:18px;">Bản In Tem QR Hướng Dẫn Sử Dụng Thuốc</h2>
      <div style="font-size:13px; color:#475569;">
        Mã HS: <b>${prescription.prescription_code}</b> | Bệnh nhân: <b>${prescription.patient.full_name} (${prescription.patient.birth_year})</b>
      </div>
    </div>
    <button class="btn-print" onclick="window.print()">🖨️ IN TEM NGAY (Ctrl + P)</button>
  </div>

  <div class="labels-grid">
    <!-- 1. TEM QR TỔNG: DÁN VÀO SỔ KHÁM BỆNH HOẶC ĐƠN THUỐC -->
    <div class="thermal-label master-label">
      <div class="qr-box">
        <img src="${masterQr.qrDataUrl}" alt="Master QR" />
        <div class="qr-code-text">${prescription.master_qr_token}</div>
      </div>
      <div class="info-box">
        <span class="badge">TEM DÁN HỒ SƠ / ĐƠN THUỐC</span>
        <div class="med-title">BN: ${prescription.patient.full_name} (${prescription.patient.birth_year})</div>
        <div>Mã đơn: <b>${prescription.prescription_code}</b></div>
        <div>Khoa: ${prescription.doctor.department}</div>
        <div class="dosage">📱 Quét QR bằng Zalo/Camera để xem Video & Hình ảnh hướng dẫn toàn bộ ${prescription.items.length} thuốc trong đơn.</div>
      </div>
    </div>

    <!-- 2. CÁC TEM QR LẺ: DÁN TRỰC TIẾP LÊN TỪNG HỘP / LỌ THUỐC -->
    ${itemLabels
      .map(
        (item, idx) => `
    <div class="thermal-label">
      <div class="qr-box">
        <img src="${item.qrDataUrl}" alt="Item QR" />
        <div class="qr-code-text">${item.token}</div>
      </div>
      <div class="info-box">
        <span class="badge item-badge">TEM DÁN LỌ THUỐC #${idx + 1}</span>
        <div class="med-title">${item.name}</div>
        <div>BN: <b>${prescription.patient.full_name}</b> | SL: <b>${item.qty}</b></div>
        <div class="dosage">Liều dùng: ${item.dosage}</div>
        <div style="font-size:11px; color:#334155; margin-top:3px;">👉 Quét mã xem Video/Ảnh cách dùng</div>
      </div>
    </div>`
      )
      .join('')}
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send(`Lỗi khi tạo bản in tem QR: ${error.message}`);
  }
};

/**
 * 5. API Thống kê lượt quét QR báo cáo Giám đốc bệnh viện
 */
exports.getScanAnalytics = async (req, res) => {
  try {
    const totalPrescriptions = await Prescription.countDocuments();
    const totalScanLogs = await QrScanLog.countDocuments();
    const recentLogs = await QrScanLog.find({})
      .sort({ scanned_at: -1 })
      .limit(20)
      .populate('medication_id', 'code name');

    return res.status(200).json({
      success: true,
      data: {
        total_prescriptions_issued: totalPrescriptions,
        total_qr_scans: totalScanLogs,
        recent_scans: recentLogs,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
