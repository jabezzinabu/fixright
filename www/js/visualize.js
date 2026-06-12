// ─── VIZ USAGE TRACKING ───────────────────────────────────────────────────────
let _vizCredits = 0; // cached from Supabase

async function loadVizCredits() {
  if (!currentUser || !dbReady) return 0;
  try {
    const { data } = await db.from('profiles').select('viz_credits').eq('id', currentUser.id).single();
    _vizCredits = data?.viz_credits ?? 0;
    return _vizCredits;
  } catch(e) { return 0; }
}

async function checkVizCredits() {
  if (!currentUser) return false;
  await loadVizCredits();
  return _vizCredits > 0;
}

async function deductVizCredit() {
  if (!currentUser || !dbReady) return;
  _vizCredits = Math.max(0, _vizCredits - 1);
  try {
    await db.from('profiles').update({ viz_credits: _vizCredits }).eq('id', currentUser.id);
  } catch(e) { /* silent */ }
}

async function addVizCredits(amount) {
  if (!currentUser || !dbReady) return;
  _vizCredits += amount;
  try {
    await db.from('profiles').update({
      viz_credits: _vizCredits,
      viz_credits_total: db.raw ? undefined : undefined
    }).eq('id', currentUser.id);
    // Also update total
    const { data } = await db.from('profiles').select('viz_credits_total').eq('id', currentUser.id).single();
    const newTotal = (data?.viz_credits_total || 0) + amount;
    await db.from('profiles').update({ viz_credits: _vizCredits, viz_credits_total: newTotal }).eq('id', currentUser.id);
  } catch(e) { /* silent */ }
}

// Backward compat shims
function getVizCount() { return _vizCredits > 0 ? 0 : 1; } // 0 = has credits, 1 = no credits
async function checkFreeVizUsed() { await loadVizCredits(); return _vizCredits <= 0; }
function incVizCount() { deductVizCredit(); }
function markFreeVizUsed() { deductVizCredit(); }

function updateFreeNotice() {
  const notice = document.getElementById('vizFreeNotice');
  if (notice) {
    if (!currentUser) {
      notice.style.display = 'inline-flex';
      notice.textContent = '🔒 Sign in for 3 free visualizations';
    } else if (_vizCredits > 0) {
      notice.style.display = 'inline-flex';
      notice.textContent = `🎁 ${_vizCredits} visualization${_vizCredits > 1 ? 's' : ''} remaining`;
    } else {
      notice.style.display = 'none';
    }
  }
  // Update header credit badge
  const badge = document.getElementById('vizCreditBadge');
  if (badge) {
    if (currentUser && _vizCredits > 0) {
      badge.textContent = `✨ ${_vizCredits} viz credit${_vizCredits !== 1 ? 's' : ''}`;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }
}

// ─── VIZ PHOTO HANDLING ───────────────────────────────────────────────────────
let vizPhotoBase64 = null;
let vizPhotoDataUrl = null;
let vizPhotoBlob = null;
let vizConceptItem = null;
let vizConceptBase64 = null;
let vizConceptImgSrc = null;
function triggerVizFile() {
  // No longer needed — input covers zone directly
}

function handleVizPhoto(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 1024;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) { const s = MAX/Math.max(w,h); w=Math.round(w*s); h=Math.round(h*s); }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      vizPhotoDataUrl = canvas.toDataURL('image/jpeg', 0.88);
      vizPhotoBase64 = vizPhotoDataUrl.split(',')[1];
      canvas.toBlob(b => { vizPhotoBlob = b; }, 'image/jpeg', 0.88);
      const prev = document.getElementById('vizPhotoPreview');
      prev.src = vizPhotoDataUrl; prev.style.display = 'block';
      document.getElementById('vizPhotoPlaceholder').style.display = 'none';
      document.getElementById('vizPhotoClear').style.display = 'flex';
      document.getElementById('vizPhotoInput').style.zIndex = '-1';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearVizPhoto(e) {
  e.stopPropagation();
  vizPhotoBase64 = null; vizPhotoDataUrl = null; vizPhotoBlob = null;
  document.getElementById('vizPhotoPreview').style.display = 'none';
  document.getElementById('vizPhotoClear').style.display = 'none';
  document.getElementById('vizPhotoInput').value = '';
  document.getElementById('vizPhotoInput').style.zIndex = '2';
  document.getElementById('step1Next').disabled = true;
  // Reset placeholder to default
  document.getElementById('vizPhotoPlaceholder').innerHTML = `
    <div class="photo-icon">📷</div>
    <div class="photo-label">Drop a photo or click to browse</div>
    <div class="photo-sub">The AI applies changes to your actual space</div>
  `;
  document.getElementById('vizPhotoPlaceholder').style.display = 'block';
}

// drag/drop on viz zone
const vzone = document.getElementById('vizPhotoZone');
if (vzone) {
  vzone.addEventListener('dragover', e => { e.preventDefault(); vzone.classList.add('drag-over'); });
  vzone.addEventListener('dragleave', () => vzone.classList.remove('drag-over'));
  vzone.addEventListener('drop', e => {
    e.preventDefault(); vzone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) handleVizPhoto(f);
  });
}



