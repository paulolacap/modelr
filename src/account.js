// ---------- account (PocketBase on Coolify) ----------
// Sign-in is required: until someone logs in, a full-screen login covers the app. The server address comes from
// <meta name="account-url">; without it (or in the claude.ai viewer) there is no login and the app opens as before.
// Designs saved to an account go to the "designs" collection (see pocketbase/collections.json).
const ACCT_KEY = 'sw-account';
const acctUrl = ((document.querySelector('meta[name="account-url"]') || {}).content || '').replace(/\/+$/, '');
let acct = null; // { token, user }
let acctMode = 'login';
function acctGated() { return !!acctUrl && !inViewer && !acct; }
try { acct = JSON.parse(localStorage.getItem(ACCT_KEY) || 'null'); } catch (e) { acct = null; }
function acctStore() {
  try { if (acct) localStorage.setItem(ACCT_KEY, JSON.stringify(acct)); else localStorage.removeItem(ACCT_KEY); } catch (e) { /* storage blocked */ }
}
async function pb(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (acct && acct.token) headers.Authorization = acct.token;
  let r;
  try { r = await fetch(acctUrl + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined }); }
  catch (e) { throw new Error('Could not reach the account server. Check your connection and try again.'); }
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) {
    if (r.status === 401 && acct) { acct = null; acctStore(); acctRender(); }
    const field = data && data.data && Object.values(data.data)[0];
    const err = new Error((field && field.message) || (data && data.message) || 'Something went wrong (' + r.status + ').');
    err.status = r.status;
    throw err;
  }
  return data;
}
function acctSignedIn(d) { acct = { token: d.token, user: { id: d.record.id, email: d.record.email, name: d.record.name || '' } }; acctStore(); acctRender(); }
function acctLabel() { return acct ? (acct.user.name || acct.user.email) : 'Log in'; }
function acctRender() {
  $('btnAccount').hidden = !acctUrl || inViewer;
  $('btnAccountLabel').textContent = acctLabel();
  const gated = acctGated();
  $('accountOverlay').classList.toggle('gate', gated);
  $('acctClose').hidden = gated; $('acctBrand').hidden = !gated;
  if (gated && $('accountOverlay').hidden) { $('accountOverlay').hidden = false; acctMsg(''); }
  if ($('accountOverlay').hidden) return;
  $('acctOut').hidden = !!acct; $('acctIn').hidden = !acct;
  if (acct) {
    $('acctWho').textContent = acct.user.email;
    $('acctSave').textContent = doc.cloudId ? 'Save changes to my account' : 'Save to my account';
    acctList();
  } else {
    const signup = acctMode === 'signup';
    $('acctTitle').textContent = signup ? 'Create an account' : 'Log in';
    $('acctIntro').textContent = signup ? 'Create an account to start using Shape Workshop. Your designs are saved to it so you can open them on any device.' : 'Log in to use Shape Workshop. New here? Create an account below.';
    $('acctNameRow').hidden = !signup;
    $('acctPass').autocomplete = signup ? 'new-password' : 'current-password';
    $('acctGo').textContent = signup ? 'Create account' : 'Log in';
    $('acctSwitch').textContent = signup ? 'I already have an account' : 'Create an account';
    $('acctForgot').hidden = signup;
  }
}
function acctMsg(t, bad) { const m = $('acctMsg'); m.textContent = t || ''; m.hidden = !t; m.classList.toggle('bad', !!bad); }
function acctOpen() {
  $('accountOverlay').hidden = false; acctMsg('');
  if (acct) { $('acctTitle').textContent = 'Your account'; acctRender(); $('acctSave').focus(); }
  else { acctRender(); $('acctEmail').focus(); }
}
function acctClose() { if (!acctGated()) $('accountOverlay').hidden = true; }
async function acctSubmit(e) {
  e.preventDefault();
  const email = $('acctEmail').value.trim(), password = $('acctPass').value;
  if (!email || !password) { acctMsg('Type your email and a password.', true); return; }
  $('acctGo').disabled = true; acctMsg(acctMode === 'signup' ? 'Creating your account…' : 'Logging in…');
  try {
    if (acctMode === 'signup') {
      if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
      await pb('/api/collections/users/records', { method: 'POST', body: { email, password, passwordConfirm: password, name: $('acctName').value.trim() } });
    }
    acctSignedIn(await pb('/api/collections/users/auth-with-password', { method: 'POST', body: { identity: email, password } }));
    $('acctPass').value = '';
    $('acctTitle').textContent = 'Your account'; acctMsg(''); acctClose(); acctRender();
    toast('Logged in as ' + acct.user.email + '.');
  } catch (err) {
    const msg = acctMode === 'login' ? (err.status === 400 ? 'That email and password do not match an account.' : err.message)
      : /unique/i.test(err.message) ? 'That email already has an account. Log in instead.' : err.message;
    acctMsg(msg, true);
  } finally { $('acctGo').disabled = false; }
}
async function acctForgot() {
  const email = $('acctEmail').value.trim();
  if (!email) { acctMsg('Type your email first, then press this again.', true); $('acctEmail').focus(); return; }
  try { await pb('/api/collections/users/request-password-reset', { method: 'POST', body: { email } }); acctMsg('If that email has an account, a reset link is on its way.'); }
  catch (err) { acctMsg(err.message, true); }
}
function acctLogout() { acct = null; acctStore(); doc.cloudId = null; persist(); acctMode = 'login'; acctClose(); acctRender(); toast('Logged out.'); }
async function acctList() {
  const list = $('acctList');
  list.innerHTML = '<li class="help">Loading your designs…</li>';
  let res;
  try { res = await pb('/api/collections/designs/records?sort=-updated&perPage=200&fields=id,name,updated'); }
  catch (err) { list.innerHTML = ''; acctMsg(err.message, true); return; }
  list.innerHTML = '';
  if (!res.items.length) { list.innerHTML = '<li class="help">Nothing saved yet. Your saved designs show up here, on any device you log in from.</li>'; return; }
  for (const it of res.items) {
    const li = document.createElement('li');
    const when = new Date(it.updated.replace(' ', 'T')).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    li.innerHTML = '<span class="acct-name"></span><span class="help"></span><button class="btn small">Open</button><button class="btn small ghost" aria-label="Delete">Delete</button>';
    li.children[0].textContent = it.name; li.children[1].textContent = when;
    if (it.id === doc.cloudId) li.classList.add('cur');
    li.children[2].onclick = () => acctLoad(it.id);
    li.children[3].onclick = () => acctDelete(it);
    list.appendChild(li);
  }
}
async function acctSave() {
  if (!acct) { acctOpen(); return; }
  const body = { name: doc.name, data: { app: 'shape-workshop', version: 1, name: doc.name, objects: doc.objects } };
  $('acctSave').disabled = true;
  try {
    let rec;
    if (doc.cloudId) {
      try { rec = await pb('/api/collections/designs/records/' + doc.cloudId, { method: 'PATCH', body }); }
      catch (err) { if (err.status !== 404) throw err; }
    }
    if (!rec) rec = await pb('/api/collections/designs/records', { method: 'POST', body: { ...body, owner: acct.user.id } });
    doc.cloudId = rec.id; persist();
    toast('Saved ' + doc.name + ' to your account.');
    acctRender();
  } catch (err) { acctMsg(err.message, true); toast(err.message); }
  finally { $('acctSave').disabled = false; }
}
async function acctLoad(id) {
  try {
    const rec = await pb('/api/collections/designs/records/' + id);
    loadProject(JSON.stringify(rec.data || {}));
    doc.cloudId = rec.id; persist();
    acctClose();
  } catch (err) { acctMsg(err.message, true); }
}
async function acctDelete(it) {
  if (!confirm('Delete "' + it.name + '" from your account? This cannot be undone.')) return;
  try {
    await pb('/api/collections/designs/records/' + it.id, { method: 'DELETE' });
    if (doc.cloudId === it.id) { doc.cloudId = null; persist(); }
    acctRender();
  } catch (err) { acctMsg(err.message, true); }
}
$('btnAccount').onclick = acctOpen;
$('acctClose').onclick = acctClose;
$('accountOverlay').onclick = (e) => { if (e.target === $('accountOverlay')) acctClose(); };
$('acctOut').onsubmit = acctSubmit;
$('acctSwitch').onclick = () => { acctMode = acctMode === 'signup' ? 'login' : 'signup'; acctMsg(''); acctRender(); };
$('acctForgot').onclick = acctForgot;
$('acctSave').onclick = acctSave;
$('acctLogout').onclick = acctLogout;
acctRender();
if (acctGated()) setTimeout(() => $('acctEmail').focus(), 0);
// Check the saved sign-in is still good (and get a fresh token).
if (acct && acctUrl && !inViewer) pb('/api/collections/users/auth-refresh', { method: 'POST' }).then(acctSignedIn).catch(() => { /* 401 already signs out; offline keeps the old token */ });
