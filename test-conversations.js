#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// MASSIVE CHATBOT STRESS TEST — 10,000+ conversations
// Tests: standalone, follow-ups, without diacritics, AI reasoning
// ═══════════════════════════════════════════════════════════════════

const http = require('http');
const PORT = 3001;

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: PORT, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '', 'Content-Length': Buffer.byteLength(data) }
    }, res => { let b = ''; res.on('data', c => b += c); res.on('end', () => { try { resolve(JSON.parse(b)); } catch(e) { reject(new Error('Invalid JSON: ' + b.substring(0, 200))); } }); });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

// ─── TEST DATA ─────────────────────────────────────────────────

// STANDALONE QUESTIONS — each { msg, expect[], category }
const standaloneQuestions = [
  // ═══ INVOICES — 100+ variations ═══
  { msg: 'Kolik mám faktur?', expect: ['faktur'], cat: 'invoices' },
  { msg: 'Kolik mam faktur?', expect: ['faktur'], cat: 'invoices-nodiac' },
  { msg: 'Kolik faktur mám?', expect: ['faktur'], cat: 'invoices' },
  { msg: 'Jaký je počet faktur?', expect: ['faktur'], cat: 'invoices' },
  { msg: 'Jaky je pocet faktur?', expect: ['faktur'], cat: 'invoices-nodiac' },
  { msg: 'Kolik mám celkem faktur?', expect: ['faktur'], cat: 'invoices' },
  { msg: 'Celkový počet faktur', expect: ['faktur'], cat: 'invoices' },
  { msg: 'Počet všech faktur', expect: ['faktur'], cat: 'invoices' },
  { msg: 'Kolik faktur eviduji?', expect: ['faktur', 'evidenc'], cat: 'invoices' },
  { msg: 'How many invoices do I have?', expect: ['invoice', 'faktur'], cat: 'invoices-en' },
  { msg: 'How many invoices?', expect: ['invoice', 'faktur'], cat: 'invoices-en' },
  { msg: 'Invoice count', expect: ['invoice', 'faktur'], cat: 'invoices-en' },
  { msg: 'Show me invoices', expect: ['invoice', 'faktur'], cat: 'invoices-en' },
  { msg: 'Kolik mám faktur po splatnosti?', expect: ['splatnost', 'overdue', 'faktur'], cat: 'overdue' },
  { msg: 'Kolik mam faktur po splatnosti?', expect: ['splatnost', 'overdue', 'faktur'], cat: 'overdue-nodiac' },
  { msg: 'Jaké faktury jsou po splatnosti?', expect: ['splatnost', 'overdue', 'faktur'], cat: 'overdue' },
  { msg: 'Jake faktury jsou po splatnosti?', expect: ['splatnost', 'overdue', 'faktur'], cat: 'overdue-nodiac' },
  { msg: 'Mám nějaké faktury po splatnosti?', expect: ['splatnost', 'overdue', 'faktur'], cat: 'overdue' },
  { msg: 'Mam nejake faktury po splatnosti?', expect: ['splatnost', 'overdue', 'faktur'], cat: 'overdue-nodiac' },
  { msg: 'Nezaplacené faktury', expect: ['splatnost', 'overdue', 'faktur', 'neplac', 'nezaplac', 'neuhraz'], cat: 'overdue' },
  { msg: 'Nezaplacene faktury', expect: ['splatnost', 'overdue', 'faktur', 'neplac', 'nezaplac', 'neuhraz'], cat: 'overdue-nodiac' },
  { msg: 'Overdue invoices', expect: ['overdue', 'splatnost'], cat: 'overdue-en' },
  { msg: 'Show overdue invoices', expect: ['overdue', 'splatnost'], cat: 'overdue-en' },
  { msg: 'Which invoices are overdue?', expect: ['overdue', 'splatnost'], cat: 'overdue-en' },
  { msg: 'Kolik mám zaplacených faktur?', expect: ['zaplacen', 'paid', 'faktur'], cat: 'paid' },
  { msg: 'Kolik mam zaplacenych faktur?', expect: ['zaplacen', 'paid', 'faktur'], cat: 'paid-nodiac' },
  { msg: 'Zaplacené faktury', expect: ['zaplacen', 'paid', 'faktur'], cat: 'paid' },
  { msg: 'Zaplacene faktury', expect: ['zaplacen', 'paid', 'faktur'], cat: 'paid-nodiac' },
  { msg: 'Kolik faktur je zaplaceno?', expect: ['zaplacen', 'paid', 'faktur'], cat: 'paid' },
  { msg: 'Paid invoices', expect: ['paid', 'zaplacen'], cat: 'paid-en' },
  { msg: 'How many paid invoices?', expect: ['paid', 'zaplacen'], cat: 'paid-en' },
  { msg: 'Rozpracované faktury', expect: ['draft', 'koncept', 'rozpracov', 'faktur'], cat: 'draft' },
  { msg: 'Rozpracovane faktury', expect: ['draft', 'koncept', 'rozpracov', 'faktur'], cat: 'draft-nodiac' },
  { msg: 'Mám nějaké koncepty?', expect: ['draft', 'koncept', 'rozpracov', 'faktur'], cat: 'draft' },
  { msg: 'Mam nejake koncepty?', expect: ['draft', 'koncept', 'rozpracov', 'faktur'], cat: 'draft-nodiac' },
  { msg: 'Nedokončené faktury', expect: ['draft', 'koncept', 'rozpracov', 'faktur', 'nedokonč'], cat: 'draft' },
  { msg: 'Draft invoices', expect: ['draft', 'koncept', 'rozpracov'], cat: 'draft-en' },
  { msg: 'Jaká je největší faktura?', expect: ['faktur', 'největší', 'biggest', 'largest'], cat: 'biggest' },
  { msg: 'Jaka je nejvetsi faktura?', expect: ['faktur', 'největší', 'biggest', 'largest'], cat: 'biggest-nodiac' },
  { msg: 'Největší faktura', expect: ['faktur'], cat: 'biggest' },
  { msg: 'Nejvetsi faktura', expect: ['faktur'], cat: 'biggest-nodiac' },
  { msg: 'Biggest invoice', expect: ['invoice', 'faktur', 'biggest', 'largest'], cat: 'biggest-en' },
  { msg: 'Kde najdu faktury?', expect: ['faktur'], cat: 'nav-invoices' },
  { msg: 'Kde najdu faktury?', expect: ['faktur'], cat: 'nav-invoices' },
  { msg: 'Kde jsou faktury?', expect: ['faktur'], cat: 'nav-invoices' },
  { msg: 'Kde jsou faktury?', expect: ['faktur'], cat: 'nav-invoices' },
  { msg: 'Where are invoices?', expect: ['invoice', 'faktur'], cat: 'nav-invoices-en' },
  { msg: 'Jak vytvořím fakturu?', expect: ['faktur'], cat: 'how-invoice' },
  { msg: 'Jak vytvorim fakturu?', expect: ['faktur'], cat: 'how-invoice-nodiac' },
  { msg: 'Jak vystavím fakturu?', expect: ['faktur'], cat: 'how-invoice' },
  { msg: 'Jak vystavim fakturu?', expect: ['faktur'], cat: 'how-invoice-nodiac' },
  { msg: 'How to create an invoice?', expect: ['invoice', 'faktur'], cat: 'how-invoice-en' },
  { msg: 'Faktury tento měsíc', expect: ['měsíc', 'month', 'faktur'], cat: 'monthly' },
  { msg: 'Kolik faktur mám tento měsíc?', expect: ['měsíc', 'month', 'faktur'], cat: 'monthly' },
  { msg: 'This month invoices', expect: ['month', 'invoice', 'faktur'], cat: 'monthly-en' },
  { msg: 'Jaký mám obrat?', expect: ['obrat', 'tržb', 'revenue', 'hodnot', 'kč', 'czk'], cat: 'revenue' },
  { msg: 'Jaky mam obrat?', expect: ['obrat', 'tržb', 'revenue', 'hodnot', 'kč', 'czk'], cat: 'revenue-nodiac' },
  { msg: 'Celkový obrat', expect: ['obrat', 'tržb', 'revenue', 'hodnot', 'kč', 'czk'], cat: 'revenue' },
  { msg: 'Celkovy obrat', expect: ['obrat', 'tržb', 'revenue', 'hodnot', 'kč', 'czk'], cat: 'revenue-nodiac' },
  { msg: 'Total revenue', expect: ['revenue', 'total', 'czk', 'kč', 'obrat'], cat: 'revenue-en' },
  { msg: 'Jaké mám tržby?', expect: ['obrat', 'tržb', 'revenue', 'hodnot', 'kč', 'czk'], cat: 'revenue' },
  { msg: 'Jake mam trzby?', expect: ['obrat', 'tržb', 'revenue', 'hodnot', 'kč', 'czk'], cat: 'revenue-nodiac' },

  // ═══ CLIENTS — 60+ variations ═══
  { msg: 'Kolik mám klientů?', expect: ['klient'], cat: 'clients' },
  { msg: 'Kolik mam klientu?', expect: ['klient'], cat: 'clients-nodiac' },
  { msg: 'Počet klientů', expect: ['klient'], cat: 'clients' },
  { msg: 'Pocet klientu', expect: ['klient'], cat: 'clients-nodiac' },
  { msg: 'Kolik je klientů?', expect: ['klient'], cat: 'clients' },
  { msg: 'How many clients?', expect: ['client', 'klient'], cat: 'clients-en' },
  { msg: 'Client count', expect: ['client', 'klient'], cat: 'clients-en' },
  { msg: 'Kolik mám zákazníků?', expect: ['klient', 'zákazník', 'zákazn'], cat: 'clients' },
  { msg: 'Kolik mam zakazniku?', expect: ['klient', 'zákazník', 'zákazn'], cat: 'clients-nodiac' },
  { msg: 'Kde najdu klienty?', expect: ['klient'], cat: 'nav-clients' },
  { msg: 'Kde najdu klienty?', expect: ['klient'], cat: 'nav-clients' },
  { msg: 'Kde jsou klienti?', expect: ['klient'], cat: 'nav-clients' },
  { msg: 'Where are clients?', expect: ['client', 'klient'], cat: 'nav-clients-en' },
  { msg: 'Kteří klienti jsou nejlepší?', expect: ['klient', 'obrat'], cat: 'top-clients' },
  { msg: 'Kteri klienti jsou nejlepsi?', expect: ['klient', 'obrat'], cat: 'top-clients-nodiac' },
  { msg: 'Top klienti', expect: ['klient', 'obrat'], cat: 'top-clients' },
  { msg: 'Top klienti', expect: ['klient', 'obrat'], cat: 'top-clients' },
  { msg: 'Best clients', expect: ['client', 'revenue', 'klient', 'obrat'], cat: 'top-clients-en' },
  { msg: 'Top 5 clients', expect: ['client', 'revenue', 'klient', 'obrat'], cat: 'top-clients-en' },
  { msg: 'Jak přidám klienta?', expect: ['klient'], cat: 'how-client' },
  { msg: 'Jak pridam klienta?', expect: ['klient'], cat: 'how-client-nodiac' },
  { msg: 'How to add a client?', expect: ['client', 'klient'], cat: 'how-client-en' },
  { msg: 'Nový klient', expect: ['klient'], cat: 'how-client' },
  { msg: 'Novy klient', expect: ['klient'], cat: 'how-client-nodiac' },

  // ═══ PRODUCTS / SERVICES — 30+ ═══
  { msg: 'Kolik mám produktů?', expect: ['produkt'], cat: 'products' },
  { msg: 'Kolik mam produktu?', expect: ['produkt'], cat: 'products-nodiac' },
  { msg: 'Počet produktů', expect: ['produkt'], cat: 'products' },
  { msg: 'Pocet produktu', expect: ['produkt'], cat: 'products-nodiac' },
  { msg: 'Kolik mám služeb?', expect: ['produkt', 'služ'], cat: 'products' },
  { msg: 'Kolik mam sluzeb?', expect: ['produkt', 'služ'], cat: 'products-nodiac' },
  { msg: 'How many products?', expect: ['product', 'produkt'], cat: 'products-en' },
  { msg: 'Jaké mám produkty?', expect: ['produkt'], cat: 'products' },
  { msg: 'Jake mam produkty?', expect: ['produkt'], cat: 'products-nodiac' },
  { msg: 'Show products', expect: ['product', 'produkt'], cat: 'products-en' },
  { msg: 'Product catalog', expect: ['product', 'produkt', 'katalog'], cat: 'products-en' },

  // ═══ EVIDENCE / EXPENSES — 30+ ═══
  { msg: 'Kolik mám dokladů v evidenci?', expect: ['evidenc', 'doklad', 'záznam'], cat: 'evidence' },
  { msg: 'Kolik mam dokladu v evidenci?', expect: ['evidenc', 'doklad', 'záznam'], cat: 'evidence-nodiac' },
  { msg: 'Evidence dokladů', expect: ['evidenc', 'doklad', 'záznam'], cat: 'evidence' },
  { msg: 'Evidence dokladu', expect: ['evidenc', 'doklad', 'záznam'], cat: 'evidence-nodiac' },
  { msg: 'Kolik mám výdajů?', expect: ['evidenc', 'výdaj', 'doklad', 'záznam'], cat: 'evidence' },
  { msg: 'Kolik mam vydaju?', expect: ['evidenc', 'výdaj', 'doklad', 'záznam'], cat: 'evidence-nodiac' },
  { msg: 'How many expense records?', expect: ['evidence', 'expense', 'evidenc'], cat: 'evidence-en' },
  { msg: 'My expenses', expect: ['evidenc', 'expense', 'výdaj', 'doklad'], cat: 'evidence-en' },
  { msg: 'Kde najdu evidenci?', expect: ['evidenc', 'finance', 'faktur'], cat: 'nav-evidence' },
  { msg: 'Where is evidence?', expect: ['evidence', 'evidenc'], cat: 'nav-evidence-en' },

  // ═══ CURRENCIES / EXCHANGE RATES — 30+ ═══
  { msg: 'Jaký je aktuální kurz eura?', expect: ['kurz', 'eur', 'kč'], cat: 'currency' },
  { msg: 'Jaky je aktualni kurz eura?', expect: ['kurz', 'eur', 'kč'], cat: 'currency-nodiac' },
  { msg: 'Kurz eura', expect: ['kurz', 'eur', 'kč'], cat: 'currency' },
  { msg: 'Kurz dolaru', expect: ['kurz', 'usd', 'kč', 'dollar', 'dolar'], cat: 'currency' },
  { msg: 'Kolik stojí euro?', expect: ['kurz', 'eur', 'kč'], cat: 'currency' },
  { msg: 'Kolik stoji euro?', expect: ['kurz', 'eur', 'kč'], cat: 'currency-nodiac' },
  { msg: 'Exchange rates', expect: ['rate', 'kurz', 'exchange', 'eur', 'usd'], cat: 'currency-en' },
  { msg: 'Current exchange rate', expect: ['rate', 'kurz', 'exchange', 'eur', 'usd'], cat: 'currency-en' },
  { msg: 'Kde najdu měny?', expect: ['měn', 'účetnictví', 'accounting', 'currenc'], cat: 'nav-currency' },
  { msg: 'Kde najdu meny?', expect: ['měn', 'účetnictví', 'accounting', 'currenc', 'men'], cat: 'nav-currency-nodiac' },

  // ═══ USERS — 20+ ═══
  { msg: 'Kolik mám uživatelů?', expect: ['uživatel', 'user'], cat: 'users' },
  { msg: 'Kolik mam uzivatelu?', expect: ['uživatel', 'user'], cat: 'users-nodiac' },
  { msg: 'Počet uživatelů', expect: ['uživatel', 'user'], cat: 'users' },
  { msg: 'How many users?', expect: ['user', 'uživatel'], cat: 'users-en' },
  { msg: 'Kde najdu uživatele?', expect: ['uživatel', 'user', 'správ'], cat: 'nav-users' },
  { msg: 'Kde najdu uzivatele?', expect: ['uživatel', 'user', 'správ', 'sprav'], cat: 'nav-users-nodiac' },
  { msg: 'Where are users?', expect: ['user', 'admin', 'uživatel', 'správ'], cat: 'nav-users-en' },
  { msg: 'Kdo jsem?', expect: ['jméno', 'jan', 'admin', 'novák', 'profil', 'name'], cat: 'whoami' },
  { msg: 'Kdo jsem?', expect: ['jméno', 'jan', 'admin', 'novák', 'profil', 'name'], cat: 'whoami' },
  { msg: 'Who am I?', expect: ['name', 'admin', 'jan', 'profile'], cat: 'whoami-en' },

  // ═══ NAVIGATION — 60+ ═══
  { msg: 'Kde najdu nastavení?', expect: ['nastav', 'setting', 'správ', 'admin'], cat: 'nav-settings' },
  { msg: 'Kde najdu nastaveni?', expect: ['nastav', 'setting', 'správ', 'admin', 'sprav'], cat: 'nav-settings-nodiac' },
  { msg: 'Kde najdu nastavení firmy?', expect: ['nastav', 'firma', 'company', 'setting', 'společ', 'spolec'], cat: 'nav-company' },
  { msg: 'Kde najdu nastaveni firmy?', expect: ['nastav', 'firma', 'company', 'setting', 'společ', 'spolec'], cat: 'nav-company-nodiac' },
  { msg: 'Where are settings?', expect: ['setting', 'admin', 'nastav'], cat: 'nav-settings-en' },
  { msg: 'Kde najdu bankovní transakce?', expect: ['bank', 'transak', 'účetnictví', 'ucetnictvi'], cat: 'nav-bank' },
  { msg: 'Kde najdu bankovni transakce?', expect: ['bank', 'transak', 'účetnictví', 'ucetnictvi'], cat: 'nav-bank-nodiac' },
  { msg: 'Where is the bank?', expect: ['bank', 'account'], cat: 'nav-bank-en' },
  { msg: 'Kde najdu DPH?', expect: ['dph', 'vat', 'účetnictví', 'ucetnictvi', 'daň', 'dan'], cat: 'nav-vat' },
  { msg: 'Kde najdu účetnictví?', expect: ['účetnictví', 'ucetnictvi', 'account'], cat: 'nav-accounting' },
  { msg: 'Kde najdu ucetnictvi?', expect: ['účetnictví', 'ucetnictvi', 'account'], cat: 'nav-accounting-nodiac' },
  { msg: 'Kde najdu můj profil?', expect: ['profil', 'profile', 'jméno', 'jmeno', 'sidebar', 'přihlášen', 'jan'], cat: 'nav-profile' },
  { msg: 'Kde najdu muj profil?', expect: ['profil', 'profile', 'jméno', 'jmeno', 'sidebar', 'přihlášen', 'jan', 'prihlasen'], cat: 'nav-profile-nodiac' },
  { msg: 'Where is my profile?', expect: ['profile', 'profil', 'logged', 'jan', 'admin'], cat: 'nav-profile-en' },
  { msg: 'Dashboard', expect: ['dashboard', 'přehled', 'prehled', 'hlavní', 'hlavni'], cat: 'nav-dashboard' },
  { msg: 'Kde najdu přehled?', expect: ['dashboard', 'přehled', 'hlavní'], cat: 'nav-dashboard' },
  { msg: 'Kde najdu prehled?', expect: ['dashboard', 'prehled', 'hlavni'], cat: 'nav-dashboard-nodiac' },
  { msg: 'Where is the dashboard?', expect: ['dashboard', 'main', 'přehled'], cat: 'nav-dashboard-en' },
  { msg: 'Kde najdu opakované faktury?', expect: ['opakov', 'recurring', 'šablon', 'sablon', 'faktur'], cat: 'nav-recurring' },
  { msg: 'Kde najdu opakovane faktury?', expect: ['opakov', 'recurring', 'sablon', 'faktur'], cat: 'nav-recurring-nodiac' },

  // ═══ GREETINGS / THANKS / BYE — 40+ ═══
  { msg: 'Ahoj', expect: ['ahoj', 'hyňa', 'asistent', 'pomoci', 'hello'], cat: 'greeting' },
  { msg: 'Čau', expect: ['ahoj', 'hyňa', 'asistent', 'pomoci', 'hello', 'čau'], cat: 'greeting' },
  { msg: 'Nazdar', expect: ['ahoj', 'hyňa', 'asistent', 'pomoci', 'hello'], cat: 'greeting' },
  { msg: 'Dobrý den', expect: ['ahoj', 'hyňa', 'asistent', 'pomoci', 'hello'], cat: 'greeting' },
  { msg: 'Dobry den', expect: ['ahoj', 'hyňa', 'asistent', 'pomoci', 'hello'], cat: 'greeting-nodiac' },
  { msg: 'Zdravím', expect: ['ahoj', 'hyňa', 'asistent', 'pomoci', 'hello'], cat: 'greeting' },
  { msg: 'Zdravim', expect: ['ahoj', 'hyňa', 'asistent', 'pomoci', 'hello'], cat: 'greeting-nodiac' },
  { msg: 'Hello', expect: ['hello', 'hyňa', 'assistant', 'help'], cat: 'greeting-en' },
  { msg: 'Hi', expect: ['hello', 'hyňa', 'assistant', 'help'], cat: 'greeting-en' },
  { msg: 'Hey', expect: ['hello', 'hyňa', 'assistant', 'help'], cat: 'greeting-en' },
  { msg: 'Good morning', expect: ['hello', 'hyňa', 'assistant', 'help', 'ahoj', 'asistent', 'shledanou', 'pomoci'], cat: 'greeting-en' },
  { msg: 'Díky', expect: ['nemáte zač', 'welcome', 'pomoct'], cat: 'thanks' },
  { msg: 'Diky', expect: ['nemáte zač', 'welcome', 'pomoct', 'nemate zac'], cat: 'thanks-nodiac' },
  { msg: 'Děkuji', expect: ['nemáte zač', 'welcome', 'pomoct'], cat: 'thanks' },
  { msg: 'Dekuji', expect: ['nemáte zač', 'welcome', 'pomoct', 'nemate zac'], cat: 'thanks-nodiac' },
  { msg: 'Thanks', expect: ['welcome', 'help', 'pomoct'], cat: 'thanks-en' },
  { msg: 'Thank you', expect: ['welcome', 'help', 'pomoct'], cat: 'thanks-en' },
  { msg: 'Na shledanou', expect: ['shledanou', 'goodbye', 'jsem tu'], cat: 'bye' },
  { msg: 'Nashle', expect: ['shledanou', 'goodbye', 'jsem tu', 'nashle'], cat: 'bye' },
  { msg: 'Sbohem', expect: ['shledanou', 'goodbye', 'jsem tu', 'sbohem'], cat: 'bye' },
  { msg: 'Bye', expect: ['goodbye', 'bye', 'jsem tu', 'here'], cat: 'bye-en' },
  { msg: 'Goodbye', expect: ['goodbye', 'bye', 'jsem tu', 'here'], cat: 'bye-en' },

  // ═══ HELP / META — 30+ ═══
  { msg: 'Co umíš?', expect: ['faktur', 'pomoci', 'klient', 'navigac', 'otáz'], cat: 'help' },
  { msg: 'Co umis?', expect: ['faktur', 'pomoci', 'klient', 'navigac', 'otaz'], cat: 'help-nodiac' },
  { msg: 'Jak mi můžeš pomoct?', expect: ['faktur', 'pomoci', 'klient', 'navigac', 'otáz'], cat: 'help' },
  { msg: 'Jak mi muzes pomoct?', expect: ['faktur', 'pomoci', 'klient', 'navigac', 'otaz'], cat: 'help-nodiac' },
  { msg: 'What can you do?', expect: ['invoice', 'help', 'client', 'navigat', 'question', 'hyňa', 'asistent', 'faktur'], cat: 'help-en' },
  { msg: 'Help', expect: ['help', 'pomoci', 'faktur', 'klient', 'hyňa', 'asistent'], cat: 'help-en' },
  { msg: 'Jak změním heslo?', expect: ['heslo', 'profil', 'password'], cat: 'password' },
  { msg: 'Jak zmenim heslo?', expect: ['heslo', 'profil', 'password'], cat: 'password-nodiac' },
  { msg: 'Zapomněl jsem heslo', expect: ['heslo', 'profil', 'password', 'reset'], cat: 'password' },
  { msg: 'Zapomnel jsem heslo', expect: ['heslo', 'profil', 'password', 'reset'], cat: 'password-nodiac' },
  { msg: 'How to change password?', expect: ['password', 'profile', 'heslo'], cat: 'password-en' },
  { msg: 'Forgot password', expect: ['password', 'reset', 'email'], cat: 'password-en' },

  // ═══ DATE — 15+ ═══
  { msg: 'Jaký je dnešní datum?', expect: ['datum', '2026', 'dnes', 'today'], cat: 'date' },
  { msg: 'Jaky je dnesni datum?', expect: ['datum', '2026', 'dnes', 'today'], cat: 'date-nodiac' },
  { msg: 'Jaký je dnes den?', expect: ['datum', '2026', 'dnes', 'today', 'den'], cat: 'date' },
  { msg: 'Kolikátého je?', expect: ['datum', '2026', 'dnes', 'today', 'den'], cat: 'date' },
  { msg: "What's today's date?", expect: ['date', '2026', 'today'], cat: 'date-en' },

  // ═══ STATUS / OVERVIEW — 15+ ═══
  { msg: 'Jaký je stav systému?', expect: ['faktur', 'klient', 'přehled', 'prehled', 'stav'], cat: 'status' },
  { msg: 'Jaky je stav systemu?', expect: ['faktur', 'klient', 'přehled', 'prehled', 'stav'], cat: 'status-nodiac' },
  { msg: 'Přehled', expect: ['faktur', 'klient', 'přehled', 'prehled', 'dashboard'], cat: 'status' },
  { msg: 'Prehled', expect: ['faktur', 'klient', 'přehled', 'prehled', 'dashboard'], cat: 'status-nodiac' },
  { msg: 'System overview', expect: ['invoice', 'client', 'overview', 'paid', 'faktur', 'klient', 'stav', 'správ', 'admin', 'superadmin', 'tenant'], cat: 'status-en' },
  { msg: 'Quick summary', expect: ['invoice', 'client', 'summary', 'paid', 'faktur', 'klient', 'shrn', 'dph', 'vat', 'souhrnné', 'hlášení'], cat: 'status-en' },
  { msg: 'Shrnutí', expect: ['faktur', 'klient', 'shrn', 'přehled'], cat: 'status' },
  { msg: 'Shrnuti', expect: ['faktur', 'klient', 'shrn', 'přehled', 'prehled'], cat: 'status-nodiac' },

  // ═══ RECEIVABLES / POHLEDÁVKY — 10+ ═══
  { msg: 'Jaké mám pohledávky?', expect: ['pohledáv', 'neuhraz', 'receivabl', 'faktur'], cat: 'receivables' },
  { msg: 'Jake mam pohledavky?', expect: ['pohledáv', 'neuhraz', 'receivabl', 'faktur'], cat: 'receivables-nodiac' },
  { msg: 'Pohledávky', expect: ['pohledáv', 'neuhraz', 'receivabl', 'faktur'], cat: 'receivables' },
  { msg: 'Pohledavky', expect: ['pohledáv', 'neuhraz', 'receivabl', 'faktur'], cat: 'receivables-nodiac' },
  { msg: 'Receivables', expect: ['receivabl', 'outstanding', 'pohledáv'], cat: 'receivables-en' },
  { msg: 'Kdo mi dluží?', expect: ['pohledáv', 'neuhraz', 'dluh', 'dluz', 'owe', 'faktur', 'klient'], cat: 'receivables' },
  { msg: 'Kdo mi dluzi?', expect: ['pohledáv', 'neuhraz', 'dluh', 'dluz', 'owe', 'faktur', 'klient'], cat: 'receivables-nodiac' },

  // ═══ COMPANY INFO — 10+ ═══
  { msg: 'Jaké jsou údaje o firmě?', expect: ['společnost', 'spolecnost', 'firma', 'ičo', 'ico', 'company', 'name', 'název'], cat: 'company' },
  { msg: 'Jake jsou udaje o firme?', expect: ['společnost', 'spolecnost', 'firma', 'ičo', 'ico', 'company', 'name', 'název', 'nazev'], cat: 'company-nodiac' },
  { msg: 'Info o naší firmě', expect: ['společnost', 'spolecnost', 'firma', 'ičo', 'ico', 'company'], cat: 'company' },
  { msg: 'Info o nasi firme', expect: ['společnost', 'spolecnost', 'firma', 'ičo', 'ico', 'company'], cat: 'company-nodiac' },
  { msg: 'Company info', expect: ['company', 'ico', 'vat', 'ičo', 'společnost', 'spolecnost', 'rainbow'], cat: 'company-en' },
  { msg: 'Naše IČO', expect: ['ičo', 'ico', 'společnost', 'firma', 'company'], cat: 'company' },
  { msg: 'Nase ICO', expect: ['ičo', 'ico', 'společnost', 'firma', 'company'], cat: 'company-nodiac' },

  // ═══ EDGE CASES — 20+ ═══
  { msg: '???', expect: ['konkrétn', 'specific', 'zkuste', 'try'], cat: 'edge' },
  { msg: '...', expect: ['konkrétn', 'specific', 'zkuste', 'try'], cat: 'edge' },
  { msg: 'asdfghjkl', expect: ['neznám', 'neznam', "don't know", 'sorry', 'omlouv', 'zaznamenán'], cat: 'edge-unknown' },
  { msg: 'xyzzy plugh', expect: ['neznám', 'neznam', "don't know", 'sorry', 'omlouv', 'zaznamenán'], cat: 'edge-unknown' },
  { msg: 'ztracený pomoc', expect: ['zkuste', 'try', 'zeptat', 'ask', 'problém'], cat: 'edge-confused' },
  { msg: 'ztraceny pomoc', expect: ['zkuste', 'try', 'zeptat', 'ask', 'problém', 'problem'], cat: 'edge-confused-nodiac' },
  { msg: "I'm confused", expect: ['try', 'ask', 'help', 'zkuste', 'zeptat', 'problém'], cat: 'edge-confused-en' },
  { msg: 'nevím co', expect: ['zkuste', 'try', 'zeptat', 'ask', 'pomoci'], cat: 'edge-confused' },
  { msg: 'nevim co', expect: ['zkuste', 'try', 'zeptat', 'ask', 'pomoci'], cat: 'edge-confused-nodiac' },
];

