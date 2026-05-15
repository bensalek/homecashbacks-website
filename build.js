// HomeCashbacks Build Script
// Runs on Netlify on every push: node build.js
const fs   = require('fs');
const path = require('path');

const COMPONENTS_DIR = './components';
const PAGES_DIR      = './pages';
const ASSETS_DIR     = './assets';
const DIST_DIR       = './dist';

// Read components
const head     = fs.readFileSync(path.join(COMPONENTS_DIR, 'head.html'),   'utf8');
const nav      = fs.readFileSync(path.join(COMPONENTS_DIR, 'nav.html'),    'utf8');
const modal    = fs.readFileSync(path.join(COMPONENTS_DIR, 'modal.html'),  'utf8');
const footer   = fs.readFileSync(path.join(COMPONENTS_DIR, 'footer.html'), 'utf8');
const sharedJs = fs.readFileSync(path.join(ASSETS_DIR,     'shared.js'),   'utf8');

// Netlify form detection - positioned off-screen so it's never visible
const NETLIFY_FORM = '<div aria-hidden="true" style="position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden"><form name="contact" data-netlify="true" netlify-honeypot="bot-field"><input type="text" name="name"/><input type="text" name="email"/><input type="tel" name="phone"/></form></div>';

// Prepare dist
if (fs.existsSync(DIST_DIR)) fs.rmSync(DIST_DIR, { recursive: true });
fs.mkdirSync(DIST_DIR, { recursive: true });

// Copy assets
var distAssets = path.join(DIST_DIR, 'assets');
fs.mkdirSync(distAssets, { recursive: true });
fs.readdirSync(ASSETS_DIR).forEach(function(file) {
  fs.copyFileSync(path.join(ASSETS_DIR, file), path.join(distAssets, file));
  console.log('  copied: assets/' + file);
});

// Copy root-level files
['favicon.ico','favicon.svg','favicon-32.png','apple-touch-icon.png','sitemap.xml','_redirects'].forEach(function(file) {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join(DIST_DIR, file));
    console.log('  copied: ' + file);
  }
});

// Strip shared elements from page body content
function stripSharedElements(bodyContent) {
  var b = bodyContent;

  // Remove modal overlay block
  b = b.replace(/<div class="modal-overlay"[\s\S]*?<\/div>\s*\n<\/div>\s*\n?/g, '');
  b = b.replace(/<!-- MODAL -->\s*\n?/g, '');

  // Remove top bar + nav block
  b = b.replace(/<div class="top-bar">[\s\S]*?<\/nav>\s*\n?/g, '');
  b = b.replace(/<!-- TOP BAR -->\s*\n?/g, '');
  b = b.replace(/<!-- NAV -->\s*\n?/g, '');

  // Remove footer block  
  b = b.replace(/<footer>[\s\S]*?<\/footer>\s*\n?/g, '');
  b = b.replace(/<!-- FOOTER -->\s*\n?/g, '');

  return b.trim();
}

// Strip shared JS functions from script content
function stripSharedJs(scriptContent) {
  var s = scriptContent;
  // Remove function definitions that are now in shared.js
  s = s.replace(/function openModal\(\)[^{]*\{[^\n]+\}\s*\n?/g, '');
  s = s.replace(/function closeModal\(\)[^{]*\{[^\n]+\}\s*\n?/g, '');
  s = s.replace(/function toggleMobMenu\(\)[^{]*\{[^\n]+\}\s*\n?/g, '');
  s = s.replace(/function closeMobMenu\(\)[^{]*\{[^\n]+\}\s*\n?/g, '');
  s = s.replace(/document\.addEventListener\('keydown'[^\n]+\n?/g, '');
  s = s.replace(/document\.addEventListener\("keydown"[^\n]+\n?/g, '');
  s = s.replace(/document\.getElementById\('modal'\)\.addEventListener[^\n]+\n?/g, '');
  // Note: handleFormSubmit kept in page - shared.js overrides it by loading after
  // Remove shared.js src tag
  s = s.replace(/<script src=['"]\/?assets\/shared\.js['"]><\/script>\s*\n?/g, '');
  return s;
}

// Assemble pages
var pages = fs.readdirSync(PAGES_DIR).filter(function(f) {
  return f.endsWith('.html') && !f.startsWith('_');
});

pages.forEach(function(filename) {
  var page = fs.readFileSync(path.join(PAGES_DIR, filename), 'utf8');

  // Extract head content
  var headMatch = page.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  var fullHead = headMatch ? headMatch[1] : '';

  // Extract page-specific styles from head
  var headStyleMatches = fullHead.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  var pageStyles = headStyleMatches.join('\n');

  // Strip shared items from head meta
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
    .trim();

  // Extract body content
  var bodyMatch = page.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  var rawBody = bodyMatch ? bodyMatch[1] : '';

  // Strip shared structural elements from body
  var bodyClean = stripSharedElements(rawBody);

  // Extract page styles from body too
  var bodyStyleMatches = bodyClean.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  pageStyles += '\n' + bodyStyleMatches.join('\n');

  // Extract page-specific inline scripts
  var scriptMatches = bodyClean.match(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/gi) || [];
  var pageScripts = scriptMatches.map(function(s) {
    var content = s.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    return '<script>' + stripSharedJs(content) + '</script>';
  }).join('\n');

  // Clean body - remove styles and scripts
  bodyClean = bodyClean
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .trim();

  // Fix image paths
  bodyClean = bodyClean.replace(/src="headshot\.webp"/g, 'src="/assets/headshot.webp"');
  bodyClean = bodyClean.replace(/src="\.\.\/headshot\.webp"/g, 'src="/assets/headshot.webp"');

  // Assemble final page
  var assembled = '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="UTF-8"/>\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>\n' +
    pageMeta + '\n' +
    head + '\n' +
    pageStyles + '\n' +
    '</head>\n' +
    '<body>\n' +
    NETLIFY_FORM + '\n' +
    modal + '\n\n' +
    nav + '\n\n' +
    bodyClean + '\n\n' +
    footer + '\n\n' +
    pageScripts + '\n' +
    '<script>\n' + sharedJs + '\n</script>\n' +
    '</body>\n' +
    '</html>';

  fs.writeFileSync(path.join(DIST_DIR, filename), assembled, 'utf8');
  console.log('  built: ' + filename);
});

console.log('\n✓ Build complete — ' + pages.length + ' pages assembled into /dist');
