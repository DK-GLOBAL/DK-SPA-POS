create table mpesa_payments (
  id uuid primary key default gen_random_uuid(),
  checkout_request_id text unique,
  phone text, amount numeric, account_ref text,
  status text default 'pending',
  mpesa_receipt text, result_desc text,
  created_at timestamptz default now()
);
alter table mpesa_payments enable row level security;
create policy "logged-in users can read" on mpesa_payments
  for select to authenticated using (true);
