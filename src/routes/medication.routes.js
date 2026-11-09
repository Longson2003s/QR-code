// File: src/routes/medication.routes.js
const express = require('express');
const router = express.Router();
const medicationController = require('../controllers/medication.controller');
const uploadMedia = require('../middlewares/uploadMedia.middleware');

// 1. Thống kê lượt quét QR theo từng loại thuốc trong kho
router.get('/analytics/scans', medicationController.getMedicationScanAnalytics);

// 2. Trang in hàng loạt tem QR nhỏ cho nhiều loại thuốc trong kho
router.get('/print-batch', medicationController.renderBatchPrintQrPage);

// 3. Upload file Hình ảnh (.jpg, .png, .webp) hoặc Video (.mp4)
router.post('/upload-media', uploadMedia.single('file'), medicationController.uploadGuideMedia);

// 4. Danh sách & Tìm kiếm kho thuốc hướng dẫn (kèm mã QR riêng của từng thuốc)
router.get('/', medicationController.getAllMedications);

// 5. Trang in tem mã QR nhỏ riêng biệt cho 1 loại thuốc để dán vào hộp thuốc
router.get('/:idOrCode/print-qr', medicationController.renderMedicationPrintQrPage);

// 6. Chi tiết 1 loại thuốc theo ID, Mã thuốc hoặc QR Token
router.get('/:idOrCode', medicationController.getMedicationDetail);

// 7. Thêm mới loại thuốc vào kho hướng dẫn
router.post('/', medicationController.createMedication);

// 8. Cập nhật thông tin thuốc & các bước hướng dẫn
router.put('/:id', medicationController.updateMedication);

// 9. Xóa loại thuốc khỏi kho
router.delete('/:id', medicationController.deleteMedication);

module.exports = router;
