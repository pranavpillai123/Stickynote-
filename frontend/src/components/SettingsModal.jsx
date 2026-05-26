import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useToast } from './Toast';

export default function SettingsModal({ visible, onClose, onDeleteAccount, username }) {
  const showToast = useToast();

  // ── Reminder Settings State ──
  const [reminderSettings, setReminderSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [togglingMethod, setTogglingMethod] = useState('');

  // ── Inline Verification State ──
  const [verifyingChannel, setVerifyingChannel] = useState(null); // 'phone' or 'email'
  const [verifyTarget, setVerifyTarget] = useState('');
  const [verifyCountryCode, setVerifyCountryCode] = useState('+91');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef([]);

  // Load reminder settings when modal opens
  useEffect(() => {
    if (visible) {
      loadReminderSettings();
    }
  }, [visible]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const loadReminderSettings = async () => {
    setLoadingSettings(true);
    try {
      const data = await api.getReminderSettings();
      setReminderSettings(data);
    } catch (err) {
      console.error('Failed to load reminder settings', err);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleToggleMethod = async (newMethod) => {
    if (!reminderSettings) return;
    setTogglingMethod(newMethod);
    try {
      const result = await api.toggleReminderSetting(newMethod);
      setReminderSettings((prev) => ({ ...prev, reminder_method: result.reminder_method }));
      showToast('✅', `Reminder method updated to ${newMethod}`);
    } catch (err) {
      // Check if verification is needed
      if (err.message.includes('must be verified')) {
        const needVerify = err.message.includes('Phone') ? 'phone' : 'email';
        startInlineVerification(needVerify);
      } else {
        showToast('❌', err.message);
      }
    } finally {
      setTogglingMethod('');
    }
  };

  const startInlineVerification = (channel) => {
    setVerifyingChannel(channel);
    setVerifyTarget('');
    setOtpSent(false);
    setOtp(['', '', '', '', '', '']);
    setVerifyError('');
    setCooldown(0);
  };

  const cancelInlineVerification = () => {
    setVerifyingChannel(null);
    setVerifyTarget('');
    setOtpSent(false);
    setOtp(['', '', '', '', '', '']);
    setVerifyError('');
    setCooldown(0);
  };

  const handleSendVerificationOTP = async () => {
    setVerifyError('');
    if (!verifyTarget.trim()) {
      setVerifyError(verifyingChannel === 'phone' ? 'Please enter your phone number' : 'Please enter your email address');
      return;
    }

    setVerifyLoading(true);
    try {
      const phoneVal = verifyingChannel === 'phone' ? verifyCountryCode + verifyTarget : '';
      const emailVal = verifyingChannel === 'email' ? verifyTarget : '';
      const data = await api.sendOTP(username, emailVal, phoneVal, verifyingChannel);
      setOtpSent(true);
      setCooldown(60);
      if (data.simulated) {
        showToast('🔑', `Simulated OTP: ${data.otp}`);
      } else {
        showToast(verifyingChannel === 'phone' ? '📲' : '📧', 'OTP sent!');
      }
      setTimeout(() => {
        if (otpRefs.current[0]) otpRefs.current[0].focus();
      }, 100);
    } catch (err) {
      setVerifyError(err.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setVerifyError('');
    const fullOtp = otp.join('');
    if (fullOtp.length < 6) {
      setVerifyError('Please enter all 6 digits');
      return;
    }

    setVerifyLoading(true);
    try {
      const fullTarget = verifyingChannel === 'phone' ? verifyCountryCode + verifyTarget : verifyTarget;
      await api.verifyOTP(fullOtp, verifyingChannel, fullTarget);
      showToast('✅', `${verifyingChannel === 'phone' ? 'Phone number' : 'Email'} verified successfully!`);
      cancelInlineVerification();
      // Reload settings to reflect the newly verified channel
      await loadReminderSettings();
    } catch (err) {
      setVerifyError(err.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1].focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };

  if (!visible) return null;

  const currentMethod = reminderSettings?.reminder_method || 'whatsapp';
  const isWhatsappActive = currentMethod === 'whatsapp' || currentMethod === 'both';
  const isEmailActive = currentMethod === 'email' || currentMethod === 'both';

  return (
    <div
      className={`modal-overlay${visible ? ' visible' : ''}`}
      id="settings-modal"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
      style={{ zIndex: 1050 }}
    >
      <div className="modal" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h2 id="modal-title">Settings</h2>
          <button className="modal-close-btn" id="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body" style={{ gap: '20px' }}>
          {/* Profile Info */}
          <div className="settings-section">
            <h3 className="settings-section-title">Profile Info</h3>
            <div className="settings-row">
              <div className="settings-info">
                <span className="settings-label">Username</span>
                <span className="settings-desc">Your unique account username</span>
              </div>
              <span className="settings-username-value">
                {username || 'User'}
              </span>
            </div>
          </div>

          {/* Reminder Settings */}
          <div className="settings-section">
            <h3 className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              Reminder Settings
            </h3>

            {loadingSettings ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Loading settings...</div>
            ) : reminderSettings && !verifyingChannel ? (
              <>
                {/* WhatsApp Toggle */}
                <div className="settings-row" style={{ padding: '14px 0' }}>
                  <div className="settings-info">
                    <span className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      WhatsApp Reminders
                    </span>
                    <span className="settings-desc">
                      {reminderSettings.phone_number
                        ? (reminderSettings.is_phone_verified
                          ? `Verified: ${reminderSettings.phone_number}`
                          : `Not verified: ${reminderSettings.phone_number}`)
                        : 'No phone number set'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {!reminderSettings.is_phone_verified && (
                      <button
                        className="link-btn"
                        onClick={() => startInlineVerification('phone')}
                        style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--accent-primary)' }}
                      >
                        {reminderSettings.phone_number ? 'Verify' : 'Add & Verify'}
                      </button>
                    )}
                    <label className="toggle-switch" style={{ position: 'relative', width: '44px', height: '24px' }}>
                      <input
                        type="checkbox"
                        checked={isWhatsappActive}
                        onChange={() => {
                          if (isWhatsappActive) {
                            // Turn off WhatsApp — switch to email only (if email active) or just whatsapp off
                            if (isEmailActive) {
                              handleToggleMethod('email');
                            } else {
                              showToast('⚠️', 'At least one reminder channel must be active');
                            }
                          } else {
                            // Turn on WhatsApp
                            if (isEmailActive) {
                              handleToggleMethod('both');
                            } else {
                              handleToggleMethod('whatsapp');
                            }
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                      <span
                        style={{
                          position: 'absolute', inset: 0, cursor: 'pointer', borderRadius: '24px',
                          background: isWhatsappActive ? '#25d366' : 'var(--border-color)',
                          transition: 'background 0.3s',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute', left: isWhatsappActive ? '22px' : '2px', top: '2px',
                            width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                            transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }}
                        />
                      </span>
                    </label>
                  </div>
                </div>

                {/* Email Toggle */}
                <div className="settings-row" style={{ padding: '14px 0' }}>
                  <div className="settings-info">
                    <span className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      Email Reminders
                    </span>
                    <span className="settings-desc">
                      {reminderSettings.email
                        ? (reminderSettings.is_email_verified
                          ? `Verified: ${reminderSettings.email}`
                          : `Not verified: ${reminderSettings.email}`)
                        : 'No email set'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {!reminderSettings.is_email_verified && (
                      <button
                        className="link-btn"
                        onClick={() => startInlineVerification('email')}
                        style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--accent-primary)' }}
                      >
                        {reminderSettings.email ? 'Verify' : 'Add & Verify'}
                      </button>
                    )}
                    <label className="toggle-switch" style={{ position: 'relative', width: '44px', height: '24px' }}>
                      <input
                        type="checkbox"
                        checked={isEmailActive}
                        onChange={() => {
                          if (isEmailActive) {
                            // Turn off Email
                            if (isWhatsappActive) {
                              handleToggleMethod('whatsapp');
                            } else {
                              showToast('⚠️', 'At least one reminder channel must be active');
                            }
                          } else {
                            // Turn on Email
                            if (isWhatsappActive) {
                              handleToggleMethod('both');
                            } else {
                              handleToggleMethod('email');
                            }
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                      <span
                        style={{
                          position: 'absolute', inset: 0, cursor: 'pointer', borderRadius: '24px',
                          background: isEmailActive ? 'var(--accent-primary)' : 'var(--border-color)',
                          transition: 'background 0.3s',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute', left: isEmailActive ? '22px' : '2px', top: '2px',
                            width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                            transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }}
                        />
                      </span>
                    </label>
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px', fontStyle: 'italic' }}>
                  Current method: <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{currentMethod}</strong>
                </div>
              </>
            ) : verifyingChannel ? (
              /* ── Inline Verification UI ── */
              <div style={{ padding: '8px 0', animation: 'fadeInUp 0.3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '1.5rem' }}>{verifyingChannel === 'phone' ? '📲' : '📧'}</span>
                  <div>
                    <span className="settings-label">
                      Verify {verifyingChannel === 'phone' ? 'Phone Number' : 'Email Address'}
                    </span>
                    <span className="settings-desc">
                      {otpSent ? 'Enter the OTP sent to your ' + (verifyingChannel === 'phone' ? 'WhatsApp' : 'email') : 'Enter your ' + (verifyingChannel === 'phone' ? 'phone number' : 'email address')}
                    </span>
                  </div>
                </div>

                {!otpSent ? (
                  <>
                    {verifyingChannel === 'phone' ? (
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <select
                          value={verifyCountryCode}
                          onChange={(e) => setVerifyCountryCode(e.target.value)}
                          style={{
                            padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)',
                            background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.9rem',
                            width: '90px'
                          }}
                        >
                          <option value="+91">+91</option>
                          <option value="+1">+1</option>
                          <option value="+44">+44</option>
                          <option value="+971">+971</option>
                          <option value="+61">+61</option>
                          <option value="+81">+81</option>
                          <option value="+49">+49</option>
                          <option value="+33">+33</option>
                          <option value="+65">+65</option>
                        </select>
                        <input
                          type="tel"
                          placeholder="Phone number"
                          value={verifyTarget}
                          onChange={(e) => setVerifyTarget(e.target.value.replace(/\D/g, ''))}
                          style={{
                            flex: 1, padding: '8px 12px', borderRadius: '8px',
                            border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', fontSize: '0.9rem',
                          }}
                        />
                      </div>
                    ) : (
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={verifyTarget}
                        onChange={(e) => setVerifyTarget(e.target.value)}
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px',
                          border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                          color: 'var(--text-primary)', fontSize: '0.9rem', boxSizing: 'border-box',
                        }}
                      />
                    )}
                    <button
                      className="btn-auth"
                      onClick={handleSendVerificationOTP}
                      disabled={verifyLoading}
                      style={{ padding: '10px', fontSize: '0.9rem' }}
                    >
                      <span className="btn-text">{verifyLoading ? 'Sending...' : 'Send OTP'}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                      {otp.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => (otpRefs.current[idx] = el)}
                          type="text"
                          maxLength="1"
                          value={digit}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          style={{
                            width: '40px', height: '46px', fontSize: '1.3rem', fontWeight: 700,
                            textAlign: 'center', borderRadius: '8px', border: '1px solid var(--border-color)',
                            background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none',
                            transition: 'all 0.2s',
                          }}
                        />
                      ))}
                    </div>
                    <button
                      className="btn-auth"
                      onClick={handleVerifyOTP}
                      disabled={verifyLoading}
                      style={{ padding: '10px', fontSize: '0.9rem' }}
                    >
                      <span className="btn-text">{verifyLoading ? 'Verifying...' : 'Verify'}</span>
                    </button>
                    <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {cooldown > 0 ? (
                        <span>Resend in <strong style={{ color: 'var(--accent-primary)' }}>{cooldown}s</strong></span>
                      ) : (
                        <button className="link-btn" onClick={handleSendVerificationOTP} disabled={verifyLoading} style={{ fontSize: '0.8rem', fontWeight: '600' }}>
                          Resend OTP
                        </button>
                      )}
                    </div>
                  </>
                )}

                {verifyError && (
                  <div className="form-error visible" role="alert" style={{ marginTop: '12px', fontSize: '0.85rem', textAlign: 'center' }}>
                    {verifyError}
                  </div>
                )}

                <button
                  className="link-btn"
                  onClick={cancelInlineVerification}
                  style={{ display: 'block', margin: '14px auto 0', fontSize: '0.8rem' }}
                >
                  ← Back to settings
                </button>
              </div>
            ) : null}
          </div>

          {/* Danger Zone */}
          <div className="settings-section settings-danger-section">
            <h3 className="settings-section-title settings-danger-title">Danger Zone</h3>
            <div className="settings-row danger-row">
              <div className="settings-info">
                <span className="settings-label settings-danger-label">Delete Account</span>
                <span className="settings-desc">Permanently delete your profile and all notes. This cannot be undone.</span>
              </div>
              <button 
                className="btn-danger settings-delete-btn" 
                onClick={() => {
                  onClose();
                  onDeleteAccount();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete Account
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '14px 24px' }}>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
