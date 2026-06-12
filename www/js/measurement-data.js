// Measurement skill data — extracted from index.html (Phase 2)
// Contains: COVERAGE_RATES, MATERIAL_KEYWORDS

// ── Coverage rates (industry standard) ───────────────────────────────────────
const COVERAGE_RATES = {
  paint: {
    label: 'Paint / Wall Coverage',
    icon: '🎨',
    metricRate: 10,       // m² per litre per coat
    imperialRate: 400,    // sq ft per gallon per coat
    metricUnit: 'litres', imperialUnit: 'gallons',
    areaUnit: 'm²',       imperialAreaUnit: 'sq ft',
    dims: ['height', 'width', 'length'],
    dimLabels: ['Wall Height', 'Room Width', 'Room Length'],
    notes: 'Standard emulsion/latex — 10m² per litre per coat',
  },
  floor_tile: {
    label: 'Floor / Wall Tiles',
    icon: '⬜',
    wastage: 0.10,
    metricUnit: 'm²', imperialUnit: 'sq ft',
    dims: ['width', 'length'],
    dimLabels: ['Room Width', 'Room Length'],
    notes: '10% wastage added for cuts and breakage',
  },
  hardwood: {
    label: 'Hardwood / Laminate Flooring',
    icon: '🪵',
    wastage: 0.10,
    metricUnit: 'm²', imperialUnit: 'sq ft',
    dims: ['width', 'length'],
    dimLabels: ['Room Width', 'Room Length'],
    notes: '10% wastage added for cuts',
  },
  carpet: {
    label: 'Carpet',
    icon: '🟫',
    wastage: 0.10,
    metricUnit: 'm²', imperialUnit: 'sq ft',
    dims: ['width', 'length'],
    dimLabels: ['Room Width', 'Room Length'],
    notes: '10% wastage added',
  },
  mulch: {
    label: 'Mulch / Bark',
    icon: '🌿',
    metricRate: 0.075,    // m³ per m² at 75mm depth
    imperialRate: 0.0031, // cubic yards per sq ft at 3" depth
    metricUnit: 'm³', imperialUnit: 'cubic yards',
    dims: ['width', 'length'],
    dimLabels: ['Area Width', 'Area Length'],
    notes: '75mm / 3 inch depth — standard mulch layer',
  },
  gravel: {
    label: 'Gravel / Decorative Stone',
    icon: '🪨',
    metricRate: 0.05,     // m³ per m² at 50mm depth
    imperialRate: 0.00206,
    metricUnit: 'm³', imperialUnit: 'cubic yards',
    dims: ['width', 'length'],
    dimLabels: ['Area Width', 'Area Length'],
    notes: '50mm / 2 inch depth — standard gravel layer',
  },
  topsoil: {
    label: 'Topsoil',
    icon: '🌱',
    metricRate: 0.075,
    imperialRate: 0.0031,
    metricUnit: 'm³', imperialUnit: 'cubic yards',
    dims: ['width', 'length'],
    dimLabels: ['Area Width', 'Area Length'],
    notes: '75mm / 3 inch depth',
  },
  decking: {
    label: 'Decking Boards',
    icon: '🪵',
    wastage: 0.10,
    metricUnit: 'm²', imperialUnit: 'sq ft',
    dims: ['width', 'length'],
    dimLabels: ['Deck Width', 'Deck Length'],
    notes: '10% wastage for cuts',
  },
  wallpaper: {
    label: 'Wallpaper',
    icon: '🖼',
    rollCoverage: 5,      // m² per standard roll
    metricUnit: 'rolls', imperialUnit: 'rolls',
    dims: ['height', 'width', 'length'],
    dimLabels: ['Wall Height', 'Room Width', 'Room Length'],
    notes: 'Standard roll covers ~5m² — add 10% for pattern matching',
  },
  concrete: {
    label: 'Concrete',
    icon: '🧱',
    metricRate: 0.1,      // m³ per m² at 100mm slab
    imperialRate: 0.0031,
    metricUnit: 'm³', imperialUnit: 'cubic yards',
    dims: ['width', 'length'],
    dimLabels: ['Area Width', 'Area Length'],
    notes: '100mm / 4 inch slab depth',
  },
};

// ── Keywords to detect material type from description ─────────────────────────
const MATERIAL_KEYWORDS = {
  paint:      ['paint', 'painting', 'repaint', 'wall paint', 'ceiling paint', 'emulsion', 'primer', 'gloss', 'colour', 'color'],
  floor_tile: ['tile', 'tiling', 'porcelain', 'ceramic', 'mosaic', 'grout', 'floor tile', 'wall tile'],
  hardwood:   ['hardwood', 'laminate', 'engineered wood', 'wood floor', 'wooden floor', 'oak floor', 'vinyl plank', 'lvt', 'lvp'],
  carpet:     ['carpet', 'carpeting', 'fitted carpet', 'carpet tile'],
  mulch:      ['mulch', 'bark', 'wood chip', 'garden mulch', 'bark mulch'],
  gravel:     ['gravel', 'decorative stone', 'pea gravel', 'crushed stone', 'slate chip', 'stone chip'],
  topsoil:    ['topsoil', 'top soil', 'compost', 'soil', 'raised bed', 'lawn soil'],
  decking:    ['decking', 'deck board', 'composite deck', 'timber deck', 'patio deck'],
  wallpaper:  ['wallpaper', 'wall paper', 'wallcovering', 'wallpapering'],
  concrete:   ['concrete', 'cement', 'slab', 'concrete floor', 'concrete pad', 'pour concrete'],
};
