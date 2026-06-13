if (!isAdmin()) return;
window._adminLoaded = true;

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
async function loadAdminData() {
  if (!isAdmin() || !dbReady) return;
  loadAdminStats();
  loadAdminEstimates();
  loadAdminUsers();
  loadAnalytics();
  runHealthChecks();
  const el = document.getElementById('adminLastRefresh');
  if (el) el.textContent = 'Last refreshed: ' + new Date().toLocaleTimeString();
  // Restore feature flag states
  if (localStorage.getItem('flag_discoverPublic') === '1') {
    const cb = document.getElementById('flagDiscoverPublic');
    if (cb) cb.checked = true;
  }
}

async function loadAdminStats() {
  try {
    // Total estimates
    const { count: totalEst } = await db.from('estimates').select('*', { count: 'exact', head: true });
    document.getElementById('statEstimates').textContent = totalEst ?? '—';

    // This week
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: weekEst } = await db.from('estimates')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo);
    document.getElementById('statWeek').textContent = weekEst ?? '—';

    // Pro users
    const { count: proCount } = await db.from('profiles')
      .select('*', { count: 'exact', head: true })
      .in('role', ['pro', 'admin']);
    document.getElementById('statPro').textContent = proCount ?? '—';

    // Total profiles (proxy for users)
    const { count: userCount } = await db.from('profiles')
      .select('*', { count: 'exact', head: true });
    document.getElementById('statUsers').textContent = userCount ?? '—';
  } catch(e) {
    console.log('Stats load error:', e.message);
  }
}

let _adminEstimates = [];
let _adminEstPage = 0;
const ADMIN_EST_PAGE_SIZE = 5;

