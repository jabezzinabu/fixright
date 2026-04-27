export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    openaiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.openai_api_key || null,
    debug: {
      hasOPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      hasOPENAI_KEY: !!process.env.OPENAI_KEY,
      nodeEnv: process.env.NODE_ENV,
      allKeys: Object.keys(process.env).filter(k => k.toLowerCase().includes('openai'))
    }
  });
}
