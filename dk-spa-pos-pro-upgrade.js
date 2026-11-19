// DK SPA POS – Professional System Refinement & Multi-Spa Upgrade Module
// Drop into your GitHub repository and load after your core app script to refine
// greeting tone, dashboard polish, multi-spa lease controls, and OTP recovery.

(function () {
  const LEASE_KEY = 'dkspa_leases_v1';
  const OTP_KEY = 'dkspa_pro_otp_v1';
  const OTP_TTL_MS = 10 * 60 * 1000;
  const ADMIN_EMAIL = 'dkglobaltech@gmail.com';
  const ADMIN_PHONE = '254780490437';

  function getStoreKey() {
    if (typeof window.K === 'string' && window.K) return window.K;
    return location.hash === '#demo' ? 'dkspa_demo' : 'dkspa1';
  }

  function getD() {
    if (window.D && typeof window.D === 'object') return window.D;
    try {
      const raw = localStorage.getItem(getStoreKey());
      if (raw) {
        window.D = JSON.parse(raw);
        return window.D;
      }
    } catch (_) {}
    return null;
  }

  function saveD(D) {
    if (!D) return;
    window.D = D;
    if (typeof window.save === 'function') {
      try { window.save(); } catch (_) {}
    } else {
      try {
        localStorage.setItem(getStoreKey(), JSON.stringify(D));
      } catch (_) {}
    }
  }

  function getLeases() {
    const D = getD();
    if (D && Array.isArray(D.leases)) return D.leases;
    try {
      const parsed = JSON.parse(localStorage.getItem(LEASE_KEY) || '[]');
      if (Array.isArray(parsed)) {
        if (D) {
          D.leases = parsed;
          saveD(D);
        }
        return parsed;
      }
    } catch (_) {}
    return [];
  }

  function saveLeases(list) {
    const D = getD();
    try {
      localStorage.setItem(LEASE_KEY, JSON.stringify(list));
    } catch (_) {}
    if (D) {
      D.leases = list;
      saveD(D);
    }
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s ?? '').replace(/[&<>"]/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    }[c]));
  }

  function td() {
    if (typeof window.td === 'function') return window.td();
    const d = new Date();
    return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  }

  function ph254(raw) {
    if (typeof window.ph254 === 'function') {
      const p = window.ph254(raw);
      if (p) return p;
    }
    let d = String(raw || '').replace(/\D/g, '');
    if (d.startsWith('0')) d = '254' + d.slice(1);
    else if (/^[17]\d{8}$/.test(d)) d = '254' + d;
    return /^254[17]\d{8}$/.test(d) ? d : '';
  }

  function money(n) {
    const D = getD();
    if (typeof window.m === 'function' && D) return window.m(n);
    return ((D && D.cur) || 'KES') + ' ' + Math.round(+n || 0).toLocaleString();
  }

  function uid() {
    if (typeof window.U === 'function') return window.U();
    return 'id_' + Math.random().toString(36).slice(2, 9);
  }

  function logAction(msg) {
    const D = getD();
    if (!D) return;
    if (typeof window.lg === 'function' && window.cur) {
      window.lg(msg);
      return;
    }
    D.log = Array.isArray(D.log) ? D.log : [];
    D.log.unshift({
      t: new Date().toLocaleString(),
      d: td(),
      u: (window.cur && window.cur.name) || 'Platform Admin',
      a: msg
    });
    D.log.length = Math.min(D.log.length, 3000);
    saveD(D);
  }

  function injectProStyles() {
    if (document.getElementById('dk-pro-refinement-css')) return;
    const st = document.createElement('style');
    st.id = 'dk-pro-refinement-css';
    st.textContent = `
      .dk-pro-card {
        background: var(--sf, #fff);
        border: 1px solid var(--bd, #dce2df);
        border-radius: 12px;
        padding: 16px 18px;
        margin-bottom: 14px;
      }
      .dk-pro-card-hdr {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 10px;
      }
      .dk-pro-card-hdr h2, .dk-pro-card-hdr h3 {
        margin: 0;
        font-size: 18px;
      }
      .dk-pro-pill {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        border: 1px solid currentColor;
      }
      .dk-pro-pill.ok { color: var(--ok, #1f7a4f); }
      .dk-pro-pill.warn { color: var(--warn, #a8741a); }
      .dk-pro-pill.bad { color: var(--bad, #b3392f); }
      .dk-pro-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        gap: 10px;
      }
      .dk-pro-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 12px;
      }
      .dk-pro-note {
        font-size: 13px;
        color: var(--mu, #68756f);
        margin: 6px 0 0;
      }
      .dk-pro-otp-box {
        margin-top: 12px;
        padding: 14px;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        background: #f8fafc;
        color: #0f172a;
        font-size: 13px;
      }
      .dk-pro-otp-code {
        display: inline-block;
        margin-top: 6px;
        padding: 3px 10px;
        border-radius: 999px;
        background: #fef3c7;
        color: #92400e;
        border: 1px solid #fcd34d;
        font-weight: 700;
      }
    `;
    document.head.appendChild(st);
  }

  // Refine greeting copy so active business names and time-of-day greetings look crisp and professional
  function polishGreetingCopy() {
    const D = getD();
    const cur = window.cur;
    if (!D || !cur) return;

    const main = document.getElementById('main');
    if (!main) return;

    const firstName = String(cur.name || 'Team').split(' ')[0];
    const hour = new Date().getHours();
    const isSw = D.lang === 'sw';
    const greeting = isSw
      ? (hour < 12 ? 'Habari za asubuhi' : hour < 17 ? 'Habari za mchana' : 'Habari za jioni')
      : (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

    const bizName = D.biz || 'DK SPA POS';
    main.querySelectorAll('h2, p').forEach((el) => {
      if (el.tagName === 'H2' && /Good (morning|afternoon|evening)|Habari za/i.test(el.textContent || '')) {
        el.textContent = `${greeting}, ${firstName}!`;
      }
      if (el.tagName === 'P' && /Wishing you a wonderful day at/i.test(el.textContent || '')) {
        el.textContent = `Welcome to ${bizName}. Here is your live operational overview for today.`;
      }
    });
  }

  // Add quick-action toolbar on Dashboard for smooth daily operations
  function enhanceDashboardToolbar() {
    const D = getD();
    const cur = window.cur;
    const main = document.getElementById('main');
    if (!D || !cur || !main) return;
    if (document.getElementById('dk-pro-quickbar')) return;

    const isDash = !!main.querySelector('.kpis') && !!main.querySelector('.bars');
    if (!isDash) return;

    injectProStyles();
    const bar = document.createElement('div');
    bar.id = 'dk-pro-quickbar';
    bar.className = 'dk-pro-card';
    bar.innerHTML = `
      <div class="dk-pro-card-hdr">
        <div>
          <h3>Quick Operations · ${esc(D.biz || 'DK SPA POS')}</h3>
          <p class="dk-pro-note">Active Plan: <span class="dk-pro-pill ${D.plan && D.plan.status === 'active' ? 'ok' : 'bad'}">${esc((D.plan && D.plan.status) || 'active')}</span> · Monthly Fee: <b>${money((D.plan && D.plan.fee) || 0)}</b></p>
        </div>
        <div class="dk-pro-actions" style="margin-top:0">
          <button type="button" class="btn s" id="dk-qb-sale">+ Walk-In Sale</button>
          <button type="button" class="btn g s" id="dk-qb-exp">+ Expense</button>
          <button type="button" class="btn g s" id="dk-qb-close">Daily Close</button>
          <button type="button" class="btn g s" id="dk-qb-rep">Reports</button>
        </div>
      </div>
    `;

    const kpisEl = main.querySelector('.kpis');
    if (kpisEl && kpisEl.parentNode === main) {
      main.insertBefore(bar, kpisEl);
    } else {
      main.prepend(bar);
    }

    document.getElementById('dk-qb-sale').onclick = () => {
      if (typeof window.addSale === 'function') window.addSale();
      else if (typeof window.view !== 'undefined') { window.view = 'pos'; window.render && window.render(); }
    };
    document.getElementById('dk-qb-exp').onclick = () => {
      if (typeof window.addExp === 'function') window.addExp();
      else if (typeof window.view !== 'undefined') { window.view = 'exp'; window.render && window.render(); }
    };
    document.getElementById('dk-qb-close').onclick = () => {
      window.view = 'close';
      if (typeof window.render === 'function') window.render();
    };
    document.getElementById('dk-qb-rep').onclick = () => {
      window.view = 'rep';
      if (typeof window.render === 'function') window.render();
    };
  }

  // Sync a leased spa record into live D state cleanly
  function applyLeaseToLiveStore(D, lease, makeCurrent) {
    if (!D || !lease) return;
    D.users = Array.isArray(D.users) ? D.users : [];
    D.reqs = Array.isArray(D.reqs) ? D.reqs : [];
    D.plan = D.plan && typeof D.plan === 'object' ? D.plan : {};
    D.mods = D.mods && typeof D.mods === 'object' ? D.mods : { inv: 1, tasks: 1, close: 1 };

    const email = String(lease.ownerEmail || '').trim().toLowerCase();
    const phone = ph254(lease.ownerPhone) || lease.ownerPhone || '';
    const perms = Array.isArray(lease.perms) && lease.perms.length
      ? lease.perms.slice()
      : (Array.isArray(window.ALL) ? window.ALL.slice() : ['dash', 'book', 'pos', 'cli', 'msg', 'svc', 'exp', 'inv', 'tasks', 'close', 'rep', 'mpesa', 'camp', 'web', 'users', 'log']);

    let mgr = D.users.find((u) => (lease.managerId && u.id === lease.managerId) || (email && String(u.email || '').toLowerCase() === email));
    if (!mgr && email) {
      mgr = {
        id: lease.managerId || uid(),
        name: lease.ownerName || lease.spaName,
        email,
        phone,
        pw: lease.initialPassword || '',
        needsLoginSetup: !lease.initialPassword,
        role: 'manager',
        spaId: lease.id,
        spaName: lease.spaName,
        perms
      };
      D.users.push(mgr);
    } else if (mgr) {
      mgr.name = lease.ownerName || mgr.name;
      if (email) mgr.email = email;
      if (phone) mgr.phone = phone;
      if (lease.initialPassword) {
        mgr.pw = lease.initialPassword;
        mgr.needsLoginSetup = false;
      }
      mgr.role = mgr.role === 'platform' ? 'platform' : 'manager';
      mgr.spaId = lease.id;
      mgr.spaName = lease.spaName;
      mgr.perms = perms;
    }

    if (mgr) lease.managerId = mgr.id;

    if (email) {
      let req = D.reqs.find((r) => String(r.email || '').toLowerCase() === email);
      if (!req) {
        D.reqs.push({
          id: uid(),
          spa: lease.spaName,
          owner: lease.ownerName,
          email,
          phone,
          pw: lease.initialPassword || '',
          pin: lease.kraPin || '',
          logo: '',
          status: 'approved',
          agr: 'signed',
          date: td(),
          leaseId: lease.id
        });
      } else {
        req.spa = lease.spaName;
        req.owner = lease.ownerName;
        req.phone = phone;
        if (lease.kraPin) req.pin = lease.kraPin;
        req.status = 'approved';
        req.agr = 'signed';
        req.leaseId = lease.id;
      }
    }

    if (makeCurrent) {
      D.biz = lease.spaName;
      if (phone) D.wa = phone;
      if (lease.kraPin) D.kra = lease.kraPin;
      D.plan.setup = +lease.setupFee || 0;
      D.plan.fee = +lease.monthlyFee || 0;
      D.plan.due = lease.nextDue || '';
      D.plan.status = lease.status === 'active' ? 'active' : 'suspended';
      D.plan.note = lease.notes || `Lease ${lease.code || lease.id}`;
      if (lease.mods) {
        D.mods = {
          inv: lease.mods.inv ? 1 : 0,
          tasks: lease.mods.tasks ? 1 : 0,
          close: lease.mods.close ? 1 : 0
        };
      }
    }

    saveD(D);
  }

  // Professional Platform Admin Lease & Assignment Console
  function renderProPlatformConsole() {
    const cur = window.cur;
    const main = document.getElementById('main');
    if (!cur || cur.role !== 'platform' || !main) return;
    if (document.getElementById('dk-pro-platform-console')) return;

    const D = getD();
    if (!D) return;
    injectProStyles();

    const leases = getLeases();
    const wrap = document.createElement('div');
    wrap.id = 'dk-pro-platform-console';
    wrap.className = 'dk-pro-card';

    const tableRows = leases.length
      ? leases.map((l) => {
          const active = String(D.biz || '').toLowerCase() === String(l.spaName || '').toLowerCase();
          return `
            <tr>
              <td><b>${esc(l.code || l.id)}</b></td>
              <td>${esc(l.spaName)} ${active ? '<span class="dk-pro-pill ok">active</span>' : ''}</td>
              <td>${esc(l.ownerName)}<br><small style="color:var(--mu)">${esc(l.ownerEmail || '—')} · ${esc(l.ownerPhone || '—')}</small></td>
              <td>${money(l.setupFee)} setup / ${money(l.monthlyFee)} mo</td>
              <td>${esc(l.nextDue || '—')}</td>
              <td><span class="dk-pro-pill ${l.status === 'active' ? 'ok' : 'bad'}">${esc(l.status || 'active')}</span></td>
              <td style="white-space:nowrap">
                <button type="button" class="btn s" data-pro-act="switch" data-id="${esc(l.id)}">Switch Spa</button>
                <button type="button" class="btn g s" data-pro-act="toggle" data-id="${esc(l.id)}">${l.status === 'active' ? 'Suspend' : 'Activate'}</button>
                <button type="button" class="btn d s" data-pro-act="del" data-id="${esc(l.id)}">Delete</button>
              </td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="7" style="color:var(--mu);padding:12px">No leased spas created yet. Add a leased spa below to assign credentials and terms dynamically.</td></tr>`;

    wrap.innerHTML = `
      <div class="dk-pro-card-hdr">
        <div>
          <h2>Multi-Spa Leasing &amp; Assignment Control</h2>
          <p class="dk-pro-note">Provision spa manager logins, billing cycles, module access, and active business context dynamically.</p>
        </div>
        <button type="button" class="btn g s" id="dk-pro-export-btn">Export Leases (.json)</button>
      </div>

      <form id="dk-pro-lease-form">
        <div class="dk-pro-grid">
          <div>
            <label>Spa Name *</label>
            <input id="dk-pl-spa" type="text" placeholder="e.g. Serene Glow Spa" required>
          </div>
          <div>
            <label>Manager / Owner Name *</label>
            <input id="dk-pl-owner" type="text" placeholder="e.g. Nancy Wambui" required>
          </div>
          <div>
            <label>Manager Email *</label>
            <input id="dk-pl-email" type="email" placeholder="manager@sereneglow.co.ke" required>
          </div>
          <div>
            <label>Manager Phone (07… / 254…)</label>
            <input id="dk-pl-phone" type="tel" inputmode="tel" placeholder="0712345678">
          </div>
          <div>
            <label>Setup Fee</label>
            <input id="dk-pl-setup" type="number" min="0" step="any" value="${(D.plan && +D.plan.setup) || 20000}">
          </div>
          <div>
            <label>Monthly Lease Fee</label>
            <input id="dk-pl-fee" type="number" min="0" step="any" value="${(D.plan && +D.plan.fee) || 10000}">
          </div>
          <div>
            <label>Next Payment Due</label>
            <input id="dk-pl-due" type="date" value="${(D.plan && D.plan.due) || ''}">
          </div>
          <div>
            <label>Initial Password (8+ chars, optional)</label>
            <input id="dk-pl-pw" type="text" placeholder="Optional initial password">
          </div>
        </div>
        <div class="dk-pro-actions">
          <label style="display:inline-flex;align-items:center;gap:6px;margin:0"><input type="checkbox" id="dk-pl-switch" checked> Switch active spa context immediately</label>
        </div>
        <div class="dk-pro-actions">
          <button type="submit" class="btn">Create &amp; Assign Spa Lease</button>
        </div>
        <div id="dk-pl-status" class="dk-pro-note"></div>
      </form>

      <div class="wrap" style="margin-top:14px">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Spa</th>
              <th>Manager</th>
              <th>Billing</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    `;

    main.appendChild(wrap);

    document.getElementById('dk-pro-export-btn').onclick = () => {
      const blob = new Blob([JSON.stringify(getLeases(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dk-spa-leases-' + td() + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    document.getElementById('dk-pro-lease-form').onsubmit = (e) => {
      e.preventDefault();
      const statusEl = document.getElementById('dk-pl-status');
      const spaName = document.getElementById('dk-pl-spa').value.trim();
      const ownerName = document.getElementById('dk-pl-owner').value.trim();
      const ownerEmail = document.getElementById('dk-pl-email').value.trim().toLowerCase();
      const rawPhone = document.getElementById('dk-pl-phone').value.trim();
      const ownerPhone = ph254(rawPhone) || rawPhone;
      const setupFee = +document.getElementById('dk-pl-setup').value || 0;
      const monthlyFee = +document.getElementById('dk-pl-fee').value || 0;
      const nextDue = document.getElementById('dk-pl-due').value;
      const initialPassword = document.getElementById('dk-pl-pw').value.trim();
      const makeCurrent = document.getElementById('dk-pl-switch').checked;

      if (!spaName || !ownerName || !ownerEmail.includes('@')) {
        statusEl.style.color = 'var(--bad, #b3392f)';
        statusEl.textContent = 'Please fill in Spa Name, Manager Name, and a valid Manager Email.';
        return;
      }
      if (initialPassword && initialPassword.length < 8) {
        statusEl.style.color = 'var(--bad, #b3392f)';
        statusEl.textContent = 'Password must be at least 8 characters when provided.';
        return;
      }

      const list = getLeases();
      const newLease = {
        id: uid(),
        code: 'SPA-' + String(list.length + 1).padStart(3, '0'),
        spaName,
        ownerName,
        ownerEmail,
        ownerPhone,
        setupFee,
        monthlyFee,
        nextDue,
        status: 'active',
        initialPassword,
        mods: { inv: 1, tasks: 1, close: 1 },
        perms: Array.isArray(window.ALL) ? window.ALL.slice() : ['dash', 'book', 'pos', 'cli', 'msg', 'svc', 'exp', 'inv', 'tasks', 'close', 'rep', 'mpesa', 'camp', 'web', 'users', 'log']
      };
      list.unshift(newLease);
      saveLeases(list);
      applyLeaseToLiveStore(D, newLease, makeCurrent);
      logAction(`Created and assigned lease ${newLease.code} for ${spaName}`);
      if (typeof window.render === 'function') window.render();
    };

    wrap.querySelectorAll('button[data-pro-act]').forEach((btn) => {
      btn.onclick = () => {
        const act = btn.getAttribute('data-pro-act');
        const id = btn.getAttribute('data-id');
        const list = getLeases();
        const item = list.find((x) => x.id === id);
        if (!item) return;

        if (act === 'switch') {
          applyLeaseToLiveStore(D, item, true);
          logAction(`Switched active spa to ${item.spaName}`);
          if (typeof window.render === 'function') window.render();
        } else if (act === 'toggle') {
          item.status = item.status === 'active' ? 'suspended' : 'active';
          saveLeases(list);
          applyLeaseToLiveStore(D, item, String(D.biz || '').toLowerCase() === String(item.spaName || '').toLowerCase());
          logAction(`Set lease ${item.spaName} status to ${item.status}`);
          if (typeof window.render === 'function') window.render();
        } else if (act === 'del') {
          if (!confirm(`Delete lease record for ${item.spaName}?`)) return;
          saveLeases(list.filter((x) => x.id !== id));
          logAction(`Deleted lease record for ${item.spaName}`);
          if (typeof window.render === 'function') window.render();
        }
      };
    });
  }

  // Ensure Forgot Password / OTP recovery is always accessible on the login screen for any account or admin
  function attachProOtpRecovery() {
    const lf = document.getElementById('lf');
    if (!lf) return;
    injectProStyles();

    const fp = document.getElementById('fp');
    if (fp && !fp.dataset.dkProBound) {
      fp.dataset.dkProBound = '1';
      fp.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openProOtpModal();
      });
    }
  }

  function openProOtpModal() {
    const lf = document.getElementById('lf');
    const D = getD();
    if (!lf || !D) return;

    let box = document.getElementById('dk-pro-otp-widget');
    if (!box) {
      box = document.createElement('div');
      box.id = 'dk-pro-otp-widget';
      box.className = 'dk-pro-otp-box';
      lf.appendChild(box);
    }

    const currentEmail = (document.getElementById('le') && document.getElementById('le').value.trim()) || ADMIN_EMAIL;
    const defaultPhone = ph254(D.wa || ADMIN_PHONE) || ADMIN_PHONE;

    box.innerHTML = `
      <b>OTP Password Reset (WhatsApp / SMS)</b>
      <p style="margin:4px 0 8px;color:#475569">Request a 6-digit OTP to reset your password and sign in.</p>
      <label style="margin:6px 0 2px">Account Email</label>
      <input id="dk-potp-em" type="email" value="${esc(currentEmail)}">
      <label style="margin:6px 0 2px">Phone Number (07… / 254…)</label>
      <input id="dk-potp-ph" type="tel" inputmode="tel" value="${esc(defaultPhone)}">
      <label style="margin:6px 0 2px">Channel</label>
      <select id="dk-potp-ch">
        <option value="whatsapp">WhatsApp OTP</option>
        <option value="sms">SMS OTP</option>
      </select>
      <div class="dk-pro-actions">
        <button type="button" class="btn s" id="dk-potp-send">Send OTP</button>
        <button type="button" class="btn g s" id="dk-potp-hide">Close</button>
      </div>
      <div id="dk-potp-msg" class="dk-pro-note"></div>
      <div id="dk-potp-step2" style="display:none;margin-top:8px">
        <label style="margin:6px 0 2px">6-Digit OTP</label>
        <input id="dk-potp-code" type="text" inputmode="numeric" maxlength="6" placeholder="123456">
        <label style="margin:6px 0 2px">New Password (8+ chars)</label>
        <input id="dk-potp-pw" type="password" autocomplete="new-password" placeholder="Enter new password">
        <div class="dk-pro-actions">
          <button type="button" class="btn s" id="dk-potp-apply">Verify &amp; Update Password</button>
        </div>
      </div>
    `;

    const msgEl = document.getElementById('dk-potp-msg');
    document.getElementById('dk-potp-hide').onclick = () => box.remove();

    document.getElementById('dk-potp-send').onclick = () => {
      const em = document.getElementById('dk-potp-em').value.trim().toLowerCase();
      const ph = ph254(document.getElementById('dk-potp-ph').value.trim());
      const ch = document.getElementById('dk-potp-ch').value;
      if (!em.includes('@') || !ph) {
        msgEl.style.color = '#b91c1c';
        msgEl.textContent = 'Enter a valid email and phone number.';
        return;
      }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      try {
        sessionStorage.setItem(OTP_KEY, JSON.stringify({ em, ph, ch, code, exp: Date.now() + OTP_TTL_MS }));
      } catch (_) {}

      const text = `DK SPA POS OTP for ${em}: ${code} (valid 10 minutes).`;
      if (ch === 'whatsapp') {
        window.open(`https://wa.me/${ph}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      } else {
        const sep = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
        try { window.location.href = `sms:+${ph}${sep}body=${encodeURIComponent(text)}`; } catch (_) {}
      }

      document.getElementById('dk-potp-step2').style.display = 'block';
      msgEl.style.color = '#15803d';
      msgEl.innerHTML = `OTP generated for +${ph} via ${ch.toUpperCase()}. <span class="dk-pro-otp-code">OTP: ${code}</span>`;
    };

    document.getElementById('dk-potp-apply').onclick = () => {
      const codeIn = document.getElementById('dk-potp-code').value.trim();
      const pwIn = document.getElementById('dk-potp-pw').value;
      let sess = null;
      try { sess = JSON.parse(sessionStorage.getItem(OTP_KEY) || 'null'); } catch (_) {}
      if (!sess || Date.now() > sess.exp) {
        msgEl.style.color = '#b91c1c';
        msgEl.textContent = 'OTP expired. Send a new OTP first.';
        return;
      }
      if (codeIn !== sess.code) {
        msgEl.style.color = '#b91c1c';
        msgEl.textContent = 'Invalid OTP code.';
        return;
      }
      if (pwIn.length < 8) {
        msgEl.style.color = '#b91c1c';
        msgEl.textContent = 'Password must be at least 8 characters.';
        return;
      }

      D.users = Array.isArray(D.users) ? D.users : [];
      let u = D.users.find((x) => String(x.email || '').toLowerCase() === sess.em);
      if (!u) {
        u = {
          id: uid(),
          name: sess.em === ADMIN_EMAIL ? 'DK Global Tech (Platform admin)' : sess.em,
          email: sess.em,
          phone: sess.ph,
          pw: pwIn,
          role: sess.em === ADMIN_EMAIL ? 'platform' : 'manager',
          perms: Array.isArray(window.ALL) ? window.ALL.slice() : ['dash', 'book', 'pos', 'cli', 'msg', 'svc', 'exp', 'inv', 'tasks', 'close', 'rep', 'mpesa', 'camp', 'web', 'users', 'log']
        };
        D.users.push(u);
      } else {
        u.pw = pwIn;
        u.phone = sess.ph;
        u.needsLoginSetup = false;
      }
      saveD(D);
      try { sessionStorage.removeItem(OTP_KEY); } catch (_) {}

      const le = document.getElementById('le');
      const lp = document.getElementById('lp');
      if (le && lp) {
        le.value = u.email;
        lp.value = pwIn;
      }
      msgEl.style.color = '#15803d';
      msgEl.textContent = 'Password updated! Click Login to continue.';
    };
  }

  function runRefinements() {
    polishGreetingCopy();
    enhanceDashboardToolbar();
    renderProPlatformConsole();
    attachProOtpRecovery();
  }

  const observer = new MutationObserver(() => {
    runRefinements();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      runRefinements();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    runRefinements();
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
