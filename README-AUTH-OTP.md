# DK SPA POS – Approved Account Login Setup & WhatsApp / SMS OTP Recovery

## File Included
- `dk-spa-pos-auth-otp.js` — Drop-in authentication module for **DK SPA POS** that adds:
  1. **Post-Approval Login Setup:** Allows approved spa owners/users to look up their approved account (by email or Kenyan phone number `07...` / `01...` / `254...`), confirm/set their login email and phone number, create a new password (8+ characters), and log in immediately.
  2. **Forgot Password via WhatsApp or SMS OTP:** Generates a 6-digit one-time code (valid for 10 minutes), sends it via **WhatsApp** (`https://wa.me/...`) or **SMS** (`sms:...`), verifies the code, and lets the user set a new password.

## How to Add to Your App
Include `<script src="dk-spa-pos-auth-otp.js"></script>` right before the closing `</body>` tag in your HTML file (after your main app script).

### Optional Server SMS / WhatsApp API Hook
If you have a backend endpoint (such as Africa's Talking, Twilio, or WhatsApp Cloud API), define `window.DK_OTP_SENDER` before `dk-spa-pos-auth-otp.js` loads:

```js
window.DK_OTP_SENDER = async ({ channel, phone, email, code, message }) => {
  const res = await fetch('/api/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, phone, email, code, message })
  });
  return await res.json(); // { ok: true, note: 'OTP delivered via SMS' }
};
```
