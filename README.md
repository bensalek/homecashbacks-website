# HomeCashbacks Build System

## How it works

Every page is assembled from shared components + page-specific content.
Netlify runs `node build.js` on every push and deploys the `/dist` folder.

## Folder structure

```
/components
  head.html      ← GA tag, favicons, fonts, stylesheet link (shared)
  nav.html       ← top bar + nav (shared) ← EDIT THIS to update nav on ALL pages
  modal.html     ← booking form (shared)
  footer.html    ← footer (shared) ← EDIT THIS to update footer on ALL pages

/pages
  index.html     ← homepage content only (no nav/footer/modal)
  checklist.html
  calculators.html
  ...
  _template.html ← copy this when adding a new page

/assets
  styles.css     ← shared CSS ← EDIT THIS to change design on ALL pages
  shared.js      ← shared JS (modal, nav, form)
  headshot.webp
  favicon.svg
  (other images)

build.js         ← assembles pages into /dist
netlify.toml     ← tells Netlify to run build.js
package.json
.gitignore
```

## Adding a new page (e.g. Condo Buyer Guide)

1. Copy `/pages/_template.html` to `/pages/condo-buyer-guide.html`
2. Update the `<title>`, meta tags, and page content
3. Add the link to `/components/nav.html` in the Resources dropdown
4. Push to Git — Netlify builds and deploys automatically

That's it. Nav, footer, modal, GA tag, and CSS update automatically.

## Updating the nav

Edit `/components/nav.html` once.
All pages update on next deploy.

## Updating the footer

Edit `/components/footer.html` once.
All pages update on next deploy.

## Updating shared CSS

Edit `/assets/styles.css` once.
All pages update on next deploy.

## Running the build locally (optional)

If you ever want to preview before pushing:
```bash
node build.js
```
Then open any file in `/dist` in your browser.
Note: you need Node.js installed locally to do this. It's optional — Netlify handles it automatically.

## What each page file should contain

- Page-specific `<title>`, `<meta>`, `<link rel="canonical">` in `<head>`
- Page-specific `<style>` block (unique styles only)
- Page content HTML (no nav, modal, or footer — those are injected)
- Page-specific `<script>` block (calculator logic, FAQ data, etc.)

See `/pages/_template.html` for a working example.
