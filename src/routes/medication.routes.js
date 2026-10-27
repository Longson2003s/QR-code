// File: src/routes/medication.routes.js
const express = require('express');
const router = express.Router();
const medicationController = require('../controllers/medication.controller');
const uploadMedia = require('../middlewares/uploadMedia.middleware');

// Danh sách & Tìm kiếm thuốc
router.get('/', medicationController.getAllMedications);

// Chi tiết 1 thuốc theo ID hoặc Mã thuốc HIS
router.get('/:idOrCode', medicationController.getMedicationDetail);

// Thêm mới thuốc kèm hướng dẫn
router.post('/', medicationController.createMedication);

// Cập nhật thuốc & các bước hướng dẫn
router.put('/:id', medicationController.updateMedication);

// Upload file Hình ảnh (.jpg, .png, .webp) hoặc Video (.mp4)
router.post('/upload-media', uploadMedia.single('file'), medicationController.uploadGuideMedia);

module.exports = router;
