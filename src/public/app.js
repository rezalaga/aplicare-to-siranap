/* global state */
let logsOffset = 0;
const LOGS_PAGE_SIZE = 10;
let refreshTimer = null;
let isSyncing = false;

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  startAutoRefresh();
});

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    loadStatus();
    loadBedData();
    loadLogs(true);
  }, 30000);
}

async function loadAll() {
  await Promise.allSettled([
    loadStatus(),
    loadBedData(),
    loadLogs(true),
    loadConfig(),
  ]);
}

/* ============================================================
   STATUS & CONNECTION
   ============================================================ */
async function loadStatus() {
  try {
    const data = await apiFetch('/api/status');
    if (!data.success) return;

    // RS Name
    document.getElementById('rs-name').textContent = data.app?.rs_name || 'Bridge System';
    document.title = `${data.app?.rs_name || 'RS'} | APLICARE → SIRANAP`;

    // BPJS Connection
    renderConnection('bpjs', data.connections?.bpjs);

    // SIRANAP Connection
    renderConnection('siranap', data.connections?.siranap);

    // Sync stats mini badges
    const stats = data.stats || {};
    document.getElementById('sync-stats-mini').innerHTML = `
      <span class="sync-stat-item">
        <span class="sync-stat-dot" style="background:#10b981"></span>
        ${stats.total_success || 0} berhasil
      </span>
      <span class="sync-stat-item">
        <span class="sync-stat-dot" style="background:#ef4444"></span>
        ${stats.total_failed || 0} gagal
      </span>
      <span class="sync-stat-item">
        <span class="sync-stat-dot" style="background:#64748b"></span>
        Total: ${stats.total_syncs || 0}
      </span>
    `;
  } catch (err) {
    console.error('loadStatus error:', err);
  }
}

function renderConnection(type, conn) {
  const statusEl = document.getElementById(`${type}-status`);
  const indicatorEl = document.getElementById(`${type}-indicator`);

  if (!conn) {
    statusEl.textContent = 'Tidak diketahui';
    indicatorEl.innerHTML = '<div class="indicator-dot"></div>';
    return;
  }

  statusEl.textContent = conn.message || '—';

  let dotClass = 'disconnected';
  if (!conn.configured) dotClass = 'unconfigured';
  else if (conn.connected) dotClass = 'connected';

  indicatorEl.innerHTML = `<div class="indicator-dot ${dotClass}"></div>`;
}

/* ============================================================
   BED DATA
   ============================================================ */
async function loadBedData() {
  try {
    const data = await apiFetch('/api/bed-data');
    if (!data.success) return;

    const beds = data.data || [];

    // Stats
    const totalKapasitas = beds.reduce((s, r) => s + (r.total_tt || 0), 0);
    const totalTerpakai = beds.reduce((s, r) => s + (r.terpakai || 0), 0);
    const totalKosong = beds.reduce((s, r) => s + (r.kosong || 0), 0);

    animateValue('stat-kapasitas', totalKapasitas);
    animateValue('stat-terpakai', totalTerpakai);
    animateValue('stat-kosong', totalKosong);
    animateValue('stat-rooms-val', beds.length);

    // Occupancy bar
    const occSection = document.getElementById('occupancy-section');
    if (beds.length > 0) {
      occSection.style.display = 'block';
      const pct = totalKapasitas > 0 ? Math.round((totalTerpakai / totalKapasitas) * 100) : 0;
      document.getElementById('occupancy-pct').textContent = `${pct}%`;
      document.getElementById('occupancy-fill').style.width = `${pct}%`;
    } else {
      occSection.style.display = 'none';
    }

    // Last updated
    const lastUpdatedEl = document.getElementById('bed-last-updated');
    lastUpdatedEl.textContent = data.last_updated
      ? `Update: ${formatDateTime(data.last_updated)}`
      : 'Belum ada data';

    // Table
    renderBedTable(beds);
    
    // Class Summary
    renderClassSummary(beds);
  } catch (err) {
    console.error('loadBedData error:', err);
  }
}

