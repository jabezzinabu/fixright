# Estimate Skill

## Overview
The estimate feature lives in `www/js/estimate.js`. It takes a photo and/or description, calls Claude via `/api/anthropic`, parses a JSON response, and renders a full cost estimate with a materials table, steps, warnings, and retailer links. Estimates can be saved to Supabase or session storage.

---

## runEstimate() — entry point (`estimate.js:56`)

1. Validates: requires at least a description OR a photo (`imageBase64`).
2. Calls `checkEstPaywall()` — currently always returns `true` (paywall disabled, `estimate.js:530`).
3. Reads `region` and `approach` from the form.
4. Calls `getMeasurementContext()` to get pre-calculated quantities (see below).
5. Builds the system prompt (`estimate.js:73`):
   - Specifies JSON schema with `title`, `priceRange`, `difficulty`, `timeline`, `materials[]`, `steps[]`, `warnings[]`, `tip`.
   - Injects `region` and `approach` formatting instructions.
   - If `measurementContext` is non-empty, appends it with the header `IMPORTANT — LOCKED MEASUREMENT DATA (use these exact quantities, do not recalculate)`.
6. Builds `userContent` array: optional image block (base64 JPEG), then a text block with the description. The measurement context is also appended to the user text.
7. POSTs to `/api/anthropic` with model `claude-sonnet-4-20250514`, `max_tokens: 4000`.
8. Strips markdown fences from the response, parses JSON, and stores the result in `currentEstimate`.
9. Calls `renderResults()` and `trackAnonymousEstimate()`.

---

## getMeasurementContext() (`measurement.js:268`)

Returns `_calculatedQuantities.promptText` if the user entered dimensions, otherwise `''`.

`_calculatedQuantities` is set by `onDimInput()` → `calculateQuantities()` whenever a dimension field changes. It is cleared when the description changes to a different material type or the panel is hidden.

The `promptText` is a plain-English string like:
```
ACCURATE PAINT CALCULATION (do not recalculate): Total wall area = 240 sq ft. At 400 sq ft per gallon: 1 coat = 0.6 gallons, 2 coats = 1.2 gallons. Use these exact figures.
```

---

## Coverage rates and material detection (`measurement.js`, `measurement-data.js`)

**Detection** (`measurement.js:14`): `detectMaterial(desc)` scans the description against `MATERIAL_KEYWORDS` (in `measurement-data.js`). First match wins. Returns `null` if no match. Debounced at 600ms on every keystroke.

**Supported materials** and their calculation logic (`measurement.js:116`):

| Material | Dims required | Logic |
|---|---|---|
| `paint` | height, width, length | `2*(w*h) + 2*(l*h)` wall area → gallons (400 sq ft/gal) or litres (10 m²/L) |
| `wallpaper` | height, width, length | Same wall area → rolls at 5 m²/roll + 10% pattern waste |
| `floor_tile`, `hardwood`, `carpet`, `decking` | width, length | `w*l` area + 10% wastage |
| `mulch`, `topsoil` | width, length | `area * 0.075` m³ (75mm depth) or `area * 0.0031` cu yd |
| `gravel` | width, length | `area * 0.05` m³ (50mm depth); also outputs tonnes (×1.5) |
| `concrete` | width, length | `area * 0.1` m³ (100mm slab) or `area * 0.0031` cu yd |

Metric vs imperial is determined by `isMetricRegion()`: regions `uk`, `au`, `eu` are metric.

---

## renderResults() (`estimate.js:134`)

1. Fills title, price range (with currency symbol substitution via `getCurrencySymbol()`), difficulty, and timeline.
2. Builds the materials table row by row. For each material:
   - Calls `buildRetailerBadges(item)` → generates BUY links for Home Depot, Lowe's, etc. depending on region (`RETAILERS` from `retailer-data.js`). Consumable items (tape, screws, etc.) get no badges — detected via `isConsumable()` checking `CONSUMABLE_KEYWORDS`.
   - Accumulates a running `total` and appends a totals row if `total > 0`.
3. Appends a price source line via `getPriceSource()`.
4. Renders the steps list (`<li>` with numbered spans).
5. Renders warnings as `.info-box.warning` divs and tip as `.info-box.tip`.
6. Manages collapsible section state (adds `.open` class to materials, steps, warnings).
7. Shows the `vizTeaser` promo if the user has a photo but no viz yet (and it's not a demo estimate).
8. Shows before/after images if `est.vizImage` or `est.beforeImage` are present.
9. Adds `.visible` to `#results` and smooth-scrolls to it.

---

## Save / Load flow

### saveEstimate() (`estimate.js:293`)
- Requires `currentUser` (else shows auth modal).
- Builds a row with all estimate fields plus `viz_image` and `before_image`.
- If `dbReady`: inserts into `estimates` table, then refreshes the drawer via `loadSavedEstimates()`.
- Fallback: calls `saveLocal()` → stores up to 20 estimates in `sessionStorage` under key `fixright_saves`.

### loadSavedEstimates() (`estimate.js:333`)
- Only runs if the drawer is open (`drawerOpen`).
- Queries `estimates` table filtered by `user_id`, ordered by `created_at DESC`, limited to 25.
- Maps DB columns to the JS object shape (`price_range` → `priceRange`, etc.).

### loadSaved(id) (`estimate.js:433`)
- Finds the estimate by id in `savedEstimates`.
- Calls `renderResults()`.
- Restores the before photo to `#photoPreview` and the viz image to `#vizResult`.

### loadSharedEstimate(shareId) (`estimate.js:480`)
- Queries `shared_estimates` table by `id`, reads the `data` JSONB column.
- Waits up to 3 seconds for `dbReady` before giving up.

---

## Free tier / paywall

`checkEstPaywall()` (`estimate.js:530`) always returns `true` — the paywall is disabled. The old count-based logic (`getEstCount`, `incEstCount`) still exists but is unused.

`trackAnonymousEstimate()` calls `trackEvent('estimates_count')` which increments a counter in `app_config`.

---

## Known issues / gotchas

- **`checkEstPaywall` is hardcoded to `true`** (`estimate.js:530`). If a paywall is ever re-enabled, this is the only gate and it must also handle anonymous users correctly.
- **JSON parse brittleness**: The raw Claude response has markdown fences stripped (`estimate.js:117`) but if Claude ever returns anything other than a plain JSON object (e.g. a prose apology), parsing will throw and the error handler will show a generic message with no retry hint.
- **`getMeasurementContext` only injects `_calculatedQuantities.promptText`** — if the user skips the dimension panel (`skipDimensions()`), `_dimSkipped` is set and the panel won't reappear for 10 seconds even if the description changes. This can silently skip measurement injection.
- **`vizResultImageSrc` and `vizPhotoDataUrl` are globals** shared between estimate and viz tabs. Loading a saved estimate that has `vizImage` will set `vizResultImageSrc` globally, which can bleed into a fresh viz run if the user doesn't clear the photo.
- **`saveEstimate` has no duplicate guard** — clicking Save twice quickly will insert two rows.
- **`loadSharedEstimate` polling loop** (`estimate.js:482`) uses `tries < 20` with 150ms intervals = max 3 seconds. If Supabase takes longer to init (slow connection), the share link silently fails.
