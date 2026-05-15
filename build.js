// HomeCashbacks Build Script
// Netlify runs: node build.js on every push

const fs = require('fs');
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

// Prepare dist
if (fs.existsSync(DIST_DIR)) fs.rmSync(DIST_DIR, { recursive: true });
fs.mkdirSync(DIST_DIR, { recursive: true });

// Copy assets
const distAssets = path.join(DIST_DIR, 'assets');
fs.mkdirSync(distAssets, { recursive: true });
fs.readdirSync(ASSETS_DIR).forEach(file => {
  fs.copyFileSync(path.join(ASSETS_DIR, file), path.join(distAssets, file));
  console.log('  copied: assets/' + file);
});

// Copy root-level files
['favicon.ico','favicon.svg','favicon-32.png','apple-touch-icon.png','sitemap.xml','_redirects'].forEach(file => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join(DIST_DIR, file));
    console.log('  copied: ' + file);
  }
});

// Assemble pages
const pages = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.html') && !f.startsWith('_'));

pages.forEach(function(filename) {
  var page = fs.readFileSync(path.join(PAGES_DIR, filename), 'utf8');

  // Extract head content
  var headMatch = page.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  var pageHeadContent = headMatch ? headMatch[1].trim() : '';

  // Extract body content
  var bodyMatch = page.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  var pageBodyContent = bodyMatch ? bodyMatch[1].trim() : page;

  // Extract page-specific styles
  var styleMatches = pageBodyContent.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  var pageStyles = styleMatches.join('\n');

  // Extract page-specific scripts (inline only, not src links)
  var scriptMatches = pageBodyContent.match(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/gi) || [];
  var pageScripts = scriptMatches.join('\n');

  // Clean body - remove styles and scripts
  var bodyClean = pageBodyContent
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .trim();

  // Build final page
  var assembled = '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="UTF-8"/>\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>\n' +
    pageHeadContent + '\n' +
    head + '\n' +
    pageStyles + '\n' +
    '</head>\n' +
    '<body>\n' +
    modal + '\n\n' +
    nav + '\n\n' +
    bodyClean + '\n\n' +
    footer + '\n\n' +
    '<script src="/assets/shared.js"></script>\n' +
    pageScripts + '\n' +
    '</body>\n' +
    '</html>';

  fs.writeFileSync(path.join(DIST_DIR, filename), assembled, 'utf8');
  console.log('  built: ' + filename);
});

console.log('\n✓ Build complete — ' + pages.length + ' pages assembled into /dist');
