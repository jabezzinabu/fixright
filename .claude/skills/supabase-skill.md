# Supabase Skill

## Connection

- **URL**: `https://zciyiltkaunbozoedfcr.supabase.co`
- **Anon key**: Hardcoded in `www/js/config.js`, `www/api/anthropic.js`, `www/api/openai-image.js`, `www/api/stripe-checkout.js`, `www/api/stripe-webhook.js`. The anon key is intentionally public — it's safe by design.
- **Service role key**: Stored in `app_config` under key `supabase_service_key`. Only fetched server-side by `stripe-webhook.js` to bypass RLS when updating profiles.
- **Client init** (`config.js:8`): `window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)`. Stored in global `db`. `dbReady = true` on success, falls back to session storage on failure.

---

## Tables

### `estimates`
Stores saved estimates per user.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | auto-generated |
| `user_id` | uuid | FK → auth.users |
| `title` | text | |
| `price_range` | text | e.g. `$850 – $1,400` |
| `difficulty` | text | Easy/Moderate/Challenging/Expert |
| `timeline` | text | |
| `region` | text | e.g. `us-national`, `uk` |
| `approach` | text | `diy`, `contractor`, `both` |
| `description` | text | |
| `materials` | jsonb | array of `{item, qty, unit, cost}` |
| `steps` | jsonb | array of strings |
| `warnings` | jsonb | array of strings |
| `tip` | text | |
| `viz_image` | text | data URL or null |
| `before_image` | text | data URL or null |
| `created_at` | timestamptz | auto |

JS object ↔ DB column mapping: `priceRange` ↔ `price_range`, `desc` ↔ `description`. See `estimate.js:299` and `estimate.js:348`.

Queried with `.limit(25)` and `.order('created_at', { ascending: false })` in `loadSavedEstimates()`.

### `shared_estimates`
Stores estimates for public sharing and the demo estimate.

| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | Human-readable slug, e.g. `__demo__` for the demo |
| `data` | jsonb | Full estimate object |

Read by anon users (no auth required). The demo estimate is stored at `id = '__demo__'` and loaded by `loadDemoEstimate()` (`estimate.js:588`).

Share links: `loadSharedEstimate(shareId)` reads by `id`. The `share.js` file handles creating share records (not detailed here).

### `profiles`
One row per authenticated user.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | = `auth.users.id` |
| `email` | text | |
| `role` | text | `free`, `pro`, `admin` |
| `viz_credits` | integer | Current remaining credits |
| `viz_credits_total` | integer | Lifetime credits purchased |

Created on signup via `profiles.upsert({ id, email, role: 'free', viz_credits: 3, viz_credits_total: 3 })` (`auth.js:162`).

Role check in `auth.js:52`: if `role === 'admin'` → `grantSuperAdmin()`; if `role === 'pro'` → `grantPro()`. If no profile row exists, one is created with `role: 'free'` (`auth.js:64`).

`isPro()` returns `true` for both `pro` and `admin` roles (`auth.js:100`).

### `app_config`
Key/value store for runtime configuration. Accessed via REST API (not Supabase JS client) using the anon key.

Query pattern:
```
GET /rest/v1/app_config?key=eq.<key>&select=value
```

**Known keys**:

| Key | Used by | Purpose |
|---|---|---|
| `anthropic_api_key` | `api/anthropic.js` | Anthropic API key |
| `openai_api_key` | `api/openai-image.js` | OpenAI API key |
| `stripe_secret_key` | `api/stripe-checkout.js` | Stripe secret key |
| `stripe_webhook_secret` | `api/stripe-webhook.js` | Stripe webhook signing secret |
| `supabase_service_key` | `api/stripe-webhook.js` | Service role key for bypassing RLS |
| `estimates_count` | `trackEvent()` | Anonymous usage counter |
| `signups_count` | `trackEvent()` | Signup counter |
| `visualizations_count` | `trackEvent()` | Viz usage counter |

