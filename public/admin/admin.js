// File: public/admin/admin.js
let cachedMedications = [];

/**
 * Hiển thị thông báo nhanh góc phải màn hình
 */
function showToast(message, isError = false) {
  const box = document.getElementById('toast-box');
  box.textContent = message;
  box.className = `fixed bottom-5 right-5 z-50 max-w-md rounded-xl shadow-lg p-4 text-sm font-semibold transition ${
    isError ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
  }`;
  box.classList.remove('hidden');
  setTimeout(() => box.classList.add('hidden'), 4000);
}

/**
 * Chuyển đổi giữa 3 Tab chức năng
 */
function switchTab(tabId) {
  const tabs = ['tab-medications', 'tab-batch-print', 'tab-analytics'];
  tabs.forEach((id) => {
    document.getElementById(id).classList.toggle('hidden', id !== tabId);
    const btn = document.getElementById(`btn-${id}`);
    if (id === tabId) {
      btn.className = 'tab-btn bg-sky-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition';
    } else {
      btn.className = 'tab-btn bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-sm transition';
    }
  });

  if (tabId === 'tab-medications') loadMedications();
  if (tabId === 'tab-batch-print') {
    loadMedications().then(() => renderBatchSelectionGrid());
  }
  if (tabId === 'tab-analytics') loadAnalytics();
}

/* ==========================================================================
   PHẦN 1: XÂY DỰNG KHO THUỐC HƯỚNG DẪN & IN MÃ QR NHỎ TỪNG LOẠI THUỐC
   ========================================================================== */