// ─── RUN VISUALIZATION ────────────────────────────────────────────────────────
let vizResultImageSrc = null;

async function runVisualize() {
  // Require sign in for viz
  if (!currentUser) { showToast('Please sign in to use visualizations'); showAuthModal(); return; }
  // Check paywall — skip for admin/pro
  const freeUsed = await checkFreeVizUsed();
  if (!isPro() && freeUsed) { showUpgradeModal(); return; }

  const desc = document.getElementById('vizDesc').value.trim();

  if (!vizPhotoBase64) { showToast('Please upload your space photo first'); return; }
  if (!desc && !vizConceptItem) { showToast('Please describe what you want, or pick a concept from Discover'); return; }


  setVizLoading(true);
  document.getElementById('vizResult').classList.remove('visible');
  hideVizError();

  try {
    // Step 1: Craft precise edit prompt using Claude
    let editPrompt = `Edit this photo to show the following renovation completed photorealistically: ${desc || vizConceptItem?.desc || ''}. Keep the same camera angle, lighting, and surroundings. Make it look like a real photograph.`;
    try {
      setVizStep('Crafting edit prompt with Claude...');
      setVizProgress(20);

      // Build the message content — include concept image if available
      const msgContent = [];
      msgContent.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: vizPhotoBase64 } });

      let promptText;
      if (vizConceptBase64) {
        // Concept mode: pass both images
        msgContent.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: vizConceptBase64 } });
        promptText = `You are given two images:
1. The FIRST image is the user's actual space (to be transformed)
2. The SECOND image is the design inspiration/concept (the target look)

Write a precise image editing instruction to apply the design style, materials, colors, and aesthetic from the inspiration image to the user's space.${desc ? '\n\nAdditional user notes: ' + desc : ''}

Start with "Edit the first photo to...". Preserve the same camera angle and room layout. Specify exactly what materials, colors, and design elements to apply from the inspiration. Max 120 words. Return ONLY the instruction.`;
      } else {
        promptText = `Analyse this photo. Write a precise image editing instruction to apply this renovation: ${desc}\n\nStart with "Edit this photo to...". Describe what to preserve and what to change. Specify materials, colors, style. Max 100 words. Return ONLY the instruction.`;
      }

      msgContent.push({ type: 'text', text: promptText });

      const promptResp = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          messages: [{ role: 'user', content: msgContent }]
        })
      });
      const pd = await promptResp.json();
      if (promptResp.ok) editPrompt = pd.content[0].text;
    } catch(e) { /* use fallback prompt */ }

    // Step 2: Call OpenAI gpt-image-1 edit
    setVizStep('Generating photorealistic render...');
    setVizProgress(50);

    setVizProgress(70);
    // Route through server proxy — key stays hidden
    const imgResp = await fetch('/api/openai-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: editPrompt,
        imageBase64: vizPhotoBase64,
        size: '1024x1024'
      })
    });

    const imgData = await imgResp.json();
    if (!imgResp.ok) throw new Error(JSON.stringify(imgData.error || imgData) || 'Image generation failed');

    setVizProgress(95);
    vizResultImageSrc = imgData.data[0].b64_json
      ? 'data:image/png;base64,' + imgData.data[0].b64_json
      : imgData.data[0].url;

    // Render result
    document.getElementById('vizBeforeAfter').innerHTML = `
      <div>
        <div class="viz-ba-label before">Before</div>
        <img src="${vizPhotoDataUrl}" style="width:100%;border-radius:10px;display:block;">
      </div>
      <div>
        <div class="viz-ba-label after">After ✨</div>
        <img src="${vizResultImageSrc}" style="width:100%;border-radius:10px;display:block;">
      </div>`;

    incVizCount();
    setVizLoading(false);
    document.getElementById('vizResult').classList.add('visible');
    document.getElementById('vizResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('✨ Visualization complete!');
    setTimeout(showInstallBanner, 3000);

    // Show upgrade prompt after success (skip for pro/admin)
    if (!isPro()) {
      const delay = (parseInt(localStorage.getItem('flag_upgradeDelay') || '4')) * 1000;
      setTimeout(() => showUpgradeModal(), delay);
    }

  } catch(e) {
    setVizLoading(false);
    let msg = e.message || 'Something went wrong';
    if (msg.includes('not valid JSON') || msg.includes('Unexpected token')) {
      msg = 'Server error — check that ANTHROPIC_API_KEY is set in Vercel → Settings → Environment Variables, then redeploy.';
    } else if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('failed to fetch')) {
      msg = 'Network error — check your connection and try again.';
    }
    showVizError(msg);
  }
}

function newViz() {
  document.getElementById('vizResult').classList.remove('visible');
  clearVizPhoto(new Event('click'));
  document.getElementById('vizDesc').value = '';
  vizResultImageSrc = null;
  if (getVizCount() >= 1) showUpgradeModal();
}

function downloadViz() {
  if (!vizResultImageSrc) return;
  const a = document.createElement('a');
  a.href = vizResultImageSrc;
  a.download = 'diy-estimator-visualization.png';
  a.click();
}

