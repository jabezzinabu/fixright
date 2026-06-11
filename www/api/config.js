export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  // Return only non-sensitive config — never expose API keys
  res.status(200).json({
    ok: true,
    region: process.env.VERCEL_REGION || 'iad1',
  });
}
