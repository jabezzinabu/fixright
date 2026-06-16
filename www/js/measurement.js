// ═══════════════════════════════════════════════════════════════════════════════
// MEASUREMENT SKILL
// Pre-processes descriptions to detect material needs, collect dimensions,
// calculate accurate quantities, and inject them into estimate prompts.
// ═══════════════════════════════════════════════════════════════════════════════


let _detectedMaterial = null;
let _dimSkipped = false;
let _calculatedQuantities = null;
let _descInputTimer = null;

// ── Detect material from description ─────────────────────────────────────────
function detectMaterial(desc) {
  if (!desc || desc.length < 5) return null;
  const lower = desc.toLowerCase();
  for (const [material, keywords] of Object.entries(MATERIAL_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return material;
  }
  return null;
}

// ── Called on every description keystroke (debounced) ────────────────────────
function onDescriptionInput(val) {
  clearTimeout(_descInputTimer);
  _descInputTimer = setTimeout(() => {
    const material = detectMaterial(val);
    if (material && !_dimSkipped) {
      showDimPanel(material);
    } else if (!material) {
      hideDimPanel();
    }
  }, 600);
}

// ── Show dimension panel for detected material ────────────────────────────────
function showDimPanel(material) {
  const rate = COVERAGE_RATES[material];
  if (!rate) return;
  _detectedMaterial = material;
  _calculatedQuantities = null;

  const isMetric = isMetricRegion();
  const panel = document.getElementById('dimPanel');
  const title = document.getElementById('dimPanelTitle');
  const fields = document.getElementById('dimFields');
  const warning = document.getElementById('dimWarning');

  title.textContent = rate.icon + ' ' + rate.label + ' — add dimensions for accurate quantities';

  // Build input fields
  const unitLabel = isMetric ? 'm' : 'ft';
  const hasTwoDims = rate.dims.length === 2;
  fields.className = 'dim-fields' + (hasTwoDims ? ' two-col' : '');
  fields.innerHTML = `<div class="dim-panel-optional">Optional: Add dimensions for a more accurate estimate <button class="dim-panel-skip" onclick="hideDimPanel(); _dimSkipped = true;">Skip →</button></div>` +
    rate.dims.map((dim, i) => `
    <div class="dim-field">
      <label>${rate.dimLabels[i]}</label>
      <input type="number" id="dim_${dim}" min="0" step="0.1" placeholder="0"
        oninput="onDimInput()" onchange="onDimInput()">
      <div class="dim-unit">${unitLabel}</div>
    </div>`).join('');

  warning.className = 'dim-warning visible';
  panel.className = 'dim-panel visible';
  document.getElementById('dimResult').className = 'dim-result';
}

// ── Hide dimension panel ──────────────────────────────────────────────────────
function hideDimPanel() {
  _detectedMaterial = null;
  _calculatedQuantities = null;
  document.getElementById('dimPanel').className = 'dim-panel';
  document.getElementById('dimResult').className = 'dim-result';
}

// ── Skip dimensions ───────────────────────────────────────────────────────────
function skipDimensions() {
  _dimSkipped = true;
  _calculatedQuantities = null;
  document.getElementById('dimPanel').className = 'dim-panel';
  // Reset skip flag after 10s so it shows again if desc changes
  setTimeout(() => { _dimSkipped = false; }, 10000);
}

// ── Called when any dimension input changes ───────────────────────────────────
function onDimInput() {
  if (!_detectedMaterial) return;
  const rate = COVERAGE_RATES[_detectedMaterial];
  const isMetric = isMetricRegion();

  const vals = {};
  rate.dims.forEach(dim => {
    const el = document.getElementById('dim_' + dim);
    vals[dim] = el ? parseFloat(el.value) || 0 : 0;
  });

  // Need at least one non-zero value
  if (Object.values(vals).every(v => v === 0)) {
    document.getElementById('dimResult').className = 'dim-result';
    document.getElementById('dimWarning').className = 'dim-warning visible';
    return;
  }

  const result = calculateQuantities(_detectedMaterial, vals, isMetric);
  if (!result) return;

  _calculatedQuantities = result;
  document.getElementById('dimWarning').className = 'dim-warning';

  const resultEl = document.getElementById('dimResult');
  resultEl.innerHTML = result.summary;
  resultEl.className = 'dim-result visible';
}

// ── Calculate quantities based on material + dimensions ───────────────────────
function calculateQuantities(material, dims, isMetric) {
  const rate = COVERAGE_RATES[material];
  if (!rate) return null;

  const h = dims.height || 0;
  const w = dims.width || 0;
  const l = dims.length || 0;
  const unitLabel = isMetric ? 'm' : 'ft';
  const areaUnitLabel = isMetric ? 'm²' : 'sq ft';

  let area = 0;
  let primaryQty = 0;
  let primaryUnit = '';
  let summaryLines = [];
  let promptText = '';

  switch(material) {
    case 'paint': {
      // Wall area = 2*(w*h) + 2*(l*h) for a room, minus floor/ceiling
      // If only some dims provided, calculate what we can
      let wallArea = 0;
      if (w > 0 && h > 0) wallArea += 2 * w * h;
      if (l > 0 && h > 0) wallArea += 2 * l * h;
      if (wallArea === 0 && w > 0 && l > 0) wallArea = w * l; // flat surface
      area = wallArea;

      if (isMetric) {
        const litres1Coat = Math.ceil(area / rate.metricRate * 10) / 10;
        const litres2Coat = Math.ceil(litres1Coat * 2 * 10) / 10;
        primaryQty = litres1Coat;
        primaryUnit = 'litres';
        summaryLines = [
          `Total wall area: <strong>${area.toFixed(1)} m²</strong>`,
          `1 coat: <strong>${litres1Coat} litres</strong> &nbsp;|&nbsp; 2 coats: <strong>${litres2Coat} litres</strong>`,
          `Based on ${rate.metricRate}m² per litre coverage`,
        ];
        promptText = `ACCURATE PAINT CALCULATION (do not recalculate): Total wall area = ${area.toFixed(1)}m². At ${rate.metricRate}m² per litre: 1 coat = ${litres1Coat} litres, 2 coats = ${litres2Coat} litres. Use these exact figures.`;
      } else {
        const gallons1Coat = Math.ceil(area / rate.imperialRate * 10) / 10;
        const gallons2Coat = Math.ceil(gallons1Coat * 2 * 10) / 10;
        primaryQty = gallons1Coat;
        primaryUnit = 'gallons';
        summaryLines = [
          `Total wall area: <strong>${area.toFixed(0)} sq ft</strong>`,
          `1 coat: <strong>${gallons1Coat} gallons</strong> &nbsp;|&nbsp; 2 coats: <strong>${gallons2Coat} gallons</strong>`,
          `Based on ${rate.imperialRate} sq ft per gallon coverage`,
        ];
        promptText = `ACCURATE PAINT CALCULATION (do not recalculate): Total wall area = ${area.toFixed(0)} sq ft. At ${rate.imperialRate} sq ft per gallon: 1 coat = ${gallons1Coat} gallons, 2 coats = ${gallons2Coat} gallons. Use these exact figures.`;
      }
      break;
    }

    case 'wallpaper': {
      let wallArea = 0;
      if (w > 0 && h > 0) wallArea += 2 * w * h;
      if (l > 0 && h > 0) wallArea += 2 * l * h;
      area = wallArea;
      const rolls = Math.ceil(area / rate.rollCoverage * 1.1); // +10% pattern
      summaryLines = [
        `Total wall area: <strong>${area.toFixed(1)} ${areaUnitLabel}</strong>`,
        `Rolls needed: <strong>${rolls} rolls</strong> (inc. 10% pattern matching)`,
        `Based on ${rate.rollCoverage}m² per standard roll`,
      ];
      promptText = `ACCURATE WALLPAPER CALCULATION: Total wall area = ${area.toFixed(1)}m². Rolls needed = ${rolls} (including 10% for pattern matching). Use these exact figures.`;
      break;
    }

    case 'floor_tile':
    case 'hardwood':
    case 'carpet':
    case 'decking': {
      area = w * l;
      const withWastage = area * (1 + rate.wastage);
      if (isMetric) {
        summaryLines = [
          `Floor area: <strong>${area.toFixed(2)} m²</strong>`,
          `With ${rate.wastage*100}% wastage: <strong>${withWastage.toFixed(2)} m²</strong>`,
        ];
        promptText = `ACCURATE AREA CALCULATION: Floor/surface area = ${area.toFixed(2)}m². With ${rate.wastage*100}% wastage = ${withWastage.toFixed(2)}m². Use these exact figures for material quantities.`;
      } else {
        summaryLines = [
          `Floor area: <strong>${area.toFixed(0)} sq ft</strong>`,
          `With ${rate.wastage*100}% wastage: <strong>${withWastage.toFixed(0)} sq ft</strong>`,
        ];
        promptText = `ACCURATE AREA CALCULATION: Floor/surface area = ${area.toFixed(0)} sq ft. With ${rate.wastage*100}% wastage = ${withWastage.toFixed(0)} sq ft. Use these exact figures.`;
      }
      break;
    }

    case 'mulch':
    case 'gravel':
    case 'topsoil': {
      area = w * l;
      if (isMetric) {
        const volume = area * rate.metricRate;
        const tonnes = material === 'gravel' ? (volume * 1.5).toFixed(2) : null;
        summaryLines = [
          `Area: <strong>${area.toFixed(2)} m²</strong>`,
          `Volume needed: <strong>${volume.toFixed(2)} m³</strong>`,
          tonnes ? `Weight: approx <strong>${tonnes} tonnes</strong>` : '',
        ].filter(Boolean);
        promptText = `ACCURATE QUANTITY CALCULATION: Area = ${area.toFixed(2)}m². Volume of ${material} needed = ${volume.toFixed(2)}m³${tonnes ? ` (approx ${tonnes} tonnes)` : ''}. Use these exact figures.`;
      } else {
        const cubicYards = area * rate.imperialRate;
        summaryLines = [
          `Area: <strong>${area.toFixed(0)} sq ft</strong>`,
          `Volume needed: <strong>${cubicYards.toFixed(2)} cubic yards</strong>`,
        ];
        promptText = `ACCURATE QUANTITY CALCULATION: Area = ${area.toFixed(0)} sq ft. Volume of ${material} needed = ${cubicYards.toFixed(2)} cubic yards. Use these exact figures.`;
      }
      break;
    }

    case 'concrete': {
      area = w * l;
      if (isMetric) {
        const volume = area * rate.metricRate;
        summaryLines = [
          `Slab area: <strong>${area.toFixed(2)} m²</strong>`,
          `Concrete volume (100mm): <strong>${volume.toFixed(2)} m³</strong>`,
        ];
        promptText = `ACCURATE CONCRETE CALCULATION: Slab area = ${area.toFixed(2)}m². At 100mm depth, concrete volume = ${volume.toFixed(2)}m³. Use these exact figures.`;
      } else {
        const cubicYards = area * rate.imperialRate;
        summaryLines = [
          `Slab area: <strong>${area.toFixed(0)} sq ft</strong>`,
          `Concrete (4" slab): <strong>${cubicYards.toFixed(2)} cubic yards</strong>`,
        ];
        promptText = `ACCURATE CONCRETE CALCULATION: Slab area = ${area.toFixed(0)} sq ft. At 4" depth, concrete volume = ${cubicYards.toFixed(2)} cubic yards. Use these exact figures.`;
      }
      break;
    }
  }

  if (summaryLines.length === 0) return null;

  return {
    material,
    area,
    promptText,
    summary: summaryLines.map(l => `<div>${l}</div>`).join('') +
      `<div style="color:var(--muted);font-size:0.74rem;margin-top:0.35rem;">${rate.notes}</div>`,
  };
}

// ── Check if region is metric ─────────────────────────────────────────────────
function isMetricRegion() {
  const region = document.getElementById('region')?.value || 'us-national';
  return ['uk', 'au', 'eu'].some(r => region.includes(r));
}

// ── Inject quantity context into estimate prompt ──────────────────────────────
function getMeasurementContext() {
  if (!_calculatedQuantities) return '';
  return '\n\n' + _calculatedQuantities.promptText;
}
