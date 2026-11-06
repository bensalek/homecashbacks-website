# Site change log (for before/after comparisons)

Dates are Toronto time, when the change went live on homecashbacks.ca (the `main` branch). Not published on the website.
When two changes land in the same week, we cannot separate their effects, so note that in the weekly report.

## PENDING RELEASE — buyer flat fee raised from $4,999 to $5,999 + HST (test period 2-3 months)
- Buyer flat fee is now **$5,999 + HST**. Seller (listing) fee stays **$4,999 + HST**. Clients quoted $4,999 earlier keep $4,999.
- Every cashback example drops by exactly $1,000 (for example $1M home: about $19,000 back instead of $20,000). Comparison pages were recalculated: the flat fee now beats a 50% split above about $480,000 (was about $400,000); the footer shows both fees.
- Past deals on /recent-deals.html stay calculated at the old fee, with a note.
- When this goes live, write the exact date and time here. The showing-fee change (2026-10-21) was only a few weeks earlier, so the two changes overlap in any before/after comparison.

## 2026-10-21 (about 1:50 pm) — PR #3: showing fee
- Every showing is **$40 + HST**. The free first showing and the old $30 fee are gone from all pages, templates, structured data and `llms.txt`.
- The flat fee is stated as **$4,999 + HST** where the fee is explained. Every page footer has a visible fee line.
- Homepage: "How much do showings cost?" is the first FAQ question; "Book a showing" step shows the price; booking pop-up and confirmation message stated the showing fee (a later change removes it from the pop-up and confirmation message only).
- n8n follow-up emails (Day 14) and the follow-up writer instructions were changed the same day.

## 2026-10-21 (early) — PR #2: SEO wording and dev-traffic filter
- Homepage title, H1 and meta now say "Cash Back Realtor" (Toronto, flat $4,999 fee).
- `/how-cashback-works-ontario.html` retitled around "cash back real estate"; new FAQ on the legal page; more internal links (flat fee, low commission, cashback vs mortgage pages).
- Fixes for sideways scrolling on the smallest phones.
- Only homecashbacks.ca now sends data to Google Analytics, Clarity and HubSpot (dev site and previews no longer do).

## 2026-10-08 (evening) — PR #1: SEO, conversion and site-setup updates
- A/B test on the "/cashback-realtor-vs-traditional" button text (GA4 parameter `ab_variant`).
- Homepage hero image loading, Toronto page H1 and local facts, legal page title and H1, booking pop-up simplified.

## How to compare the showing-fee change
- Baseline: the 4 weeks before 2026-10-21 (n8n table `seo_weekly`, GA4, HubSpot).
- Compare ratios, not totals: leads per 100 visits; pop-up opens, form starts and forms sent per 100 visits; phone/WhatsApp clicks per 100 visits.
- Also compare showings booked per client and cancellations (n8n table `showings`).
- Traffic is small (about 85 visits and 2 to 5 leads a week), so allow 6 to 8 weeks before reading anything into a change.