**No RLS on `app_config`**: the anon key can read it. This is intentional — keys are fetched server-side only (API routes). Never expose `app_config` reads to the client browser.

### `viz_purchases`
Purchase log written by `stripe-webhook.js`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | auto |
| `user_id` | uuid | |
| `credits` | integer | Credits purchased in this transaction |
| `created_at` | timestamptz | |

---

## RLS rules

From CLAUDE.md and code behavior:
- **`estimates`**: users can only read/write their own rows (RLS on `user_id`).
- **`shared_estimates`**: anon read allowed (no auth required). Used for share links and the demo.
- **`profiles`**: users can read/write their own row. The webhook uses the service role key to bypass RLS.
- **`app_config`**: anon read allowed (REST API with anon key). No write from client side.

When `dbReady = false` (Supabase unavailable or not configured), estimates fall back to `sessionStorage` under `fixright_saves` (max 20 items). Auth features are unavailable.

---

## Auth integration

Auth is managed by Supabase Auth (`db.auth.*`). The session persists via Supabase's own storage.

`checkSession()` (`auth.js:6`):
1. Registers `onAuthStateChange` listener — handles `PASSWORD_RECOVERY` event by showing the reset modal instead of logging in.
2. Calls `db.auth.getSession()` to trigger PKCE code exchange on return from email links.
3. Calls `setUser()` which: updates UI, calls `checkUserRole()`, loads viz credits, updates the free notice.

**Super admin**: `jabezzinabu@gmail.com` is hardcoded in `auth.js:2` as `SUPER_ADMIN_EMAIL`. This user always gets `admin` role regardless of the DB profile row.

**Google/Apple OAuth**: `signInWithGoogle()` / `signInWithApple()` use `db.auth.signInWithOAuth()`. `redirectTo` is set to `location.origin + location.pathname` (not hardcoded). The Supabase project must have `https://app.diyestimator.com` as an allowed redirect URL — without this, OAuth logins will fail with a redirect URI mismatch error.

**Password reset**: Uses PKCE flow. `sendPasswordReset()` sets `localStorage.pwdResetPending = '1'` before sending the email. On return, `checkPasswordResetRedirect()` checks for `type=recovery` in the hash or query params and shows the reset modal.

---

## Supabase Site URL requirement

The Supabase project's **Site URL** (in Dashboard → Authentication → URL Configuration) must be set to `https://app.diyestimator.com`. This is required for:
- OAuth redirects (Google, Apple) to be allowed.
- Password reset email links to redirect to the correct domain.
- Email confirmation links to resolve correctly.

If the Site URL is `localhost:3000` or wrong, production auth redirects will fail silently or with `redirect_uri_mismatch`.

---

## Anonymous user ID

`getUserId()` (`config.js:32`): generates and persists a random `user_XXXX` ID in `localStorage` under `fixright_uid`. Used as a fallback `user_id` in `currentEstimate` when not signed in. This ID is only used locally — it does not correspond to any Supabase auth user.

---

## Gotchas

- **`anthropic.js` body size limit is 10MB** (`api/anthropic.js:2`) — needed because base64 images in the request body can be large. The 1MB limit in `stripe-checkout.js` is fine for JSON-only payloads.
- **`stripe-webhook.js` fetches `supabase_service_key` from `app_config` using the anon key** — if the anon key doesn't have read access to `app_config`, the webhook falls back to the anon key for the DB write, which may fail RLS on `profiles`. Confirm `app_config` has anon read enabled.
- **No `viz_purchases` read in the client** — the table is write-only from the webhook. There's no UI to show purchase history.
- **`app_config` counters are incremented with `trackEvent()`** but the increment mechanism is not visible in these files — it presumably does a PATCH or RPC call. If `app_config` RLS doesn't allow anon writes, tracking silently fails (no error surfaced).
- **`db.raw` is accessed in `addVizCredits()` (client side, `visualize.js:33`)** — `db.raw ? undefined : undefined` is dead code; it's always `undefined` regardless. The `viz_credits_total` is updated in a second round-trip below it.
