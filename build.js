// HomeCashbacks Build Script
// Run: node build.js
// Netlify runs this automatically on every push via netlify.toml

const fs = require('fs');
const path = require('path');

const COMPONENTS_DIR = './components';
const PAGES_DIR = './pages';
const ASSETS_DIR = './assets';
const DIST_DIR = './dist';

// ── Read components ──────────────────────────────────────────────────────────
const head    = fs.readFileSync(path.join(COMPONENTS_DIR, 'head.html'),   'utf8');
const nav     = fs.readFileSync(path.join(COMPONENTS_DIR, 'nav.html'),    'utf8');
const modal   = fs.readFileSync(path.join(COMPONENTS_DIR, 'modal.html'),  'utf8');
const footer  = fs.readFileSync(path.join(COMPONENTS_DIR, 'footer.html'), 'utf8');

// ── Prepare dist directory ───────────────────────────────────────────────────
if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });

// ── Copy assets to dist ──────────────────────────────────────────────────────
const distAssetsDir = path.join(DIST_DIR, 'assets');
if (!fs.existsSync(distAssetsDir)) fs.mkdirSync(distAssetsDir, { recursive: true });

fs.readdirSync(ASSETS_DIR).forEach(file => {
  fs.copyFileSync(
    path.join(ASSETS_DIR, file),
    path.join(distAssetsDir, file)
  );
  console.log(`  copied: assets/${file}`);
});

// ── Copy root-level assets (favicon files) ───────────────────────────────────
['favicon.ico', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'sitemap.xml', '_redirects'].forEach(file => {
  const src = path.join('.', file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DIST_DIR, file));
    console.log(`  copied: ${file}`);
  }
});

// ── Assemble each page ───────────────────────────────────────────────────────
const pageFiles = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.html'));

pageFiles.forEach(filename => {
  const pagePath = path.join(PAGES_DIR, filename);
  let pageContent = fs.readFileSync(pagePath, 'utf8');

  // Extract what's between <body> and </body>
  const bodyMatch = pageContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : pageContent;

  // Extract page-specific <head> additions (title, meta, canonical etc)
  const headMatch = pageContent.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const pageHead = headMatch ? headMatch[1] : '';

  // Extract page-specific <style> blocks from body
  const styleMatch = bodyContent.match(/(<style[^>]*>[\s\S]*?<\/style>)/i);
  const pageStyle = styleMatch ? styleMatch[1] : '';

  // Extract page-specific <script> blocks (after removing shared ones)
  const scriptMatches = [...bodyContent.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  const pageScripts = scriptMatches
    .filter(m => !m[1].includes('gtag') && !m[1].includes('openModal') && !m[1].includes('toggleMobMenu'))
    .map(m => m[0])
    .join('\n');

  // Replace placeholder comments with components
  let assembled = bodyContent
    .replace(/<!-- MODAL -->[\s\S]*?(?=<!-- TOP BAR -->|<!-- NAV -->|<div class="top-bar">)/i, '')
    .replace(/<!-- TOP BAR -->[\s\S]*?<\/div>\s*\n\s*\n\s*<!-- NAV -->[\s\S]*?<\/nav>/i, nav)
    .replace(/<footer>[\s\S]*?<\/footer>/i, footer);

  // Build final page
  const finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
${pageHead.replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/gi, '').trim()}
${head}
${pageStyle}
</head>
<body>
${modal}

${assembled.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').trim()}

<script src="/assets/shared.js"></script>
${pageScripts}
</body>
</html>`;

  const outPath = path.join(DIST_DIR, filename);
  fs.writeFileSync(outPath, finalHtml, 'utf8');
  console.log(`  built: ${filename}`);
});

console.log(`\n✓ Build complete — ${pageFiles.length} pages assembled into /dist`);
