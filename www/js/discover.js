// ─── DISCOVER FEED ────────────────────────────────────────────────────────────
let activeDiscoverCategory = null;

function filterDiscover(cat) {
  activeDiscoverCategory = cat;
}

const DISCOVER_CAT_PHOTOS = {
  kitchen:  'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=800&h=600&fit=crop&auto=format',
  living:   'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&h=600&fit=crop&auto=format',
  bedroom:  'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&h=600&fit=crop&auto=format',
  garden:   'https://images.unsplash.com/photo-1588854337115-1c67d9247e4f?w=800&h=600&fit=crop&auto=format',
  exterior: 'https://images.unsplash.com/photo-1568605117036-5da5db4d073d?w=800&h=600&fit=crop&auto=format',
  bathroom: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&h=600&fit=crop&auto=format',
};

function renderDiscoverCategories() {
  const grid = document.getElementById('discoverCatGrid');
  grid.innerHTML = ALL_DISCOVER_ITEMS.map((cat, i) => {
    // Use the first template image from each category as its cover
    const catPhoto = cat.items[0]?.img || DISCOVER_CAT_PHOTOS[cat.id] || DISCOVER_CAT_PHOTOS.living;
    return `
    <div class="discover-cat-card" style="animation-delay:${i*0.06}s" onclick="showRoomView('${cat.id}')">
      <img src="${catPhoto}" alt="${cat.label}" loading="lazy"
        onerror="this.src='https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=400&h=500&fit=crop'">
      <div class="discover-cat-overlay">
        <div class="discover-cat-label">${cat.label}</div>
        <div class="discover-cat-count">${cat.items.length} designs</div>
      </div>
    </div>`;
  }).join('');
}

function showRoomView(catId) {
  const cat = ALL_DISCOVER_ITEMS.find(c => c.id === catId);
  if (!cat) return;
  document.getElementById('discoverCategoryView').style.display = 'none';
  document.getElementById('discoverRoomView').style.display = 'block';
  document.getElementById('discoverRoomTitle').textContent = cat.label;
  const grid = document.getElementById('discoverRoomGrid');
  grid.innerHTML = cat.items.map((item, idx) => `
    <div class="discover-card" onclick="openDetailSheet('${cat.id}', ${idx})">
      <div class="discover-card-img" style="padding:0;height:180px;position:relative;overflow:hidden;background:#f3f4f6;">
        <img src="${item.img}" alt="${item.title}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;position:absolute;top:0;left:0;border-radius:10px 10px 0 0;"
          onerror="this.src='https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=400&h=300&fit=crop'">
        <div style="position:absolute;bottom:8px;right:8px;background:rgba(28,43,58,0.75);color:white;border-radius:99px;padding:3px 10px;font-size:0.7rem;font-weight:600;">Tap →</div>
      </div>
      <div class="discover-card-body">
        <div class="discover-card-title">${item.title}</div>
        <div class="discover-card-meta">${item.style}</div>
        <div class="discover-card-price">${item.price}</div>
      </div>
    </div>`).join('');
}

function showCategoryView() {
  document.getElementById('discoverRoomView').style.display = 'none';
  document.getElementById('discoverCategoryView').style.display = 'block';
}

let _activeSheetItem = null;
let _carouselIdx = 0;
let _carouselItems = [];

function openDetailSheet(catId, itemIdx) {
  const cat = ALL_DISCOVER_ITEMS.find(c => c.id === catId);
  if (!cat) return;

  // Get all items in this category as the carousel
  _carouselItems = cat.items;
  _carouselIdx = itemIdx;
  _activeSheetItem = cat.items[itemIdx];

  // Populate header
  document.getElementById('sheetTitle').textContent = _activeSheetItem.title;
  document.getElementById('sheetMeta').textContent = _activeSheetItem.style + ' · ' + cat.label;
  document.getElementById('sheetPrice').textContent = _activeSheetItem.price;
  document.getElementById('sheetDesc').textContent = _activeSheetItem.desc;
  document.getElementById('sheetStyleBadge').textContent = '🎨 ' + _activeSheetItem.style;

  // Build carousel with ALL items in this category
  const track = document.getElementById('carouselTrack');
  track.innerHTML = _carouselItems.map(item => `
    <div class="carousel-slide" style="min-width:100%;flex-shrink:0;">
      <img src="${item.img}" alt="${item.title}" loading="lazy" style="width:100%;height:260px;object-fit:cover;display:block;"
        onerror="this.src='https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&h=500&fit=crop'">
    </div>`).join('');

  // Build dots
  const dots = document.getElementById('carouselDots');
  dots.innerHTML = _carouselItems.map((_, i) =>
    `<div onclick="goCarousel(${i})" style="width:6px;height:6px;border-radius:50%;background:${i===itemIdx?'white':'rgba(255,255,255,0.5)'};cursor:pointer;"></div>`
  ).join('');

  // Set initial position
  track.style.transform = `translateX(-${itemIdx * 100}%)`;

  // Show/hide arrows
  document.getElementById('carouselPrev').style.display = _carouselItems.length > 1 ? 'flex' : 'none';
  document.getElementById('carouselNext').style.display = _carouselItems.length > 1 ? 'flex' : 'none';

  // Open sheet
  const overlay = document.getElementById('sheetOverlay');
  const sheet = document.getElementById('detailSheet');
  overlay.style.display = 'block';
  sheet.style.display = 'block';
  requestAnimationFrame(() => { sheet.style.transform = 'translateY(0)'; });
  document.body.style.overflow = 'hidden';
}