async function loadAdminEstimates() {
  const loading = document.getElementById('estimatesLoading');
  const table = document.getElementById('estimatesTable');
  const empty = document.getElementById('estimatesEmpty');
  try {
    const { data, error } = await db.from('estimates')
      .select('id, title, price_range, region, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    // Fetch profiles for all unique user_ids to get emails
    const userIds = [...new Set((data || []).map(e => e.user_id).filter(Boolean))];
    let profileMap = {};
    if (userIds.length) {
      const { data: profiles } = await db.from('profiles')
        .select('id, email, role')
        .in('id', userIds);
      (profiles || []).forEach(p => { profileMap[p.id] = p; });
    }

    loading.style.display = 'none';
    if (!data?.length) { empty.style.display = 'block'; return; }
    // Attach profile data to each estimate
    _adminEstimates = data.map(e => ({ ...e, _profile: profileMap[e.user_id] || null }));
    _adminEstPage = 0;
    renderAdminEstimatesPage();
    table.style.display = 'table';
  } catch(e) {
    loading.textContent = 'Error loading estimates: ' + e.message;
  }
}

function renderAdminEstimatesPage() {
  const total = _adminEstimates.length;
  const totalPages = Math.ceil(total / ADMIN_EST_PAGE_SIZE);
  const start = _adminEstPage * ADMIN_EST_PAGE_SIZE;
  const page = _adminEstimates.slice(start, start + ADMIN_EST_PAGE_SIZE);
  const tbody = document.getElementById('estimatesBody');
  tbody.innerHTML = page.map(e => {
    const profile = e._profile;
    const email = profile?.email;
    const role = profile?.role;
    // Display: email if available, else region, else truncated user_id
    let userDisplay = '';
    if (email) {
      userDisplay = `<div style="font-size:0.78rem;color:#111;">${email}</div>` +
        (role && role !== 'free' ? `<div style="font-size:0.68rem;color:#E8481C;font-weight:600;text-transform:uppercase;">${role}</div>` : '');
    } else if (e.user_id) {
      userDisplay = `<div style="font-family:monospace;font-size:0.72rem;color:var(--muted);">${e.user_id.slice(0,14)}…</div><div style="font-size:0.68rem;color:var(--muted);">no profile</div>`;
    } else {
      userDisplay = '<div style="font-size:0.72rem;color:var(--muted);">Anonymous</div>';
    }
    return `<tr>
      <td style="font-weight:500;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.title || 'Untitled'}</td>
      <td style="color:var(--rust);font-weight:600">${e.price_range || '—'}</td>
      <td style="font-size:0.8rem;">${formatRegion(e.region)}</td>
      <td>${userDisplay}</td>
      <td style="color:var(--muted);font-size:0.8rem;">${new Date(e.created_at).toLocaleDateString()}</td>
      <td><button onclick="setDemoEstimate('${e.id}')" style="font-size:0.72rem;background:#f3f4f6;border:1px solid var(--border);border-radius:6px;padding:2px 8px;cursor:pointer;">Set Demo</button></td>
    </tr>`;
  }).join('');
  // Pagination controls
  let pag = document.getElementById('estPagination');
  if (!pag) {
    pag = document.createElement('div');
    pag.id = 'estPagination';
    pag.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.5rem 0;font-size:0.82rem;color:var(--muted);';
    document.getElementById('estimatesTable').after(pag);
  }
  pag.innerHTML = `
    <span>${start + 1}–${Math.min(start + ADMIN_EST_PAGE_SIZE, total)} of ${total}</span>
    <div style="display:flex;gap:0.4rem;">
      <button onclick="adminEstPrev()" ${_adminEstPage === 0 ? 'disabled' : ''} style="padding:0.3rem 0.7rem;border:1px solid var(--border);border-radius:6px;background:${_adminEstPage===0?'#f3f4f6':'white'};cursor:${_adminEstPage===0?'default':'pointer'};font-size:0.8rem;">← Prev</button>
      <span style="padding:0.3rem 0.5rem;font-weight:600;color:#111;">Page ${_adminEstPage + 1} / ${totalPages}</span>
      <button onclick="adminEstNext()" ${_adminEstPage >= totalPages - 1 ? 'disabled' : ''} style="padding:0.3rem 0.7rem;border:1px solid var(--border);border-radius:6px;background:${_adminEstPage>=totalPages-1?'#f3f4f6':'white'};cursor:${_adminEstPage>=totalPages-1?'default':'pointer'};font-size:0.8rem;">Next →</button>
    </div>`;
}

async function setDemoEstimate(id) {
  if (!dbReady) return;
  try {
    // Save the ID to app_config
    await db.from('app_config').upsert({ key: 'demo_estimate_id', value: id }, { onConflict: 'key' });

    // Also fetch the full estimate and write it to shared_estimates as '__demo__'
    // so it can be read by anonymous users (shared_estimates is publicly readable)
    const { data: est, error: estErr } = await db.from('estimates').select('*').eq('id', id).single();
    if (estErr || !est) throw estErr || new Error('Estimate not found');

    const demoPayload = {
      title: est.title,
      priceRange: est.price_range,
      difficulty: est.difficulty,
      timeline: est.timeline,
      materials: est.materials || [],
      steps: est.steps || [],
      warnings: est.warnings || [],
      tip: est.tip || '',
      desc: est.description || '',
      vizImage: est.viz_image || null,
      beforeImage: est.before_image || null,
      isDemo: true,
    };

    await db.from('shared_estimates').upsert({ id: '__demo__', data: demoPayload }, { onConflict: 'id' });
    showToast('✅ Demo estimate set!');
  } catch(e) { showToast('Error: ' + e.message); }
}

function adminEstPrev() { if (_adminEstPage > 0) { _adminEstPage--; renderAdminEstimatesPage(); } }
function adminEstNext() { if ((_adminEstPage + 1) * ADMIN_EST_PAGE_SIZE < _adminEstimates.length) { _adminEstPage++; renderAdminEstimatesPage(); } }

let _allUsers = [];

async function loadAdminUsers() {
  const loading = document.getElementById('usersLoading');
  const table = document.getElementById('usersTable');
  const empty = document.getElementById('usersEmpty');
  try {
    const { data, error } = await db.from('profiles')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    loading.style.display = 'none';
    if (error) throw error;
    _allUsers = data || [];
    if (!_allUsers.length) { empty.style.display = 'block'; return; }
    renderUsersTable(_allUsers);
    table.style.display = 'table';
  } catch(e) {
    loading.textContent = 'Error loading users: ' + e.message;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersBody');
  tbody.innerHTML = users.map(u => `
    <tr>
      <td style="font-weight:500;max-width:180px;overflow:hidden;text-overflow:ellipsis;">${u.email || '—'}</td>
      <td><span class="user-role-pill role-${u.role||'free'}">${u.role||'free'}</span></td>
      <td style="color:var(--muted);font-size:0.82rem;">${new Date(u.created_at).toLocaleDateString()}</td>
      <td style="color:var(--muted);font-size:0.82rem;" id="estCount_${u.id}">—</td>
      <td>
        <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
          ${u.role !== 'pro' && u.role !== 'admin' ? `<button class="btn-admin-action" onclick="setUserRole('${u.id}','pro')">→ Pro</button>` : ''}
          ${u.role === 'pro' ? `<button class="btn-admin-action danger" onclick="setUserRole('${u.id}','free')">→ Free</button>` : ''}
          ${u.role !== 'admin' && u.email !== SUPER_ADMIN_EMAIL ? `<button class="btn-admin-action" onclick="setUserRole('${u.id}','admin')">→ Admin</button>` : ''}
          ${u.email === SUPER_ADMIN_EMAIL ? '<span style="font-size:0.72rem;color:var(--gold);font-weight:600;">👑 Super</span>' : ''}
          ${u.role !== SUPER_ADMIN_EMAIL && u.email !== SUPER_ADMIN_EMAIL ? `<button class="btn-admin-action danger" onclick="confirmDeleteUser('${u.id}','${u.email}')">🗑</button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

function filterUsers() {
  const search = document.getElementById('userSearch').value.toLowerCase();
  const role = document.getElementById('userRoleFilter').value;
  const filtered = _allUsers.filter(u => {
    const matchEmail = !search || (u.email || '').toLowerCase().includes(search);
    const matchRole = !role || u.role === role;
    return matchEmail && matchRole;
  });
  renderUsersTable(filtered);
  const empty = document.getElementById('usersEmpty');
  const table = document.getElementById('usersTable');
  if (filtered.length === 0) { empty.style.display = 'block'; table.style.display = 'none'; }
  else { empty.style.display = 'none'; table.style.display = 'table'; }
}

async function confirmDeleteUser(id, email) {
  if (!confirm(`Remove user ${email}? This will delete their profile and role. Their estimates will remain.`)) return;
  try {
    const { error } = await db.from('profiles').delete().eq('id', id);
    if (error) throw error;
    showToast('✓ User removed');
    loadAdminUsers();
    loadAdminStats();
  } catch(e) { showToast('Error: ' + e.message); }
}

async function grantRoleByEmail() {
  const email = document.getElementById('inviteEmail').value.trim();
  const role = document.getElementById('inviteRole').value;
  const result = document.getElementById('inviteResult');
  if (!email) { result.innerHTML = '<span style="color:var(--rust)">Please enter an email address</span>'; return; }

  result.innerHTML = '<span style="color:var(--muted)">Looking up user...</span>';
  try {
    // Find user by email in profiles
    const { data, error } = await db.from('profiles').select('id, email, role').eq('email', email).single();
    if (error || !data) {
      result.innerHTML = `<span style="color:var(--rust)">User not found — they need to sign up first at fixright.vercel.app</span>`;
      return;
    }
    await setUserRole(data.id, role);
    result.innerHTML = `<span style="color:var(--sage)">✓ ${email} granted ${role} access</span>`;
    document.getElementById('inviteEmail').value = '';
    loadAdminUsers();
  } catch(e) {
    result.innerHTML = `<span style="color:var(--rust)">Error: ${e.message}</span>`;
  }
}

function toggleDiscoverPublic(enabled) {
  // Show/hide discover tab for all users
  const tab = document.getElementById('tabDiscover');
  if (enabled) {
    tab.style.display = 'flex';
    localStorage.setItem('flag_discoverPublic', '1');
  } else {
    if (!isAdmin()) tab.style.display = 'none';
    localStorage.removeItem('flag_discoverPublic');
  }
  saveFlag('discoverPublic', enabled);
  showToast(enabled ? '✓ Discover tab visible to all users' : '✓ Discover tab hidden from regular users');
}

async function setUserRole(userId, role) {
  if (!isAdmin() || !dbReady) return;
  try {
    const { error } = await db.from('profiles').update({ role }).eq('id', userId);
    if (error) throw error;
    showToast('✓ Role updated to ' + role);
    loadAdminUsers();
    loadAdminStats();
  } catch(e) { showToast('Error: ' + e.message); }
}

function formatRegion(r) {
  const map = { 'us-national':'US','us-northeast':'US NE','us-southeast':'US SE','us-midwest':'US MW','us-southwest':'US SW','us-west':'US West','uk':'UK','ca':'Canada','au':'Australia' };
  return map[r] || r || '—';
}

function saveFlag(key, val) {
  localStorage.setItem('flag_' + key, val);
  showToast('✓ Flag saved');
}

function copySql() {
  const sql = document.getElementById('adminSql').textContent;
  navigator.clipboard.writeText(sql).then(() => showToast('📋 SQL copied!'));
}

// ─── ADMIN HEALTH CHECKS ──────────────────────────────────────────────────────
async function runHealthChecks() {
  // Check Anthropic
  const anthEl = document.getElementById('healthAnthropic');
  anthEl.textContent = 'Checking...'; anthEl.style.color = 'var(--muted)';
  try {
    const r = await fetch('/api/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] })
    });
    const d = await r.json();
    if (d.content || d.id) {
      anthEl.textContent = '● Connected'; anthEl.style.color = 'var(--sage)';
    } else {
      anthEl.textContent = '● Error: ' + (d.error || 'unknown'); anthEl.style.color = 'var(--rust)';
    }
  } catch(e) {
    anthEl.textContent = '● Failed'; anthEl.style.color = 'var(--rust)';
  }

  // Check OpenAI — if proxy returns a response at all (even image error), key is working
  const oaiEl = document.getElementById('healthOpenAI');
  oaiEl.textContent = 'Checking...'; oaiEl.style.color = 'var(--muted)';
  try {
    const r = await fetch('/api/openai-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test', imageBase64: 'dGVzdA==', size: '1024x1024' })
    });
    const d = await r.json();
    const errStr = (d?.error || d?.message || '').toString().toLowerCase();
    // Not configured / missing key = our proxy error
    if (!d || errStr.includes('not configured') || errStr.includes('missing') || r.status === 503) {
      oaiEl.textContent = '● Not configured'; oaiEl.style.color = 'var(--rust)';
    // Auth / invalid key = OpenAI 401
    } else if (r.status === 401 || errStr.includes('invalid api key') || errStr.includes('incorrect api key') || errStr.includes('unauthorized')) {
      oaiEl.textContent = '● Invalid key'; oaiEl.style.color = 'var(--rust)';
    } else {
      // Any other response (even image errors) = key works, API reachable
      oaiEl.textContent = '● Connected'; oaiEl.style.color = 'var(--sage)';
    }
  } catch(e) {
    oaiEl.textContent = '● Failed'; oaiEl.style.color = 'var(--rust)';
  }

  // DB already shown as connected if we got here
  document.getElementById('healthDb').textContent = dbReady ? '● Connected' : '● Disconnected';
  document.getElementById('healthDb').style.color = dbReady ? 'var(--sage)' : 'var(--rust)';
}

