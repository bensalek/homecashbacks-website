// HomeCashbacks Build Script
// node build.js — Netlify runs this on every push
const fs   = require('fs');
const path = require('path');

const COMPONENTS_DIR = './components';
const PAGES_DIR      = './pages';
const ASSETS_DIR     = './assets';
const DIST_DIR       = './dist';

// Read shared components
const head     = fs.readFileSync(path.join(COMPONENTS_DIR, 'head.html'),   'utf8');
const nav      = fs.readFileSync(path.join(COMPONENTS_DIR, 'nav.html'),    'utf8');
const modal    = fs.readFileSync(path.join(COMPONENTS_DIR, 'modal.html'),  'utf8');
const footer   = fs.readFileSync(path.join(COMPONENTS_DIR, 'footer.html'), 'utf8');
const sharedJs = fs.readFileSync(path.join(ASSETS_DIR,     'shared.js'),   'utf8');

// Netlify form detection — off-screen, never visible
const NETLIFY_FORM = '<div aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden"><form name="contact" data-netlify="true" netlify-honeypot="bot-field"><input type="text" name="name" tabindex="-1"/><input type="text" name="email" tabindex="-1"/><input type="tel" name="phone" tabindex="-1"/><input type="hidden" name="source" tabindex="-1"/></form></div>';

// Prepare /dist
if (fs.existsSync(DIST_DIR)) fs.rmSync(DIST_DIR, { recursive: true });
fs.mkdirSync(DIST_DIR, { recursive: true });

// Copy assets to /dist/assets/
var distAssets = path.join(DIST_DIR, 'assets');
fs.mkdirSync(distAssets, { recursive: true });
fs.readdirSync(ASSETS_DIR).forEach(function(file) {
  var srcPath = path.join(ASSETS_DIR, file);
  if (fs.statSync(srcPath).isDirectory()) return;
  fs.copyFileSync(srcPath, path.join(distAssets, file));
  console.log('  copied: assets/' + file);
});

// Copy fonts subfolder to /dist/assets/fonts/
var distFonts = path.join(distAssets, 'fonts');
fs.mkdirSync(distFonts, { recursive: true });
var fontsDir = path.join(ASSETS_DIR, 'fonts');
if (fs.existsSync(fontsDir)) {
  fs.readdirSync(fontsDir).forEach(function(file) {
    fs.copyFileSync(path.join(fontsDir, file), path.join(distFonts, file));
    console.log('  copied: assets/fonts/' + file);
  });
}

// Copy root-level files to /dist
['favicon.ico','favicon.svg','favicon-32.png','apple-touch-icon.png','sitemap.xml','_redirects','robots.txt','llms.txt'].forEach(function(file) {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join(DIST_DIR, file));
    console.log('  copied: ' + file);
  }
});

// Assemble each page
var pages = fs.readdirSync(PAGES_DIR).filter(function(f) {
  return f.endsWith('.html') && !f.startsWith('_');
});

pages.forEach(function(filename) {
  var page = fs.readFileSync(path.join(PAGES_DIR, filename), 'utf8');

  // ── Extract head content ────────────────────────────────────────────────
  var headMatch = page.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  var fullHead  = headMatch ? headMatch[1] : '';

  // Page-specific styles (keep as-is)
  var pageStyles = (fullHead.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');

  // Page-specific CSS links (e.g. index.css, listing.css etc — NOT styles.css which comes from head.html)
  var pageCssLinks = (fullHead.match(/<link rel="stylesheet" href="\/assets\/(?!styles)[^"]*\.css"[^>]*>/gi) || []).join('\n');

  // Page meta: title, description, canonical, og tags only
  var pageMeta = fullHead
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<meta charset[^>]*>/gi, '')
    .replace(/<meta name="viewport"[^>]*>/gi, '')
    .replace(/<link rel="icon"[^>]*>/gi, '')
    .replace(/<link rel="apple-touch-icon"[^>]*>/gi, '')
    .replace(/<link rel="preconnect"[^>]*>/gi, '')
    .replace(/<link href="https:\/\/fonts\.googleapis[^>]*>/gi, '')
    .replace(/<script async src="https:\/\/www\.googletagmanager[^>]*><\/script>/gi, '')
    .replace(/<script>[\s\S]*?gtag[\s\S]*?<\/script>/gi, '')
    .replace(/<link rel="stylesheet" href="\/assets\/styles[^>]*>/gi, '')
    .replace(/<link rel="stylesheet" href="\/assets\/(?!styles)[^"]*\.css"[^>]*>/gi, '')
    .replace(/<!-- Google tag[^>]*-->/gi, '')
    .trim();

  // ── Extract body content ────────────────────────────────────────────────
  var bodyMatch = page.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  var rawBody   = bodyMatch ? bodyMatch[1] : '';

  // Remove any leftover shared structural elements (safety net)
  var bodyClean = rawBody
    .replace(/<div class="modal-overlay"[\s\S]*?<\/div>\s*\n<\/div>\s*\n?/g, '')
    .replace(/<div class="top-bar">[\s\S]*?<\/nav>\s*\n?/g, '')
    .replace(/<footer>[\s\S]*?<\/footer>\s*\n?/g, '')
    .replace(/<!-- (MODAL|NAV|TOP BAR|FOOTER) -->\s*\n?/g, '');

  // Extract page-specific inline scripts
  var pageScripts = (bodyClean.match(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/gi) || []).join('\n');

  // Clean body HTML — remove styles and scripts
  bodyClean = bodyClean
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/src="headshot\.webp"/g, 'src="/assets/headshot.webp"')
    .trim();

  // ── Assemble final page ─────────────────────────────────────────────────
  var assembled =
    '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="UTF-8"/>\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>\n' +
    pageMeta  + '\n' +
    head      + '\n' +
    pageCssLinks + '\n' +
    pageStyles+ '\n' +
    '</head>\n' +
    '<body>\n' +
    NETLIFY_FORM + '\n' +
    modal    + '\n\n' +
    nav      + '\n\n' +
    bodyClean+ '\n\n' +
    footer   + '\n\n' +
    pageScripts + '\n' +
    '<script>\n' + sharedJs + '\n</script>\n' +
    '</body>\n' +
    '</html>';

  // Seller page overrides — replace shared component text in built HTML
  if (filename === 'toronto-listing-agent.html') {
    assembled = assembled
      .replace(/(<button class="foot-cta-btn"[^>]*>)[^<]*/,  '$1Get My Home Value')
      .replace(/(<span class="foot-cta-sub">)[^<]*/,         '$1No upfront fees. Due at closing only.')
      .replace(/(<div class="modal-tag" id="modal-tag">)[^<]*/, '$1Get My Home Value')
      .replace(/(<div class="modal-title" id="modal-title">)[^<]*/, '$1Tell us about your home')
      .replace(/(<div class="modal-sub">)[^<]*/, '$1We will walk through your home, review the market, and give you an honest price estimate. No commitment required.')
      .replace(/>Claim My Free Showing<\/button>/, '>Request My Home Value</button>')
      .replace(/(<input type="hidden" id="f-source"[^>]*value=")[^"]*"/, '$1seller"');
  }

  fs.writeFileSync(path.join(DIST_DIR, filename), assembled, 'utf8');
  console.log('  built: ' + filename);
});

console.log('\n✓ Build complete — ' + pages.length + ' pages assembled into /dist');
