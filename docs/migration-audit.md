# DIY Estimator — Migration Audit

## Current Structure

```
fixright/
├── www/
│   ├── index.html          # 6,490 lines, ~1.4 MB — entire app
│   ├── legal.html
│   ├── viz-test.html
│   ├── sw.js               # Service worker (PWA)
│   ├── manifest.json
│   └── api/                # Vercel serverless functions
│       ├── anthropic.js    # Claude API proxy (51 lines)
│       ├── openai-image.js # DALL-E proxy (76 lines)
│       ├── stripe-checkout.js (83 lines)
│       ├── stripe-webhook.js  (164 lines)
│       └── config.js       # Safe public config (9 lines)
├── vercel.json             # Routing: /api/* + SPA fallback
└── package.json
```

**External dependencies (CDN only):**
- `@supabase/supabase-js@2` (auth + DB)
- Google Fonts (Playfair Display, DM Sans)

---

## What index.html Contains

### Layout (lines 1–1552)
| Lines | Content |
|-------|---------|
| 1–19 | `<head>`, font imports, Supabase SDK |
| 20–1519 | One `<style>` block (~1,500 lines of CSS) |
| 1520–1552 | App shell: header, nav, bottom tab bar |

### HTML Sections (lines 1553–4345)
| Lines | Section |
|-------|---------|
| 1553–1568 | App tabs (Estimate / Visualize / Discover) |
| 1569–1588 | Saved drawer + shared banner |
| 1589–1794 | **Estimate section** — hero, form card, photo upload, submit, results |
| 1795–1958 | **Visualize section** — style picker, viz result, guided flow |
| 1959–2017 | **Discover section** — feed + detail sheet overlay |
| 2018–2251 | **Admin section** — dashboard, users, estimates, analytics |
| 2252–2281 | Share modal |
| 4233–4345 | Auth modal, signup popup, upgrade modal |

### JavaScript Block 1 (lines 2282–4229) — ~1,950 lines
| Lines | Module |
|-------|--------|
| 2282–2306 | Config + Supabase init |
| 2314–2343 | State variables (~25 globals) |
| 2344–2413 | Boot sequence, session check |
| 2414–2467 | Photo handling (estimate tab) |
| 2468–2545 | Estimate runner (calls `/api/anthropic`) |
| 2546–2704 | Render results (materials, steps, warnings, retailer badges) |
| 2705–2816 | Supabase save/load (estimates table) |
| 2817–2892 | Drawer (saved estimates) |
| 2893–2925 | Actions (PDF, copy, edit) |
| 2926–3007 | Share (short links via `shared_estimates`) |
| 3008–3030 | UI helpers (toast, showError, showSuccess) |
| 3031–3272 | Auth (signup, signin, Google/Apple OAuth, password reset) |
| 3273–3300 | Tab switching |
| 3301–3372 | Viz usage tracking + credit system |
| 3373–3451 | Viz photo handling |
| 3452–3598 | Run visualization (calls `/api/openai-image`) |
| 3599–3686 | Upgrade modal + Stripe redirect |
| 3687–3716 | Viz UI helpers |
| 3717–3900 | Delta analysis (estimate from viz result) |
| 3901–3931 | Edit + re-render estimate |
| 3932–4228 | Admin dashboard (estimates, users, analytics) |

### JavaScript Block 2 (lines 4346–6485) — ~2,140 lines
| Lines | Module |
|-------|--------|
| 4347–4414 | PWA (service worker, install prompt) |
| 4415–4559 | Guided viz flow (multi-step UI) |
| 4560–4940 | Discover feed (items, categories, detail sheet, carousel) |
| 4941–4992 | Admin health checks |
| 4993–5060 | Viz toggle + estimate count (free tier) |
| 5061–5353 | Combined viz+estimate runner |
| 5354–5413 | Admin: create user |
| 5414–5793 | Measurement skill (coverage rates, material detection, dimension panel) |
| 5794–5897 | Retailer data (RETAILERS, PRICE_SOURCES constants) |
| 5898–5954 | Change password flow |
| 5955–6039 | Forgot password flow |
| 6040–6118 | Password reset handler |
| 6119–6124 | Anonymous usage tracking |
| 6125–6299 | Stripe redirect handler + viz credit sync |
| 6300–6369 | Signup popup |
| 6370–6457 | Demo estimate (load/set via shared_estimates) |
| 6458–6485 | renderResults override (viz teaser injection) |

