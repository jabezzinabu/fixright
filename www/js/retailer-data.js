// Retailer and pricing data — extracted from index.html (Phase 2)
// Contains: RETAILERS, PRICE_SOURCES, CONSUMABLE_KEYWORDS

// ─── RETAILER PRICE SOURCES ───────────────────────────────────────────────────

// Retailer config per region
const RETAILERS = {
  'us-national': [
    { name: 'Home Depot', cls: 'retailer-hd', url: 'https://www.homedepot.com/s/' },
    { name: "Lowe's",    cls: 'retailer-lw', url: 'https://www.lowes.com/search?searchTerm=' },
  ],
  'us-northeast': [
    { name: 'Home Depot', cls: 'retailer-hd', url: 'https://www.homedepot.com/s/' },
    { name: "Lowe's",    cls: 'retailer-lw', url: 'https://www.lowes.com/search?searchTerm=' },
  ],
  'us-southeast': [
    { name: 'Home Depot', cls: 'retailer-hd', url: 'https://www.homedepot.com/s/' },
    { name: "Lowe's",    cls: 'retailer-lw', url: 'https://www.lowes.com/search?searchTerm=' },
  ],
  'us-midwest': [
    { name: 'Home Depot', cls: 'retailer-hd', url: 'https://www.homedepot.com/s/' },
    { name: "Lowe's",    cls: 'retailer-lw', url: 'https://www.lowes.com/search?searchTerm=' },
  ],
  'us-southwest': [
    { name: 'Home Depot', cls: 'retailer-hd', url: 'https://www.homedepot.com/s/' },
    { name: "Lowe's",    cls: 'retailer-lw', url: 'https://www.lowes.com/search?searchTerm=' },
  ],
  'us-west': [
    { name: 'Home Depot', cls: 'retailer-hd', url: 'https://www.homedepot.com/s/' },
    { name: "Lowe's",    cls: 'retailer-lw', url: 'https://www.lowes.com/search?searchTerm=' },
  ],
  'uk': [
    { name: 'Screwfix', cls: 'retailer-sf', url: 'https://www.screwfix.com/search?search=' },
    { name: 'B&Q',      cls: 'retailer-bq', url: 'https://www.diy.com/search?term=' },
  ],
  'au': [
    { name: 'Bunnings', cls: 'retailer-bn', url: 'https://www.bunnings.com.au/search/products?q=' },
  ],
  'ca': [
    { name: 'Home Depot', cls: 'retailer-hd', url: 'https://www.homedepot.ca/search#?q=' },
    { name: 'RONA',       cls: 'retailer-rn', url: 'https://www.rona.ca/en/search-results?q=' },
  ],
};

// Credibility source per region
const PRICE_SOURCES = {
  'us-national':  'Pricing based on HomeAdvisor national averages · 2025',
  'us-northeast': 'Pricing based on HomeAdvisor Northeast averages · 2025',
  'us-southeast': 'Pricing based on HomeAdvisor Southeast averages · 2025',
  'us-midwest':   'Pricing based on HomeAdvisor Midwest averages · 2025',
  'us-southwest': 'Pricing based on HomeAdvisor Southwest averages · 2025',
  'us-west':      'Pricing based on HomeAdvisor West Coast averages · 2025',
  'uk':           'Pricing based on Checkatrade & Screwfix averages · 2025',
  'au':           'Pricing based on ServiceSeeking.com.au averages · 2025',
  'ca':           'Pricing based on HomeStars Canada averages · 2025',
};

// Consumable keywords — no retailer badge for these
const CONSUMABLE_KEYWORDS = [
  'sandpaper', 'drop cloth', 'masking tape', 'cable tie', 'dust sheet',
  'mixing bucket', 'stir stick', 'painters tape'
];
