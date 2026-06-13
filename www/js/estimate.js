// ─── PHOTO HANDLING ───────────────────────────────────────────────────────────
function updateSubmitButton() {
  console.log('updateSubmitButton called');
  const btn = document.getElementById('submitBtn');
  if (!btn) return;
  console.log('updateSubmitButton:', { hasImage: !!imageBase64, _vizCredits, vizCreditsDefined: typeof _vizCredits !== 'undefined' });
  if (imageBase64 && typeof _vizCredits !== 'undefined' && _vizCredits > 0) {
    console.log('updateSubmitButton: taking viz branch');
    btn.textContent = '✨ Get Estimate & Visualization';
  } else {
    console.log('updateSubmitButton: taking default branch');
    btn.textContent = '🔧 Get My Estimate';
  }
}

function triggerFile() {
  // No longer needed — input covers zone directly
}

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 1024;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        const scale = MAX / Math.max(w, h);
        w = Math.round(w * scale); h = Math.round(h * scale);
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      // Use 0.82 quality to keep under 4MB for OpenAI
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      imageBase64 = dataUrl.split(',')[1];
      imageMediaType = 'image/jpeg';
      const preview = document.getElementById('photoPreview');
      preview.src = dataUrl;
      preview.style.display = 'block';
      document.getElementById('photoPlaceholder').style.display = 'none';
      document.getElementById('photoClear').style.display = 'flex';
      updateSubmitButton();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearPhoto(e) {
  e.stopPropagation();
  imageBase64 = null; imageMediaType = null;
  document.getElementById('photoPreview').style.display = 'none';
  document.getElementById('photoPlaceholder').style.display = 'block';
  document.getElementById('photoClear').style.display = 'none';
  document.getElementById('photoInput').value = '';
  updateSubmitButton();
}

const zone = document.getElementById('photoZone');
zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
zone.addEventListener('drop', e => {
  e.preventDefault(); zone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) handleFile(f);
});