function renderBedTable(beds) {
  const tbody = document.getElementById('bed-table-body');
  if (!beds || beds.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty">Belum ada data — klik "Sinkronisasi Sekarang" untuk memuat</td></tr>`;
    return;
  }

  const classMap = {};
  beds.forEach(room => {
    const className = room.nama_kelas || 'Lainnya';
    if (!classMap[className]) classMap[className] = [];
    classMap[className].push(room);
  });

  const classKeys = Object.keys(classMap).sort();
  
  let html = '';
  classKeys.forEach((className, index) => {
    const safeClassName = 'group-' + index;
    // Header class
    html += `
      <tr class="table-group-header" onclick="toggleGroup('${safeClassName}')">
        <td colspan="8">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>${escHtml(className)}</span>
            <svg id="icon-${safeClassName}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; transition: transform 0.2s; transform: rotate(-90deg);">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </td>
      </tr>
    `;
    
    // Rooms in this class
    classMap[className].forEach(room => {
      const pct = room.total_tt > 0 ? Math.round((room.terpakai / room.total_tt) * 100) : 0;
      const fillClass = pct >= 90 ? 'high' : pct >= 70 ? 'medium' : 'low';
      const pctColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981';

      html += `
        <tr class="${safeClassName}" style="display: none;">
          <td>
            <div class="room-name">${escHtml(room.nama_ruang)}</div>
            <div class="room-code">${escHtml(room.kode_ruang)}</div>
          </td>
          <td><span class="kelas-badge">${escHtml(room.nama_kelas)}</span></td>
          <td><strong>${room.total_tt}</strong></td>
          <td style="color: ${room.terpakai > 0 ? '#ef4444' : '#64748b'}">${room.terpakai}</td>
          <td style="color: ${room.kosong > 0 ? '#10b981' : '#64748b'}">${room.kosong}</td>
          <td>${room.kosong_pria}</td>
          <td>${room.kosong_wanita}</td>
          <td>
            <div class="occupancy-mini">
              <div class="mini-bar">
                <div class="mini-fill ${fillClass}" style="width: ${pct}%"></div>
              </div>
              <span class="mini-pct" style="color: ${pctColor}">${pct}%</span>
            </div>
          </td>
        </tr>
      `;
    });
  });

  tbody.innerHTML = html;
}

function toggleGroup(groupClass) {
  const rows = document.querySelectorAll('.' + groupClass);
  const icon = document.getElementById('icon-' + groupClass);
  let isHidden = false;
  
  rows.forEach(row => {
    if (row.style.display === 'none') {
      row.style.display = '';
      isHidden = false;
    } else {
      row.style.display = 'none';
      isHidden = true;
    }
  });
  
  if (icon) {
    icon.style.transform = isHidden ? 'rotate(-90deg)' : 'rotate(0deg)';
  }
}