function closeDetailSheet() {
  const sheet = document.getElementById('detailSheet');
  const overlay = document.getElementById('sheetOverlay');
  sheet.style.transform = 'translateY(100%)';
  setTimeout(() => { sheet.style.display = 'none'; overlay.style.display = 'none'; }, 300);
  document.body.style.overflow = '';
}

function slideCarousel(dir) {
  _carouselIdx = Math.max(0, Math.min(_carouselItems.length - 1, _carouselIdx + dir));
  goCarousel(_carouselIdx);
  // Update active item
  _activeSheetItem = _carouselItems[_carouselIdx];
  document.getElementById('sheetTitle').textContent = _activeSheetItem.title;
  document.getElementById('sheetPrice').textContent = _activeSheetItem.price;
  document.getElementById('sheetDesc').textContent = _activeSheetItem.desc;
  document.getElementById('sheetStyleBadge').textContent = '🎨 ' + _activeSheetItem.style;
}

function goCarousel(idx) {
  _carouselIdx = idx;
  document.getElementById('carouselTrack').style.transform = `translateX(-${idx * 100}%)`;
  document.getElementById('carouselDots').querySelectorAll('div').forEach((d, i) => { d.style.background = i === idx ? 'white' : 'rgba(255,255,255,0.5)'; });
}

function sheetVisualizeOnMySpace() {
  if (!_activeSheetItem) return;

  // Capture src BEFORE closing sheet (DOM still visible)
  const slides = document.querySelectorAll('#carouselTrack .carousel-slide img');
  const conceptSrc = (slides[_carouselIdx] && slides[_carouselIdx].src && slides[_carouselIdx].src.length > 10)
    ? slides[_carouselIdx].src
    : (_activeSheetItem.img || '');

  // Capture item reference before any async
  const item = Object.assign({}, _activeSheetItem);

  closeDetailSheet();

  setTimeout(() => {
    switchTab('visualize');
    setTimeout(() => {
      loadConceptFromDiscover(item, conceptSrc);
      showToast('✨ Concept loaded — now upload your space!');
    }, 300);
  }, 200);
}

function loadConceptFromDiscover(item, imgSrc) {
  vizConceptItem = item;
  vizConceptImgSrc = imgSrc;

  // Convert concept image to base64 for AI use
  if (imgSrc) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.min(img.width || 800, 800);
      c.height = Math.min(img.height || 600, 600);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      vizConceptBase64 = c.toDataURL('image/jpeg', 0.85).split(',')[1];
    };
    img.onerror = () => { vizConceptBase64 = null; };
    img.src = imgSrc;
  }

  // Show concept panel in step 1
  document.getElementById('conceptPanel').style.display = 'block';
  document.getElementById('conceptImg').src = imgSrc || '';
  document.getElementById('conceptTitle').textContent = item.title;
  document.getElementById('conceptStyle').textContent = item.style;

  // Hide discover prompt since concept is loaded
  document.getElementById('discoverPrompt').style.display = 'none';

  // Pre-fill style
  vizSelectedStyle = item.style;

  // Update step 2 desc to optional
  document.getElementById('vizDesc').value = '';
  if (document.getElementById('vizDescHint')) document.getElementById('vizDescHint').style.display = 'block';
  if (document.getElementById('vizDescLabel')) document.getElementById('vizDescLabel').innerHTML = 'Add notes <span style="color:var(--muted);font-weight:400">(optional — concept guides the AI)</span>';

  // Only clear photo if none uploaded yet — preserve existing upload
  if (!vizPhotoBase64) {
    document.getElementById('vizPhotoPreview').style.display = 'none';
    document.getElementById('vizPhotoPlaceholder').style.display = 'block';
    document.getElementById('vizPhotoClear').style.display = 'none';
    document.getElementById('vizPhotoInput').value = '';
    document.getElementById('vizPhotoInput').style.zIndex = '2';
    document.getElementById('step1Next').disabled = true;
  } else {
    // Photo already uploaded — keep it and enable Next
    document.getElementById('step1Next').disabled = false;
  }

  goVizStep(1);
}

function clearConcept() {
  vizConceptItem = null; vizConceptBase64 = null; vizConceptImgSrc = null;
  document.getElementById('conceptPanel').style.display = 'none';
  document.getElementById('discoverPrompt').style.display = 'flex';
  if (document.getElementById('vizDescHint')) document.getElementById('vizDescHint').style.display = 'none';
  if (document.getElementById('vizDescLabel')) document.getElementById('vizDescLabel').innerHTML = 'Describe the changes <span>(specific beats vague)</span>';
  document.getElementById('vizDesc').value = '';
}


function sheetJustEstimate() {
  if (!_activeSheetItem) return;
  closeDetailSheet();
  setTimeout(() => {
    switchTab('estimate');
    setTimeout(() => {
      document.getElementById('description').value = _activeSheetItem.desc + '. Provide a detailed cost estimate with full materials list.';
      document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('🔧 Description loaded — hit Get My Estimate!');
    }, 300);
  }, 200);
}

function discoverTryIt(style, desc) {
  // Legacy fallback — opens visualize with style pre-loaded
  switchTab('visualize');
  setTimeout(() => {
    clearConcept();
    vizPhotoBase64 = null; vizPhotoDataUrl = null; vizPhotoBlob = null;
    document.getElementById('vizPhotoPreview').style.display = 'none';
    document.getElementById('vizPhotoPlaceholder').style.display = 'block';
    document.getElementById('vizPhotoClear').style.display = 'none';
    document.getElementById('vizPhotoInput').style.zIndex = '2';
    document.getElementById('step1Next').disabled = true;
    if (style) { vizSelectedStyle = style; selectStyle(style); }
    document.getElementById('vizDesc').value = desc;
    goVizStep(1);
    showToast('✨ Style loaded — upload your space to continue!');
  }, 300);
}
