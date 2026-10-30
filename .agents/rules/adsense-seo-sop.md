---
description: Google AdSense and SEO Audit & Compliance SOP
globs: ["**/*.html", "**/_headers", "**/_routes.json", "**/wrangler.toml", "**/robots.txt", "**/sitemap.xml", "**/ads.txt"]
---

# Google AdSense & SEO Audit SOP Rule

When reviewing or optimizing websites for search engines (Googlebot) and monetization (Google AdSense):

## Core Principles
1. **Never rely solely on local static code passing.** Verify real HTTP headers and responses.
2. **Avoid testing blind spots.** Probe endpoints with external simulated requests (curl/Playwright).
3. **Dual Perspective.** Evaluate from both Googlebot crawler and human AdSense reviewer perspectives.

## Key Checklist
1. **Edge & HTTP Layer**:
   - 404 Pages: Non-existent routes must return true HTTP 404 with `<meta name="robots" content="noindex">`. No soft 404s (200 OK + homepage).
   - Clean URL vs Canonical: Align canonical URL with clean route without trailing `.html`.
   - Homepage Canonical: Must point to root domain `https://domain.com/`, never `https://domain.com/index.html`.
   - Cache rules: `_headers` must match Clean URLs (`/*`), verifying `Cache-Control`.
2. **AdSense & Search Admission Layer**:
   - `ads.txt`: Must be served at root domain, returning valid `DIRECT` publisher ID.
   - GDPR/Cookie Privacy: Explicit disclosure of Google AdSense / DoubleClick cookies with opt-out link.
   - `sitemap.xml`: Strictly 200 OK canonical pages, no 404s, no redirects.
   - `robots.txt`: Allow crawlers and index Sitemap.
3. **E-E-A-T & Entity Trust**:
   - 4 Pillar Pages: About, Contact, Editorial Policy, Privacy Policy linked in footer.
   - Official domain emails (e.g., `contact@domain.com`), no private/free mailboxes.
   - Schema JSON-LD: Entities structured as `@type: "Organization"`, avoiding "Brand as Person".
   - Affiliate/ad disclosure banners clearly placed.
4. **Content Quality & Anti-Abuse**:
   - No Scaled Content Abuse (thin template-swapped pages).
   - Authentic first-party data, benchmarks, or authoritative citations.
   - External links protection: Do not alter external `.html` URLs during batch replacements.
