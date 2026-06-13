# DIY Estimator — Task Log

---

## 2026-06-11 — Phase 4: Auth Extraction

**Session goal:** Extract all authentication code from index.html into `www/js/auth.js`.

**Completed:**

- `www/js/auth.js` created — 519 lines covering:
  - Session management: `checkSession`, `onAuthStateChange`, `setUser`, `clearUser`
  - Role system: `checkUserRole`, `grantSuperAdmin`, `grantPro`, `isAdmin`, `isPro`
  - Auth modal: `showAuthModal`, `closeAuthModal`, `switchAuthTab`, `submitAuth`
  - OAuth: `signInWithGoogle`, `signInWithApple`
  - Account: `signOut`, `toggleUserMenu` + outside-click listener
  - Change password: `showChangePasswordModal`, `submitChangePassword`
  - Forgot password: `showForgotPassword`, `hideForgotPassword`, `sendPasswordReset`, `showResetConfirmation`
  - Password reset handler: `checkPasswordResetRedirect`, `showPasswordResetModal`, `submitPasswordReset`
  - Signup popup: `showSignupPopup`, `closeSignupPopup`, `submitPopupSignup`, `showSignupPopupForEstimate`
- index.html: 520 lines removed, reduced 4,582 → 4,062
- `let currentUser = null` and `const SUPER_ADMIN_EMAIL` intentionally left in index.html — both are globals referenced by auth.js and other modules; `SUPER_ADMIN_EMAIL` kept out of auth.js since it is a config constant, not auth logic
- `<script src="js/auth.js">` added to load order after `ui.js`

**Decision:** `SUPER_ADMIN_EMAIL` stays in index.html (alongside Supabase anon key) rather than moving to auth.js. It is app-level config, not auth logic, and both files are equally public.

*Commit this session:*
- `3cf93f6` Phase 4 complete: extract auth to auth.js

**Files created:** `www/js/auth.js`
**Files modified:** `www/index.html`

**Open risks for Phase 5:**
- `currentUser` is still a bare global `var` — Phase 5 (estimate.js) reads it heavily; do not change the declaration until `state.js` is wired in (Phase 8 target)
- `_vizCredits` is referenced in `submitAuth` (inside auth.js) but declared and managed in index.html — this coupling will surface in Phase 5/6 when viz code moves out
- Four monkey-patches still in index.html (`_origSwitchTab`, `_origHandleVizPhoto`, `_origRunVisualize`, `_origRenderResults`, `_origShowSavePrompt`) — not touched until Phase 6
- `EXAMPLE_PHOTOS` and `DISCOVER_CAT_PHOTOS` still in index.html (Unsplash URLs, not base64) — deferred

**Next step:** Phase 5 — extract `estimate.js` (photo upload, `runEstimate`, `renderResults`, drawer, save/load) and `measurement.js` logic portion

---

## 2026-06-11 — Phases 2 & 3: Static Data Extraction + UI/PWA Modules

**Session goal:** Complete Phase 2 (static data constants) and Phase 3 (pure utility modules: ui.js, pwa.js).

**Completed:**

*Phase 2 — Static data constants:*
- `www/js/discover-data.js` — `ALL_DISCOVER_ITEMS` only (base64 AI-generated blobs); loaded with `defer`
- `www/js/measurement-data.js` — `COVERAGE_RATES`, `MATERIAL_KEYWORDS`
- `www/js/retailer-data.js` — `RETAILERS`, `PRICE_SOURCES`, `CONSUMABLE_KEYWORDS`
- `EXAMPLE_PHOTOS` and `DISCOVER_CAT_PHOTOS` left in index.html — both contain Unsplash URLs, not base64; flagged for manual review
- index.html: ~295 lines removed (all three constant blocks spliced out)
- index.html reduced: 4,995 → 4,704 lines

