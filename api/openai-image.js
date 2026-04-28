export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

// Supabase credentials hardcoded — anon key is safe for reading config
const SUPABASE_URL = 'https://zciyiltkaunbozoedfcr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjaXlpbHRrYXVuYm96b2VkZmNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5OTU4OTAsImV4cCI6MjA5MjU3MTg5MH0._nEPOkh1Ocn5uTwAju2zxim0JH6aROdmuFf1OdsvKzI';

async function getOpenAIKey() {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/app_config?key=eq.openai_api_key&select=value`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      }
    );
    const data = await r.json();
    return data?.[0]?.value || null;
  } catch(e) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = await getOpenAIKey();
  if (!key) return res.status(500).json({ error: 'OpenAI key not found in config' });

  try {
    const { prompt, imageBase64, size = '1024x1024' } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const boundary = 'FixRightBoundary' + Date.now();

    const parts = [];
    const addField = (name, value) => {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    };

    addField('model', 'gpt-image-1');
    addField('prompt', prompt);
    addField('n', '1');
    addField('size', size);

    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`));
    parts.push(imageBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
