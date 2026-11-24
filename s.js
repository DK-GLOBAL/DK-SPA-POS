// DK SPA POS cloud API (Vercel serverless, Node 18+). No npm packages needed.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SETUP_CODE, SESSION_SECRET (optional),
//      RESEND_API_KEY + OWNER_EMAIL (optional email alerts)
const crypto = require('crypto');
const SB = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const HD = () => ({ apikey: KEY(), Authorization: 'Bearer ' + KEY(), 'Content-Type': 'application/json' });
const enc = encodeURIComponent, now = () => Date.now(), lc = s => String(s || '').trim().toLowerCase();
const uid = () => crypto.randomBytes(5).toString('hex');

/* ---------- storage (Supabase REST, table public.kv) ---------- */
async function kget(k) { const r = await fetch(`${SB()}/rest/v1/kv?k=eq.${enc(k)}&select=v`, { headers: HD() }); if (!r.ok) throw new Error('kv get ' + r.status); const j = await r.json(); return j[0] ? j[0].v : null; }
async function kput(k, v) { const r = await fetch(`${SB()}/rest/v1/kv?on_conflict=k`, { method: 'POST', headers: { ...HD(), Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ k, v, updated_at: new Date().toISOString() }) }); if (!r.ok) throw new Error('kv put ' + r.status); }
async function kdel(k) { await fetch(`${SB()}/rest/v1/kv?k=eq.${enc(k)}`, { method: 'DELETE', headers: HD() }); }
async function kcas(k, ver, v) { // compare-and-set on v.ver; ver==null => insert only
  if (ver == null) { const r = await fetch(`${SB()}/rest/v1/kv`, { method: 'POST', headers: { ...HD(), Prefer: 'return=minimal' }, body: JSON.stringify({ k, v, updated_at: new Date().toISOString() }) }); return r.ok; }
  const r = await fetch(`${SB()}/rest/v1/kv?k=eq.${enc(k)}&v->>ver=eq.${ver}`, { method: 'PATCH', headers: { ...HD(), Prefer: 'return=representation' }, body: JSON.stringify({ v, updated_at: new Date().toISOString() }) });
  if (!r.ok) throw new Error('kv cas ' + r.status); return (await r.json()).length > 0; }
const bk = tid => tid ? 't:' + tid : 'master';
const getB = async tid => kget(bk(tid));
async function updB(tid, fn) { for (let i = 0; i < 5; i++) { const row = await getB(tid); if (!row) return null; const d = fn(JSON.parse(JSON.stringify(row.d))); if (await kcas(bk(tid), row.ver, { ver: row.ver + 1, d })) return d; } throw new Error('busy'); }

/* ---------- crypto ---------- */
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 32, { N: 16384, r: 8, p: 1 }, (e, k) => e ? rej(e) : res(k)));
async function hashPw(pw) { const s = crypto.randomBytes(16); return 's1$' + s.toString('base64') + '$' + (await scrypt(pw, s)).toString('base64'); }
async function checkPw(pw, h) { if (!h || !h.startsWith('s1$')) return false; const [, s, k] = h.split('$'), d = await scrypt(pw, Buffer.from(s, 'base64')), kb = Buffer.from(k, 'base64'); return kb.length === d.length && crypto.timingSafeEqual(kb, d); }
const SECRET = () => process.env.SESSION_SECRET || crypto.createHash('sha256').update('dkspa|' + KEY()).digest('hex');
const sign = p => { const b = Buffer.from(JSON.stringify(p)).toString('base64url'); return b + '.' + crypto.createHmac('sha256', SECRET()).update(b).digest('base64url'); };
function unsign(t) { if (typeof t !== 'string') return null; const [b, s] = t.split('.'); if (!b || !s) return null; const e = crypto.createHmac('sha256', SECRET()).update(b).digest('base64url'); if (e.length !== s.length || !crypto.timingSafeEqual(Buffer.from(e), Buffer.from(s))) return null; try { const p = JSON.parse(Buffer.from(b, 'base64url').toString()); return p.exp > now() ? p : null; } catch (e) { return null; } }
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32enc = buf => { let bits = '', o = ''; for (const b of buf) bits += b.toString(2).padStart(8, '0'); for (let i = 0; i < bits.length; i += 5) o += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return o; };
const b32dec = s => { let bits = ''; for (const c of s) bits += B32.indexOf(c).toString(2).padStart(5, '0'); const o = []; for (let i = 0; i + 8 <= bits.length; i += 8) o.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(o); };
function totp(sec, t) { const c = Math.floor(t / 30000), b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(c)); const h = crypto.createHmac('sha1', b32dec(sec)).update(b).digest(), o = h[19] & 15; return String(((h[o] & 127) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1e6).padStart(6, '0'); }
const totpOk = (sec, code) => [-1, 0, 1].some(d => totp(sec, now() + d * 30000) === String(code || '').replace(/\s/g, ''));
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const pwBad = p => (typeof p !== 'string' || p.length < 8 || !/[a-zA-Z]/.test(p) || !/\d/.test(p)) ? 'Use 8 or more characters with letters and numbers.' : (['password1', '12345678a', 'qwerty123', 'password123', 'admin1234'].includes(p.toLowerCase()) ? 'That password is too common.' : '');

