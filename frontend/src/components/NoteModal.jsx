import { useState, useEffect, useRef } from 'react';
import { COLORS, FONTS } from '../utils/constants';
import DateTimePicker from './DateTimePicker';

export default function NoteModal({ visible, editingNote, onSave, onClose }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState('yellow');
  const [font, setFont] = useState('Caveat');
  const [shakeTitle, setShakeTitle] = useState(false);
  const [shakeReminder, setShakeReminder] = useState(false);
  const [reminderAt, setReminderAt] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    if (visible) {
      if (editingNote) {
        setTitle(editingNote.title || '');
        setContent(editingNote.content || '');
        setColor(editingNote.color || 'yellow');
        setFont(editingNote.font || 'Caveat');
        setReminderAt(editingNote.reminderAt || null);
      } else {
        setTitle('');
        setContent('');
        setColor('yellow');
        setFont('Caveat');
        setReminderAt(null);
      }

      setTimeout(() => {
        titleRef.current?.focus();
      }, 200);
    }
  }, [visible, editingNote]);

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  };

  const handleSave = () => {
    if (reminderAt && new Date(reminderAt) <= new Date()) {
      setShakeReminder(true);
      setTimeout(() => setShakeReminder(false), 300);
      return;
    }

    if (!title.trim() && !content.trim()) {
      setShakeTitle(true);
      setTimeout(() => setShakeTitle(false), 300);
      return;
    }

    onSave({ title, content, color, font, reminderAt });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSave();
  };

  if (!visible) return null;

  return (
    <div
      className={`modal-overlay${visible ? ' visible' : ''}`}
      id="note-modal"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div className="modal">
        <div className="modal-header">
          <h2 id="modal-title">{editingNote ? 'Edit Note' : 'New Note'}</h2>
          <button className="modal-close-btn" id="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="modal-field" style={shakeTitle ? { animation: 'shake 0.3s ease' } : {}}>
            <label htmlFor="modal-note-title">Title</label>
            <input
              ref={titleRef}
              type="text"
              id="modal-note-title"
              placeholder="Give your note a title…"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="modal-field">
            <label htmlFor="modal-note-content">Content</label>
            <textarea
              id="modal-note-content"
              placeholder="Write your note here…"
              maxLength={2000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{
                fontFamily: font,
                fontWeight: font === 'Caveat' || font === 'Patrick Hand' ? '700' : '600'
              }}
            />
          </div>

          <div className="modal-field">
            <label htmlFor="modal-note-font">Font Style</label>
            <select
              id="modal-note-font"
              value={font}
              onChange={(e) => setFont(e.target.value)}
              className="modal-font-select"
              style={{
                fontFamily: font,
                fontWeight: font === 'Caveat' || font === 'Patrick Hand' ? '700' : '600'
              }}
            >
              {FONTS.map((f) => (
                <option key={f.name} value={f.name} style={{ fontFamily: f.name }}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="modal-field" style={shakeReminder ? { animation: 'shake 0.3s ease' } : {}}>
            <label htmlFor="modal-note-reminder">Reminder (Optional)</label>
            <input
              type="text"
              id="modal-note-reminder"
              placeholder="Select date and time"
              autoComplete="off"
              value={formatDisplayDate(reminderAt)}
              onClick={() => setPickerOpen(true)}
              readOnly
              style={{ cursor: 'pointer' }}
            />
          </div>

          <div className="modal-field">
            <label>Color</label>
            <div className="modal-colors" id="modal-colors">
              {COLORS.map((c) => (
                <div
                  key={c.name}
                  className={`modal-color-option${color === c.name ? ' selected' : ''}`}
                  data-color={c.name}
                  style={{ background: c.hex }}
                  title={c.name}
                  onClick={() => setColor(c.name)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" id="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="btn-save" id="modal-save-btn" onClick={handleSave}>
            {editingNote ? 'Save Changes' : 'Create Note'}
          </button>
        </div>
      </div>

      <DateTimePicker
        visible={pickerOpen}
        currentValue={reminderAt}
        onApply={(date) => {
          setReminderAt(date.toISOString());
          setPickerOpen(false);
        }}
        onClear={() => {
          setReminderAt(null);
          setPickerOpen(false);
        }}
        onCancel={() => {
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