// ─── ESTIMATE ─────────────────────────────────────────────────────────────────
async function runEstimate() {
  const desc = document.getElementById('description').value.trim();
  if (!desc && !imageBase64) { showToast('Please add a photo or description'); return; }
  if (!checkEstPaywall()) return;

  const region = document.getElementById('region').value;
  const approach = document.getElementById('approach').value;

  setLoading(true);
  hideResults();
  hideError();
  document.getElementById('loadingTip').textContent =
    LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];

  // Inject pre-calculated quantities from measurement skill
  const measurementContext = getMeasurementContext();

  const systemPrompt = `You are DIY Estimator, an expert home repair and renovation cost estimator. Given a project description and optional photo, return ONLY a valid JSON object — no markdown, no extra text, no code fences.

JSON shape:
{
  "title": "Short project title (max 8 words)",
  "priceRange": "$X,XXX – $X,XXX",
  "difficulty": "Easy|Moderate|Challenging|Expert",
  "timeline": "e.g. 1–2 days",
  "materials": [
    {"item": "Name", "qty": "2", "unit": "sheets", "cost": "$45"}
  ],
  "steps": ["Step 1...", "Step 2..."],
  "warnings": ["Warning text..."],
  "tip": "One money-saving pro tip"
}

Region: ${region}
Approach: ${approach === 'both' ? 'show as "DIY: $X–$Y | Contractor: $A–$B"' : approach === 'diy' ? 'DIY pricing only' : 'Contractor pricing only'}
${measurementContext ? 'IMPORTANT — LOCKED MEASUREMENT DATA (use these exact quantities, do not recalculate):\n' + measurementContext.trim() : ''}
Be accurate, specific, practical. Return ONLY the JSON.`;

  const userContent = [];
  if (imageBase64) {
    userContent.push({ type: 'image', source: { type: 'base64', media_type: imageMediaType, data: imageBase64 } });
  }
  const userText = (desc || 'Please estimate based on the photo.') + (measurementContext ? '\n\n' + measurementContext.trim() : '');
  userContent.push({ type: 'text', text: userText });

  try {
    const resp = await fetch('/api/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }]
      })
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || 'API error');

    const raw = data.content.map(b => b.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    currentEstimate = { ...parsed, region, approach, ts: Date.now(), desc, user_id: currentUser?.id || USER_ID };
    renderResults(currentEstimate);
    hideSavePrompt();
    // Track anonymous usage
    trackAnonymousEstimate();
    // Auto-prompt install after first estimate
    try { maybeAutoPromptInstall(); } catch(e) {}
  } catch(err) {
    showError('Sorry — ' + (err.message || 'something went wrong. Please try again.'));
  } finally {
    setLoading(false);
  }
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function renderResults(est) {
  document.getElementById('resultTitle').textContent = est.title || 'Project Estimate';
  // Fix currency symbol in price range
  const sym = getCurrencySymbol();
  const priceRange = (est.priceRange || '').replace(/\$/g, sym);
  document.getElementById('resultPrice').textContent = priceRange;
  document.getElementById('resultDifficulty').textContent = '⚡ ' + (est.difficulty || '');
  document.getElementById('resultTimeline').textContent = '⏱ ' + (est.timeline || '');

  const tbody = document.getElementById('materialsBody');
  tbody.innerHTML = '';
  let total = 0;
  (est.materials || []).forEach(m => {
    const tr = document.createElement('tr');
    const badges = buildRetailerBadges(m.item);
    tr.innerHTML = `
      <td>
        <div style="font-weight:500">${m.item}</div>
        ${badges}
      </td>
      <td>${m.qty}</td>
      <td>${m.unit}</td>
      <td class="mat-cost">${m.cost}</td>`;
    tbody.appendChild(tr);
    const num = parseFloat((m.cost || '0').replace(/[^0-9.]/g, ''));
    if (!isNaN(num)) total += num;
  });
  if (total > 0) {
    const tr = document.createElement('tr');
    tr.className = 'mat-total-row';
    const sym = getCurrencySymbol();
    tr.innerHTML = `<td colspan="3">Materials Total</td><td class="mat-cost">~${sym}${Math.round(total).toLocaleString()}</td>`;
    tbody.appendChild(tr);
  }

  // Add price source credibility line
  const sourceEl = document.getElementById('priceSource');
  if (sourceEl) sourceEl.textContent = getPriceSource();

  const sl = document.getElementById('stepsList');
  sl.innerHTML = '';
  (est.steps || []).forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="step-num">${i+1}</span><span>${s}</span>`;
    sl.appendChild(li);
  });

  document.getElementById('warningsContainer').innerHTML =
    (est.warnings || []).map(w =>
      `<div class="info-box warning"><strong>⚠ Heads Up</strong>${w}</div>`
    ).join('');

  document.getElementById('tipContainer').innerHTML = est.tip
    ? `<div class="info-box tip"><strong>💡 Pro Tip</strong>${est.tip}</div>` : '';

  // Set collapsible summaries and expand all sections by default
  const matCount = (est.materials || []).length;
  const matSummaryEl = document.getElementById('materialsSummary');
  if (matSummaryEl) matSummaryEl.textContent = matCount + ' items';
  const matContent = document.getElementById('materialsContent');
  const matArrow = document.getElementById('materialsArrow');
  if (matContent) matContent.classList.add('open');
  if (matArrow) matArrow.classList.add('open');

  const stepCount = (est.steps || []).length;
  const stepsSummaryEl = document.getElementById('stepsSummary');
  if (stepsSummaryEl) stepsSummaryEl.textContent = stepCount + ' steps';
  const stepsContent = document.getElementById('stepsContent');
  const stepsArrow = document.getElementById('stepsArrow');
  if (stepsContent) stepsContent.classList.add('open');
  if (stepsArrow) stepsArrow.classList.add('open');

  // Show warnings section only if there are warnings or tips
  const warnSection = document.getElementById('warningsTipSection');
  const warnCount = (est.warnings || []).length + (est.tip ? 1 : 0);
  if (warnSection) {
    if (warnCount > 0) {
      warnSection.style.display = 'block';
      const warnSummaryEl = document.getElementById('warningsSummary');
      if (warnSummaryEl) warnSummaryEl.textContent = warnCount + ' note' + (warnCount > 1 ? 's' : '');
      const warnContent = document.getElementById('warningsContent');
      const warnArrow = document.getElementById('warningsArrow');
      if (warnContent) warnContent.classList.add('open');
      if (warnArrow) warnArrow.classList.add('open');
    } else {
      warnSection.style.display = 'none';
    }
  }

  // Show viz before/after if available
  const beforeAfterEl = document.getElementById('resultBeforeAfter');
  if (beforeAfterEl) {
    if (est.vizImage || est.beforeImage) {
      let html = '<div style="margin-top:1.5rem;">';
      html += '<div style="font-family:serif;font-size:1rem;font-weight:600;color:#111;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;">';
      html += '<span style="width:3px;height:1em;background:#E8481C;border-radius:2px;display:inline-block;flex-shrink:0;"></span> Design Visualization</div>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">';
      if (est.beforeImage) {
        html += `<div><div style="font-size:0.72rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.4rem;">Before</div>
          <img src="${est.beforeImage}" style="width:100%;border-radius:10px;display:block;object-fit:cover;aspect-ratio:4/3;cursor:pointer;" onclick="openImgLightbox('${est.beforeImage}')"></div>`;
      }
      if (est.vizImage) {
        html += `<div><div style="font-size:0.72rem;font-weight:600;color:#E8481C;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.4rem;">After</div>
          <img src="${est.vizImage}" style="width:100%;border-radius:10px;display:block;object-fit:cover;aspect-ratio:4/3;cursor:pointer;" onclick="openImgLightbox('${est.vizImage}')"></div>`;
      }
      html += '</div></div>';
      beforeAfterEl.innerHTML = html;
      beforeAfterEl.style.display = 'block';
    } else {
      beforeAfterEl.innerHTML = '';
      beforeAfterEl.style.display = 'none';
    }
  }

  // Show viz teaser if user uploaded a photo but has no viz yet
  const teaserEl = document.getElementById('vizTeaser');
  if (teaserEl) {
    const hasPhoto = est.beforeImage || (imageBase64 ? 'data:image/jpeg;base64,' + imageBase64 : null);
    const hasViz = est.vizImage || vizResultImageSrc;
    if (hasPhoto && !hasViz && !est.isDemo) {
      const photoSrc = est.beforeImage || (imageBase64 ? 'data:image/jpeg;base64,' + imageBase64 : null);
      teaserEl.innerHTML = `
        <div class="viz-teaser">
          <div class="viz-teaser-header" style="display:flex;align-items:center;justify-content:space-between;">
            <span>✨ See Your Project Transformed</span>
            <button onclick="document.getElementById('vizTeaser').style.display='none'" style="background:none;border:none;color:rgba(255,255,255,0.7);font-size:1.2rem;cursor:pointer;padding:0 0.25rem;line-height:1;" title="Close">✕</button>
          </div>
          <div class="viz-teaser-grid">
            <div class="viz-teaser-img-wrap">
              <img src="${photoSrc}" alt="Before">
              <div class="viz-teaser-label">📷 Your Space</div>
            </div>
            <div class="viz-teaser-locked">
              <img src="${photoSrc}" alt="After preview">
              <div class="viz-teaser-locked-overlay">
                <div class="lock-icon">🔒</div>
                <div class="lock-text">AI Visualization<br>Unlocked with credits</div>
              </div>
            </div>
          </div>
          <div class="viz-teaser-cta">
            <button onclick="showVizPackageModal()">✨ Unlock Before &amp; After — from $3.99</button>
            <div class="viz-teaser-note">AI transforms your photo · 3, 5, 10 or 25 credits</div>
          </div>
        </div>`;
      teaserEl.style.display = 'block';
    } else {
      teaserEl.style.display = 'none';
      teaserEl.innerHTML = '';
    }
  }

  document.getElementById('results').classList.add('visible');
  setTimeout(() => {
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

// ─── SUPABASE SAVE / LOAD ─────────────────────────────────────────────────────
async function saveEstimate() {
  if (!currentEstimate) { showToast('Nothing to save yet'); return; }
  if (!currentUser) { showToast('Please sign in to save estimates'); showAuthModal(); return; }
  // Show saving state on all save buttons
  document.querySelectorAll('[onclick*="saveEstimate"]').forEach(b => { b._origText = b.textContent; b.disabled = true; b.textContent = '💾 Saving...'; });

  const row = {
    user_id: currentUser.id,
    title: currentEstimate.title,
    price_range: currentEstimate.priceRange,
    difficulty: currentEstimate.difficulty,
    timeline: currentEstimate.timeline,
    region: currentEstimate.region,
    approach: currentEstimate.approach,
    description: currentEstimate.desc || '',
    materials: currentEstimate.materials || [],
    steps: currentEstimate.steps || [],
    warnings: currentEstimate.warnings || [],
    tip: currentEstimate.tip || '',
    viz_image: vizResultImageSrc || null,
    before_image: vizPhotoDataUrl || (imageBase64 ? 'data:image/jpeg;base64,' + imageBase64 : null),
  };

  if (dbReady) {
    try {
      const { error } = await db.from('estimates').insert(row);
      if (error) throw error;
      showToast('✓ Saved!');
      loadSavedEstimates();
    } catch(e) {
      console.error('Save failed:', e?.message || e?.details || JSON.stringify(e));
      saveLocal(currentEstimate);
      showToast('⚠ Saved locally (DB error)');
    }
  } else {
    saveLocal(currentEstimate);
    showToast('✓ Estimate saved!');
  }
}

async function loadSavedEstimates() {
  if (!drawerOpen) return;
  // Show loading skeleton
  const list = document.getElementById('savedList');
  if (list) list.innerHTML = '<div style="padding:1.25rem;text-align:center;color:var(--muted);font-size:0.85rem;">⏳ Loading your estimates...</div>';

  if (dbReady) {
    try {
      const { data, error } = await db
        .from('estimates')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(25);
      if (error) throw error;
      savedEstimates = data.map(r => ({
        id: r.id,
        title: r.title,
        priceRange: r.price_range,
        difficulty: r.difficulty,
        timeline: r.timeline,
        region: r.region,
        approach: r.approach,
        desc: r.description,
        materials: r.materials,
        steps: r.steps,
        warnings: r.warnings,
        tip: r.tip,
        ts: new Date(r.created_at).getTime(),
        vizImage: r.viz_image || null,
        beforeImage: r.before_image || null,
      }));
      updateSavedCount(data.length);
      renderSavedList();
    } catch(e) {
      console.error('Load failed:', e);
      renderSavedList();
    }
  } else {
    savedEstimates = JSON.parse(sessionStorage.getItem('fixright_saves') || '[]');
    updateSavedCount(savedEstimates.length);
    renderSavedList();
  }
}

async function deleteEstimate(id, e) {
  e.stopPropagation();
  if (dbReady) {
    const { error } = await db.from('estimates').delete().eq('id', id);
    if (!error) {
      savedEstimates = savedEstimates.filter(x => x.id !== id);
      updateSavedCount(savedEstimates.length);
      renderSavedList();
    }
  } else {
    savedEstimates = savedEstimates.filter(x => x.id !== id);
    sessionStorage.setItem('fixright_saves', JSON.stringify(savedEstimates));
    updateSavedCount(savedEstimates.length);
    renderSavedList();
  }
}

function saveLocal(est) {
  let saves = JSON.parse(sessionStorage.getItem('fixright_saves') || '[]');
  saves.unshift({ id: Date.now(), ...est });
  if (saves.length > 20) saves = saves.slice(0, 20);
  sessionStorage.setItem('fixright_saves', JSON.stringify(saves));
  savedEstimates = saves;
  updateSavedCount(saves.length);
}

// ─── DRAWER ───────────────────────────────────────────────────────────────────
let drawerOpen = false;
function toggleDrawer(force) {
  drawerOpen = force !== undefined ? force : !drawerOpen;
  document.getElementById('savedDrawer').classList.toggle('open', drawerOpen);
  if (drawerOpen) loadSavedEstimates();
}

function updateSavedCount(n) {
  document.getElementById('savedCount').textContent = n || savedEstimates.length;
}

function renderSavedList() {
  const list = document.getElementById('savedList');
  if (!savedEstimates.length) {
    list.innerHTML = '<div class="drawer-empty">No saved estimates yet.</div>';
    return;
  }
  list.innerHTML = savedEstimates.map(e => `
    <div class="saved-item" onclick="loadSaved('${e.id}')">
      <div>
        <div class="saved-item-title">${e.title || 'Untitled'}</div>
        <div class="saved-item-meta">${e.priceRange || ''} · ${new Date(e.ts).toLocaleDateString()}</div>
      </div>
      <button class="saved-item-del" onclick="deleteEstimate('${e.id}', event)">🗑</button>
    </div>
  `).join('');
}

function loadSaved(id) {
  const est = savedEstimates.find(x => String(x.id) === String(id));
  if (!est) return;

  // Show loading toast
  showToast('⏳ Loading estimate...');

  // Restore estimate result
  currentEstimate = est;
  renderResults(est);
  toggleDrawer(false);

  // Restore before photo if saved
  if (est.beforeImage) {
    imageBase64 = est.beforeImage.split(',')[1] || null;
    imageMediaType = 'image/jpeg';
    const preview = document.getElementById('photoPreview');
    preview.src = est.beforeImage;
    preview.style.display = 'block';
    document.getElementById('photoPlaceholder').style.display = 'none';
    document.getElementById('photoClear').style.display = 'flex';
  }

  // Restore visualization if saved
  if (est.vizImage) {
    vizResultImageSrc = est.vizImage;
    // Show viz result panel
    const vizResult = document.getElementById('vizResult');
    if (vizResult) {
      const img = vizResult.querySelector('.viz-result-img') || vizResult.querySelector('img');
      if (img) img.src = est.vizImage;
      vizResult.classList.add('visible');
    }
    showToast('✓ Estimate + visualization restored');
  } else {
    showToast('✓ Estimate restored');
  }

  // Restore description
  if (est.desc) document.getElementById('description').value = est.desc;

  // Scroll to results
  setTimeout(() => {
    document.getElementById('resultCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 200);
}

async function loadSharedEstimate(shareId) {
  let tries = 0;
  while (!dbReady && tries < 20) { await new Promise(r => setTimeout(r, 150)); tries++; }
  if (!dbReady) { showToast('Could not load shared estimate'); return; }
  try {
    const { data, error } = await db.from('shared_estimates').select('data').eq('id', shareId).single();
    if (error || !data) throw error || new Error('not found');
    document.getElementById('sharedBanner').classList.add('visible');
    renderResults(data.data);
    window.history.replaceState({}, document.title, location.pathname);
  } catch(e) {
    console.error('Load shared failed:', e);
    showToast('This shared estimate could not be found');
  }
}

function newEstimate() {
  hideResults(); hideError();
  document.getElementById('description').value = '';
  clearPhoto(new Event('click'));
  currentEstimate = null;
  location.hash = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function copyMaterials() {
  if (!currentEstimate?.materials) return;
  const lines = currentEstimate.materials.map(m => `• ${m.item} — ${m.qty} ${m.unit} (${m.cost})`).join('\n');
  const text = `${currentEstimate.title}\nEstimated: ${currentEstimate.priceRange}\n\nMaterials:\n${lines}\n\n— via DIY Estimator`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('📋 Materials list copied!'))
      .catch(() => copyFallback(text));
  } else {
    copyFallback(text);
  }
}
function copyFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand('copy'); showToast('📋 Materials list copied!'); }
  catch(e) { showToast('Copy failed — please copy manually'); }
  document.body.removeChild(ta);
}

function getEstCount() { return parseInt(localStorage.getItem('fixright_est_count') || '0'); }
function incEstCount() { localStorage.setItem('fixright_est_count', getEstCount() + 1); }
function checkEstPaywall() { return true; }

function showSavePrompt() {
  const el = document.getElementById('savePrompt');
  if (el) { el.classList.add('visible'); }
}
function hideSavePrompt() {
  const el = document.getElementById('savePrompt');
  if (el) el.classList.remove('visible');
}

function isConsumable(itemName) {
  const lower = itemName.toLowerCase();
  return CONSUMABLE_KEYWORDS.some(k => lower.includes(k));
}

function getRetailers() {
  const region = document.getElementById('region')?.value || 'us-national';
  return RETAILERS[region] || RETAILERS['us-national'];
}

function getCurrencySymbol() {
  const region = document.getElementById('region')?.value || 'us-national';
  if (region === 'uk') return '£';
  if (region === 'au') return 'A$';
  if (region === 'ca') return 'CA$';
  return '$';
}

function getCurrencyLocale() {
  const region = document.getElementById('region')?.value || 'us-national';
  if (region === 'uk') return 'en-GB';
  if (region === 'au') return 'en-AU';
  if (region === 'ca') return 'en-CA';
  return 'en-US';
}

function getPriceSource() {
  const region = document.getElementById('region')?.value || 'us-national';
  return PRICE_SOURCES[region] || PRICE_SOURCES['us-national'];
}

function buildRetailerBadges(itemName) {
  if (isConsumable(itemName)) return '';
  const retailers = getRetailers();
  const query = encodeURIComponent(itemName);
  return `<div class="mat-retailers">${
    retailers.map(r =>
      `<a href="${r.url}${query}" target="_blank" rel="noopener" class="retailer-badge ${r.cls}">BUY ${r.name} →</a>`
    ).join('')
  }</div>`;
}

async function trackAnonymousEstimate() {
  await trackEvent('estimates_count');
}

async function loadDemoEstimate() {
  const btn = document.getElementById('demoBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Loading sample...'; }
  try {
    let tries = 0;
    while (!dbReady && tries < 20) { await new Promise(r => setTimeout(r, 250)); tries++; }

    if (dbReady) {
      const { data, error } = await db.from('shared_estimates').select('data').eq('id', '__demo__').single();
      if (!error && data?.data) {
        const estData = { ...data.data, isDemo: true };
        const descEl = document.getElementById('description');
        if (descEl && estData.desc) descEl.value = estData.desc;
        if (estData.vizImage) vizResultImageSrc = estData.vizImage;
        if (estData.beforeImage) vizPhotoDataUrl = estData.beforeImage;
        currentEstimate = estData;
        renderResults(estData);
        document.getElementById('sharedBanner') && (document.getElementById('sharedBanner').innerHTML = '<span>🎯 This is a sample estimate</span> <a href="#" onclick="clearResults();return false;" style="color:white;font-weight:700;margin-left:0.75rem;text-decoration:underline;">↩ Try your own project</a> <button onclick="clearResults()" style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:99px;padding:2px 10px;font-size:0.8rem;font-weight:700;cursor:pointer;margin-left:0.5rem;">✕ Close</button>');
        document.getElementById('sharedBanner')?.classList.add('visible');
        showSignupPopup();
        return;
      }
    }

    const demo = {
      title: 'Replace Bathroom Tile Floor (10×8 ft)',
      priceRange: '$850 – $1,400',
      difficulty: 'Moderate',
      timeline: '2–3 days',
      isDemo: true,
      materials: [
        { item: 'Porcelain floor tiles (12×24")', qty: 12, unit: 'boxes', cost: '$480' },
        { item: 'Tile adhesive / thin-set mortar', qty: 3, unit: 'bags', cost: '$75' },
        { item: 'Grout (sanded, grey)', qty: 2, unit: 'bags', cost: '$40' },
        { item: 'Tile spacers', qty: 1, unit: 'pack', cost: '$8' },
        { item: 'Cement backer board', qty: 4, unit: 'sheets', cost: '$60' },
        { item: 'Waterproofing membrane', qty: 1, unit: 'roll', cost: '$55' },
        { item: 'Grout sealer', qty: 1, unit: 'bottle', cost: '$18' },
        { item: 'Tools & supplies', qty: 1, unit: 'set', cost: '$90' },
      ],
      steps: [
        'Remove existing tile and clean subfloor thoroughly',
        'Inspect and repair any soft spots in the subfloor',
        'Install cement backer board and waterproofing membrane',
        'Plan tile layout starting from center of room',
        'Apply thin-set and lay tiles with consistent spacing',
        'Allow adhesive to cure for 24 hours before grouting',
        'Apply grout, clean excess, and seal after 72 hours',
      ],
      warnings: [
        'Turn off water supply before removing old tile near plumbing',
        'Ensure subfloor is level — use self-leveling compound if needed',
      ],
      tip: 'Rent a tile saw for clean cuts — it will save you hours of work and give professional results.',
    };
    currentEstimate = demo;
    renderResults(demo);
    const banner = document.getElementById('sharedBanner');
    if (banner) {
      banner.innerHTML = '🎯 This is a sample estimate — <a href="#" onclick="clearResults(event)" style="color:white;font-weight:600;">try your own project</a>';
      banner.classList.add('visible');
    }
    setTimeout(showSignupPopup, 2000);
  } catch(e) {
    showToast('Could not load demo — try running your own estimate!');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '👀 See a sample estimate'; }
  }
}

function clearResults(e) {
  if (e) e.preventDefault();
  document.getElementById('results').classList.remove('visible');
  const banner = document.getElementById('sharedBanner');
  if (banner) banner.classList.remove('visible');
  currentEstimate = null;
}