/* ---------- rate limiting (kv counters) ---------- */
async function rlCheck(key, max, win) { const o = (await kget('rl:' + key)) || { h: [] }; o.h = o.h.filter(t => now() - t < win); return { key, o, max, blocked: o.h.length >= max, retry: o.h.length >= max ? Math.max(1, Math.ceil((o.h[0] + win - now()) / 1000)) : 0, left: Math.max(0, max - o.h.length) }; }
const rlHit = async s => { s.o.h.push(now()); s.left = Math.max(0, s.left - 1); await kput('rl:' + s.key, s.o); };
const rlClear = s => kdel('rl:' + s.key);

/* ---------- misc ---------- */
async function mail(to, subject, html) { const k = process.env.RESEND_API_KEY; if (!k || !to) return; try { await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + k }, body: JSON.stringify({ from: process.env.MAIL_FROM || 'DK SPA POS <onboarding@resend.dev>', to: [to], subject, html }) }); } catch (e) { } }
const E = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function audit(tid, e, a) { try { const k = 'aud:' + (tid || 'master'), o = (await kget(k)) || { l: [] }; o.l.unshift({ t: new Date().toISOString(), e, a }); o.l.length = Math.min(o.l.length, 100); await kput(k, o); } catch (x) { } }
const strip = d => { (d.users || []).forEach(u => { delete u.pw; }); (d.reqs || []).forEach(r => { delete r.pw; }); return d; };
const WA = ['sales', 'bookings', 'clients', 'expenses', 'products', 'tasks', 'closes', 'log', 'seq', 'otps'];
const UNION = ['sales', 'bookings', 'clients', 'expenses', 'tasks', 'pays', 'leads', 'reqs', 'tenants', 'notifs', 'otps'];
const MGR_BLOCK = ['plan', 'tenants', 'reqs', 'pays', 'leads', 'snaps', 'notifs'];
const union = (s, c) => { const m = new Map(); (s || []).forEach(x => m.set(x.id, x)); const out = (c || []).map(x => ({ ...(m.get(x.id) || {}), ...x })); const seen = new Set(out.map(x => x.id)); (s || []).forEach(x => { if (!seen.has(x.id)) out.push(x); }); return out; };
function applyRules(role, S, C, conflict) {
  const M = { ...S }, pf = role === 'platform', mg = role === 'manager';
  for (const k of Object.keys(C)) {
    if (k === 'users') { if (mg) M.users = (C.users || []).filter(u => u.role !== 'platform'); continue; }
    if (!pf && !mg && !WA.includes(k)) continue; if (mg && MGR_BLOCK.includes(k)) continue; M[k] = C[k];
  }
  if (conflict) {
    for (const k of UNION) if (k in M && (pf || mg ? !(mg && MGR_BLOCK.includes(k)) : WA.includes(k))) M[k] = union(S[k], C[k]);
    if (WA.includes('log') || pf) { const seen = new Set((C.log || []).map(x => x.t + '|' + x.u + '|' + x.a)); M.log = [...(C.log || []), ...(S.log || []).filter(x => !seen.has(x.t + '|' + x.u + '|' + x.a))].slice(0, 3000); }
    M.closes = { ...(S.closes || {}), ...(C.closes || {}) };
  }
  M.seq = Math.max(+S.seq || 0, +C.seq || 0); return strip(M);
}
async function viewOf(ctx, d) { const o = JSON.parse(JSON.stringify(d)); strip(o); if (ctx.tid) { const m = await getB(''); const r = m && (m.d.tenants || []).find(x => x.id === ctx.tid); if (r) o.plan = Object.assign(o.plan || {}, { status: r.status, fee: r.fee, setup: r.setup, due: r.due }); } return o; }