*Phase 3 — Pure utility modules:*
- `www/js/ui.js` — `hideError`, `showError`, `showToast` (+`toastTimer`), `showAuthError`, `showAuthSuccess`, `togglePwd`, `openImgLightbox`, `closeImgLightbox`
- `www/js/pwa.js` — service worker registration, `deferredPrompt`, `showInstallBanner`, `installPWA`, `dismissInstall`, `appinstalled` listener
- Stale dead lightbox block deleted (not extracted): `openImgLightbox` referencing nonexistent element IDs (`lightboxImg`, `lightboxLabel`, `lightbox`), `closeLightbox`, and a broken `keydown` listener that called `closeLightbox` instead of `closeImgLightbox`
- index.html: ~122 lines removed (4 function groups + dead code block)
- index.html reduced: 4,704 → 4,582 lines

*Commits this session:*
- `35c99c2` Phase 2 complete
- `de7f424` Phase 3 complete

**Files created:**
`www/js/discover-data.js`, `www/js/measurement-data.js`, `www/js/retailer-data.js`, `www/js/ui.js`, `www/js/pwa.js`

**Load order (index.html head):**
```
discover-data.js (defer) → measurement-data.js → retailer-data.js → ui.js → <main script> → pwa.js → <second script>
```

**Open risks before Phase 4:**
- Forgot password reset flow still unresolved (unrelated to migration — pre-existing Supabase PKCE issue)
- `EXAMPLE_PHOTOS` and `DISCOVER_CAT_PHOTOS` remain in index.html as Unsplash URLs — consider replacing with local assets or base64 in a future pass
- Four monkey-patches still in index.html (`_origSwitchTab`, `_origHandleVizPhoto`, `_origRunVisualize`, `_origRenderResults`, `_origShowSavePrompt`) — must be replaced with direct wiring in Phase 6
- Phase 4 (auth.js) has medium risk: touches `onAuthStateChange`, session init, password reset redirect — extract as-is without logic changes

**Next step:** Phase 4 — extract `auth.js` (all auth functions, `onAuthStateChange`, password reset, signup popup)

---

## 2026-06-11 — Infrastructure & Phase 1 Setup

**Session goal:** Establish Claude Code infrastructure and complete CSS extraction (Phase 1).

**Completed:**
- `docs/migration-audit.md` — full migration plan, 8 phases
- `docs/architecture.md` — target module map and data flow diagram
- `docs/decisions.md` — 7 key architectural decisions with rationale
- `docs/task-log.md` — this file
- `CLAUDE.md` — Claude Code project instructions (rules, key files, stack)
- `.claudeignore` — minimal ignore list
- `.claude/agents/extractor.md` — agent for extracting sections from index.html
- `.claude/agents/tester.md` — agent for post-deploy verification
- `.claude/commands/phase.md` — slash command to implement a single migration phase
- `.claude/commands/deploy.md` — slash command for commit + push
- `.claude/commands/handoff.md` — slash command to summarise session and update task log
- `www/css/base.css` — extracted from index.html `<style>` block
- `www/css/components.css` — extracted from index.html `<style>` block
- `www/css/sections.css` — extracted from index.html `<style>` block
- `www/js/state.js` — proposed centralised state (not yet wired in)
- index.html `<style>` block removed — CSS now served from external files
- index.html reduced from 6,495 → 4,995 lines

**Open risks:**
- Forgot password reset flow (password recovery modal) still unreliable — see decisions.md D7
- `discover-data.js` (Phase 2) will be large due to base64 blobs — load with `defer`
- Three monkey-patches in index.html (`_origSwitchTab`, `_origHandleVizPhoto`, `_origRunVisualize`, `_origRenderResults`) must be replaced with direct wiring during Phase 6

**Next step:** Phase 2 — extract static data constants (`retailer-data.js`, `discover-data.js`, measurement data portion of `measurement.js`)

---

## 2026-06-11 — Phase 6a: Extract visualize.js

