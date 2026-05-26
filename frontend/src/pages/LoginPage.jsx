import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../components/Toast';
import '../styles/login.css';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCountryCode, setRegCountryCode] = useState('+91');
  const [regPhone, setRegPhone] = useState('');
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);
  const [shakeField, setShakeField] = useState('');
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const showToast = useToast();

  // Reminder preference state
  const [showReminderPrompt, setShowReminderPrompt] = useState(false);
  const [reminderMethod, setReminderMethod] = useState('');

  // Check if already logged in
  useEffect(() => {
    api.getMe().then((data) => {
      if (data.authenticated) navigate('/app');
    }).catch(() => {});
  }, [navigate]);

  const calcPasswordStrength = (pw) => {
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return score;
  };

  const getStrengthInfo = (score) => {
    const levels = [
      { max: 1, label: 'Weak', color: '#ef4444', width: '25%' },
      { max: 2, label: 'Fair', color: '#f59e0b', width: '50%' },
      { max: 3, label: 'Good', color: '#34d399', width: '75%' },
      { max: 5, label: 'Strong', color: '#22c55e', width: '100%' },
    ];
    return levels.find((l) => score <= l.max) || levels[levels.length - 1];
  };

  const shake = (field) => {
    setShakeField(field);
    setTimeout(() => setShakeField(''), 350);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!loginUsername || !loginPassword) {
      setLoginError('Please fill in all fields');
      return;
    }
    setLoginLoading(true);
    try {
      await api.login(loginUsername, loginPassword);
      navigate('/app');
    } catch (err) {
      setLoginError(err.message);
      shake('login-username-group');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterError('');

    if (!regUsername) {
      setRegisterError('Username is required');
      shake('register-username-group');
      return;
    }
    if (!regEmail && !regPhone) {
      setRegisterError('Please provide at least one: email or phone number');
      return;
    }
    if (regUsername.length < 3) {
      setRegisterError('Username must be at least 3 characters');
      shake('register-username-group');
      return;
    }
    if (regPassword.length < 6) {
      setRegisterError('Password must be at least 6 characters');
      shake('register-password-group');
      return;
    }
    if (regPhone && regPhone.length < 7) {
      setRegisterError('Phone number must be at least 7 digits');
      shake('register-phone-group');
      return;
    }

    const fullPhone = regPhone ? regCountryCode + regPhone : '';

    // If both email and phone are provided, show reminder method prompt
    if (regEmail && regPhone && !reminderMethod && !showReminderPrompt) {
      setShowReminderPrompt(true);
      return;
    }

    // Determine reminder method
    let method = reminderMethod;
    if (!method) {
      if (regEmail && regPhone) method = 'both';
      else if (regPhone) method = 'whatsapp';
      else method = 'email';
    }

    // Determine first verification channel
    let firstChannel = 'phone';
    let isDoubleVerification = false;

    if (method === 'whatsapp') {
      firstChannel = 'phone';
    } else if (method === 'email') {
      firstChannel = 'email';
    } else if (method === 'both') {
      firstChannel = 'phone';
      isDoubleVerification = true;
    }

    setRegisterLoading(true);
    try {
      const data = await api.sendOTP(regUsername, regEmail, fullPhone, firstChannel);
      if (data.simulated) {
        showToast('🔑', `Simulated OTP: ${data.otp}`);
      }
      navigate('/verify-otp', {
        state: {
          username: regUsername,
          email: regEmail,
          password: regPassword,
          phone_number: fullPhone,
          reminder_method: method,
          verification_type: firstChannel,
          is_double_verification: isDoubleVerification,
        }
      });
    } catch (err) {
      setRegisterError(err.message);
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleReminderSelect = (method) => {
    setReminderMethod(method);
    setShowReminderPrompt(false);
    // Trigger submit after setting
    setTimeout(() => {
      document.getElementById('register-form')?.requestSubmit();
    }, 50);
  };

  const pwStrength = calcPasswordStrength(regPassword);
  const strengthInfo = getStrengthInfo(pwStrength);

  return (
    <>
      {/* Floating orbs background */}
      <div className="bg-orbs" aria-hidden="true">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        <div className="orb orb-4"></div>
      </div>

      {/* Theme toggle */}
      <div style={{ position: 'absolute', top: 24, right: 28, zIndex: 100 }}>
        <button
          className="btn-icon"
          id="btn-toggle-theme"
          title="Toggle dark/light mode"
          onClick={toggleTheme}
          style={{
            background: 'rgba(124, 58, 237, 0.1)',
            border: '1px solid rgba(124, 58, 237, 0.2)',
            color: 'var(--text-white)',
            borderRadius: '50%',
            width: 42,
            height: 42,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
        >
          <svg className="icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          <svg className="icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>
      </div>

      <main className="auth-container" id="auth-container">
        {/* Left panel — branding */}
        <section className="auth-branding" id="auth-branding">
          <div className="brand-content">
            <div className="brand-logo">
              <svg width="48" height="48" viewBox="0 0 28 28" fill="none">
                <rect x="2" y="2" width="24" height="24" rx="6" fill="url(#loginLogoGrad)" />
                <rect x="6" y="8" width="16" height="2" rx="1" fill="#fff" opacity=".7" />
                <rect x="6" y="13" width="12" height="2" rx="1" fill="#fff" opacity=".5" />
                <rect x="6" y="18" width="8" height="2" rx="1" fill="#fff" opacity=".3" />
                <defs>
                  <linearGradient id="loginLogoGrad" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#7c3aed" />
                    <stop offset="1" stopColor="#f472b6" />
                  </linearGradient>
                </defs>
              </svg>
              <h1>StickyBoard</h1>
            </div>
            <p className="brand-tagline">Capture ideas. Organize thoughts.<br />Stay brilliant.</p>
            <div className="brand-features">
              <div className="feature-item"><span className="feature-icon">✨</span><span>Beautiful drag-and-drop notes</span></div>
              <div className="feature-item"><span className="feature-icon">🎨</span><span>8 vibrant color themes</span></div>
              <div className="feature-item"><span className="feature-icon">🌙</span><span>Dark &amp; light modes</span></div>
              <div className="feature-item"><span className="feature-icon">🔍</span><span>Instant search</span></div>
            </div>
          </div>
          <div className="floating-notes" aria-hidden="true">
            <div className="float-note fn-1">Remember to buy groceries 🛒</div>
            <div className="float-note fn-2">Meeting at 3pm</div>
            <div className="float-note fn-3">Great idea! ✨</div>
          </div>
        </section>

        {/* Right panel — auth forms */}
        <section className="auth-forms" id="auth-forms">
          {/* LOGIN FORM */}
          {mode === 'login' && (
            <div className="form-wrapper" id="login-form-wrapper">
              <div className="form-header">
                <h2>Welcome back</h2>
                <p>Sign in to continue to your board</p>
              </div>

              <form id="login-form" autoComplete="on" onSubmit={handleLogin}>
                <div
                  className="input-group"
                  id="login-username-group"
                  style={shakeField === 'login-username-group' ? { animation: 'shake 0.35s ease' } : {}}
                >
                  <label htmlFor="login-username">Username or Email</label>
                  <div className="input-field">
                    <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                    <input type="text" id="login-username" name="username" placeholder="Enter your username or email" required autoComplete="username" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} />
                  </div>
                </div>

                <div className="input-group" id="login-password-group">
                  <label htmlFor="login-password">Password</label>
                  <div className="input-field">
                    <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input type={showLoginPw ? 'text' : 'password'} id="login-password" name="password" placeholder="Enter your password" required autoComplete="current-password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                    <button type="button" className={`toggle-password${showLoginPw ? ' showing' : ''}`} onClick={() => setShowLoginPw(!showLoginPw)} aria-label="Toggle password visibility">
                      <svg className="eye-open" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                      </svg>
                      <svg className="eye-closed" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div className="form-error visible" id="login-error" role="alert">{loginError}</div>
                )}

                <button type="submit" className={`btn-auth${loginLoading ? ' loading' : ''}`} id="login-submit-btn" disabled={loginLoading}>
                  <span className="btn-text">Sign In</span>
                  <span className="btn-loader" aria-hidden="true"></span>
                </button>
              </form>

              <div className="form-footer">
                <p>Don't have an account? <button type="button" className="link-btn" id="show-register" onClick={() => { setMode('register'); setLoginError(''); }}>Create one</button></p>
              </div>
            </div>
          )}

          {/* REGISTER FORM */}
          {mode === 'register' && (
            <div className="form-wrapper" id="register-form-wrapper">
              <div className="form-header">
                <h2>Create account</h2>
                <p>Start organizing your ideas today</p>
              </div>

              {/* Reminder preference prompt overlay */}
              {showReminderPrompt && (
                <div className="reminder-prompt-overlay" style={{
                  position: 'fixed', inset: 0, zIndex: 2000, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                }}>
                  <div style={{
                    background: 'var(--bg-card, #1a1a2e)', border: '1px solid var(--border, rgba(255,255,255,0.1))',
                    borderRadius: '16px', padding: '32px', maxWidth: '400px', width: '90%',
                    textAlign: 'center', animation: 'slideIn 0.4s ease',
                  }}>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-white)' }}>
                      📬 How would you like to receive reminders?
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '24px' }}>
                      You can change this later in Settings
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <button
                        className="btn-auth"
                        style={{ height: '46px', fontSize: '0.9rem' }}
                        onClick={() => handleReminderSelect('whatsapp')}
                      >
                        <span className="btn-text">📱 WhatsApp Only</span>
                      </button>
                      <button
                        className="btn-auth"
                        style={{ height: '46px', fontSize: '0.9rem', background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
                        onClick={() => handleReminderSelect('email')}
                      >
                        <span className="btn-text">📧 Email Only</span>
                      </button>
                      <button
                        className="btn-auth"
                        style={{ height: '46px', fontSize: '0.9rem', background: 'linear-gradient(135deg, #10b981, #059669)' }}
                        onClick={() => handleReminderSelect('both')}
                      >
                        <span className="btn-text">✨ Both Channels</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setShowReminderPrompt(false)}
                      style={{ marginTop: '18px', fontSize: '0.82rem' }}
                    >
                      ← Go back
                    </button>
                  </div>
                </div>
              )}

              <form id="register-form" autoComplete="on" onSubmit={handleRegister}>
                <div
                  className="input-group"
                  id="register-username-group"
                  style={shakeField === 'register-username-group' ? { animation: 'shake 0.35s ease' } : {}}
                >
                  <label htmlFor="register-username">Username</label>
                  <div className="input-field">
                    <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                    <input type="text" id="register-username" name="username" placeholder="Choose a username" required minLength={3} autoComplete="username" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} />
                  </div>
                </div>

                <div className="input-group" id="register-email-group">
                  <label htmlFor="register-email">Email <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'none', letterSpacing: 0 }}>(optional if phone provided)</span></label>
                  <div className="input-field">
                    <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <input type="email" id="register-email" name="email" placeholder="you@example.com" autoComplete="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
                  </div>
                </div>

                <div
                  className="input-group"
                  id="register-phone-group"
                  style={shakeField === 'register-phone-group' ? { animation: 'shake 0.35s ease' } : {}}
                >
                  <label htmlFor="register-phone">Phone Number <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'none', letterSpacing: 0 }}>(optional if email provided)</span></label>
                  <div className="input-field phone-input-field">
                    <select
                      id="register-country-code"
                      value={regCountryCode}
                      onChange={(e) => setRegCountryCode(e.target.value)}
                      className="country-code-select"
                    >
                      <option value="+91">+91 (IN)</option>
                      <option value="+1">+1 (US)</option>
                      <option value="+44">+44 (UK)</option>
                      <option value="+971">+971 (AE)</option>
                      <option value="+61">+61 (AU)</option>
                      <option value="+81">+81 (JP)</option>
                      <option value="+49">+49 (DE)</option>
                      <option value="+33">+33 (FR)</option>
                      <option value="+65">+65 (SG)</option>
                    </select>
                    <input
                      type="tel"
                      id="register-phone"
                      name="phone"
                      placeholder="Enter phone number"
                      autoComplete="tel-national"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>

                <div
                  className="input-group"
                  id="register-password-group"
                  style={shakeField === 'register-password-group' ? { animation: 'shake 0.35s ease' } : {}}
                >
                  <label htmlFor="register-password">Password</label>
                  <div className="input-field">
                    <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input type={showRegPw ? 'text' : 'password'} id="register-password" name="password" placeholder="Min. 6 characters" required minLength={6} autoComplete="new-password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
                    <button type="button" className={`toggle-password${showRegPw ? ' showing' : ''}`} onClick={() => setShowRegPw(!showRegPw)} aria-label="Toggle password visibility">
                      <svg className="eye-open" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                      </svg>
                      <svg className="eye-closed" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    </button>
                  </div>
                  {regPassword && (
                    <div className="password-strength visible" id="password-strength">
                      <div className="strength-bar">
                        <div className="strength-fill" id="strength-fill" style={{ width: strengthInfo.width, background: strengthInfo.color }} />
                      </div>
                      <span className="strength-label" id="strength-label" style={{ color: strengthInfo.color }}>{strengthInfo.label}</span>
                    </div>
                  )}
                </div>

                {registerError && (
                  <div className="form-error visible" id="register-error" role="alert">{registerError}</div>
                )}

                <button type="submit" className={`btn-auth${registerLoading ? ' loading' : ''}`} id="register-submit-btn" disabled={registerLoading}>
                  <span className="btn-text">Create Account</span>
                  <span className="btn-loader" aria-hidden="true"></span>
                </button>
              </form>

              <div className="form-footer">
                <p>Already have an account? <button type="button" className="link-btn" id="show-login" onClick={() => { setMode('login'); setRegisterError(''); setShowReminderPrompt(false); }}>Sign in</button></p>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
