// HomeCashbacks Build Script
const fs   = require('fs');
const path = require('path');

const COMPONENTS_DIR = './components';
const PAGES_DIR      = './pages';
const ASSETS_DIR     = './assets';
const DIST_DIR       = './dist';

// Read components
const head   = fs.readFileSync(path.join(COMPONENTS_DIR, 'head.html'),   'utf8');
const nav    = fs.readFileSync(path.join(COMPONENTS_DIR, 'nav.html'),    'utf8');
const modal  = fs.readFileSync(path.join(COMPONENTS_DIR, 'modal.html'),  'utf8');
const footer = fs.readFileSync(path.join(COMPONENTS_DIR, 'footer.html'), 'utf8');

// Netlify form detection - truly hidden, won't render visibly
const NETLIFY_FORM_DETECTION = '<div aria-hidden="true" style="position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden"><form name="contact" data-netlify="true" netlify-honeypot="bot-field"><input type="text" name="name"/><input type="text" name="email"/><input type="tel" name="phone"/></form></div>';

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

// Assemble pages
var pages = fs.readdirSync(PAGES_DIR).filter(function(f) {
  return f.endsWith('.html') && !f.startsWith('_');
});

pages.forEach(function(filename) {
  var page = fs.readFileSync(path.join(PAGES_DIR, filename), 'utf8');

  // Extract full head block
  var headMatch = page.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  var fullHeadContent = headMatch ? headMatch[1] : '';

  // Extract page-specific styles from head
  var headStyleMatches = fullHeadContent.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  var pageHeadStyles = headStyleMatches.join('\n');

  // Strip styles and shared items from head - keep only page-specific meta
  var pageMetaContent = fullHeadContent
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<meta charset[^>]*>/gi, '')
    .replace(/<meta name="viewport"[^>]*>/gi, '')
    .replace(/<link rel="icon"[^>]*>/gi, '')
    .replace(/<link rel="apple-touch-icon"[^>]*>/gi, '')
    .replace(/<link rel="preconnect"[^>]*>/gi, '')
    .replace(/<link href="https:\/\/fonts\.googleapis[^>]*>/gi, '')
    .replace(/<script async src="https:\/\/www\.googletagmanager[^>]*><\/script>/gi, '')
    .replace(/<script>[\s\S]*?gtag\([\s\S]*?<\/script>/gi, '')
    .replace(/<link rel="stylesheet" href="\/assets\/styles[^>]*>/gi, '')
    .trim();

  // Extract body content
  var bodyMatch = page.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  var pageBodyContent = bodyMatch ? bodyMatch[1].trim() : page;

  // Extract page-specific styles from body too
  var bodyStyleMatches = pageBodyContent.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  var pageBodyStyles = bodyStyleMatches.join('\n');

  // All page styles combined
  var pageStyles = pageHeadStyles + '\n' + pageBodyStyles;

  // Extract page-specific inline scripts
  var scriptMatches = pageBodyContent.match(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/gi) || [];
  var pageScripts = scriptMatches.join('\n');

  // Clean body — remove styles and scripts
  var bodyClean = pageBodyContent
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .trim();

  // Assemble final page
  var assembled = '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="UTF-8"/>\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>\n' +
    pageMetaContent + '\n' +
    head + '\n' +
    pageStyles + '\n' +
    '</head>\n' +
    '<body>\n' +
    NETLIFY_FORM_DETECTION + '\n' +
    modal + '\n\n' +
    nav + '\n\n' +
    bodyClean + '\n\n' +
    footer + '\n\n' +
    '<script>\n' + sharedJs + '\n</script>\n' +
    pageScripts + '\n' +
    '</body>\n' +
    '</html>';

  fs.writeFileSync(path.join(DIST_DIR, filename), assembled, 'utf8');
  console.log('  built: ' + filename);
});

console.log('\n✓ Build complete — ' + pages.length + ' pages assembled into /dist');
