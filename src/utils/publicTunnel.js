// File: src/utils/publicTunnel.js
const { spawn } = require('child_process');
const fs = require('fs');

let tunnelProcess = null;

/**
 * Tự động khởi tạo đường hầm Public HTTPS (Cloudflare Quick Tunnel)
 * Giúp bệnh nhân dùng 4G/5G từ bất kỳ đâu đều quét mã QR và xem Video MP4 mượt mà
 * mà không cần kết nối chung mạng Wi-Fi/LAN với máy tính bệnh viện.
 *
 * @param {number} port - Cổng nội bộ của Express server (mặc định 3000)
 * @returns {Promise<string|null>} Public HTTPS URL (VD: https://xxxx.trycloudflare.com)
 */
const startPublicTunnel = (port = 3000) => {
  return new Promise((resolve) => {
    try {
      const { bin } = require('cloudflared');
      if (!bin || !fs.existsSync(bin)) {
        console.warn('[Tunnel] Không tìm thấy binary cloudflared, dùng IP mạng LAN dự phòng.');
        return resolve(null);
      }

      tunnelProcess = spawn(
        bin,
        ['tunnel', '--url', `http://127.0.0.1:${port}`, '--no-autoupdate'],
        { windowsHide: true }
      );

      let resolved = false;

      const handleOutput = (data) => {
        const text = data.toString();
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match && !resolved) {
          resolved = true;
          const publicOrigin = match[0];
          global.PUBLIC_TUNNEL_ORIGIN = publicOrigin;
          global.PUBLIC_QR_BASE_URL = `${publicOrigin}/q`;
          process.env.BASE_QR_URL = `${publicOrigin}/q`;
          resolve(publicOrigin);
        }
      };

      tunnelProcess.stdout.on('data', handleOutput);
      tunnelProcess.stderr.on('data', handleOutput);

      tunnelProcess.on('error', (err) => {
        console.warn('[Tunnel] Lỗi khởi tạo Public Tunnel:', err.message);
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      });

      // Timeout an toàn 12 giây nếu mạng không có Internet
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, 12000);
    } catch (error) {
      console.warn('[Tunnel] Không thể bật Public Tunnel:', error.message);
      resolve(null);
    }
  });
};

process.on('exit', () => {
  if (tunnelProcess) {
    try {
      tunnelProcess.kill();
    } catch (_) {}
  }
});

module.exports = { startPublicTunnel };
