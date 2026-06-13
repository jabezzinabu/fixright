# Viz Skill

## Overview
The visualization feature lives in `www/js/visualize.js`. It takes a user's room photo and a description (or a Discover concept), uses Claude to craft a precise editing prompt, then calls OpenAI `gpt-image-1` via `/api/openai-image` to produce a photorealistic before/after render. Credits are consumed per visualization and sold via Stripe.

---

## runVisualize() — main flow (`visualize.js:145`)

1. Requires `currentUser` (shows auth modal if not signed in).
2. Calls `checkFreeVizUsed()` → `loadVizCredits()`. If user has no credits and is not Pro, shows `upgradeModal`.
3. Reads `vizDesc` and ensures `vizPhotoBase64` is set.
4. If `vizSelectedStyle` is set and not already in the description, prepends it to `vizDesc`.

**Step 1 — Claude prompt refinement** (`visualize.js:165`):
- Sends `vizPhotoBase64` to `/api/anthropic` (`claude-sonnet-4-20250514`, max 300 tokens).
- If `vizConceptBase64` is set (concept image from Discover), sends both images with a compare-and-apply instruction.
- Otherwise sends the single photo with a renovation-description instruction.
- Falls back to a hardcoded `editPrompt` string if the Claude call fails.

**Step 2 — OpenAI image edit** (`visualize.js:211`):
- POSTs `{ prompt, imageBase64, size: '1024x1024' }` to `/api/openai-image`.
- Response: `imgData.data[0].b64_json` (preferred) or `imgData.data[0].url`.
- Stores result in global `vizResultImageSrc`.

**After success**:
- Renders before/after grid in `#vizBeforeAfter`.
- Calls `incVizCount()` → `deductVizCredit()` to decrement the DB balance.
- If not Pro, shows `upgradeModal` after a delay (configurable via `flag_upgradeDelay` in localStorage, default 4s).

---

## Credit system

All credit state is cached in the module-level `let _vizCredits = 0`.

| Function | What it does |
|---|---|
| `loadVizCredits()` | Reads `profiles.viz_credits` for `currentUser.id`; updates `_vizCredits`; returns the count |
| `checkVizCredits()` | Calls `loadVizCredits()`, returns `true` if `_vizCredits > 0` |
| `deductVizCredit()` | Optimistically decrements `_vizCredits`, then PATCHes `profiles` |
| `addVizCredits(amount)` | Increments `_vizCredits` and `viz_credits_total` in `profiles` via two sequential queries (fetch current, then PATCH) |
| `checkFreeVizUsed()` | Returns `true` if `_vizCredits <= 0` (no free credits remaining) |

**Backward compat shims** (`visualize.js:43`): `getVizCount`, `incVizCount`, `markFreeVizUsed` all delegate to the credit system. `getVizCount()` returns `0` if credits > 0, `1` if not.

**UI update** (`updateFreeNotice()`): Updates `#vizFreeNotice` ("3 visualizations remaining") and `#vizCreditBadge` in the header. Called after login, after credit changes, and after purchases.

New signups get 3 free viz credits — set in `auth.js:162` via `profiles.upsert({ viz_credits: 3, viz_credits_total: 3 })`.

---

## Guided viz flow (2-step)

`vizCurrentStep` tracks state (1 or 2). `goVizStep(step)` shows/hides `.viz-step-panel` panels.

- **Step 1**: Upload photo (`handleVizPhoto()`), optionally pick a concept from Discover.
- **Step 2**: Write a description. `vizSelectedStyle` (set by `selectStyle()`) is prepended to the description before the API call if not already present.

`vizConceptItem` and `vizConceptImgSrc`/`vizConceptBase64` hold the selected Discover concept. These are injected into the Claude prompt-refinement step when present.

---

## estimateThisDesign() — chains into estimate flow (`visualize.js:418`)

This is a 3-skill pipeline:
1. **Viz** (already done — `vizResultImageSrc` exists)
2. **Delta analysis**: sends BEFORE + AFTER to Claude (`claude-sonnet-4-20250514`, max 400 tokens). Parses `ADDED:`, `CHANGED:`, `EXISTING (exclude from estimate):` lines from the response.
3. **Estimate**: sets `imageBase64` to the after image, writes the delta description into `#description`, switches to the estimate tab, and auto-calls `runEstimate()`.

If delta analysis fails or before image is unavailable, falls back to the concept/description text.

---

## checkStripeRedirect() (`visualize.js:1068`)

Called on page load. Checks `?stripe=success` or `?stripe=cancel`.

- On `success`: shows a welcome toast, then queries `profiles.role` to refresh `currentUser.role` and calls `grantSuperAdmin()` if promoted. **This is the legacy subscription flow** — viz package purchases use `?viz_purchased=N` instead (handled by the IIFE at `visualize.js:350`).
- On `cancel`: clears the URL param, shows a cancellation toast.

**Viz package return** (`visualize.js:350`):
The IIFE `checkVizPurchaseReturn()` runs immediately. Checks `?viz_purchased=N`. Clears the URL, then waits 1.5s and calls `loadVizCredits()` + `updateFreeNotice()`. **Credits are not added here** — they are added server-side by the webhook. This just refreshes the display.

---

## VIZ_PRICE_IDS (`visualize.js:304`)

```js
3  credits → price_1TgQlHRU8c4qhAdsQSgEKrzb
5  credits → price_1TgQlDRU8c4qhAdsMUzLDf03
10 credits → price_1TgQl8RU8c4qhAdskDOq6ju5
25 credits → price_1TgQl2RU8c4qhAds1Opw75gL
```

These must match `VIZ_CREDIT_MAP` in `stripe-checkout.js` and `stripe-webhook.js`.

---

## Known issues / gotchas

- **`addVizCredits()` double-write** (`visualize.js:27–39`): The client-side `addVizCredits()` does two round-trips to Supabase — one PATCH and then a SELECT + PATCH for `viz_credits_total`. This is only called from the client; the webhook uses its own server-side version. The `db.raw ? undefined : undefined` line (`visualize.js:33`) is dead code that does nothing.
- **`_freeVizUsed` used in `reRender()`** (`visualize.js:614`): This variable is referenced but never declared in the file — it must be a stale reference to the old free-tier flag system. `reRender()` will always pass the paywall check for logged-in users since `_freeVizUsed` is `undefined` (falsy).
- **`incVizCount()` called before error check** (`visualize.js:240`): Credits are deducted immediately after the image returns, before the result is actually shown. If rendering fails after this point, the credit is lost.
- **Cross-tab state bleed**: `vizResultImageSrc` and `vizPhotoBase64`/`vizPhotoDataUrl` are globals. Running a viz, then switching to the estimate tab and loading a saved estimate that has no viz, will leave `vizResultImageSrc` pointing at the old viz. `newEstimate()` does not clear viz globals.
- **Concept image CORS**: `useExamplePhoto()` fetches Unsplash images via `img.crossOrigin = 'anonymous'`. If Unsplash ever rejects the CORS preflight, the canvas `toDataURL()` call will throw a SecurityError silently caught only by `img.onerror`.
- **`generateCombinedViz()` does not deduct credits on success** — it calls `incVizCount()` which delegates to `deductVizCredit()`, but there is no paywall check at the start of `generateCombinedViz()`. The check is in `runCombinedEstimate()` which calls it, so it is gated, but only when entered through that path.
