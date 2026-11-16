// File: src/utils/tokenGenerator.js
const crypto = require('crypto');

/**
 * Sinh mã QR Token ngắn gọn, ngẫu nhiên cho từng loại thuốc trong kho
 * @param {string} prefix - Tiền tố ('m' cho Medication)
 * @param {number} byteLength - Độ dài byte ngẫu nhiên (mặc định 4 bytes -> 8 ký tự hex)
 * @returns {string} Ví dụ: 'm_8f9a2b3c'
 */
const generateQrToken = (prefix = 'm', byteLength = 4) => {
  const randomHex = crypto.randomBytes(byteLength).toString('hex');
  return `${prefix}_${randomHex}`;
};

module.exports = {
  generateQrToken,
};
