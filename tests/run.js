// HomeCashbacks site tests.  Run from the repo root:  npm test
// One-time setup on your computer:  cd tests && npm install && npx playwright install chromium
//
// What it does: builds the site, serves dist/ locally, then checks every page and every feature in a
// real browser (phone-sized screen). Exit code is non-zero if anything fails.
const fs = require('fs'), path = require('path'), http = require('http'), { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function loadPlaywright() {
  const tries = [path.join(__dirname, 'node_modules/playwright'), process.env.PLAYWRIGHT_PATH, '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { /* next */ } }
  console.error('Playwright not found. Run: cd tests && npm install && npx playwright install chromium'); process.exit(2);
}

let pass = 0, fail = 0; const failures = [], warnings = [];
const ok = (cond, msg) => { if (cond) pass++; else { fail++; failures.push(msg); console.log('  FAIL', msg); } };
const section = (t) => console.log('\n== ' + t);

// ---- static server for dist/ (serves "/foo" as foo.html like Netlify does)
function serve() {
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.txt': 'text/plain', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.json': 'application/json' };
  return new Promise(resolve => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
      if (p === '/') p = '/Index.html';
      let f = path.join(DIST, p);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = f + '.html';
      if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
    }).listen(0, () => resolve({ s, base: 'http://localhost:' + s.address().port }));
  });
}

