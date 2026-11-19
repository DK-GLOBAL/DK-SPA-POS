// DK SPA POS – Dynamic Variable Client & User OTP Password Change / Reset Module
// Automatically detects whatever client/user/spa/phone/email variables exist in your app
// and lets clients or users request an OTP to change or reset their password.

(function () {
  const OTP_TTL_MS = 10 * 60 * 1000;
  const OTP_SESSION_KEY = 'dkspa_var_otp_sessions_v1';

  // Variable configuration map (can be overridden dynamically via window.DK_OTP_CONFIG)
  const DEFAULT_CONFIG = {
    storageKeys: ['dkspa1', 'dkspa_demo'],
    accountArrays: ['clients', 'users', 'members', 'customers', 'staff', 'reqs'],
    emailFields: ['email', 'mail', 'userEmail', 'contactEmail'],
    phoneFields: ['phone', 'tel', 'mobile', 'wa', 'whatsapp', 'contact'],
    nameFields: ['name', 'fullName', 'clientName', 'owner', 'spa', 'username'],
    passwordFields: ['pw', 'password', 'pass', 'pinCode'],
    defaultPhone: '254780490437',
    defaultEmail: 'dkglobaltech@gmail.com',
    defaultChannel: 'whatsapp', // 'whatsapp' or 'sms'
    otpLength: 6
  };

  function getConfig() {
    const custom = (window.DK_OTP_CONFIG && typeof window.DK_OTP_CONFIG === 'object')
      ? window.DK_OTP_CONFIG
      : {};
    return {
      ...DEFAULT_CONFIG,
      ...custom,
      storageKeys: Array.isArray(custom.storageKeys) && custom.storageKeys.length
        ? custom.storageKeys
        : DEFAULT_CONFIG.storageKeys,
      accountArrays: Array.isArray(custom.accountArrays) && custom.accountArrays.length
        ? custom.accountArrays
        : DEFAULT_CONFIG.accountArrays
    };
  }

  function getDataStore() {
    if (window.D && typeof window.D === 'object') return window.D;
    const cfg = getConfig();
    const activeKey = (typeof window.K === 'string' && window.K)
      || (location.hash === '#demo' ? 'dkspa_demo' : cfg.storageKeys[0]);
    try {
      const raw = localStorage.getItem(activeKey);
      if (raw) {
        window.D = JSON.parse(raw);
        return window.D;
      }
    } catch (_) {}
    for (const k of cfg.storageKeys) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) return JSON.parse(raw);
      } catch (_) {}
    }
    return null;
  }

  function persistStore(D) {
    if (!D) return;
    window.D = D;
    if (typeof window.save === 'function') {
      try { window.save(); } catch (_) {}
    }
    const cfg = getConfig();
    const activeKey = (typeof window.K === 'string' && window.K)
      || (location.hash === '#demo' ? 'dkspa_demo' : cfg.storageKeys[0]);
    try {
      localStorage.setItem(activeKey, JSON.stringify(D));
    } catch (_) {}
  }

  function normalizePhone(raw) {
    if (typeof window.ph254 === 'function') {
      const p = window.ph254(raw);
      if (p) return p;
    }
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '254' + digits.slice(1);
    else if (/^[17]\d{8}$/.test(digits)) digits = '254' + digits;
    return /^254[17]\d{8}$/.test(digits) ? digits : '';
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

  function pickField(obj, candidates) {
    if (!obj || typeof obj !== 'object') return '';
    for (const key of candidates) {
      if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') {
        return String(obj[key]).trim();
      }
    }
    return '';
  }

  // Dynamically discover all client/user/account records across any variable array in D or window
  function collectVariableAccounts() {
    const cfg = getConfig();
    const D = getDataStore();
    const results = [];

    const sources = [];
    if (D && typeof D === 'object') {
      for (const arrName of cfg.accountArrays) {
        if (Array.isArray(D[arrName])) {
          sources.push({ sourceName: `D.${arrName}`, list: D[arrName] });
        }
      }
      // Also inspect any other array property on D containing objects with email/phone/name
      for (const key of Object.keys(D)) {
        if (!cfg.accountArrays.includes(key) && Array.isArray(D[key]) && D[key].length && typeof D[key][0] === 'object') {
          sources.push({ sourceName: `D.${key}`, list: D[key] });
        }
      }
    }

    // Also inspect optional global arrays if someone passes them via window
    for (const arrName of cfg.accountArrays) {
      if (Array.isArray(window[arrName])) {
        sources.push({ sourceName: `window.${arrName}`, list: window[arrName] });
      }
    }

    for (const src of sources) {
      src.list.forEach((item, idx) => {
        if (!item || typeof item !== 'object') return;
        const email = pickField(item, cfg.emailFields).toLowerCase();
        const phoneRaw = pickField(item, cfg.phoneFields);
        const phone = normalizePhone(phoneRaw) || phoneRaw;
        const name = pickField(item, cfg.nameFields) || `Account #${idx + 1}`;
        const pwKey = cfg.passwordFields.find((k) => k in item) || 'pw';
        results.push({
          record: item,
          sourceName: src.sourceName,
          index: idx,
          name,
          email,
          phone,
          pwKey
        });
      });
    }

    return results;
  }

  function findMatchingAccount(identifier) {
    const query = String(identifier || '').trim().toLowerCase();
    const queryPhone = normalizePhone(identifier);
    const accounts = collectVariableAccounts();

    if (!query && !queryPhone) return null;

    return accounts.find((acc) => {
      const emailMatch = query && acc.email && acc.email.toLowerCase() === query;
      const phoneMatch = queryPhone && acc.phone && normalizePhone(acc.phone) === queryPhone;
      const nameMatch = query && acc.name && acc.name.toLowerCase() === query;
      return emailMatch || phoneMatch || nameMatch;
    }) || null;
  }

  function makeOtp(len) {
    const digits = len || getConfig().otpLength || 6;
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    return String(Math.floor(min + Math.random() * (max - min + 1)));
  }

  function readSessions() {
    try {
      return JSON.parse(sessionStorage.getItem(OTP_SESSION_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function writeSessions(m) {
    try {
      sessionStorage.setItem(OTP_SESSION_KEY, JSON.stringify(m));
    } catch (_) {}
  }

  function saveSession(key, data) {
    const m = readSessions();
    m[String(key || '').toLowerCase()] = {
      ...data,
      expiresAt: Date.now() + OTP_TTL_MS,
      verified: false
    };
    writeSessions(m);
  }

  function getSession(key) {
    const m = readSessions();
    const k = String(key || '').toLowerCase();
    const s = m[k];
    if (!s) return null;
    if (Date.now() > s.expiresAt) {
      delete m[k];
      writeSessions(m);
      return null;
    }
    return s;
  }

  function verifySession(key, code) {
    const s = getSession(key);
    if (!s) return { ok: false, error: 'OTP expired or not requested yet.' };
    if (String(code || '').trim() !== String(s.code)) {
      return { ok: false, error: 'Incorrect OTP code.' };
    }
    const m = readSessions();
    m[String(key || '').toLowerCase()].verified = true;
    writeSessions(m);
    return { ok: true, session: m[String(key || '').toLowerCase()] };
  }

  function clearSession(key) {
    const m = readSessions();
    delete m[String(key || '').toLowerCase()];
    writeSessions(m);
  }

  async function sendOtpRequest({ channel, phone, email, name, code }) {
    const cfg = getConfig();
    const D = getDataStore();
    const biz = (D && D.biz) || 'DK SPA POS';
    const cleanPhone = normalizePhone(phone) || cfg.defaultPhone;
    const text =
      `${biz}: Your OTP code to change/reset your password is ${code}. ` +
      `Valid for 10 minutes. Do not share this code.`;

    // Custom backend / SMS / WhatsApp API hook if provided by caller
    if (typeof window.DK_OTP_SENDER === 'function') {
      const customRes = await window.DK_OTP_SENDER({
        channel,
        phone: cleanPhone,
        email,
        name,
        code,
        message: text
      });
      if (customRes && customRes.ok) {
        return {
          ok: true,
          channel,
          phone: cleanPhone,
          note: customRes.note || `OTP sent via ${channel.toUpperCase()} to +${cleanPhone}.`
        };
      }
    }

    if (channel === 'sms') {
      const sep = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
      try {
        window.location.href = `sms:+${cleanPhone}${sep}body=${encodeURIComponent(text)}`;
      } catch (_) {}
      return {
        ok: true,
        channel: 'sms',
        phone: cleanPhone,
        note: `SMS OTP triggered for +${cleanPhone}.`
      };
    }

    // Default: WhatsApp OTP
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    return {
      ok: true,
      channel: 'whatsapp',
      phone: cleanPhone,
      note: `WhatsApp OTP opened for +${cleanPhone}.`
    };
  }

  function applyNewPassword(identifier, newPassword) {
    if (!newPassword || String(newPassword).length < 6) {
      return { ok: false, error: 'Enter a new password of at least 6 characters.' };
    }
    const D = getDataStore();
    const match = findMatchingAccount(identifier);

    if (match && match.record) {
      const pwKey = match.pwKey || 'pw';
      match.record[pwKey] = newPassword;
      match.record.pw = newPassword;
      match.record.needsLoginSetup = false;
      if (D) persistStore(D);
      return { ok: true, account: match };
    }

    // If no existing record is found yet, create a variable client/user entry in D.clients so the user isn't blocked
    if (D) {
      D.clients = Array.isArray(D.clients) ? D.clients : [];
      const cleanId = String(identifier || '').trim();
      const phone = normalizePhone(cleanId);
      const isEmail = cleanId.includes('@');
      const created = {
        id: (typeof window.U === 'function' ? window.U() : 'cl_' + Math.random().toString(36).slice(2, 8)),
        name: cleanId || 'Client',
        email: isEmail ? cleanId.toLowerCase() : '',
        phone: phone || cleanId,
        pw: newPassword,
        password: newPassword
      };
      D.clients.push(created);
      persistStore(D);
      return {
        ok: true,
        account: {
          record: created,
          sourceName: 'D.clients',
          name: created.name,
          email: created.email,
          phone: created.phone,
          pwKey: 'pw'
        }
      };
    }

    return { ok: false, error: 'Could not locate an account record to update.' };
  }

  function ensureStyles() {
    if (document.getElementById('dk-var-otp-styles')) return;
    const style = document.createElement('style');
    style.id = 'dk-var-otp-styles';
    style.textContent = `
      .dk-votp-card {
        margin-top: 12px;
        padding: 14px;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        background: #ffffff;
        color: #0f172a;
        font-size: 13px;
        text-align: left;
      }
      .dk-votp-card h4 {
        margin: 0 0 6px;
        font-size: 15px;
        color: #0f172a;
      }
      .dk-votp-card p {
        margin: 0 0 10px;
        color: #475569;
        line-height: 1.4;
      }
      .dk-votp-card label {
        display: block;
        margin: 8px 0 3px;
        font-size: 12.5px;
        font-weight: 600;
        color: #1e293b;
      }
      .dk-votp-card input,
      .dk-votp-card select {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #f8fafc;
        color: #0f172a;
        font: inherit;
      }
      .dk-votp-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 10px;
      }
      .dk-votp-btn {
        border: 0;
        border-radius: 8px;
        padding: 8px 14px;
        font: 600 12.5px 'DM Sans', system-ui, sans-serif;
        cursor: pointer;
        background: #0e8a96;
        color: #fff;
      }
      .dk-votp-btn.primary {
        background: #e8731c;
        color: #1a1405;
      }
      .dk-votp-btn.ghost {
        background: #e2e8f0;
        color: #0f172a;
      }
      .dk-votp-msg-ok {
        margin-top: 8px;
        color: #15803d;
        font-weight: 600;
      }
      .dk-votp-msg-err {
        margin-top: 8px;
        color: #b91c1c;
        font-weight: 600;
      }
      .dk-votp-badge {
        display: inline-block;
        margin-top: 6px;
        padding: 3px 10px;
        border-radius: 999px;
        background: #fef3c7;
        color: #92400e;
        border: 1px solid #fcd34d;
        font-weight: 700;
        letter-spacing: 0.05em;
      }
    `;
    document.head.appendChild(style);
  }

  // Render the OTP request & password change box into any target container or default login/form area
  function mountOtpWidget(targetEl, initialIdentifier) {
    ensureStyles();
    const cfg = getConfig();

    let host = targetEl;
    if (!host) {
      const form = document.getElementById('lf') || document.querySelector('form');
      if (!form) return null;
      host = document.getElementById('dk-var-otp-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'dk-var-otp-host';
        form.appendChild(host);
      }
    }

    const prefillId = initialIdentifier
      || (document.getElementById('le') && document.getElementById('le').value.trim())
      || '';
    const existingMatch = prefillId ? findMatchingAccount(prefillId) : null;
    const prefillPhone = (existingMatch && existingMatch.phone)
      || normalizePhone(prefillId)
      || cfg.defaultPhone;

    host.innerHTML = `
      <div class="dk-votp-card" id="dk-votp-box">
        <h4>Change / Reset Password via OTP</h4>
        <p>Enter your email or phone number and request an OTP to change or recover your password.</p>

        <label>Client / Account Email or Phone</label>
        <input id="dk-votp-id" type="text" placeholder="e.g. client@email.com or 0712345678" value="${esc(prefillId)}">

        <label>Phone Number for OTP (07… / 254…)</label>
        <input id="dk-votp-phone" type="tel" inputmode="tel" placeholder="0712345678" value="${esc(prefillPhone)}">

        <label>Request OTP Via</label>
        <select id="dk-votp-channel">
          <option value="whatsapp" ${cfg.defaultChannel === 'whatsapp' ? 'selected' : ''}>WhatsApp OTP</option>
          <option value="sms" ${cfg.defaultChannel === 'sms' ? 'selected' : ''}>SMS OTP</option>
        </select>

        <div class="dk-votp-actions">
          <button type="button" class="dk-votp-btn" id="dk-votp-request-btn">Request OTP</button>
          <button type="button" class="dk-votp-btn ghost" id="dk-votp-close-btn">Close</button>
        </div>
        <div id="dk-votp-status"></div>

        <div id="dk-votp-step-verify" style="display:none;margin-top:8px">
          <label>Enter OTP Code</label>
          <input id="dk-votp-code" type="text" inputmode="numeric" maxlength="8" placeholder="Enter OTP">
          <div class="dk-votp-actions">
            <button type="button" class="dk-votp-btn" id="dk-votp-verify-btn">Verify OTP</button>
          </div>
        </div>

        <div id="dk-votp-step-change" style="display:none;margin-top:8px">
          <label>New Password</label>
          <input id="dk-votp-pw1" type="password" autocomplete="new-password" placeholder="Enter new password">
          <label>Confirm New Password</label>
          <input id="dk-votp-pw2" type="password" autocomplete="new-password" placeholder="Confirm new password">
          <div class="dk-votp-actions">
            <button type="button" class="dk-votp-btn primary" id="dk-votp-save-btn">Change Password</button>
          </div>
        </div>
      </div>
    `;

    const idEl = document.getElementById('dk-votp-id');
    const phoneEl = document.getElementById('dk-votp-phone');
    const chEl = document.getElementById('dk-votp-channel');
    const statusEl = document.getElementById('dk-votp-status');
    const verifyDiv = document.getElementById('dk-votp-step-verify');
    const changeDiv = document.getElementById('dk-votp-step-change');

    idEl.addEventListener('blur', () => {
      const m = findMatchingAccount(idEl.value.trim());
      if (m && m.phone) {
        phoneEl.value = m.phone;
      } else {
        const p = normalizePhone(idEl.value.trim());
        if (p) phoneEl.value = p;
      }
    });

    document.getElementById('dk-votp-close-btn').onclick = () => {
      host.innerHTML = '';
    };

    document.getElementById('dk-votp-request-btn').onclick = async () => {
      const identifier = idEl.value.trim();
      const phone = normalizePhone(phoneEl.value.trim()) || normalizePhone(identifier);
      const channel = chEl.value;

      if (!identifier && !phone) {
        statusEl.className = 'dk-votp-msg-err';
        statusEl.textContent = 'Enter your email or phone number to request an OTP.';
        return;
      }
      if (!phone) {
        statusEl.className = 'dk-votp-msg-err';
        statusEl.textContent = 'Enter a valid phone number (e.g. 0712345678 or 254712345678).';
        return;
      }

      const match = findMatchingAccount(identifier || phone);
      const sessionKey = (match && (match.email || match.phone)) || identifier || phone;
      const code = makeOtp(cfg.otpLength);

      saveSession(sessionKey, {
        code,
        channel,
        phone,
        identifier: identifier || phone
      });

      const sendRes = await sendOtpRequest({
        channel,
        phone,
        email: (match && match.email) || (identifier.includes('@') ? identifier : ''),
        name: (match && match.name) || identifier || 'Client',
        code
      });

      if (!sendRes.ok) {
        statusEl.className = 'dk-votp-msg-err';
        statusEl.textContent = sendRes.error || 'Could not send OTP.';
        return;
      }

      verifyDiv.style.display = 'block';
      const previewBadge = typeof window.DK_OTP_SENDER !== 'function'
        ? `<br><span class="dk-votp-badge">OTP: ${code}</span>`
        : '';
      statusEl.className = 'dk-votp-msg-ok';
      statusEl.innerHTML = `${esc(sendRes.note)} (Valid for 10 mins)${previewBadge}`;
    };

    document.getElementById('dk-votp-verify-btn').onclick = () => {
      const identifier = idEl.value.trim();
      const phone = normalizePhone(phoneEl.value.trim()) || normalizePhone(identifier);
      const match = findMatchingAccount(identifier || phone);
      const sessionKey = (match && (match.email || match.phone)) || identifier || phone;
      const codeInput = document.getElementById('dk-votp-code').value.trim();

      const res = verifySession(sessionKey, codeInput);
      if (!res.ok) {
        statusEl.className = 'dk-votp-msg-err';
        statusEl.textContent = res.error;
        return;
      }

      changeDiv.style.display = 'block';
      statusEl.className = 'dk-votp-msg-ok';
      statusEl.textContent = 'OTP verified! Enter your new password below.';
    };

    document.getElementById('dk-votp-save-btn').onclick = () => {
      const identifier = idEl.value.trim();
      const phone = normalizePhone(phoneEl.value.trim()) || normalizePhone(identifier);
      const match = findMatchingAccount(identifier || phone);
      const sessionKey = (match && (match.email || match.phone)) || identifier || phone;
      const pw1 = document.getElementById('dk-votp-pw1').value;
      const pw2 = document.getElementById('dk-votp-pw2').value;

      const sess = getSession(sessionKey);
      if (!sess || !sess.verified) {
        statusEl.className = 'dk-votp-msg-err';
        statusEl.textContent = 'Please verify your OTP first.';
        return;
      }
      if (pw1 !== pw2) {
        statusEl.className = 'dk-votp-msg-err';
        statusEl.textContent = 'Passwords do not match.';
        return;
      }

      const targetId = (match && (match.email || match.phone || match.name)) || identifier || phone;
      const updated = applyNewPassword(targetId, pw1);
      if (!updated.ok) {
        statusEl.className = 'dk-votp-msg-err';
        statusEl.textContent = updated.error;
        return;
      }

      clearSession(sessionKey);
      statusEl.className = 'dk-votp-msg-ok';
      statusEl.textContent = 'Password changed successfully!';

      const le = document.getElementById('le');
      const lp = document.getElementById('lp');
      const lf = document.getElementById('lf');
      if (le && lp) {
        if (updated.account.email) le.value = updated.account.email;
        lp.value = pw1;
      }
      if (lf && updated.account.email) {
        setTimeout(() => {
          if (typeof lf.requestSubmit === 'function') lf.requestSubmit();
          else lf.dispatchEvent(new Event('submit', { cancelable: true }));
        }, 250);
      }
    };

    return host;
  }

  function wirePageTriggers() {
    ensureStyles();
    const form = document.getElementById('lf') || document.querySelector('form');
    if (form && !document.getElementById('dk-var-otp-open-btn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'dk-var-otp-open-btn';
      btn.className = 'dk-votp-btn';
      btn.style.cssText = 'width:100%;margin-top:10px';
      btn.textContent = 'Forgot or Change Password? Request OTP';
      btn.onclick = () => {
        const em = (document.getElementById('le') && document.getElementById('le').value.trim()) || '';
        mountOtpWidget(null, em);
      };
      form.appendChild(btn);
    }

    const fp = document.getElementById('fp');
    if (fp && !fp.dataset.dkVarOtpBound) {
      fp.dataset.dkVarOtpBound = '1';
      fp.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const em = (document.getElementById('le') && document.getElementById('le').value.trim()) || '';
        mountOtpWidget(null, em);
      });
    }
  }

  // Public dynamic API so any variable, array, or UI element can invoke OTP password change
  window.DKVariableOTP = {
    configure: (opts) => {
      window.DK_OTP_CONFIG = { ...(window.DK_OTP_CONFIG || {}), ...(opts || {}) };
    },
    mount: (targetSelectorOrEl, identifier) => {
      const el = typeof targetSelectorOrEl === 'string'
        ? document.querySelector(targetSelectorOrEl)
        : targetSelectorOrEl;
      return mountOtpWidget(el || null, identifier || '');
    },
    getAccounts: collectVariableAccounts,
    findAccount: findMatchingAccount,
    requestOtp: async (identifier, channel) => {
      const cfg = getConfig();
      const match = findMatchingAccount(identifier);
      const phone = normalizePhone((match && match.phone) || identifier) || cfg.defaultPhone;
      const ch = channel || cfg.defaultChannel || 'whatsapp';
      const code = makeOtp(cfg.otpLength);
      const key = (match && (match.email || match.phone)) || identifier || phone;
      saveSession(key, { code, channel: ch, phone, identifier });
      return sendOtpRequest({
        channel: ch,
        phone,
        email: (match && match.email) || '',
        name: (match && match.name) || identifier || 'Client',
        code
      });
    },
    verifyOtp: verifySession,
    changePassword: (identifier, code, newPassword) => {
      const match = findMatchingAccount(identifier);
      const key = (match && (match.email || match.phone)) || identifier;
      const v = verifySession(key, code);
      if (!v.ok) return v;
      const done = applyNewPassword(identifier, newPassword);
      if (done.ok) clearSession(key);
      return done;
    }
  };

  const observer = new MutationObserver(() => {
    wirePageTriggers();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      wirePageTriggers();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    wirePageTriggers();
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
