export const COLORS = [
  { name: 'yellow', hex: '#fde68a' },
  { name: 'pink',   hex: '#f9a8d4' },
  { name: 'blue',   hex: '#93c5fd' },
  { name: 'green',  hex: '#6ee7b7' },
  { name: 'purple', hex: '#c4b5fd' },
  { name: 'orange', hex: '#fdba74' },
  { name: 'teal',   hex: '#5eead4' },
  { name: 'rose',   hex: '#fda4af' },
];

export const FONTS = [
  { name: 'Caveat', label: 'Caveat (Handwritten)' },
  { name: 'Patrick Hand', label: 'Patrick Hand' },
  { name: 'Inter', label: 'Inter (Clean)' },
  { name: 'Poppins', label: 'Poppins' },
  { name: 'Roboto', label: 'Roboto' },
  { name: 'Lora', label: 'Lora (Serif)' },
  { name: 'Nunito', label: 'Nunito' },
];

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function formatDate(timestamp) {
  if (!timestamp) return 'Invalid Date';
  
  let val = timestamp;
  if (typeof timestamp === 'string' && /^\d+$/.test(timestamp)) {
    val = parseInt(timestamp, 10);
  } else if (typeof timestamp === 'string') {
    const parsed = Number(timestamp);
    if (!isNaN(parsed) && timestamp.trim() !== '') {
      val = parsed;
    }
  }

  const d = new Date(val);
  if (isNaN(d.getTime())) return 'Invalid Date';
  
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function getReminderInfo(reminderAt) {
  if (!reminderAt) return null;
  const now = Date.now();
  const remTime = new Date(reminderAt).getTime();
  const diff = remTime - now;

  if (diff <= 0) {
    return { text: '⚠️ Expired', className: 'expired' };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / 1000 / 60) % 60);

  let timeStr = '';
  if (days > 0) timeStr = `${days}d ${hours}h left`;
  else if (hours > 0) timeStr = `${hours}h ${mins}m left`;
  else timeStr = `${mins}m left`;

  return { text: `⏰ ${timeStr}`, className: 'active' };
}
