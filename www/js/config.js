// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://zciyiltkaunbozoedfcr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjaXlpbHRrYXVuYm96b2VkZmNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5OTU4OTAsImV4cCI6MjA5MjU3MTg5MH0._nEPOkh1Ocn5uTwAju2zxim0JH6aROdmuFf1OdsvKzI';

let db = null;
let dbReady = false;

function initSupabase() {
  try {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
      console.warn('DIY Estimator: Supabase not configured — using session storage fallback.');
      setDbStatus('error');
      return;
    }
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    dbReady = true;
    setDbStatus('connected');
    console.log('DIY Estimator: Supabase connected ✓');
  } catch(e) {
    console.error('Supabase init failed:', e);
    setDbStatus('error');
  }
}

function setDbStatus(state) {
  const el = document.getElementById('dbStatus');
  el.className = 'db-status ' + state;
  el.title = state === 'connected' ? 'Database connected' : state === 'error' ? 'Database not configured — saves are session-only' : 'Connecting...';
}

// ─── ANONYMOUS USER ID ────────────────────────────────────────────────────────
function getUserId() {
  let uid = localStorage.getItem('fixright_uid');
  if (!uid) {
    uid = 'user_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('fixright_uid', uid);
  }
  return uid;
}

// ─── GLOBAL STATE ─────────────────────────────────────────────────────────────
let imageBase64 = null;
let imageMediaType = null;
let currentEstimate = null;
let savedEstimates = [];
const USER_ID = getUserId();

const LOADING_TIPS = [
  'Checking regional material costs...',
  'Calculating labour rates...',
  'Building your materials list...',
  'Adding up quantities...',
  'Almost there...',
];

// ─── API KEY STUBS (keys handled server-side) ─────────────────────────────────
function getApiKey() { return ''; }
function showApiKeyModal() {}
function confirmApiKey() {}

// ─── OPENAI KEY ────────────────────────────────────────────────────────────────
function saveOpenAIKey(val) {
  if (val && val.trim().length > 10) localStorage.setItem('fixright_openai', val.trim());
}
function getOpenAIKey() {
  const inputEl = document.getElementById('openaiKeyInput');
  const fromInput = inputEl ? inputEl.value.trim() : '';
  if (fromInput.length > 10) return fromInput;
  return localStorage.getItem('fixright_openai') || null;
}
