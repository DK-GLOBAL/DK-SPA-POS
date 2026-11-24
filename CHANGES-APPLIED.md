# What was changed (DK SPA POS)

Files: index.html, api/s.js, vercel.json (new). Copy over the repo, commit, Vercel redeploys.

## Vercel environment variables to ADD
- RESEND_API_KEY  (resend.com)
- OWNER_EMAIL     (where new-signup alerts go)
- MAIL_FROM       (optional, e.g. "DK SPA POS <no-reply@yourdomain.com>"; needs a verified domain in Resend to email clients.
                   Without it, Resend's test sender only delivers to your own Resend account email.)
Existing ones stay: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, ADMIN_SETUP_CODE.

## Change 1 - stay logged in
- Session saved in localStorage (`dkspa_sess`) after login, restored on load before anything is drawn (spinner shown, no login flash).
- Same screen kept after refresh. Token lasts 72h; 30 min idle still signs out. Sign out clears everything.
- vercel.json rewrite so refreshing never 404s (api/ excluded).

## Change 2 - owner notifications
- Sign-up emails the owner (name, business, phone, email, time). Password is never included.
- Floating bell with red counter for the platform owner, checked every 8s, with toast + beep. Click opens the requests list (Approve/Reject already existed).
- Approve/Reject emails the client. Pending/rejected clients still cannot log in.

## Change 3 - done / not done
Done: 5 wrong logins/15 min per email+IP and 20/IP -> HTTP 429 + Retry-After + countdown; "N tries left"; same wrong-password message; sign-up limit 5/hour/IP; common-password block; security headers.
Not done (needs a bigger redesign, this app does not use Supabase Auth): Redis cache, TOTP MFA, argon2/bcrypt (passwords are still stored as plain text in the data - this is the biggest remaining risk), audit-log table, log-out-all-devices.
Supabase SQL in the spec (profiles/notifications tables) is NOT needed: this app stores requests in the existing `kv` table.

## Booking: System / Spa services (new)
- Booking section has a toggle. **System** = try the booking + create account / full demo. **Spa services** = live list of spas.
- A spa appears only when (1) DK Global Tech presses **Verify spa** (Clients > open a client) and (2) the spa owner turns the listing on (Settings > Public listing).
- Owner presses **I am ready to take clients now**; it switches off by itself after 8 hours. Ready spas are listed first; "Show only ready now" filter; refreshes every 30s.
- Each spa shows its **best new styles** (owner adds name, price, optional https photo link; max 8) plus a "New best styles" strip across spas.
- Clients tap **Book on WhatsApp** (pre-filled with the style). Booking is arranged directly with the spa.
- Public endpoint /api/s?a=spas returns only safe fields (no emails, passwords, sales). Rate limited.

## Devices
- Installable app (PWA): site.webmanifest, sw.js, icons. Photos in media/ + media/manifest.json.

## Commit
git add . && git commit -m "Session persistence, owner notifications, login rate limit, PWA, Spa services booking, photos" && git push

## Listing rules + booking delivery (final)
- A spa is public ONLY if: owner opted in (Settings > Public listing) AND DK Global Tech pressed Verify spa AND the spa is active.
- Clients press "Book here" on a listed spa -> request is stored for THAT spa only (/api/s?a=book) and lands in the spa's own Bookings within ~15s (source: online), with a toast + beep.
- Not listed or not verified -> not shown publicly, cannot be booked from the public page; everything stays inside the spa's own account.
- Safety: 10 requests/hour/IP, max 100 pending per spa, a spa can only read/clear its own requests.
