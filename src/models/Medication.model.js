// File: src/models/Medication.model.js
const mongoose = require('mongoose');

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

// Main Schema: Danh mục thuốc gốc
const MedicationSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Mã thuốc (HIS Code) là bắt buộc'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true, // Đánh Index để đồng bộ HIS và tra cứu tức thì
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
      trim: true, // VD: Bình, Bút, Lọ, Viên
    },
    general_warning: {
      type: String,
      default: '', // Cảnh báo chung nổi bật (màu đỏ/vàng trên giao diện BN)
    },
    hotline_support: {
      type: String,
      default: '1900-1234 (Tổ Dược Lâm Sàng)',
    },
    // MẢNG NHÚNG: Toàn bộ các bước hướng dẫn nằm trực tiếp trong Document thuốc
    guides: {
      type: [GuideStepSchema],
      default: [],
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

// Đảm bảo mảng guides luôn được sắp xếp theo step_order tăng dần trước khi lưu
MedicationSchema.pre('save', function (next) {
  if (this.guides && this.guides.length > 0) {
    this.guides.sort((a, b) => a.step_order - b.step_order);
  }
  next();
});

module.exports = mongoose.model('Medication', MedicationSchema);