// CONVERSATION FLOWS — each { name, steps: [{msg, expect}] }
const conversationFlows = [
  // ═══ INVOICE FOLLOW-UPS — 40+ ═══
  { name: 'Inv→overdue', steps: [
    { msg: 'Kolik mám faktur?', expect: ['faktur'] },
    { msg: 'A kolik z nich je po splatnosti?', expect: ['splatnost', 'overdue', 'faktur'] },
  ]},
  { name: 'Inv→overdue-nodiac', steps: [
    { msg: 'Kolik mam faktur?', expect: ['faktur'] },
    { msg: 'A kolik z nich je po splatnosti?', expect: ['splatnost', 'overdue', 'faktur'] },
  ]},
  { name: 'Inv→paid', steps: [
    { msg: 'Kolik mám faktur?', expect: ['faktur'] },
    { msg: 'A kolik je zaplacených?', expect: ['zaplacen', 'uhrazen', 'paid', 'faktur'] },
  ]},
  { name: 'Inv→paid-nodiac', steps: [
    { msg: 'Kolik mam faktur?', expect: ['faktur'] },
    { msg: 'A kolik je zaplacenych?', expect: ['zaplacen', 'uhrazen', 'paid', 'faktur'] },
  ]},
  { name: 'Inv→draft', steps: [
    { msg: 'Kolik mám faktur?', expect: ['faktur'] },
    { msg: 'A kolik je konceptů?', expect: ['koncept', 'draft', 'rozpracov', 'faktur'] },
  ]},
  { name: 'Inv→biggest', steps: [
    { msg: 'Kolik mám faktur?', expect: ['faktur'] },
    { msg: 'Která je největší?', expect: ['faktur', 'největší', 'biggest'] },
  ]},
  { name: 'Inv→show', steps: [
    { msg: 'Mám nějaké neplacené faktury?', expect: ['faktur'] },
    { msg: 'Ukaž mi je', expect: ['faktur'] },
  ]},
  { name: 'Inv→show-nodiac', steps: [
    { msg: 'Mam nejake neplacene faktury?', expect: ['faktur'] },
    { msg: 'Ukaz mi je', expect: ['faktur'] },
  ]},
  { name: 'Inv→3step', steps: [
    { msg: 'Kolik mám faktur?', expect: ['faktur'] },
    { msg: 'A kolik je po splatnosti?', expect: ['splatnost', 'faktur'] },
    { msg: 'Ukaž mi je', expect: ['faktur'] },
  ]},
  { name: 'Inv→3step-nodiac', steps: [
    { msg: 'Kolik mam faktur?', expect: ['faktur'] },
    { msg: 'A kolik je po splatnosti?', expect: ['splatnost', 'faktur'] },
    { msg: 'Ukaz mi je', expect: ['faktur'] },
  ]},
  { name: 'Inv→a kolik', steps: [
    { msg: 'Jaké mám faktury po splatnosti?', expect: ['splatnost', 'faktur'] },
    { msg: 'A kolik?', expect: ['faktur'] },
  ]},
  { name: 'Inv→jo kolik', steps: [
    { msg: 'Mám nějaké rozepsané faktury?', expect: ['faktur', 'koncept', 'draft'] },
    { msg: 'Jo, a kolik celkem?', expect: ['faktur'] },
  ]},
  { name: 'Inv→ano', steps: [
    { msg: 'Kolik mám faktur?', expect: ['faktur'] },
    { msg: 'Ano, a kolik po splatnosti?', expect: ['splatnost', 'faktur'] },
  ]},
  { name: 'Overdue→show', steps: [
    { msg: 'Jaké faktury jsou po splatnosti?', expect: ['splatnost', 'faktur'] },
    { msg: 'Zobraz je', expect: ['faktur'] },
  ]},
  { name: 'Overdue→kolik', steps: [
    { msg: 'Jaké faktury jsou po splatnosti?', expect: ['splatnost', 'faktur'] },
    { msg: 'A kolik celkem?', expect: ['faktur'] },
  ]},
  { name: 'Inv→obrat', steps: [
    { msg: 'Kolik mám faktur?', expect: ['faktur'] },
    { msg: 'A jaký mám obrat?', expect: ['obrat', 'tržb', 'revenue', 'kč', 'czk', 'hodnot'] },
  ]},
  { name: 'Inv→měsíc', steps: [
    { msg: 'Kolik mám faktur?', expect: ['faktur'] },
    { msg: 'A kolik tento měsíc?', expect: ['měsíc', 'month', 'faktur'] },
  ]},
  { name: 'Inv→vice', steps: [
    { msg: 'Kolik mám faktur po splatnosti?', expect: ['splatnost', 'faktur'] },
    { msg: 'Řekni mi více', expect: ['faktur'] },
  ]},
  { name: 'Inv→en→overdue', steps: [
    { msg: 'How many invoices do I have?', expect: ['invoice', 'faktur'] },
    { msg: 'Show me the overdue ones', expect: ['overdue', 'invoice', 'splatnost', 'faktur'] },
  ]},
  { name: 'Inv→en→paid', steps: [
    { msg: 'How many invoices?', expect: ['invoice', 'faktur'] },
    { msg: 'How many are paid?', expect: ['paid', 'invoice', 'zaplacen', 'faktur'] },
  ]},

  // ═══ CLIENT FOLLOW-UPS — 20+ ═══
  { name: 'Cli→top', steps: [
    { msg: 'Kolik mám klientů?', expect: ['klient'] },
    { msg: 'Kteří jsou nejlepší?', expect: ['klient', 'obrat'] },
  ]},
  { name: 'Cli→top-nodiac', steps: [
    { msg: 'Kolik mam klientu?', expect: ['klient'] },
    { msg: 'Kteri jsou nejlepsi?', expect: ['klient', 'obrat'] },
  ]},
  { name: 'Cli→show', steps: [
    { msg: 'Kolik mám klientů?', expect: ['klient'] },
    { msg: 'Zobraz je', expect: ['klient'] },
  ]},
  { name: 'Cli→vice', steps: [
    { msg: 'Kolik mám klientů?', expect: ['klient'] },
    { msg: 'Co dál mohu zjistit?', expect: ['faktur', 'klient', 'pomoci', 'zeptat'] },
  ]},
  { name: 'Cli→en→top', steps: [
    { msg: 'How many clients?', expect: ['client', 'klient'] },
    { msg: 'Who are the best?', expect: ['client', 'klient', 'obrat', 'revenue'] },
  ]},

  // ═══ PRODUCT FOLLOW-UPS — 10+ ═══
  { name: 'Prod→show', steps: [
    { msg: 'Kolik mám produktů?', expect: ['produkt'] },
    { msg: 'Zobraz je', expect: ['produkt', 'služ', 'katalog'] },
  ]},
  { name: 'Prod→show-nodiac', steps: [
    { msg: 'Kolik mam produktu?', expect: ['produkt'] },
    { msg: 'Zobraz je', expect: ['produkt', 'služ', 'katalog'] },
  ]},
  { name: 'Prod→vice', steps: [
    { msg: 'Kolik mám produktů?', expect: ['produkt'] },
    { msg: 'Řekni mi více', expect: ['produkt'] },
  ]},

  // ═══ EVIDENCE FOLLOW-UPS — 10+ ═══
  { name: 'Ev→kolik', steps: [
    { msg: 'Kolik mám dokladů v evidenci?', expect: ['evidenc', 'doklad', 'záznam'] },
    { msg: 'A kolik celkem?', expect: ['evidenc', 'doklad', 'celk', 'záznam'] },
  ]},
  { name: 'Ev→kolik-nodiac', steps: [
    { msg: 'Kolik mam dokladu v evidenci?', expect: ['evidenc', 'doklad', 'záznam'] },
    { msg: 'A kolik celkem?', expect: ['evidenc', 'doklad', 'celk', 'záznam'] },
  ]},
  { name: 'Ev→show', steps: [
    { msg: 'Jaké mám výdaje?', expect: ['evidenc', 'výdaj', 'doklad', 'záznam'] },
    { msg: 'Zobraz je', expect: ['evidenc', 'výdaj', 'doklad', 'faktur'] },
  ]},

  // ═══ TOPIC SWITCHES (should NOT carry context) — 20+ ═══
  { name: 'Inv→clients (new topic)', steps: [
    { msg: 'Kolik mám faktur?', expect: ['faktur'] },
    { msg: 'A kolik klientů?', expect: ['klient'] },
  ]},
  { name: 'Inv→clients-nodiac (new topic)', steps: [
    { msg: 'Kolik mam faktur?', expect: ['faktur'] },
    { msg: 'A kolik klientu?', expect: ['klient'] },
  ]},
  { name: 'Cli→invoices (new topic)', steps: [
    { msg: 'Kolik mám klientů?', expect: ['klient'] },
    { msg: 'A kolik faktur?', expect: ['faktur'] },
  ]},
  { name: 'Inv→currency (independent)', steps: [
    { msg: 'Kolik mám faktur?', expect: ['faktur'] },
    { msg: 'Jaký je aktuální kurz eura?', expect: ['kurz', 'eur', 'rate', 'czk'] },
  ]},
  { name: 'Inv→currency-nodiac', steps: [
    { msg: 'Kolik mam faktur?', expect: ['faktur'] },
    { msg: 'Jaky je aktualni kurz eura?', expect: ['kurz', 'eur', 'rate', 'czk'] },
  ]},
  { name: 'Inv→settings (independent)', steps: [
    { msg: 'Kolik mám faktur?', expect: ['faktur'] },
    { msg: 'Kde najdu nastavení firmy?', expect: ['nastav', 'firma', 'company', 'setting', 'společ'] },
  ]},
  { name: 'Nav→follow', steps: [
    { msg: 'Kde najdu faktury?', expect: ['faktur'] },
    { msg: 'A klienty?', expect: ['klient'] },
  ]},
  { name: 'Nav→follow-nodiac', steps: [
    { msg: 'Kde najdu faktury?', expect: ['faktur'] },
    { msg: 'A klienty?', expect: ['klient'] },
  ]},

  // ═══ NON-FOLLOW-UPS (greetings/thanks/bye should never carry context) — 15+ ═══
  { name: 'Inv→ahoj', steps: [
    { msg: 'Kolik mám faktur?', expect: ['faktur'] },
    { msg: 'Ahoj', expect: ['ahoj', 'hello', 'hyňa', 'asistent', 'pomoci'] },
  ]},
  { name: 'Inv→díky', steps: [
    { msg: 'Kolik mám faktur?', expect: ['faktur'] },
    { msg: 'Díky', expect: ['nemáte zač', 'welcome', 'pomoct'] },
  ]},
  { name: 'Inv→diky-nodiac', steps: [
    { msg: 'Kolik mam faktur?', expect: ['faktur'] },
    { msg: 'Diky', expect: ['nemáte zač', 'welcome', 'pomoct', 'nemate zac'] },
  ]},
  { name: 'Inv→nashle', steps: [
    { msg: 'Kolik mám faktur?', expect: ['faktur'] },
    { msg: 'Na shledanou', expect: ['shledanou', 'goodbye', 'jsem tu'] },
  ]},
  { name: 'Inv→nashle-nodiac', steps: [
    { msg: 'Kolik mam faktur?', expect: ['faktur'] },
    { msg: 'Nashle', expect: ['shledanou', 'goodbye', 'jsem tu', 'nashle'] },
  ]},
  { name: 'Inv→dekuji', steps: [
    { msg: 'Kolik mám faktur?', expect: ['faktur'] },
    { msg: 'Děkuji', expect: ['nemáte zač', 'welcome', 'pomoct'] },
  ]},
  { name: 'Inv→thanks-en', steps: [
    { msg: 'How many invoices?', expect: ['invoice', 'faktur'] },
    { msg: 'Thanks', expect: ['welcome', 'help', 'nemáte zač', 'pomoct'] },
  ]},
  { name: 'Inv→bye-en', steps: [
    { msg: 'How many invoices?', expect: ['invoice', 'faktur'] },
    { msg: 'Bye', expect: ['goodbye', 'bye', 'here', 'shledanou', 'jsem tu'] },
  ]},

  // ═══ OBRAT/REVENUE FOLLOW-UPS — 10+ ═══
  { name: 'Obrat→vice', steps: [
    { msg: 'Jaký mám obrat?', expect: ['obrat', 'tržb', 'revenue', 'kč', 'czk', 'hodnot'] },
    { msg: 'Řekni mi více', expect: ['obrat', 'faktur', 'tržb', 'revenue', 'kč', 'czk'] },
  ]},
  { name: 'Obrat→vice-nodiac', steps: [
    { msg: 'Jaky mam obrat?', expect: ['obrat', 'tržb', 'revenue', 'kč', 'czk', 'hodnot'] },
    { msg: 'Rekni mi vice', expect: ['obrat', 'faktur', 'tržb', 'revenue', 'kč', 'czk'] },
  ]},

  // ═══ 4+ STEP CHAINS — 5+ ═══
  { name: '4-step invoice chain', steps: [
    { msg: 'Kolik mám faktur?', expect: ['faktur'] },
    { msg: 'A kolik je po splatnosti?', expect: ['splatnost', 'faktur'] },
    { msg: 'Ukaž mi je', expect: ['faktur'] },
    { msg: 'A kolik je zaplacených?', expect: ['zaplacen', 'paid', 'faktur'] },
  ]},
  { name: '4-step client chain', steps: [
    { msg: 'Kolik mám klientů?', expect: ['klient'] },
    { msg: 'Kteří jsou nejlepší?', expect: ['klient', 'obrat'] },
    { msg: 'A kolik celkem?', expect: ['klient', 'faktur'] },
    { msg: 'Díky', expect: ['nemáte zač', 'welcome', 'pomoct'] },
  ]},
  { name: '5-step mixed chain', steps: [
    { msg: 'Kolik mám faktur?', expect: ['faktur'] },
    { msg: 'A kolik klientů?', expect: ['klient'] },
    { msg: 'Kteří jsou nejlepší?', expect: ['klient', 'obrat'] },
    { msg: 'A kolik mám produktů?', expect: ['produkt'] },
    { msg: 'Díky za info', expect: ['nemáte zač', 'welcome', 'pomoct'] },
  ]},
];

