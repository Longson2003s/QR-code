// File: src/controllers/medication.controller.js
const os = require('os');
const QRCode = require('qrcode');
const Medication = require('../models/Medication.model');
const QrScanLog = require('../models/QrScanLog.model');
const { generateQrToken } = require('../utils/tokenGenerator');

/**
 * Tự động lấy địa chỉ IPv4 mạng LAN/Wi-Fi của máy chủ
 */
const getServerLanIp = () => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
};

/**
 * Xác định URL gốc để nhúng vào mã QR dán trên hộp thuốc
 * Ưu tiên: PUBLIC_EXTERNAL_URL / PUBLIC_QR_BASE_URL (VD: https://derby-student-ongoing-uncle.trycloudflare.com/q)
 */
const resolveBaseQrUrl = (req) => {
  if (req && req.query && req.query.base_url) {
    return req.query.base_url.trim().replace(/\/+$/, '');
  }

  // 1. Ưu tiên cao nhất: URL Public cố định hoặc Tunnel đang hoạt động
  if (process.env.PUBLIC_EXTERNAL_URL) {
    const cleanOrigin = process.env.PUBLIC_EXTERNAL_URL.trim().replace(/\/+$/, '');
    return `${cleanOrigin}/q`;
  }

  if (global.PUBLIC_QR_BASE_URL) {
    return global.PUBLIC_QR_BASE_URL.replace(/\/+$/, '');
  }

  // 2. Nếu cấu hình BASE_QR_URL là tên miền Public trong .env
  const envUrl = (process.env.BASE_QR_URL || '').trim().replace(/\/+$/, '');
  if (
    envUrl &&
    !envUrl.includes('localhost') &&
    !envUrl.includes('127.0.0.1') &&
    !envUrl.startsWith('http://10.') &&
    !envUrl.startsWith('http://192.168.')
  ) {
    return envUrl;
  }

  // 3. Nếu truy cập qua tên miền hoặc IP mạng LAN trên trình duyệt
  if (req && req.headers && req.headers.host) {
    const host = req.headers.host;
    if (!host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      return `${proto}://${host}/q`;
    }
  }

  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  // 4. Dự phòng: IP mạng LAN của máy chủ
  const port = process.env.PORT || 3000;
  return `http://${getServerLanIp()}:${port}/q`;
};

/**
 * Đảm bảo mọi loại thuốc (kể cả thuốc đã nhập từ phiên bản cũ trong DB) đều có qr_token riêng biệt
 */
const ensureMedicationQrToken = async (med) => {
  if (!med.qr_token) {
    let token = generateQrToken('m', 4);
    if (med.code === 'MED_SYMBICORT_160') token = 'm_symbicort';
    else if (med.code === 'MED_INSULIN_FLEXPEN') token = 'm_insulin';

    med.qr_token = token;
    await Medication.updateOne({ _id: med._id }, { $set: { qr_token: token } });
  }
  return med.qr_token;
};

/**
 * Sinh ảnh QR Code dạng DataURL (Base64) tối ưu cho tem nhỏ dán hộp thuốc
 */