**Session goal:** Extract all visualization-related code from index.html into `www/js/visualize.js`. Scoped to viz only — discover.js and monkey-patch removal deferred to Phase 6b.

**Completed:**

- `www/js/visualize.js` created — 1,063 lines covering:
  - VIZ USAGE TRACKING: `_vizCredits`, `loadVizCredits`, `checkVizCredits`, `deductVizCredit`, `addVizCredits`, `updateFreeNotice`, compat shims (`getVizCount`, `checkFreeVizUsed`, `incVizCount`, `markFreeVizUsed`)
  - VIZ PHOTO HANDLING: `vizPhotoBase64/DataUrl/Blob`, `vizConceptItem/Base64/ImgSrc`, `handleVizPhoto`, `clearVizPhoto`, drag/drop listener
  - RUN VISUALIZATION: `runVisualize`, `newViz`, `downloadViz`, `shareViz`, `showVizPackageModal`, `buyVizPackage`, `checkVizPurchaseReturn` IIFE, `goUpgrade` compat, `getStripeConfig`
  - VIZ UI HELPERS: `setVizLoading`, `setVizProgress`, `setVizStep`, `hideVizError`, `showVizError`
  - ESTIMATE THIS DESIGN (delta analysis): `estimateThisDesign`
  - EDIT & RE-RENDER: `showEditPanel`, `hideEditPanel`, `reRender`
  - GUIDED VIZ FLOW: `vizCurrentStep`, `vizSelectedStyle`, `styleIcons`, `goVizStep`, `selectStyle`
  - EXAMPLE PHOTOS: `EXAMPLE_PHOTOS`, `useExamplePhoto`
  - VIZ TOGGLE MODE: `vizModeEnabled`, `toggleVizMode`
  - COMBINED VIZ: `showCombinedViz`, `openFullViz`, `runCombinedEstimate`, `generateCombinedViz`, `reRenderViz`, `confirmVizAndEstimate`
- `www/index.html` reduced from 3,313 → 2,255 lines (−1,058 net)
- `<script src="js/visualize.js"></script>` added after `estimate.js` in load order

**Decisions:**
- `saveOpenAIKey` / `getOpenAIKey` left in index.html — not viz-specific, misplaced in original
- `EXAMPLE_PHOTOS` moved with `useExamplePhoto` (its only caller) — clarified it is distinct from `ALL_DISCOVER_ITEMS` (base64 blobs) and not subject to the no-Unsplash rule
- Monkey patches (`_origHandleVizPhoto`, `_origRunVisualize`, `_origSwitchTabDiscover`) left untouched per user instruction — to be wired directly in Phase 6b

**Open risks:**
- Three monkey-patches still in index.html wrapping `handleVizPhoto`, `runVisualize`, and `switchTab`; until replaced they must remain or the guided flow and discover tab will break
- `discover.js` extraction not yet done — `filterDiscover`, `renderDiscoverCategories`, `showRoomView`, `openDetailSheet`, carousel, `sheetVisualizeOnMySpace`, `loadConceptFromDiscover`, `clearConcept`, `sheetJustEstimate`, `discoverTryIt`, and `_origSwitchTabDiscover` all remain in index.html
- `saveOpenAIKey` / `getOpenAIKey` orphaned in index.html between `switchTab` and admin dashboard — consider moving to a utils module in a future phase

**Next step:** Phase 6b — extract discover.js, then replace all three monkey-patches with direct calls in the init sequence

---

## Phase 6b — Known Bug

**Known bug:** After the Phase 6b deploy, viz photo upload on the guided flow does not enable the `step1Next` button. Root cause unconfirmed. Investigate after Phase 8 is complete.

---

## 2026-06-12 — Phase 7: Extract admin.js (lazy-loaded)

**Session goal:** Extract all admin dashboard JS from index.html into `www/js/admin.js`, lazy-loaded only when `isAdmin()` returns true.