// ─── ADMIN: CREATE USER ───────────────────────────────────────────────────────
async function adminCreateUser() {
  const email = document.getElementById('inviteEmail').value.trim();
  const role = document.getElementById('inviteRole').value;
  const result = document.getElementById('inviteResult');

  if (!email) { result.innerHTML = '<span style="color:var(--rust)">Please enter an email</span>'; return; }
  if (!email.includes('@')) { result.innerHTML = '<span style="color:var(--rust)">Invalid email address</span>'; return; }

  result.innerHTML = '<span style="color:var(--muted)">Creating user...</span>';

  try {
    const resp = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role })
    });
    const data = await resp.json();

    if (data.success) {
      result.innerHTML = `
        <div style="background:rgba(100,180,100,0.1);border:1px solid var(--sage);border-radius:8px;padding:0.75rem;margin-top:0.5rem;">
          <div style="color:var(--sage);font-weight:600;margin-bottom:0.35rem;">✓ User created successfully</div>
          <div style="font-size:0.8rem;color:var(--muted);">Email: <strong>${email}</strong></div>
          <div style="font-size:0.8rem;color:var(--muted);">Role: <strong>${role}</strong></div>
          <div style="font-size:0.8rem;color:var(--muted);margin-top:0.35rem;">Temp password: <code style="background:var(--cream);padding:2px 6px;border-radius:4px;">${data.tempPassword}</code></div>
          <div style="font-size:0.75rem;color:var(--muted);margin-top:0.35rem;">Share this with them — they can change it after login</div>
        </div>`;
      document.getElementById('inviteEmail').value = '';
      loadAdminUsers();
    } else {
      result.innerHTML = `<span style="color:var(--rust)">Error: ${data.error}</span>`;
    }
  } catch(e) {
    result.innerHTML = `<span style="color:var(--rust)">Error: ${e.message}</span>`;
  }
}

