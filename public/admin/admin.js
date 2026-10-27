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
  const tabs = ['tab-medications', 'tab-prescriptions', 'tab-analytics'];
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
  if (tabId === 'tab-prescriptions') {
    loadMedications().then(() => {
      refreshPrescriptionDropdowns();
      loadPrescriptions();
    });
  }
  if (tabId === 'tab-analytics') loadAnalytics();
}

/* ==========================================================================
   PHẦN 1: QUẢN LÝ KHO THUỐC & UPLOAD HÌNH ẢNH / VIDEO MP4
   ========================================================================== */

function addGuideStepRow(stepData = {}) {
  const container = document.getElementById('guide-steps-container');
  const stepIndex = container.children.length + 1;

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
          <option value="TEXT_ONLY" ${stepData.media_type === 'TEXT_ONLY' ? 'selected' : ''}>📄 Chỉ Văn Bản (Text)</option>
          <option value="IMAGE" ${stepData.media_type === 'IMAGE' ? 'selected' : ''}>🖼️ Hình Ảnh Minh Họa</option>
          <option value="VIDEO_MP4" ${stepData.media_type === 'VIDEO_MP4' ? 'selected' : ''}>🎬 Video Hướng Dẫn (MP4)</option>
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
    typeSelect.value = result.data.media_type; // Tự động chuyển sang IMAGE hoặc VIDEO_MP4
    showToast(`Đã tải lên thành công: ${result.data.original_name}`);
  } catch (err) {
    urlInput.value = '';
    showToast(err.message, true);
  }
}

function resetMedicationForm() {
  document.getElementById('med-id').value = '';
  document.getElementById('med-code').disabled = false;
  document.getElementById('med-form-title').textContent = '➕ Thêm Thuốc Mới & Các Bước Hướng Dẫn';
  document.getElementById('medication-form').reset();
  document.getElementById('guide-steps-container').innerHTML = '';
  addGuideStepRow({ step_order: 1, media_type: 'VIDEO_MP4' });
}

async function loadMedications() {
  try {
    const keyword = document.getElementById('search-med-input')?.value || '';
    const res = await fetch(`/api/medications?keyword=${encodeURIComponent(keyword)}`);
    const result = await res.json();
    cachedMedications = result.data || [];

    const listBox = document.getElementById('medication-list-box');
    if (cachedMedications.length === 0) {
      listBox.innerHTML = `<div class="text-sm text-slate-400 text-center py-8">Chưa có thuốc nào phù hợp.</div>`;
      return;
    }

    listBox.innerHTML = cachedMedications
      .map(
        (med) => `
      <div class="border border-slate-200 rounded-xl p-3.5 hover:border-sky-500 transition bg-slate-50/60">
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="bg-sky-100 text-sky-800 font-mono text-xs font-bold px-2 py-0.5 rounded">${med.code}</span>
            <h3 class="font-bold text-slate-900 text-sm mt-1">${med.name}</h3>
            <p class="text-xs text-slate-500">${med.dosage_form || ''} • Đơn vị: <b>${med.unit}</b></p>
          </div>
          <button onclick='editMedication(${JSON.stringify(med).replace(/'/g, "&#39;")})'
            class="bg-white border border-slate-300 hover:bg-sky-50 text-sky-700 text-xs font-bold px-2.5 py-1 rounded-lg">
            ✏️ Sửa hướng dẫn
          </button>
        </div>
        <div class="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
          <span>Số bước hướng dẫn: <b>${(med.guides || []).length} bước</b></span>
          <span class="text-emerald-700 font-semibold">
            ${(med.guides || []).some((g) => g.media_type === 'VIDEO_MP4') ? '🎬 Có Video MP4' : '📄 Văn bản/Ảnh'}
          </span>
        </div>
      </div>`
      )
      .join('');
  } catch (err) {
    showToast('Không thể tải danh sách thuốc: ' + err.message, true);
  }
}

