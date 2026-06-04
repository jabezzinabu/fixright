export const config = {
  api: { bodyParser: false },
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

async function updateUserRole(userId, email, role) {
  const serviceKey = await getConfig('supabase_service_key') || SUPABASE_ANON_KEY;
  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=minimal'
  };

  // Upsert by user_id — creates profile if doesn't exist
  if (userId) {
    const body = { id: userId, role };
    if (email) body.email = email;
    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
  }

  // Also upsert by email as fallback
  if (email && !userId) {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, role })
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
      await updateUserRole(userId, email, 'pro');
      console.log(`Upgraded to pro: ${email}`);
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const email = sub.customer_email;
      // Downgrade — find by stripe customer ID would be more reliable
      // For now log it; full implementation needs customer lookup
      console.log(`Subscription cancelled: ${email}`);
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      const status = sub.status;
      if (status === 'active' || status === 'trialing') {
        console.log(`Subscription active/trialing`);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
