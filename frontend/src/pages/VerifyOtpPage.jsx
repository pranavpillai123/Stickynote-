import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../components/Toast';
import '../styles/login.css';

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToast();
  const { theme, toggleTheme } = useTheme();

  // Retrieve registration state
  const registrationData = location.state || {};
  const { username, email, password, phone_number, reminder_method, is_double_verification } = registrationData;

  // Current verification type: 'phone' or 'email'
  const [verificationType, setVerificationType] = useState(registrationData.verification_type || 'phone');
  // Track if we're on the second step of double verification
  const [phoneVerified, setPhoneVerified] = useState(false);

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);

  // Redirect to login if registration state is missing
  useEffect(() => {
    if (!username || !password) {
      navigate('/login');
      return;
    }
    // Must have at least one contact method
    if (!email && !phone_number) {
      navigate('/login');
    }
  }, [username, email, phone_number, password, navigate]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown === 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Focus the first input on load or when verification type changes
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [verificationType]);

  const handleOtpChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pasteData)) return;

    const newOtp = [...otp];
    for (let i = 0; i < pasteData.length; i++) {
      newOtp[i] = pasteData[i];
    }
    setOtp(newOtp);

    // Focus last filled or next empty input
    const focusIndex = Math.min(pasteData.length, 5);
    if (inputRefs.current[focusIndex]) {
      inputRefs.current[focusIndex].focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    const fullOtp = otp.join('');
    if (fullOtp.length < 6) {
      setError('Please enter all 6 digits of the OTP.');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Verify the OTP for the current channel
      const target = verificationType === 'phone' ? phone_number : email;
      await api.verifyOTP(fullOtp, verificationType, target);

      // Step 2: Check if we need to do a second verification (double verification for "both")
      if (is_double_verification && verificationType === 'phone' && !phoneVerified) {
        // Phone verified, now switch to email
        setPhoneVerified(true);
        setVerificationType('email');
        setOtp(['', '', '', '', '', '']);
        setCooldown(60);
        setError('');
        showToast('✅', 'Phone number verified! Now verify your email.');

        // Send the email OTP
        try {
          const sendData = await api.sendOTP(username, email, phone_number, 'email');
          if (sendData.simulated) {
            showToast('🔑', `Simulated Email OTP: ${sendData.otp}`);
          }
        } catch (sendErr) {
          setError(sendErr.message);
        }
        return;
      }

      // Final step: Register the account
      await api.register(username, email, password, phone_number, reminder_method);
      showToast('✨', 'Account created successfully!');
      navigate('/app');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      const data = await api.sendOTP(username, email, phone_number, verificationType);
      if (data.simulated) {
        showToast('🔑', `Simulated OTP: ${data.otp}`);
      } else {
        showToast(verificationType === 'phone' ? '📲' : '📧', 'OTP resent successfully!');
      }
      setCooldown(60);
      setOtp(['', '', '', '', '', '']);
      if (inputRefs.current[0]) inputRefs.current[0].focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  // Dynamic content based on verification type
  const isPhoneStep = verificationType === 'phone';
  const headerTitle = isPhoneStep ? 'Verify Phone Number' : 'Verify Email Address';
  const headerDesc = isPhoneStep
    ? 'We sent a verification code to WhatsApp:'
    : 'We sent a verification code to your email:';
  const targetDisplay = isPhoneStep ? phone_number : email;
  const headerIcon = isPhoneStep ? '📲' : '📧';
  const stepIndicator = is_double_verification
    ? (phoneVerified ? 'Step 2 of 2 — Email Verification' : 'Step 1 of 2 — Phone Verification')
    : null;

  return (
    <>
      <style>{`
        .otp-digit-input {
          width: 46px;
          height: 52px;
          font-size: 1.5rem;
          font-weight: 700;
          text-align: center;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-color);
          background: var(--bg-primary);
          color: var(--text-primary);
          outline: none;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .otp-digit-input:focus {
          border-color: var(--accent-primary) !important;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.25) !important;
          transform: translateY(-2px);
          background: var(--bg-secondary) !important;
        }
        .step-indicator {
          display: inline-block;
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(244, 114, 182, 0.15));
          color: var(--accent-primary);
          font-size: 0.8rem;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 20px;
          margin-bottom: 12px;
          letter-spacing: 0.3px;
        }
      `}</style>

      <div className="bg-orbs" aria-hidden="true">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        <div className="orb orb-4"></div>
      </div>

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

      <main className="auth-container" id="auth-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <section className="auth-forms" style={{ width: '100%', maxWidth: '480px', flex: 'unset', padding: '40px' }}>
          <div className="form-wrapper" style={{ animation: 'fadeInUp 0.6s ease' }}>
            <div className="form-header" style={{ textAlign: 'center' }}>
              <div className="brand-logo" style={{ justifyContent: 'center', marginBottom: '16px' }}>
                <svg width="48" height="48" viewBox="0 0 28 28" fill="none">
                  <rect x="2" y="2" width="24" height="24" rx="6" fill="url(#logoGrad)" />
                  <rect x="6" y="8" width="16" height="2" rx="1" fill="#fff" opacity=".7" />
                  <rect x="6" y="13" width="12" height="2" rx="1" fill="#fff" opacity=".5" />
                  <rect x="6" y="18" width="8" height="2" rx="1" fill="#fff" opacity=".3" />
                  <defs>
                    <linearGradient id="logoGrad" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#7c3aed" />
                      <stop offset="1" stopColor="#f472b6" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              {stepIndicator && (
                <div className="step-indicator">{stepIndicator}</div>
              )}
              <h2>{headerTitle}</h2>
              <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
                {headerDesc}<br />
                <strong style={{ color: 'var(--text-primary)', display: 'inline-block', marginTop: '4px' }}>{targetDisplay}</strong>
              </p>
            </div>

            <form onSubmit={handleVerify} style={{ marginTop: '30px' }}>
              <div className="input-group">
                <label style={{ textAlign: 'center', display: 'block', marginBottom: '12px' }}>Enter 6-Digit OTP</label>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (inputRefs.current[idx] = el)}
                      type="text"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      onPaste={handlePaste}
                      className="otp-digit-input"
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="form-error visible" role="alert" style={{ marginTop: '20px', textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <button type="submit" className={`btn-auth${loading ? ' loading' : ''}`} style={{ marginTop: '30px' }} disabled={loading}>
                <span className="btn-text">
                  {is_double_verification && !phoneVerified
                    ? 'Verify & Continue'
                    : 'Verify & Register'}
                </span>
                <span className="btn-loader" aria-hidden="true"></span>
              </button>
            </form>

            <div className="form-footer" style={{ textAlign: 'center', marginTop: '24px' }}>
              <p style={{ color: 'var(--text-secondary)' }}>
                Didn't receive the code?{' '}
                {cooldown > 0 ? (
                  <span style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>Resend in {cooldown}s</span>
                ) : (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={handleResend}
                    disabled={resending}
                    style={{ fontWeight: '700', textDecoration: 'underline' }}
                  >
                    {resending ? 'Resending...' : 'Resend Code'}
                  </button>
                )}
              </p>
              <button
                type="button"
                className="link-btn"
                onClick={() => navigate('/login')}
                style={{ marginTop: '16px', fontSize: '0.85rem' }}
              >
                Back to Sign In / Register
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
