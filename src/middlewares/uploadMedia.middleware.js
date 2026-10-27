// File: src/middlewares/uploadMedia.middleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Đảm bảo thư mục lưu trữ luôn tồn tại
const imageDir = path.join(__dirname, '../../public/media/images');
const videoDir = path.join(__dirname, '../../public/media/videos');
fs.mkdirSync(imageDir, { recursive: true });
fs.mkdirSync(videoDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype === 'video/mp4') {
      cb(null, videoDir);
    } else if (file.mimetype.startsWith('image/')) {
      cb(null, imageDir);
    } else {
      cb(new Error('Định dạng file không được hỗ trợ! Chỉ chấp nhận Ảnh hoặc Video MP4.'), false);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBaseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e4)}`;
    cb(null, `${safeBaseName}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const allowedVideoTypes = ['video/mp4'];

  if (allowedImageTypes.includes(file.mimetype) || allowedVideoTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error('Chỉ cho phép tải lên hình ảnh (JPG, PNG, WEBP) hoặc video định dạng MP4!'),
      false
    );
  }
};

const uploadMedia = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 150 * 1024 * 1024, // Giới hạn tối đa 150MB cho 1 file Video MP4 hướng dẫn
  },
});

module.exports = uploadMedia;