/* ---------- tenants ---------- */
function newTenantData(q, userId) {
  const mk = a => ({ id: uid(), name: a[0], price: a[1], dur: a[2], cat: a[3] }), ms = a => ({ id: uid(), name: a[0], role: a[1], model: a[2], base: a[3], comm: a[4] });
  return { biz: q.spa, accent: '#e8731c', cur: 'KES', lang: 'en', seq: 0, log: [], plan: { fee: 0, setup: 0, due: '', status: 'active', note: '' }, mods: { inv: 1, tasks: 1, close: 1 },
    mp: { env: 'sandbox', ck: '', cs: '', sc: '', till: '', pk: '', tt: 'CustomerPayBillOnline', cb: '', ar: 'DKSPAPOS', td: 'Payment', init: '', cred: '', res: '', to: '', conf: '', val: '' },
    services: [['Haircut', 800, 30, 'Barber'], ['Beard trim', 400, 20, 'Barber'], ['Styling & blow-dry', 2000, 60, 'Salon'], ['Braiding', 2500, 120, 'Salon'], ['Facial', 2500, 45, 'Spa'], ['Swedish massage', 3000, 60, 'Spa']].map(mk),
    staff: [['Brian', 'Barber', 'commission', 0, 40], ['Amina', 'Stylist', 'hybrid', 5000, 30], ['Grace', 'Therapist', 'commission', 0, 50]].map(ms),
    clients: [], bookings: [], sales: [], expenses: [], products: [], tasks: [], closes: {}, otps: [], reqs: [], imgs: [], wa: '', kra: q.pin || '', logo: q.logo || '',
    bd: { addr: q.loc || '', town: '', phone: q.phone || '', email: q.email, web: '', hrs: '', pay: '', vat: '0', terms: 'Services once rendered are non-refundable. Please keep this document as proof of payment.', foot: '' },
    users: [{ id: userId, name: q.owner, email: q.email, role: 'manager', perms: ['dash', 'book', 'pos', 'cli', 'msg', 'svc', 'exp', 'inv', 'tasks', 'close', 'rep', 'mpesa', 'camp', 'web', 'adj', 'users', 'log'] }] };
}
async function createTenant(q, h, mc) {
  const tid = uid() + uid(), u = uid();
  if (!(await kcas('t:' + tid, null, { ver: 1, d: newTenantData(q, u) }))) throw new Error('create failed');
  await kput('acct:' + q.email, { email: q.email, uid: u, tid, h, tv: 0, mc: mc ? 1 : 0, mfa: null });
  await updB('', d => { d.tenants = d.tenants || []; d.tenants.push({ id: tid, spa: q.spa, owner: q.owner, email: q.email, phone: q.phone || '', status: 'active', fee: +q.fee || 0, setup: +q.setup || 0, due: q.due || '', created: new Date().toISOString().slice(0, 10) }); return d; });
  return tid;
}
const emailFree = async e => !(await kget('acct:' + e)) && !(await kget('reqx:' + e));

/* ---------- auth context ---------- */
async function authed(req) {
  const t = (req.headers.authorization || '').replace(/^Bearer /, ''), p = unsign(t); if (!p || p.k) return null;
  const ac = await kget('acct:' + p.e); if (!ac || ac.tv !== p.tv) return null;
  const row = await getB(ac.tid); if (!row) return null; const u = (row.d.users || []).find(x => x.id === ac.uid); if (!u || u.st === 'suspended' || u.st === 'locked') return null;
  let suspended = false; if (ac.tid) { const m = await getB(''); const r = m && (m.d.tenants || []).find(x => x.id === ac.tid); suspended = !!(r && r.status !== 'active'); }
  return { e: p.e, ac, tid: ac.tid, uid: ac.uid, role: u.role, row, suspended };
}
const issue = ac => sign({ e: ac.email, tv: ac.tv, exp: now() + 7 * 864e5 });
const done = async (ctx, extra) => { const d = await viewOf(ctx, ctx.row.d); return { data: d, v: ctx.row.ver, uid: ctx.uid, role: ctx.role, tid: ctx.tid, mc: !!ctx.ac.mc, mfa: !!(ctx.ac.mfa && ctx.ac.mfa.on), sec: ((await kget('aud:' + (ctx.tid || 'master'))) || { l: [] }).l.slice(0, 50), ...extra }; };

