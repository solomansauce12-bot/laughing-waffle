/* =============================================
   LarpAuth – Shared JS
   ============================================= */

/* ── Toast ── */
function toast(msg, type = 'info') {
  const icons = {
    info:    '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    success: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  };
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `${icons[type] || icons.info}<span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, 3000);
}

/* ── Modal ── */
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
  if (e.target.dataset.closeModal) closeModal(e.target.dataset.closeModal);
});

/* ── Copy to clipboard ── */
function copyText(text, label = 'Copied') {
  navigator.clipboard.writeText(text).then(() => toast(`${label} copied to clipboard`, 'success'));
}

/* ── UUID generator ── */
function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

/* ── Random license key ── */
function genLicenseKey(prefix = 'LARP') {
  const seg = () => Math.random().toString(36).substring(2,7).toUpperCase();
  return `${prefix}-${seg()}-${seg()}-${seg()}-${seg()}`;
}

/* ── LocalStorage helpers ── */
const DB = {
  get: (k, fallback = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  del: (k)    => localStorage.removeItem(k),
};

/* ── Seed demo data ── */
function seedData() {
  if (!DB.get('la_seeded')) {
    DB.set('la_apps', [
      { id: uuidv4(), name: 'MyApp Pro', version: '1.0.0', status: 'active', secret: uuidv4(), users: 14, licenses: 22, created: '2025-03-10' },
      { id: uuidv4(), name: 'Loader v2', version: '2.1.0', status: 'active', secret: uuidv4(), users: 7,  licenses: 9,  created: '2025-04-01' },
    ]);
    DB.set('la_licenses', [
      { id: uuidv4(), key: genLicenseKey(), appId: '', level: 1, used: true,  username: 'darkstar',   ip: '192.168.1.5',  created: '2025-03-10', expires: '2026-03-10' },
      { id: uuidv4(), key: genLicenseKey(), appId: '', level: 1, used: true,  username: 'xploit99',   ip: '10.0.0.42',    created: '2025-03-12', expires: '2026-03-12' },
      { id: uuidv4(), key: genLicenseKey(), appId: '', level: 2, used: false, username: '',           ip: '',             created: '2025-04-01', expires: '2026-04-01' },
      { id: uuidv4(), key: genLicenseKey(), appId: '', level: 1, used: true,  username: 'n0v4',       ip: '172.16.0.8',   created: '2025-04-03', expires: '2026-04-03' },
    ]);
    DB.set('la_users', [
      { id: uuidv4(), username: 'darkstar', email: 'dark@example.com', ip: '192.168.1.5',  level: 1, banned: false, created: '2025-03-10', lastSeen: '2025-04-14', hwid: uuidv4() },
      { id: uuidv4(), username: 'xploit99', email: 'x@example.com',    ip: '10.0.0.42',    level: 1, banned: false, created: '2025-03-12', lastSeen: '2025-04-12', hwid: uuidv4() },
      { id: uuidv4(), username: 'n0v4',     email: 'nova@example.com', ip: '172.16.0.8',   level: 2, banned: false, created: '2025-04-03', lastSeen: '2025-04-13', hwid: uuidv4() },
      { id: uuidv4(), username: 'ghost',    email: 'g@example.com',    ip: '10.10.1.1',    level: 1, banned: true,  created: '2025-01-05', lastSeen: '2025-02-20', hwid: uuidv4() },
    ]);
    DB.set('la_logs', [
      { id: uuidv4(), action: 'Login',          username: 'darkstar', ip: '192.168.1.5', app: 'MyApp Pro', ts: new Date(Date.now()-3600000).toISOString(),  ok: true  },
      { id: uuidv4(), action: 'License Check',  username: 'xploit99', ip: '10.0.0.42',  app: 'MyApp Pro', ts: new Date(Date.now()-7200000).toISOString(),  ok: true  },
      { id: uuidv4(), action: 'Login',          username: 'ghost',    ip: '10.10.1.1',  app: 'Loader v2', ts: new Date(Date.now()-10800000).toISOString(), ok: false },
      { id: uuidv4(), action: 'Register',       username: 'n0v4',     ip: '172.16.0.8', app: 'MyApp Pro', ts: new Date(Date.now()-14400000).toISOString(), ok: true  },
    ]);
    DB.set('la_settings', { ownerName: 'Admin', email: 'admin@larpauth.io', sellerKey: genLicenseKey('SK'), twofa: false, webhookUrl: '' });
    DB.set('la_seeded', true);
  }
}

/* ── Sidebar active nav ── */
function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === path);
  });
}

/* ── Sidebar toggle (mobile) ── */
function initSidebarToggle() {
  const btn = document.getElementById('sidebar-toggle');
  const sb  = document.getElementById('sidebar');
  btn?.addEventListener('click', () => sb?.classList.toggle('open'));
}

/* ── Format date ── */
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDateShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── Auth guard (simple) ── */
function requireAuth() {
  const pages = ['dashboard.html','applications.html','licenses.html','users.html','settings.html'];
  const page = window.location.pathname.split('/').pop();
  if (pages.includes(page) && !DB.get('la_authed')) {
    window.location.href = 'login.html';
  }
}

/* ── Shield SVG ── */
const SHIELD_SVG = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 2L4 7v9c0 6.627 5.148 11.5 12 13 6.852-1.5 12-6.373 12-13V7L16 2z" fill="#1d4ed8" stroke="#3b82f6" stroke-width="1.5"/>
  <path d="M16 2L4 7v9c0 6.627 5.148 11.5 12 13 6.852-1.5 12-6.373 12-13V7L16 2z" fill="url(#sg)"/>
  <path d="M11 16.5l3.5 3.5 6.5-7" stroke="#93c5fd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <defs>
    <linearGradient id="sg" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
      <stop stop-color="#3b82f6" stop-opacity="0.3"/>
      <stop offset="1" stop-color="#1d4ed8" stop-opacity="0.1"/>
    </linearGradient>
  </defs>
</svg>`;

const SHIELD_SVG_LG = `<svg width="48" height="48" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 2L4 7v9c0 6.627 5.148 11.5 12 13 6.852-1.5 12-6.373 12-13V7L16 2z" fill="#1d4ed8" stroke="#3b82f6" stroke-width="1.5"/>
  <path d="M16 2L4 7v9c0 6.627 5.148 11.5 12 13 6.852-1.5 12-6.373 12-13V7L16 2z" fill="url(#sg2)"/>
  <path d="M11 16.5l3.5 3.5 6.5-7" stroke="#93c5fd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <defs>
    <linearGradient id="sg2" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
      <stop stop-color="#3b82f6" stop-opacity="0.3"/>
      <stop offset="1" stop-color="#1d4ed8" stop-opacity="0.1"/>
    </linearGradient>
  </defs>
</svg>`;

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  seedData();
  requireAuth();
  setActiveNav();
  initSidebarToggle();
  const user = DB.get('la_settings');
  document.querySelectorAll('.js-owner-name').forEach(el => { if (el) el.textContent = user?.ownerName || 'Admin'; });
  document.querySelectorAll('.js-owner-initials').forEach(el => { if (el) el.textContent = (user?.ownerName || 'A')[0].toUpperCase(); });
  document.querySelectorAll('.js-shield').forEach(el => { el.innerHTML = SHIELD_SVG; });
  document.querySelectorAll('.js-shield-lg').forEach(el => { el.innerHTML = SHIELD_SVG_LG; });
});