function editMedication(med) {
  document.getElementById('med-id').value = med._id;
  document.getElementById('med-code').value = med.code;
  document.getElementById('med-code').disabled = true;
  document.getElementById('med-name').value = med.name;
  document.getElementById('med-ingredient').value = med.active_ingredient || '';
  document.getElementById('med-form').value = med.dosage_form || '';
  document.getElementById('med-unit').value = med.unit || '';
  document.getElementById('med-warning').value = med.general_warning || '';
  document.getElementById('med-hotline').value = med.hotline_support || '';
  document.getElementById('med-form-title').textContent = `✏️ Cập Nhật Hướng Dẫn: ${med.code}`;

  const container = document.getElementById('guide-steps-container');
  container.innerHTML = '';
  if (med.guides && med.guides.length > 0) {
    med.guides.forEach((g) => addGuideStepRow(g));
  } else {
    addGuideStepRow({ step_order: 1 });
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
   PHẦN 2: KÊ ĐƠN THUỐC & PHÁT HÀNH TEM NHIỆT QR CODE
   ========================================================================== */

function buildMedicationOptionsHtml() {
  if (cachedMedications.length === 0) {
    return `<option value="">-- Vui lòng thêm thuốc ở Tab 1 trước --</option>`;
  }
  return cachedMedications
    .map((m) => `<option value="${m._id}">${m.name} (${m.code} - ĐV: ${m.unit})</option>`)
    .join('');
}

function addPrescriptionItemRow() {
  const container = document.getElementById('rx-items-container');
  const div = document.createElement('div');
  div.className = 'rx-item-row bg-slate-50 border border-slate-300 rounded-xl p-3 space-y-2';
  div.innerHTML = `
    <div class="flex items-center justify-between gap-2">
      <select class="rx-med-id flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white" required>
        ${buildMedicationOptionsHtml()}
      </select>
      <input type="number" step="0.5" min="0.5" value="1"
        class="rx-qty w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-center"
        placeholder="SL" title="Số lượng cấp" required />
      <button type="button" onclick="this.closest('.rx-item-row').remove()"
        class="text-xs text-red-600 font-bold px-2">✖</button>
    </div>
    <div class="grid sm:grid-cols-2 gap-2">
      <input type="text" class="rx-dosage w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
        placeholder="Liều dùng (*) VD: Sáng xịt 2 nhát, Tối xịt 2 nhát" required />
      <input type="text" class="rx-timing w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
        placeholder="Thời điểm dùng VD: Sau ăn 30 phút, nhớ súc miệng" />
    </div>
    <input type="text" class="rx-note w-full border border-slate-200 rounded-lg px-2.5 py-1 text-xs"
      placeholder="Ghi chú riêng của Dược sĩ cho lọ thuốc này (nếu có)..." />
  `;
  container.appendChild(div);
}

function refreshPrescriptionDropdowns() {
  const container = document.getElementById('rx-items-container');
  if (container.children.length === 0) {
    addPrescriptionItemRow();
  } else {
    document.querySelectorAll('.rx-med-id').forEach((select) => {
      const currentVal = select.value;
      select.innerHTML = buildMedicationOptionsHtml();
      if (currentVal) select.value = currentVal;
    });
  }
}

async function loadPrescriptions() {
  try {
    const res = await fetch('/api/prescriptions');
    const result = await res.json();
    const list = result.data || [];

    const box = document.getElementById('prescription-list-box');
    if (list.length === 0) {
      box.innerHTML = `<div class="text-sm text-slate-400 text-center py-8">Chưa có đơn thuốc nào.</div>`;
      return;
    }

    box.innerHTML = list
      .map(
        (rx) => `
      <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-2">
        <div class="flex items-start justify-between">
          <div>
            <span class="bg-sky-800 text-white font-mono text-xs font-bold px-2.5 py-0.5 rounded">${rx.prescription_code}</span>
            <h3 class="font-extrabold text-slate-900 text-sm mt-1">
              BN: ${rx.patient.full_name} (${rx.patient.birth_year}) • <span class="text-slate-500 font-normal">${rx.patient.patient_code}</span>
            </h3>
            <p class="text-xs text-slate-500">${rx.doctor.department} — ${rx.doctor.name}</p>
          </div>
          <span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full">
            👁️ Đã quét: ${rx.scan_stats?.total_scans || 0} lần
          </span>
        </div>

        <div class="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
          ${rx.items
            .map(
              (item, i) => `
            <div class="flex items-center justify-between">
              <span><b>${i + 1}. ${item.medication_snapshot.name}</b> (SL: ${item.quantity} ${item.medication_snapshot.unit})</span>
              <a href="/q/${item.item_qr_token}" target="_blank" class="text-sky-700 underline font-mono">${item.item_qr_token}</a>
            </div>`
            )
            .join('')}
        </div>

        <div class="pt-1 flex flex-wrap items-center justify-between gap-2">
          <a href="/api/prescriptions/${rx.prescription_code}/print-labels" target="_blank"
            class="bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm">
            🖨️ In Tem Nhiệt QR (Hồ sơ & Lọ thuốc)
          </a>
          <a href="/q/${rx.master_qr_token}" target="_blank"
            class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg">
            📱 Mở Giao Diện Quét Tổng (/q/${rx.master_qr_token})
          </a>
        </div>
      </div>`
      )
      .join('');
  } catch (err) {
    showToast('Lỗi tải danh sách đơn thuốc: ' + err.message, true);
  }
}

document.getElementById('prescription-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const itemRows = Array.from(document.querySelectorAll('.rx-item-row'));
  if (itemRows.length === 0) {
    return showToast('Vui lòng thêm ít nhất 1 thuốc vào đơn!', true);
  }

  const items = itemRows.map((row) => ({
    medication_id: row.querySelector('.rx-med-id').value,
    quantity: Number(row.querySelector('.rx-qty').value) || 1,
    dosage_instruction: row.querySelector('.rx-dosage').value.trim(),
    usage_timing: row.querySelector('.rx-timing').value.trim(),
    custom_note: row.querySelector('.rx-note').value.trim(),
  }));

  const payload = {
    prescription_code: document.getElementById('rx-code').value.trim(),
    patient: {
      patient_code: document.getElementById('rx-patient-code').value.trim(),
      full_name: document.getElementById('rx-patient-name').value.trim(),
      birth_year: Number(document.getElementById('rx-patient-birth').value),
    },
    doctor: {
      name: document.getElementById('rx-doctor-name').value.trim(),
      department: document.getElementById('rx-department').value.trim(),
    },
    general_note: document.getElementById('rx-general-note').value.trim(),
    items,
  };

  try {
    const res = await fetch('/api/prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(result.message || 'Lỗi tạo đơn thuốc');
    }

    showToast('Đã tạo đơn thuốc & sinh mã QR thành công!');
    // Tự động sinh mã đơn mới ngẫu nhiên cho lần nhập tiếp theo
    document.getElementById('rx-code').value = `BA${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Math.floor(1000 + Math.random() * 9000)}`;
    loadPrescriptions();

    // Mở ngay cửa sổ In Tem Nhiệt QR cho Dược sĩ
    if (result.data?.print_labels_url) {
      window.open(result.data.print_labels_url, '_blank');
    }
  } catch (err) {
    showToast(err.message, true);
  }
});

/* ==========================================================================
   PHẦN 3: BÁO CÁO THỐNG KÊ LƯỢT QUÉT QR CHO GIÁM ĐỐC BỆNH VIỆN
   ========================================================================== */

async function loadAnalytics() {
  try {
    const res = await fetch('/api/prescriptions/analytics/scans');
    const result = await res.json();
    if (!result.success) return;

    document.getElementById('stat-total-rx').textContent = result.data.total_prescriptions_issued;
    document.getElementById('stat-total-scans').textContent = result.data.total_qr_scans;

    const tbody = document.getElementById('scan-logs-tbody');
    const logs = result.data.recent_scans || [];
    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400">Chưa có lượt quét QR nào được ghi nhận.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs
      .map(
        (log) => `
      <tr class="hover:bg-slate-50">
        <td class="p-3 font-medium">${new Date(log.scanned_at).toLocaleString('vi-VN')}</td>
        <td class="p-3 font-mono font-bold text-sky-700">
          <a href="/q/${log.qr_token}" target="_blank" class="underline">${log.qr_token}</a>
        </td>
        <td class="p-3">
          ${
            log.target_type === 'MASTER_PRESCRIPTION'
              ? '<span class="bg-sky-100 text-sky-800 text-xs font-bold px-2 py-0.5 rounded">QR Tổng Hồ Sơ</span>'
              : '<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded">QR Lẻ Lọ Thuốc</span>'
          }
        </td>
        <td class="p-3 text-xs">${log.medication_id ? log.medication_id.name : 'Toàn bộ đơn thuốc'}</td>
        <td class="p-3 text-xs text-slate-500 max-w-xs truncate" title="${log.device_info}">${log.device_info}</td>
      </tr>`
      )
      .join('');
  } catch (err) {
    showToast('Lỗi tải thống kê: ' + err.message, true);
  }
}

// Khởi chạy mặc định khi mở trang Admin
window.addEventListener('DOMContentLoaded', () => {
  resetMedicationForm();
  loadMedications();
  document.getElementById('rx-code').value = `BA${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Math.floor(1000 + Math.random() * 9000)}`;
});