/* ---------- actions ---------- */
const A = {};
A.ping = async () => { const m = await getB(''); return { ok: true, setup: !m, mail: !!process.env.RESEND_API_KEY }; };

A.setup = async (b, req, ip) => {
  const code = process.env.ADMIN_SETUP_CODE; if (!code) return [500, { err: 'ADMIN_SETUP_CODE is not set in Vercel environment variables.' }];
  const rl = await rlCheck('setup:' + ip, 5, 15 * 60e3); if (rl.blocked) return [429, { err: 'Too many attempts. Try again later.', retryAfterSeconds: rl.retry }];
  if (String(b.code || '') !== code) { await rlHit(rl); return [401, { err: 'Setup code is not correct.' }]; }
  if (await getB('')) return [409, { err: 'The platform is already set up.' }];
  const em = lc(b.email), bad = pwBad(b.pw); if (!em.includes('@')) return [400, { err: 'Enter a valid email.' }]; if (bad) return [400, { err: bad }];
  const d = b.data && typeof b.data === 'object' ? b.data : {}; d.users = (d.users || []).filter(u => u.role === 'platform');
  let pu = d.users[0]; if (!pu) { pu = { id: uid(), name: 'DK Global Tech (Platform admin)', role: 'platform', perms: [] }; d.users = [pu]; } pu.email = em;
  d.tenants = d.tenants || []; d.reqs = d.reqs || [];
  const T = b.tenants || {};
  for (const id of Object.keys(T)) { const td = T[id]; if (!td || !Array.isArray(td.users)) continue; for (const u of td.users) { if (u.pw && u.email && !(await kget('acct:' + lc(u.email)))) await kput('acct:' + lc(u.email), { email: lc(u.email), uid: u.id, tid: id, h: await hashPw(u.pw), tv: 0, mc: u.mc ? 1 : 0, mfa: null }); } strip(td); await kput('t:' + id, { ver: 1, d: td }); }
  for (const r of d.reqs) if (r.pw) { await kput('req:' + r.id, { h: await hashPw(r.pw) }); await kput('reqx:' + lc(r.email), { id: r.id }); }
  strip(d); await kput('acct:' + em, { email: em, uid: pu.id, tid: '', h: await hashPw(b.pw), tv: 0, mc: 0, mfa: null });
  await kput('master', { ver: 1, d }); return { ok: true };
};

