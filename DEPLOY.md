# DK SPA POS – cloud version: how to deploy

Files (put them in the ROOT of your GitHub repo, keep the `api` folder):
  index.html · api/s.js · sw.js · manifest.webmanifest · icon-192.png · icon-512.png
  icon-maskable-512.png · vercel.json · supabase.sql
(You can delete the old app.js. It is not used.)

1. Supabase > SQL Editor: run supabase.sql once (it creates the table `kv`; skip if you already ran it).
2. Vercel > dkspa-app > Settings > Environment Variables. These must exist:
     SUPABASE_URL                 (the Supabase integration already adds it)
     SUPABASE_SERVICE_ROLE_KEY    (the Supabase integration already adds it)
     ADMIN_SETUP_CODE             a long secret you choose (used once for first setup and for admin recovery)
     SESSION_SECRET               (optional) a long random string
     RESEND_API_KEY, OWNER_EMAIL  (optional) for an email when someone signs up
3. Push the files to GitHub. Vercel redeploys by itself.
4. FIRST SETUP, in the SAME browser where your existing data lives (dkspa-app.vercel.app):
   open the login page, type your admin email and the password you want, press Login.
   A box asks for ADMIN_SETUP_CODE. Your existing clients (e.g. JIMMY SPA) are copied to the cloud
   and every password is stored hashed. Then turn on two-step login when asked.
5. Test: open the site in a private window / on a phone, log in as JIMMY SPA's manager.
   Then create an account from a phone and watch the bell on the admin screen.

## Updating the system later (admin)
- To update, replace only the changed files in GitHub (usually index.html and api/s.js) and commit. Vercel redeploys.
- Spa data lives in Supabase, not in the files, so an update never erases sales, stock or stock takes.
- New features only ADD data fields (e.g. `stocktakes`). Spas that never used them simply start empty, so old
  and new versions keep working together. After an update, each device loads the new version the next time
  the app is opened online (close and reopen the app once).
- Update api/s.js AND index.html together when a release says so (this stock-take release changes both).
