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

  async sendOTP(username, email, phoneNumber, channel = 'phone') {
    const res = await apiFetch('/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        email: email || '',
        phone_number: phoneNumber || '',
        channel,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
    return data;
  },

  async verifyOTP(otp, channel = 'phone', target = '') {
    const res = await apiFetch('/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp, channel, target }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'OTP verification failed');
    return data;
  },

  async register(username, email, password, phoneNumber, reminderMethod = 'whatsapp') {
    const res = await apiFetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        email: email || '',
        password,
        phone_number: phoneNumber || '',
        reminder_method: reminderMethod,
      }),
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

  // ── Reminder Settings ──
  async getReminderSettings() {
    const res = await apiFetch('/reminder-settings');
    if (!res.ok) throw new Error('Failed to load reminder settings');
    return res.json();
  },

  async toggleReminderSetting(reminderMethod) {
    const res = await apiFetch('/reminder-settings/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminder_method: reminderMethod }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update reminder settings');
    return data;
  },
};