A.login = async (b, req, ip) => {
  const em = lc(b.email), pw = String(b.pw || ''), a = await rlCheck('a:' + em + '|' + ip, 5, 15 * 60e3), p = await rlCheck('ip:' + ip, 20, 15 * 60e3);
  if (a.blocked || p.blocked) { const r = Math.max(a.retry, p.retry); return [429, { err: 'Too many login attempts. Please try again later.', retryAfterSeconds: r }, { 'Retry-After': r }]; }
  const ac = await kget('acct:' + em), ok = ac ? await checkPw(pw, ac.h) : (await checkPw(pw, 's1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='), false);
  if (!ok) {
    await rlHit(a); await rlHit(p);
    const rx = await kget('reqx:' + em); if (rx) { const r = await kget('req:' + rx.id), m = await getB(''), q = m && (m.d.reqs || []).find(x => x.id === rx.id); if (r && q && await checkPw(pw, r.h)) return [403, { err: q.status === 'rejected' ? 'This request was declined. Contact DK Global Tech.' : 'Your account is awaiting approval by DK Global Tech.' }]; }
    await audit(ac && ac.tid, em, 'Failed login'); return [401, { err: 'Wrong email or password.', attemptsLeft: Math.max(0, a.left - 1) }];
  }
  const row = await getB(ac.tid); const u = row && (row.d.users || []).find(x => x.id === ac.uid);
  if (!u) return [401, { err: 'Wrong email or password.' }];
  if (u.st === 'suspended') return [403, { err: 'Your account is suspended. Please contact your manager.' }];
  if (u.st === 'locked') return [403, { err: 'Your account is locked. Ask your manager to unlock you.' }];
  await rlClear(a);
  if (ac.mfa && ac.mfa.on) return { mfa: true, ticket: sign({ e: em, k: 'mfa', exp: now() + 5 * 60e3 }) };
  await audit(ac.tid, em, 'Login'); return { token: issue(ac) };
};
A.mfa = async (b, req, ip) => {
  const t = unsign(b.ticket); if (!t || t.k !== 'mfa') return [401, { err: 'Please log in again.' }];
  const r = await rlCheck('m:' + t.e + '|' + ip, 5, 15 * 60e3); if (r.blocked) return [429, { err: 'Too many wrong codes. Try again later.', retryAfterSeconds: r.retry }, { 'Retry-After': r.retry }];
  const ac = await kget('acct:' + t.e); if (!ac || !ac.mfa) return [401, { err: 'Please log in again.' }];
  const code = String(b.code || '').replace(/\s/g, ''); let ok = totpOk(ac.mfa.secret, code);
  if (!ok && ac.mfa.rec) { const h = sha(code.toLowerCase()), i = ac.mfa.rec.indexOf(h); if (i >= 0) { ac.mfa.rec.splice(i, 1); await kput('acct:' + t.e, ac); ok = true; } }
  if (!ok) { await rlHit(r); await audit(ac.tid, t.e, 'Wrong MFA code'); return [401, { err: 'Wrong code.', attemptsLeft: Math.max(0, r.left - 1) }]; }
  await rlClear(r); await audit(ac.tid, t.e, 'Login (MFA)'); return { token: issue(ac) };
};

A.signup = async (b, req, ip) => {
  const rl = await rlCheck('su:' + ip, 5, 3600e3); if (rl.blocked) return [429, { err: 'Too many sign-ups from this network. Try again later.', retryAfterSeconds: rl.retry }];
  await rlHit(rl); const em = lc(b.email), bad = pwBad(b.pw);
  if (!b.spa || !b.owner || !em.includes('@') || String(b.phone || '').length < 9) return [400, { err: 'Fill every required field.' }]; if (bad) return [400, { err: bad }];
  if (String(b.logo || '').length > 200000) return [400, { err: 'Logo is too large.' }];
  if (!(await emailFree(em))) return [409, { err: 'That email is already registered.' }];
  if (!(await getB(''))) return [503, { err: 'The platform has not been set up yet.' }];
  const id = uid(), q = { id, spa: String(b.spa).slice(0, 80), owner: String(b.owner).slice(0, 80), email: em, phone: String(b.phone).slice(0, 20), loc: String(b.loc || '').slice(0, 120), pin: String(b.pin || '').slice(0, 12), logo: b.logo || '', status: 'pending', agr: '', date: new Date().toISOString().slice(0, 10) };
  await kput('req:' + id, { h: await hashPw(b.pw) }); await kput('reqx:' + em, { id });
  await updB('', d => { d.reqs = d.reqs || []; d.reqs.push(q); d.notifs = d.notifs || []; d.notifs.unshift({ id: uid(), type: 'new_signup', title: 'New client account request', message: `${q.owner} (${q.spa}) has created an account.`, data: { owner: q.owner, spa: q.spa, phone: q.phone, email: q.email }, read: false, t: new Date().toISOString() }); d.notifs.length = Math.min(d.notifs.length, 100); return d; });
  await mail(process.env.OWNER_EMAIL, 'New client account request – DK SPA POS', `<h3>New account request</h3><p><b>Name:</b> ${E(q.owner)}</p><p><b>Business:</b> ${E(q.spa)}</p><p><b>Phone:</b> ${E(q.phone)}</p><p><b>Email:</b> ${E(q.email)}</p><p><b>Time:</b> ${new Date().toISOString()}</p><p>Log in to approve or reject.</p>`);
  return { ok: true };
};

