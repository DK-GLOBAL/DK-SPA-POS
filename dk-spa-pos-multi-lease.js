// DK SPA POS – Dynamic Multi-Spa Leasing, Direct Admin Assignment & Manager Team Delegation
// Works with DK SPA POS ('dkspa1' / 'dkspa_demo') and enhances Platform Admin + Manager Team & rights.

(function () {
  const LEASE_STORE_KEY = 'dkspa_leases_v1';
  const OTP_TTL_MS = 10 * 60 * 1000;
  const OTP_STORE_KEY = 'dkspa_otp_sessions_v1';

  function getStoreKey() {
    if (typeof window.K === 'string' && window.K) return window.K;
    return location.hash === '#demo' ? 'dkspa_demo' : 'dkspa1';
  }

  function loadD() {
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
      window.save();
    } else {
      try {
        localStorage.setItem(getStoreKey(), JSON.stringify(D));
      } catch (_) {}
    }
  }

  function loadLeases() {
    const D = loadD();
    if (D && Array.isArray(D.leases)) return D.leases;
    try {
      const raw = localStorage.getItem(LEASE_STORE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
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

  function saveLeases(leases) {
    const D = loadD();
    try {
      localStorage.setItem(LEASE_STORE_KEY, JSON.stringify(leases));
    } catch (_) {}
    if (D) {
      D.leases = leases;
      saveD(D);
    }
  }

  function uid() {
    if (typeof window.U === 'function') return window.U();
    return 'ls_' + Math.random().toString(36).slice(2, 9);
  }

  function todayStr() {
    if (typeof window.td === 'function') return window.td();
    const d = new Date();
    return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
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
    const D = loadD();
    if (typeof window.m === 'function' && D) return window.m(n);
    const cur = (D && D.cur) || 'KES';
    return cur + ' ' + Math.round(+n || 0).toLocaleString();
  }

  function addLog(msg, actor) {
    const D = loadD();
    if (!D) return;
    const who = actor || (window.cur && window.cur.name) || 'Platform Admin';
    if (typeof window.lg === 'function' && window.cur) {
      window.lg(msg);
      return;
    }
    D.log = Array.isArray(D.log) ? D.log : [];
    D.log.unshift({ t: new Date().toLocaleString(), d: todayStr(), u: who, a: msg });
    D.log.length = Math.min(D.log.length, 3000);
    saveD(D);
  }

  function getAllPerms() {
    return Array.isArray(window.ALL) && window.ALL.length
      ? window.ALL.slice()
      : ['dash', 'book', 'pos', 'cli', 'msg', 'svc', 'exp', 'inv', 'tasks', 'close', 'rep', 'mpesa', 'camp', 'web', 'users', 'log'];
  }

  function getPermLabel(code) {
    const D = loadD();
    const map = window.NAMES || {};
    const sw = (D && D.lang === 'sw' && window.SW) || {};
    const label = map[code] || code;
    return sw[label] || label;
  }

  function isPlatformAdmin() {
    const cur = window.cur;
    return !!(cur && cur.role === 'platform');
  }

  function isSpaManager() {
    const cur = window.cur;
    if (!cur) return false;
    if (cur.role === 'manager' || cur.role === 'platform') return true;
    return Array.isArray(cur.perms) && cur.perms.includes('users');
  }

  function injectStyles() {
    if (document.getElementById('dk-multi-lease-styles')) return;
    const st = document.createElement('style');
    st.id = 'dk-multi-lease-styles';
    st.textContent = `
      .dk-lease-pan {
        background: var(--sf, #fff);
        border: 1px solid var(--bd, #dce2df);
        border-radius: 10px;
        padding: 16px;
        margin-top: 14px;
        margin-bottom: 14px;
      }
      .dk-lease-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }
      .dk-lease-head h2 {
        margin: 0;
        font-size: 18px;
      }
      .dk-lease-form {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        gap: 10px;
        margin-top: 10px;
      }
      .dk-lease-mods {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 10px;
      }
      .dk-lease-mods label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        color: var(--tx, #17211f);
        font-size: 13px;
      }
      .dk-lease-badge {
        padding: 2px 9px;
        border-radius: 99px;
        font-size: 12px;
        border: 1px solid currentColor;
        display: inline-block;
      }
      .dk-lease-badge.active { color: var(--ok, #1f7a4f); }
      .dk-lease-badge.suspended, .dk-lease-badge.expired { color: var(--bad, #b3392f); }
      .dk-lease-badge.pending { color: var(--warn, #a8741a); }
      .dk-lease-note {
        font-size: 12.5px;
        color: var(--mu, #68756f);
        margin-top: 8px;
      }
      .dk-lease-err {
        color: var(--bad, #b3392f);
        font-size: 13px;
        font-weight: 600;
        margin-top: 8px;
      }
      .dk-lease-ok {
        color: var(--ok, #1f7a4f);
        font-size: 13px;
        font-weight: 600;
        margin-top: 8px;
      }
    `;
    document.head.appendChild(st);
  }

  // Sync an assigned/leased spa into D so logins, modules, fees, and active spa context remain dynamic
  function syncLeaseToApp(D, lease, activateAsCurrentBiz) {
    if (!D || !lease) return;
    D.users = Array.isArray(D.users) ? D.users : [];
    D.reqs = Array.isArray(D.reqs) ? D.reqs : [];
    D.mods = D.mods && typeof D.mods === 'object' ? D.mods : { inv: 1, tasks: 1, close: 1 };
    D.plan = D.plan && typeof D.plan === 'object' ? D.plan : {};

    const cleanEmail = String(lease.ownerEmail || '').trim().toLowerCase();
    const cleanPhone = ph254(lease.ownerPhone) || lease.ownerPhone || '';
    const perms = Array.isArray(lease.perms) && lease.perms.length ? lease.perms.slice() : getAllPerms();

    let mgr = D.users.find((u) => {
      if (lease.managerId && u.id === lease.managerId) return true;
      return cleanEmail && String(u.email || '').toLowerCase() === cleanEmail;
    });

    if (!mgr && cleanEmail) {
      mgr = {
        id: lease.managerId || uid(),
        name: lease.ownerName || lease.spaName || 'Spa Manager',
        email: cleanEmail,
        phone: cleanPhone,
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
      if (cleanEmail) mgr.email = cleanEmail;
      if (cleanPhone) mgr.phone = cleanPhone;
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

    // Also mirror into D.reqs as approved so post-approval login setup & admin tables stay aligned
    if (cleanEmail) {
      let req = D.reqs.find((r) => String(r.email || '').toLowerCase() === cleanEmail);
      if (!req) {
        req = {
          id: uid(),
          spa: lease.spaName,
          owner: lease.ownerName,
          email: cleanEmail,
          phone: cleanPhone,
          pw: lease.initialPassword || '',
          pin: lease.kraPin || '',
          logo: '',
          status: 'approved',
          agr: 'signed',
          date: todayStr(),
          leaseId: lease.id
        };
        D.reqs.push(req);
      } else {
        req.spa = lease.spaName;
        req.owner = lease.ownerName;
        req.phone = cleanPhone;
        if (lease.kraPin) req.pin = lease.kraPin;
        req.status = 'approved';
        req.agr = 'signed';
        req.leaseId = lease.id;
      }
    }

    if (activateAsCurrentBiz) {
      D.biz = lease.spaName;
      if (cleanPhone) D.wa = cleanPhone;
      if (lease.kraPin) D.kra = lease.kraPin;
      D.plan.setup = +lease.setupFee || 0;
      D.plan.fee = +lease.monthlyFee || 0;
      D.plan.due = lease.nextDue || '';
      D.plan.status = lease.status === 'active' ? 'active' : 'suspended';
      D.plan.note = lease.notes || `Lease #${lease.code || lease.id} (${lease.leaseType || 'monthly'})`;
      if (lease.mods && typeof lease.mods === 'object') {
        D.mods = {
          inv: lease.mods.inv ? 1 : 0,
          tasks: lease.mods.tasks ? 1 : 0,
          close: lease.mods.close ? 1 : 0
        };
      }
    }

    saveD(D);
  }

  // Import already-approved accounts from D.reqs into dynamic leases list
  function syncApprovedRequestsToLeases() {
    const D = loadD();
    if (!D || !Array.isArray(D.reqs)) return loadLeases();
    const leases = loadLeases();
    let changed = false;

    D.reqs.forEach((r) => {
      if (r.status !== 'approved') return;
      const em = String(r.email || '').trim().toLowerCase();
      const exists = leases.some(
        (l) => l.id === r.leaseId || (em && String(l.ownerEmail || '').toLowerCase() === em) ||
          (r.spa && String(l.spaName || '').toLowerCase() === String(r.spa).toLowerCase())
      );
      if (!exists && r.spa) {
        const newLease = {
          id: uid(),
          code: 'LEASE-' + String(leases.length + 1).padStart(3, '0'),
          spaName: r.spa,
          ownerName: r.owner || 'Spa Manager',
          ownerEmail: em,
          ownerPhone: ph254(r.phone) || r.phone || '',
          kraPin: r.pin || '',
          leaseType: 'monthly',
          setupFee: (D.plan && +D.plan.setup) || 20000,
          monthlyFee: (D.plan && +D.plan.fee) || 10000,
          startDate: r.date || todayStr(),
          nextDue: (D.plan && D.plan.due) || '',
          status: 'active',
          initialPassword: r.pw || '',
          notes: 'Synced from approved account request',
          mods: {
            inv: D.mods && D.mods.inv ? 1 : 0,
            tasks: D.mods && D.mods.tasks ? 1 : 0,
            close: D.mods && D.mods.close ? 1 : 0
          },
          perms: getAllPerms()
        };
        r.leaseId = newLease.id;
        leases.push(newLease);
        syncLeaseToApp(D, newLease, false);
        changed = true;
      }
    });

    if (changed) {
      saveLeases(leases);
      saveD(D);
    }
    return leases;
  }

  // Allow OTP recovery to look up phone numbers stored on lease records too
  window.addEventListener('DOMContentLoaded', () => {
    const origFind = window.DKAuthOTP && window.DKAuthOTP.findAccount;
    if (window.DKAuthOTP && typeof origFind === 'function') {
      window.DKAuthOTP.findAccount = function (identifier) {
        const res = origFind(identifier);
        const D = loadD();
        const leases = loadLeases();
        const q = String(identifier || '').trim().toLowerCase();
        const qPhone = ph254(identifier);
        const matchedLease = leases.find((l) => {
          const emMatch = q && String(l.ownerEmail || '').toLowerCase() === q;
          const phMatch = qPhone && ph254(l.ownerPhone) === qPhone;
          return emMatch || phMatch;
        });
        if (matchedLease && D) {
          syncLeaseToApp(D, matchedLease, false);
          return origFind(matchedLease.ownerEmail || identifier);
        }
        return res;
      };
    }
  });

  // Render Platform Admin "Multi-Spa Lease & Direct Assignment" panel inside #main
  function renderPlatformLeaseManager() {
    if (!isPlatformAdmin()) return;
    const main = document.getElementById('main');
    if (!main || document.getElementById('dk-multi-lease-panel')) return;

    const D = loadD();
    if (!D) return;

    injectStyles();
    const leases = syncApprovedRequestsToLeases();
    const allPerms = getAllPerms();

    const panel = document.createElement('div');
    panel.className = 'dk-lease-pan';
    panel.id = 'dk-multi-lease-panel';

    const rowsHtml = leases.length
      ? leases.map((l) => {
          const isCurrent = String(D.biz || '').toLowerCase() === String(l.spaName || '').toLowerCase();
          return `
            <tr>
              <td><b>${esc(l.code || l.id)}</b></td>
              <td>${esc(l.spaName)} ${isCurrent ? '<span class="dk-lease-badge active">active context</span>' : ''}</td>
              <td>${esc(l.ownerName)}<br><small style="color:var(--mu)">${esc(l.ownerEmail || '—')} · ${esc(l.ownerPhone || '—')}</small></td>
              <td>${esc(l.leaseType || 'monthly')}<br><small style="color:var(--mu)">Setup ${money(l.setupFee)} / Mo ${money(l.monthlyFee)}</small></td>
              <td>${esc(l.nextDue || '—')}</td>
              <td><span class="dk-lease-badge ${esc(l.status || 'active')}">${esc(l.status || 'active')}</span></td>
              <td style="white-space:nowrap">
                <button type="button" class="btn s" data-lease-action="activate" data-id="${esc(l.id)}">Load Spa</button>
                <button type="button" class="btn g s" data-lease-action="toggle" data-id="${esc(l.id)}">${l.status === 'active' ? 'Suspend' : 'Activate'}</button>
                <button type="button" class="btn g s" data-lease-action="edit" data-id="${esc(l.id)}">Edit</button>
                <button type="button" class="btn d s" data-lease-action="delete" data-id="${esc(l.id)}">Remove</button>
              </td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="7" style="color:var(--mu);padding:12px">No leased or assigned spas yet. Use the form below to lease or assign this system directly to a spa.</td></tr>`;

    panel.innerHTML = `
      <div class="dk-lease-head">
        <h2>Multi-Spa Leasing &amp; Direct System Assignment</h2>
        <div>
          <button type="button" class="btn g s" id="dk-sync-approved-btn">Sync Approved Requests</button>
          <button type="button" class="btn s" id="dk-export-leases-btn">Export Lease JSON</button>
        </div>
      </div>
      <p class="dk-lease-note">
        Create, lease, or assign DK SPA POS directly to any spa while keeping the platform dynamic. Each assigned spa gets a manager account and can manage its own team &amp; rights.
      </p>

      <form id="dk-create-lease-form">
        <input type="hidden" id="dk-ls-edit-id" value="">
        <div class="dk-lease-form">
          <div>
            <label>Spa / Business Name *</label>
            <input id="dk-ls-spa" type="text" placeholder="e.g. Velvet Touch Spa Eldoret" required>
          </div>
          <div>
            <label>Spa Manager / Owner Name *</label>
            <input id="dk-ls-owner" type="text" placeholder="e.g. Faith Chebet" required>
          </div>
          <div>
            <label>Manager Email *</label>
            <input id="dk-ls-email" type="email" placeholder="manager@velvetspa.co.ke" required>
          </div>
          <div>
            <label>Manager Phone (07… / 254…)</label>
            <input id="dk-ls-phone" type="tel" inputmode="tel" placeholder="0712345678">
          </div>
          <div>
            <label>Lease Model</label>
            <select id="dk-ls-type">
              <option value="monthly">Monthly Lease</option>
              <option value="annual">Annual Lease</option>
              <option value="trial">Trial / Pilot</option>
              <option value="assigned">Direct Assigned / Partner</option>
            </select>
          </div>
          <div>
            <label>Setup Fee</label>
            <input id="dk-ls-setup" type="number" min="0" step="any" value="${(D.plan && +D.plan.setup) || 20000}">
          </div>
          <div>
            <label>Recurring / Monthly Fee</label>
            <input id="dk-ls-fee" type="number" min="0" step="any" value="${(D.plan && +D.plan.fee) || 10000}">
          </div>
          <div>
            <label>Next Due Date</label>
            <input id="dk-ls-due" type="date" value="${(D.plan && D.plan.due) || ''}">
          </div>
          <div>
            <label>Lease Status</label>
            <select id="dk-ls-status">
              <option value="active">active</option>
              <option value="pending">pending</option>
              <option value="suspended">suspended</option>
            </select>
          </div>
          <div>
            <label>Initial Manager Password (optional, 8+ chars)</label>
            <input id="dk-ls-pw" type="text" placeholder="Leave blank so manager sets on login">
          </div>
          <div>
            <label>KRA PIN (optional)</label>
            <input id="dk-ls-pin" type="text" placeholder="e.g. A123456789Z">
          </div>
          <div>
            <label>Lease / Assignment Notes</label>
            <input id="dk-ls-notes" type="text" placeholder="Branch, revenue share, or terms">
          </div>
        </div>

        <div class="dk-lease-mods">
          <label><input type="checkbox" id="dk-ls-mod-inv" checked> Inventory module</label>
          <label><input type="checkbox" id="dk-ls-mod-tasks" checked> Tasks module</label>
          <label><input type="checkbox" id="dk-ls-mod-close" checked> Daily close module</label>
          <label><input type="checkbox" id="dk-ls-activate-now" checked> Switch active platform context to this spa now</label>
        </div>

        <div class="dk-lease-form" style="margin-top:10px">
          <div style="grid-column:1/-1">
            <label>Permissions Assigned to This Spa Manager</label>
            <div class="dk-lease-mods" id="dk-ls-perms-wrap">
              ${allPerms.map((p) => `<label><input type="checkbox" class="dk-ls-perm-cb" value="${esc(p)}" checked> ${esc(getPermLabel(p))}</label>`).join('')}
            </div>
          </div>
        </div>

        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <button type="submit" class="btn" id="dk-ls-submit-btn">Assign / Lease Spa System</button>
          <button type="button" class="btn g" id="dk-ls-reset-btn">Clear Form</button>
        </div>
        <div id="dk-ls-feedback"></div>
      </form>

      <div class="wrap" style="margin-top:16px">
        <table>
          <thead>
            <tr>
              <th>Lease ID</th>
              <th>Spa</th>
              <th>Manager / Contact</th>
              <th>Terms</th>
              <th>Next Due</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;

    main.appendChild(panel);

    const feedback = document.getElementById('dk-ls-feedback');

    function resetForm() {
      document.getElementById('dk-ls-edit-id').value = '';
      document.getElementById('dk-ls-spa').value = '';
      document.getElementById('dk-ls-owner').value = '';
      document.getElementById('dk-ls-email').value = '';
      document.getElementById('dk-ls-phone').value = '';
      document.getElementById('dk-ls-type').value = 'monthly';
      document.getElementById('dk-ls-setup').value = (D.plan && +D.plan.setup) || 20000;
      document.getElementById('dk-ls-fee').value = (D.plan && +D.plan.fee) || 10000;
      document.getElementById('dk-ls-due').value = (D.plan && D.plan.due) || '';
      document.getElementById('dk-ls-status').value = 'active';
      document.getElementById('dk-ls-pw').value = '';
      document.getElementById('dk-ls-pin').value = '';
      document.getElementById('dk-ls-notes').value = '';
      document.getElementById('dk-ls-mod-inv').checked = true;
      document.getElementById('dk-ls-mod-tasks').checked = true;
      document.getElementById('dk-ls-mod-close').checked = true;
      document.getElementById('dk-ls-activate-now').checked = true;
      document.querySelectorAll('.dk-ls-perm-cb').forEach((cb) => { cb.checked = true; });
      document.getElementById('dk-ls-submit-btn').textContent = 'Assign / Lease Spa System';
    }

    document.getElementById('dk-ls-reset-btn').onclick = resetForm;

    document.getElementById('dk-sync-approved-btn').onclick = () => {
      syncApprovedRequestsToLeases();
      addLog('Synced approved spa requests into multi-spa lease registry');
      if (typeof window.render === 'function') window.render();
    };

    document.getElementById('dk-export-leases-btn').onclick = () => {
      const blob = new Blob([JSON.stringify(loadLeases(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dk-spa-pos-leases-' + todayStr() + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    document.getElementById('dk-create-lease-form').onsubmit = (e) => {
      e.preventDefault();
      const editId = document.getElementById('dk-ls-edit-id').value.trim();
      const spaName = document.getElementById('dk-ls-spa').value.trim();
      const ownerName = document.getElementById('dk-ls-owner').value.trim();
      const ownerEmail = document.getElementById('dk-ls-email').value.trim().toLowerCase();
      const rawPhone = document.getElementById('dk-ls-phone').value.trim();
      const ownerPhone = ph254(rawPhone) || rawPhone;
      const leaseType = document.getElementById('dk-ls-type').value;
      const setupFee = +document.getElementById('dk-ls-setup').value || 0;
      const monthlyFee = +document.getElementById('dk-ls-fee').value || 0;
      const nextDue = document.getElementById('dk-ls-due').value;
      const status = document.getElementById('dk-ls-status').value;
      const initialPassword = document.getElementById('dk-ls-pw').value.trim();
      const kraPin = document.getElementById('dk-ls-pin').value.trim().toUpperCase();
      const notes = document.getElementById('dk-ls-notes').value.trim();
      const activateNow = document.getElementById('dk-ls-activate-now').checked;
      const mods = {
        inv: document.getElementById('dk-ls-mod-inv').checked ? 1 : 0,
        tasks: document.getElementById('dk-ls-mod-tasks').checked ? 1 : 0,
        close: document.getElementById('dk-ls-mod-close').checked ? 1 : 0
      };
      const perms = [...document.querySelectorAll('.dk-ls-perm-cb')].filter((cb) => cb.checked).map((cb) => cb.value);

      if (!spaName || !ownerName || !ownerEmail || !ownerEmail.includes('@')) {
        feedback.className = 'dk-lease-err';
        feedback.textContent = 'Enter a valid Spa Name, Manager Name, and Manager Email.';
        return;
      }
      if (initialPassword && initialPassword.length < 8) {
        feedback.className = 'dk-lease-err';
        feedback.textContent = 'Initial password must be at least 8 characters (or leave blank so the manager sets it).';
        return;
      }

      const currentLeases = loadLeases();
      let targetLease;

      if (editId) {
        targetLease = currentLeases.find((x) => x.id === editId);
        if (targetLease) {
          Object.assign(targetLease, {
            spaName,
            ownerName,
            ownerEmail,
            ownerPhone,
            kraPin,
            leaseType,
            setupFee,
            monthlyFee,
            nextDue,
            status,
            notes,
            mods,
            perms
          });
          if (initialPassword) targetLease.initialPassword = initialPassword;
          addLog(`Updated lease for ${spaName} (${status})`);
        }
      }

      if (!targetLease) {
        targetLease = {
          id: uid(),
          code: 'LEASE-' + String(currentLeases.length + 1).padStart(3, '0'),
          spaName,
          ownerName,
          ownerEmail,
          ownerPhone,
          kraPin,
          leaseType,
          setupFee,
          monthlyFee,
          startDate: todayStr(),
          nextDue,
          status,
          initialPassword,
          notes,
          mods,
          perms
        };
        currentLeases.unshift(targetLease);
        addLog(`Assigned/leased system to ${spaName} (${ownerEmail})`);
      }

      saveLeases(currentLeases);
      syncLeaseToApp(D, targetLease, activateNow);
      feedback.className = 'dk-lease-ok';
      feedback.textContent = `Saved ${spaName} and provisioned manager account (${ownerEmail}).`;
      if (typeof window.render === 'function') window.render();
    };

    panel.querySelectorAll('button[data-lease-action]').forEach((btn) => {
      btn.onclick = () => {
        const action = btn.getAttribute('data-lease-action');
        const id = btn.getAttribute('data-id');
        const currentLeases = loadLeases();
        const item = currentLeases.find((x) => x.id === id);
        if (!item) return;

        if (action === 'activate') {
          syncLeaseToApp(D, item, true);
          addLog(`Switched active spa context to ${item.spaName}`);
          if (typeof window.render === 'function') window.render();
        } else if (action === 'toggle') {
          item.status = item.status === 'active' ? 'suspended' : 'active';
          saveLeases(currentLeases);
          syncLeaseToApp(D, item, String(D.biz || '').toLowerCase() === String(item.spaName || '').toLowerCase());
          addLog(`Lease ${item.spaName} set to ${item.status}`);
          if (typeof window.render === 'function') window.render();
        } else if (action === 'edit') {
          document.getElementById('dk-ls-edit-id').value = item.id;
          document.getElementById('dk-ls-spa').value = item.spaName || '';
          document.getElementById('dk-ls-owner').value = item.ownerName || '';
          document.getElementById('dk-ls-email').value = item.ownerEmail || '';
          document.getElementById('dk-ls-phone').value = item.ownerPhone || '';
          document.getElementById('dk-ls-type').value = item.leaseType || 'monthly';
          document.getElementById('dk-ls-setup').value = item.setupFee ?? 0;
          document.getElementById('dk-ls-fee').value = item.monthlyFee ?? 0;
          document.getElementById('dk-ls-due').value = item.nextDue || '';
          document.getElementById('dk-ls-status').value = item.status || 'active';
          document.getElementById('dk-ls-pin').value = item.kraPin || '';
          document.getElementById('dk-ls-notes').value = item.notes || '';
          document.getElementById('dk-ls-mod-inv').checked = !!(item.mods && item.mods.inv);
          document.getElementById('dk-ls-mod-tasks').checked = !!(item.mods && item.mods.tasks);
          document.getElementById('dk-ls-mod-close').checked = !!(item.mods && item.mods.close);
          const allowedPerms = Array.isArray(item.perms) ? item.perms : allPerms;
          document.querySelectorAll('.dk-ls-perm-cb').forEach((cb) => {
            cb.checked = allowedPerms.includes(cb.value);
          });
          document.getElementById('dk-ls-submit-btn').textContent = 'Update Spa Lease';
          document.getElementById('dk-ls-spa').focus();
        } else if (action === 'delete') {
          if (!confirm(`Remove lease record for ${item.spaName}?`)) return;
          const filtered = currentLeases.filter((x) => x.id !== id);
          saveLeases(filtered);
          addLog(`Removed lease record for ${item.spaName}`);
          if (typeof window.render === 'function') window.render();
        }
      };
    });
  }

  // Enhance Spa Manager's Team & rights view so managers can assign team logins, roles, and rights dynamically
  function renderManagerTeamHelper() {
    if (!isSpaManager() || isPlatformAdmin()) return;
    const main = document.getElementById('main');
    if (!main || document.getElementById('dk-mgr-team-helper')) return;

    const D = loadD();
    const cur = window.cur;
    if (!D || !cur) return;

    injectStyles();
    const allPerms = getAllPerms();
    const box = document.createElement('div');
    box.className = 'dk-lease-pan';
    box.id = 'dk-mgr-team-helper';

    box.innerHTML = `
      <div class="dk-lease-head">
        <h2>Assign Team Login &amp; Access (${esc(D.biz || 'My Spa')})</h2>
      </div>
      <p class="dk-lease-note">
        Create or update a login for your receptionists, barbers, stylists, or therapists and choose which modules they can access.
      </p>
      <form id="dk-mgr-assign-form">
        <div class="dk-lease-form">
          <div>
            <label>Team Member Name *</label>
            <input id="dk-tm-name" type="text" placeholder="e.g. Kevin Ochieng" required>
          </div>
          <div>
            <label>Team Member Email *</label>
            <input id="dk-tm-email" type="email" placeholder="kevin@spa.co.ke" required>
          </div>
          <div>
            <label>Phone (07… / 254…)</label>
            <input id="dk-tm-phone" type="tel" inputmode="tel" placeholder="0712345678">
          </div>
          <div>
            <label>Password (8+ chars) *</label>
            <input id="dk-tm-pw" type="password" autocomplete="new-password" placeholder="Min 8 characters" required>
          </div>
          <div>
            <label>Role</label>
            <select id="dk-tm-role">
              <option value="reception">Reception</option>
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </select>
          </div>
        </div>
        <div class="dk-lease-mods" id="dk-tm-perms">
          ${allPerms
            .filter((p) => p !== 'users')
            .map((p) => {
              const checked = ['dash', 'book', 'pos', 'cli', 'msg', 'tasks'].includes(p) ? 'checked' : '';
              return `<label><input type="checkbox" class="dk-tm-cb" value="${esc(p)}" ${checked}> ${esc(getPermLabel(p))}</label>`;
            })
            .join('')}
        </div>
        <div style="margin-top:12px">
          <button type="submit" class="btn">Assign Team Login</button>
        </div>
        <div id="dk-tm-msg"></div>
      </form>
    `;

    main.appendChild(box);

    document.getElementById('dk-mgr-assign-form').onsubmit = (e) => {
      e.preventDefault();
      const msgEl = document.getElementById('dk-tm-msg');
      const name = document.getElementById('dk-tm-name').value.trim();
      const email = document.getElementById('dk-tm-email').value.trim().toLowerCase();
      const rawPhone = document.getElementById('dk-tm-phone').value.trim();
      const phone = ph254(rawPhone) || rawPhone;
      const pw = document.getElementById('dk-tm-pw').value;
      const role = document.getElementById('dk-tm-role').value;
      const perms = [...document.querySelectorAll('.dk-tm-cb')].filter((cb) => cb.checked).map((cb) => cb.value);

      if (!name || !email.includes('@') || pw.length < 8) {
        msgEl.className = 'dk-lease-err';
        msgEl.textContent = 'Enter a name, valid email address, and password of at least 8 characters.';
        return;
      }

      D.users = Array.isArray(D.users) ? D.users : [];
      const existing = D.users.find((u) => String(u.email || '').toLowerCase() === email);
      if (existing) {
        if (existing.role === 'platform') {
          msgEl.className = 'dk-lease-err';
          msgEl.textContent = 'Cannot overwrite the platform admin account.';
          return;
        }
        Object.assign(existing, { name, email, phone, pw, role, perms, spaName: D.biz });
        addLog(`Manager ${cur.name} updated team login for ${email}`);
      } else {
        D.users.push({
          id: uid(),
          name,
          email,
          phone,
          pw,
          role,
          perms,
          spaName: D.biz
        });
        addLog(`Manager ${cur.name} assigned new ${role} login to ${email}`);
      }

      saveD(D);
      msgEl.className = 'dk-lease-ok';
      msgEl.textContent = `Team login saved for ${name} (${email}).`;
      if (typeof window.render === 'function') window.render();
    };
  }

  function enhanceViews() {
    if (!window.cur) return;
    if (isPlatformAdmin()) {
      renderPlatformLeaseManager();
    } else if (isSpaManager()) {
      renderManagerTeamHelper();
    }
  }

  window.DKMultiSpaLease = {
    getLeases: () => syncApprovedRequestsToLeases(),
    assignSpa: (leaseInput) => {
      const D = loadD();
      if (!D || !leaseInput) return null;
      const leases = loadLeases();
      const record = {
        id: uid(),
        code: 'LEASE-' + String(leases.length + 1).padStart(3, '0'),
        status: 'active',
        leaseType: 'monthly',
        setupFee: 20000,
        monthlyFee: 10000,
        startDate: todayStr(),
        perms: getAllPerms(),
        mods: { inv: 1, tasks: 1, close: 1 },
        ...leaseInput
      };
      leases.unshift(record);
      saveLeases(leases);
      syncLeaseToApp(D, record, true);
      return record;
    },
    openOtpRecovery: (email) => {
      if (window.DKAuthOTP && typeof window.DKAuthOTP.openForgotPassword === 'function') {
        window.DKAuthOTP.openForgotPassword(email || '');
      }
    }
  };

  const observer = new MutationObserver(() => {
    enhanceViews();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      enhanceViews();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    enhanceViews();
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