function renderClassSummary(beds) {
  const summaryGrid = document.getElementById('class-summary-grid');
  const summarySection = document.getElementById('class-summary-section');
  
  if (!beds || beds.length === 0) {
    summarySection.style.display = 'none';
    return;
  }
  
  summarySection.style.display = 'block';
  
  const classMap = {};
  beds.forEach(room => {
    const className = room.nama_kelas || 'Lainnya';
    if (!classMap[className]) {
      classMap[className] = { total: 0, kosong: 0 };
    }
    classMap[className].total += room.total_tt;
    classMap[className].kosong += room.kosong;
  });
  
  const classKeys = Object.keys(classMap).sort();
  
  summaryGrid.innerHTML = classKeys.map(key => {
    const data = classMap[key];
    return `
      <div class="class-summary-card">
        <div class="class-name">${escHtml(key)}</div>
        <div class="class-stats">
          <div class="c-stat">
            <span class="c-label">Tempat Tidur</span>
            <span class="c-value text-blue">${data.total}</span>
          </div>
          <div class="c-stat">
            <span class="c-label">Kosong</span>
            <span class="c-value text-green">${data.kosong}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/* ============================================================
   LOGS
   ============================================================ */
async function loadLogs(reset = false) {
  if (reset) logsOffset = 0;

  try {
    const data = await apiFetch(`/api/logs?limit=${LOGS_PAGE_SIZE}&offset=${logsOffset}`);
    if (!data.success) return;

    const logsList = document.getElementById('logs-list');
    const logsFooter = document.getElementById('logs-footer');

    if (reset) logsList.innerHTML = '';

    if (data.data.length === 0 && reset) {
      logsList.innerHTML = '<div class="log-empty">Belum ada riwayat sinkronisasi</div>';
      logsFooter.style.display = 'none';
      return;
    }

    data.data.forEach((log) => {
      logsList.insertAdjacentHTML('beforeend', renderLogItem(log));
    });

    logsOffset += data.data.length;
    logsFooter.style.display = data.pagination.has_more ? 'block' : 'none';
  } catch (err) {
    console.error('loadLogs error:', err);
  }
}

function loadMoreLogs() {
  loadLogs(false);
}

function renderLogItem(log) {
  const statusIcon = {
    success: '✅',
    failed: '❌',
    warning: '⚠️',
    running: '🔄',
  }[log.status] || '⏺';

  const isSimulated = log.is_simulated ? ' <span style="color:#64748b;font-size:10px">(demo)</span>' : '';
  const trigger = log.trigger === 'manual-web' ? 'Manual' : 'Otomatis';
  const duration = log.duration_ms ? `${log.duration_ms}ms` : '—';

  return `
    <div class="log-item">
      <div class="log-status-icon ${log.status}">${statusIcon}</div>
      <div class="log-content">
        <div class="log-message">${escHtml(log.message || 'Sinkronisasi berjalan...')}${isSimulated}</div>
        <div class="log-meta">
          <span class="log-badge ${log.status}">${log.status}</span>
          <span>${trigger}</span>
          <span>${formatDateTime(log.created_at)}</span>
          <span>${duration}</span>
        </div>
      </div>
      <div class="log-stats">
        <div class="log-stat">
          <div class="log-stat-value">${log.rooms_count || 0}</div>
          <div class="log-stat-label">Ruang</div>
        </div>
        <div class="log-stat">
          <div class="log-stat-value">${log.total_tersedia || 0}</div>
          <div class="log-stat-label">Tersedia</div>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   CONFIG
   ============================================================ */
async function loadConfig() {
  try {
    const data = await apiFetch('/api/config');
    if (!data.success) return;

    const cfg = data.config;
    const grid = document.getElementById('config-grid');

    const items = [
      { key: 'BPJS Base URL', val: cfg.bpjs.base_url, badge: cfg.bpjs.configured ? 'ok' : 'warn', badgeText: cfg.bpjs.configured ? 'OK' : 'Belum dikonfigurasi' },
      { key: 'BPJS Consumer ID', val: cfg.bpjs.cons_id },
      { key: 'BPJS Kode PPK', val: cfg.bpjs.kode_ppk },
      { key: 'SIRANAP Base URL', val: cfg.siranap.base_url, badge: cfg.siranap.configured ? 'ok' : 'warn', badgeText: cfg.siranap.configured ? 'OK' : 'Belum dikonfigurasi' },
      { key: 'SIRANAP Kode RS', val: cfg.siranap.rs_id },
      { key: 'Jadwal Sinkronisasi', val: cfg.scheduler.cron, badge: cfg.scheduler.enabled ? 'ok' : 'warn', badgeText: cfg.scheduler.enabled ? 'Aktif' : 'Nonaktif' },
    ];

    grid.innerHTML = items.map((item) => `
      <div class="config-item">
        <span class="config-key">${escHtml(item.key)}</span>
        <span class="config-value">
          ${escHtml(item.val)}
          ${item.badge ? `<span class="config-badge ${item.badge}">${item.badgeText}</span>` : ''}
        </span>
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('config-grid').innerHTML = '<div class="config-loading">Gagal memuat konfigurasi</div>';
  }
}

/* ============================================================
   MANUAL SYNC
   ============================================================ */
async function triggerSync() {
  if (isSyncing) return;
  isSyncing = true;

  const btn = document.getElementById('btn-sync');
  const modal = document.getElementById('sync-modal');

  btn.disabled = true;
  btn.classList.add('loading');
  modal.style.display = 'flex';

  try {
    const data = await apiFetch('/api/sync/manual', { method: 'POST' });

    modal.style.display = 'none';

    if (data.success) {
      showToast(`✅ Berhasil: ${data.data?.rooms_count || 0} ruang dikirim dalam ${data.data?.duration_ms || 0}ms${data.data?.is_simulated ? ' (mode demo)' : ''}`, 'success');
    } else {
      showToast(`⚠️ ${data.message || 'Sinkronisasi selesai dengan peringatan'}`, 'info');
    }

    // Reload data
    await Promise.allSettled([loadStatus(), loadBedData(), loadLogs(true)]);
  } catch (err) {
    modal.style.display = 'none';
    showToast(`❌ Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
    isSyncing = false;
  }
}

/* ============================================================
   HELPERS
   ============================================================ */
async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

function formatDateTime(dtStr) {
  if (!dtStr) return '—';
  try {
    const d = new Date(dtStr);
    return d.toLocaleString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return dtStr;
  }
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function animateValue(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;

  const step = target > current ? 1 : -1;
  const diff = Math.abs(target - current);
  const duration = Math.min(600, diff * 20);
  const steps = Math.min(diff, 30);
  const increment = (target - current) / steps;
  let val = current;
  let count = 0;

  const interval = setInterval(() => {
    count++;
    val += increment;
    el.textContent = Math.round(val);
    if (count >= steps) {
      el.textContent = target;
      clearInterval(interval);
    }
  }, duration / steps);
}