function addGuideStepRow(stepData = {}) {
  const container = document.getElementById('guide-steps-container');
  const stepIndex = container.children.length + 1;
  const mediaType = stepData.media_type || 'TEXT_ONLY';

  const wrapper = document.createElement('div');
  wrapper.className = 'guide-step-row bg-slate-50 border border-slate-300 rounded-xl p-3.5 space-y-2.5';
  wrapper.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="bg-sky-700 text-white text-xs font-bold px-2 py-0.5 rounded">Bước</span>
        <input type="number" class="step-order w-16 border border-slate-300 rounded px-2 py-1 text-xs font-bold"
          value="${stepData.step_order || stepIndex}" min="1" required />
      </div>
      <button type="button" onclick="this.closest('.guide-step-row').remove()"
        class="text-xs text-red-600 hover:underline font-semibold">✖ Xóa bước này</button>
    </div>

    <div class="grid sm:grid-cols-3 gap-2">
      <div class="sm:col-span-2">
        <input type="text" class="step-title w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
          placeholder="Tiêu đề bước (VD: Bước 1: Mở nắp và nạp liều thuốc)" value="${stepData.title || ''}" required />
      </div>
      <div>
        <select class="step-media-type w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white">
          <option value="TEXT_ONLY" ${mediaType === 'TEXT_ONLY' ? 'selected' : ''}>📄 Chỉ Văn Bản (Text)</option>
          <option value="IMAGE" ${mediaType === 'IMAGE' ? 'selected' : ''}>🖼️ Hình Ảnh Minh Họa</option>
          <option value="VIDEO_MP4" ${mediaType === 'VIDEO_MP4' ? 'selected' : ''}>🎬 Video Hướng Dẫn (MP4)</option>
        </select>
      </div>
    </div>

    <div>
      <textarea rows="2" class="step-content w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
        placeholder="Nhập nội dung hướng dẫn chi tiết bằng văn bản..." required>${stepData.content_text || ''}</textarea>
    </div>

    <!-- Khu vực Upload trực tiếp Ảnh hoặc Video MP4 -->
    <div class="bg-white border border-dashed border-slate-300 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2">
      <div class="flex-1 min-w-[220px]">
        <input type="text" class="step-media-url w-full border border-slate-200 rounded px-2 py-1 text-xs font-mono text-slate-600"
          placeholder="Đường dẫn file Ảnh / Video MP4 (hoặc bấm nút Upload bên cạnh ->)"
          value="${stepData.media_url || ''}" />
      </div>
      <div class="flex items-center gap-2">
        <label class="cursor-pointer bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-bold px-3 py-1.5 rounded-lg transition">
          📤 Chọn File Ảnh / MP4
          <input type="file" accept="image/*,video/mp4" class="hidden" onchange="handleStepMediaUpload(this)" />
        </label>
        <input type="number" class="step-duration w-20 border border-slate-200 rounded px-2 py-1 text-xs"
          placeholder="Giây (MP4)" title="Thời lượng video tính bằng giây" value="${stepData.duration_seconds || ''}" />
      </div>
    </div>
  `;

  container.appendChild(wrapper);
}

/**
 * Xử lý khi Dược sĩ chọn file Ảnh hoặc Video MP4 từ máy tính -> Tự động Upload và điền URL
 */
async function handleStepMediaUpload(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;

  const row = fileInput.closest('.guide-step-row');
  const urlInput = row.querySelector('.step-media-url');
  const typeSelect = row.querySelector('.step-media-type');

  const formData = new FormData();
  formData.append('file', file);

  try {
    urlInput.value = '⏳ Đang tải file lên máy chủ...';
    const res = await fetch('/api/medications/upload-media', {
      method: 'POST',
      body: formData,
    });
    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(result.message || 'Lỗi tải file');
    }

    urlInput.value = result.data.media_url;
    typeSelect.value = result.data.media_type;
    showToast(`Đã tải lên thành công: ${result.data.original_name}`);
  } catch (err) {
    urlInput.value = '';
    showToast(err.message, true);
  }
}

function resetMedicationForm() {
  document.getElementById('med-id').value = '';
  document.getElementById('med-code').disabled = false;
  document.getElementById('med-form-title').textContent = '➕ Thêm Loại Thuốc Mới Vào Kho Hướng Dẫn';
  document.getElementById('medication-form').reset();
  document.getElementById('guide-steps-container').innerHTML = '';
  addGuideStepRow({ step_order: 1, media_type: 'TEXT_ONLY' });
}

async function loadMedications() {
  try {
    const keyword = document.getElementById('search-med-input')?.value || '';
    const res = await fetch(`/api/medications?keyword=${encodeURIComponent(keyword)}`);
    const result = await res.json();
    cachedMedications = result.data || [];

    const listBox = document.getElementById('medication-list-box');
    if (!listBox) return;

    if (cachedMedications.length === 0) {
      listBox.innerHTML = `<div class="text-sm text-slate-400 text-center py-8">Chưa có loại thuốc nào trong kho hướng dẫn.</div>`;
      return;
    }

    listBox.innerHTML = cachedMedications
      .map(
        (med) => `
      <div class="border border-slate-200 rounded-xl p-3.5 hover:border-sky-500 transition bg-slate-50/70 space-y-3">
        <div class="flex items-start gap-3">
          <!-- Hình ảnh Mã QR nhỏ riêng biệt của loại thuốc này -->
          <a href="${med.print_qr_url}" target="_blank" title="Bấm để mở trang in mã QR nhỏ cho thuốc này"
             class="flex-shrink-0 bg-white p-1.5 rounded-lg border border-slate-300 shadow-sm text-center hover:border-sky-600 transition">
            <img src="${med.qr_image_base64}" alt="QR ${med.code}" class="w-16 h-16 object-contain mx-auto" />
            <div class="text-[10px] font-mono font-bold text-slate-600 mt-0.5">${med.qr_token || med.code}</div>
          </a>

          <!-- Thông tin thuốc -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1 flex-wrap">
              <span class="bg-sky-100 text-sky-800 font-mono text-xs font-bold px-2 py-0.5 rounded">${med.code}</span>
              <span class="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                👁️ ${med.scan_stats?.total_scans || 0} lượt quét
              </span>
            </div>
            <h3 class="font-extrabold text-slate-900 text-sm mt-1 leading-snug">${med.name}</h3>
            <p class="text-xs text-slate-500 mt-0.5">${med.dosage_form || 'Chưa rõ dạng bào chế'} • Đơn vị: <b>${med.unit}</b></p>
            <div class="mt-1.5 flex items-center gap-2 text-xs text-slate-600">
              <span>📖 <b>${(med.guides || []).length} bước</b> hướng dẫn</span>
              <span>•</span>
              <span class="text-sky-700 font-semibold">
                ${
                  (med.guides || []).some((g) => g.media_type === 'VIDEO_MP4' && g.media_url)
                    ? '🎬 Có Video MP4'
                    : (med.guides || []).some((g) => g.media_type === 'IMAGE' && g.media_url)
                    ? '🖼️ Có Hình ảnh'
                    : '📄 Văn bản HDSD'
                }
              </span>
            </div>
          </div>
        </div>

        <!-- Thanh nút hành động: In mã QR nhỏ dán hộp thuốc / Xem thử / Sửa / Xóa -->
        <div class="pt-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-1.5">
            <a href="${med.print_qr_url}" target="_blank"
              class="bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition">
              🖨️ In Mã QR Nhỏ Dán Hộp
            </a>
            <a href="/q/${encodeURIComponent(med.qr_token || med.code)}" target="_blank"
              class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg transition">
              📱 Xem HDSD
            </a>
          </div>

          <div class="flex items-center gap-1.5">
            <button type="button" onclick='editMedicationById("${med._id}")'
              class="bg-white border border-slate-300 hover:bg-sky-50 text-sky-700 text-xs font-bold px-2.5 py-1.5 rounded-lg">
              ✏️ Sửa
            </button>
            <button type="button" onclick='deleteMedicationById("${med._id}", ${JSON.stringify(med.name)})'
              class="bg-white border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold px-2 py-1.5 rounded-lg">
              🗑️
            </button>
          </div>
        </div>
      </div>`
      )
      .join('');
  } catch (err) {
    showToast('Không thể tải kho thuốc: ' + err.message, true);
  }
}

function editMedicationById(medId) {
  const med = cachedMedications.find((m) => m._id === medId);
  if (!med) return;

  document.getElementById('med-id').value = med._id;
  document.getElementById('med-code').value = med.code;
  document.getElementById('med-code').disabled = true;
  document.getElementById('med-name').value = med.name;
  document.getElementById('med-ingredient').value = med.active_ingredient || '';
  document.getElementById('med-form').value = med.dosage_form || '';
  document.getElementById('med-unit').value = med.unit || '';
  document.getElementById('med-usage').value = med.standard_usage || '';
  document.getElementById('med-storage').value = med.storage_instruction || '';
  document.getElementById('med-warning').value = med.general_warning || '';
  document.getElementById('med-hotline').value = med.hotline_support || '';
  document.getElementById('med-form-title').textContent = `✏️ Cập Nhật Hướng Dẫn & QR: ${med.code}`;

  const container = document.getElementById('guide-steps-container');
  container.innerHTML = '';
  if (med.guides && med.guides.length > 0) {
    med.guides.forEach((g) => addGuideStepRow(g));
  } else {
    addGuideStepRow({ step_order: 1 });
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteMedicationById(medId, medName) {
  if (!confirm(`Bạn có chắc chắn muốn xóa thuốc "${medName}" khỏi kho hướng dẫn?`)) {
    return;
  }
  try {
    const res = await fetch(`/api/medications/${medId}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.message || 'Không thể xóa thuốc');
    }
    showToast(result.message);
    loadMedications();
  } catch (err) {
    showToast(err.message, true);
  }
}