function shareViz() {
  if (!vizResultImageSrc) return;
  if (navigator.share) {
    navigator.share({ title: 'My DIY Estimator Visualization', text: 'Check out my DIY Estimator renovation concept!' })
      .catch(() => {});
  } else {
    showToast('Right-click the image to save and share');
  }
}

// ─── UPGRADE MODAL ────────────────────────────────────────────────────────────
function showUpgradeModal() {
  if (!currentUser) { showAuthModal(); return; }
  document.getElementById('upgradeModal').classList.add('open');
}
function showVizPackageModal() {
  if (!currentUser) { showSignupPopup(); return; }
  document.getElementById('upgradeModal').classList.add('open');
}
function closeUpgradeModal() {
  document.getElementById('upgradeModal').classList.remove('open');
}

const VIZ_PRICE_IDS = {
  3:  'price_1TgQlHRU8c4qhAdsQSgEKrzb',
  5:  'price_1TgQlDRU8c4qhAdsMUzLDf03',
  10: 'price_1TgQl8RU8c4qhAdskDOq6ju5',
  25: 'price_1TgQl2RU8c4qhAds1Opw75gL',
};

async function buyVizPackage(credits) {
  if (!currentUser) {
    showToast('Please sign in first');
    closeUpgradeModal();
    showAuthModal();
    return;
  }
  const priceId = VIZ_PRICE_IDS[credits];
  if (!priceId) { showToast('Invalid package'); return; }

  // Disable all package buttons and show loading
  document.querySelectorAll('#upgradeModal button[onclick^="buyVizPackage"]').forEach(b => { b.disabled = true; b.style.opacity = '0.6'; });
  showToast('⏳ Opening checkout...');
  try {
    const resp = await fetch('/api/stripe-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId,
        userId: currentUser.id,
        email: currentUser.email,
        mode: 'payment',
        vizCredits: credits,
        successUrl: window.location.origin + '/?viz_purchased=' + credits,
        cancelUrl: window.location.href
      })
    });
    const data = await resp.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error(data.error || 'Could not create checkout session');
    }
  } catch(e) {
    showToast('Error: ' + e.message);
  }
}

// Handle return from Stripe after purchase
(function checkVizPurchaseReturn() {
  const params = new URLSearchParams(location.search);
  const purchased = params.get('viz_purchased');
  if (purchased) {
    const credits = parseInt(purchased);
    window.history.replaceState({}, document.title, location.pathname);
    // Credits will be added by webhook — just show a toast
    setTimeout(() => {
      showToast(`✅ ${credits} visualizations added to your account!`);
      loadVizCredits().then(updateFreeNotice);
    }, 1500);
  }
})();

// Legacy compat
async function goUpgrade(plan) { showVizPackageModal(); }

async function getStripeConfig(key) {
  try {
    const r = await fetch(`https://zciyiltkaunbozoedfcr.supabase.co/rest/v1/app_config?key=eq.${key}&select=value`, {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjaXlpbHRrYXVuYm96b2VkZmNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5OTU4OTAsImV4cCI6MjA5MjU3MTg5MH0._nEPOkh1Ocn5uTwAju2zxim0JH6aROdmuFf1OdsvKzI'
      }
    });
    const d = await r.json();
    return d?.[0]?.value || null;
  } catch(e) { return null; }
}

// ─── VIZ UI HELPERS ───────────────────────────────────────────────────────────
function setVizLoading(on) {
  const el = document.getElementById('vizLoading');
  const btn = document.getElementById('vizBtn');
  el.classList.toggle('visible', on);
  btn.disabled = on;
  if (on) {
    btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border:2px solid rgba(255,255,255,.25);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;"></div> Generating...';
    setVizProgress(10);
  } else {
    btn.innerHTML = '✨ Generate Visualization';
    setVizProgress(0);
  }
}
function setVizProgress(pct) {
  document.getElementById('vizProgressBar').style.width = pct + '%';
}
function setVizStep(msg) {
  document.getElementById('vizLoadingStep').textContent = msg;
}
function hideVizError() {
  const e = document.getElementById('vizErrorBox');
  e.classList.remove('visible'); e.innerHTML = '';
}
function showVizError(msg) {
  const e = document.getElementById('vizErrorBox');
  e.innerHTML = msg; e.classList.add('visible');
}


// ─── ESTIMATE THIS DESIGN — DELTA ANALYSIS SKILL ─────────────────────────────
// Architecture:
//   Skill 1: Visualization (before + concept → after image) ✅
//   Skill 2: Delta Analysis (before + after → what changed only) ← runs here
//   Skill 3: Estimation (delta list → cost) ✅
//
// This function runs Skill 2 before Skill 3 so the estimator only prices
// what was ADDED or CHANGED, not what already existed in the before image.

