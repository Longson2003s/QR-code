// File: src/routes/qrViewer.routes.js
const express = require('express');
const router = express.Router();
const qrViewerController = require('../controllers/qrViewer.controller');

// API trả về dữ liệu JSON của mã QR
router.get('/api/:token', qrViewerController.getQrGuideJson);

// Đường dẫn ngắn gọn khi bệnh nhân quét mã QR bằng Camera / Zalo: /q/:token
router.get('/:token', qrViewerController.renderPatientQrPage);

module.exports = router;