async function getServiceKey() {
  // Read service key from Supabase app_config if stored
  try {
    const r = await fetch('https://zciyiltkaunbozoedfcr.supabase.co/rest/v1/app_config?key=eq.supabase_service_key&select=value', {
      headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjaXlpbHRrYXVuYm96b2VkZmNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5OTU4OTAsImV4cCI6MjA5MjU3MTg5MH0._nEPOkh1Ocn5uTwAju2zxim0JH6aROdmuFf1OdsvKzI' }
    });
    const d = await r.json();
    return d?.[0]?.value || null;
  } catch(e) { return null; }
}

function generateTempPassword() {
  return 'DIYEst-' + Math.random().toString(36).slice(2, 10) + '!';
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

let _analyticsPeriod = 'today';
let _analyticsData = [];

function setAnalyticsPeriod(period) {
  _analyticsPeriod = period;
  // Update active button
  ['today','7d','30d','all'].forEach(p => {
    const btn = document.getElementById('period' + p.charAt(0).toUpperCase() + p.slice(1));
    if (btn) btn.classList.toggle('active', p === period);
  });
  renderAnalytics();
}

async function loadAnalytics() {
  if (!dbReady) return;
  try {
    // Load all usage_stats
    const { data } = await db.from('usage_stats')
      .select('date, estimates_count, signups_count, visualizations_count, paid_conversions, visitors_count')
      .order('date', { ascending: true });
    _analyticsData = data || [];
    renderAnalytics();
  } catch(e) {
    console.error('Analytics load error:', e);
  }
}

function renderAnalytics() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  let filtered = [];
  let periodLabel = '';

  if (_analyticsPeriod === 'today') {
    filtered = _analyticsData.filter(r => r.date === today);
    periodLabel = 'today';
  } else if (_analyticsPeriod === '7d') {
    const cutoff = new Date(now - 7 * 86400000).toISOString().split('T')[0];
    filtered = _analyticsData.filter(r => r.date >= cutoff);
    periodLabel = 'last 7 days';
  } else if (_analyticsPeriod === '30d') {
    const cutoff = new Date(now - 30 * 86400000).toISOString().split('T')[0];
    filtered = _analyticsData.filter(r => r.date >= cutoff);
    periodLabel = 'last 30 days';
  } else {
    filtered = _analyticsData;
    periodLabel = 'all time';
  }

  // Sum totals
  const totals = filtered.reduce((acc, r) => ({
    estimates: acc.estimates + (r.estimates_count || 0),
    signups: acc.signups + (r.signups_count || 0),
    viz: acc.viz + (r.visualizations_count || 0),
    paid: acc.paid + (r.paid_conversions || 0),
    visitors: acc.visitors + (r.visitors_count || 0),
  }), { estimates: 0, signups: 0, viz: 0, paid: 0, visitors: 0 });

  // Update stat cards
  document.getElementById('aStatVisitors').textContent = totals.visitors;
  document.getElementById('aStatSignups').textContent = totals.signups;
  document.getElementById('aStatEstimates').textContent = totals.estimates;
  document.getElementById('aStatViz').textContent = totals.viz;
  document.getElementById('aStatPaid').textContent = totals.paid;
  ['aStatVisitorsSub','aStatSignupsSub','aStatEstimatesSub','aStatVizSub','aStatPaidSub'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = periodLabel;
  });

  // Render chart
  renderAnalyticsChart(filtered);
}

