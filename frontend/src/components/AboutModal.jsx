import { useEffect } from 'react';

export default function AboutModal({ visible, onClose }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };

  if (!visible) return null;

  return (
    <div
      className={`modal-overlay${visible ? ' visible' : ''}`}
      id="about-modal"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
      style={{ zIndex: 1060 }}
    >
      <div className="modal" style={{ maxWidth: '460px', animation: 'modalEnter 0.3s var(--transition-bounce)' }}>
        <div className="modal-header">
          <h2 id="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            About Me
          </h2>
          <button className="modal-close-btn" id="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body" style={{ gap: '20px', padding: '20px 24px' }}>
          <p style={{
            fontSize: '1rem',
            lineHeight: '1.6',
            color: 'var(--text-primary)',
            margin: 0,
            fontWeight: '600',
            fontFamily: 'var(--font-primary)',
            letterSpacing: '-0.1px',
            textAlign: 'justify'
          }}>
            I am Pranav, a student who is currently learning programming and passionate about exploring new technologies. I built this project entirely using Antigravity, which marks my first experience developing with this platform. If you have any questions or queries, please feel free to reach out to me via email at <a href="mailto:boardsticky1@gmail.com" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: '700' }}>boardsticky1@gmail.com</a>.
          </p>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginTop: '8px',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '16px'
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Connect:</span>
            <a
              href="https://github.com/pranavpillai123"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub Profile"
              style={{
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                transition: 'color var(--transition-fast), transform var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.transform = 'scale(1.18)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/in/pranav-pillai-b0a154328/"
              target="_blank"
              rel="noopener noreferrer"
              title="LinkedIn Profile"
              style={{
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                transition: 'color var(--transition-fast), transform var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#0077b5'; e.currentTarget.style.transform = 'scale(1.18)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect x="2" y="9" width="4" height="12" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '14px 24px' }}>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
