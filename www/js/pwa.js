// PWA — extracted from index.html (Phase 3)
// Contains: service worker registration, install prompt, showInstallBanner, installPWA, dismissInstall

// ── PWA: Service Worker Registration ─────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(r => console.log('DIY Estimator SW registered'))
      .catch(e => console.log('SW registration failed:', e));
  });
}

// ── PWA: Install Prompt ───────────────────────────────────────────────────────
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  // Show install banner after 30 seconds or after first estimate
  setTimeout(showInstallBanner, 30000);
});

function showInstallBanner() {
  if (!deferredPrompt || localStorage.getItem('fixright_installed')) return;
  const banner = document.createElement('div');
  banner.id = 'installBanner';
  banner.style.cssText = `
    position:fixed;bottom:calc(1.5rem + var(--safe-bottom));left:50%;
    transform:translateX(-50%);
    background:#1c2b3a;color:white;border-radius:12px;
    padding:0.85rem 1.25rem;display:flex;align-items:center;gap:0.85rem;
    box-shadow:0 8px 32px rgba(0,0,0,0.3);z-index:9998;
    max-width:340px;width:calc(100% - 2rem);
    animation:fadeUp 0.3s ease both;
    border:1px solid rgba(200,150,42,0.3);
  `;
  banner.innerHTML = `
    <span style="font-size:1.5rem">📱</span>
    <div style="flex:1">
      <div style="font-weight:600;font-size:0.9rem">Add DIY Estimator to Home Screen</div>
      <div style="font-size:0.76rem;color:rgba(255,255,255,0.6);margin-top:2px">Works offline, feels like a native app</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:0.35rem">
      <button onclick="installPWA()" style="background:#b5451b;color:white;border:none;border-radius:7px;padding:0.4rem 0.75rem;font-size:0.8rem;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;">Install</button>
      <button onclick="dismissInstall()" style="background:none;border:none;color:rgba(255,255,255,0.45);font-size:0.75rem;cursor:pointer;font-family:'DM Sans',sans-serif;">Not now</button>
    </div>
  `;
  document.body.appendChild(banner);
}

async function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    localStorage.setItem('fixright_installed', '1');
    showToast('✓ DIY Estimator added to your home screen!');
  }
  deferredPrompt = null;
  dismissInstall();
}

function dismissInstall() {
  const b = document.getElementById('installBanner');
  if (b) b.remove();
}

window.addEventListener('appinstalled', () => {
  localStorage.setItem('fixright_installed', '1');
  deferredPrompt = null;
});