async function estimateThisDesign() {
  if (!vizResultImageSrc) return;

  // ── Load after image into estimate tab ──────────────────────────────────────
  const afterImg = new Image();
  afterImg.crossOrigin = 'anonymous';

  const loadAfterImage = () => new Promise((resolve, reject) => {
    afterImg.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = afterImg.width; canvas.height = afterImg.height;
      canvas.getContext('2d').drawImage(afterImg, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      resolve({ dataUrl, base64: dataUrl.split(',')[1] });
    };
    afterImg.onerror = reject;
    afterImg.src = vizResultImageSrc;
  });

  // Show loading state on the estimate button
  const estimateBtn = document.querySelector('.btn-viz-action.primary-action');
  if (estimateBtn) { estimateBtn.disabled = true; estimateBtn.textContent = '⏳ Analysing changes...'; }
  showToast('🔍 Identifying what changed — building estimate...');

  try {
    // Load after image
    const { dataUrl: afterDataUrl, base64: afterBase64 } = await loadAfterImage();

    // ── SKILL 2: Delta Analysis ──────────────────────────────────────────────
    // Send BEFORE + AFTER to Claude and ask only what was added/changed
    let deltaDescription = '';

    if (vizPhotoBase64) {
      // We have the before image — run proper delta analysis
      console.log('Delta Analysis: before image available, length:', vizPhotoBase64.length);
      const deltaPrompt = `You are a renovation cost estimator's assistant performing a DELTA ANALYSIS.

You are given TWO images:
1. BEFORE image — the original space before any renovation
2. AFTER image — the same space after AI-generated renovation

Your task: Compare the two images carefully and identify ONLY what was ADDED or CHANGED.
Do NOT include anything that existed in the before image.

Return a structured list in this exact format:
ADDED: [comma-separated list of new items, materials, or features]
CHANGED: [comma-separated list of existing items that were modified]
EXISTING (exclude from estimate): [comma-separated list of things already present before]

Be specific about materials. For example:
- "decomposed granite ground cover (approx 200 sq ft)" not just "gravel"
- "3x ornamental cherry trees (15-gallon)" not just "trees"
- "river rock border edging (approx 40 linear ft)" not just "rocks"

Only list what you can clearly see was added or changed. Do not guess.`;

      const deltaResp = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'BEFORE image:' },
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: vizPhotoBase64 } },
              { type: 'text', text: 'AFTER image:' },
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: afterBase64 } },
              { type: 'text', text: deltaPrompt }
            ]
          }]
        })
      });

      const deltaData = await deltaResp.json();
      if (deltaData.content?.[0]?.text) {
        const raw = deltaData.content[0].text.trim();
        // Extract just ADDED and CHANGED lines for the estimate
        const addedMatch = raw.match(/ADDED:\s*([\s\S]+?)(?=\nCHANGED:|\nEXISTING:|$)/);
        const changedMatch = raw.match(/CHANGED:\s*([\s\S]+?)(?=\nEXISTING:|$)/);
        const existingMatch = raw.match(/EXISTING[^:]*:\s*([\s\S]+?)(?=\n[A-Z]|$)/);

        const added = addedMatch?.[1]?.trim() || '';
        const changed = changedMatch?.[1]?.trim() || '';
        const existing = existingMatch?.[1]?.trim() || '';

        if (added || changed) {
          deltaDescription = '';
          if (added && added !== 'none' && added !== 'None') deltaDescription += `Added: ${added}. `;
          if (changed && changed !== 'none' && changed !== 'None') deltaDescription += `Changed: ${changed}. `;
          if (existing) deltaDescription += `Already existed before renovation (DO NOT include in estimate): ${existing}.`;
        }
      }
    }

    // ── Fallback if delta analysis failed or no before image ─────────────────
    console.log('Delta result:', deltaDescription ? deltaDescription.substring(0,100) : 'EMPTY — using fallback');
    if (!deltaDescription) {
      const userNotes = document.getElementById('vizDesc').value.trim();
      const conceptDesc = vizConceptItem?.desc || '';
      const conceptTitle = vizConceptItem?.title || '';
      const conceptStyle = vizConceptItem?.style || vizSelectedStyle || '';
      deltaDescription = '';
      if (conceptTitle) deltaDescription += `${conceptStyle} renovation — ${conceptTitle}. `;
      if (conceptDesc) deltaDescription += `Design: ${conceptDesc}. `;
      if (userNotes) deltaDescription += `Changes: ${userNotes}. `;
      if (!deltaDescription) deltaDescription = 'Estimate only the renovation work and additions visible in this image.';
    }

    // ── Load after image into estimate photo zone ─────────────────────────────
    imageBase64 = afterBase64;
    imageMediaType = 'image/jpeg';
    const preview = document.getElementById('photoPreview');
    preview.src = afterDataUrl; preview.style.display = 'block';
    document.getElementById('photoPlaceholder').style.display = 'none';
    document.getElementById('photoClear').style.display = 'flex';

    // ── Set description with delta result ─────────────────────────────────────
    document.getElementById('description').value = deltaDescription.trim();

    // ── Switch to estimate tab ────────────────────────────────────────────────
    switchTab('estimate');

    // ── Show before/after panel on estimate tab ───────────────────────────────
    const beforeSrc = vizPhotoDataUrl || (vizPhotoBase64 ? 'data:image/jpeg;base64,' + vizPhotoBase64 : null);
    const afterSrc = vizResultImageSrc;
    if (beforeSrc || afterSrc) {
      let panel = document.getElementById('vizBeforeAfterPanel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'vizBeforeAfterPanel';
        panel.style.cssText = 'margin-bottom:1.25rem;border-radius:14px;overflow:hidden;border:1px solid var(--border);';
        const formCard = document.querySelector('.form-card');
        if (formCard) formCard.before(panel);
      }
      panel.innerHTML = `
        <div style="background:#E8481C;padding:0.6rem 1rem;display:flex;align-items:center;gap:0.5rem;">
          <span style="color:white;font-size:0.8rem;font-weight:700;">✨ Your Visualization</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
          ${beforeSrc ? `<div style="position:relative;">
            <div style="font-size:0.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;padding:0.4rem 0.6rem;background:#f9fafb;border-bottom:1px solid var(--border);">Before</div>
            <img src="${beforeSrc}" style="width:100%;aspect-ratio:4/3;object-fit:cover;display:block;cursor:pointer;" onclick="openImgLightbox('${beforeSrc}')">
          </div>` : ''}
          ${afterSrc ? `<div style="position:relative;border-left:1px solid var(--border);">
            <div style="font-size:0.7rem;font-weight:700;color:#E8481C;text-transform:uppercase;letter-spacing:0.08em;padding:0.4rem 0.6rem;background:#fff5f2;border-bottom:1px solid #fde8e0;">After</div>
            <img src="${afterSrc}" style="width:100%;aspect-ratio:4/3;object-fit:cover;display:block;cursor:pointer;" onclick="openImgLightbox('${afterSrc}')">
          </div>` : ''}
        </div>`;
      panel.style.display = 'block';
    }

    // Auto-submit the estimate instead of making user click again
    showToast('🔍 Delta analysis complete — generating estimate...');
    setTimeout(async () => {
      try {
        await runEstimate();
      } catch(err) {
        showToast('Estimate generation failed — please try again');
      }
    }, 500);

  } catch(e) {
    showToast('Could not analyse changes — loading estimate with full description');
    // Graceful fallback — switch to estimate tab, auto-submit
    switchTab('estimate');
    setTimeout(async () => {
      try { await runEstimate(); } catch(err) {}
    }, 500);
  } finally {
    if (estimateBtn) { estimateBtn.disabled = false; estimateBtn.textContent = '🔧 Estimate This Design'; }
  }
}

