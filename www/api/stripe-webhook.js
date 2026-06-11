export const config = {
  api: { bodyParser: false },
};

const SUPABASE_URL = 'https://zciyiltkaunbozoedfcr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjaXlpbHRrYXVuYm96b2VkZmNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5OTU4OTAsImV4cCI6MjA5MjU3MTg5MH0._nEPOkh1Ocn5uTwAju2zxim0JH6aROdmuFf1OdsvKzI';

// Map price IDs to viz credit amounts
const VIZ_CREDIT_MAP = {
  'price_1TgQlHRU8c4qhAdsQSgEKrzb': 3,
  'price_1TgQlDRU8c4qhAdsMUzLDf03': 5,
  'price_1TgQl8RU8c4qhAdskDOq6ju5': 10,
  'price_1TgQl2RU8c4qhAds1Opw75gL': 25,
};

async function getConfig(key) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_config?key=eq.${key}&select=value`, {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
  });
  const d = await r.json();
  return d?.[0]?.value || null;
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function verifyStripeSignature(payload, signature, secret) {
  const encoder = new TextEncoder();
  const parts = signature.split(',');
  const timestamp = parts.find(p => p.startsWith('t=')).slice(2);
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  const received = parts.find(p => p.startsWith('v1='))?.slice(3);
  return expected === received;
}

async function getServiceHeaders() {
  const serviceKey = await getConfig('supabase_service_key') || SUPABASE_ANON_KEY;
  return {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=minimal'
  };
}

async function upsertProfile(userId, email, updates) {
  const headers = await getServiceHeaders();
  const body = { ...updates };
  if (userId) body.id = userId;
  if (email) body.email = email;

  await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

async function addVizCredits(userId, email, credits) {
  const headers = await getServiceHeaders();

  // Get current credits first
  const filter = userId ? `id=eq.${userId}` : `email=eq.${encodeURIComponent(email)}`;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?${filter}&select=id,viz_credits,viz_credits_total`, {
    headers
  });
  const profiles = await r.json();
  const profile = profiles?.[0];

  if (profile) {
    const newCredits = (profile.viz_credits || 0) + credits;
    const newTotal = (profile.viz_credits_total || 0) + credits;
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ viz_credits: newCredits, viz_credits_total: newTotal })
    });
    console.log(`Added ${credits} viz credits to user ${profile.id}. New balance: ${newCredits}`);
  } else {
    // Create profile with credits
    await upsertProfile(userId, email, { viz_credits: credits, viz_credits_total: credits, role: 'free' });
    console.log(`Created profile with ${credits} viz credits for ${email}`);
  }

  // Log the purchase
  if (userId) {
    await fetch(`${SUPABASE_URL}/rest/v1/viz_purchases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: userId, credits, created_at: new Date().toISOString() })
    });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const signature = req.headers['stripe-signature'];

  try {
    const webhookSecret = await getConfig('stripe_webhook_secret');
    if (!webhookSecret) return res.status(500).json({ error: 'Webhook secret not configured' });

    const valid = await verifyStripeSignature(rawBody, signature, webhookSecret);
    if (!valid) return res.status(400).json({ error: 'Invalid signature' });

    const event = JSON.parse(rawBody);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id || session.metadata?.user_id;
      const email = session.customer_email;
      const mode = session.mode;
      const priceId = session.metadata?.price_id;
      const vizCredits = parseInt(session.metadata?.viz_credits || '0');

      if (mode === 'payment' && vizCredits > 0) {
        // One-time viz package purchase
        await addVizCredits(userId, email, vizCredits);
        console.log(`Viz purchase: ${vizCredits} credits for ${email}`);
      } else if (mode === 'subscription') {
        // Subscription — grant pro role
        await upsertProfile(userId, email, { role: 'pro' });
        console.log(`Upgraded to pro: ${email}`);
      } else if (priceId && VIZ_CREDIT_MAP[priceId]) {
        // Fallback: check price ID map
        await addVizCredits(userId, email, VIZ_CREDIT_MAP[priceId]);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const customerId = sub.customer;
      // Look up customer email via Stripe API if needed
      console.log(`Subscription cancelled for customer: ${customerId}`);
      // Note: full downgrade needs Stripe customer lookup - handled in future iteration
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      const status = sub.status;
      if (status === 'active' || status === 'trialing') {
        console.log(`Subscription ${status}`);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
