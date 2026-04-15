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

/* ── Cloudflare Worker URL ── (set this after deploying your Worker) */
const WORKER_URL = localStorage.getItem('la_worker_url') || '';

/* ── Worker API sync helper ── */
async function workerSync(payload) {
  if (!WORKER_URL) return { ok: false, skipped: true };
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e) {
    console.warn('Worker sync failed:', e);
    return { ok: false, error: String(e) };
  }
}

/* ── LocalStorage helpers ── */
const DB = {
  get: (k, fallback = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  del: (k)    => localStorage.removeItem(k),
};

/* ── Owner account (hardcoded, always exists) ── */
const OWNER = { username: 'PeachAppleDemon', password: 'Admin', role: 'owner' };

/* ── Init fresh data (no seed demo data) ── */
function seedData() {
  DB.del('la_seeded'); /* clear old seed flag from previous version */
  if (!DB.get('la_inited')) {
    DB.set('la_apps',     []);
    DB.set('la_licenses', []);
    DB.set('la_users',    []);
    DB.set('la_logs',     []);
    DB.set('la_invites',  []);
    DB.set('la_settings', { ownerName: 'PeachAppleDemon', email: '', sellerKey: genLicenseKey('SK'), twofa: false, webhookUrl: '' });
    DB.set('la_inited', true);
  }
}

/* ── Invite code helpers ── */
function validateInvite(code) {
  const invites = DB.get('la_invites', []);
  const inv = invites.find(i => i.code === code.trim().toUpperCase());
  if (!inv) return { ok: false, msg: 'Invalid invite code.' };
  if (!inv.active) return { ok: false, msg: 'This invite code has been disabled.' };
  if (inv.maxUses > 0 && inv.uses >= inv.maxUses) return { ok: false, msg: 'This invite code has reached its usage limit.' };
  return { ok: true, inv };
}

function redeemInvite(code) {
  const invites = DB.get('la_invites', []);
  const idx = invites.findIndex(i => i.code === code.trim().toUpperCase());
  if (idx < 0) return;
  invites[idx].uses = (invites[idx].uses || 0) + 1;
  if (invites[idx].maxUses > 0 && invites[idx].uses >= invites[idx].maxUses) invites[idx].active = false;
  DB.set('la_invites', invites);
}

/* ── Check if current session is owner ── */
function isOwner() { return DB.get('la_role') === 'owner'; }

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

/* ── Auth guard ── */
function requireAuth() {
  const authPages  = ['dashboard.html','applications.html','licenses.html','users.html','settings.html','invites.html'];
  const ownerPages = ['invites.html'];
  const page = window.location.pathname.split('/').pop();
  if (authPages.includes(page) && !DB.get('la_authed')) {
    window.location.href = 'login.html'; return;
  }
  if (ownerPages.includes(page) && !isOwner()) {
    window.location.href = 'dashboard.html';
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
  const name = isOwner() ? OWNER.username : (user?.ownerName || 'User');
  document.querySelectorAll('.js-owner-name').forEach(el => { if (el) el.textContent = name; });
  document.querySelectorAll('.js-owner-initials').forEach(el => { if (el) el.textContent = name[0].toUpperCase(); });
  document.querySelectorAll('.js-role-label').forEach(el => { if (el) el.textContent = isOwner() ? 'Owner' : 'Member'; });
  document.querySelectorAll('.js-shield').forEach(el => { el.innerHTML = SHIELD_SVG; });
  document.querySelectorAll('.js-shield-lg').forEach(el => { el.innerHTML = SHIELD_SVG_LG; });
  /* Show invite nav only for owner */
  document.querySelectorAll('.nav-owner-only').forEach(el => {
    el.style.display = isOwner() ? '' : 'none';
  });
});