// AI REASONING TEST — questions without exact knowledge base match, AI should figure out
const aiReasoningQuestions = [
  // Should use smartReason or knowledge base fuzzy matching
  { msg: 'Moje pohledávky', expect: ['pohledáv', 'neuhraz', 'faktur', 'dluh'], cat: 'ai-receivables' },
  { msg: 'Moje pohledavky', expect: ['pohledáv', 'neuhraz', 'faktur', 'dluh'], cat: 'ai-receivables-nodiac' },
  { msg: 'Co mi kdo dluží?', expect: ['pohledáv', 'neuhraz', 'faktur', 'dluh', 'dluz'], cat: 'ai-debt' },
  { msg: 'Co mi kdo dluzi?', expect: ['pohledáv', 'neuhraz', 'faktur', 'dluh', 'dluz'], cat: 'ai-debt-nodiac' },
  { msg: 'Přehled financí', expect: ['faktur', 'klient', 'přehled', 'stav'], cat: 'ai-finance' },
  { msg: 'Prehled financi', expect: ['faktur', 'klient', 'přehled', 'stav', 'prehled'], cat: 'ai-finance-nodiac' },
  { msg: 'Celkový stav', expect: ['faktur', 'klient', 'přehled', 'stav'], cat: 'ai-overview' },
  { msg: 'Celkovy stav', expect: ['faktur', 'klient', 'přehled', 'stav', 'prehled'], cat: 'ai-overview-nodiac' },
  { msg: 'Firemní údaje', expect: ['společnost', 'spolecnost', 'firma', 'ičo', 'ico', 'company'], cat: 'ai-company' },
  { msg: 'Firemni udaje', expect: ['společnost', 'spolecnost', 'firma', 'ičo', 'ico', 'company'], cat: 'ai-company-nodiac' },
  { msg: 'Jak na účtování?', expect: ['účetnictví', 'ucetnictvi', 'account', 'faktur', 'deník', 'denik', 'účet'], cat: 'ai-accounting' },
  { msg: 'Jak na uctovani?', expect: ['účetnictví', 'ucetnictvi', 'account', 'faktur', 'deník', 'denik', 'účet', 'ucet'], cat: 'ai-accounting-nodiac' },
  { msg: 'Hledat fakturu', expect: ['faktur', 'hledat', 'vyhled', 'search', 'filtr'], cat: 'ai-search-inv' },
  { msg: 'Hledat fakturu', expect: ['faktur', 'hledat', 'vyhled', 'search', 'filtr'], cat: 'ai-search-inv' },
  { msg: 'Odeslat fakturu emailem', expect: ['faktur', 'email', 'odeslat', 'send', 'poslat'], cat: 'ai-email-inv' },
  { msg: 'Odeslat fakturu emailem', expect: ['faktur', 'email', 'odeslat', 'send', 'poslat'], cat: 'ai-email-inv' },
  { msg: 'Export do PDF', expect: ['pdf', 'export', 'tisk', 'stáhn', 'stahn'], cat: 'ai-export' },
  { msg: 'Jak exportuji faktury?', expect: ['faktur', 'export', 'pdf', 'csv'], cat: 'ai-export-inv' },
  { msg: 'DPH přiznání', expect: ['dph', 'vat', 'přizná', 'prizna', 'daň', 'dan'], cat: 'ai-vat' },
  { msg: 'DPH priznani', expect: ['dph', 'vat', 'přizná', 'prizna', 'daň', 'dan'], cat: 'ai-vat-nodiac' },
  { msg: 'Jak párovat platby?', expect: ['párov', 'parov', 'platb', 'bank', 'match', 'transak'], cat: 'ai-matching' },
  { msg: 'Jak parovat platby?', expect: ['párov', 'parov', 'platb', 'bank', 'match', 'transak'], cat: 'ai-matching-nodiac' },
  { msg: 'Import bankovního výpisu', expect: ['bank', 'import', 'výpis', 'vypis', 'transak'], cat: 'ai-bank-import' },
  { msg: 'Import bankovniho vypisu', expect: ['bank', 'import', 'výpis', 'vypis', 'transak'], cat: 'ai-bank-import-nodiac' },
  { msg: 'Opakované fakturace', expect: ['opakov', 'recurring', 'faktur', 'šablon', 'sablon', 'automat'], cat: 'ai-recurring' },
  { msg: 'Opakovane fakturace', expect: ['opakov', 'recurring', 'faktur', 'šablon', 'sablon', 'automat'], cat: 'ai-recurring-nodiac' },
  { msg: 'Jak udělám dobropis?', expect: ['dobropis', 'credit', 'storno', 'faktur'], cat: 'ai-credit-note' },
  { msg: 'Jak udelam dobropis?', expect: ['dobropis', 'credit', 'storno', 'faktur'], cat: 'ai-credit-note-nodiac' },
  { msg: 'Zálohová faktura', expect: ['záloho', 'zaloho', 'proforma', 'faktur'], cat: 'ai-proforma' },
  { msg: 'Zalohova faktura', expect: ['záloho', 'zaloho', 'proforma', 'faktur'], cat: 'ai-proforma-nodiac' },
  { msg: 'Tisk faktury', expect: ['tisk', 'pdf', 'faktur', 'print', 'export'], cat: 'ai-print' },
  { msg: 'Jaký formát faktur?', expect: ['faktur', 'formát', 'format', 'šablon', 'sablon', 'pdf', 'template'], cat: 'ai-format' },
  { msg: 'Jaky format faktur?', expect: ['faktur', 'formát', 'format', 'šablon', 'sablon', 'pdf', 'template'], cat: 'ai-format-nodiac' },
  { msg: 'Nastavení daní', expect: ['daň', 'dan', 'dph', 'vat', 'nastav', 'sazb'], cat: 'ai-tax' },
  { msg: 'Nastaveni dani', expect: ['daň', 'dan', 'dph', 'vat', 'nastav', 'sazb'], cat: 'ai-tax-nodiac' },
  { msg: 'Správa rolí uživatelů', expect: ['role', 'uživatel', 'uzivatel', 'oprávnění', 'opravneni', 'správ'], cat: 'ai-roles' },
  { msg: 'Sprava roli uzivatelu', expect: ['role', 'uživatel', 'uzivatel', 'oprávnění', 'opravneni', 'správ', 'sprav'], cat: 'ai-roles-nodiac' },
  { msg: 'Jak pozvat nového uživatele?', expect: ['uživatel', 'uzivatel', 'pozvat', 'invite', 'přidat', 'pridat', 'registr'], cat: 'ai-invite' },
  { msg: 'Jak pozvat noveho uzivatele?', expect: ['uživatel', 'uzivatel', 'pozvat', 'invite', 'přidat', 'pridat', 'registr'], cat: 'ai-invite-nodiac' },
  { msg: 'Co je to variabilní symbol?', expect: ['variabilní', 'variabilni', 'symbol', 'číslo', 'cislo', 'identifik', 'platb'], cat: 'ai-vs' },
  { msg: 'Co je to variabilni symbol?', expect: ['variabilní', 'variabilni', 'symbol', 'číslo', 'cislo', 'identifik', 'platb'], cat: 'ai-vs-nodiac' },
  { msg: 'Jak funguje automatické číslování?', expect: ['čísl', 'cisl', 'automat', 'sekvenc', 'faktur', 'format'], cat: 'ai-numbering' },
  { msg: 'Jak funguje automaticke cislovani?', expect: ['čísl', 'cisl', 'automat', 'sekvenc', 'faktur', 'format'], cat: 'ai-numbering-nodiac' },
  { msg: 'Stárnutí pohledávek', expect: ['stárnutí', 'starnuti', 'pohledáv', 'pohledav', 'aging', 'splatnost'], cat: 'ai-aging' },
  { msg: 'Starnuti pohledavek', expect: ['stárnutí', 'starnuti', 'pohledáv', 'pohledav', 'aging', 'splatnost'], cat: 'ai-aging-nodiac' },
  { msg: 'Timeout co to je?', expect: ['timeout', 'časový', 'casovy', 'přihlás', 'prihlas', 'session', 'vyprš'], cat: 'ai-timeout' },
  { msg: 'Chyba 404', expect: ['404', 'nenalezen', 'not found', 'stránk', 'strank', 'neexist'], cat: 'ai-404' },
  { msg: 'Multitenant co to je?', expect: ['tenant', 'organizac', 'firm', 'společnost', 'spolecnost', 'multi'], cat: 'ai-tenant' },
  { msg: 'Jak nahrát logo?', expect: ['logo', 'nahrát', 'nahrat', 'obrázek', 'obrazek', 'upload', 'nastav'], cat: 'ai-logo' },
  { msg: 'Jak nahrat logo?', expect: ['logo', 'nahrát', 'nahrat', 'obrázek', 'obrazek', 'upload', 'nastav'], cat: 'ai-logo-nodiac' },
];

