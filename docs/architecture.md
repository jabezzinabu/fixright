# DIY Estimator — Target Architecture

## Module Map (post-migration)

```
www/
├── index.html              # Shell only: <head>, nav HTML, section wrappers (~150 lines)
├── css/
│   ├── base.css            # Variables, reset, body, layout, animations
│   ├── components.css      # Shared UI: header, modals, auth, toast, badges
│   └── sections.css        # Feature CSS: estimate, viz, discover, admin
├── js/
│   ├── config.js           # SUPABASE_URL, SUPABASE_ANON_KEY, constants
│   ├── state.js            # Centralised state object (proposed — see file header)
│   ├── auth.js             # checkSession, setUser, clearUser, password flows
│   ├── estimate.js         # Photo upload, runEstimate(), renderResults(), drawer
│   ├── visualize.js        # Viz flow, DALL-E call, guided steps, viz result
│   ├── discover.js         # Discover feed, categories, detail sheet, carousel
│   ├── admin.js            # Admin dashboard (lazy-loaded, gated by isAdmin())
│   ├── share.js            # Share modal, short links via shared_estimates
│   ├── measurement.js      # Coverage rates, material detection, dimension panel
│   ├── retailer-data.js    # RETAILERS, PRICE_SOURCES, CONSUMABLE_KEYWORDS
│   ├── discover-data.js    # ALL_DISCOVER_ITEMS, DISCOVER_CAT_PHOTOS (base64 blobs)
│   ├── stripe.js           # Stripe redirect, upgrade modal, viz credit sync
│   ├── pwa.js              # Service worker registration, install prompt
│   └── ui.js               # Toast, tab switching, lightbox, UI helpers
└── api/                    # Vercel serverless (unchanged)
    ├── _shared/supabase.js # Shared Supabase config (extract from duplication)
    ├── anthropic.js
    ├── openai-image.js
    ├── stripe-checkout.js
    ├── stripe-webhook.js
    └── config.js
```

## Data Flow

```
User Action
    │
    ▼
index.html (event handlers)
    │
    ├─── estimate.js ──► /api/anthropic ──► Claude API
    │         │
    │         └─► renderResults() ──► retailer-data.js
    │
    ├─── visualize.js ─► /api/openai-image ──► DALL-E API
    │         │
    │         └─► estimate.js (auto-run after viz)
    │
    ├─── auth.js ──────► Supabase Auth
    │         │
    │         └─► state.js (currentUser, credits)
    │
    ├─── discover.js ──► discover-data.js (static)
    │
    ├─── stripe.js ────► /api/stripe-checkout ──► Stripe
    │         │
    │         └─► Supabase profiles (viz_credits)
    │
    └─── admin.js ─────► Supabase (estimates, profiles, app_config)
```

## State Flow

All mutable state lives in `state.js` (post-migration). Modules import from state
and call setters rather than reading globals directly.

```
state.js
  ├── auth:      currentUser, authMode
  ├── estimate:  imageBase64, imageMediaType, currentEstimate, savedEstimates
  ├── viz:       vizPhotoBase64, vizPhotoDataUrl, vizPhotoBlob,
  │              vizResultImageSrc, vizConceptItem, vizConceptBase64,
  │              vizConceptImgSrc, vizCurrentStep, vizSelectedStyle,
  │              vizModeEnabled
  ├── discover:  activeDiscoverCategory, _activeSheetItem,
  │              _carouselIdx, _carouselItems
  ├── admin:     _adminEstimates, _adminEstPage, _allUsers,
  │              _analyticsPeriod, _analyticsData
  ├── ui:        drawerOpen, toastTimer, _currentShareUrl,
  │              _signupPopupShown, deferredPrompt
  ├── db:        db, dbReady
  └── measurement: _detectedMaterial, _dimSkipped,
                   _calculatedQuantities, _descInputTimer
```

## API Routes

| Route | Trigger | External call |
|-------|---------|---------------|
| `POST /api/anthropic` | Estimate form submit | Anthropic Claude |
| `POST /api/openai-image` | Viz generate | OpenAI DALL-E |
| `POST /api/stripe-checkout` | Upgrade button | Stripe Checkout |
| `POST /api/stripe-webhook` | Stripe event | Supabase write |
| `GET /api/config` | Boot (unused effectively) | None |

## Key Constraints

- **No build step** — plain `<script src>` tags, no bundler. Modules must not use ES `import/export` unless a bundler is added.
- **Vercel SPA routing** — all non-`/api` paths rewrite to `index.html` via `vercel.json`.
- **Supabase RLS** — anon users can only read `shared_estimates`. All writes require auth.
- **Base64 images** — `ALL_DISCOVER_ITEMS` template images are embedded base64 blobs. They must stay in `discover-data.js` and not be fetched from URLs.
