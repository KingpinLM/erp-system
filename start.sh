#!/bin/bash
# ERP System - automatický start a aktualizace
cd "$(dirname "$0")"

echo "🌈 Rainbow Family Investment - ERP System"
echo "==========================================="

# Instalace závislostí
echo "📦 Instaluji závislosti..."
npm install --silent
cd client && npm install --silent && npx vite build 2>/dev/null && cd ..

# Seedování databáze (jen pokud neexistuje)
if [ ! -f erp.db ]; then
  echo "🗄️  Vytvářím databázi..."
  node server/seed.js
fi

# Spuštění serveru
echo ""
echo "==========================================="
echo "✅ ERP běží na: http://localhost:3001"
echo "👤 Přihlášení: admin / admin123"
echo "==========================================="
echo ""
echo "Pro ukončení stiskni Ctrl+C"
echo "Pro aktualizaci: znovu spusť ./start.sh"
echo ""

node server/index.js
