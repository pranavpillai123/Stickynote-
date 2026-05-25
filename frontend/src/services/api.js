const API_BASE = '/api';

/**
 * Shared fetch wrapper that always includes credentials (cookies)
 * so Flask session authentication works across origins in dev mode.
 */
async function apiFetch(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    credentials: 'include',
    ...options,
  });
  return res;
}

export const api = {
  // ── Auth ──
  async login(username, password) {
    const res = await apiFetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data;
  },

  async sendOTP(username, email, phoneNumber) {
    const res = await apiFetch('/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, phone_number: phoneNumber }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
    return data;
  },

  async register(username, email, password, phoneNumber, otp) {
    const res = await apiFetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, phone_number: phoneNumber, otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data;
  },

  async logout() {
    await apiFetch('/logout', { method: 'POST' });
  },

  async deleteAccount() {
    const res = await apiFetch('/account', {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete account');
    return data;
  },

  async getMe() {
    const res = await apiFetch('/me');
    return res.json();
  },

  // ── Notes ──
  async getNotes() {
    const res = await apiFetch('/notes');
    if (!res.ok) throw new Error('Failed to load notes');
    return res.json();
  },

  async saveNotes(notes) {
    const res = await apiFetch('/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notes),
    });
    if (!res.ok) throw new Error('Failed to save notes');
    return res.json();
  },
};
