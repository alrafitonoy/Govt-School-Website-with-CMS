// The wizard is one self-contained page, so it works before anything else is set up.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const field = (name, label, { type = 'text', value = '', help = '', auto = 'off' } = {}) => `
  <div class="field" data-field="${name}">
    <label for="${name}">${label}</label>
    <input id="${name}" name="${name}" type="${type}" value="${esc(value)}" autocomplete="${auto}">
    ${help ? `<small>${help}</small>` : ''}
    <em class="err" hidden></em>
  </div>`;

export function wizardPage({ suggestedUrl, keyFile }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Install School Website</title><meta name="robots" content="noindex,nofollow">
<style>
:root{--ink:#0d1533;--ink2:#3c4665;--muted:#667089;--line:#d2d8e6;--brand:#000080;--bad:#b42335;--badbg:#fdecee;--good:#000080;--goodbg:#e6eefc}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;color:var(--ink);font:16px/1.6 'Segoe UI',system-ui,-apple-system,sans-serif;background:#fbfcfe;overflow-x:hidden}
.aurora{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none}
.aurora i{position:absolute;border-radius:50%;filter:blur(70px);opacity:.65}
.a1{width:60vw;height:44vh;left:-12vw;top:-12vh;background:linear-gradient(120deg,#9dbdf5,#cfe0fb)}
.a2{width:56vw;height:46vh;right:-10vw;top:-14vh;background:linear-gradient(120deg,#7fa6ee,#b9cff7)}
main{width:min(640px,100%);margin:0 auto;padding:36px 16px 64px}
h1{font-size:clamp(1.6rem,5vw,2.2rem);line-height:1.2;letter-spacing:-.02em;margin:0 0 6px}
.lead{color:var(--ink2);margin:0 0 22px}
.steps{display:flex;gap:6px;margin-bottom:18px}
.steps span{flex:1;height:5px;border-radius:9px;background:#dfe4ef}
.steps span.on{background:linear-gradient(90deg,#000080,#0a5fd6)}
.card{background:rgba(255,255,255,.9);border:1px solid #e4e8f1;border-radius:18px;padding:24px 20px;box-shadow:0 24px 60px -40px rgba(0,0,128,.4)}
@media(min-width:560px){.card{padding:30px}}
h2{font-size:1.2rem;margin:0 0 4px}
.card>p{color:var(--ink2);margin:0 0 18px;font-size:.95rem}
.field{display:flex;flex-direction:column;gap:5px;margin-bottom:15px}
label{font-weight:600;font-size:.88rem;color:var(--ink2)}
input{width:100%;min-height:44px;padding:9px 13px;border:1px solid var(--line);border-radius:10px;font:inherit;background:#fff;color:inherit}
input:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px rgba(0,0,128,.18)}
small{font-size:.8rem;color:var(--muted);line-height:1.45}
.err{font-style:normal;font-size:.82rem;font-weight:600;color:var(--bad)}
.row{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}
button,.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 22px;border-radius:12px;border:1px solid transparent;background:var(--brand);color:#fff;font:inherit;font-weight:700;cursor:pointer;text-decoration:none}
button.ghost{background:#fff;color:var(--ink);border-color:var(--line)}
button:disabled{opacity:.55;cursor:wait}
.note{padding:11px 14px;border-radius:10px;font-size:.92rem;font-weight:600;margin-bottom:14px}
.note.bad{background:var(--badbg);color:var(--bad)}
.note.good{background:var(--goodbg);color:var(--good)}
code{display:block;padding:9px 12px;background:#f1f3f9;border-radius:9px;font:.84rem Consolas,monospace;word-break:break-all;margin:6px 0 14px}
[hidden]{display:none!important}
</style></head><body>
<div class="aurora"><i class="a1"></i><i class="a2"></i></div>
<main>
  <h1>Install your school website</h1>
  <p class="lead">Four short steps, then your site is ready.</p>
  <div class="steps" aria-hidden="true"><span id="p0"></span><span id="p1"></span><span id="p2"></span><span id="p3"></span></div>
  <div class="note bad" id="msg" role="alert" hidden></div>

  <section class="card" id="s0">
    <h2>1. Install key</h2>
    <p>This proves you own this hosting account. Open this file in Hostinger's File Manager and copy the key inside it:</p>
    <code>${esc(keyFile)}</code>
    ${field('install_key', 'Install key')}
    <div class="row"><button type="button" id="next0">Continue</button></div>
  </section>

  <section class="card" id="s1" hidden>
    <h2>2. Database</h2>
    <p>Create a MySQL database in hPanel under Databases, then enter its details. Hostinger adds a prefix to the names, such as u123456_school. Enter them in full.</p>
    ${field('db_name', 'Database name')}
    ${field('db_user', 'Database username')}
    ${field('db_password', 'Database password', { type: 'password', auto: 'new-password' })}
    ${field('db_host', 'Database host', { value: 'localhost' })}
    ${field('db_port', 'Database port', { type: 'number', value: '3306' })}
    <div class="row"><button type="button" class="ghost" data-back="0">Back</button><button type="button" id="next1">Test and continue</button></div>
  </section>

  <section class="card" id="s2" hidden>
    <h2>3. Your school</h2>
    <p>You can change these later in the admin panel.</p>
    ${field('school_name', 'School name')}
    ${field('public_url', 'Website address', { value: suggestedUrl, help: 'Check that this is the address visitors will use, including https://.' })}
    <div class="row"><button type="button" class="ghost" data-back="1">Back</button><button type="button" id="next2">Continue</button></div>
  </section>

  <section class="card" id="s3" hidden>
    <h2>4. Admin account</h2>
    <p id="adminIntro">This account controls the whole site.</p>
    <div id="adminFields">
      ${field('admin_name', 'Your name', { auto: 'name' })}
      ${field('admin_email', 'Email', { type: 'email', auto: 'username' })}
      ${field('admin_password', 'Password', { type: 'password', auto: 'new-password', help: 'At least 10 characters, with letters and numbers.' })}
      ${field('admin_password2', 'Repeat the password', { type: 'password', auto: 'new-password' })}
    </div>
    <div class="row"><button type="button" class="ghost" data-back="2">Back</button><button type="button" id="install">Install now</button></div>
  </section>

  <section class="card" id="done" hidden>
    <div class="note good">Installation complete.</div>
    <h2 id="doneTitle">Your website is ready</h2>
    <div id="addressBox">
      <p style="color:var(--ink2);font-size:.95rem">This is the private address of your admin panel. Save it. If you lose it, sign in at <strong>/signin</strong> and you will be taken there.</p>
      <code id="address"></code>
    </div>
    <div class="row"><a class="btn" id="signin" href="/signin">Sign in</a></div>
  </section>
</main>
<script>
(function () {
  var hasAdmin = false, current = 0;
  var $ = function (id) { return document.getElementById(id); };
  var names = ['install_key','db_name','db_user','db_password','db_host','db_port','school_name','public_url','admin_name','admin_email','admin_password','admin_password2'];
  function values() { var o = {}; names.forEach(function (n) { o[n] = $(n).value; }); return o; }
  function show(i) {
    current = i;
    for (var n = 0; n < 4; n++) { $('s' + n).hidden = n !== i; $('p' + n).className = n <= i ? 'on' : ''; }
    $('msg').hidden = true;
    window.scrollTo(0, 0);
  }
  function clearErrors() {
    document.querySelectorAll('.err').forEach(function (e) { e.hidden = true; e.textContent = ''; });
    $('msg').hidden = true;
  }
  function showError(data) {
    $('msg').textContent = data.error || 'Something went wrong.';
    $('msg').hidden = false;
    var fields = data.fields || {}, first = null;
    Object.keys(fields).forEach(function (k) {
      var box = document.querySelector('[data-field="' + k + '"] .err');
      if (box) { box.textContent = fields[k]; box.hidden = false; first = first || k; }
    });
    window.scrollTo(0, 0);
    return first;
  }
  function post(url) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values()) })
      .then(function (r) { return r.json().catch(function () { return { error: 'The server sent an unexpected reply.' }; }).then(function (d) { return { ok: r.ok, data: d }; }); })
      .catch(function () { return { ok: false, data: { error: 'Could not reach the server. Check your connection and try again.' } }; });
  }
  function busy(btn, on, text) {
    btn.disabled = on;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = text; } else { btn.textContent = btn.dataset.label; }
  }
  $('next0').onclick = function () {
    var b = this; clearErrors(); busy(b, true, 'Checking...');
    post('install/check-key').then(function (r) { busy(b, false); if (r.ok) show(1); else showError(r.data); });
  };
  $('next1').onclick = function () {
    var b = this; clearErrors(); busy(b, true, 'Testing...');
    post('install/test-db').then(function (r) {
      busy(b, false);
      if (!r.ok) { showError(r.data); return; }
      hasAdmin = r.data.hasAdmin;
      $('adminFields').hidden = hasAdmin;
      $('adminIntro').textContent = hasAdmin
        ? 'This database already has a school site in it. Its data and admin accounts will be kept, and this app will reconnect to them. Saved email and payment passwords must be entered again afterwards.'
        : 'This account controls the whole site.';
      show(2);
    });
  };
  $('next2').onclick = function () {
    clearErrors();
    if (!$('school_name').value.trim()) { showError({ error: 'Please correct the highlighted fields.', fields: { school_name: 'Enter the school name.' } }); return; }
    show(3);
  };
  document.querySelectorAll('[data-back]').forEach(function (b) { b.onclick = function () { show(Number(b.dataset.back)); }; });
  $('install').onclick = function () {
    var b = this; clearErrors(); busy(b, true, 'Installing, please wait...');
    post('install/run').then(function (r) {
      busy(b, false);
      if (!r.ok) {
        var first = showError(r.data);
        if (first && ['school_name','public_url'].indexOf(first) >= 0) { show(2); showError(r.data); }
        else if (first && ['db_name','db_user'].indexOf(first) >= 0) { show(1); showError(r.data); }
        return;
      }
      for (var n = 0; n < 4; n++) $('s' + n).hidden = true;
      document.querySelector('.steps').hidden = true;
      $('done').hidden = false;
      if (r.data.adminAddress) {
        var base = new URL($('public_url').value.trim());
        $('address').textContent = base.origin + r.data.adminAddress;
      } else {
        $('addressBox').hidden = true;
        $('doneTitle').textContent = 'Reconnected to your existing site';
      }
      // Give the site a moment to take over from the installer.
      var link = $('signin'); link.style.pointerEvents = 'none'; link.style.opacity = '.55'; link.textContent = 'Starting...';
      setTimeout(function () { link.style.pointerEvents = ''; link.style.opacity = ''; link.textContent = 'Sign in'; }, 2500);
    });
  };
  show(0);
})();
</script>
</body></html>`;
}