// ─── EDIT & RE-RENDER ─────────────────────────────────────────────────────────
function showEditPanel() {
  const panel = document.getElementById('vizEditPanel');
  const editDesc = document.getElementById('vizEditDesc');
  // Pre-fill with current description
  editDesc.value = document.getElementById('vizDesc').value;
  panel.style.display = 'block';
  editDesc.focus();
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideEditPanel() {
  document.getElementById('vizEditPanel').style.display = 'none';
}

async function reRender() {
  const newDesc = document.getElementById('vizEditDesc').value.trim();
  if (!newDesc) { showToast('Please add a description'); return; }

  // Check paywall — re-renders count as new uses after free tier
  if (!currentUser) { showToast('Please sign in to use visualizations'); showAuthModal(); return; }
  if (!isPro() && _freeVizUsed) { showUpgradeModal(); return; }

  // Update main description and re-run
  document.getElementById('vizDesc').value = newDesc;
  hideEditPanel();
  document.getElementById('vizResult').classList.remove('visible');
  await runVisualize();
}

// ─── GUIDED VIZ FLOW ──────────────────────────────────────────────────────────
let vizCurrentStep = 1;
let vizSelectedStyle = '';
const styleIcons = {
  'Modern':'🏙','Scandinavian':'❄️','Farmhouse':'🌾','Industrial':'⚙️',
  'Bohemian':'🌺','Traditional':'🏛','Mediterranean':'🌊',
  'Mid-Century Modern':'🕰','Minimalist':'◻️'
};

function goVizStep(step) {
  // Validate — can't go to step 2 without a photo
  if (step === 2 && !vizPhotoBase64) { showToast('Please upload a photo first'); return; }

  vizCurrentStep = step;
  document.querySelectorAll('.viz-step-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('vizStep' + step);
  if (panel) panel.classList.add('active');

  // Update 2-step nav only
  [1, 2].forEach(i => {
    const num = document.getElementById('stepNum' + i);
    const lbl = document.getElementById('stepLbl' + i);
    if (!num || !lbl) return;
    num.className = 'viz-step-num' + (i === step ? ' active' : i < step ? ' done' : '');
    lbl.className = 'viz-step-label' + (i === step ? ' active' : i < step ? ' done' : '');
    num.textContent = i < step ? '✓' : i;
  });

  // Populate step 2 thumbnails
  if (step === 2) {
    // Your space thumbnail
    const thumbSrc = vizPhotoDataUrl || document.getElementById('vizPhotoPreview').src || '';
    const thumb = document.getElementById('step2PhotoThumb');
    if (thumb && thumbSrc && thumbSrc.startsWith('data:')) {
      thumb.src = thumbSrc;
    }

    // Concept thumbnail
    const conceptBox = document.getElementById('step2ConceptContent');
    if (conceptBox) {
      if (vizConceptItem && vizConceptImgSrc) {
        conceptBox.innerHTML = `
          <img src="${vizConceptImgSrc}" alt="${vizConceptItem.title}"
            style="width:100%;height:110px;object-fit:cover;display:block;"
            onerror="this.style.display='none'">
          <div style="padding:3px 8px 5px;font-size:0.72rem;font-weight:600;color:#1c2b3a;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${vizConceptItem.title}
          </div>`;
      } else {
        conceptBox.innerHTML = `
          <div style="height:110px;display:flex;align-items:center;justify-content:center;
            flex-direction:column;gap:4px;padding:0.5rem;">
            <div style="font-size:1.5rem;">🌟</div>
            <div style="font-size:0.72rem;color:var(--muted);text-align:center;">No concept<br>selected</div>
            <button onclick="goVizStep(1)" style="background:none;border:1px solid var(--border);
              border-radius:6px;padding:2px 8px;font-size:0.7rem;cursor:pointer;color:#1c2b3a;
              font-family:'DM Sans',sans-serif;margin-top:2px;">Browse</button>
          </div>`;
      }
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function selectStyle(style) {
  vizSelectedStyle = style;
  document.querySelectorAll('.style-tile').forEach(t => {
    t.classList.toggle('selected', t.dataset.style === style);
  });
  // step2Next removed in 2-step flow — no-op
}

const EXAMPLE_PHOTOS = {
  kitchen:  'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=1024&h=768&fit=crop&auto=format',
  living:   'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=1024&h=768&fit=crop&auto=format',
  garden:   'https://images.unsplash.com/photo-1588854337115-1c67d9247e4f?w=1024&h=768&fit=crop&auto=format',
  bedroom:  'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=1024&h=768&fit=crop&auto=format',
  exterior: 'https://images.unsplash.com/photo-1568605117036-5da5db4d073d?w=1024&h=768&fit=crop&auto=format',
};

function useExamplePhoto(type) {
  const url = EXAMPLE_PHOTOS[type];
  if (!url) return;
  showToast('Loading example space...');

  // Fetch image and convert to base64 via canvas
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const MAX = 1024;
    let w = img.width || 1024, h = img.height || 768;
    if (w > MAX || h > MAX) { const s = MAX/Math.max(w,h); w=Math.round(w*s); h=Math.round(h*s); }
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    vizPhotoDataUrl = dataUrl;
    vizPhotoBase64 = dataUrl.split(',')[1];
    canvas.toBlob(b => { vizPhotoBlob = b; }, 'image/jpeg', 0.88);

    const prev = document.getElementById('vizPhotoPreview');
    prev.src = dataUrl; prev.style.display = 'block';
    document.getElementById('vizPhotoPlaceholder').style.display = 'none';
    document.getElementById('vizPhotoClear').style.display = 'flex';
    document.getElementById('vizPhotoInput').style.zIndex = '-1';
    document.getElementById('step1Next').disabled = false;

    // Highlight selected tile
    document.querySelectorAll('.example-space-tile').forEach(t => {
      t.style.borderColor = t.title.toLowerCase().includes(type) ? 'var(--rust)' : 'transparent';
    });
    showToast('✓ Example space loaded — hit Next to continue');
  };
  img.onerror = () => {
    showToast('Could not load example — please upload your own photo');
  };
  img.src = url;
}

// ─── VIZ TOGGLE MODE ──────────────────────────────────────────────────────────
let vizModeEnabled = false;

function toggleVizMode() {
  vizModeEnabled = !vizModeEnabled;
  const row = document.getElementById('vizToggleRow');
  const btn = document.getElementById('submitBtn');
  row.classList.toggle('active', vizModeEnabled);
  btn.textContent = vizModeEnabled ? '✨ Get Estimate + Visualization' : '🔧 Get My Estimate';
}

// ─── COMBINED VIZ RESULT ──────────────────────────────────────────────────────
function showCombinedViz(beforeSrc, afterSrc) {
  const panel = document.getElementById('combinedVizPanel');
  document.getElementById('combinedVizBefore').src = beforeSrc;
  document.getElementById('combinedVizAfter').src = afterSrc;
  panel.classList.add('visible');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openFullViz() {
  // Switch to visualize tab and show the result
  if (vizResultImageSrc) {
    switchTab('visualize');
    setTimeout(() => {
      const vizResult = document.getElementById('vizResult');
      if (vizResult) vizResult.classList.add('visible');
    }, 300);
  }
}

// ─── COMBINED RUN ESTIMATE + VIZ ──────────────────────────────────────────────
async function runCombinedEstimate() {
  const desc = document.getElementById('description').value.trim();
  if (!desc && !imageBase64) { showToast('Please add a photo or description'); return; }
  if (!checkEstPaywall()) return;

  // Show loading state immediately
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ Generating estimate...';

  // Always run estimate — viz is an optional bonus on top
  if (imageBase64) {
    const hasCredits = isPro() || (currentUser && await checkVizCredits());
    if (hasCredits) {
      // Has credits — run estimate + viz together
      await generateCombinedViz();
    } else {
      // No credits/not signed in — run estimate only, then prompt
      await runEstimate();
      setTimeout(() => {
        showSavePrompt();
        if (!currentUser) {
          setTimeout(showSignupPopup, 1500);
        } else {
          setTimeout(showVizPackageModal, 1500);
        }
      }, 1200);
    }
  } else {
    // No photo — just estimate
    await runEstimate();
    setTimeout(() => { showSavePrompt(); if (!currentUser) setTimeout(showSignupPopup, 1500); }, 1200);
  }
}

async function generateCombinedViz() {
  const desc = document.getElementById('description').value.trim();

  // Show the viz panel in loading state
  const panel = document.getElementById('combinedVizPanel');
  const loading = document.getElementById('combinedVizLoading');
  const actions = document.getElementById('combinedVizActions');
  const beforeAfter = document.querySelector('.combined-viz-before-after');

  panel.classList.add('visible');
  loading.style.display = 'block';
  actions.style.display = 'none';
  if (beforeAfter) beforeAfter.style.display = 'none';
  document.getElementById('combinedVizLoadingText').textContent = 'Crafting your visualization...';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Set viz state
  vizPhotoBase64 = imageBase64;
  vizPhotoDataUrl = 'data:image/jpeg;base64,' + imageBase64;

  try {
    // Step 1: Generate a high-quality photorealistic prompt via Claude
    document.getElementById('combinedVizLoadingText').textContent = 'Analysing your space...';
    let editPrompt = `Edit this photo to show the following renovation completed photorealistically: ${desc}. Use realistic materials, textures, and lighting. Match the perspective and scale of the original photo exactly. Do not add cartoon effects or unrealistic elements. Photorealistic architectural photography style.`;

    try {
      const pr = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 250,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
              { type: 'text', text: `You are an expert at writing image editing prompts for photorealistic home renovation renders.

Look at this photo carefully. Write a precise image editing instruction to show this renovation completed:
"${desc}"

Rules:
- Start with "Edit this photo to show"
- Describe EXACT materials, colors, textures (e.g. "decomposed granite in warm beige tones", "river rocks 3-5 inch diameter", "Japanese maple with red leaves")
- Specify what to KEEP unchanged from the original (fence, existing structures, sky, etc.)
- Use the phrase "photorealistic architectural photography" 
- No cartoons, no illustrations, no HDR oversaturation
- Match the exact camera angle and perspective of the original
- Max 120 words
- Return ONLY the prompt, no explanation` }
            ]
          }]
        })
      });
      const pd = await pr.json();
      if (pd.content?.[0]?.text) editPrompt = pd.content[0].text;
    } catch(e) { console.error('Prompt gen error:', e); }

    // Step 2: Generate the image
    document.getElementById('combinedVizLoadingText').textContent = 'Rendering your renovation...';
    const imgResp = await fetch('/api/openai-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: editPrompt, imageBase64: imageBase64, size: '1024x1024' })
    });
    const imgData = await imgResp.json();

    // Handle both b64_json and url response formats from OpenAI
    const imgItem = imgData.data?.[0];
    const imgSrc = imgItem?.b64_json
      ? 'data:image/png;base64,' + imgItem.b64_json
      : imgItem?.url || null;

    if (imgSrc) {
      vizResultImageSrc = imgSrc;
      incVizCount();
      trackEvent('visualizations_count');

      // Hide the teaser — user now has their viz
      const teaserToHide = document.getElementById('vizTeaser');
      if (teaserToHide) { teaserToHide.style.display = 'none'; teaserToHide.innerHTML = ''; }

      // Update credit display
      updateFreeNotice();

      // Show before/after briefly, then auto-run estimate (no approval step needed)
      document.getElementById('combinedVizBefore').src = vizPhotoDataUrl;
      document.getElementById('combinedVizAfter').src = vizResultImageSrc;
      if (beforeAfter) beforeAfter.style.display = 'grid';
      loading.style.display = 'none';
      actions.style.display = 'none'; // hide approval buttons — auto-continue
      // Auto-run the estimate immediately
      await confirmVizAndEstimate();
    } else {
      // Extract error message properly regardless of format
      let errMsg = 'No image returned';
      if (imgData.error) {
        errMsg = typeof imgData.error === 'string' ? imgData.error
          : imgData.error.message || imgData.error.code || JSON.stringify(imgData.error);
      } else if (imgData.message) {
        errMsg = imgData.message;
      }
      console.error('OpenAI image error:', JSON.stringify(imgData));
      throw new Error(errMsg);
    }

  } catch(e) {
    loading.style.display = 'none';
    panel.classList.remove('visible');
    const errMsg = e.message || 'please try again';
    showToast('Visualization failed — ' + errMsg);
    // Show error in panel too
    const panel2 = document.getElementById('combinedVizPanel');
    if (panel2) {
      panel2.classList.add('visible');
      panel2.innerHTML = `<div style="padding:1.25rem;background:var(--cream);border-radius:12px;border:1px solid var(--border);">
        <div style="color:var(--rust);font-weight:600;margin-bottom:0.5rem;">⚠ Visualization failed</div>
        <div style="font-size:0.85rem;color:var(--muted);margin-bottom:1rem;">${errMsg}</div>
        <button onclick="generateCombinedViz()" style="background:#1c2b3a;color:white;border:none;border-radius:8px;padding:0.6rem 1.25rem;font-size:0.85rem;cursor:pointer;font-family:'DM Sans',sans-serif;">Try Again</button>
      </div>`;
    }
    console.error('Viz error full:', e);
  }
}

