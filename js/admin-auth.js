/**
 * Hair Valley — Supabase Admin Authentication Controller
 * Manages Log In, Password Visibility, Password Recovery & Protected API Calls
 */

(function () {
  let supabaseClient = null;
  let currentUser = null;
  let currentSession = null;
  let isRecoveryActive = false;
  let recoveryEmail = null;

  function refreshLucideIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function initSupabase() {
    if (window.supabase && window.SUPABASE_CONFIG) {
      supabaseClient = window.supabase.createClient(
        window.SUPABASE_CONFIG.url,
        window.SUPABASE_CONFIG.anonKey
      );
      window.supabaseClient = supabaseClient;
    } else {
      console.warn('[Admin Auth] Supabase library or configuration missing.');
    }
  }

  // Authenticated Fetch Helper: attaches Bearer token if session exists
  async function authFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (currentSession && currentSession.access_token) {
      options.headers['Authorization'] = `Bearer ${currentSession.access_token}`;
    }
    return fetch(url, options);
  }

  window.authFetch = authFetch;

  // Log In Handler
  async function handleLogin(email, password) {
    if (!supabaseClient) throw new Error('Supabase client not initialized');
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  }

  // Sign Out Handler
  async function handleSignOut() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
  }

  // Password Visibility Toggle Handler (Lucide Eye / Eye-Off)
  function setupPasswordToggles() {
    document.querySelectorAll('.btn-pwd-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (!input) return;

        if (input.type === 'password') {
          input.type = 'text';
          btn.innerHTML = '<i data-lucide="eye-off" style="width: 18px; height: 18px;"></i>';
          btn.setAttribute('title', 'Hide password');
        } else {
          input.type = 'password';
          btn.innerHTML = '<i data-lucide="eye" style="width: 18px; height: 18px;"></i>';
          btn.setAttribute('title', 'Show password');
        }
        refreshLucideIcons();
      });
    });
  }

  // Switch between Auth Modal views: 'login' | 'forgot' | 'recovery'
  function switchAuthView(view) {
    const formLogin = document.getElementById('formAuthLogin');
    const formForgot = document.getElementById('formAuthForgot');
    const formNewPass = document.getElementById('formAuthNewPassword');
    const titleEl = document.getElementById('authModalTitle');
    const subtitleEl = document.getElementById('authModalSubtitle');
    const feedback = document.getElementById('authFeedbackMessage');

    if (feedback) feedback.textContent = '';

    // Hide all forms first
    if (formLogin) formLogin.style.display = 'none';
    if (formForgot) formForgot.style.display = 'none';
    if (formNewPass) formNewPass.style.display = 'none';

    if (view === 'login') {
      if (formLogin) formLogin.style.display = 'block';
      if (titleEl) titleEl.textContent = 'Hair Valley';
      if (subtitleEl) subtitleEl.textContent = 'Management Console & Cloud Database';
    } else if (view === 'forgot') {
      if (formForgot) formForgot.style.display = 'block';
      if (titleEl) titleEl.textContent = 'Reset Password';
      if (subtitleEl) subtitleEl.textContent = 'Security Verification';
    } else if (view === 'recovery') {
      if (formNewPass) formNewPass.style.display = 'block';
      if (titleEl) titleEl.textContent = 'Create New Password';
      if (subtitleEl) subtitleEl.textContent = 'Update your admin credentials';
    }

    refreshLucideIcons();
  }

  // Update UI based on session
  function renderAuthState(user) {
    const authGate = document.getElementById('adminAuthGate');
    const userEmailEl = document.getElementById('adminUserEmail');
    const adminMain = document.querySelector('.admin-main');
    const adminSidebar = document.querySelector('.admin-sidebar');

    if (isRecoveryActive) {
      if (authGate) authGate.style.display = 'flex';
      if (adminMain) adminMain.style.filter = 'blur(4px)';
      if (adminSidebar) adminSidebar.style.filter = 'blur(4px)';
      switchAuthView('recovery');
      return;
    }

    if (user) {
      currentUser = user;
      if (authGate) authGate.style.display = 'none';
      if (adminMain) adminMain.style.filter = 'none';
      if (adminSidebar) adminSidebar.style.filter = 'none';
      if (userEmailEl) userEmailEl.textContent = user.email;
    } else {
      currentUser = null;
      currentSession = null;
      if (authGate) authGate.style.display = 'flex';
      if (adminMain) adminMain.style.filter = 'blur(4px)';
      if (adminSidebar) adminSidebar.style.filter = 'blur(4px)';
      if (userEmailEl) userEmailEl.textContent = '';
      switchAuthView('login');
    }
  }

  function setupAuthFormListeners() {
    const formLogin = document.getElementById('formAuthLogin');
    const formForgot = document.getElementById('formAuthForgot');
    const formNewPass = document.getElementById('formAuthNewPassword');
    const authFeedback = document.getElementById('authFeedbackMessage');
    const btnLogout = document.getElementById('btnAdminLogout');
    const btnShowForgot = document.getElementById('btnShowForgotPassword');
    const btnBackToLogin = document.getElementById('btnBackToLoginFromForgot');
    const btnCancelRecovery = document.getElementById('btnCancelRecovery');

    // 1. Navigation
    if (btnShowForgot) btnShowForgot.addEventListener('click', () => switchAuthView('forgot'));
    if (btnBackToLogin) btnBackToLogin.addEventListener('click', () => switchAuthView('login'));
    if (btnCancelRecovery) {
      btnCancelRecovery.addEventListener('click', async () => {
        isRecoveryActive = false;
        recoveryEmail = null;
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, document.title, window.location.pathname);
        }
        await handleSignOut();
        switchAuthView('login');
      });
    }

    // 2. Submit Log In
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const btn = formLogin.querySelector('button[type="submit"]');

        try {
          btn.disabled = true;
          btn.textContent = 'Signing in...';
          if (authFeedback) authFeedback.textContent = '';

          await handleLogin(email, password);
          if (typeof window.showToast === 'function') {
            window.showToast(`Welcome back, ${email}!`);
          }
        } catch (err) {
          console.error('Login error:', err);
          if (authFeedback) {
            authFeedback.style.color = '#e74c3c';
            authFeedback.textContent = err.message || 'Invalid email or password';
          }
        } finally {
          btn.disabled = false;
          btn.textContent = 'Log In to CMS';
        }
      });
    }

    // 3. Submit Forgot Password
    if (formForgot) {
      formForgot.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgotEmail').value.trim();
        const btn = formForgot.querySelector('button[type="submit"]');

        try {
          btn.disabled = true;
          btn.textContent = 'Initiating recovery...';
          if (authFeedback) authFeedback.textContent = '';

          const redirectUrl = window.location.origin + window.location.pathname + '?type=recovery';
          let recoveryLink = null;

          // Call backend recovery endpoint
          try {
            const apiRes = await fetch('/api/auth/forgot-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email })
            });
            const apiData = await apiRes.json();
            if (apiData.recoveryLink) {
              recoveryLink = apiData.recoveryLink;
              recoveryEmail = email;
            }
          } catch (e) {}

          // Also trigger Supabase client reset
          if (supabaseClient) {
            try {
              await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
            } catch (e) {}
          }

          if (recoveryLink) {
            authFeedback.innerHTML = `
              <div style="color: #27ae60; line-height: 1.5;">
                Password recovery link generated!
                <div style="margin-top: 0.75rem;">
                  <a href="${recoveryLink}" class="btn-primary" style="display: inline-flex; font-size: 0.85rem; padding: 0.5rem 1rem; text-decoration: none; border-radius: 8px;">
                    Click Here to Reset Password Now →
                  </a>
                </div>
              </div>
            `;
          } else {
            authFeedback.style.color = '#27ae60';
            authFeedback.textContent = 'Password reset instructions have been sent! Please check your inbox.';
          }

          if (typeof window.showToast === 'function') {
            window.showToast('Recovery initiated! Please check instructions.');
          }
        } catch (err) {
          console.error('Forgot password error:', err);
          if (authFeedback) {
            authFeedback.style.color = '#e74c3c';
            authFeedback.textContent = err.message || 'Failed to send recovery link';
          }
        } finally {
          btn.disabled = false;
          btn.textContent = 'Send Password Reset Link';
        }
      });
    }

    // 4. Submit Set New Password
    if (formNewPass) {
      formNewPass.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;
        const btn = formNewPass.querySelector('button[type="submit"]');

        if (newPassword.length < 6) {
          if (authFeedback) {
            authFeedback.style.color = '#e74c3c';
            authFeedback.textContent = 'Password must be at least 6 characters long.';
          }
          return;
        }

        if (newPassword !== confirmNewPassword) {
          if (authFeedback) {
            authFeedback.style.color = '#e74c3c';
            authFeedback.textContent = 'Passwords do not match. Please re-enter.';
          }
          return;
        }

        try {
          btn.disabled = true;
          btn.textContent = 'Updating password...';
          if (authFeedback) authFeedback.textContent = '';

          let updated = false;

          // Method 1: Client Supabase updateUser (valid when session is loaded from recovery token)
          if (supabaseClient) {
            try {
              const { data, error } = await supabaseClient.auth.updateUser({
                password: newPassword
              });
              if (!error && data && data.user) {
                updated = true;
                currentUser = data.user;
              } else if (error) {
                console.warn('[Admin Auth] Client updateUser warning:', error.message);
              }
            } catch (e) {
              console.warn('[Admin Auth] Client updateUser error:', e.message);
            }
          }

          // Method 2: Service Role direct reset fallback
          if (!updated) {
            const emailToReset = recoveryEmail || (currentUser && currentUser.email) || document.getElementById('forgotEmail')?.value.trim() || document.getElementById('loginEmail')?.value.trim();
            if (!emailToReset) {
              throw new Error('Could not determine account email. Please request a new recovery link.');
            }

            const res = await authFetch('/api/auth/direct-reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: emailToReset, newPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update password');
            
            // Auto login with new password
            if (supabaseClient) {
              const loginRes = await supabaseClient.auth.signInWithPassword({ email: emailToReset, password: newPassword });
              if (!loginRes.error && loginRes.data) {
                currentUser = loginRes.data.user;
                currentSession = loginRes.data.session;
                updated = true;
              }
            }
          }

          // Recovery complete! Exit recovery state
          isRecoveryActive = false;
          recoveryEmail = null;

          // Clean URL hash/query
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, document.title, window.location.pathname);
          }

          if (typeof window.showToast === 'function') {
            window.showToast('Password updated successfully! Welcome to the CMS.');
          }

          // Unlock dashboard
          renderAuthState(currentUser);
        } catch (err) {
          console.error('Update password error:', err);
          if (authFeedback) {
            authFeedback.style.color = '#e74c3c';
            authFeedback.textContent = err.message || 'Failed to update password';
          }
        } finally {
          btn.disabled = false;
          btn.textContent = 'Update Password & Log In';
        }
      });
    }

    // 5. Logout
    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        await handleSignOut();
        if (typeof window.showToast === 'function') {
          window.showToast('Logged out of Admin CMS');
        }
        switchAuthView('login');
      });
    }
  }

  async function initAuth() {
    initSupabase();
    setupPasswordToggles();
    setupAuthFormListeners();
    refreshLucideIcons();

    if (!supabaseClient) {
      console.warn('[Admin Auth] Running without Supabase client, allowing local preview.');
      renderAuthState({ email: 'local-preview@hairvalley.com' });
      return;
    }

    // Check URL parameters for password recovery or error
    const hash = window.location.hash || '';
    const query = window.location.search || '';
    const isRecoveryUrl = hash.includes('type=recovery') || query.includes('type=recovery');
    const isErrorUrl = hash.includes('error=') || query.includes('error=');

    if (isErrorUrl) {
      const authFeedback = document.getElementById('authFeedbackMessage');
      let errDesc = 'The recovery link is invalid or has expired. Please request a new one.';
      try {
        const params = new URLSearchParams(query || hash.replace('#', '?'));
        const desc = params.get('error_description') || params.get('error');
        if (desc) errDesc = desc.replace(/\+/g, ' ');
      } catch (e) {}

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, document.title, window.location.pathname);
      }

      isRecoveryActive = false;
      renderAuthState(null);
      switchAuthView('forgot');
      if (authFeedback) {
        authFeedback.style.color = '#e74c3c';
        authFeedback.textContent = errDesc;
      }
      return;
    }

    if (isRecoveryUrl) {
      isRecoveryActive = true;
    }

    // Check existing session
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentSession = session;
    if (session && session.user) {
      currentUser = session.user;
      if (!recoveryEmail) recoveryEmail = session.user.email;
    }

    renderAuthState(currentUser);

    // Subscribe to session & auth changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
      console.log(`[Admin Auth] Auth event: ${event}`);
      currentSession = session;
      if (session && session.user) {
        currentUser = session.user;
        if (!recoveryEmail) recoveryEmail = session.user.email;
      }

      if (event === 'PASSWORD_RECOVERY') {
        isRecoveryActive = true;
      }

      if (isRecoveryActive) {
        renderAuthState(currentUser);
        return;
      }

      renderAuthState(session ? session.user : null);
      if (event === 'SIGNED_IN' && typeof window.fetchContent === 'function') {
        window.fetchContent();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', initAuth);

  window.AdminAuth = {
    login: handleLogin,
    logout: handleSignOut,
    switchView: switchAuthView,
    getUser: () => currentUser,
    getSession: () => currentSession
  };
})();