function renderAnalyticsChart(data) {
  const container = document.getElementById('analyticsChart');
  if (!container) return;

  if (!data.length) {
    container.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;margin:auto;">No data for this period</div>';
    return;
  }

  // For 'today' show hourly feel — just the one bar
  // For multi-day show each day as grouped bars
  const maxVal = Math.max(...data.map(r => Math.max(
    r.estimates_count || 0, r.visualizations_count || 0, r.signups_count || 0
  )), 1);

  const chartHeight = 100;
  const barGroupWidth = Math.max(4, Math.floor((container.clientWidth || 300) / (data.length * 3 + data.length)));

  container.innerHTML = data.map(r => {
    const eH = Math.round((r.estimates_count || 0) / maxVal * chartHeight);
    const vH = Math.round((r.visualizations_count || 0) / maxVal * chartHeight);
    const sH = Math.round((r.signups_count || 0) / maxVal * chartHeight);
    const dateLabel = data.length <= 7 ? r.date.slice(5) : (data.indexOf(r) % Math.ceil(data.length/7) === 0 ? r.date.slice(5) : '');
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:1px;flex:1;min-width:0;">
      <div style="display:flex;align-items:flex-end;gap:1px;height:${chartHeight}px;">
        <div title="Estimates: ${r.estimates_count||0}" style="width:${barGroupWidth}px;height:${eH}px;background:#1c2b3a;border-radius:2px 2px 0 0;min-height:${eH>0?2:0}px;"></div>
        <div title="Visualizations: ${r.visualizations_count||0}" style="width:${barGroupWidth}px;height:${vH}px;background:var(--sage);border-radius:2px 2px 0 0;min-height:${vH>0?2:0}px;"></div>
        <div title="Signups: ${r.signups_count||0}" style="width:${barGroupWidth}px;height:${sH}px;background:var(--rust);border-radius:2px 2px 0 0;min-height:${sH>0?2:0}px;"></div>
      </div>
      ${dateLabel ? `<div style="font-size:0.58rem;color:var(--muted);white-space:nowrap;">${dateLabel}</div>` : '<div style="height:12px;"></div>'}
    </div>`;
  }).join('');
}