A.otpReq = async (b, req, ip) => {
  const rl = await rlCheck('otp:' + ip, 5, 3600e3); if (rl.blocked) return [429, { err: 'Too many requests. Try again later.', retryAfterSeconds: rl.retry }]; await rlHit(rl);
  const em = lc(b.email), ac = await kget('acct:' + em);
  if (ac && ac.tid) { const row = await getB(ac.tid), u = row && (row.d.users || []).find(x => x.id === ac.uid); if (u && u.role !== 'manager' && u.role !== 'platform' && u.st !== 'suspended') { const otp = String(100000 + crypto.randomInt(900000)); await updB(ac.tid, d => { d.otps = (d.otps || []).filter(x => x.uid !== u.id || x.status !== 'open'); d.otps.push({ id: uid(), uid: u.id, name: u.name, email: u.email, otp, exp: now() + 6e5, tries: 0, status: 'open' }); return d; }); } }
  return { ok: true };
};
A.otpUse = async (b, req, ip) => {
  const em = lc(b.email), rl = await rlCheck('otpu:' + em + '|' + ip, 5, 15 * 60e3); if (rl.blocked) return [429, { err: 'Too many attempts. Try again later.', retryAfterSeconds: rl.retry }];
  const bad = pwBad(b.pw); if (bad) return [400, { err: bad }]; const ac = await kget('acct:' + em); let good = false, msg = 'That code is not valid or has expired. Request a new one.';
  if (ac && ac.tid) await updB(ac.tid, d => { const o = (d.otps || []).find(x => x.uid === ac.uid && x.status === 'open'); if (!o || o.exp < now()) return d; if (String(b.code || '').trim() !== o.otp) { o.tries++; if (o.tries >= 3) o.status = 'used'; msg = o.tries >= 3 ? 'Too many wrong codes. Request a new one.' : 'Wrong code.'; return d; } o.status = 'used'; good = true; return d; });
  if (!good) { await rlHit(rl); return [400, { err: msg }]; }
  ac.h = await hashPw(b.pw); ac.tv++; ac.mc = 0; await kput('acct:' + em, ac); await rlClear(rl); await audit(ac.tid, em, 'Password reset with OTP'); return { ok: true };
};
A.recover = async (b, req, ip) => {
  const code = process.env.ADMIN_SETUP_CODE, rl = await rlCheck('rec:' + ip, 5, 3600e3); if (rl.blocked) return [429, { err: 'Too many attempts. Try again later.', retryAfterSeconds: rl.retry }];
  const em = lc(b.email), ac = await kget('acct:' + em), bad = pwBad(b.pw);
  if (!code || !ac || ac.tid !== '' || String(b.code || '') !== code) { await rlHit(rl); return [401, { err: 'The email or setup code is not correct.' }]; } if (bad) return [400, { err: bad }];
  ac.h = await hashPw(b.pw); ac.tv++; ac.mfa = null; ac.mc = 0; await kput('acct:' + em, ac); await audit('', em, 'Admin password reset (setup code)'); return { ok: true };
};

