// HomeCashbacks Build Script
// node build.js — Netlify runs this on every push
const fs   = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');

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

// Copy assets to /dist/assets/ — minify CSS files
var distAssets = path.join(DIST_DIR, 'assets');
fs.mkdirSync(distAssets, { recursive: true });
var cssMinifier = new CleanCSS({ level: 2 });
fs.readdirSync(ASSETS_DIR).forEach(function(file) {
  var srcPath = path.join(ASSETS_DIR, file);
  if (fs.statSync(srcPath).isDirectory()) return;
  var destPath = path.join(distAssets, file);
  if (file.endsWith('.css')) {
    var original = fs.readFileSync(srcPath, 'utf8');
    var minified = cssMinifier.minify(original).styles;
    fs.writeFileSync(destPath, minified, 'utf8');
    var saving = Math.round((1 - minified.length / original.length) * 100);
    console.log('  minified: assets/' + file + ' (-' + saving + '%)');
  } else {
    fs.copyFileSync(srcPath, destPath);
    console.log('  copied: assets/' + file);
  }
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

// Copy _headers and _redirects to dist
['_headers','_redirects'].forEach(function(f){
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(DIST_DIR, f));
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

// ── CITY PAGE GENERATOR ────────────────────────────────────────────────────
(function generateCityPages() {
  var citiesData = JSON.parse(fs.readFileSync('./data/cities.json', 'utf8'));
  var template   = fs.readFileSync('./templates/city-template.html', 'utf8');

  // Also inject shared components (same as regular pages)
  function assembleCityPage(html, city) {
    var headMatch  = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    var fullHead   = headMatch ? headMatch[1] : '';
    var pageStyles = (fullHead.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
    var pageMeta   = fullHead
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<meta charset[^>]*>/gi, '')
      .replace(/<meta name="viewport"[^>]*>/gi, '')
      .replace(/<link rel="icon"[^>]*>/gi, '')
      .trim();

    var bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    var rawBody   = bodyMatch ? bodyMatch[1] : '';
    var pageScripts = (rawBody.match(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/gi) || []).join('\n');
    var bodyClean = rawBody.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').trim();

    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
      '<meta charset="UTF-8"/>\n<meta name="viewport" content="width=device-width,initial-scale=1.0"/>\n' +
      pageMeta + '\n' + head + '\n' + pageStyles + '\n</head>\n<body>\n' +
      NETLIFY_FORM + '\n' + modal + '\n\n' + nav + '\n\n' +
      bodyClean + '\n\n' + footer + '\n\n' +
      pageScripts + '\n<script>\n' + sharedJs + '\n</script>\n' +
      '</body>\n</html>';
  }

  citiesData.cities.forEach(function(city) {
    var html = template;

    // Basic tokens
    html = html.replace(/{{META_DESC}}/g,   city.metaDesc);
    html = html.replace(/{{NAME}}/g,        city.name);
    html = html.replace(/{{SLUG}}/g,        city.slug);
    html = html.replace(/{{CASHBACK}}/g,    city.cashback);
    html = html.replace(/{{HERO_SUB}}/g,    city.heroSub);
    html = html.replace(/{{MARKET_DATE}}/g, city.marketDate);
    html = html.replace(/{{MARKET_TITLE}}/g,city.marketTitle);
    html = html.replace(/{{MARKET_TEXT}}/g, city.marketText);
    html = html.replace(/{{LALEH_QUOTE}}/g, city.laleh);
    html = html.replace(/{{SOURCE_SLUG}}/g, city.sourceSlug);
    html = html.replace(/{{CALC_DEFAULT}}/g,city.calcDefault);
    html = html.replace(/{{GEO_LAT}}/g,     city.geo.lat);
    html = html.replace(/{{GEO_LNG}}/g,     city.geo.lng);
    html = html.replace(/{{DATA_DATE_ISO}}/g,'2026-06-09');

    // Formatted calc default
    html = html.replace(/{{CALC_DEFAULT_FMT}}/g,
      Math.round(city.calcDefault).toLocaleString('en-CA'));

    // Market note (optional)
    var marketNoteHtml = city.marketNote
      ? '<p class="miss-body">' + city.marketNote + '</p>'
      : '';
    html = html.replace('{{MARKET_NOTE}}', marketNoteHtml);

    // Stat boxes
    var statBoxes = city.stats.map(function(s) {
      return '<div class="stat-box' + (s.highlight ? ' highlight' : '') + '">' +
        '<div class="stat-box-val">' + s.val + '</div>' +
        '<div class="stat-box-label">' + s.label + '</div>' +
        '</div>';
    }).join('\n');
    html = html.replace('{{STAT_BOXES}}', statBoxes);

    // Hood cards
    var hoodCards = city.hoods.map(function(h) {
      var classes = 'hood-card' + (h.featured ? ' featured' : '') + (h.link ? ' hood-card--linked' : '');
      var tag = h.link ? 'a' : 'div';
      var tagOpen = h.link
        ? '<a href="' + h.link + '" class="' + classes + '">'
        : '<div class="' + classes + '">';
      var tagClose = h.link ? '</a>' : '</div>';
      var linkCue = h.link
        ? '<div class="hood-link-cue">Schools, commute &amp; cashback →</div>'
        : '';
      return tagOpen +
        '<div class="hood-type">' + h.type + '</div>' +
        '<div class="hood-name">' + h.name + '</div>' +
        '<div class="hood-desc">' + h.desc + '</div>' +
        '<div class="hood-price">' + h.price + '</div>' +
        linkCue +
        tagClose;
    }).join('\n');
    html = html.replace('{{HOOD_CARDS}}', hoodCards);

    // FAQ items
    var faqItems = city.faqCity.filter(Boolean).map(function(f) {
      return '<div class="miss-faq-item">' +
        '<div class="miss-faq-q"><span class="miss-faq-q-text">' + f.q + '</span>' +
        '<span class="miss-faq-icon">+</span></div>' +
        '<div class="miss-faq-a">' + f.a + '</div>' +
        '</div>';
    }).join('\n');
    html = html.replace('{{FAQ_ITEMS}}', faqItems);

    // FAQ schema
    var faqSchema = JSON.stringify(city.faqCity.filter(Boolean).map(function(f) {
      return {"@type":"Question","name":f.q,"acceptedAnswer":{"@type":"Answer","text":f.a}};
    }));
    html = html.replace('{{FAQ_SCHEMA}}', faqSchema);

    // Also serving chips
    var alsoChips = city.alsoServing.map(function(s) {
      return '<a href="/' + s.slug + '-cashback-realtor.html" class="chip">' + s.name + '</a>';
    }).join('\n');
    html = html.replace('{{ALSO_SERVING_CHIPS}}', alsoChips);

    // Assemble with shared components and write to dist
    var assembled = assembleCityPage(html, city);
    var filename  = city.slug + '-cashback-realtor.html';
    fs.writeFileSync(path.join(DIST_DIR, filename), assembled, 'utf8');
    console.log('  generated city: ' + filename);
  });

  console.log('\n✓ City pages generated: ' + citiesData.cities.length);
})();

// ── NEIGHBOURHOOD PAGE GENERATOR ───────────────────────────────────────────
(function generateNeighbourhoodPages() {
  var data     = JSON.parse(fs.readFileSync('./data/neighbourhoods.json', 'utf8'));
  var template = fs.readFileSync('./templates/neighbourhood-template.html', 'utf8');

  function assemblePage(html) {
    var headMatch  = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    var fullHead   = headMatch ? headMatch[1] : '';
    var pageStyles = (fullHead.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
    var pageMeta   = fullHead
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<meta charset[^>]*>/gi, '')
      .replace(/<meta name="viewport"[^>]*>/gi, '')
      .replace(/<link rel="icon"[^>]*>/gi, '')
      .trim();
    var bodyMatch   = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    var rawBody     = bodyMatch ? bodyMatch[1] : '';
    var pageScripts = (rawBody.match(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/gi) || []).join('\n');
    var bodyClean   = rawBody.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').trim();

    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
      '<meta charset="UTF-8"/>\n<meta name="viewport" content="width=device-width,initial-scale=1.0"/>\n' +
      pageMeta + '\n' + head + '\n' + pageStyles + '\n</head>\n<body>\n' +
      NETLIFY_FORM + '\n' + modal + '\n\n' + nav + '\n\n' +
      bodyClean + '\n\n' + footer + '\n\n' +
      pageScripts + '\n<script>\n' + sharedJs + '\n</script>\n' +
      '</body>\n</html>';
  }

  data.neighbourhoods.forEach(function(nbr) {
    var html = template;

    // Basic tokens
    html = html.replace(/{{META_DESC}}/g,    nbr.metaDesc || '');
    html = html.replace(/{{NAME}}/g,        nbr.name);
    html = html.replace(/{{SLUG}}/g,        nbr.slug);
    html = html.replace(/{{CITY_NAME}}/g,   nbr.cityName);
    html = html.replace(/{{CITY_SLUG}}/g,   nbr.citySlug);
    html = html.replace(/{{HERO_SUB}}/g,    nbr.heroSub);
    html = html.replace(/{{OVERVIEW}}/g,    nbr.overview);
    html = html.replace(/{{WALK_SCORE}}/g,  nbr.walkScore);
    html = html.replace(/{{TRANSIT_SCORE}}/g, nbr.transitScore);
    html = html.replace(/{{COMMUTE_TIME}}/g,nbr.commuteTime);
    html = html.replace(/{{CONDOS_FROM}}/g, nbr.condosFrom);
    html = html.replace(/{{MARKET_DATE}}/g, nbr.marketDate);
    html = html.replace(/{{LALEH}}/g,       nbr.laleh);
    html = html.replace(/{{DATA_DATE_ISO}}/g,'2026-06-09');
    html = html.replace(/{{CALC_DEFAULT}}/g, nbr.calcDefault);
    html = html.replace(/{{CALC_DEFAULT_FMT}}/g,
      Math.round(nbr.calcDefault).toLocaleString('en-CA'));

    // Price cards
    var priceCards = nbr.prices.map(function(p) {
      return '<div class="price-card">' +
        '<div class="price-card-type">' + p.type + '</div>' +
        '<div class="price-card-val">' + p.val + '</div>' +
        '<div class="price-card-note">' + p.note + '</div>' +
        '</div>';
    }).join('\n');
    html = html.replace('{{PRICE_CARDS}}', priceCards);

    // Schools
    var schoolItems = nbr.schools.map(function(s) {
      return '<div class="school-item">' +
        '<div><div class="school-name">' + s.name + '</div>' +
        '<div class="school-meta">' + s.meta + '</div></div>' +
        '<div class="school-type">' + s.type + '</div>' +
        '</div>';
    }).join('\n');
    html = html.replace('{{SCHOOL_ITEMS}}', schoolItems);

    // Commutes
    var commuteItems = nbr.commutes.map(function(c) {
      return '<div class="commute-item">' +
        '<div><div class="commute-route">' + c.route + '</div>' +
        '<div class="commute-mode">' + c.mode + '</div></div>' +
        '<div class="commute-time">' + c.time + '</div>' +
        '</div>';
    }).join('\n');
    html = html.replace('{{COMMUTE_ITEMS}}', commuteItems);

    // Who it's for
    var whoCards = nbr.whoFor.map(function(w) {
      return '<div class="for-card">' +
        '<div class="for-card-label">' + w.label + '</div>' +
        '<div class="for-card-text">' + w.text + '</div>' +
        '</div>';
    }).join('\n');
    html = html.replace('{{WHO_CARDS}}', whoCards);

    // FAQ items
    var faqItems = nbr.faqs.map(function(f) {
      return '<div class="faq-item">' +
        '<div class="faq-q"><span class="faq-q-text">' + f.q + '</span>' +
        '<span class="faq-icon">+</span></div>' +
        '<div class="faq-a">' + f.a + '</div>' +
        '</div>';
    }).join('\n');
    html = html.replace('{{FAQ_ITEMS}}', faqItems);

    // FAQ schema
    var faqSchema = JSON.stringify(nbr.faqs.map(function(f) {
      return {"@type":"Question","name":f.q,"acceptedAnswer":{"@type":"Answer","text":f.a}};
    }));
    html = html.replace('{{FAQ_SCHEMA}}', faqSchema);

    // Related cards
    var relatedCards = nbr.related.map(function(r) {
      return '<a href="' + r.href + '" class="nbr-related-card">' +
        '<span class="nbr-related-card-label">' + r.label + '</span>' +
        '<span class="nbr-related-card-title">' + r.title + '</span>' +
        '</a>';
    }).join('\n');
    html = html.replace('{{RELATED_CARDS}}', relatedCards);

    var assembled = assemblePage(html);
    var filename  = nbr.slug + '.html';
    fs.writeFileSync(path.join(DIST_DIR, filename), assembled, 'utf8');
    console.log('  generated neighbourhood: ' + filename);
  });

  console.log('\n✓ Neighbourhood pages generated: ' + data.neighbourhoods.length);
})();
