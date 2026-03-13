// Standalone login HTML page - no React, no external JS, no cache
module.exports = function getLoginPage(error) {
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Cache-Control" content="no-store">
  <title>RFI ERP - Přihlášení</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #0a0f1e; -webkit-font-smoothing: antialiased; }
    canvas { position: fixed; inset: 0; z-index: 0; }

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
      width: 56px; height: 56px; border-radius: 16px;
      background: linear-gradient(135deg, #0d9488 0%, #0891b2 100%);
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 1.5rem;
      box-shadow: 0 8px 24px rgba(13,148,136,0.3);
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
    .input-wrap svg { position: absolute; left: 12px; color: rgba(255,255,255,0.3); pointer-events: none; transition: color 0.2s; }
    .input-wrap:focus-within svg { color: #2dd4bf; }
    .input-wrap input {
      width: 100%; padding: 0.7rem 0.75rem 0.7rem 40px;
      background: none; border: none; outline: none;
      font-size: 0.9rem; color: white; font-family: inherit;
    }
    .input-wrap input::placeholder { color: rgba(255,255,255,0.25); }
    .pw-toggle {
      position: absolute; right: 12px; background: none; border: none;
      cursor: pointer; color: rgba(255,255,255,0.3); padding: 2px; display: flex;
    }
    .pw-toggle:hover { color: rgba(255,255,255,0.6); }

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
    .demo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem 1rem; font-size: 0.75rem; color: rgba(255,255,255,0.3); }
    .demo-grid strong { color: rgba(255,255,255,0.5); font-weight: 600; }

    @media (max-width: 700px) {
      .login-container { flex-direction: column; max-width: 440px; }
      .brand { padding: 2rem 2rem 1.5rem; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); }
      .features { display: none; }
      .form-panel { padding: 2rem; }
    }
  </style>
</head>
<body>
  <canvas id="bg"></canvas>

  <div class="login-container">
    <div class="brand">
      <div class="brand-content">
        <div class="logo-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>
          </svg>
        </div>
        <h1 class="brand-title">RFI ERP</h1>
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <input name="username" placeholder="Zadejte uživatelské jméno" required autocomplete="username" autofocus>
            </div>
          </div>

          <div class="field">
            <label>Heslo</label>
            <div class="input-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input id="pw" name="password" type="password" placeholder="Zadejte heslo" required autocomplete="current-password">
              <button type="button" class="pw-toggle" onclick="var p=document.getElementById('pw');p.type=p.type==='password'?'text':'password'" tabindex="-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>

          <button type="submit" class="submit-btn">
            Přihlásit se
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </form>

        <div class="links">
          <a href="/forgot-password">Zapomenuté heslo?</a>
          <a href="/register">Vytvořit účet</a>
        </div>

        <div class="demo">
          <div class="demo-label">Demo přístupy</div>
          <div class="demo-grid">
            <span><strong>admin</strong> / admin123</span>
            <span><strong>ucetni</strong> / ucetni123</span>
            <span><strong>manager</strong> / manager123</span>
            <span><strong>viewer</strong> / viewer123</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    (function() {
      var canvas = document.getElementById('bg');
      var ctx = canvas.getContext('2d');
      var time = 0;
      var blobs = [
        { x: 0.2, y: 0.3, r: 0.38, color: [13, 148, 136], sx: 0.002, sy: 0.0015, ax: 0.18, ay: 0.14, phase: 0 },
        { x: 0.8, y: 0.2, r: 0.32, color: [8, 145, 178], sx: 0.0015, sy: 0.0018, ax: 0.15, ay: 0.12, phase: 2 },
        { x: 0.5, y: 0.8, r: 0.35, color: [15, 118, 110], sx: 0.0018, sy: 0.0012, ax: 0.16, ay: 0.18, phase: 4 },
        { x: 0.3, y: 0.65, r: 0.3, color: [45, 212, 191], sx: 0.0012, sy: 0.002, ax: 0.2, ay: 0.15, phase: 1 },
        { x: 0.7, y: 0.5, r: 0.28, color: [124, 58, 237], sx: 0.0022, sy: 0.0014, ax: 0.14, ay: 0.2, phase: 3 },
        { x: 0.15, y: 0.6, r: 0.22, color: [6, 182, 212], sx: 0.0019, sy: 0.0016, ax: 0.17, ay: 0.13, phase: 5 }
      ];

      function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
      resize();
      window.addEventListener('resize', resize);

      function animate() {
        time++;
        var w = canvas.width, h = canvas.height;
        ctx.fillStyle = '#0a0f1e';
        ctx.fillRect(0, 0, w, h);

        for (var i = 0; i < blobs.length; i++) {
          var b = blobs[i];
          // Organic multi-wave motion
          var cx = w * (b.x + b.ax * Math.sin(time * b.sx + b.phase) + 0.05 * Math.sin(time * b.sx * 2.7 + b.phase * 1.5));
          var cy = h * (b.y + b.ay * Math.cos(time * b.sy + b.phase * 0.8) + 0.04 * Math.cos(time * b.sy * 3.1 + b.phase * 2));
          // Pulsing radius
          var r = Math.min(w, h) * (b.r + 0.03 * Math.sin(time * 0.003 + b.phase));
          var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, 'rgba(' + b.color[0] + ',' + b.color[1] + ',' + b.color[2] + ',0.22)');
          g.addColorStop(0.4, 'rgba(' + b.color[0] + ',' + b.color[1] + ',' + b.color[2] + ',0.08)');
          g.addColorStop(1, 'rgba(' + b.color[0] + ',' + b.color[1] + ',' + b.color[2] + ',0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }
        requestAnimationFrame(animate);
      }
      animate();
    })();
  </script>
</body>
</html>`;
};