/* ----- token required ----- */
A.load = async (b, ctx) => done(ctx);
A.poll = async (b, ctx) => { const o = { v: ctx.row.ver, suspended: ctx.suspended }; if (ctx.role === 'platform') { const n = ctx.row.d.notifs || []; o.unread = n.filter(x => !x.read).length; o.pend = (ctx.row.d.reqs || []).filter(x => x.status === 'pending').length; o.latest = n.filter(x => !x.read).slice(0, 3); } return o; };
A.save = async (b, ctx) => {
  if (ctx.suspended && ctx.role !== 'platform') return [403, { err: 'suspended' }];
  if (!b.data || typeof b.data !== 'object' || JSON.stringify(b.data).length > 4e6) return [400, { err: 'Bad or too large data.' }];
  for (let i = 0; i < 5; i++) {
    const row = await getB(ctx.tid); if (!row) return [404, { err: 'No data.' }]; const conflict = b.base !== row.ver, M = applyRules(ctx.role, row.d, b.data, conflict);
    if (await kcas(bk(ctx.tid), row.ver, { ver: row.ver + 1, d: M })) return { v: row.ver + 1, merged: conflict, data: conflict ? await viewOf(ctx, M) : undefined };
  }
  return [409, { err: 'Busy, try again.' }];
};
A.viewAll = async (b, ctx) => { if (ctx.role !== 'platform') return [403, { err: 'Not allowed.' }]; const o = {}; for (const r of (ctx.row.d.tenants || [])) { const t = await getB(r.id); if (t) o[r.id] = strip(JSON.parse(JSON.stringify(t.d))); } return { tenants: o }; };
A.mkT = async (b, ctx) => {
  if (ctx.role !== 'platform') return [403, { err: 'Not allowed.' }]; const em = lc(b.email), bad = pwBad(b.pw); if (!b.spa || !b.owner || !em.includes('@')) return [400, { err: 'Enter the spa, owner and a valid email.' }]; if (bad) return [400, { err: bad }];
  if (!(await emailFree(em))) return [409, { err: 'That email is already used.' }];
  const tid = await createTenant({ spa: b.spa, owner: b.owner, email: em, phone: b.phone, fee: b.fee, setup: b.setup, due: b.due }, await hashPw(b.pw), b.mc !== 0); await audit('', ctx.e, 'Client created: ' + b.spa); return { tid };
};
A.approve = async (b, ctx) => {
  if (ctx.role !== 'platform') return [403, { err: 'Not allowed.' }]; const q = (ctx.row.d.reqs || []).find(x => x.id === b.id); if (!q) return [404, { err: 'Request not found.' }]; if (q.status === 'approved') return [409, { err: 'Already approved.' }]; if (q.agr !== 'signed') return [400, { err: 'Share the agreement and mark it signed first.' }];
  const r = await kget('req:' + q.id); if (!r) return [404, { err: 'Request password missing.' }]; const em = lc(q.email); if (await kget('acct:' + em)) return [409, { err: 'That email is already used.' }];
  const p = await getB(''), pl = (p.d.plan) || {}; const tid = await createTenant({ ...q, fee: pl.fee, setup: pl.setup, due: pl.due }, r.h, false);
  await updB('', d => { const x = (d.reqs || []).find(y => y.id === q.id); if (x) { x.status = 'approved'; x.tid = tid; } return d; }); await kdel('req:' + q.id); await kdel('reqx:' + em); await audit('', ctx.e, 'Approved: ' + q.spa); return { tid };
};
A.reject = async (b, ctx) => { if (ctx.role !== 'platform') return [403, { err: 'Not allowed.' }]; await updB('', d => { const x = (d.reqs || []).find(y => y.id === b.id); if (x) x.status = 'rejected'; return d; }); await audit('', ctx.e, 'Rejected request'); return { ok: true }; };
A.notifRead = async (b, ctx) => { if (ctx.role !== 'platform') return [403, { err: 'Not allowed.' }]; await updB('', d => { (d.notifs || []).forEach(n => n.read = true); return d; }); return { ok: true }; };
A.credSet = async (b, ctx) => {
  const em = lc(b.email), old = lc(b.oldEmail || b.email), pf = ctx.role === 'platform', mg = ctx.role === 'manager'; if (!pf && !mg) return [403, { err: 'Not allowed.' }];
  let ac = await kget('acct:' + old); const tid = pf ? (b.tid || (ac && ac.tid) || '') : ctx.tid;
  if (ac && (ac.tid === '' || (!pf && ac.tid !== ctx.tid))) return [403, { err: 'Not allowed.' }];
  if (!ac) { if (!tid) return [400, { err: 'Missing spa.' }]; if (!b.uid || !b.pw) return [400, { err: 'Enter a password.' }]; if (!(await emailFree(em))) return [409, { err: 'That email is already used.' }]; ac = { email: em, uid: b.uid, tid, h: '', tv: 0, mc: 0, mfa: null }; }
  else if (em !== old) { if (!(await emailFree(em))) return [409, { err: 'That email is already used.' }]; await kdel('acct:' + old); ac.email = em; }
  if (b.pw) { const bad = pwBad(b.pw); if (bad) return [400, { err: bad }]; ac.h = await hashPw(b.pw); ac.tv++; ac.mc = b.mc ? 1 : 0; }
  if (b.mfaReset) { ac.mfa = null; ac.tv++; }
  await kput('acct:' + em, ac); await audit(ac.tid, ctx.e, 'Credentials updated for ' + em); return { ok: true };
};
A.credDel = async (b, ctx) => { const em = lc(b.email), ac = await kget('acct:' + em); if (ac && ac.tid && (ctx.role === 'platform' || (ctx.role === 'manager' && ac.tid === ctx.tid))) { await kdel('acct:' + em); await audit(ac.tid, ctx.e, 'Account removed ' + em); } return { ok: true }; };
A.chpw = async (b, ctx) => {
  const ac = ctx.ac, bad = pwBad(b.n); if (bad) return [400, { err: bad }];
  if (!b.forced || !ac.mc) { const rl = await rlCheck('cp:' + ctx.e, 5, 15 * 60e3); if (rl.blocked) return [429, { err: 'Too many attempts.', retryAfterSeconds: rl.retry }]; if (!(await checkPw(String(b.o || ''), ac.h))) { await rlHit(rl); return [400, { err: 'Current password is not correct.' }]; } }
  if (await checkPw(b.n, ac.h)) return [400, { err: 'Choose a different password.' }];
  ac.h = await hashPw(b.n); ac.tv++; ac.mc = 0; await kput('acct:' + ctx.e, ac); await audit(ac.tid, ctx.e, 'Password changed'); await mail(ctx.e, 'Your DK SPA POS password was changed', '<p>Your password was just changed. If this was not you, contact DK Global Tech immediately.</p>'); return { token: issue(ac) };
};
A.mfaEnrol = async (b, ctx) => { const ac = ctx.ac; if (ac.mfa && ac.mfa.on) return [409, { err: 'Already enabled.' }]; const sec = b32enc(crypto.randomBytes(20)); ac.mfa = { on: false, secret: sec, rec: [] }; await kput('acct:' + ctx.e, ac); return { secret: sec, uri: `otpauth://totp/DK%20SPA%20POS:${enc(ctx.e)}?secret=${sec}&issuer=DK%20SPA%20POS` }; };
A.mfaOn = async (b, ctx) => { const ac = ctx.ac; if (!ac.mfa || !ac.mfa.secret) return [400, { err: 'Start again.' }]; if (!totpOk(ac.mfa.secret, b.code)) return [400, { err: 'Wrong code. Check the time on your phone.' }]; const codes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex')); ac.mfa.on = true; ac.mfa.rec = codes.map(sha); await kput('acct:' + ctx.e, ac); await audit(ac.tid, ctx.e, 'MFA turned on'); await mail(ctx.e, 'Two-step login turned on', '<p>Two-step login was turned on for your DK SPA POS account.</p>'); return { codes }; };
A.mfaOff = async (b, ctx) => { if (ctx.role === 'platform') return [403, { err: 'The platform owner must keep two-step login on.' }]; const ac = ctx.ac; if (!(await checkPw(String(b.pw || ''), ac.h))) return [400, { err: 'Password is not correct.' }]; ac.mfa = null; await kput('acct:' + ctx.e, ac); await audit(ac.tid, ctx.e, 'MFA turned off'); await mail(ctx.e, 'Two-step login turned off', '<p>Two-step login was turned off for your DK SPA POS account.</p>'); return { ok: true }; };
A.logoutAll = async (b, ctx) => { ctx.ac.tv++; await kput('acct:' + ctx.e, ctx.ac); return { ok: true }; };

const PUBLIC = new Set(['ping', 'setup', 'login', 'mfa', 'signup', 'otpReq', 'otpUse', 'recover']);
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const out = (c, o, h) => { if (h) for (const k in h) res.setHeader(k, h[k]); res.status(c).json(o); };
  try {
    if (req.method !== 'POST') return out(405, { err: 'POST only' });
    if (!SB() || !KEY()) return out(500, { err: 'Server is not configured (Supabase environment variables missing).' });
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } } b = b || {};
    const fn = A[b.a]; if (!fn) return out(400, { err: 'Unknown action' });
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    let r; if (PUBLIC.has(b.a)) r = await fn(b, req, ip); else { const ctx = await authed(req); if (!ctx) return out(401, { err: 'Please log in again.' }); if (ctx.ac.mc && !['chpw', 'load', 'poll'].includes(b.a)) return out(403, { err: 'Choose a new password first.' }); r = await fn(b, ctx, ip); }
    if (Array.isArray(r)) return out(r[0], r[1], r[2]); return out(200, r);
  } catch (e) { console.error(e); return out(500, { err: 'Server error. Please try again.' }); }
};
