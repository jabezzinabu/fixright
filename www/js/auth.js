let currentUser = null;
const SUPER_ADMIN_EMAIL = 'jabezzinabu@gmail.com';

let authMode = 'signin';

async function checkSession() {
  if (!dbReady) return;
  try {
    let recoveryHandled = false;

    db.auth.onAuthStateChange((event, session) => {
      console.log('[AUTH]', event, '| user:', !!session?.user, '| _isRecoveryFlow:', window._isRecoveryFlow);
      // Guard 1: explicit PASSWORD_RECOVERY event
      // Guard 2: any event with a user while recovery flow is active (URL or localStorage flag)
      if (event === 'PASSWORD_RECOVERY' || (window._isRecoveryFlow && session?.user)) {
        recoveryHandled = true;
        window._isRecoveryFlow = false;
        console.log('[PWD RESET] Showing password reset modal (event:', event, ')');
        showPasswordResetModal();
        return;
      }
      if (session?.user) setUser(session.user);
      else clearUser();
    });

    // getSession() is required to trigger PKCE code exchange —
    // without it Supabase may never exchange the ?code= from the reset URL.
    const { data: { session } } = await db.auth.getSession();
    // Only auto-login if neither guard above already handled a recovery event.
    if (session?.user && !window._isRecoveryFlow && !recoveryHandled) {
      setUser(session.user);
    }
  } catch(e) { console.log('Auth check failed:', e.message); }
}

async function setUser(user) {
  currentUser = user;
  document.getElementById('authArea').style.display = 'none';
  const wrap = document.getElementById('userMenuWrap');
  wrap.style.display = 'block';
  const initial = (user.email || 'U')[0].toUpperCase();
  document.getElementById('userAvatar').textContent = initial;
  document.getElementById('dropdownEmail').textContent = user.email;

  // Check admin/pro role
  await checkUserRole(user);
  // Load viz credits
  await loadVizCredits();
  updateFreeNotice();
}

async function checkUserRole(user) {
  // Hardcoded super admin — always active regardless of DB
  if (user.email === SUPER_ADMIN_EMAIL) {
    grantSuperAdmin();
    return;
  }
  // Check DB profile for pro role
  if (dbReady) {
    try {
      const { data, error } = await db.from('profiles').select('role').eq('id', user.id).single();
      if (error || !data) {
        // No profile row — create one
        await db.from('profiles').upsert({ id: user.id, email: user.email, role: 'free' });
        if (user.app_metadata?.provider === 'google') {
          trackEvent('sign_up', { method: 'google' });
        }
        return;
      }
      if (data?.role === 'admin') { grantSuperAdmin(); return; }
      if (data?.role === 'pro') { grantPro(); return; }
    } catch(e) { /* profiles table may not exist yet */ }
  }
}

function grantSuperAdmin() {
  currentUser.role = 'admin';
  // Show admin + discover + visualize tabs
  document.getElementById('tabAdmin').style.display = 'flex';
  // Visualize tab hidden — viz is now built into estimate flow

  // Show admin badge on avatar
  document.getElementById('userAvatar').style.background = 'linear-gradient(135deg, var(--gold), #e8a820)';
  document.getElementById('userAvatar').style.color = '#1c2b3a';
  // Add admin item to dropdown
  const dd = document.getElementById('userDropdown');
  if (!dd.querySelector('.admin-dd-item')) {
    const item = document.createElement('div');
    item.className = 'dropdown-item admin-dd-item';
    item.innerHTML = '⚙️ Admin Dashboard';
    item.onclick = () => { switchTab('admin'); loadAdminData(); toggleUserMenu(); };
    dd.insertBefore(item, dd.querySelector('.dropdown-item'));
  }
  showToast('👑 Super Admin access granted');
}

function grantPro() {
  currentUser.role = 'pro';
  document.getElementById('userAvatar').style.background = 'var(--sage)';
}

function isAdmin() { return currentUser?.role === 'admin'; }
function isPro() { return currentUser?.role === 'pro' || currentUser?.role === 'admin'; }