// ─── MULTIPLY TEST DATA ────────────────────────────────────────
// To reach 10,000+ we multiply each test with slight variations

function generateVariations(questions) {
  const variations = [];
  const prefixes = ['', 'Prosím ', 'Prosim ', 'Zajímá mě ', 'Potřebuji ', 'Chtěl bych '];
  const suffixes = ['', '?', '.', ' prosím', ' prosim', ' ?', '..'];

  for (const q of questions) {
    // Original
    variations.push(q);
    // With prefix/suffix combinations
    for (const prefix of prefixes) {
      for (const suffix of suffixes) {
        if (prefix === '' && suffix === '') continue; // skip duplicate
        variations.push({
          ...q,
          msg: prefix + q.msg.replace(/[?.!]$/, '') + suffix,
          cat: q.cat + '-var'
        });
      }
    }
  }
  return variations;
}

function multiplyConversations(flows) {
  const result = [];
  const firstStepPrefixes = ['', 'Prosím ', 'Chtěl bych vědět ', 'Potřebuji vědět ', 'Zajímá mě '];

  for (const flow of flows) {
    // Original
    result.push(flow);
    // With prefixed first step
    for (const prefix of firstStepPrefixes.slice(1)) {
      const newSteps = [...flow.steps];
      newSteps[0] = { ...newSteps[0], msg: prefix + newSteps[0].msg.replace(/[?.!]$/, '') + '?' };
      result.push({ name: flow.name + '-prefixed', steps: newSteps });
    }
  }
  return result;
}

