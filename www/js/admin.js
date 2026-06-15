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
let _analyticsData   = [];
let _analyticsEvents = [];
let _analyticsFrom   = new Date().toISOString().split('T')[0];
let _analyticsTo     = new Date().toISOString().split('T')[0];

function setAnalyticsPeriod(period) {
  _analyticsPeriod = period;
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  _analyticsTo = today;
  if (period === 'today')  _analyticsFrom = today;
  else if (period === '7d')  _analyticsFrom = new Date(now - 7  * 86400000).toISOString().split('T')[0];
  else if (period === '30d') _analyticsFrom = new Date(now - 30 * 86400000).toISOString().split('T')[0];
  else if (period === '90d') _analyticsFrom = new Date(now - 90 * 86400000).toISOString().split('T')[0];
  ['today','7d','30d','90d'].forEach(p => {
    const btn = document.getElementById('period' + p.charAt(0).toUpperCase() + p.slice(1));
    if (btn) btn.classList.toggle('active', p === period);
  });
  loadAnalytics();
}

async function loadAnalytics() {
  if (!dbReady) return;
  try {
    const { data, error } = await db.from('usage_stats')
      .select('date, estimates_count, signups_count, visualizations_count, paid_conversions, visitors_count')
      .gte('date', _analyticsFrom)
      .lte('date', _analyticsTo)
      .order('date', { ascending: true });
    console.log('[Analytics] usage_stats raw:', data, 'error:', error, 'from:', _analyticsFrom, 'to:', _analyticsTo);
    if (error) throw error;
    _analyticsData = data || [];

    const { data: evtData } = await db.from('usage_stats')
      .select('event_type, created_at')
      .in('event_type', ['see_sample_click', 'get_estimate_click'])
      .gte('created_at', _analyticsFrom + 'T00:00:00.000Z')
      .lte('created_at', _analyticsTo   + 'T23:59:59.999Z');
    _analyticsEvents = evtData || [];

    renderAnalytics();
  } catch(e) {
    console.error('Analytics load error:', e);
  }
}

function renderAnalytics() {
  let periodLabel = '';
  if (_analyticsPeriod === 'today')    periodLabel = 'today';
  else if (_analyticsPeriod === '7d')  periodLabel = 'last 7 days';
  else if (_analyticsPeriod === '30d') periodLabel = 'last 30 days';
  else if (_analyticsPeriod === '90d') periodLabel = 'last 90 days';
  else if (_analyticsPeriod === 'custom') periodLabel = _analyticsFrom + ' – ' + _analyticsTo;

  const totals = _analyticsData.reduce((acc, r) => ({
    estimates: acc.estimates + (r.estimates_count || 0),
    signups:   acc.signups   + (r.signups_count   || 0),
    viz:       acc.viz       + (r.visualizations_count || 0),
    paid:      acc.paid      + (r.paid_conversions || 0),
    visitors:  acc.visitors  + (r.visitors_count  || 0),
  }), { estimates: 0, signups: 0, viz: 0, paid: 0, visitors: 0 });

  const sampleViews    = _analyticsEvents.filter(e => e.event_type === 'see_sample_click').length;
  const estimateClicks = _analyticsEvents.filter(e => e.event_type === 'get_estimate_click').length;

  const setCard = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setCard('aStatVisitors',       totals.visitors);
  setCard('aStatSignups',        totals.signups);
  setCard('aStatEstimates',      totals.estimates);
  setCard('aStatViz',            totals.viz);
  setCard('aStatPaid',           totals.paid);
  setCard('aStatSampleViews',    sampleViews);
  setCard('aStatEstimateClicks', estimateClicks);

  ['aStatVisitorsSub','aStatSignupsSub','aStatEstimatesSub','aStatVizSub','aStatPaidSub',
   'aStatSampleViewsSub','aStatEstimateClicksSub'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = periodLabel;
  });

  renderAnalyticsChart(_analyticsData);
}

