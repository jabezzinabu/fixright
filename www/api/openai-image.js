export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  try {
    const { prompt, imageBase64, size = '1024x1024' } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const boundary = '----FixRightBoundary' + Date.now();

    const textFields = [
      { name: 'model', value: 'gpt-image-1' },
      { name: 'prompt', value: prompt },
      { name: 'n', value: '1' },
      { name: 'size', value: size },
    ];

    const parts = [];
    for (const { name, value } of textFields) {
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        'utf8'
      ));
    }

    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
      'utf8'
    ));
    parts.push(imageBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));

    const fullBody = Buffer.concat(parts);

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: fullBody,
    });

    const data = await response.json();
    
    if (!response.ok) {
      // Return full error details
      return res.status(response.status).json({ 
        error: data.error || data,
        status: response.status,
        prompt_preview: prompt.slice(0, 100)
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
