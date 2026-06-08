export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
};

const SUPABASE_URL = 'https://zciyiltkaunbozoedfcr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjaXlpbHRrYXVuYm96b2VkZmNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5OTU4OTAsImV4cCI6MjA5MjU3MTg5MH0._nEPOkh1Ocn5uTwAju2zxim0JH6aROdmuFf1OdsvKzI';

async function getConfig(key) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_config?key=eq.${key}&select=value`, {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
  });
  const d = await r.json();
  return d?.[0]?.value || null;
}

// Map price IDs to viz credit amounts
const VIZ_CREDIT_MAP = {
  'price_1Tg9hiRVJ2WCAk1HXGd1YuBy': 3,
  'price_1Tg9k6RVJ2WCAk1HTYS5FQMy': 5,
  'price_1Tg9olRVJ2WCAk1HGWriE1hJ': 10,
  'price_1Tg9pIRVJ2WCAk1HVQwY1BjK': 25,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { priceId, userId, email, plan, mode, vizCredits, successUrl, cancelUrl } = req.body;
    if (!priceId || !userId || !email) {
      return res.status(400).json({ error: 'priceId, userId and email required' });
    }

    const secretKey = await getConfig('stripe_secret_key');
    if (!secretKey) return res.status(500).json({ error: 'Stripe not configured' });

    const origin = req.headers.origin || 'https://app.diyestimator.com';

    // Determine if this is a one-time viz package or subscription
    const isVizPackage = mode === 'payment' || VIZ_CREDIT_MAP[priceId];
    const checkoutMode = isVizPackage ? 'payment' : 'subscription';
    const credits = vizCredits || VIZ_CREDIT_MAP[priceId] || 0;

    const params = new URLSearchParams({
      'mode': checkoutMode,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'customer_email': email,
      'client_reference_id': userId,
      'success_url': successUrl || `${origin}/?viz_purchased=${credits}&session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': cancelUrl || `${origin}/`,
      'metadata[user_id]': userId,
      'metadata[viz_credits]': String(credits),
      'metadata[price_id]': priceId,
    });

    // Only add trial and subscription metadata for subscription mode
    if (!isVizPackage) {
      params.set('subscription_data[trial_period_days]', '3');
      params.set('metadata[plan]', plan || 'pro');
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await response.json();
    if (!response.ok) return res.status(400).json({ error: session.error?.message || 'Checkout failed' });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
