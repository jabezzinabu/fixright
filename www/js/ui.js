// UI helpers — extracted from index.html (Phase 3)
// Contains: showError, hideError, showToast, showAuthError, showAuthSuccess,
//           togglePwd, openImgLightbox, closeImgLightbox

function hideError() { const e = document.getElementById('errorBox'); e.classList.remove('visible'); e.textContent = ''; }
function showError(msg) { const e = document.getElementById('errorBox'); e.textContent = msg; e.classList.add('visible'); }

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg; el.style.display = 'block';
  document.getElementById('authSuccess').style.display = 'none';
}
function showAuthSuccess(msg) {
  const el = document.getElementById('authSuccess');
  el.textContent = msg; el.style.display = 'block';
  document.getElementById('authError').style.display = 'none';
}

function togglePwd(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

function openImgLightbox(src) {
  document.getElementById('imgLightboxSrc').src = src;
  document.getElementById('imgLightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeImgLightbox() {
  document.getElementById('imgLightbox').classList.remove('open');
  document.body.style.overflow = '';
}

function setLoading(on) {
  document.getElementById('loading').classList.toggle('visible', on);
  const btn = document.getElementById('submitBtn');
  btn.disabled = on;
  btn.textContent = on ? '⏳ Generating estimate...' : '🔧 Get My Estimate';
}
function hideResults() {
  document.getElementById('results').classList.remove('visible');
  const p = document.getElementById('vizBeforeAfterPanel');
  if (p) p.style.display = 'none';
}

async function showUpgradePage(returnTab) {
  window._upgradeReturnTab = returnTab || 'estimate';
  switchTab('upgrade');
  const bi = document.getElementById('upgradeDemoBeforeImg');
  const ai = document.getElementById('upgradeDemoAfterImg');
  if (!bi || !ai) return;
  // Try live user images first
  const liveAfter = window.vizResultImageSrc;
  const liveBefore = window.vizPhotoDataUrl;
  if (liveBefore && liveAfter) {
    bi.src = liveBefore;
    ai.src = liveAfter;
    return;
  }
  // Try demo estimate data
  let est = window._demoEstimateData;
  if (!est) {
    try {
      const { data } = await db.from('shared_estimates').select('data').eq('id', '__demo__').single();
      est = data?.data;
    } catch(e) { return; }
  }
  if (!est) return;
  const before = est.beforeImage || est.imageBase64;
  const after = est.vizImage || est.vizResultImageSrc;
  if (before) bi.src = before;
  if (after) ai.src = after;
}
function hideUpgradePage() {
  switchTab(window._upgradeReturnTab || 'estimate');
}

function switchTab(tab) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('section' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  if (tab !== 'upgrade') {
    document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (tab === 'visualize') {
    updateFreeNotice();
    const existing = document.getElementById('proOverrideBanner');
    if (isPro() && !existing) {
      const banner = document.createElement('div');
      banner.id = 'proOverrideBanner';
      banner.className = 'pro-override-banner';
      banner.innerHTML = '<span class="icon">👑</span><p><strong>Pro / Admin access active</strong> — unlimited visualizations, no paywall.</p>';
      const vcb = document.querySelector('.viz-card-body');
      vcb.insertBefore(banner, vcb.firstChild);
      const fn = document.getElementById('vizFreeNotice');
      if (fn) fn.style.display = 'none';
    }
  }
  if (tab === 'admin') { loadAdminData(); }
  if (tab === 'discover') { showCategoryView(); renderDiscoverCategories(); }
}

function toggleSection(id) {
  const content = document.getElementById(id + 'Content');
  const arrow = document.getElementById(id + 'Arrow');
  if (!content) return;
  content.classList.toggle('open');
  if (arrow) arrow.classList.toggle('open');
}

// Events that admin.js reads via event_type column (not aggregate counters)
const CLICK_EVENTS = new Set(['see_sample_click', 'get_estimate_click']);

async function trackEvent(eventType, params) {
  if (currentUser?.email === 'jabezzinabu@gmail.com') return;
  let tries = 0;
  while (!dbReady && tries < 20) { await new Promise(r => setTimeout(r, 250)); tries++; }
  if (!dbReady) return;
  try {
    if (!currentUser) {
      // Anonymous user — usage_stats RLS blocks inserts; use anonymous_events instead
      await db.from('anonymous_events').insert({ event_type: eventType });
    } else if (CLICK_EVENTS.has(eventType)) {
      // Authenticated click event — insert event-log row matching admin.js query format
      await db.from('usage_stats').insert({ event_type: eventType });
    } else {
      // Authenticated counter event — increment via RPC, fallback to manual upsert
      const today = new Date().toISOString().split('T')[0];
      const { error } = await db.rpc('increment_stat', { p_date: today, p_column: eventType });
      if (error) {
        const { data: row } = await db.from('usage_stats').select('*').eq('date', today).single().catch(() => ({ data: null }));
        if (row) {
          await db.from('usage_stats').update({ [eventType]: (row[eventType] || 0) + 1 }).eq('date', today);
        } else {
          const insertData = { date: today, estimates_count: 0, signups_count: 0, visualizations_count: 0, visitors_count: 0, paid_conversions: 0 };
          insertData[eventType] = 1;
          await db.from('usage_stats').insert(insertData);
        }
      }
    }
  } catch(e) { console.warn('trackEvent failed:', eventType, e.message); }
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventType, params || {});
  }
}