document.getElementById('medication-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const medId = document.getElementById('med-id').value;

  const stepRows = Array.from(document.querySelectorAll('.guide-step-row'));
  const guides = stepRows.map((row) => ({
    step_order: Number(row.querySelector('.step-order').value) || 1,
    title: row.querySelector('.step-title').value.trim(),
    content_text: row.querySelector('.step-content').value.trim(),
    media_type: row.querySelector('.step-media-type').value,
    media_url: row.querySelector('.step-media-url').value.trim() || null,
    duration_seconds: Number(row.querySelector('.step-duration').value) || 0,
  }));

  const payload = {
    code: document.getElementById('med-code').value.trim().toUpperCase(),
    name: document.getElementById('med-name').value.trim(),
    active_ingredient: document.getElementById('med-ingredient').value.trim(),
    dosage_form: document.getElementById('med-form').value.trim(),
    unit: document.getElementById('med-unit').value.trim(),
    standard_usage: document.getElementById('med-usage').value.trim(),
    storage_instruction: document.getElementById('med-storage').value.trim(),
    general_warning: document.getElementById('med-warning').value.trim(),
    hotline_support: document.getElementById('med-hotline').value.trim(),
    guides,
  };

  try {
    const url = medId ? `/api/medications/${medId}` : '/api/medications';
    const method = medId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(result.message || 'Lỗi lưu thuốc');
    }

    showToast(result.message);
    resetMedicationForm();
    loadMedications();
  } catch (err) {
    showToast(err.message, true);
  }
});

/* ==========================================================================
   PHẦN 2: IN TEM MÃ QR NHỎ HÀNG LOẠT THEO LOẠI THUỐC (DÁN HỘP THUỐC)
   ========================================================================== */

function renderBatchSelectionGrid() {
  const grid = document.getElementById('batch-medications-grid');
  if (!grid) return;

  if (cachedMedications.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center text-slate-400 py-8">Kho thuốc trống. Vui lòng thêm thuốc ở Tab 1 trước.</div>`;
    return;
  }

  grid.innerHTML = cachedMedications
    .map(
      (med) => `
    <div class="batch-med-card border border-slate-200 rounded-xl p-4 bg-slate-50/70 flex items-center gap-3.5" data-id="${med._id}">
      <img src="${med.qr_image_base64}" alt="QR" class="w-16 h-16 bg-white p-1 rounded-lg border border-slate-300 flex-shrink-0" />
      <div class="flex-1 min-w-0">
        <div class="text-xs font-mono font-bold text-sky-800 truncate">${med.code} • QR: ${med.qr_token}</div>
        <div class="font-bold text-sm text-slate-900 truncate" title="${med.name}">${med.name}</div>
        <div class="mt-2 flex items-center justify-between gap-2">
          <label class="text-xs font-semibold text-slate-600">Số tem cần in:</label>
          <input type="number" min="0" max="200" value="4"
            class="batch-qty-input w-20 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-extrabold text-center bg-white" />
        </div>
      </div>
    </div>`
    )
    .join('');
}

