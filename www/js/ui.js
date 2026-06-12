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
