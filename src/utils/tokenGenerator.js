// File: src/utils/tokenGenerator.js
const crypto = require('crypto');

/**
 * Sinh mã QR Token ngắn gọn, ngẫu nhiên và an toàn
 * @param {string} prefix - Tiền tố ('p' cho Prescription, 'i' cho Item)
 * @param {number} byteLength - Độ dài byte ngẫu nhiên (mặc định 5 bytes -> 10 ký tự hex)
 * @returns {string} Ví dụ: 'p_8f9a2b3c4d' hoặc 'i_7e6d5c4b3a'
 */
const generateQrToken = (prefix = 'p', byteLength = 5) => {
  const randomHex = crypto.randomBytes(byteLength).toString('hex');
  return `${prefix}_${randomHex}`;
};

/**
 * Che một phần họ tên bệnh nhân để bảo mật quyền riêng tư khi quét QR không cần mật khẩu
 * Ví dụ: "Nguyễn Văn An" -> "Nguyễn V. An"
 * @param {string} fullName 
 * @returns {string}
 */
const maskPatientName = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const middleInitials = parts
    .slice(1, -1)
    .map((word) => `${word.charAt(0).toUpperCase()}.`)
    .join(' ');

  return `${firstName} ${middleInitials} ${lastName}`;
};

module.exports = {
  generateQrToken,
  maskPatientName,
};
