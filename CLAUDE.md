# DIY Estimator — Claude Code Instructions

## Project Summary
AI-powered home repair cost estimator. Users upload a photo, get a before/after visualization (DALL-E), and receive a detailed cost estimate (Claude API). Optional Stripe payment for viz credits.

**Stack:** Vanilla JS · Supabase (auth + DB) · Stripe · Anthropic Claude API · OpenAI DALL-E · Vercel

## Key File Locations
| File | Purpose |
|------|---------|
| `www/index.html` | Entire frontend — HTML, JS, currently ~4,995 lines |
| `www/css/base.css` | Variables, reset, layout, animations |
| `www/css/components.css` | Reusable UI components |
| `www/css/sections.css` | Page/feature-specific styles |
| `www/api/anthropic.js` | Claude API proxy (Vercel serverless) |
| `www/api/openai-image.js` | DALL-E proxy (Vercel serverless) |
| `www/api/stripe-checkout.js` | Stripe checkout session creator |
| `www/api/stripe-webhook.js` | Stripe webhook handler |
| `vercel.json` | Routing: /api/* + SPA fallback to index.html |
| `docs/migration-audit.md` | Full migration plan — phases 1–8 |
| `docs/architecture.md` | Target module map and data flow |

## Rules

**Reading index.html**
- Never read all of index.html in one pass — use line ranges (`sed -n 'X,Yp'`) or Grep
- Always grep for a function before editing it to get the exact line number

**Secrets and API keys**
- All API keys live in the Supabase `app_config` table, fetched server-side by API routes
- Never put secrets in `.env` files, hardcode them in source, or expose them in client JS
- The Supabase anon key in index.html is safe — it's public by design

**Discover tab images**
- Template images in `ALL_DISCOVER_ITEMS` are AI-generated base64 blobs embedded in the file
- Do NOT replace these with Unsplash URLs or any external URLs under any circumstances
- The category cover images use `cat.items[0].img` — do not change this

**Downloaded files**
- Files downloaded from Claude.ai are named `fixright-INDEX.html`
- Always rename to `index.html` before committing

**Admin**
- Admin email is `jabezzinabu@gmail.com` — excluded from analytics tracking via `SUPER_ADMIN_EMAIL`

**Service worker cache**
- Bump the `CACHE` version in `www/sw.js` every time any JS or CSS file is modified
- New JS/CSS files must also be added to the `STATIC` array in `www/sw.js`
- Failure to do this means users get stale cached files and new code is silently ignored

**Deployment**
- Deploy = `git push origin main` — Vercel auto-deploys on push
- Never push directly to main without reviewing the diff first

**Code changes**
- Surgical changes only — do not refactor beyond the task at hand
- Do not add comments, docstrings, or type hints to code you didn't change
- Do not add error handling for impossible scenarios
- Test by checking https://app.diyestimator.com after deploy

## Supabase Tables
`estimates` · `shared_estimates` · `profiles` · `app_config`

Row-Level Security is enabled. Anonymous users can read `shared_estimates` only.