---

## Main Problems

1. **Size** — 6,490 lines in one file. Any Claude session that reads it consumes ~3,500 tokens just loading context.
2. **Dual script blocks** — Logic is split across two `<script>` tags with no clear boundary reason. Functions reference each other across blocks.
3. **~25 global variables** — `currentUser`, `imageBase64`, `vizPhotoBase64`, `currentEstimate`, etc. All shared by every module implicitly.
4. **CSS monolith** — 1,500-line `<style>` block with no scoping. Changes to one section risk breaking another.
5. **Monkey-patching** — Three places use `const _orig = fn; function fn() { _orig(); ... }` to extend behavior (viz teaser, guided flow, discover). Fragile and order-dependent.
6. **Admin embedded in user app** — Admin dashboard HTML and JS lives inside the same file served to all users.
7. **Constants mixed with logic** — `RETAILERS`, `COVERAGE_RATES`, `MATERIAL_KEYWORDS`, `ALL_DISCOVER_ITEMS`, `EXAMPLE_PHOTOS` are large inline data objects that bloat every session.
8. **Duplication in API files** — `SUPABASE_URL` and `SUPABASE_ANON_KEY` are copy-pasted into every `api/*.js` file.

---

## Recommended Target Architecture

```
www/
├── index.html              # Shell only: <head>, nav, section placeholders (~150 lines)
├── css/
│   ├── base.css            # Reset, variables, typography, layout
│   ├── components.css      # Form, card, modal, button, badge styles
│   ├── sections.css        # Per-section styles (estimate, viz, discover, admin)
│   └── animations.css      # Transitions, loading states
├── js/
│   ├── config.js           # Supabase credentials, constants
│   ├── state.js            # Global state object (single source of truth)
│   ├── auth.js             # Auth, session, password reset, signup popup
│   ├── estimate.js         # Form, photo upload, API call, render results
│   ├── visualize.js        # Viz flow, DALL-E call, viz result, guided steps
│   ├── discover.js         # Discover feed, detail sheet, categories
│   ├── admin.js            # Admin dashboard (lazy-loaded, gated)
│   ├── share.js            # Share modal, short links
│   ├── drawer.js           # Saved estimates drawer
│   ├── measurement.js      # Coverage rates, material detection, dimension panel
│   ├── retailer-data.js    # RETAILERS, PRICE_SOURCES constants
│   ├── discover-data.js    # ALL_DISCOVER_ITEMS, DISCOVER_CAT_PHOTOS constants
│   ├── stripe.js           # Stripe redirect handler, upgrade modal
│   ├── pwa.js              # Service worker, install prompt
│   └── ui.js               # Toast, tab switching, lightbox, UI helpers
├── api/                    # Unchanged (already separated)
│   └── _shared/
│       └── supabase.js     # Shared Supabase config for all API routes
└── sw.js                   # Unchanged
```

---

## Migration Phases

### Phase 1 — Extract CSS (zero risk)
Extract the `<style>` block to external files. No JS changes. No behavior changes.
- Create `css/base.css`, `css/components.css`, `css/sections.css`, `css/animations.css`
- Replace `<style>` with `<link>` tags in index.html
- **Test:** Full visual regression pass

### Phase 2 — Extract static data (zero risk)
Move large constant objects out of JS blocks into separate files.
- `retailer-data.js` (RETAILERS, PRICE_SOURCES, CONSUMABLE_KEYWORDS)
- `discover-data.js` (ALL_DISCOVER_ITEMS, DISCOVER_CAT_PHOTOS, EXAMPLE_PHOTOS)
- `measurement.js` (COVERAGE_RATES, MATERIAL_KEYWORDS — data portion only)
- Load via `<script src>` before the main script block
- **Test:** Estimate runs, Discover tab loads, retailer badges appear

### Phase 3 — Extract pure utility modules (low risk)
Functions with no interdependencies:
- `ui.js` — showToast, showAuthError, showAuthSuccess, togglePwd, lightbox
- `pwa.js` — service worker registration, install prompt
- `share.js` — share modal, URL shortener
- **Test:** Toast shows, share link works, PWA install prompt appears

### Phase 4 — Extract auth (medium risk)
- `auth.js` — all auth functions, onAuthStateChange, password reset, signup popup
- Depends on: `state.js` (currentUser), `ui.js` (toast/error helpers)
- Must keep `setUser()` / `clearUser()` accessible to estimate and viz modules
- **Test:** Sign in, sign up, Google OAuth, forgot password, change password

