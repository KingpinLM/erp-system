// Standalone login HTML page - no React, no external JS, no cache
module.exports = function getLoginPage(error) {
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Cache-Control" content="no-store">
  <title>RFI ERP - Přihlášení</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: white; border-radius: 16px; padding: 2.5rem; width: 400px; max-width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .title { text-align: center; font-size: 1.8rem; font-weight: 800; background: linear-gradient(135deg, #e63946, #ff9f1c, #2ec4b6, #4361ee, #7209b7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { text-align: center; color: #64748b; margin: 0.5rem 0 1.5rem; font-size: 0.9rem; }
    .error { background: #fef2f2; color: #e63946; padding: 0.75rem; border-radius: 8px; text-align: center; margin-bottom: 1rem; font-size: 0.9rem; }
    .group { margin-bottom: 1rem; }
    label { display: block; font-weight: 600; margin-bottom: 0.3rem; font-size: 0.85rem; color: #334155; }
    input { width: 100%; padding: 0.7rem 1rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 1rem; outline: none; transition: border 0.2s; }
    input:focus { border-color: #4361ee; }
    button { width: 100%; padding: 0.8rem; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; color: white; cursor: pointer; background: linear-gradient(90deg, #e63946, #ff9f1c, #2ec4b6, #4361ee, #7209b7); }
    button:hover { opacity: 0.9; }
    .demo { margin-top: 1.5rem; font-size: 0.8rem; color: #64748b; }
    .demo strong { color: #334155; }
    .rainbow { height: 4px; background: linear-gradient(90deg, #e63946, #ff9f1c, #2ec4b6, #4361ee, #7209b7); border-radius: 16px 16px 0 0; margin: -2.5rem -2.5rem 2rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="rainbow"></div>
    <h1 class="title">RFI ERP</h1>
    <p class="subtitle">Přihlaste se do systému</p>
    ${error ? '<div class="error">Neplatné přihlašovací údaje</div>' : ''}
    <form method="POST" action="/api/auth/form-login">
      <div class="group">
        <label>Uživatelské jméno</label>
        <input name="username" required autocomplete="username" placeholder="uzivatel">
      </div>
      <div class="group">
        <label>Heslo</label>
        <input name="password" type="password" required autocomplete="current-password" placeholder="******">
      </div>
      <button type="submit">Přihlásit se</button>
    </form>
    <div class="demo">
      <strong>Demo:</strong> admin / admin123 | ucetni / ucetni123<br>
      manager / manager123 | viewer / viewer123
    </div>
  </div>
</body>
</html>`;
};
