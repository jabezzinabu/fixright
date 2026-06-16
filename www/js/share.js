let _currentShareUrl = '';

async function shareEstimate() {
  if (!currentEstimate) return;
  if (currentUser && dbReady && !currentEstimate._saved) {
    await saveEstimate();
    if (!currentEstimate._saved) { showToast('Please save your estimate before sharing'); return; }
  }
  const payload = { ...currentEstimate };
  delete payload.user_id;
  if (vizResultImageSrc) payload.vizImage = vizResultImageSrc;
  const beforeSrc = vizPhotoDataUrl || (imageBase64 ? 'data:image/jpeg;base64,' + imageBase64 : null);
  if (beforeSrc) payload.beforeImage = beforeSrc;

  document.getElementById('shareCardTitle').textContent = currentEstimate.title;
  document.getElementById('shareCardPrice').textContent = currentEstimate.priceRange;
  document.getElementById('shareCardMeta').textContent =
    `${currentEstimate.difficulty} · ${currentEstimate.timeline}`;
  document.getElementById('shareUrl').value = 'Generating link...';
  document.getElementById('shareModal').classList.add('open');

  const shareId = Math.random().toString(36).slice(2, 10);
  if (dbReady) {
    try {
      const { error } = await db.from('shared_estimates').insert({ id: shareId, data: payload });
      if (error) throw error;
      const url = location.origin + location.pathname + '?s=' + shareId;
      document.getElementById('shareUrl').value = url;
      _currentShareUrl = url;
    } catch(e) {
      console.error('Share save failed:', e);
      const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
      const url = location.origin + location.pathname + '#' + encoded;
      document.getElementById('shareUrl').value = url;
      _currentShareUrl = url;
    }
  } else {
    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
    const url = location.origin + location.pathname + '#' + encoded;
    document.getElementById('shareUrl').value = url;
    _currentShareUrl = url;
  }
}

function closeModal() { document.getElementById('shareModal').classList.remove('open'); }
document.getElementById('shareModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

function copyLink() {
  const url = document.getElementById('shareUrl').value;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('copyLinkBtn');
    btn.textContent = 'Copied!'; btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  });
}

function shareWhatsApp() {
  const url = _currentShareUrl || document.getElementById('shareUrl').value;
  if (!url || url === 'Generating link...') { showToast('Link still generating, try again'); return; }
  window.open(`https://wa.me/?text=${encodeURIComponent(`DIY Estimator: ${currentEstimate?.title} — ${currentEstimate?.priceRange}\n${url}`)}`);
}

function shareSMS() {
  const url = _currentShareUrl || document.getElementById('shareUrl').value;
  if (!url || url === 'Generating link...') { showToast('Link still generating, try again'); return; }
  window.location.href = `sms:?&body=${encodeURIComponent(`DIY Estimator: ${currentEstimate?.title} — ${currentEstimate?.priceRange}\n${url}`)}`;
}

function shareNative() {
  const url = _currentShareUrl || document.getElementById('shareUrl').value;
  if (!url || url === 'Generating link...') { showToast('Link still generating, try again'); return; }
  if (navigator.share) {
    navigator.share({
      title: `DIY Estimator: ${currentEstimate?.title}`,
      text: `Estimated ${currentEstimate?.priceRange}`,
      url: url
    }).catch(() => {});
  } else { copyLink(); }
}