function setAllBatchQuantities(qty) {
  document.querySelectorAll('.batch-qty-input').forEach((input) => {
    input.value = qty;
  });
}

function openBatchPrintWindow() {
  const cards = Array.from(document.querySelectorAll('.batch-med-card'));
  const size = document.getElementById('batch-label-size')?.value || '35x22';

  const selectedPairs = [];
  cards.forEach((card) => {
    const id = card.getAttribute('data-id');
    const qty = parseInt(card.querySelector('.batch-qty-input')?.value, 10) || 0;
    if (id && qty > 0) {
      selectedPairs.push(`${id}:${qty}`);
    }
  });

  if (selectedPairs.length === 0) {
    return showToast('Vui lòng nhập số lượng tem cần in (> 0) cho ít nhất 1 loại thuốc!', true);
  }

  const url = `/api/medications/print-batch?items=${encodeURIComponent(selectedPairs.join('|'))}&size=${encodeURIComponent(size)}`;
  window.open(url, '_blank');
}

/* ==========================================================================
   PHẦN 3: THỐNG KÊ LƯỢT QUÉT MÃ QR THEO TỪNG LOẠI THUỐC
   ========================================================================== */

async function loadAnalytics() {
  try {
    const res = await fetch('/api/medications/analytics/scans');
    const result = await res.json();
    if (!result.success) return;

    document.getElementById('stat-total-meds').textContent = result.data.total_medications;
    document.getElementById('stat-total-scans').textContent = result.data.total_qr_scans;

    const medStatsTbody = document.getElementById('med-stats-tbody');
    const medStats = result.data.medication_stats || [];
    if (medStats.length === 0) {
      medStatsTbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">Chưa có loại thuốc nào trong kho.</td></tr>`;
    } else {
      medStatsTbody.innerHTML = medStats
        .map(
          (m) => `
        <tr class="hover:bg-slate-50">
          <td class="p-3 font-mono font-bold text-slate-800">${m.code}</td>
          <td class="p-3 font-bold text-slate-900">${m.name} <span class="text-xs font-normal text-slate-500">(${m.unit})</span></td>
          <td class="p-3 font-mono text-sky-700 font-bold">
            <a href="/q/${encodeURIComponent(m.qr_token || m.code)}" target="_blank" class="underline">${m.qr_token || m.code}</a>
          </td>
          <td class="p-3 text-xs">${(m.guides || []).length} bước</td>
          <td class="p-3">
            <span class="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-2.5 py-1 rounded-full">
              ${m.scan_stats?.total_scans || 0} lượt quét
            </span>
          </td>
          <td class="p-3 text-right">
            <a href="/api/medications/${encodeURIComponent(m._id)}/print-qr" target="_blank"
              class="inline-block bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
              🖨️ In Mã QR Nhỏ
            </a>
          </td>
        </tr>`
        )
        .join('');
    }

    const logsTbody = document.getElementById('scan-logs-tbody');
    const logs = result.data.recent_scans || [];
    if (logs.length === 0) {
      logsTbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400">Chưa có lượt quét mã QR nào được ghi nhận.</td></tr>`;
    } else {
      logsTbody.innerHTML = logs
        .map(
          (log) => `
        <tr class="hover:bg-slate-50">
          <td class="p-3 font-medium">${new Date(log.scanned_at).toLocaleString('vi-VN')}</td>
          <td class="p-3 font-mono font-bold text-sky-700">
            <a href="/q/${encodeURIComponent(log.qr_token)}" target="_blank" class="underline">${log.qr_token}</a>
          </td>
          <td class="p-3 font-semibold text-slate-800">
            ${log.medication_id ? `${log.medication_id.name} (${log.medication_id.code})` : log.medication_name || log.medication_code}
          </td>
          <td class="p-3 text-xs text-slate-500 max-w-xs truncate" title="${log.device_info}">${log.device_info}</td>
        </tr>`
        )
        .join('');
    }
  } catch (err) {
    showToast('Lỗi tải thống kê: ' + err.message, true);
  }
}

// Khởi chạy mặc định khi mở trang Admin
window.addEventListener('DOMContentLoaded', () => {
  resetMedicationForm();
  loadMedications();
});
