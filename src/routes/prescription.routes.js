// File: src/routes/prescription.routes.js
const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescription.controller');

// Thống kê lượt quét QR báo cáo Giám đốc bệnh viện
router.get('/analytics/scans', prescriptionController.getScanAnalytics);

// Danh sách đơn thuốc gần nhất
router.get('/', prescriptionController.getAllPrescriptions);

// Tạo đơn thuốc mới & Tự động sinh mã QR
router.post('/', prescriptionController.createPrescription);

// Lấy chi tiết đơn thuốc kèm ảnh QR Base64 (để gửi Zalo ZNS / tích hợp HIS)
router.get('/:codeOrId/qr-details', prescriptionController.getPrescriptionQrDetails);

// Mở trang In Tem Nhiệt QR Code (Dán vào sổ khám hoặc dán lên từng lọ thuốc)
router.get('/:codeOrId/print-labels', prescriptionController.renderPrintLabelsPage);

module.exports = router;