function clearUser() {
  currentUser = null;
  document.getElementById('authArea').style.display = 'block';
  document.getElementById('userMenuWrap').style.display = 'none';
  document.getElementById('tabAdmin').style.display = 'none';

  document.getElementById('tabVisualize').style.display = 'none';
  if (document.getElementById('sectionDiscover')?.classList.contains('active')) {
    switchTab('estimate');
  }
  // Reset avatar colour
  document.getElementById('userAvatar').style.background = 'var(--rust)';
  document.getElementById('userAvatar').style.color = 'white';
  // Switch back to estimate tab if on admin
  if (document.getElementById('sectionAdmin')?.classList.contains('active')) {
    switchTab('estimate');
  }
}

function showAuthModal() {
  document.getElementById('authModal').classList.add('open');
  document.getElementById('authError').style.display = 'none';
  document.getElementById('authSuccess').style.display = 'none';
}

function closeAuthModal() { document.getElementById('authModal').classList.remove('open'); }

function switchAuthTab(mode) {
  authMode = mode;
  document.querySelectorAll('.auth-tab').forEach((t, i) => t.classList.toggle('active', (i === 0) === (mode === 'signin')));
  document.getElementById('authSubmitBtn').textContent = mode === 'signin' ? 'Sign In' : 'Create Account';
  document.getElementById('authModalTitle').textContent = mode === 'signin' ? 'Welcome back' : 'Create your account';
  document.getElementById('authError').style.display = 'none';
  document.getElementById('authSuccess').style.display = 'none';
}

async function submitAuth() {
  if (!dbReady) { showAuthError('Database not connected — check Supabase config'); return; }
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  if (!email || !password) { showAuthError('Please enter email and password'); return; }

  const btn = document.getElementById('authSubmitBtn');
  if (btn.disabled) return;
  btn.disabled = true; btn.textContent = '...';

  try {
    let result;
    if (authMode === 'signin') {
      result = await db.auth.signInWithPassword({ email, password });
    } else {
      result = await db.auth.signUp({ email, password });
    }
    if (result.error) throw result.error;
    if (authMode === 'signup' && !result.data.session) {
      showAuthSuccess('✓ Account created! Check your email to confirm before signing in.');
      showToast('📧 Confirmation email sent — check your inbox!');
      trackEvent('signups_count');
      trackEvent('sign_up', { method: 'email' });
      // Grant 3 free viz credits
      if (result.data.user) {
        await db.from('profiles').upsert({ id: result.data.user.id, email, role: 'free', viz_credits: 3, viz_credits_total: 3 }, { onConflict: 'id' });
      }
    } else if (authMode === 'signup') {
      closeAuthModal();
      showToast('✓ Welcome! You have 3 free visualizations.');
      trackEvent('signups_count');
      trackEvent('sign_up', { method: 'email' });
      if (result.data.user) {
        await db.from('profiles').upsert({ id: result.data.user.id, email, role: 'free', viz_credits: 3, viz_credits_total: 3 }, { onConflict: 'id' });
        _vizCredits = 3;
      }
    } else {
      closeAuthModal();
      showToast('✓ Welcome back!');
    }
  } catch(e) {
    showAuthError(e.message || 'Authentication failed');
  } finally {
    btn.disabled = false;
    btn.textContent = authMode === 'signin' ? 'Sign In' : 'Create Account';
  }
}

async function signInWithGoogle() {
  if (!dbReady) { showAuthError('Database not connected — check Supabase config'); return; }
  try {
    const redirectTo = location.origin + location.pathname;
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { access_type: 'offline', prompt: 'consent' }
      }
    });
    if (error) throw error;
  } catch(e) {
    showAuthError('Google sign-in failed: ' + e.message + '. Make sure Google is enabled in Supabase → Authentication → Providers.');
  }
}

async function signInWithApple() {
  if (!dbReady) { showAuthError('Database not connected'); return; }
  try {
    const { error } = await db.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: location.origin + location.pathname }
    });
    if (error) throw error;
  } catch(e) {
    showAuthError('Apple sign-in failed: ' + e.message + '. Make sure Apple is enabled in Supabase → Authentication → Providers.');
  }
}

async function signOut() {
  if (dbReady) await db.auth.signOut();
  clearUser();
  toggleUserMenu();
  showToast('Signed out');
}

function toggleUserMenu() {
  document.getElementById('userDropdown').classList.toggle('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.user-menu')) {
    document.getElementById('userDropdown')?.classList.remove('open');
  }
});

