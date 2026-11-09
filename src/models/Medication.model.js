// File: src/models/Medication.model.js
const mongoose = require('mongoose');
const { generateQrToken } = require('../utils/tokenGenerator');

// Sub-schema: Từng bước hướng dẫn sử dụng (Văn bản, Hình ảnh, Video MP4)
const GuideStepSchema = new mongoose.Schema(
  {
    step_order: {
      type: Number,
      required: true,
      default: 1,
    },
    title: {
      type: String,
      required: [true, 'Tiêu đề bước hướng dẫn là bắt buộc'],
      trim: true,
    },
    content_text: {
      type: String,
      required: [true, 'Nội dung văn bản hướng dẫn là bắt buộc'],
    },
    media_type: {
      type: String,
      enum: ['TEXT_ONLY', 'IMAGE', 'VIDEO_MP4'],
      required: true,
      default: 'TEXT_ONLY',
    },
    media_url: {
      type: String,
      default: null, // Đường dẫn tới file Ảnh (.jpg/.webp) hoặc Video (.mp4)
    },
    thumbnail_url: {
      type: String,
      default: null, // Ảnh đại diện cho Video MP4 trước khi bấm Play
    },
    duration_seconds: {
      type: Number,
      default: 0, // Thời lượng video MP4 (tính bằng giây)
    },
  },
  { _id: true }
);

// Main Schema: Kho thuốc hướng dẫn (Mỗi loại thuốc có 1 mã QR riêng biệt để in dán vào hộp thuốc)
const MedicationSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Mã thuốc là bắt buộc'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    qr_token: {
      type: String,
      unique: true,
      index: true,
      default: () => generateQrToken('m', 4), // Mã token ngắn gọn (VD: m_a1b2c3d4) giúp mã QR in cỡ siêu nhỏ vẫn dễ quét
    },
    name: {
      type: String,
      required: [true, 'Tên thương mại của thuốc là bắt buộc'],
      trim: true,
    },
    active_ingredient: {
      type: String,
      trim: true,
      default: '',
    },
    dosage_form: {
      type: String,
      trim: true,
      default: '', // VD: Bình hít bột khô, Bút tiêm dưới da, Hỗn dịch uống...
    },
    unit: {
      type: String,
      required: true,
      trim: true, // VD: Hộp, Bình, Bút, Lọ, Tuýp
    },
    standard_usage: {
      type: String,
      trim: true,
      default: '', // Tóm tắt cách dùng / liều dùng chung của loại thuốc này
    },
    storage_instruction: {
      type: String,
      trim: true,
      default: '', // Hướng dẫn bảo quản hộp thuốc (VD: Nơi khô mát <30°C, hoặc Ngăn mát tủ lạnh 2-8°C)
    },
    general_warning: {
      type: String,
      default: '', // Cảnh báo chung nổi bật (màu đỏ/vàng trên giao diện khi quét hộp thuốc)
    },
    hotline_support: {
      type: String,
      default: '1900-6868 (Tổ Dược Lâm Sàng)',
    },
    // MẢNG NHÚNG: Toàn bộ các bước hướng dẫn nằm trực tiếp trong Document thuốc
    guides: {
      type: [GuideStepSchema],
      default: [],
    },
    // Thống kê số lượt quét mã QR dán trên hộp thuốc của loại thuốc này
    scan_stats: {
      total_scans: { type: Number, default: 0 },
      last_scanned_at: { type: Date, default: null },
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Đảm bảo luôn có qr_token và mảng guides được sắp xếp theo step_order tăng dần trước khi lưu
MedicationSchema.pre('save', function (next) {
  if (!this.qr_token) {
    this.qr_token = generateQrToken('m', 4);
  }
  if (this.guides && this.guides.length > 0) {
    this.guides.sort((a, b) => a.step_order - b.step_order);
  }
  next();
});

module.exports = mongoose.model('Medication', MedicationSchema);
