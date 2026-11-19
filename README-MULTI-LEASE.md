# DK SPA POS – Dynamic Multi-Spa Leasing & Team Assignment Module

## File Included
- `dk-spa-pos-multi-lease.js` — Extends **DK SPA POS** so:
  1. **Platform Admin (`dkglobaltech@gmail.com`)** can create, lease, edit, suspend/activate, switch active spa context, sync approved account requests, and export lease records dynamically without hardcoding individual spas.
  2. **Assigned / Approved Spas** automatically receive a manager account (`role: 'manager'`), billing/module settings, and optional initial password (or set their own credentials on login via `dk-spa-pos-auth-otp.js`).
  3. **Spa Managers** can create and assign team logins (`reception`, `staff`, `manager`) and toggle module permissions for their own staff.

## How to Wire Into Your App
Include both scripts right before `</body>` in your HTML file:

```html
<script src="dk-spa-pos-auth-otp.js"></script>
<script src="dk-spa-pos-multi-lease.js"></script>
```