// ─── CHANGE PASSWORD (from account menu) ──────────────────────────────────────
function showChangePasswordModal() {
  const existing = document.getElementById('changePwdModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'changePwdModal';
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal" style="max-width:400px;">
      <div class="modal-header">
        <h3>Change Password</h3>
        <button class="modal-close" onclick="document.getElementById('changePwdModal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="auth-error" id="changePwdError" style="display:none;"></div>
        <div class="auth-success" id="changePwdSuccess" style="display:none;"></div>
        <div class="field" style="margin-bottom:0.75rem;">
          <label>New Password</label>
          <div class="pwd-wrap">
            <input type="password" id="changePwdNew" placeholder="New password (min 6 characters)" style="width:100%;padding:0.65rem 0.85rem;border:1.5px solid var(--border);border-radius:9px;font-family:'DM Sans',sans-serif;font-size:0.92rem;outline:none;box-sizing:border-box;">
            <button type="button" class="pwd-toggle" onclick="togglePwd('changePwdNew', this)" title="Show/hide">👁</button>
          </div>
        </div>
        <div class="field" style="margin-bottom:1.25rem;">
          <label>Confirm New Password</label>
          <div class="pwd-wrap">
            <input type="password" id="changePwdConfirm" placeholder="Confirm new password" style="width:100%;padding:0.65rem 0.85rem;border:1.5px solid var(--border);border-radius:9px;font-family:'DM Sans',sans-serif;font-size:0.92rem;outline:none;box-sizing:border-box;">
            <button type="button" class="pwd-toggle" onclick="togglePwd('changePwdConfirm', this)" title="Show/hide">👁</button>
          </div>
        </div>
        <button onclick="submitChangePassword()" class="btn-auth" style="width:100%;">Update Password</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function submitChangePassword() {
  const newPwd = document.getElementById('changePwdNew').value;
  const confirmPwd = document.getElementById('changePwdConfirm').value;
  const errEl = document.getElementById('changePwdError');
  const succEl = document.getElementById('changePwdSuccess');
  errEl.style.display = 'none'; succEl.style.display = 'none';
  if (!newPwd || newPwd.length < 6) { errEl.textContent = 'Password must be at least 6 characters'; errEl.style.display = 'block'; return; }
  if (newPwd !== confirmPwd) { errEl.textContent = 'Passwords do not match'; errEl.style.display = 'block'; return; }
  succEl.textContent = 'Updating...'; succEl.style.display = 'block';
  try {
    const { error } = await db.auth.updateUser({ password: newPwd });
    if (error) throw error;
    succEl.textContent = '✓ Password updated successfully!';
    setTimeout(() => document.getElementById('changePwdModal')?.remove(), 2000);
  } catch(e) {
    errEl.textContent = e.message || 'Could not update password. Please try again.';
    errEl.style.display = 'block'; succEl.style.display = 'none';
  }
}

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
function showForgotPassword() {
  const email = document.getElementById('authEmail').value;
  document.getElementById('authEmail').style.display = 'none';
  document.getElementById('authPassword').style.display = 'none';
  document.getElementById('forgotRow').style.display = 'none';
  document.getElementById('authSubmitBtn').style.display = 'none';
  document.getElementById('forgotForm').style.display = 'block';
  if (email) document.getElementById('forgotEmail').value = email;
}

function hideForgotPassword() {
  document.getElementById('forgotForm').style.display = 'none';
  document.getElementById('authEmail').style.display = 'block';
  document.getElementById('authPassword').style.display = 'block';
  document.getElementById('forgotRow').style.display = 'block';
  document.getElementById('authSubmitBtn').style.display = 'block';
  document.getElementById('authError').textContent = '';
  document.getElementById('authSuccess').textContent = '';
}

async function sendPasswordReset() {
  const email = document.getElementById('forgotEmail').value.trim();
  if (!email) { showAuthError('Please enter your email address'); return; }
  const btn = document.getElementById('sendResetBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sending...'; }
  try {
    // Set flag BEFORE sending — so when the user clicks the email link
    // and lands back here, we know it's a password reset regardless of URL params.
    localStorage.setItem('pwdResetPending', '1');
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/?type=recovery&reset=1'
    });
    if (error) {
      localStorage.removeItem('pwdResetPending');
      throw error;
    }
    // Close the modal and show a prominent confirmation the user can't miss
    closeAuthModal();
    showResetConfirmation(email);
  } catch(e) {
    showAuthError(e.message || 'Could not send reset email');
    if (btn) { btn.disabled = false; btn.textContent = 'Send Reset Link'; }
  }
}