(async () => {
  // ---------------------------------------------------------------- build
  section('Build');
  let buildLog = '';
  try { buildLog = execSync('node build.js', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); ok(true, 'build'); }
  catch (e) { ok(false, 'build failed: ' + (e.stderr || e.message).split('\n')[0]); process.exit(1); }
  const htmlFiles = fs.readdirSync(DIST).filter(f => f.endsWith('.html'));
  const read = f => fs.readFileSync(path.join(DIST, f), 'utf8');
  const isNoindex = f => /<meta[^>]+name="robots"[^>]+noindex/i.test(read(f));
  const indexable = htmlFiles.filter(f => f !== '404.html' && !isNoindex(f));
  console.log('  pages built:', htmlFiles.length, '| indexable:', indexable.length);

  // ---------------------------------------------------------------- static checks
  section('Sitemap, canonical and share image');
  const sm = read('sitemap.xml');
  const locs = [...sm.matchAll(/<loc>([^<]*)<\/loc>/g)].map(m => m[1]);
  ok(/^<\?xml/.test(sm) && sm.includes('</urlset>'), 'sitemap is well-formed');
  ok(new Set(locs).size === locs.length, 'sitemap has no duplicate URLs');
  const want = indexable.map(f => 'https://homecashbacks.ca/' + (f === 'Index.html' ? '' : f));
  ok(want.every(u => locs.includes(u)), 'every indexable page is in the sitemap ' + want.filter(u => !locs.includes(u)).join(','));
  ok(locs.every(u => want.includes(u)), 'sitemap lists only real, indexable pages ' + locs.filter(u => !want.includes(u)).join(','));
  ok(fs.existsSync(path.join(DIST, 'og-image.png')), 'og-image.png is published');
  indexable.forEach(f => {
    const h = read(f);
    ok(/<link rel="canonical"/.test(h), f + ': has canonical');
    ok(/property="og:image"/.test(h), f + ': has og:image');
    ok((h.match(/<title>/g) || []).length === 1, f + ': exactly one <title>');
  });
  ok(/\*\.avif/.test(fs.readFileSync(path.join(ROOT, '_headers'), 'utf8')), '_headers caches .avif');

  // ---------------------------------------------------------------- browser
  const pw = loadPlaywright();
  const { s: server, base } = await serve();
  let browser;
  try { browser = await pw.chromium.launch(); } catch (e) { browser = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' }); }
  const open = async (w = 390, init) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
    if (init) await ctx.addInitScript(init);
    const p = await ctx.newPage();
    await p.route(u => !u.href.startsWith(base) && !u.href.includes('api.hsforms.com'), r => r.abort());   // no external sites
    await p.route('**/api.hsforms.com/**', r => r.fulfill({ status: 200, body: '{}' }));
    p._ctx = ctx; return p;
  };

  section('Every page on a phone-sized screen');
  const allowedMissing = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, 'known-issues.json'), 'utf8')).allowedFailedRequests);
  for (const f of htmlFiles) {
    const p = await open(390); const errs = [], fails = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) fails.push(f + ':' + r.url().replace(base, '')); });
    try {
      await p.goto(base + '/' + f, { waitUntil: 'load' }); await p.waitForTimeout(120);
      ok(!errs.length, f + ': no script errors ' + errs.join(' | '));
      const newFails = fails.filter(x => !allowedMissing.has(x)); ok(!newFails.length, f + ': no missing local files ' + newFails.join(','));
      ok((await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, f + ': no sideways scrolling @390px');
      if (f !== '404.html') ok((await p.locator('h1').count()) === 1, f + ': exactly one H1');
      ok(await p.evaluate(() => { try { openModal(); const o = document.getElementById('modal').classList.contains('open'); closeModal(); return o; } catch (e) { return false; } }), f + ': booking pop-up opens');
    } catch (e) { ok(false, f + ': test error ' + e.message.split('\n')[0]); }
    await p._ctx.close();
  }

  section('Internal links (warnings only)');
  const exists = u => { const clean = u.split('#')[0].split('?')[0]; if (!clean || clean === '/') return true; const rel = clean.replace(/^\//, ''); return fs.existsSync(path.join(DIST, rel)) || fs.existsSync(path.join(DIST, rel + '.html')) || redirects.has('/' + rel.replace(/\.html$/, '')); };
  const redirects = new Set((fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').match(/^\/\S+/gm) || []).map(x => x.replace(/\.html$/, '')));
  const broken = new Set();
  htmlFiles.forEach(f => [...read(f).matchAll(/<a [^>]*href="(\/[^"#?]*)/g)].forEach(m => { if (!exists(m[1])) broken.add(f + ' -> ' + m[1]); }));
  if (broken.size) { warnings.push(broken.size + ' broken internal link(s)'); console.log('  WARN broken internal links:'); [...broken].slice(0, 25).forEach(x => console.log('    ' + x)); } else console.log('  none');

  section('Legal page');
  let p = await open(); await p.goto(base + '/cashback-legal-ontario.html');
  const t = await p.title(); const h1 = await p.textContent('h1');
  ok(/Cash Back Realtor/i.test(t) && /Cashback/i.test(t), 'title has both spellings: ' + t);
  ok(/Cash Back Realtor/i.test(h1) && /Cashback/i.test(h1), 'H1 has both spellings');
  ok(/cash back realtor/i.test(await p.getAttribute('meta[name=description]', 'content')), 'meta description targets "cash back realtor"');
  ok((await p.$$eval('script[type="application/ld+json"]', els => els.every(e => { try { JSON.parse(e.textContent); return true; } catch (x) { return false; } }))), 'JSON-LD valid');
  await p._ctx.close();

  section('Toronto city page');
  p = await open(); await p.goto(base + '/toronto-cashback-realtor.html');
  ok(/^Cash back realtor Toronto/.test((await p.textContent('h1')).trim()), 'H1 is "Cash back realtor Toronto"');
  const rows = await p.$$eval('#local-facts tbody tr', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
  ok(rows.length === 4, 'local-facts table has 4 rows');
  const calc = pr => Math.round((pr * 0.025 - 4999) / 100) * 100;      // 2.5% commission less flat $4,999 fee
  ok(rows[0].includes('$' + calc(600000).toLocaleString('en-US')) && rows[3].includes('$' + calc(1700000).toLocaleString('en-US')), 'table amounts match the cashback formula');
  const hrefs = await p.$$eval('#local-facts a', a => a.map(x => x.getAttribute('href'))); ok(hrefs.every(h => fs.existsSync(path.join(DIST, h))), 'table links point to real pages');
  ok((await p.locator('#local-facts p:has-text("Recent deals")').count()) === 0, 'no empty "Recent deals" line (fill localFacts.comps in data/cities.json to show it)');
  await p._ctx.close();
  p = await open(); await p.goto(base + '/mississauga-cashback-realtor.html');
  ok(/Buy in Mississauga/.test(await p.textContent('h1')) && (await p.locator('#local-facts').count()) === 0, 'other cities keep the old H1 and no local-facts block');
  await p._ctx.close();

  section('Homepage hero');
  for (const w of [390, 1280]) {
    p = await open(w); await p.goto(base + '/Index.html'); await p.waitForTimeout(300);
    const img = await p.evaluate(() => { const i = document.querySelector('.hero-bg img'); return { src: i.currentSrc.split('/').pop(), nw: i.naturalWidth, fp: i.getAttribute('fetchpriority'), lazy: i.getAttribute('loading') }; });
    ok(img.nw > 0 && img.fp === 'high' && img.lazy === null, 'hero image loads, high priority, not lazy @' + w);
    ok(img.src === (w === 390 ? 'hero-home-800.avif' : 'hero-home.avif'), 'hero picks the right size @' + w + ' (' + img.src + ')');
    await p._ctx.close();
  }

  section('Booking pop-up: form, tracking, A/B test');
  for (const v of ['A', 'B']) {
    p = await open(390, `localStorage.setItem('hc_ab_vs-traditional-cta','${v}')`);
    const posts = [], hs = []; p.on('request', r => { if (r.method() === 'POST') { if (r.url().startsWith(base)) posts.push(r.postData()); if (r.url().includes('hsforms')) hs.push(JSON.parse(r.postData())); } });
    await p.goto(base + '/cashback-realtor-vs-traditional.html'); await p.waitForTimeout(250);
    const btn = (await p.textContent('[data-ab-cta]')).trim();
    ok(v === 'A' ? btn === 'Book a Free Consultation →' : btn === "See How Much Cashback You'd Get →", 'variant ' + v + ' shows its own button text');
    await p.click('[data-ab-cta]');
    await p.click('#f-submit'); ok((await p.textContent('#err-name')).length > 0 && (await p.textContent('#err-contact')).length > 0, v + ': empty form shows errors'); ok(posts.length === 0 && hs.length === 0, v + ': empty form sends nothing');
    await p.fill('#f-name', 'Mohammad Reza'); await p.fill('#f-lastname', 'Ali Akbari'); await p.fill('#f-email', 'bad'); await p.fill('#f-phone', '4165551234'); await p.click('#f-submit');
    ok(/valid email/.test(await p.textContent('#err-contact')), v + ': bad email rejected');
    await p.fill('#f-email', 'qa+test@example.com'); await p.fill('#f-phone', '123'); await p.click('#f-submit'); ok(/10 digits/.test(await p.textContent('#err-contact')), v + ': short phone rejected');
    await p.fill('#f-phone', '416-555-1234'); await p.check('#f-optin'); await p.fill('#f-note', 'Looking for a $1M condo'); await p.click('#f-submit'); await p.waitForTimeout(600);
    ok(await p.isVisible('#form-success'), v + ': success message shown');
    ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'form-success'), v + ': focus moves to the success message');
    ok(posts.length === 1 && /firstname=Mohammad\+Reza/.test(posts[0]) && /lastname=Ali\+Akbari/.test(posts[0]) && /marketing_updates=yes/.test(posts[0]), v + ': Netlify form gets separate first/last name and opt-in');
    const f = Object.fromEntries((hs[0]?.fields || []).map(x => [x.name, x.value]));
    ok(f.firstname === 'Mohammad Reza' && f.lastname === 'Ali Akbari' && f.market_updates_optin === 'true' && /buyer \| \/cashback-realtor-vs-traditional/.test(f.lead_source) && hs[0].legalConsentOptions.consent.communications[0].value === true, v + ': HubSpot payload correct');
    const evs = await p.evaluate(() => (window.dataLayer || []).filter(a => a[0] === 'event').map(a => ({ n: a[1], v: a[2] && a[2].ab_variant })));
    ['ab_exposure', 'modal_open', 'qualify_lead'].forEach(n => ok(evs.some(e => e.n === n && e.v === 'vs-traditional-cta:' + v), v + ': ' + n + ' carries the variant'));
    ok(evs.filter(e => e.n === 'ab_exposure').length === 1, v + ': ab_exposure fires once');
    await p._ctx.close();
  }
  p = await open(); const hs2 = []; p.on('request', r => { if (r.url().includes('hsforms')) hs2.push(JSON.parse(r.postData())); });
  await p.goto(base + '/Index.html'); await p.evaluate(() => openModal()); await p.fill('#f-name', 'A'); await p.fill('#f-lastname', 'B'); await p.fill('#f-email', 'a@b.co'); await p.fill('#f-phone', '4165551234'); await p.click('#f-submit'); await p.waitForTimeout(500);
  ok(hs2[0]?.legalConsentOptions.consent.communications[0].value === false && Object.fromEntries(hs2[0].fields.map(x => [x.name, x.value])).market_updates_optin === 'false', 'unticked opt-in is sent as false'); await p._ctx.close();
  p = await open(); const ev3 = []; await p.exposeFunction('__e', n => ev3.push(n)); await p.addInitScript(() => { const d = window.dataLayer = window.dataLayer || []; const o = d.push.bind(d); d.push = function (a) { try { window.__e(a[1]); } catch (e) {} return o(a); }; });
  await p.goto(base + '/guides.html'); await p.waitForTimeout(200); ok(!ev3.includes('ab_exposure'), 'A/B test is off on other pages'); await p._ctx.close();

  section('Pop-up accessibility');
  p = await open(); await p.goto(base + '/guides.html'); await p.waitForTimeout(150);
  const opener = p.locator('.foot-cta-btn, .btn-primary, .top-btn').first(); await opener.focus(); await p.evaluate(() => { window.__op = document.activeElement; openModal(); });
  ok(await p.evaluate(() => { const d = document.querySelector('#modal .modal'); return d.getAttribute('role') === 'dialog' && d.getAttribute('aria-modal') === 'true' && !!d.getAttribute('aria-labelledby'); }), 'dialog has role, aria-modal and a label');
  ok(await p.evaluate(() => !!document.querySelector('#modal .modal').contains(document.activeElement)), 'focus moves into the dialog on open');
  ok((await p.getAttribute('.modal-close', 'aria-label')) === 'Close dialog', 'close button has an accessible name');
  let stayed = true; for (let i = 0; i < 14; i++) { await p.keyboard.press('Tab'); stayed = stayed && await p.evaluate(() => document.querySelector('#modal .modal').contains(document.activeElement)); } ok(stayed, 'Tab key stays inside the dialog');
  stayed = true; for (let i = 0; i < 14; i++) { await p.keyboard.press('Shift+Tab'); stayed = stayed && await p.evaluate(() => document.querySelector('#modal .modal').contains(document.activeElement)); } ok(stayed, 'Shift+Tab stays inside the dialog');
  await p.click('#f-submit'); ok(await p.evaluate(() => document.getElementById('f-name').getAttribute('aria-invalid') === 'true' && document.activeElement.id === 'f-name'), 'invalid fields are flagged and the first one gets focus');
  await p.keyboard.press('Escape'); ok(await p.evaluate(() => !document.getElementById('modal').classList.contains('open')), 'Escape closes it');
  ok(await p.evaluate(() => document.activeElement === window.__op), 'focus returns to the button that opened it');
  await p._ctx.close();

  section('Moved shared styles (guide pages)');
  for (const f of ['choose-cashback-realtor-toronto', 'fsbo-vs-flat-fee-realtor', 'home-repairs-before-selling', 'home-staging-tips-toronto', 'low-commission-realtor-toronto', 'pricing-strategy-toronto']) ok(read(f + '.html').includes('guide-pillar.css'), f + ' loads guide-pillar.css');
  p = await open(); await p.goto(base + '/pricing-strategy-toronto.html'); ok((await p.evaluate(() => getComputedStyle(document.querySelector('.guide-hero')).backgroundColor)) !== 'rgba(0, 0, 0, 0)', 'guide hero is styled from the shared file'); await p._ctx.close();

  section('Privacy policy');
  p = await open(); await p.goto(base + '/privacy.html'); ok(/test different wording on buttons/.test(await p.textContent('body')), 'discloses the button test'); await p._ctx.close();

  await browser.close(); server.close();
  console.log('\n' + '='.repeat(50) + `\nRESULT: ${pass} passed, ${fail} failed` + (warnings.length ? ` | warnings: ${warnings.join('; ')}` : ''));
  process.exit(fail ? 1 : 0);
})();
