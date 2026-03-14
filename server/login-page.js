// Standalone login HTML page - no React, no external JS, no cache
module.exports = function getLoginPage(error) {
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Cache-Control" content="no-store">
  <title>Rainbow Family Investment - Přihlášení</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #0a0f1e; -webkit-font-smoothing: antialiased; }
    .bg-wrap {
      position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none;
    }
    .blob {
      position: absolute; border-radius: 50%; filter: blur(120px);
    }
    .blob-1 {
      width: 450px; height: 450px; background: rgba(13,148,136,0.3);
      left: -5%; top: -10%;
      animation: b1 14s ease-in-out infinite;
    }
    .blob-2 {
      width: 380px; height: 380px; background: rgba(8,145,178,0.28);
      right: -5%; top: 10%;
      animation: b2 18s ease-in-out infinite;
    }
    .blob-3 {
      width: 400px; height: 400px; background: rgba(99,80,180,0.22);
      left: 25%; bottom: -15%;
      animation: b3 16s ease-in-out infinite;
    }
    .blob-4 {
      width: 320px; height: 320px; background: rgba(45,180,170,0.25);
      right: 10%; bottom: 0%;
      animation: b4 20s ease-in-out infinite;
    }
    @keyframes b1 {
      0%, 100% { transform: translate(0, 0); }
      25% { transform: translate(120px, 80px); }
      50% { transform: translate(60px, 180px); }
      75% { transform: translate(-40px, 100px); }
    }
    @keyframes b2 {
      0%, 100% { transform: translate(0, 0); }
      25% { transform: translate(-100px, 120px); }
      50% { transform: translate(-60px, -80px); }
      75% { transform: translate(80px, 40px); }
    }
    @keyframes b3 {
      0%, 100% { transform: translate(0, 0); }
      25% { transform: translate(100px, -80px); }
      50% { transform: translate(-80px, -40px); }
      75% { transform: translate(-120px, 60px); }
    }
    @keyframes b4 {
      0%, 100% { transform: translate(0, 0); }
      25% { transform: translate(-80px, -100px); }
      50% { transform: translate(60px, -60px); }
      75% { transform: translate(100px, 40px); }
    }

    .login-container {
      position: relative; z-index: 1;
      display: flex; width: 100%; max-width: 880px; margin: 1rem;
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(40px) saturate(1.4);
      -webkit-backdrop-filter: blur(40px) saturate(1.4);
      border-radius: 24px;
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 32px 64px -16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset;
      overflow: hidden;
      animation: fadeIn 0.6s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(16px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Left branding panel */
    .brand {
      flex: 1; padding: 3rem; display: flex; flex-direction: column; justify-content: center;
      background: linear-gradient(135deg, rgba(13,148,136,0.12) 0%, rgba(8,145,178,0.08) 100%);
      border-right: 1px solid rgba(255,255,255,0.06);
    }
    .brand-content { max-width: 300px; }
    .logo-icon {
      margin-bottom: 1.5rem;
    }
    .brand-title { font-size: 1.8rem; font-weight: 800; color: white; letter-spacing: -0.03em; margin-bottom: 0.5rem; }
    .brand-desc { font-size: 0.9rem; color: rgba(255,255,255,0.5); line-height: 1.6; margin-bottom: 2rem; }
    .features { display: flex; flex-direction: column; gap: 0.75rem; }
    .feature { display: flex; align-items: center; gap: 0.6rem; font-size: 0.82rem; color: rgba(255,255,255,0.65); }
    .feature svg { color: #2dd4bf; flex-shrink: 0; }

    /* Right form panel */
    .form-panel { flex: 1; padding: 3rem; display: flex; align-items: center; justify-content: center; }
    .form-inner { width: 100%; max-width: 320px; }
    .form-header { margin-bottom: 2rem; }
    .form-header h2 { font-size: 1.5rem; font-weight: 800; color: white; margin-bottom: 0.25rem; letter-spacing: -0.02em; }
    .form-header p { font-size: 0.85rem; color: rgba(255,255,255,0.4); }

    /* Fields */
    .field { margin-bottom: 1.25rem; }
    .field label { display: block; font-size: 0.78rem; font-weight: 600; color: rgba(255,255,255,0.5); margin-bottom: 0.4rem; letter-spacing: 0.02em; }
    .input-wrap {
      position: relative; display: flex; align-items: center;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px; transition: all 0.2s ease;
    }
    .input-wrap:focus-within {
      border-color: rgba(13,148,136,0.5);
      box-shadow: 0 0 0 3px rgba(13,148,136,0.12);
      background: rgba(255,255,255,0.08);
    }
    .input-icon { position: absolute; left: 12px; color: rgba(255,255,255,0.3); pointer-events: none; transition: color 0.2s; }
    .input-wrap:focus-within .input-icon { color: #2dd4bf; }
    .input-wrap input {
      width: 100%; padding: 0.7rem 0.75rem 0.7rem 40px;
      background: none; border: none; outline: none;
      font-size: 0.9rem; color: white; font-family: inherit;
    }
    .input-wrap input[type="password"],
    .input-wrap .has-toggle { padding-right: 44px; }
    .input-wrap input::placeholder { color: rgba(255,255,255,0.25); }
    .pw-toggle {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      background: none; border: none;
      cursor: pointer; color: rgba(255,255,255,0.3); padding: 4px; display: flex;
      border-radius: 6px; transition: all 0.15s;
    }
    .pw-toggle:hover { color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.08); }

    /* Submit */
    .submit-btn {
      width: 100%; padding: 0.8rem 1.25rem; margin-top: 0.5rem;
      background: linear-gradient(135deg, #0d9488 0%, #0891b2 100%);
      border: none; border-radius: 12px;
      color: white; font-size: 0.95rem; font-weight: 700; font-family: inherit;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      transition: all 0.2s ease;
      box-shadow: 0 4px 16px rgba(13,148,136,0.25);
    }
    .submit-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(13,148,136,0.35); filter: brightness(1.1); }
    .submit-btn:active { transform: translateY(0); }
    .submit-btn.loading { opacity: 0.7; pointer-events: none; }
    .submit-btn .spinner { display: none; width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }
    .submit-btn.loading .spinner { display: block; }
    .submit-btn.loading .btn-text { display: none; }
    .submit-btn.loading .btn-arrow { display: none; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Links */
    .links { display: flex; justify-content: space-between; margin-top: 1.25rem; }
    .links a { font-size: 0.82rem; color: rgba(255,255,255,0.4); text-decoration: none; transition: color 0.15s; }
    .links a:hover { color: #2dd4bf; }

    /* Error */
    .login-error {
      display: flex; align-items: center; gap: 0.5rem;
      background: rgba(239,68,68,0.12); color: #fca5a5;
      padding: 0.7rem 1rem; border-radius: 10px; margin-bottom: 1.25rem;
      font-size: 0.85rem; border: 1px solid rgba(239,68,68,0.15);
    }

    /* Demo */
    .demo { margin-top: 1.75rem; padding-top: 1.25rem; border-top: 1px solid rgba(255,255,255,0.06); }
    .demo-label { font-size: 0.7rem; font-weight: 700; color: rgba(255,255,255,0.25); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.5rem; }
    .demo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem 1rem; font-size: 0.75rem; color: rgba(255,255,255,0.3); }
    .demo-grid strong { color: rgba(255,255,255,0.5); font-weight: 600; }
    .demo-btn {
      background: none; border: 1px solid rgba(255,255,255,0.06); color: rgba(255,255,255,0.35);
      padding: 0.3rem 0.5rem; border-radius: 6px; cursor: pointer; font-family: inherit;
      font-size: 0.75rem; text-align: left; transition: all 0.15s;
    }
    .demo-btn:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6); border-color: rgba(255,255,255,0.12); }
    .demo-btn strong { color: rgba(255,255,255,0.55); font-weight: 600; }

    @media (max-width: 700px) {
      .login-container { flex-direction: column; max-width: 440px; }
      .brand { padding: 2rem 2rem 1.5rem; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); }
      .features { display: none; }
      .form-panel { padding: 2rem; }
    }
  </style>
</head>
<body>
  <div class="bg-wrap">
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="blob blob-3"></div>
    <div class="blob blob-4"></div>
  </div>

  <div class="login-container">
    <div class="brand">
      <div class="brand-content">
        <div class="logo-icon">
          <svg width="240" height="64" viewBox="0 0 300 80" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="login-sp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#1E2A3A"/>
                <stop offset="20%" stop-color="#2D5A1E"/>
                <stop offset="40%" stop-color="#7C8C6E"/>
                <stop offset="60%" stop-color="#C4A265"/>
                <stop offset="80%" stop-color="#C47D5A"/>
                <stop offset="100%" stop-color="#8B5A6B"/>
              </linearGradient>
            </defs>
            <rect x="12" y="12" width="4" height="56" rx="2" fill="url(#login-sp)"/>
            <text x="26" y="44" font-family="Georgia,serif" font-size="30" font-weight="700" fill="white">Rainbow Family</text>
            <text x="27" y="62" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="500" fill="white" letter-spacing="4" opacity="0.45">INVESTMENT</text>
          </svg>
        </div>
        <h1 class="brand-title" style="font-size:1.1rem;font-weight:500;opacity:0.6;letter-spacing:0.05em">ERP SYSTÉM</h1>
        <p class="brand-desc">Moderní systém pro správu faktur, klientů a účetnictví vaší firmy.</p>
        <div class="features">
          <div class="feature">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>Fakturace a evidence</span>
          </div>
          <div class="feature">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>Správa klientů</span>
          </div>
          <div class="feature">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>Bankovní integrace</span>
          </div>
        </div>
      </div>
    </div>

    <div class="form-panel">
      <div class="form-inner">
        <div class="form-header">
          <h2>Vítejte zpět</h2>
          <p>Přihlaste se ke svému účtu</p>
        </div>

        ${error ? `<div class="login-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          Neplatné přihlašovací údaje
        </div>` : ''}

        <form method="POST" action="/api/auth/form-login">
          <div class="field">
            <label>Uživatelské jméno</label>
            <div class="input-wrap">
              <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <input name="username" placeholder="Zadejte uživatelské jméno" required autocomplete="username" autofocus>
            </div>
          </div>

          <div class="field">
            <label>Heslo</label>
            <div class="input-wrap">
              <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input id="pw" name="password" type="password" class="has-toggle" placeholder="Zadejte heslo" required autocomplete="current-password">
              <button type="button" class="pw-toggle" onclick="var p=document.getElementById('pw');var e=this.querySelector('.eye-on'),h=this.querySelector('.eye-off');if(p.type==='password'){p.type='text';e.style.display='none';h.style.display='block';}else{p.type='password';e.style.display='block';h.style.display='none';}" tabindex="-1">
                <svg class="eye-on" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <svg class="eye-off" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              </button>
            </div>
          </div>

          <button type="submit" class="submit-btn" id="submitBtn">
            <span class="btn-text">Přihlásit se</span>
            <svg class="btn-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            <span class="spinner"></span>
          </button>
        </form>

        <div class="links">
          <a href="/forgot-password">Zapomenuté heslo?</a>
          <a href="/register">Vytvořit účet</a>
        </div>

        <div class="demo">
          <div class="demo-label">Demo přístupy</div>
          <div class="demo-grid">
            <button type="button" class="demo-btn" onclick="fillDemo('admin','admin123')"><strong>admin</strong> / admin123</button>
            <button type="button" class="demo-btn" onclick="fillDemo('ucetni','ucetni123')"><strong>ucetni</strong> / ucetni123</button>
            <button type="button" class="demo-btn" onclick="fillDemo('manager','manager123')"><strong>manager</strong> / manager123</button>
            <button type="button" class="demo-btn" onclick="fillDemo('viewer','viewer123')"><strong>viewer</strong> / viewer123</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    function fillDemo(u, p) {
      document.querySelector('input[name="username"]').value = u;
      document.getElementById('pw').value = p;
      document.querySelector('input[name="username"]').focus();
    }
    document.querySelector('form').addEventListener('submit', function() {
      document.getElementById('submitBtn').classList.add('loading');
    });

  </script>
</body>
</html>`;
};