**Pre-session state:** index.html at 1,966 lines (post-phases 1–6b)

**Completed:**

- Confirmed auth timing before writing any code: `grantSuperAdmin()` in auth.js sets `currentUser.role = 'admin'` and makes `#tabAdmin` visible in the same synchronous call — the tab cannot be clicked before `isAdmin()` returns true, so the top-of-file guard is defense-in-depth, not a timing fix.

- `www/js/admin.js` created — 511 lines with `isAdmin()` guard + `window._adminLoaded = true` at top, covering:
  - **Dashboard:** `loadAdminData`, `loadAdminStats`
  - **Estimates table:** `_adminEstimates`, `_adminEstPage`, `ADMIN_EST_PAGE_SIZE`, `loadAdminEstimates`, `renderAdminEstimatesPage`, `setDemoEstimate`, `adminEstPrev`, `adminEstNext`
  - **User management:** `_allUsers`, `loadAdminUsers`, `renderUsersTable`, `filterUsers`, `confirmDeleteUser`, `grantRoleByEmail`, `setUserRole`
  - **Feature flags:** `toggleDiscoverPublic`, `saveFlag`
  - **Utilities:** `formatRegion`, `copySql`
  - **Health checks:** `runHealthChecks`
  - **Create user:** `adminCreateUser`, `getServiceKey`, `generateTempPassword`
  - **Analytics:** `_analyticsPeriod`, `_analyticsData`, `setAnalyticsPeriod`, `loadAnalytics`, `renderAnalytics`, `renderAnalyticsChart`

- `www/index.html` modified:
  - `switchTab()` updated to lazy-load `admin.js` via `<script>` injection on first admin tab click; `loadAdminData()` called in `onload`. Subsequent tab switches go through the `window._adminLoaded` branch and call `loadAdminData()` directly.
  - All four admin JS blocks removed from both inline `<script>` tags (admin dashboard, health checks, create user, analytics)
  - **1,966 → 1,462 lines (−504)**

**What was intentionally left in index.html:**
- Admin HTML section (`#sectionAdmin`, lines 522–746, ~225 lines) — passive markup only, no logic, no sensitive data; Phase 8 will slim it further
- `SUPER_ADMIN_EMAIL` constant — also referenced by `trackEvent()` which runs for all users; cannot move to admin.js without breaking that function
- Admin tab button (`#tabAdmin`, line 67) — static nav HTML

**Commit:** `da3d015` Phase 7 complete: extract admin.js with lazy-load and isAdmin guard

**Files created:** `www/js/admin.js`
**Files modified:** `www/index.html`, `docs/task-log.md`, `.gitignore`

**Open risks for Phase 8:**

- Admin HTML (`#sectionAdmin`, ~225 lines) is still served to all users on every page load. It is inert markup but contributes to index.html size. Phase 8 could inject it dynamically from admin.js or strip it in the shell-only rewrite.
- `SUPER_ADMIN_EMAIL` is a global in index.html referenced by both `trackEvent()` and admin.js. If state.js is wired up in Phase 8, consider moving it there so admin.js has a clean import path.
- `saveOpenAIKey` / `getOpenAIKey` remain orphaned in index.html between `switchTab` and the now-empty space where the admin block was. They are not admin-specific; Phase 8 should move them to a utils module.
- The `grantSuperAdmin()` dropdown item in auth.js calls `loadAdminData()` directly (auth.js line 85). This is safe today — admin.js is always loaded before the dropdown item could be clicked (tab switch fires first). But if any future code path calls `loadAdminData()` before `admin.js` has loaded, it will throw. The `window._adminLoaded` flag only guards repeat loads, not early calls.
- Phase 6b viz photo bug (guided flow `step1Next` button) still unresolved — carry forward.

**Next step:** Phase 8 — slim index.html to shell only (`<head>`, nav HTML, section wrapper divs, `<script>` init call); full integration regression test
