// File: src/models/QrScanLog.model.js
const mongoose = require('mongoose');

const QrScanLogSchema = new mongoose.Schema({
  qr_token: {
    type: String,
    required: true,
    index: true,
  },
  medication_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medication',
    required: true,
    index: true,
  },
  medication_code: {
    type: String,
    default: '',
  },
  medication_name: {
    type: String,
    default: '',
  },
  device_info: {
    type: String,
    default: 'Mobile Scanner',
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
