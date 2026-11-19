DK SPA POS - M-Pesa (Daraja STK Push) files

1. Upload the "api" folder and package.json to the ROOT of your GitHub repo (next to index.html).
2. Run supabase.sql in Supabase -> SQL Editor.
3. Vercel -> Settings -> Environment Variables, add:
   MPESA_ENV (sandbox or production), MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET,
   MPESA_SHORTCODE, MPESA_PASSKEY,
   MPESA_CALLBACK_URL = https://YOUR-SITE.vercel.app/api/pay-callback
   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
4. Paste payWithMpesa.js.txt into the bottom of app.js.
5. Redeploy.

NEVER put the Consumer Secret, passkey or service_role key in GitHub or app.js.
