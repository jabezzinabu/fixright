// PROPOSED STATE — not yet wired in. See docs/migration-audit.md Phase 3+
// This file defines the centralised state object that will replace ~25 globals
// currently scattered across index.html. Do not reference this file from the
// app until the wiring phase (Phase 3+) explicitly connects each module.

window.appState = {

  // ── Database ────────────────────────────────────────────────────────────────
  db: null,           // Supabase client instance (set by initSupabase)
  dbReady: false,     // True once Supabase client is initialised

  // ── Auth ────────────────────────────────────────────────────────────────────
  currentUser: null,  // Supabase user object, or null if logged out
  authMode: 'signin', // 'signin' | 'signup' — controls auth modal tab

  // ── Estimate ─────────────────────────────────────────────────────────────────
  imageBase64: null,       // Base64 string of uploaded estimate photo (no prefix)
  imageMediaType: null,    // MIME type of estimate photo, e.g. 'image/jpeg'
  currentEstimate: null,   // Parsed estimate object from last Claude response
  savedEstimates: [],      // Array of estimates loaded from Supabase

  // ── Visualization ────────────────────────────────────────────────────────────
  vizPhotoBase64: null,    // Base64 of user-uploaded viz photo
  vizPhotoDataUrl: null,   // Data URL version (used for display)
  vizPhotoBlob: null,      // Blob version (used for upload)
  vizResultImageSrc: null, // URL/data-url of generated after image
  vizConceptItem: null,    // Selected concept item from Discover
  vizConceptBase64: null,  // Base64 of concept reference image
  vizConceptImgSrc: null,  // Display src of concept image
  vizCurrentStep: 1,       // Current step in guided viz flow (1–3)
  vizSelectedStyle: '',    // Selected style name, e.g. 'Modern'
  vizModeEnabled: false,   // Whether viz toggle is on for estimate tab

  // ── Discover ─────────────────────────────────────────────────────────────────
  activeDiscoverCategory: null, // Currently selected category ID string
  _activeSheetItem: null,       // Item object shown in detail sheet
  _carouselIdx: 0,              // Current carousel slide index
  _carouselItems: [],           // Array of image srcs for current carousel

  // ── Admin ────────────────────────────────────────────────────────────────────
  _adminEstimates: [],          // Loaded estimates for admin table
  _adminEstPage: 0,             // Current page index for admin estimates
  _allUsers: [],                // Loaded users for admin table
  _analyticsPeriod: 'today',    // Selected analytics period
  _analyticsData: [],           // Analytics data for current period

  // ── UI ────────────────────────────────────────────────────────────────────────
  drawerOpen: false,            // Whether saved-estimates drawer is open
  toastTimer: null,             // setTimeout handle for toast auto-dismiss
  _currentShareUrl: '',         // URL currently shown in share modal
  _signupPopupShown: false,     // Whether post-estimate signup popup has appeared
  deferredPrompt: null,         // PWA install prompt event (BeforeInstallPromptEvent)

  // ── Measurement skill ────────────────────────────────────────────────────────
  _detectedMaterial: null,      // Material type detected from description
  _dimSkipped: false,           // Whether user skipped dimension input
  _calculatedQuantities: null,  // Quantity result from dimension calculation
  _descInputTimer: null,        // Debounce timer for description keystrokes

};