### Phase 5 — Extract estimate flow (medium risk)
- `estimate.js` — photo upload, runEstimate(), renderResults(), drawer, save/load
- `measurement.js` — measurement skill logic
- Depends on: state, auth (currentUser), ui
- **Test:** Full estimate flow end-to-end including save

### Phase 6 — Extract visualize + discover (medium risk)
- `visualize.js` — viz flow, guided steps, DALL-E call, viz result display
- `discover.js` — feed, categories, detail sheet, carousel
- Remove monkey-patches; wire directly into init sequence
- **Test:** Viz generation, guided flow, discover detail sheet

### Phase 7 — Extract admin (low risk, high isolation value)
- `admin.js` — lazy-loaded only when `isAdmin()` returns true
- Eliminates ~400 lines from every user session
- **Test:** Admin dashboard, user list, estimate review, analytics

### Phase 8 — Slim index.html
- index.html becomes shell only: `<head>`, nav HTML, section wrapper divs, `<script>` init call
- **Test:** Full integration regression

---

## Files/Folders to Create

```
docs/
├── migration-audit.md      # This file
├── architecture.md         # Living doc: module map, data flow diagram
├── decisions.md            # Why choices were made (Supabase vs Firebase, etc.)
└── task-log.md             # Per-session change log

CLAUDE.md                   # Claude Code instructions for this project
.claudeignore               # Files Claude should not read by default
```

---

## Recommended Claude Code Setup

### CLAUDE.md (place at repo root)
```markdown
# DIY Estimator — Claude Code Instructions

## Project
Single-page AI app: photo upload → visualization (DALL-E) → cost estimate (Claude) → Stripe payment.
Stack: Vanilla JS, Supabase (auth + DB), Stripe, Vercel.

## Key files
- www/index.html — entire frontend (6,490 lines during migration)
- www/api/ — Vercel serverless functions (AI proxies, Stripe)
- vercel.json — routing config
- docs/migration-audit.md — migration plan

## Rules
- Never read all of index.html in one pass — use line ranges or Grep
- Always grep for a function before editing it
- Do not add comments to unchanged code
- Do not refactor beyond the task at hand
- Test by checking app behavior at app.diyestimator.com after each deploy
- Deploy = git push origin main (Vercel auto-deploys)
```

### .claudeignore
```
.git/
node_modules/
www/api/package-lock.json
capacitor.config.json
# During migration, ignore large data files once extracted:
# www/js/discover-data.js
# www/js/retailer-data.js
```

### Recommended Slash Commands (.claude/commands/)

`/deploy.md`
```
Stage all changes, commit with message: "$ARGUMENTS", push to origin main.
```

`/grep-fn.md`
```
Search index.html for the function named $ARGUMENTS and return its line number and first 10 lines.
```

`/phase.md`
```
Read docs/migration-audit.md Phase $ARGUMENTS, then implement that phase only. Do not proceed to next phase.
```

### Recommended Agents (.claude/agents/)

`extractor` — Reads a named section of index.html by line range, writes it to a target file, and removes it from index.html. Used for phases 1–8.

`tester` — Fetches app.diyestimator.com and checks that key elements render (form, results, viz button). Runs after each phase.

---

## Risks and Precautions

| Risk | Mitigation |
|------|-----------|
| Monkey-patches break after extraction | Replace with direct calls during Phase 6; document the three patch sites (lines ~4226, ~4537, ~4548, ~6458) |
| Global state references break | Create `state.js` as single object before extracting any module; update all reads/writes in one pass |
| Auth race conditions (already present) | Do not change auth logic during migration; extract as-is |
| Admin section exposes sensitive routes | Add `isAdmin()` gate at top of `admin.js`; lazy-load with dynamic `import()` |
| CSS specificity breaks on split | Extract in order: base → components → sections; test visually after each |
| Vercel caching serves stale JS | Add cache-busting query strings or use hashed filenames in production |

---

## Next Prompt to Run

After reviewing this audit, run:

> "Implement Phase 1 of the migration plan in docs/migration-audit.md. Extract the CSS from index.html into www/css/base.css, www/css/components.css, www/css/sections.css, and www/css/animations.css. Replace the style block in index.html with link tags. Do not change any HTML or JS. Do not deploy yet — tell me when it's ready to review."
