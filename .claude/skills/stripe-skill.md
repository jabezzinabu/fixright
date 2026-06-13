# Stripe Skill

## Overview
Stripe handles one-time viz credit purchases (3/5/10/25 credits). There is legacy subscription ("Pro") support in the webhook but no active subscription price IDs are wired up in the UI. The full flow: user clicks a package button → `buyVizPackage()` → `/api/stripe-checkout` → Stripe hosted checkout → webhook → Supabase credit update → user lands back on `?viz_purchased=N`.

---

## Price IDs

Defined in both `visualize.js` and `stripe-checkout.js`/`stripe-webhook.js`:

```
3  credits → price_1TgQlHRU8c4qhAdsQSgEKrzb
5  credits → price_1TgQlDRU8c4qhAdsMUzLDf03
10 credits → price_1TgQl8RU8c4qhAdskDOq6ju5
25 credits → price_1TgQl2RU8c4qhAds1Opw75gL
```

If you add a new package, update `VIZ_PRICE_IDS` in `visualize.js` AND `VIZ_CREDIT_MAP` in both `stripe-checkout.js` and `stripe-webhook.js`.

---

## Checkout flow

### 1. Upgrade modal
`showVizPackageModal()` / `showUpgradeModal()` (`visualize.js:296`) opens `#upgradeModal`. Requires `currentUser` — redirects to signup popup if not signed in.

### 2. buyVizPackage(credits) (`visualize.js:311`)
- Looks up `priceId` from `VIZ_PRICE_IDS`.
- POSTs to `/api/stripe-checkout` with:
  ```json
  {
    "priceId": "price_...",
    "userId": "uuid",
    "email": "user@example.com",
    "mode": "payment",
    "vizCredits": 3,
    "successUrl": "https://app.diyestimator.com/?viz_purchased=3",
    "cancelUrl": "current URL"
  }
  ```
- Redirects to `data.url` (Stripe hosted checkout page).

### 3. /api/stripe-checkout (`stripe-checkout.js`)
- Fetches `stripe_secret_key` from `app_config`.
- Detects `mode === 'payment'` or a price ID in `VIZ_CREDIT_MAP` → uses Stripe `payment` mode (one-time). Otherwise uses `subscription` mode with 3-day trial.
- Passes `metadata.user_id`, `metadata.viz_credits`, `metadata.price_id`, and `client_reference_id` (userId) to the Stripe session — these are read back by the webhook.
- Sets `allow_promotion_codes: true`.
- Returns `{ url, sessionId }`.

### 4. Stripe processes payment

### 5. /api/stripe-webhook (`stripe-webhook.js`)
- `bodyParser: false` — reads raw body manually via stream for signature verification.
- Fetches `stripe_webhook_secret` from `app_config`.
- Verifies HMAC-SHA256 signature manually (no Stripe SDK) using `crypto.subtle`.
- On `checkout.session.completed`:
  - If `mode === 'payment'` and `vizCredits > 0`: calls `addVizCredits(userId, email, credits)`.
  - If `mode === 'subscription'`: upserts `profiles.role = 'pro'`.
  - Fallback: checks `VIZ_CREDIT_MAP[priceId]` directly.
- `addVizCredits()` in the webhook (`stripe-webhook.js:70`):
  - Fetches current `viz_credits` and `viz_credits_total` from `profiles`.
  - PATCHes with new totals.
  - Logs to `viz_purchases` table: `{ user_id, credits, created_at }`.
  - If no profile exists, creates one with `role: 'free'`.
- Also handles `customer.subscription.deleted` (logs only — no downgrade implemented) and `customer.subscription.updated` (logs status only).

### 6. User return — checkVizPurchaseReturn() (`visualize.js:350`)
- IIFE that fires on every page load.
- Checks `?viz_purchased=N` in the URL.
- Clears the param, then after 1.5s calls `loadVizCredits()` + `updateFreeNotice()`.
- **Does not add credits** — credits were added by the webhook. This just refreshes the display.

---

## Service key usage in webhook

`getServiceHeaders()` (`stripe-webhook.js:47`) tries `app_config.supabase_service_key` first, falls back to the anon key. The service key is needed to bypass RLS when updating `profiles`. If `supabase_service_key` is missing from `app_config`, the webhook will use the anon key and the `profiles` PATCH may be rejected by RLS.

---

## checkStripeRedirect() — legacy subscription return (`visualize.js:1068`)

Checks `?stripe=success` for subscription upgrades (not used by viz packages). Refreshes `profiles.role` and calls `grantSuperAdmin()` if the role is admin. This is the old flow — viz packages use `?viz_purchased=N` instead.

---

## Critical gotcha — webhook signing secret

**The webhook signing secret (`stripe_webhook_secret` in `app_config`) must be the live-mode secret for production, not the test-mode secret.**

Stripe issues different webhook secrets for test mode and live mode. Using the wrong one causes all webhooks to fail signature verification (`status 400, "Invalid signature"`), so no credits are ever delivered after payment. This caused a real production outage.

To verify: in the Stripe dashboard, go to Webhooks → select the production endpoint → reveal the signing secret. That value must match `app_config.stripe_webhook_secret`. The test secret starts with `whsec_test_` and the live secret starts with `whsec_`.

---

## Other gotchas

- **No idempotency guard on the webhook**: If Stripe retries a `checkout.session.completed` event (it retries on non-2xx or timeout), `addVizCredits` will run again and double-add credits. The `viz_purchases` table would show the duplicate but the credits would be over-issued.
- **`customer.subscription.deleted` is a no-op**: The webhook logs the event but does not downgrade the user's role. A cancelled subscriber keeps `role = 'pro'` indefinitely.
- **Anon key is safe but service key must not be in client code**: The anon key appears in `visualize.js:371` in `getStripeConfig()` — this is fine (it's public). The service key must stay in `app_config` server-side only.
- **`successUrl` embeds `viz_purchased=N` in plaintext**: anyone who sees the URL knows how many credits were purchased. Not a security issue but worth noting.
- **`stripe-checkout.js` body parser limit is 1MB**: fine for JSON payloads. The webhook sets `bodyParser: false` — critical, must stay that way for signature verification to work.
