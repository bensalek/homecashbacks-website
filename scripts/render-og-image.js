// Renders design/og-image.html to og-image.png (1200x630).
// Needs Playwright: cd tests && npm install   (not installed on Netlify)
// Usage: node scripts/render-og-image.js
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || path.join(__dirname, '../tests/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto('file://' + path.join(__dirname, '../design/og-image.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(__dirname, '../og-image.png') });
  await browser.close();
  console.log('wrote og-image.png');
})();
