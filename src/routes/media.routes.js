// File: src/routes/media.routes.js
const express = require('express');
const router = express.Router();
const mediaStreamController = require('../controllers/mediaStream.controller');

// Endpoint phát Video MP4 chuẩn HTTP 206 Range Requests
router.get('/videos/:filename', mediaStreamController.streamVideoMp4);

module.exports = router;
