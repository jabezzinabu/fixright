# DIY Estimator — Architectural Decisions

## D1 — No build step (plain `<script src>` tags)
**Decision:** Keep vanilla JS with no bundler (Vite, Webpack, etc.)
**Rationale:** The app is already deployed and working. Introducing a build step mid-migration adds significant risk, new tooling to maintain, and Vercel config changes. The migration goal is to reduce context size and make edits safer — not to modernise the stack.
**Consequence:** Extracted JS files must not use ES `import/export`. All modules share the global scope. State is passed via the centralised `state.js` object, not module imports.
**Revisit when:** App reaches a point where bundle size or tree-shaking matters (not yet).

---

## D2 — Single `state.js` object, not per-module state
**Decision:** All ~25 globals consolidated into one `window.appState` object in `state.js`.
**Rationale:** Without ES modules, there's no clean way to scope state per-file. A single named object is the least surprising pattern — it's greppable, debuggable in DevTools, and avoids implicit global pollution.
**Consequence:** All modules read/write `appState.x` instead of bare `x`. This requires a one-time find-and-replace pass per variable during wiring (Phase 3+).
**Alternative rejected:** Per-module `window.estimateState`, `window.vizState` etc. — more complex with no clear benefit at this scale.

---

## D3 — Admin code stays in `admin.js`, lazy-loaded
**Decision:** Admin dashboard extracted to `www/js/admin.js`, loaded only when `isAdmin()` is true.
**Rationale:** Admin HTML and JS is currently served to every user, adding ~400 lines to every session. Lazy-loading eliminates this entirely for 99%+ of users with zero UX impact.
**Implementation:** `<script>` tag for `admin.js` is injected into `<head>` at runtime only after `checkUserRole()` confirms admin access.

---

## D4 — Discover template images stay as embedded base64
**Decision:** `ALL_DISCOVER_ITEMS` template images remain as inline base64 data URIs inside `discover-data.js`.
**Rationale:** These images were AI-generated and curated. Replacing them with external URLs introduces a runtime dependency (network, CDN availability) and risks the images changing or disappearing. The base64 approach works offline and guarantees consistency.
**Consequence:** `discover-data.js` will be large (~1 MB). It should be loaded with `defer` and excluded from `.claudeignore` so Claude never reads it in full.

---

## D5 — CSS split into 3 files, not per-component
**Decision:** `base.css`, `components.css`, `sections.css` — not one file per component.
**Rationale:** At ~1,500 lines total, per-component CSS files would create 15–20 small files with no meaningful benefit. Three files align with natural groupings (reset/global → reusable components → page sections) and keep the `<link>` tag count manageable.

---

## D6 — API routes share Supabase config via `_shared/supabase.js`
**Decision:** Extract the duplicated `SUPABASE_URL` / `SUPABASE_ANON_KEY` from all four API route files into `www/api/_shared/supabase.js`.
**Rationale:** Currently copy-pasted into every API file. Single source of truth reduces the risk of one file having a stale key after rotation.
**When:** Phase 8 (API cleanup) — low priority, no user-facing impact.

---

## D7 — Password reset uses localStorage flag, not URL params
**Decision:** `localStorage.setItem('pwdResetPending', '1')` is set when user clicks "Send Reset Link", consumed at boot to show the reset modal.
**Rationale:** Supabase PKCE flow exchanges the `?code=` param during client init, before `onAuthStateChange` is registered. URL params (`?type=recovery`) may be stripped. The localStorage flag is set client-side before the email is sent and survives any redirect chain.
**Consequence:** If a user sends a reset email but clicks the link on a different browser/device, the flag won't be present. Supabase will still fire `PASSWORD_RECOVERY` in that case (different device = fresh init), so the modal should still appear. Both paths are covered.