function renderAnalyticsChart(data) {
  const container = document.getElementById('analyticsChart');
  if (!container) return;

  if (!data.length) {
    container.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;margin:auto;">No data for this period</div>';
    return;
  }

  const sampleByDate = {}, clickByDate = {};
  _analyticsEvents.forEach(e => {
    const d = (e.created_at || '').split('T')[0];
    if (e.event_type === 'see_sample_click')   sampleByDate[d] = (sampleByDate[d] || 0) + 1;
    if (e.event_type === 'get_estimate_click') clickByDate[d]  = (clickByDate[d]  || 0) + 1;
  });

  const maxVal = Math.max(...data.map(r => Math.max(
    r.estimates_count || 0, r.visualizations_count || 0, r.signups_count || 0,
    sampleByDate[r.date] || 0, clickByDate[r.date] || 0
  )), 1);

  const chartHeight = 100;
  const barW = Math.max(3, Math.floor((container.clientWidth || 300) / (data.length * 5 + data.length + 4)));

  container.innerHTML = data.map((r, i) => {
    const eH  = Math.round((r.estimates_count || 0) / maxVal * chartHeight);
    const vH  = Math.round((r.visualizations_count || 0) / maxVal * chartHeight);
    const sH  = Math.round((r.signups_count || 0) / maxVal * chartHeight);
    const smH = Math.round((sampleByDate[r.date] || 0) / maxVal * chartHeight);
    const ecH = Math.round((clickByDate[r.date]  || 0) / maxVal * chartHeight);
    const showLabel = data.length <= 7 || i % Math.ceil(data.length / 7) === 0;
    const dateLabel = showLabel ? r.date.slice(5) : '';
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:1px;flex:1;min-width:0;">
      <div style="display:flex;align-items:flex-end;gap:1px;height:${chartHeight}px;">
        <div title="Estimates: ${r.estimates_count||0}" style="width:${barW}px;height:${eH}px;background:#1c2b3a;border-radius:2px 2px 0 0;min-height:${eH>0?2:0}px;"></div>
        <div title="Visualizations: ${r.visualizations_count||0}" style="width:${barW}px;height:${vH}px;background:var(--sage);border-radius:2px 2px 0 0;min-height:${vH>0?2:0}px;"></div>
        <div title="Signups: ${r.signups_count||0}" style="width:${barW}px;height:${sH}px;background:var(--rust);border-radius:2px 2px 0 0;min-height:${sH>0?2:0}px;"></div>
        <div title="Sample Views: ${sampleByDate[r.date]||0}" style="width:${barW}px;height:${smH}px;background:#7c3aed;border-radius:2px 2px 0 0;min-height:${smH>0?2:0}px;"></div>
        <div title="Estimate Clicks: ${clickByDate[r.date]||0}" style="width:${barW}px;height:${ecH}px;background:#0891b2;border-radius:2px 2px 0 0;min-height:${ecH>0?2:0}px;"></div>
      </div>
      ${dateLabel ? `<div style="font-size:0.58rem;color:var(--muted);white-space:nowrap;">${dateLabel}</div>` : '<div style="height:12px;"></div>'}
    </div>`;
  }).join('');
}

function applyCustomDateRange() {
  const from = document.getElementById('analyticsDateFrom').value;
  const to   = document.getElementById('analyticsDateTo').value;
  if (!from || !to || from > to) return;
  _analyticsPeriod = 'custom';
  _analyticsFrom   = from;
  _analyticsTo     = to;
  ['today','7d','30d','90d'].forEach(p => {
    const btn = document.getElementById('period' + p.charAt(0).toUpperCase() + p.slice(1));
    if (btn) btn.classList.remove('active');
  });
  loadAnalytics();
}

// ─── AGENT HUB ────────────────────────────────────────────────────────────────

const AGENTS = [
  { name: 'code-review',      desc: 'Scans for bugs, code quality, and maintainability issues',   prompt: 'Run the code-review agent' },
  { name: 'schema-check',     desc: 'Validates Supabase schema against app expectations',          prompt: 'Run the schema-check agent' },
  { name: 'retailer-price',   desc: 'Audits retailer pricing data for accuracy and staleness',     prompt: 'Run the retailer-price agent' },
  { name: 'safari-check',     desc: 'Finds Safari/PWA compatibility issues in a file',             prompt: 'Run the safari-check agent on [filename]' },
  { name: 'dead-code',        desc: 'Detects unused functions and unreachable code in a file',     prompt: 'Run the dead-code agent on [filename]' },
  { name: 'api-check',        desc: 'Validates API endpoints, payloads, and error handling',       prompt: 'Run the api-check agent' },
  { name: 'console-check',    desc: 'Finds leftover console.log and debug artifacts in a file',   prompt: 'Run the console-check agent on [filename]' },
  { name: 'conversion-audit', desc: 'Audits the conversion funnel for friction and drop-off',     prompt: 'Run the conversion-audit agent' },
  { name: 'funnel-check',     desc: 'Checks user flows for broken paths and missing CTAs',         prompt: 'Run the funnel-check agent' },
];

let _agentRuns = [];
let _flatFindings = [];

const _SEV_STYLE = {
  high:   { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
  medium: { bg: '#fffbeb', color: '#d97706', border: '#fcd34d' },
  low:    { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
  info:   { bg: '#eff6ff', color: '#2563eb', border: '#93c5fd' },
};

const _STAT_STYLE = {
  new:         { bg: '#eff6ff', color: '#2563eb' },
  in_progress: { bg: '#fffbeb', color: '#d97706' },
  resolved:    { bg: '#f0fdf4', color: '#16a34a' },
  ignored:     { bg: '#f3f4f6', color: '#6b7280' },
};

function switchAdminTab(tab) {
  const isDashboard = tab === 'dashboard';
  document.getElementById('adminPanelDashboard').style.display = isDashboard ? '' : 'none';
  document.getElementById('adminPanelAgentHub').style.display  = isDashboard ? 'none' : '';
  const dbBtn = document.getElementById('adminInnerTabDashboard');
  const ahBtn = document.getElementById('adminInnerTabAgentHub');
  if (dbBtn) {
    dbBtn.style.background   = isDashboard ? '#1c2b3a' : 'white';
    dbBtn.style.color        = isDashboard ? 'white' : 'var(--muted)';
    dbBtn.style.borderColor  = isDashboard ? '#1c2b3a' : 'var(--border)';
    dbBtn.style.fontWeight   = isDashboard ? '600' : '500';
  }
  if (ahBtn) {
    ahBtn.style.background   = isDashboard ? 'white' : '#1c2b3a';
    ahBtn.style.color        = isDashboard ? 'var(--muted)' : 'white';
    ahBtn.style.borderColor  = isDashboard ? 'var(--border)' : '#1c2b3a';
    ahBtn.style.fontWeight   = isDashboard ? '500' : '600';
  }
  if (!isDashboard) loadAgentHub();
}

async function loadAgentHub() {
  if (!dbReady) return;
  try {
    const { data, error } = await db.from('agent_runs')
      .select('*')
      .order('created_at', { ascending: false });
    _agentRuns = error ? [] : (data || []);
  } catch(e) {
    _agentRuns = [];
  }
  renderAgentCards(_agentRuns);
  renderFindingsFeed(_agentRuns);
  const sel = document.getElementById('filterAgent');
  if (sel) {
    const prev = sel.value;
    sel.innerHTML = '<option value="">All agents</option>' +
      AGENTS.map(a => `<option value="${a.name}"${a.name === prev ? ' selected' : ''}>${a.name}</option>`).join('');
  }
}

function renderAgentCards(runs) {
  const grid = document.getElementById('agentCardsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  AGENTS.forEach(agent => {
    const lastRun = runs.find(r => r.agent_name === agent.name);
    const lastRunDate = lastRun ? new Date(lastRun.created_at).toLocaleDateString() : 'Never';

    const card = document.createElement('div');
    card.style.cssText = 'background:var(--cream);border:1px solid var(--border);border-radius:10px;padding:1rem;display:flex;flex-direction:column;gap:0.4rem;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-weight:700;font-size:0.9rem;color:#1c2b3a;';
    nameEl.textContent = agent.name;

    const descEl = document.createElement('div');
    descEl.style.cssText = 'font-size:0.78rem;color:var(--muted);flex:1;line-height:1.4;';
    descEl.textContent = agent.desc;

    const dateEl = document.createElement('div');
    dateEl.style.cssText = 'font-size:0.72rem;color:var(--muted);';
    dateEl.textContent = 'Last run: ' + lastRunDate;

    const btn = document.createElement('button');
    btn.textContent = '📋 Copy Prompt';
    btn.style.cssText = "background:#1c2b3a;color:white;border:none;border-radius:7px;padding:0.4rem 0.75rem;font-size:0.78rem;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:0.35rem;align-self:flex-start;";
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(agent.prompt).then(() => showToast('📋 Prompt copied!'));
    });

    card.appendChild(nameEl);
    card.appendChild(descEl);
    card.appendChild(dateEl);
    card.appendChild(btn);
    grid.appendChild(card);
  });
}

function renderFindingsFeed(runs) {
  _flatFindings = [];
  runs.forEach(run => {
    (run.findings || []).forEach(f => {
      _flatFindings.push({ ...f, _runId: run.id, _agentName: run.agent_name, _runDate: run.created_at });
    });
  });
  applyFindingsFilter();
}

function filterFindings() {
  applyFindingsFilter();
}

function applyFindingsFilter() {
  const agentVal    = document.getElementById('filterAgent')?.value    || '';
  const severityVal = document.getElementById('filterSeverity')?.value || '';
  const statusVal   = document.getElementById('filterStatus')?.value   || '';

  const filtered = _flatFindings.filter(f => {
    if (agentVal    && f._agentName !== agentVal)    return false;
    if (severityVal && f.severity   !== severityVal) return false;
    if (statusVal   && f.status     !== statusVal)   return false;
    return true;
  });

  const feed = document.getElementById('findingsFeed');
  if (!feed) return;

  if (!filtered.length) {
    feed.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--muted);font-size:0.85rem;">No findings match the current filter</div>';
    return;
  }

  feed.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.overflowX = 'auto';
  const table = document.createElement('table');
  table.className = 'admin-table';
  table.style.display = 'table';

  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Severity</th><th>Agent</th><th>Category</th><th>Description</th><th>File</th><th>Status</th><th>Notes</th></tr>';
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  filtered.forEach(f => {
    const sev  = _SEV_STYLE[f.severity]  || _SEV_STYLE.info;
    const stat = _STAT_STYLE[f.status]   || _STAT_STYLE.new;
    const fileLine = (f.file && f.file !== 'n/a')
      ? f.file + (f.line && f.line !== 'n/a' ? ':' + f.line : '')
      : 'n/a';

    const tr = document.createElement('tr');

    const sevTd = document.createElement('td');
    const sevBadge = document.createElement('span');
    sevBadge.style.cssText = `background:${sev.bg};color:${sev.color};border:1px solid ${sev.border};border-radius:99px;padding:2px 8px;font-size:0.72rem;font-weight:700;white-space:nowrap;display:inline-block;`;
    sevBadge.textContent = f.severity;
    sevTd.appendChild(sevBadge);

    const agentTd = document.createElement('td');
    agentTd.style.cssText = 'font-size:0.78rem;font-weight:600;';
    agentTd.textContent = f._agentName;

    const catTd = document.createElement('td');
    catTd.style.fontSize = '0.78rem';
    catTd.textContent = f.category || '—';

    const descTd = document.createElement('td');
    descTd.style.cssText = 'font-size:0.8rem;max-width:220px;';
    descTd.textContent = f.description || '—';

    const fileTd = document.createElement('td');
    fileTd.style.cssText = 'font-size:0.72rem;color:var(--muted);font-family:monospace;white-space:nowrap;';
    fileTd.textContent = fileLine;

    const statTd = document.createElement('td');
    const statSel = document.createElement('select');
    statSel.style.cssText = `padding:0.25rem 0.5rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.78rem;font-family:'DM Sans',sans-serif;background:${stat.bg};color:${stat.color};outline:none;cursor:pointer;`;
    [['new','New'],['in_progress','In Progress'],['resolved','Resolved'],['ignored','Ignored']].forEach(([val,lbl]) => {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = lbl;
      if (f.status === val) opt.selected = true;
      statSel.appendChild(opt);
    });
    statTd.appendChild(statSel);

    const noteTd = document.createElement('td');
    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.value = f.note || '';
    noteInput.placeholder = 'Add note...';
    noteInput.style.cssText = "width:100%;min-width:120px;padding:0.3rem 0.5rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.78rem;font-family:'DM Sans',sans-serif;outline:none;box-sizing:border-box;";
    noteTd.appendChild(noteInput);

    statSel.addEventListener('change', () => updateFindingStatus(f._runId, f.id, statSel.value, noteInput.value));
    noteInput.addEventListener('blur', ()  => updateFindingStatus(f._runId, f.id, statSel.value, noteInput.value));

    [sevTd, agentTd, catTd, descTd, fileTd, statTd, noteTd].forEach(td => tr.appendChild(td));
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
  feed.appendChild(wrap);
}

async function updateFindingStatus(runId, findingId, status, note) {
  if (!dbReady) return;
  try {
    const { data: run, error: fetchErr } = await db.from('agent_runs')
      .select('findings')
      .eq('id', runId)
      .single();
    if (fetchErr) throw fetchErr;
    const findings = (run.findings || []).map(f =>
      f.id === findingId ? { ...f, status, note } : f
    );
    const { error } = await db.from('agent_runs').update({ findings }).eq('id', runId);
    if (error) throw error;
    _agentRuns    = _agentRuns.map(r => r.id === runId ? { ...r, findings } : r);
    _flatFindings = _flatFindings.map(f =>
      (f._runId === runId && f.id === findingId) ? { ...f, status, note } : f
    );
    showToast('✓ Finding updated');
  } catch(e) {
    showToast('Error: ' + e.message);
  }
}

async function logAgentRun(agentName, scannedFiles, findings) {
  if (!dbReady) throw new Error('DB not ready — ensure you are signed in as admin');
  const { data, error } = await db.from('agent_runs').insert({
    agent_name: agentName,
    scanned_files: scannedFiles,
    findings: findings,
  }).select().single();
  if (error) throw error;
  console.log('[Agent Hub] Run logged, id:', data.id, '| findings:', findings.length);
  return data;
}
window.logAgentRun = logAgentRun;