const buildMedicationQrData = async (med, req = null) => {
  const token = await ensureMedicationQrToken(med);
  const baseUrl = resolveBaseQrUrl(req);
  const scanUrl = `${baseUrl}/${encodeURIComponent(token)}`;
  const qrDataUrl = await QRCode.toDataURL(scanUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 200,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
  return {
    token,
    scanUrl,
    qrDataUrl,
    baseUrl,
    printUrl: `/api/medications/${encodeURIComponent(med._id.toString())}/print-qr`,
  };
};

/**
 * Tìm thuốc theo ID, Mã thuốc (code) hoặc Mã QR (qr_token)
 */
const findMedicationByIdentifier = async (idOrCode) => {
  const clean = (idOrCode || '').trim();
  if (!clean) return null;

  if (/^[0-9a-fA-F]{24}$/.test(clean)) {
    const byId = await Medication.findById(clean);
    if (byId) return byId;
  }

  return await Medication.findOne({
    $or: [
      { code: clean.toUpperCase() },
      { code: clean },
      { qr_token: clean },
      { qr_token: clean.toLowerCase() },
    ],
  });
};

/**
 * 1. Lấy danh sách toàn bộ thuốc trong kho hướng dẫn kèm ảnh QR riêng biệt của từng thuốc
 */
exports.getAllMedications = async (req, res) => {
  try {
    const { keyword, is_active } = req.query;
    const filter = {};

    if (is_active !== undefined) {
      filter.is_active = is_active === 'true';
    }

    if (keyword) {
      const regex = new RegExp(keyword.trim(), 'i');
      filter.$or = [
        { code: regex },
        { name: regex },
        { active_ingredient: regex },
        { qr_token: regex },
      ];
    }

    const medications = await Medication.find(filter).sort({ updated_at: -1 });

    const enrichedData = await Promise.all(
      medications.map(async (med) => {
        const qr = await buildMedicationQrData(med, req);
        const obj = med.toObject();
        return {
          ...obj,
          qr_token: qr.token,
          qr_scan_url: qr.scanUrl,
          qr_image_base64: qr.qrDataUrl,
          print_qr_url: qr.printUrl,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: enrichedData.length,
      data: enrichedData,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. Lấy chi tiết 1 loại thuốc và mã QR theo ID, Mã thuốc hoặc QR Token
 */
exports.getMedicationDetail = async (req, res) => {
  try {
    const { idOrCode } = req.params;
    const medication = await findMedicationByIdentifier(idOrCode);

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy loại thuốc này trong kho hướng dẫn.',
      });
    }

    const qr = await buildMedicationQrData(medication, req);
    return res.status(200).json({
      success: true,
      data: {
        ...medication.toObject(),
        qr_token: qr.token,
        qr_scan_url: qr.scanUrl,
        qr_image_base64: qr.qrDataUrl,
        print_qr_url: qr.printUrl,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. Tạo mới 1 loại thuốc trong kho kèm hướng dẫn chuẩn & sinh mã QR riêng biệt
 */
exports.createMedication = async (req, res) => {
  try {
    const {
      code,
      qr_token,
      name,
      active_ingredient,
      dosage_form,
      unit,
      standard_usage,
      storage_instruction,
      general_warning,
      hotline_support,
      guides,
    } = req.body;

    const cleanCode = (code || '').toUpperCase().trim();
    const existing = await Medication.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Mã thuốc ${cleanCode} đã tồn tại trong kho thuốc hướng dẫn.`,
      });
    }

    const medication = await Medication.create({
      code: cleanCode,
      qr_token: qr_token ? qr_token.trim() : generateQrToken('m', 4),
      name,
      active_ingredient,
      dosage_form,
      unit,
      standard_usage,
      storage_instruction,
      general_warning,
      hotline_support,
      guides: Array.isArray(guides) ? guides : [],
    });

    const qr = await buildMedicationQrData(medication, req);

    return res.status(201).json({
      success: true,
      message: 'Đã thêm thuốc vào kho hướng dẫn và tạo mã QR riêng thành công.',
      data: {
        ...medication.toObject(),
        qr_token: qr.token,
        qr_scan_url: qr.scanUrl,
        qr_image_base64: qr.qrDataUrl,
        print_qr_url: qr.printUrl,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * 4. Cập nhật thông tin thuốc và các bước hướng dẫn (Text, Ảnh, Video MP4)
 */
exports.updateMedication = async (req, res) => {
  try {
    const { id } = req.params;
    const medication = await findMedicationByIdentifier(id);

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thuốc cần cập nhật.',
      });
    }

    const updatableFields = [
      'name',
      'active_ingredient',
      'dosage_form',
      'unit',
      'standard_usage',
      'storage_instruction',
      'general_warning',
      'hotline_support',
      'guides',
      'is_active',
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        medication[field] = req.body[field];
      }
    });

    await medication.save();
    const qr = await buildMedicationQrData(medication, req);

    return res.status(200).json({
      success: true,
      message: 'Cập nhật hướng dẫn sử dụng thuốc thành công.',
      data: {
        ...medication.toObject(),
        qr_token: qr.token,
        qr_scan_url: qr.scanUrl,
        qr_image_base64: qr.qrDataUrl,
        print_qr_url: qr.printUrl,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * 5. Xóa 1 loại thuốc khỏi kho hướng dẫn
 */
exports.deleteMedication = async (req, res) => {
  try {
    const { id } = req.params;
    const medication = await findMedicationByIdentifier(id);
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy loại thuốc cần xóa.',
      });
    }

    await Medication.findByIdAndDelete(medication._id);
    return res.status(200).json({
      success: true,
      message: `Đã xóa thuốc "${medication.name}" khỏi kho hướng dẫn.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 6. Upload File Media (Hình ảnh hoặc Video MP4) và trả về URL chuẩn
 */
exports.uploadGuideMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn file Hình ảnh hoặc Video MP4 để tải lên.',
      });
    }

    const isVideo = req.file.mimetype === 'video/mp4';
    const mediaType = isVideo ? 'VIDEO_MP4' : 'IMAGE';

    const mediaUrl = isVideo
      ? `/api/media/videos/${req.file.filename}`
      : `/public/media/images/${req.file.filename}`;

    return res.status(200).json({
      success: true,
      message: 'Tải lên file hướng dẫn thành công.',
      data: {
        filename: req.file.filename,
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        size_bytes: req.file.size,
        media_type: mediaType,
        media_url: mediaUrl,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 7. Trang In Tem Mã QR Nhỏ Riêng Biệt Theo Từng Loại Thuốc (Dán Vào Hộp Thuốc / Lọ Thuốc)
 */
exports.renderMedicationPrintQrPage = async (req, res) => {
  try {
    const { idOrCode } = req.params;
    const defaultCopies = Math.min(Math.max(parseInt(req.query.copies, 10) || 12, 1), 200);
    const defaultSize = ['22x22', '35x22', '50x30'].includes(req.query.size)
      ? req.query.size
      : '35x22';

    const medication = await findMedicationByIdentifier(idOrCode);
    if (!medication) {
      return res.status(404).send('<h3>Không tìm thấy loại thuốc này trong kho để in mã QR!</h3>');
    }

    const qr = await buildMedicationQrData(medication, req);
    const medDataJson = JSON.stringify({
      code: medication.code,
      qr_token: qr.token,
      name: medication.name,
      unit: medication.unit,
      dosage_form: medication.dosage_form || '',
      standard_usage: medication.standard_usage || '',
      storage_instruction: medication.storage_instruction || '',
      qrDataUrl: qr.qrDataUrl,
      scanUrl: qr.scanUrl,
    });

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>In Mã QR Nhỏ Dán Hộp Thuốc - ${medication.name}</title>
  <style>
    * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
    body { background: #f1f5f9; margin: 0; padding: 20px; color: #0f172a; }

    .toolbar {
      max-width: 980px; margin: 0 auto 20px auto; background: #ffffff; padding: 16px 20px;
      border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.08);
      border: 1px solid #cbd5e1;
    }
    .toolbar-top {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;
      border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 12px;
    }
    .toolbar-controls {
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
    }
    .control-group {
      display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: bold; color: #334155;
    }
    .control-group select, .control-group input {
      padding: 6px 10px; border: 1px solid #94a3b8; border-radius: 6px; font-size: 13px; font-weight: bold;
    }
    .quick-qty-btn {
      background: #e2e8f0; border: 1px solid #cbd5e1; color: #1e293b;
      padding: 5px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer;
    }
    .quick-qty-btn:hover { background: #cbd5e1; }
    .btn-print {
      background: #0284c7; color: #fff; border: none; padding: 10px 22px;
      font-size: 15px; font-weight: bold; border-radius: 8px; cursor: pointer;
      box-shadow: 0 2px 4px rgba(2,132,199,0.3);
    }
    .btn-print:hover { background: #0369a1; }

    .sheet-container {
      max-width: 980px; margin: 0 auto; background: #fff; padding: 20px;
      border-radius: 12px; border: 1px solid #cbd5e1;
    }
    .labels-grid {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start;
    }

    /* 1. Cỡ tem siêu nhỏ 22mm x 22mm (Dán lọ thuốc nhỏ / bút tiêm / vỉ thuốc) */
    .box-label.size-22x22 {
      width: 24mm; height: 24mm; padding: 1.2mm;
      border: 1px dashed #475569; border-radius: 3px; background: #fff;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; page-break-inside: avoid; overflow: hidden;
    }
    .box-label.size-22x22 .qr-img { width: 15.5mm; height: 15.5mm; display: block; }
    .box-label.size-22x22 .med-name {
      font-size: 6.5px; font-weight: bold; line-height: 1.1; max-height: 4.5mm;
      overflow: hidden; margin-top: 0.8mm; word-break: break-word;
    }

    /* 2. Cỡ tem nhỏ chuẩn nhà thuốc 35mm x 22mm (Dán trực tiếp lên vỏ hộp thuốc) */
    .box-label.size-35x22 {
      width: 38mm; height: 24mm; padding: 1.5mm 2mm;
      border: 1px dashed #334155; border-radius: 4px; background: #fff;
      display: flex; flex-direction: row; align-items: center; gap: 2mm;
      page-break-inside: avoid; overflow: hidden;
    }
    .box-label.size-35x22 .qr-col { flex-shrink: 0; text-align: center; width: 17mm; }
    .box-label.size-35x22 .qr-img { width: 16.5mm; height: 16.5mm; display: block; margin: 0 auto; }
    .box-label.size-35x22 .qr-token-txt { font-size: 6.5px; font-family: monospace; color: #334155; margin-top: 0.5mm; }
    .box-label.size-35x22 .info-col { flex: 1; overflow: hidden; display: flex; flex-direction: column; justify-content: center; }
    .box-label.size-35x22 .label-tag {
      display: inline-block; background: #0f172a; color: #fff; font-size: 6.5px;
      font-weight: bold; padding: 1px 3px; border-radius: 2px; margin-bottom: 1mm; width: fit-content;
    }
    .box-label.size-35x22 .med-name {
      font-size: 8.5px; font-weight: bold; color: #000; line-height: 1.15;
      max-height: 9mm; overflow: hidden; margin-bottom: 1mm;
    }
    .box-label.size-35x22 .med-code { font-size: 7px; color: #334155; font-family: monospace; }
    .box-label.size-35x22 .scan-cta {
      font-size: 7px; font-weight: bold; color: #0369a1; margin-top: 1mm; line-height: 1.1;
    }
    .box-label.size-35x22 .med-usage { display: none; }

    /* 3. Cỡ tem vừa 50mm x 30mm (Dán hộp thuốc lớn, có kèm cách dùng/bảo quản) */
    .box-label.size-50x30 {
      width: 54mm; height: 32mm; padding: 2mm 2.5mm;
      border: 1px dashed #334155; border-radius: 5px; background: #fff;
      display: flex; flex-direction: row; align-items: center; gap: 2.5mm;
      page-break-inside: avoid; overflow: hidden;
    }
    .box-label.size-50x30 .qr-col { flex-shrink: 0; text-align: center; width: 22mm; }
    .box-label.size-50x30 .qr-img { width: 21mm; height: 21mm; display: block; margin: 0 auto; }
    .box-label.size-50x30 .qr-token-txt { font-size: 7.5px; font-family: monospace; color: #334155; margin-top: 0.8mm; }
    .box-label.size-50x30 .info-col { flex: 1; overflow: hidden; }
    .box-label.size-50x30 .label-tag {
      display: inline-block; background: #0284c7; color: #fff; font-size: 7.5px;
      font-weight: bold; padding: 1.5px 4px; border-radius: 2px; margin-bottom: 1mm;
    }
    .box-label.size-50x30 .med-name {
      font-size: 10px; font-weight: bold; color: #000; line-height: 1.2;
      max-height: 10mm; overflow: hidden; margin-bottom: 1mm;
    }
    .box-label.size-50x30 .med-code { font-size: 8px; color: #334155; }
    .box-label.size-50x30 .med-usage {
      font-size: 8px; color: #b91c1c; font-weight: bold; margin-top: 1mm;
      max-height: 6.5mm; overflow: hidden; line-height: 1.15;
    }
    .box-label.size-50x30 .scan-cta {
      font-size: 7.5px; font-weight: bold; color: #0369a1; margin-top: 1mm;
    }

    @media print {
      body { background: #fff; padding: 0; margin: 0; }
      .toolbar { display: none !important; }
      .sheet-container { border: none; padding: 0; max-width: 100%; }
      .box-label { border: 0.5px solid #94a3b8; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-top">
      <div>
        <div style="font-size:12px; font-weight:bold; color:#0284c7; text-transform:uppercase;">
          Kho Thuốc Hướng Dẫn • In Tem Mã QR Nhỏ Dán Hộp Thuốc
        </div>
        <h2 style="margin:4px 0; font-size:19px;">💊 ${medication.name}</h2>
        <div style="font-size:13px; color:#475569;">
          Mã thuốc: <b>${medication.code}</b> | Mã QR riêng: <b>${qr.token}</b> | Đơn vị: <b>${medication.unit}</b>
        </div>
        <div style="font-size:12px; color:#0369a1; margin-top:4px;">
          🔗 Link nhúng trong mã QR: <a href="${qr.scanUrl}" target="_blank" style="color:#0284c7; font-weight:bold;">${qr.scanUrl}</a>
        </div>
      </div>
      <button class="btn-print" onclick="window.print()">🖨️ BẤM IN TEM QR NGAY (Ctrl + P)</button>
    </div>

    <div class="toolbar-controls">
      <div class="control-group">
        <label for="select-size">📐 Kích cỡ tem nhỏ dán hộp:</label>
        <select id="select-size" onchange="renderLabels()">
          <option value="22x22" ${defaultSize === '22x22' ? 'selected' : ''}>Siêu nhỏ 22x22mm (Dán lọ nhỏ / bút tiêm / vỉ thuốc)</option>
          <option value="35x22" ${defaultSize === '35x22' ? 'selected' : ''}>Nhỏ chuẩn 35x22mm (Dán vỏ hộp thuốc tiêu chuẩn)</option>
          <option value="50x30" ${defaultSize === '50x30' ? 'selected' : ''}>Tem vừa 50x30mm (Hộp lớn - Kèm cách dùng/bảo quản)</option>
        </select>
      </div>

      <div class="control-group">
        <label for="input-copies">🔢 Số lượng tem in ra (số hộp thuốc):</label>
        <input type="number" id="input-copies" value="${defaultCopies}" min="1" max="200" style="width:75px;" oninput="renderLabels()" />
      </div>

      <div class="control-group">
        <span>Chọn nhanh:</span>
        <button type="button" class="quick-qty-btn" onclick="setCopies(1)">1 tem</button>
        <button type="button" class="quick-qty-btn" onclick="setCopies(6)">6 tem</button>
        <button type="button" class="quick-qty-btn" onclick="setCopies(12)">12 tem</button>
        <button type="button" class="quick-qty-btn" onclick="setCopies(24)">24 tem</button>
        <button type="button" class="quick-qty-btn" onclick="setCopies(48)">48 tem</button>
      </div>
    </div>
  </div>

  <div class="sheet-container">
    <div id="labels-grid" class="labels-grid"></div>
  </div>

  <script>
    const MED_DATA = ${medDataJson};

    function setCopies(n) {
      document.getElementById('input-copies').value = n;
      renderLabels();
    }

    function renderLabels() {
      const size = document.getElementById('select-size').value;
      const copies = Math.min(Math.max(parseInt(document.getElementById('input-copies').value, 10) || 1, 1), 200);
      const grid = document.getElementById('labels-grid');

      let html = '';
      for (let i = 0; i < copies; i++) {
        if (size === '22x22') {
          html += \`
            <div class="box-label size-22x22">
              <img class="qr-img" src="\${MED_DATA.qrDataUrl}" alt="QR" />
              <div class="med-name">\${MED_DATA.name}</div>
            </div>
          \`;
        } else {
          html += \`
            <div class="box-label size-\${size}">
              <div class="qr-col">
                <img class="qr-img" src="\${MED_DATA.qrDataUrl}" alt="QR" />
                <div class="qr-token-txt">\${MED_DATA.qr_token}</div>
              </div>
              <div class="info-col">
                <span class="label-tag">HƯỚNG DẪN DÙNG THUỐC</span>
                <div class="med-name">\${MED_DATA.name}</div>
                <div class="med-code">ĐV: <b>\${MED_DATA.unit}</b></div>
                \${MED_DATA.standard_usage ? \`<div class="med-usage">\${MED_DATA.standard_usage}</div>\` : ''}
                <div class="scan-cta">📱 Quét QR xem Video/Ảnh HDSD</div>
              </div>
            </div>
          \`;
        }
      }
      grid.innerHTML = html;
    }

    renderLabels();
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send(`Lỗi khi tạo bản in tem QR cho thuốc: ${error.message}`);
  }
};

/**
 * 8. Trang In Hàng Loạt Tem QR Nhỏ Cho Nhiều Loại Thuốc Trong Kho
 * URL: GET /api/medications/print-batch?items=ID1:5|ID2:10&size=35x22
 */
exports.renderBatchPrintQrPage = async (req, res) => {
  try {
    const defaultSize = ['22x22', '35x22', '50x30'].includes(req.query.size)
      ? req.query.size
      : '35x22';
    const itemsParam = (req.query.items || '').trim();

    const allMedications = await Medication.find({ is_active: true }).sort({ updated_at: -1 });
    if (allMedications.length === 0) {
      return res.status(404).send('<h3>Kho thuốc hiện đang trống. Vui lòng thêm thuốc trước khi in tem QR!</h3>');
    }

    // Parse số lượng tem của từng thuốc từ query ?items=ID1:5|ID2:10
    const requestedCounts = {};
    if (itemsParam) {
      const separator = itemsParam.includes('|') ? '|' : ',';
      itemsParam.split(separator).forEach((pair) => {
        const lastColon = pair.lastIndexOf(':');
        if (lastColon > 0) {
          const key = pair.slice(0, lastColon).trim();
          const qty = pair.slice(lastColon + 1).trim();
          requestedCounts[key] = Math.min(Math.max(parseInt(qty, 10) || 1, 1), 200);
        }
      });
    }

    const hasFilter = Object.keys(requestedCounts).length > 0;
    const enrichedList = [];

    for (const med of allMedications) {
      const qr = await buildMedicationQrData(med, req);
      const idStr = med._id.toString();
      const count = hasFilter
        ? requestedCounts[idStr] || requestedCounts[med.code] || requestedCounts[qr.token] || 0
        : 4;

      if (count > 0) {
        enrichedList.push({
          code: med.code,
          qr_token: qr.token,
          name: med.name,
          unit: med.unit,
          standard_usage: med.standard_usage || '',
          qrDataUrl: qr.qrDataUrl,
          scanUrl: qr.scanUrl,
          copies: count,
        });
      }
    }

    const batchJson = JSON.stringify(enrichedList);

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>In Bảng Tem Mã QR Nhỏ Kho Thuốc (Dán Hộp Thuốc)</title>
  <style>
    * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
    body { background: #f1f5f9; margin: 0; padding: 20px; color: #0f172a; }
    .toolbar {
      max-width: 1020px; margin: 0 auto 20px auto; background: #fff; padding: 16px 20px;
      border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.08);
      display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;
    }
    .btn-print {
      background: #0284c7; color: #fff; border: none; padding: 10px 22px;
      font-size: 15px; font-weight: bold; border-radius: 8px; cursor: pointer;
    }
    .sheet-container {
      max-width: 1020px; margin: 0 auto; background: #fff; padding: 20px;
      border-radius: 12px; border: 1px solid #cbd5e1;
    }
    .labels-grid { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; }

    .box-label.size-22x22 {
      width: 24mm; height: 24mm; padding: 1.2mm;
      border: 1px dashed #475569; border-radius: 3px; background: #fff;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; page-break-inside: avoid; overflow: hidden;
    }
    .box-label.size-22x22 .qr-img { width: 15.5mm; height: 15.5mm; display: block; }
    .box-label.size-22x22 .med-name {
      font-size: 6.5px; font-weight: bold; line-height: 1.1; max-height: 4.5mm;
      overflow: hidden; margin-top: 0.8mm;
    }

    .box-label.size-35x22 {
      width: 38mm; height: 24mm; padding: 1.5mm 2mm;
      border: 1px dashed #334155; border-radius: 4px; background: #fff;
      display: flex; flex-direction: row; align-items: center; gap: 2mm;
      page-break-inside: avoid; overflow: hidden;
    }
    .box-label.size-35x22 .qr-col { flex-shrink: 0; text-align: center; width: 17mm; }
    .box-label.size-35x22 .qr-img { width: 16.5mm; height: 16.5mm; display: block; margin: 0 auto; }
    .box-label.size-35x22 .qr-token-txt { font-size: 6.5px; font-family: monospace; color: #334155; margin-top: 0.5mm; }
    .box-label.size-35x22 .info-col { flex: 1; overflow: hidden; }
    .box-label.size-35x22 .label-tag {
      display: inline-block; background: #0f172a; color: #fff; font-size: 6.5px;
      font-weight: bold; padding: 1px 3px; border-radius: 2px; margin-bottom: 1mm;
    }
    .box-label.size-35x22 .med-name {
      font-size: 8.5px; font-weight: bold; color: #000; line-height: 1.15;
      max-height: 9mm; overflow: hidden; margin-bottom: 1mm;
    }
    .box-label.size-35x22 .med-code { font-size: 7px; color: #334155; font-family: monospace; }
    .box-label.size-35x22 .scan-cta { font-size: 7px; font-weight: bold; color: #0369a1; margin-top: 1mm; }

    .box-label.size-50x30 {
      width: 54mm; height: 32mm; padding: 2mm 2.5mm;
      border: 1px dashed #334155; border-radius: 5px; background: #fff;
      display: flex; flex-direction: row; align-items: center; gap: 2.5mm;
      page-break-inside: avoid; overflow: hidden;
    }
    .box-label.size-50x30 .qr-col { flex-shrink: 0; text-align: center; width: 22mm; }
    .box-label.size-50x30 .qr-img { width: 21mm; height: 21mm; display: block; margin: 0 auto; }
    .box-label.size-50x30 .qr-token-txt { font-size: 7.5px; font-family: monospace; color: #334155; margin-top: 0.8mm; }
    .box-label.size-50x30 .info-col { flex: 1; overflow: hidden; }
    .box-label.size-50x30 .label-tag {
      display: inline-block; background: #0284c7; color: #fff; font-size: 7.5px;
      font-weight: bold; padding: 1.5px 4px; border-radius: 2px; margin-bottom: 1mm;
    }
    .box-label.size-50x30 .med-name {
      font-size: 10px; font-weight: bold; color: #000; line-height: 1.2;
      max-height: 10mm; overflow: hidden; margin-bottom: 1mm;
    }
    .box-label.size-50x30 .med-code { font-size: 8px; color: #334155; }
    .box-label.size-50x30 .med-usage {
      font-size: 8px; color: #b91c1c; font-weight: bold; margin-top: 1mm;
      max-height: 6.5mm; overflow: hidden;
    }
    .box-label.size-50x30 .scan-cta { font-size: 7.5px; font-weight: bold; color: #0369a1; margin-top: 1mm; }

    @media print {
      body { background: #fff; padding: 0; margin: 0; }
      .toolbar { display: none !important; }
      .sheet-container { border: none; padding: 0; max-width: 100%; }
      .box-label { border: 0.5px solid #94a3b8; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <h2 style="margin:0 0 4px 0; font-size:18px;">🖨️ Bản In Hàng Loạt Tem Mã QR Nhỏ Dán Hộp Thuốc</h2>
      <div style="font-size:13px; color:#475569;">
        Đang hiển thị <b>${enrichedList.length} loại thuốc</b> trong kho. Mỗi loại thuốc có mã QR riêng biệt.
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:12px;">
      <select id="batch-size" onchange="renderBatch()" style="padding:8px 12px; border-radius:6px; border:1px solid #94a3b8; font-weight:bold;">
        <option value="22x22" ${defaultSize === '22x22' ? 'selected' : ''}>Cỡ siêu nhỏ 22x22mm</option>
        <option value="35x22" ${defaultSize === '35x22' ? 'selected' : ''}>Cỡ nhỏ chuẩn 35x22mm</option>
        <option value="50x30" ${defaultSize === '50x30' ? 'selected' : ''}>Cỡ vừa 50x30mm</option>
      </select>
      <button class="btn-print" onclick="window.print()">🖨️ IN TẤT CẢ TEM QR (Ctrl + P)</button>
    </div>
  </div>

  <div class="sheet-container">
    <div id="batch-grid" class="labels-grid"></div>
  </div>

  <script>
    const BATCH_ITEMS = ${batchJson};

    function renderBatch() {
      const size = document.getElementById('batch-size').value;
      const grid = document.getElementById('batch-grid');
      let html = '';

      BATCH_ITEMS.forEach((med) => {
        for (let i = 0; i < med.copies; i++) {
          if (size === '22x22') {
            html += \`
              <div class="box-label size-22x22">
                <img class="qr-img" src="\${med.qrDataUrl}" alt="QR" />
                <div class="med-name">\${med.name}</div>
              </div>
            \`;
          } else {
            html += \`
              <div class="box-label size-\${size}">
                <div class="qr-col">
                  <img class="qr-img" src="\${med.qrDataUrl}" alt="QR" />
                  <div class="qr-token-txt">\${med.qr_token}</div>
                </div>
                <div class="info-col">
                  <span class="label-tag">HƯỚNG DẪN DÙNG THUỐC</span>
                  <div class="med-name">\${med.name}</div>
                  <div class="med-code">ĐV: <b>\${med.unit}</b></div>
                  \${med.standard_usage ? \`<div class="med-usage">\${med.standard_usage}</div>\` : ''}
                  <div class="scan-cta">📱 Quét QR xem Video/Ảnh HDSD</div>
                </div>
              </div>
            \`;
          }
        }
      });

      grid.innerHTML = html;
    }

    renderBatch();
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send(`Lỗi khi tạo bản in tem QR hàng loạt: ${error.message}`);
  }
};

/**
 * 9. API Thống kê lượt quét mã QR theo từng loại thuốc trong kho
 */
exports.getMedicationScanAnalytics = async (req, res) => {
  try {
    const totalMedications = await Medication.countDocuments();
    const totalScans = await QrScanLog.countDocuments();

    const medicationStats = await Medication.find(
      {},
      'code qr_token name unit dosage_form scan_stats guides'
    ).sort({ 'scan_stats.total_scans': -1, updated_at: -1 });

    for (const m of medicationStats) {
      await ensureMedicationQrToken(m);
    }

    const recentLogs = await QrScanLog.find({})
      .sort({ scanned_at: -1 })
      .limit(30)
      .populate('medication_id', 'code name unit qr_token');

    return res.status(200).json({
      success: true,
      data: {
        total_medications: totalMedications,
        total_qr_scans: totalScans,
        medication_stats: medicationStats,
        recent_scans: recentLogs,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
