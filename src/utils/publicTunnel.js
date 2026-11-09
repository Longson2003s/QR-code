// File: src/utils/publicTunnel.js
const { spawn, execSync } = require('child_process');
const fs = require('fs');

let tunnelProcess = null;
let isShuttingDown = false;

/**
 * Cập nhật biến toàn cục cho toàn hệ thống QR Code
 */
const applyPublicOrigin = (originUrl) => {
  if (!originUrl) return null;
  const cleanOrigin = originUrl.trim().replace(/\/+$/, '');
  global.PUBLIC_TUNNEL_ORIGIN = cleanOrigin;
  global.PUBLIC_QR_BASE_URL = `${cleanOrigin}/q`;
  process.env.BASE_QR_URL = `${cleanOrigin}/q`;
  return cleanOrigin;
};

/**
 * Khởi tạo đường hầm Public HTTPS mới (Cloudflare Tunnel)
 * Sử dụng giao thức --protocol http2 (TCP 443) giúp đường hầm ổn định xuyên tường lửa bệnh viện,
 * tránh lỗi Error 1033 do rớt kết nối UDP/QUIC.
 */
const startPublicTunnel = async (port = 3000) => {
  if (process.env.PUBLIC_EXTERNAL_URL) {
    return applyPublicOrigin(process.env.PUBLIC_EXTERNAL_URL);
  }

  try {
    // Dọn sạch các tiến trình cloudflared bị treo từ phiên cũ (nếu có) trước khi tạo URL mới
    try {
      execSync('taskkill /F /IM cloudflared.exe', { stdio: 'ignore', windowsHide: true });
    } catch (_) {}

    const { bin, install } = require('cloudflared');

    if (!fs.existsSync(bin)) {
      console.log('[Tunnel] Đang tự động tải công cụ kết nối 4G/5G (cloudflared) cho Windows Server...');
      await install(bin);
      console.log('[Tunnel] Đã cài đặt xong cloudflared tại:', bin);
    }

    return await launchTunnelProcess(bin, port);
  } catch (error) {
    console.warn('[Tunnel] Không thể khởi tạo Public Tunnel:', error.message);
    return global.PUBLIC_TUNNEL_ORIGIN || null;
  }
};

const launchTunnelProcess = (bin, port) => {
  return new Promise((resolve) => {
    if (tunnelProcess) {
      try {
        tunnelProcess.kill();
      } catch (_) {}
    }

    const tunnelToken = (process.env.CLOUDFLARE_TUNNEL_TOKEN || '').trim();
    const args = tunnelToken
      ? ['tunnel', '--no-autoupdate', '--protocol', 'http2', 'run', '--token', tunnelToken]
      : ['tunnel', '--url', `http://127.0.0.1:${port}`, '--protocol', 'http2', '--no-autoupdate'];

    tunnelProcess = spawn(bin, args, { windowsHide: true });

    let resolved = false;
    let detectedUrl = null;

    const handleOutput = (data) => {
      const text = data.toString();

      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && !detectedUrl) {
        detectedUrl = match[0];
        applyPublicOrigin(detectedUrl);
      }

      // Chỉ hoàn tất khi đường hầm đã thực sự đăng ký xong kết nối tới Cloudflare Edge (Tránh lỗi 1033)
      if (detectedUrl && text.includes('Registered tunnel connection') && !resolved) {
        resolved = true;
        resolve(detectedUrl);
      } else if (tunnelToken && text.includes('Registered tunnel connection') && !resolved) {
        resolved = true;
        resolve(global.PUBLIC_TUNNEL_ORIGIN || 'Đã kết nối Cloudflare Named Tunnel');
      }
    };

    tunnelProcess.stdout.on('data', handleOutput);
    tunnelProcess.stderr.on('data', handleOutput);

    tunnelProcess.on('error', (err) => {
      console.warn('[Tunnel] Lỗi tiến trình Public Tunnel:', err.message);
      if (!resolved) {
        resolved = true;
        resolve(detectedUrl || global.PUBLIC_TUNNEL_ORIGIN || null);
      }
    });

    tunnelProcess.on('close', (code) => {
      if (!isShuttingDown) {
        console.warn(`[Tunnel] Đường hầm 4G/5G bị ngắt (code ${code}). Đang tự động kết nối lại sau 5 giây...`);
        setTimeout(() => {
          launchTunnelProcess(bin, port);
        }, 5000);
      }
    });

    // Timeout an toàn 15 giây
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(detectedUrl || global.PUBLIC_TUNNEL_ORIGIN || null);
      }
    }, 15000);
  });
};

process.on('exit', () => {
  isShuttingDown = true;
  if (tunnelProcess) {
    try {
      tunnelProcess.kill();
    } catch (_) {}
  }
});

module.exports = { startPublicTunnel };
