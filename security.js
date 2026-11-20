/* ============================================================================
   DK SPA POS – security.js
   Platform-admin security centre: block emails and phone numbers, suspend spas,
   watch failed logins and read a security log.
   - Loaded by index.html with <script src="security.js"></script>
   - Own storage key "dkspa_sec": separate from every spa's data and the lease data.
   - The platform admin's own email can never be blocked.
   - Blocks work in the browser where the app runs (this app stores data in the
     browser). To block people on every device, a server such as Supabase is needed.
   ============================================================================ */
const SEC=(()=>{
 const KEY='dkspa_sec';
 const get=()=>{try{const o=JSON.parse(localStorage.getItem(KEY));if(o&&Array.isArray(o.list))return{list:o.list,log:Array.isArray(o.log)?o.log:[]}}catch(e){}return{list:[],log:[]}};
 const put=o=>{try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){}};
 const nE=s=>String(s||'').trim().toLowerCase();
 const nP=s=>{let d=String(s||'').replace(/\D/g,'');if(d[0]==='0')d='254'+d.slice(1);else if(/^[17]\d{8}$/.test(d))d='254'+d;return d};
 const isAdm=e=>{try{return e===nE(ADMIN_EM)||isPA(e)}catch(x){return e==='dkglobaltech@gmail.com'}};
 const isAdmPhone=p=>{try{return p===nP(ADMIN_WA)}catch(x){return false}};
 const ev=(o,m)=>{o.log.unshift({t:new Date().toLocaleString(),m});o.log.length=Math.min(o.log.length,300)};
 const deny=e=>{e=nE(e);return !!e&&!isAdm(e)&&get().list.some(x=>x.t==='email'&&x.v===e)};
 const denyPhone=p=>{p=nP(p);return !!p&&!isAdmPhone(p)&&get().list.some(x=>x.t==='phone'&&x.v===p)};
 /* stop(): used by login, sign-up and booking. Returns true when blocked and records the attempt. */
 const stop=(kind,v,where)=>{const o=get(),val=kind==='phone'?nP(v):nE(v);if(!val)return false;if(kind==='email'&&isAdm(val))return false;if(kind==='phone'&&isAdmPhone(val))return false;const x=o.list.find(y=>y.t===kind&&y.v===val);if(!x)return false;x.hits=(x.hits||0)+1;x.last=new Date().toLocaleString();ev(o,'Blocked '+where+' attempt: '+val);put(o);return true};
 const add=(t,v,why)=>{const o=get();v=t==='phone'?nP(v):nE(v);
  if(t==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))return 'Enter a valid email address.';
  if(t==='phone'&&!(v.length>=11&&v.length<=13))return 'Enter a valid phone number, e.g. 0712 345 678.';
  if(t==='email'&&isAdm(v))return 'You cannot block the platform admin account.';
  if(t==='phone'&&isAdmPhone(v))return 'You cannot block the platform admin phone number.';
  if(o.list.some(x=>x.t===t&&x.v===v))return 'Already on the blocklist.';
  o.list.unshift({id:U(),t,v,why:String(why||'').trim().slice(0,120),at:td(),hits:0});ev(o,'Blocked '+t+': '+v+(why?' ('+why+')':''));put(o);return ''};
 const del=id=>{const o=get(),x=o.list.find(y=>y.id===id);if(!x)return;o.list=o.list.filter(y=>y.id!==id);ev(o,'Unblocked '+x.t+': '+x.v);put(o)};

 /* ---------- admin screen ---------- */
 const MSG='This account has been blocked. Please contact DK Global Tech.';
 function view(){
  const o=get(),T=td(),tn=(typeof TN==='function'?TN():[]),
  fails={};(D.log||[]).forEach(l=>{const m=/^Failed login: (.+)$/.exec(l.a||'');if(m&&l.d>=addD(T,-30)){const k=m[1].toLowerCase(),f=fails[k]||(fails[k]={n:0,last:l.t});f.n++}});
  const fl=Object.entries(fails).sort((a,b)=>b[1].n-a[1].n).slice(0,12),
  names={};tn.forEach(r=>{(tUsers(r.id)||[]).forEach(u=>{names[u.email.toLowerCase()]=r.spa})});
  const bl=e=>o.list.some(x=>x.t==='email'&&x.v===e.toLowerCase());
  const users=[];tn.forEach(r=>(tUsers(r.id)||[]).forEach(u=>users.push([r,u])));
  const P=(a,b)=>[a,b];
  const prot=[P('Login lockout','5 wrong passwords lock the sign-in for 5 minutes'),P('Blocklist',o.list.length+' email / phone entries'),P('Spa suspension','Suspending a spa locks its whole team out'),P('Role rights','Managers decide what each person can open'),P('Admin approval','New accounts need your approval and a signed agreement'),P('Activity log','Failed logins, voids, discounts and price changes are recorded')];
  return head('Security')+
  `<div class="kpis">${KP('Blocked entries',o.list.length)}${KP('Blocked attempts',o.list.reduce((n,x)=>n+(x.hits||0),0))}${KP('Failed logins (30 days)',Object.values(fails).reduce((n,x)=>n+x.n,0))}${KP('Suspended spas',tn.filter(r=>r.status!=='active').length)}</div>
  <div class="pan"><h2>Block an email or phone number</h2><p class="empty" style="padding:0 0 8px">A blocked email cannot sign in, create an account or be used for a booking. A blocked phone number cannot request an account or book. Your own admin email is protected and can never be blocked.</p>
  <div class="tbar"><select id="sct" style="width:auto"><option value="email">Email</option><option value="phone">Phone</option></select><input id="scv" placeholder="Email or phone number" style="flex:1;min-width:200px;width:auto"><input id="scw" placeholder="Reason (optional)" style="flex:1;min-width:160px;width:auto"><button class="btn" onclick="secAdd()">Block</button></div><div class="err" id="scm"></div></div>
  <div class="pan rp"><h2>Blocklist (${o.list.length})</h2>${tb(['Type','Value','Reason','Added','Attempts',''],o.list.map(x=>[x.t==='email'?'Email':'Phone',esc(x.v),esc(x.why||'—'),x.at,(x.hits||0)+(x.last?'<br><small style="color:var(--mu)">last '+esc(x.last)+'</small>':''),`<button class="btn g s" onclick="secDel('${x.id}')">Unblock</button>`]),'Nobody is blocked.')}</div>
  <div class="pan rp"><h2>Client spas</h2><p class="empty" style="padding:0 0 8px">Suspending a spa locks its whole team out until you activate it again. Its data stays safe.</p>${tb(['Spa','Owner','Phone','Status',''],tn.map(r=>[`<b>${esc(r.spa)}</b>`,esc(r.owner||'—'),esc(r.phone||'—'),`<span class="bdg ${r.status==='active'?'ok':'bad'}">${r.status==='active'?'Active':'Suspended'}</span>`,`<button class="btn ${r.status==='active'?'d':''} s" onclick="secSpa('${r.id}')">${r.status==='active'?'Suspend':'Activate'}</button>`]),'No client spas yet.')}</div>
  <div class="pan rp"><h2>Spa logins</h2>${tb(['Person','Spa','Role','Email',''],users.map(([r,u])=>[esc(u.name),esc(r.spa),esc(u.role),esc(u.email),bl(u.email)?`<button class="btn g s" onclick="secUnEmail('${esc(u.email.toLowerCase())}')">Unblock</button>`:`<button class="btn d s" onclick="secEmail('${esc(u.email.toLowerCase())}','Blocked by admin')">Block login</button>`]),'No spa logins yet.')}</div>
  <div class="pan rp"><h2>Recent failed logins (30 days)</h2>${tb(['Email tried','Attempts','Last attempt','Account',''],fl.map(([e,f])=>[esc(e),f.n,esc(f.last),names[e]?esc(names[e]):'<span style="color:var(--mu)">not a spa login</span>',isAdm(e)?'<span style="color:var(--mu)">admin</span>':bl(e)?'<span class="bdg bad">Blocked</span>':`<button class="btn d s" onclick="secEmail('${esc(e)}','Repeated failed logins')">Block</button>`]),'No failed logins recorded.')}</div>
  <div class="pan rp"><h2>Protections in place</h2>${tb(['Protection','How it works'],prot,'')}</div>
  <div class="pan rp"><h2>Security log</h2>${tb(['When','Event'],o.log.slice(0,40).map(l=>[esc(l.t),esc(l.m)]),'Nothing recorded yet.')}</div>
  <div class="pan"><h2>Good to know</h2><p class="empty" style="padding:0">This app keeps its data in the browser, so a block applies on the device and browser where the app runs. To block someone on every device, the blocklist has to move to a server such as your Supabase database. Tell us when you are ready for that.</p></div>`}
 return{deny,denyPhone,stop,add,del,view,MSG,log:m=>{const o=get();ev(o,m);put(o)}}
})();

function secAdd(){const e=SEC.add($('sct').value,$('scv').value,$('scw').value);if(e){$('scm').textContent=e;return}render()}
function secDel(id){SEC.del(id);render()}
function secEmail(e,why){if(!confirm('Block '+e+'? They will not be able to sign in.'))return;const r=SEC.add('email',e,why);if(r)alert(r);render()}
function secUnEmail(e){const x=(JSON.parse(localStorage.getItem('dkspa_sec')||'{"list":[]}').list||[]).find(y=>y.t==='email'&&y.v===e);if(x)SEC.del(x.id);render()}
function secSpa(id){const r=TN().find(x=>x.id===id);if(!r)return;if(!confirm((r.status==='active'?'Suspend ':'Activate ')+r.spa+'?'))return;tflip(id);SEC.log((r.status==='active'?'Activated ':'Suspended ')+r.spa)}