async function reRenderViz() {
  // Reset and re-run the visualization
  vizResultImageSrc = null;
  await generateCombinedViz();
}

async function confirmVizAndEstimate() {
  // User approved the viz — now run the smart estimate
  const actions = document.getElementById('combinedVizActions');
  actions.innerHTML = '<div style="color:rgba(255,255,255,0.7);font-size:0.85rem;padding:0.5rem 0;">⏳ Running area analysis + estimate...</div>';

  // Show loading
  const loading = document.getElementById('loading');
  const tipEl = document.getElementById('loadingTip');
  if (loading) loading.style.display = 'block';
  if (tipEl) tipEl.textContent = 'Calculating area and quantities...';

  const desc = document.getElementById('description').value.trim();

  try {
    // Step 1: Area analysis — Claude looks at before photo to estimate dimensions
    let areaContext = '';
    try {
      const areaResp = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
              { type: 'text', text: `Analyze this photo and estimate the approximate dimensions and area of the space. Look for visual cues like fence panels (typically 8ft wide), doors (typically 3ft wide), standard pavers (12"x12" or 24"x24"), steps, or any other reference objects. 

Provide a brief, specific estimate like:
- Total area: approximately X sq ft
- Key dimensions: X ft wide × Y ft deep
- Reference clues used: [what you used to estimate]

Be concise — 3-4 lines max. Return only the measurements, no explanation.` }
            ]
          }]
        })
      });
      const areaData = await areaResp.json();
      if (areaData.content?.[0]?.text) areaContext = areaData.content[0].text;
    } catch(e) { console.error('Area analysis error:', e); }

    if (tipEl) tipEl.textContent = 'Identifying additions and calculating costs...';

    // Step 2: Delta analysis — what was added in after vs before
    let deltaContext = '';
    if (vizResultImageSrc) {
      try {
        const afterBase64 = vizResultImageSrc.split(',')[1];
        const deltaResp = await fetch('/api/anthropic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 300,
            messages: [{
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
                { type: 'image', source: { type: 'base64', media_type: 'image/png', data: afterBase64 } },
                { type: 'text', text: `Image 1 is BEFORE. Image 2 is AFTER renovation.

List ONLY what was ADDED or CHANGED. Do NOT include anything already present in the before image.

Format exactly:
ADDED: [comma-separated list of new elements]
CHANGED: [comma-separated list of modified elements]  
EXISTING (exclude from estimate): [comma-separated list of things already there]

Be specific about materials (e.g. "decomposed granite ground cover", "river rocks", "Japanese maple tree x2").` }
              ]
            }]
          })
        });
        const deltaData = await deltaResp.json();
        if (deltaData.content?.[0]?.text) deltaContext = deltaData.content[0].text;
      } catch(e) { console.error('Delta error:', e); }
    }

    // Step 3: Build comprehensive estimate description
    let estimateDesc = desc;
    if (areaContext || deltaContext) {
      estimateDesc = `${desc}

SPACE DIMENSIONS (from photo analysis):
${areaContext}

RENOVATION ADDITIONS ONLY (do not estimate existing items):
${deltaContext}

IMPORTANT: Use the area measurements above to calculate accurate material quantities. Only estimate the ADDED and CHANGED items listed above — do NOT include cost for existing structures like fences, concrete, existing grass, etc.`;
    }

    // Override the description field temporarily for the estimate
    const descEl = document.getElementById('description');
    const origDesc = descEl.value;
    descEl.value = estimateDesc;

    if (loading) loading.style.display = 'none';

    // Run the estimate
    await runEstimate();

    // Restore original description
    descEl.value = origDesc;
    incEstCount();

    // Store viz in estimate
    if (currentEstimate) currentEstimate.vizImage = vizResultImageSrc;

    // Restore confirm buttons
    actions.innerHTML = `
      <button onclick="reRenderViz()" style="background:rgba(255,255,255,0.12);color:white;border:none;border-radius:7px;padding:0.5rem 0.85rem;font-size:0.8rem;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;">🔄 Re-render</button>
      <button onclick="confirmVizAndEstimate()" style="background:var(--rust);color:white;border:none;border-radius:7px;padding:0.5rem 1.1rem;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;">✅ Re-estimate</button>`;

    setTimeout(showSavePrompt, 800);
    if (!currentUser) setTimeout(showSignupPopup, 2000);

  } catch(e) {
    if (loading) loading.style.display = 'none';
    showToast('Estimate failed — ' + (e.message || 'please try again'));
    actions.innerHTML = `<button onclick="confirmVizAndEstimate()" style="background:var(--rust);color:white;border:none;border-radius:7px;padding:0.5rem 1.1rem;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;">↩ Try Again</button>`;
  }
}
