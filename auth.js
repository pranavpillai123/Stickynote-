/* =============================================
   StickyBoard — Auth Page JavaScript
   ============================================= */

(() => {
  'use strict';

  // ── DOM Refs ──
  const loginWrapper = document.getElementById('login-form-wrapper');
  const registerWrapper = document.getElementById('register-form-wrapper');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');
  const loginSubmitBtn = document.getElementById('login-submit-btn');
  const registerSubmitBtn = document.getElementById('register-submit-btn');
  const showRegisterBtn = document.getElementById('show-register');
  const showLoginBtn = document.getElementById('show-login');
  const toggleLoginPw = document.getElementById('toggle-login-pw');
  const toggleRegisterPw = document.getElementById('toggle-register-pw');
  const strengthFill = document.getElementById('strength-fill');
  const strengthLabel = document.getElementById('strength-label');
  const passwordStrength = document.getElementById('password-strength');
  const registerPasswordInput = document.getElementById('register-password');

  // ── Theme Toggling ──
  const THEME_KEY = 'stickyboard_theme';
  function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
  }

  const btnToggleTheme = document.getElementById('btn-toggle-theme');
  if (btnToggleTheme) {
    btnToggleTheme.addEventListener('click', toggleTheme);
  }
  loadTheme();

  // ── Check if already logged in ──
  async function checkAuth() {
    try {
      const res = await fetch('/api/me');
      const data = await res.json();
      if (data.authenticated) {
        window.location.href = '/app';
      }
    } catch {
      // Server not running, stay on login
    }
  }
  checkAuth();

  // ── Toggle between Login / Register ──
  showRegisterBtn.addEventListener('click', () => {
    loginWrapper.classList.add('hidden');
    registerWrapper.classList.remove('hidden');
    registerWrapper.style.animation = 'none';
    requestAnimationFrame(() => {
      registerWrapper.style.animation = '';
    });
    clearErrors();
  });

  showLoginBtn.addEventListener('click', () => {
    registerWrapper.classList.add('hidden');
    loginWrapper.classList.remove('hidden');
    loginWrapper.style.animation = 'none';
    requestAnimationFrame(() => {
      loginWrapper.style.animation = '';
    });
    clearErrors();
  });

  // ── Password Visibility Toggle ──
  function setupPasswordToggle(toggleBtn, inputId) {
    const input = document.getElementById(inputId);
    toggleBtn.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      toggleBtn.classList.toggle('showing', isPassword);
    });
  }

  setupPasswordToggle(toggleLoginPw, 'login-password');
  setupPasswordToggle(toggleRegisterPw, 'register-password');

  // ── Password Strength Meter ──
  registerPasswordInput.addEventListener('input', (e) => {
    const val = e.target.value;

    if (!val) {
      passwordStrength.classList.remove('visible');
      return;
    }

    passwordStrength.classList.add('visible');
    const score = calcPasswordStrength(val);

    const levels = [
      { max: 1, label: 'Weak', color: '#ef4444', width: '25%' },
      { max: 2, label: 'Fair', color: '#f59e0b', width: '50%' },
      { max: 3, label: 'Good', color: '#34d399', width: '75%' },
      { max: 5, label: 'Strong', color: '#22c55e', width: '100%' },
    ];

    const level = levels.find(l => score <= l.max) || levels[levels.length - 1];
    strengthFill.style.width = level.width;
    strengthFill.style.background = level.color;
    strengthLabel.textContent = level.label;
    strengthLabel.style.color = level.color;
  });

  function calcPasswordStrength(pw) {
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return score;
  }

  // ── Error Display ──
  function showError(el, message) {
    el.textContent = message;
    el.classList.add('visible');
  }

  function clearErrors() {
    loginError.textContent = '';
    loginError.classList.remove('visible');
    registerError.textContent = '';
    registerError.classList.remove('visible');
  }

  // ── Loading State ──
  function setLoading(btn, loading) {
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
  }

  // ── Login Submit ──
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
      showError(loginError, 'Please fill in all fields');
      return;
    }

    setLoading(loginSubmitBtn, true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // Success — redirect to app
        loginSubmitBtn.querySelector('.btn-text').textContent = 'Welcome back! ✨';
        setLoading(loginSubmitBtn, false);
        setTimeout(() => {
          window.location.href = '/app';
        }, 600);
      } else {
        showError(loginError, data.error || 'Login failed');
        setLoading(loginSubmitBtn, false);
        shakeInput('login-username-group');
      }
    } catch (err) {
      showError(loginError, 'Cannot connect to server. Make sure the backend is running.');
      setLoading(loginSubmitBtn, false);
    }
  });

  // ── Register Submit ──
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;

    if (!username || !email || !password) {
      showError(registerError, 'Please fill in all fields');
      return;
    }

    if (username.length < 3) {
      showError(registerError, 'Username must be at least 3 characters');
      shakeInput('register-username-group');
      return;
    }

    if (password.length < 6) {
      showError(registerError, 'Password must be at least 6 characters');
      shakeInput('register-password-group');
      return;
    }

    setLoading(registerSubmitBtn, true);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // Success — redirect to app
        registerSubmitBtn.querySelector('.btn-text').textContent = 'Account created! 🎉';
        setLoading(registerSubmitBtn, false);
        setTimeout(() => {
          window.location.href = '/app';
        }, 800);
      } else {
        showError(registerError, data.error || 'Registration failed');
        setLoading(registerSubmitBtn, false);
      }
    } catch (err) {
      showError(registerError, 'Cannot connect to server. Make sure the backend is running.');
      setLoading(registerSubmitBtn, false);
    }
  });

  // ── Shake Animation for invalid input ──
  function shakeInput(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.style.animation = 'shake 0.35s ease';
    setTimeout(() => { group.style.animation = ''; }, 350);
  }

  // Shake keyframes (injected once)
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-6px); }
      40% { transform: translateX(6px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }
  `;
  document.head.appendChild(style);

})();
