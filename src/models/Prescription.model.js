// File: src/models/Prescription.model.js
const mongoose = require('mongoose');
const { generateQrToken, maskPatientName } = require('../utils/tokenGenerator');

// Sub-schema: Chi tiết từng thuốc được kê trong đơn của bệnh nhân
const PrescriptionItemSchema = new mongoose.Schema(
  {
    item_qr_token: {
      type: String,
      required: true,
      default: () => generateQrToken('i'), // Tự động sinh mã QR riêng cho từng lọ thuốc
    },
    medication_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medication',
      required: true,
    },
    // Lưu Snapshot thông tin cơ bản của thuốc tại thời điểm kê đơn
    medication_snapshot: {
      code: { type: String, required: true },
      name: { type: String, required: true },
      unit: { type: String, required: true },
      dosage_form: { type: String, default: '' },
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.1,
    },
    dosage_instruction: {
      type: String,
      required: [true, 'Liều dùng cụ thể cho bệnh nhân là bắt buộc'], // VD: Sáng 1 nhát, Tối 1 nhát
    },
    usage_timing: {
      type: String,
      default: '', // VD: Sau ăn 30 phút / Súc miệng kỹ sau khi xịt
    },
    custom_note: {
      type: String,
      default: '', // Dặn dò riêng của bác sĩ/dược sĩ cho lọ thuốc này
    },
  },
  { _id: true }
);

// Main Schema: Hồ sơ đơn thuốc
const PrescriptionSchema = new mongoose.Schema(
  {
    prescription_code: {
      type: String,
      required: [true, 'Mã đơn thuốc / Mã hồ sơ là bắt buộc'],
      unique: true,
      trim: true,
      index: true,
    },
    master_qr_token: {
      type: String,
      required: true,
      unique: true,
      index: true, // Index chính để quét QR tổng trên sổ khám/đơn thuốc
      default: () => generateQrToken('p'),
    },
    patient: {
      patient_code: { type: String, required: true, trim: true },
      full_name: { type: String, required: true, trim: true },
      masked_name: { type: String, trim: true },
      birth_year: { type: Number, required: true },
    },
    doctor: {
      name: { type: String, required: true, trim: true },
      department: { type: String, required: true, trim: true },
    },
    diagnosis: {
      type: String,
      default: '',
    },
    general_note: {
      type: String,
      default: '',
    },
    // Danh sách các thuốc trong đơn
    items: {
      type: [PrescriptionItemSchema],
      validate: [
        (val) => val.length > 0,
        'Đơn thuốc phải có ít nhất 1 loại thuốc',
      ],
    },
    scan_stats: {
      total_scans: { type: Number, default: 0 },
      last_scanned_at: { type: Date, default: null },
    },
    expires_at: {
      type: Date,
      required: true,
      // Mặc định hiệu lực mã QR là 180 ngày (6 tháng) kể từ ngày cấp thuốc
      default: () => new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Multikey Index cho phép tra cứu tức thì khi bệnh nhân quét tem QR dán lẻ trên từng lọ thuốc
PrescriptionSchema.index({ 'items.item_qr_token': 1 }, { unique: true, sparse: true });

// TTL Index: Tự động dọn dẹp đơn thuốc khi quá hạn expires_at (nếu bệnh viện muốn tự động xóa)
PrescriptionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Hook tự động tạo tên che (masked_name) trước khi lưu
PrescriptionSchema.pre('validate', function (next) {
  if (this.patient && this.patient.full_name && !this.patient.masked_name) {
    this.patient.masked_name = maskPatientName(this.patient.full_name);
  }
  next();
});

module.exports = mongoose.model('Prescription', PrescriptionSchema);
