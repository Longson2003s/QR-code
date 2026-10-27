// File: src/models/QrScanLog.model.js
const mongoose = require('mongoose');

const QrScanLogSchema = new mongoose.Schema({
  qr_token: {
    type: String,
    required: true,
    index: true,
  },
  target_type: {
    type: String,
    enum: ['MASTER_PRESCRIPTION', 'SINGLE_ITEM'],
    required: true,
  },
  prescription_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
    required: true,
    index: true,
  },
  medication_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medication',
    default: null, // Có giá trị nếu bệnh nhân quét tem dán trên từng lọ thuốc lẻ
  },
  device_info: {
    type: String,
    default: 'Unknown Device',
  },
  ip_address: {
    type: String,
    default: '',
  },
  scanned_at: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model('QrScanLog', QrScanLogSchema);
