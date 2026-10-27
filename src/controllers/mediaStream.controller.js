// File: src/controllers/mediaStream.controller.js
const fs = require('fs');
const path = require('path');

/**
 * Stream Video MP4 theo từng phân đoạn (Chunk) chuẩn HTTP 206
 * Giúp bệnh nhân mở video xem ngay lập tức trên 4G/WiFi và tua nhanh mượt mà
 */
exports.streamVideoMp4 = (req, res) => {
  try {
    const { filename } = req.params;
    // Ngăn chặn lỗi Path Traversal bảo mật
    const safeFilename = path.basename(filename);
    const videoPath = path.join(__dirname, '../../public/media/videos', safeFilename);

    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy file Video MP4 hướng dẫn này trên hệ thống.',
      });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      // Mỗi chunk truyền tải tối đa 1MB để tối ưu cho mạng di động 4G của bệnh nhân
      const end = parts[1]
        ? parseInt(parts[1], 10)
        : Math.min(start + 1024 * 1024 - 1, fileSize - 1);

      if (start >= fileSize) {
        res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
        return;
      }

      const chunksize = end - start + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=86400',
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    console.error('[MediaStream] Lỗi phát video MP4:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi phát video.' });
  }
};
