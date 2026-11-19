// DK SPA POS – Post-Approval Login Setup & WhatsApp / SMS OTP Password Recovery
// Compatible with DK SPA POS localStorage schema ('dkspa1' / 'dkspa_demo')

(function () {
  const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
  const OTP_STORE_KEY = 'dkspa_otp_sessions_v1';

  function getStoreKey() {
    if (typeof window.K === 'string' && window.K) return window.K;
    return location.hash === '#demo' ? 'dkspa_demo' : 'dkspa1';
  }

  function loadAppData() {
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

  function persistAppData(D) {
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

  function appendLog(D, action, actorName) {
    const userLabel = actorName || (window.cur && window.cur.name) || '—';
    if (typeof window.lg === 'function' && window.cur) {
      window.lg(action);
      return;
    }
    D.log = Array.isArray(D.log) ? D.log : [];
    const now = new Date();
    const dateStr = typeof window.td === 'function'
      ? window.td()
      : new Date(now - now.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    D.log.unshift({ t: now.toLocaleString(), d: dateStr, u: userLabel, a: action });
    D.log.length = Math.min(D.log.length, 3000);
    persistAppData(D);
  }

  function normalizeKenyanPhone(raw) {
    if (typeof window.ph254 === 'function') {
      const p = window.ph254(raw);
      if (p) return p;
    }
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '254' + digits.slice(1);
    else if (/^[17]\d{8}$/.test(digits)) digits = '254' + digits;
    return /^254[17]\d{8}$/.test(digits) ? digits : '';
  }

  function makeId() {
    if (typeof window.U === 'function') return window.U();
    return Math.random().toString(36).slice(2, 9);
  }

  function escHtml(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s ?? '').replace(/[&<>"]/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    }[c]));
  }

  function generateOtpCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  function readOtpSessions() {
    try {
      return JSON.parse(sessionStorage.getItem(OTP_STORE_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function writeOtpSessions(map) {
    try {
      sessionStorage.setItem(OTP_STORE_KEY, JSON.stringify(map));
    } catch (_) {}
  }

  function saveOtpSession(email, payload) {
    const map = readOtpSessions();
    map[email.toLowerCase()] = {
      ...payload,
      expiresAt: Date.now() + OTP_TTL_MS,
      verified: false
    };
    writeOtpSessions(map);
  }

  function getOtpSession(email) {
    const map = readOtpSessions();
    const s = map[email.toLowerCase()];
    if (!s) return null;
    if (Date.now() > s.expiresAt) {
      delete map[email.toLowerCase()];
      writeOtpSessions(map);
      return null;
    }
    return s;
  }

  function markOtpVerified(email) {
    const map = readOtpSessions();
    const k = email.toLowerCase();
    if (!map[k]) return false;
    map[k].verified = true;
    writeOtpSessions(map);
    return true;
  }

  function clearOtpSession(email) {
    const map = readOtpSessions();
    delete map[email.toLowerCase()];
    writeOtpSessions(map);
  }

  // Find an approved account / user record for login setup or password reset
  function findAccountRecord(D, identifier) {
    const q = String(identifier || '').trim().toLowerCase();
    const qPhone = normalizeKenyanPhone(identifier);
    D.users = Array.isArray(D.users) ? D.users : [];
    D.reqs = Array.isArray(D.reqs) ? D.reqs : [];

    // 1. Check existing users (by email or phone)
    let user = D.users.find((u) => {
      const emailMatch = q && String(u.email || '').toLowerCase() === q;
      const phoneMatch = qPhone && normalizeKenyanPhone(u.phone) === qPhone;
      return emailMatch || phoneMatch;
    });

    // 2. Check approved requests (in case user hasn't been added to D.users yet)
    const approvedReq = D.reqs.find((r) => {
      if (r.status !== 'approved') return false;
      const emailMatch = q && String(r.email || '').toLowerCase() === q;
      const phoneMatch = qPhone && normalizeKenyanPhone(r.phone) === qPhone;
      return emailMatch || phoneMatch;
    });

    if (!user && approvedReq) {
      const allPerms = Array.isArray(window.ALL)
        ? window.ALL.slice()
        : ['dash', 'book', 'pos', 'cli', 'msg', 'svc', 'exp', 'inv', 'tasks', 'close', 'rep', 'mpesa', 'camp', 'web', 'users', 'log'];
      user = {
        id: makeId(),
        name: approvedReq.owner || approvedReq.spa || 'Spa Manager',
        email: approvedReq.email.toLowerCase(),
        phone: normalizeKenyanPhone(approvedReq.phone) || approvedReq.phone || '',
        pw: '',
        needsLoginSetup: true,
        role: 'manager',
        perms: allPerms
      };
      D.users.push(user);
      if (approvedReq.spa) D.biz = approvedReq.spa;
      if (approvedReq.logo) D.logo = approvedReq.logo;
      if (approvedReq.pin) D.kra = approvedReq.pin;
      persistAppData(D);
    }

    if (user && approvedReq && !user.phone && approvedReq.phone) {
      user.phone = normalizeKenyanPhone(approvedReq.phone) || approvedReq.phone;
      persistAppData(D);
    }

    const hasPendingRequest = D.reqs.some(
      (r) => r.status === 'pending' && q && String(r.email || '').toLowerCase() === q
    );
    const hasRejectedRequest = D.reqs.some(
      (r) => r.status === 'rejected' && q && String(r.email || '').toLowerCase() === q
    );

    return {
      user: user || null,
      approvedReq: approvedReq || null,
      hasPendingRequest,
      hasRejectedRequest
    };
  }

  // Dispatch OTP via WhatsApp or SMS (supports optional custom gateway hook window.DK_OTP_SENDER)
  async function dispatchOtp({ channel, phone, email, userName, bizName, code }) {
    const cleanPhone = normalizeKenyanPhone(phone);
    const message =
      `DK SPA POS (${bizName || 'Account Recovery'}): Your one-time verification code (OTP) is ${code}. ` +
      `It expires in 10 minutes. Do not share this code with anyone.`;

    // Optional backend / SMS / WhatsApp API hook if configured by developer
    if (typeof window.DK_OTP_SENDER === 'function') {
      const apiResult = await window.DK_OTP_SENDER({
        channel,
        phone: cleanPhone,
        email,
        userName,
        bizName,
        code,
        message
      });
      if (apiResult && apiResult.ok) {
        return {
          ok: true,
          channel,
          phone: cleanPhone,
          deliveryNote: apiResult.note || `OTP sent via ${channel.toUpperCase()} to +${cleanPhone}.`
        };
      }
    }

    if (channel === 'whatsapp') {
      if (!cleanPhone) {
        return {
          ok: false,
          error: 'No valid Kenyan phone number (07... / 01... / 254...) is linked to this account for WhatsApp OTP.'
        };
      }
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      return {
        ok: true,
        channel: 'whatsapp',
        phone: cleanPhone,
        waUrl,
        deliveryNote: `WhatsApp opened for +${cleanPhone} with your OTP message ready to send.`
      };
    }

    if (channel === 'sms') {
      if (!cleanPhone) {
        return {
          ok: false,
          error: 'No valid Kenyan phone number (07... / 01... / 254...) is linked to this account for SMS OTP.'
        };
      }
      // Standard mobile SMS composer fallback when no server SMS gateway is attached
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const sep = isIOS ? '&' : '?';
      const smsUrl = `sms:+${cleanPhone}${sep}body=${encodeURIComponent(message)}`;
      try {
        window.location.href = smsUrl;
      } catch (_) {}
      return {
        ok: true,
        channel: 'sms',
        phone: cleanPhone,
        smsUrl,
        deliveryNote: `SMS composer triggered for +${cleanPhone}. If your browser blocked SMS links, use the code below or connect an SMS API.`
      };
    }

    return { ok: false, error: 'Select WhatsApp or SMS to receive your OTP.' };
  }

  function injectStyles() {
    if (document.getElementById('dk-auth-otp-styles')) return;
    const style = document.createElement('style');
    style.id = 'dk-auth-otp-styles';
    style.textContent = `
      .dk-auth-box {
        margin-top: 14px;
        padding: 14px;
        border: 1px solid #d6dde6;
        border-radius: 10px;
        background: #f8fafc;
        color: #111827;
        font-size: 13px;
      }
      .dk-auth-box h3 {
        margin: 0 0 6px;
        font-size: 16px;
        color: #0f172a;
      }
      .dk-auth-box p {
        margin: 0 0 10px;
        color: #475569;
        line-height: 1.45;
      }
      .dk-auth-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 10px;
      }
      .dk-auth-btn {
        border: 0;
        border-radius: 8px;
        padding: 9px 14px;
        font: 600 13px 'DM Sans', system-ui, sans-serif;
        cursor: pointer;
        background: #0e8a96;
        color: #fff;
      }
      .dk-auth-btn.sec {
        background: #e2e8f0;
        color: #0f172a;
      }
      .dk-auth-btn.acc {
        background: #e8731c;
        color: #1a1405;
      }
      .dk-auth-ok {
        margin-top: 8px;
        color: #15803d;
        font-weight: 600;
        font-size: 12.5px;
      }
      .dk-auth-err {
        margin-top: 8px;
        color: #b91c1c;
        font-weight: 600;
        font-size: 12.5px;
      }
      .dk-otp-pill {
        display: inline-block;
        margin-top: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        background: #fef3c7;
        color: #92400e;
        border: 1px solid #fcd34d;
        font-weight: 700;
        letter-spacing: 0.06em;
      }
    `;
    document.head.appendChild(style);
  }

  // Render "Set Approved Account Login" panel inside login card
  function renderApprovedLoginSetup(container, prefillEmail) {
    const D = loadAppData();
    if (!D) return;
    container.innerHTML = `
      <div class="dk-auth-box" id="dk-setup-panel">
        <h3>Set Your Login Credentials</h3>
        <p>Account approved? Enter your registered email or phone number to set your login email and new password (8+ characters).</p>
        <label style="margin-top:6px">Approved Email or Phone</label>
        <input id="dk-set-id" type="text" placeholder="e.g. owner@spa.co.ke or 0712345678" value="${escHtml(prefillEmail || '')}">
        <label>Login Email Address</label>
        <input id="dk-set-email" type="email" placeholder="confirm@spa.co.ke" value="${escHtml(prefillEmail || '')}">
        <label>Phone Number (for WhatsApp / SMS OTP)</label>
        <input id="dk-set-phone" type="tel" inputmode="tel" placeholder="0712345678">
        <label>Create New Password (8+ chars)</label>
        <input id="dk-set-pw" type="password" autocomplete="new-password" placeholder="Enter new password">
        <label>Confirm New Password</label>
        <input id="dk-set-pw2" type="password" autocomplete="new-password" placeholder="Re-enter new password">
        <div class="dk-auth-row">
          <button type="button" class="dk-auth-btn acc" id="dk-save-setup">Save &amp; Log In</button>
          <button type="button" class="dk-auth-btn sec" id="dk-close-box">Close</button>
        </div>
        <div id="dk-setup-msg"></div>
      </div>
    `;

    const idInput = document.getElementById('dk-set-id');
    const emailInput = document.getElementById('dk-set-email');
    const phoneInput = document.getElementById('dk-set-phone');
    const msgEl = document.getElementById('dk-setup-msg');

    function hydrateFromLookup() {
      const info = findAccountRecord(D, idInput.value);
      if (info.user) {
        if (!emailInput.value && info.user.email) emailInput.value = info.user.email;
        if (!phoneInput.value && info.user.phone) phoneInput.value = info.user.phone;
      }
    }
    hydrateFromLookup();
    idInput.addEventListener('blur', hydrateFromLookup);

    document.getElementById('dk-close-box').onclick = () => {
      container.innerHTML = '';
    };

    document.getElementById('dk-save-setup').onclick = () => {
      const lookupVal = idInput.value.trim();
      const newEmail = emailInput.value.trim().toLowerCase();
      const cleanPhone = normalizeKenyanPhone(phoneInput.value.trim());
      const pw1 = document.getElementById('dk-set-pw').value;
      const pw2 = document.getElementById('dk-set-pw2').value;

      if (!lookupVal || !newEmail || !newEmail.includes('@')) {
        msgEl.className = 'dk-auth-err';
        msgEl.textContent = 'Enter your approved account identifier and a valid login email address.';
        return;
      }
      if (!cleanPhone) {
        msgEl.className = 'dk-auth-err';
        msgEl.textContent = 'Enter a valid Kenyan phone number (e.g. 0712345678) for OTP recovery.';
        return;
      }
      if (pw1.length < 8) {
        msgEl.className = 'dk-auth-err';
        msgEl.textContent = 'Password must be at least 8 characters long.';
        return;
      }
      if (pw1 !== pw2) {
        msgEl.className = 'dk-auth-err';
        msgEl.textContent = 'Passwords do not match.';
        return;
      }

      const info = findAccountRecord(D, lookupVal);
      if (info.hasPendingRequest && !info.user) {
        msgEl.className = 'dk-auth-err';
        msgEl.textContent = 'This account request is still pending approval by DK Global Tech.';
        return;
      }
      if (info.hasRejectedRequest && !info.user) {
        msgEl.className = 'dk-auth-err';
        msgEl.textContent = 'This account request was rejected. Contact DK Global Tech.';
        return;
      }
      if (!info.user) {
        msgEl.className = 'dk-auth-err';
        msgEl.textContent = 'No approved account found for that email or phone. Create an account or check with DK Global Tech.';
        return;
      }

      const emailTaken = D.users.some(
        (u) => u.id !== info.user.id && String(u.email || '').toLowerCase() === newEmail
      );
      if (emailTaken) {
        msgEl.className = 'dk-auth-err';
        msgEl.textContent = 'That email address is already used by another user.';
        return;
      }

      info.user.email = newEmail;
      info.user.phone = cleanPhone;
      info.user.pw = pw1;
      info.user.needsLoginSetup = false;
      persistAppData(D);
      appendLog(D, `Login credentials set for ${info.user.email}`, info.user.name);

      msgEl.className = 'dk-auth-ok';
      msgEl.textContent = 'Login credentials saved! Signing you in...';

      const mainEmail = document.getElementById('le');
      const mainPw = document.getElementById('lp');
      const mainForm = document.getElementById('lf');
      if (mainEmail && mainPw && mainForm) {
        mainEmail.value = newEmail;
        mainPw.value = pw1;
        setTimeout(() => {
          if (typeof mainForm.requestSubmit === 'function') mainForm.requestSubmit();
          else mainForm.dispatchEvent(new Event('submit', { cancelable: true }));
        }, 250);
      }
    };
  }

  // Render "Forgot Password via WhatsApp or SMS OTP" panel
  function renderForgotPasswordOtp(container, prefillEmail) {
    const D = loadAppData();
    if (!D) return;
    container.innerHTML = `
      <div class="dk-auth-box" id="dk-otp-panel">
        <h3>Reset Password via WhatsApp or SMS OTP</h3>
        <p>Enter your account email or phone number, choose <b>WhatsApp</b> or <b>SMS</b>, verify the 6-digit OTP, and set a new password.</p>
        <label style="margin-top:6px">Account Email or Phone</label>
        <input id="dk-otp-id" type="text" placeholder="e.g. kelvinsekeyian@gmail.com or 07..." value="${escHtml(prefillEmail || '')}">
        <label>OTP Delivery Channel</label>
        <select id="dk-otp-channel">
          <option value="whatsapp">WhatsApp OTP</option>
          <option value="sms">SMS OTP</option>
        </select>
        <div class="dk-auth-row">
          <button type="button" class="dk-auth-btn" id="dk-send-otp">Send OTP</button>
          <button type="button" class="dk-auth-btn sec" id="dk-close-otp">Close</button>
        </div>
        <div id="dk-otp-status"></div>

        <div id="dk-otp-verify-step" style="display:none;margin-top:10px">
          <label>Enter 6-Digit OTP</label>
          <input id="dk-otp-code" type="text" inputmode="numeric" maxlength="6" placeholder="123456">
          <div class="dk-auth-row">
            <button type="button" class="dk-auth-btn" id="dk-verify-otp">Verify OTP</button>
          </div>
        </div>

        <div id="dk-otp-reset-step" style="display:none;margin-top:10px">
          <label>New Password (8+ chars)</label>
          <input id="dk-new-pw" type="password" autocomplete="new-password" placeholder="Enter new password">
          <label>Confirm New Password</label>
          <input id="dk-new-pw2" type="password" autocomplete="new-password" placeholder="Confirm new password">
          <div class="dk-auth-row">
            <button type="button" class="dk-auth-btn acc" id="dk-apply-reset">Update Password &amp; Log In</button>
          </div>
        </div>
      </div>
    `;

    const idInput = document.getElementById('dk-otp-id');
    const chanSelect = document.getElementById('dk-otp-channel');
    const statusEl = document.getElementById('dk-otp-status');
    const verifyStep = document.getElementById('dk-otp-verify-step');
    const resetStep = document.getElementById('dk-otp-reset-step');

    document.getElementById('dk-close-otp').onclick = () => {
      container.innerHTML = '';
    };

    document.getElementById('dk-send-otp').onclick = async () => {
      const rawId = idInput.value.trim();
      const channel = chanSelect.value;
      if (!rawId) {
        statusEl.className = 'dk-auth-err';
        statusEl.textContent = 'Enter your registered email or phone number first.';
        return;
      }

      const info = findAccountRecord(D, rawId);
      if (info.hasPendingRequest && !info.user) {
        statusEl.className = 'dk-auth-err';
        statusEl.textContent = 'This account is still pending approval by DK Global Tech.';
        return;
      }
      if (!info.user) {
        statusEl.className = 'dk-auth-err';
        statusEl.textContent = 'Account not found. Check your email or phone number.';
        return;
      }

      const code = generateOtpCode();
      const targetEmail = (info.user.email || rawId).toLowerCase();
      const targetPhone = normalizeKenyanPhone(info.user.phone || rawId);

      saveOtpSession(targetEmail, {
        code,
        channel,
        phone: targetPhone,
        userId: info.user.id
      });

      const res = await dispatchOtp({
        channel,
        phone: targetPhone,
        email: targetEmail,
        userName: info.user.name,
        bizName: D.biz,
        code
      });

      if (!res.ok) {
        statusEl.className = 'dk-auth-err';
        statusEl.textContent = res.error;
        return;
      }

      appendLog(D, `Password reset OTP sent via ${channel.toUpperCase()} to ${targetEmail}`, info.user.name);
      verifyStep.style.display = 'block';

      // Show generated OTP badge for offline/local-storage browser testing when no server SMS/WA webhook is attached
      const localPreview = typeof window.DK_OTP_SENDER !== 'function'
        ? `<br><span class="dk-otp-pill">Local/Client OTP Code: ${code}</span>`
        : '';

      statusEl.className = 'dk-auth-ok';
      statusEl.innerHTML = `${escHtml(res.deliveryNote)} (Expires in 10 minutes)${localPreview}`;
    };

    document.getElementById('dk-verify-otp').onclick = () => {
      const rawId = idInput.value.trim();
      const enteredCode = document.getElementById('dk-otp-code').value.trim();
      const info = findAccountRecord(D, rawId);
      const targetEmail = ((info.user && info.user.email) || rawId).toLowerCase();
      const session = getOtpSession(targetEmail);

      if (!session) {
        statusEl.className = 'dk-auth-err';
        statusEl.textContent = 'OTP expired or not sent yet. Click "Send OTP" again.';
        return;
      }
      if (enteredCode !== session.code) {
        statusEl.className = 'dk-auth-err';
        statusEl.textContent = 'Invalid OTP code. Please check and try again.';
        return;
      }

      markOtpVerified(targetEmail);
      resetStep.style.display = 'block';
      statusEl.className = 'dk-auth-ok';
      statusEl.textContent = 'OTP verified! Enter your new password below.';
    };

    document.getElementById('dk-apply-reset').onclick = () => {
      const rawId = idInput.value.trim();
      const pw1 = document.getElementById('dk-new-pw').value;
      const pw2 = document.getElementById('dk-new-pw2').value;
      const info = findAccountRecord(D, rawId);
      const targetEmail = ((info.user && info.user.email) || rawId).toLowerCase();
      const session = getOtpSession(targetEmail);

      if (!session || !session.verified) {
        statusEl.className = 'dk-auth-err';
        statusEl.textContent = 'Please verify your OTP before resetting the password.';
        return;
      }
      if (pw1.length < 8) {
        statusEl.className = 'dk-auth-err';
        statusEl.textContent = 'New password must be at least 8 characters.';
        return;
      }
      if (pw1 !== pw2) {
        statusEl.className = 'dk-auth-err';
        statusEl.textContent = 'Passwords do not match.';
        return;
      }
      if (!info.user) {
        statusEl.className = 'dk-auth-err';
        statusEl.textContent = 'User record could not be found.';
        return;
      }

      info.user.pw = pw1;
      info.user.needsLoginSetup = false;
      persistAppData(D);
      clearOtpSession(targetEmail);
      appendLog(D, `Password reset via ${session.channel.toUpperCase()} OTP`, info.user.name);

      statusEl.className = 'dk-auth-ok';
      statusEl.textContent = 'Password updated! Signing you in...';

      const mainEmail = document.getElementById('le');
      const mainPw = document.getElementById('lp');
      const mainForm = document.getElementById('lf');
      if (mainEmail && mainPw && mainForm) {
        mainEmail.value = info.user.email;
        mainPw.value = pw1;
        setTimeout(() => {
          if (typeof mainForm.requestSubmit === 'function') mainForm.requestSubmit();
          else mainForm.dispatchEvent(new Event('submit', { cancelable: true }));
        }, 250);
      }
    };
  }

  function enhanceLoginScreen() {
    const loginForm = document.getElementById('lf');
    if (!loginForm) return;

    injectStyles();

    let host = document.getElementById('dk-auth-ext-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'dk-auth-ext-host';
      loginForm.appendChild(host);
    }

    // Add quick button to set login credentials after account approval
    if (!document.getElementById('dk-open-setup-btn')) {
      const setupLink = document.createElement('a');
      setupLink.id = 'dk-open-setup-btn';
      setupLink.textContent = 'Account approved? Set your login & password';
      setupLink.style.cssText = 'display:block;text-align:center;margin-top:10px;font-weight:600;cursor:pointer;color:#0e8a96';
      setupLink.onclick = () => {
        const em = (document.getElementById('le') && document.getElementById('le').value.trim()) || '';
        renderApprovedLoginSetup(host, em);
      };
      loginForm.appendChild(setupLink);
    }

    // Wire "Forgot password?" to WhatsApp / SMS OTP recovery flow
    const fpLink = document.getElementById('fp');
    if (fpLink) {
      fpLink.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const em = (document.getElementById('le') && document.getElementById('le').value.trim()) || '';
        renderForgotPasswordOtp(host, em);
      };
    }
  }

  // Expose public helpers on window for direct calling or custom integration
  window.DKAuthOTP = {
    openLoginSetup: (email) => {
      enhanceLoginScreen();
      const host = document.getElementById('dk-auth-ext-host');
      if (host) renderApprovedLoginSetup(host, email || '');
    },
    openForgotPassword: (email) => {
      enhanceLoginScreen();
      const host = document.getElementById('dk-auth-ext-host');
      if (host) renderForgotPasswordOtp(host, email || '');
    },
    findAccount: (identifier) => {
      const D = loadAppData();
      return D ? findAccountRecord(D, identifier) : null;
    }
  };

  // Observe DOM changes when switching between landing, signup, login, and dashboard screens
  const observer = new MutationObserver(() => {
    if (document.getElementById('lf')) {
      enhanceLoginScreen();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      enhanceLoginScreen();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    enhanceLoginScreen();
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