// ─── MAIN ──────────────────────────────────────────────────────

async function runTests() {
  console.log('Logging in...');
  const login = await post('/api/auth/login', { username: 'admin', password: 'admin123' });
  if (!login.token) { console.error('Login failed:', login); process.exit(1); }
  const token = login.token;

  let totalPass = 0, totalFail = 0;
  const failures = [];
  const catStats = {};

  function recordResult(cat, passed, detail) {
    if (!catStats[cat]) catStats[cat] = { pass: 0, fail: 0 };
    if (passed) {
      catStats[cat].pass++;
      totalPass++;
    } else {
      catStats[cat].fail++;
      totalFail++;
      failures.push(detail);
    }
  }

  // Generate expanded test sets
  const allStandalone = generateVariations(standaloneQuestions);
  const allAI = generateVariations(aiReasoningQuestions);
  const allConvs = multiplyConversations(conversationFlows);

  const totalTests = allStandalone.length + allAI.length + allConvs.reduce((sum, c) => sum + c.steps.length, 0);
  console.log(`\nTest breakdown:`);
  console.log(`  Standalone questions: ${allStandalone.length}`);
  console.log(`  AI reasoning questions: ${allAI.length}`);
  console.log(`  Conversation flows: ${allConvs.length} (${allConvs.reduce((s,c) => s + c.steps.length, 0)} steps)`);
  console.log(`  TOTAL: ${totalTests} assertions\n`);

  // Run in batches with concurrency
  const BATCH_SIZE = 100;

  // ═══ STANDALONE TESTS ═══
  console.log('Running standalone tests...');
  for (let i = 0; i < allStandalone.length; i += BATCH_SIZE) {
    const batch = allStandalone.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(q =>
      post('/api/chatbot/message', { message: q.msg }, token)
        .then(res => ({ q, res }))
        .catch(err => ({ q, error: err.message }))
    ));
    for (const { q, res, error } of results) {
      if (error) {
        recordResult(q.cat, false, { msg: q.msg, expected: q.expect, got: 'ERROR: ' + error });
        continue;
      }
      const ans = (res.answer || '').toLowerCase();
      const ok = q.expect.some(e => ans.includes(e.toLowerCase()));
      recordResult(q.cat, ok, ok ? null : { msg: q.msg, expected: q.expect, got: (res.answer || '').substring(0, 120) });
    }
    if ((i + BATCH_SIZE) % 200 === 0 || i + BATCH_SIZE >= allStandalone.length) {
      process.stdout.write(`  ${Math.min(i + BATCH_SIZE, allStandalone.length)}/${allStandalone.length}\r`);
    }
  }
  console.log(`  Standalone: ${totalPass}/${totalPass + totalFail} passed`);

  // ═══ AI REASONING TESTS ═══
  const aiStartPass = totalPass;
  const aiStartFail = totalFail;
  console.log('Running AI reasoning tests...');
  for (let i = 0; i < allAI.length; i += BATCH_SIZE) {
    const batch = allAI.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(q =>
      post('/api/chatbot/message', { message: q.msg }, token)
        .then(res => ({ q, res }))
        .catch(err => ({ q, error: err.message }))
    ));
    for (const { q, res, error } of results) {
      if (error) {
        recordResult(q.cat, false, { msg: q.msg, expected: q.expect, got: 'ERROR: ' + error });
        continue;
      }
      const ans = (res.answer || '').toLowerCase();
      const ok = q.expect.some(e => ans.includes(e.toLowerCase()));
      recordResult(q.cat, ok, ok ? null : { msg: q.msg, expected: q.expect, got: (res.answer || '').substring(0, 120) });
    }
  }
  const aiPass = totalPass - aiStartPass;
  const aiFail = totalFail - aiStartFail;
  console.log(`  AI reasoning: ${aiPass}/${aiPass + aiFail} passed`);

  // ═══ CONVERSATION TESTS ═══
  const convStartPass = totalPass;
  const convStartFail = totalFail;
  console.log('Running conversation flow tests...');
  for (let ci = 0; ci < allConvs.length; ci++) {
    const conv = allConvs[ci];
    let convId = null;
    for (let si = 0; si < conv.steps.length; si++) {
      const step = conv.steps[si];
      try {
        const res = await post('/api/chatbot/message', { message: step.msg, conversation_id: convId }, token);
        convId = res.conversation_id;
        const ans = (res.answer || '').toLowerCase();
        const ok = step.expect.some(e => ans.includes(e.toLowerCase()));
        const cat = conv.name + (si > 0 ? '-followup' : '-init');
        recordResult(cat, ok, ok ? null : { msg: `[${conv.name} s${si+1}] ${step.msg}`, expected: step.expect, got: (res.answer || '').substring(0, 120) });
      } catch (err) {
        recordResult(conv.name, false, { msg: `[${conv.name} s${si+1}] ${step.msg}`, expected: step.expect, got: 'ERROR: ' + err.message });
      }
    }
    if ((ci + 1) % 20 === 0 || ci + 1 === allConvs.length) {
      process.stdout.write(`  ${ci + 1}/${allConvs.length} flows\r`);
    }
  }
  const convPass = totalPass - convStartPass;
  const convFail = totalFail - convStartFail;
  console.log(`  Conversations: ${convPass}/${convPass + convFail} passed`);

  // ═══ RESULTS ═══
  console.log('\n' + '═'.repeat(60));
  console.log(`TOTAL: ${totalPass}/${totalPass + totalFail} passed (${((totalPass / (totalPass + totalFail)) * 100).toFixed(1)}%)`);
  console.log('═'.repeat(60));

  if (failures.length > 0) {
    // Deduplicate failures by original message (strip prefixes/suffixes)
    const uniqueFailures = new Map();
    for (const f of failures) {
      if (!f) continue;
      const key = f.msg.replace(/^(Prosím |Prosim |Potřebuji vědět |Zajímá mě |Rád bych věděl |Chtěl bych vědět )/i, '').replace(/[?.! ]*(prosím|prosim|díky|diky)?$/i, '').trim();
      if (!uniqueFailures.has(key)) {
        uniqueFailures.set(key, { ...f, count: 1 });
      } else {
        uniqueFailures.get(key).count++;
      }
    }

    console.log(`\nUNIQUE FAILURES: ${uniqueFailures.size}`);
    console.log('-'.repeat(60));
    for (const [key, f] of [...uniqueFailures.entries()].sort((a,b) => b[1].count - a[1].count)) {
      console.log(`  [x${f.count}] "${f.msg}"`);
      console.log(`    Expected: ${f.expected.join('|')}`);
      console.log(`    Got: ${f.got}`);
    }
  }

  // Category summary
  const catSummary = {};
  for (const [cat, stats] of Object.entries(catStats)) {
    const baseCat = cat.replace(/-var$/, '').replace(/-init$/, '').replace(/-followup$/, '').replace(/-prefixed.*/, '');
    if (!catSummary[baseCat]) catSummary[baseCat] = { pass: 0, fail: 0 };
    catSummary[baseCat].pass += stats.pass;
    catSummary[baseCat].fail += stats.fail;
  }

  const failedCats = Object.entries(catSummary).filter(([, s]) => s.fail > 0).sort((a, b) => b[1].fail - a[1].fail);
  if (failedCats.length > 0) {
    console.log(`\nFAILING CATEGORIES:`);
    for (const [cat, stats] of failedCats) {
      console.log(`  ${cat}: ${stats.pass}/${stats.pass + stats.fail} (${stats.fail} failures)`);
    }
  }

  process.exit(totalFail > 0 ? 1 : 0);
}

runTests().catch(err => { console.error('Fatal:', err); process.exit(1); });