function showResetConfirmation(email) {
  const existing = document.getElementById('resetConfirmOverlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'resetConfirmOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9998;display:flex;align-items:center;justify-content:center;padding:1rem;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:18px;padding:2rem 2rem 1.75rem;max-width:380px;width:100%;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,0.25);">
      <div style="font-size:2.5rem;margin-bottom:0.75rem;">📧</div>
      <h3 style="margin:0 0 0.5rem;font-size:1.15rem;color:#1c2b3a;">Check your inbox</h3>
      <p style="margin:0 0 1.25rem;color:#666;font-size:0.9rem;line-height:1.5;">
        We've sent a password reset link to<br>
        <strong style="color:#1c2b3a;">${email}</strong><br>
        <span style="font-size:0.82rem;">(Check your spam folder if you don't see it)</span>
      </p>
      <button onclick="document.getElementById('resetConfirmOverlay').remove()"
        style="background:#5a7a4e;color:white;border:none;border-radius:99px;padding:0.65rem 2rem;font-size:0.92rem;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;">
        Got it
      </button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}


// ─── PASSWORD RESET HANDLER ───────────────────────────────────────────────────
function checkPasswordResetRedirect() {
  const hash = window.location.hash;
  const params = new URLSearchParams(window.location.search);
  // Supabase sends access_token in hash after password reset click
  if (hash.includes('type=recovery') || params.get('type') === 'recovery' || hash.includes('access_token')) {
    // Small delay to let Supabase process the token
    setTimeout(showPasswordResetModal, 500);
  }
}

function showPasswordResetModal() {
  // Create a password reset modal
  const existing = document.getElementById('resetModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'resetModal';
  modal.className = 'modal-overlay open';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:420px;">
      <div class="modal-header">
        <h3>Set a new password</h3>
      </div>
      <div style="padding:1.5rem;">
        <div class="auth-error" id="resetError"></div>
        <div class="auth-success" id="resetSuccess"></div>
        <div class="field" style="margin-bottom:1rem;">
          <label>New password</label>
          <div class="pwd-wrap">
            <input type="password" id="resetNewPassword" placeholder="Enter new password (min 6 characters)"
              style="width:100%;padding:0.65rem 0.85rem;border:1.5px solid var(--border);border-radius:9px;font-family:'DM Sans',sans-serif;font-size:0.92rem;outline:none;box-sizing:border-box;">
            <button type="button" class="pwd-toggle" onclick="togglePwd('resetNewPassword', this)" title="Show/hide password">👁</button>
          </div>
        </div>
        <div class="field" style="margin-bottom:1.25rem;">
          <label>Confirm password</label>
          <div class="pwd-wrap">
            <input type="password" id="resetConfirmPassword" placeholder="Confirm new password"
              style="width:100%;padding:0.65rem 0.85rem;border:1.5px solid var(--border);border-radius:9px;font-family:'DM Sans',sans-serif;font-size:0.92rem;outline:none;box-sizing:border-box;">
            <button type="button" class="pwd-toggle" onclick="togglePwd('resetConfirmPassword', this)" title="Show/hide password">👁</button>
          </div>
        </div>
        <button onclick="submitPasswordReset()" class="btn-auth" style="width:100%;">Update Password</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function submitPasswordReset() {
  const newPwd = document.getElementById('resetNewPassword').value;
  const confirmPwd = document.getElementById('resetConfirmPassword').value;
  const errEl = document.getElementById('resetError');
  const succEl = document.getElementById('resetSuccess');

  if (!newPwd || newPwd.length < 6) { errEl.textContent = 'Password must be at least 6 characters'; return; }
  if (newPwd !== confirmPwd) { errEl.textContent = 'Passwords do not match'; return; }

  errEl.textContent = '';
  succEl.textContent = 'Updating...';

  try {
    const { data, error } = await db.auth.updateUser({ password: newPwd });
    if (error) throw error;
    succEl.textContent = '✓ Password updated! Signing you in...';
    // Log the user in with the session returned from updateUser
    if (data?.user) setUser(data.user);
    // Clean up URL and close modal after 2s
    setTimeout(() => {
      document.getElementById('resetModal')?.remove();
      window.history.replaceState({}, document.title, '/');
    }, 2000);
  } catch(e) {
    errEl.textContent = e.message || 'Could not update password';
    succEl.textContent = '';
  }
}

// ─── SIGNUP POPUP ─────────────────────────────────────────────────────────────
let _signupPopupShown = false;

function showSignupPopup() {
  if (_signupPopupShown || currentUser) return;
  _signupPopupShown = true;
  const popup = document.getElementById('signupPopup');
  if (popup) popup.style.display = 'flex';
}

function closeSignupPopup() {
  const popup = document.getElementById('signupPopup');
  if (popup) popup.style.display = 'none';
  localStorage.setItem('diy_popup_dismissed', '1');
  // If dismissed while trying to run an estimate, show auth modal as fallback
  if (window._pendingAuthAfterPopup) {
    window._pendingAuthAfterPopup = false;
    setTimeout(showAuthModal, 300);
  }
}

async function submitPopupSignup() {
  const email = document.getElementById('popupEmail').value.trim();
  const password = document.getElementById('popupPassword').value;
  const errEl = document.getElementById('signupPopupError');
  const btn = document.getElementById('popupSignupBtn');

  if (!email || !password) { errEl.textContent = 'Please enter email and password'; errEl.style.display='block'; return; }
  if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters'; errEl.style.display='block'; return; }

  btn.textContent = 'Creating account...'; btn.disabled = true;
  errEl.style.display = 'none';

  try {
    const { data, error } = await db.auth.signUp({ email, password });
    if (error) throw error;

    // Grant 3 free viz credits
    if (data.user) {
      await db.from('profiles').upsert({ id: data.user.id, email, role: 'free', viz_credits: 3, viz_credits_total: 3 }, { onConflict: 'id' });
      trackEvent('signups_count');
      trackEvent('sign_up', { method: 'email' });
    }

    window._pendingAuthAfterPopup = false;
    if (data.session) {
      closeSignupPopup();
      setUser(data.user);
      showToast('🎉 Welcome! You have 3 free visualizations.');
    } else {
      // Email verification required — show clear message in the popup instead of closing it
      btn.textContent = '✓ Account created!'; btn.disabled = true;
      errEl.style.display = 'none';
      const emailMsg = document.createElement('div');
      emailMsg.style.cssText = 'background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:0.75rem;font-size:0.85rem;color:#166534;margin-bottom:0.75rem;line-height:1.5;';
      emailMsg.innerHTML = '<strong>✅ Account created!</strong><br>Please check your email and click the confirmation link to activate your account.<br><br>You can view your estimate below — confirm your email when you\'re ready to save.';
      btn.parentNode.insertBefore(emailMsg, btn);
      setTimeout(closeSignupPopup, 5000);
    }
  } catch(e) {
    const msg = e.message || '';
    if (msg.includes('already registered') || msg.includes('already exists')) {
      errEl.textContent = 'Email already registered. Try signing in instead.';
    } else {
      errEl.textContent = msg || 'Sign up failed. Please try again.';
    }
    errEl.style.display = 'block';
    btn.textContent = 'Sign Up Free — Get 3 Visualizations'; btn.disabled = false;
  }
}

function showSignupPopupForEstimate() {
  // Show the signup popup with estimate-specific messaging
  const popup = document.getElementById('signupPopup');
  if (!popup) { showAuthModal(); return; }
  // Update messaging to be estimate-focused
  const title = popup.querySelector('.modal-header h3');
  const desc = popup.querySelector('.modal-body p');
  if (title) title.textContent = '🎁 Get 3 Free Visualizations';
  if (desc) desc.innerHTML = 'Sign up free to run estimates and get <strong>3 free AI visualizations</strong> — see your project before you start.';
  popup.style.display = 'flex';
  _signupPopupShown = true;
  // If they close without signing up, show auth modal
  const closeBtn = popup.querySelector('.modal-close');
  const noThanks = popup.querySelector('button[onclick="closeSignupPopup()"]');
  const originalClose = closeSignupPopup;
  window._pendingAuthAfterPopup = true;
}
