import { formatDate, getReminderInfo } from '../utils/constants';

export default function NoteCard({ note, index, onEdit, onDelete, onColorPick }) {
  const reminderInfo = getReminderInfo(note.reminderAt);

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', note.id);
    e.currentTarget.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
  };

  return (
    <div
      className="note-card"
      data-id={note.id}
      data-color={note.color}
      style={{ animationDelay: `${index * 0.05}s` }}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDoubleClick={() => onEdit(note.id)}
    >
      <div className="note-header">
        {/* React auto-escapes text content — no manual escapeHtml needed */}
        <div className="note-title">{note.title}</div>
        <div className="note-actions">
          <button
            className="note-action-btn edit-btn"
            title="Edit note"
            onClick={(e) => { e.stopPropagation(); onEdit(note.id); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            className="note-action-btn color-btn"
            title="Change color"
            onClick={(e) => { e.stopPropagation(); onColorPick(note.id, e.currentTarget); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          </button>
          <button
            className="note-action-btn delete-btn"
            title="Delete note"
            onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {reminderInfo && (
        <div className={`note-reminder-badge ${reminderInfo.className}`}>
          {reminderInfo.text}
        </div>
      )}

      {/* Use CSS white-space: pre-wrap instead of dangerouslySetInnerHTML */}
      <div
        className="note-body"
        style={{
          fontFamily: note.font || 'Caveat',
          fontWeight: (note.font === 'Caveat' || note.font === 'Patrick Hand') ? '700' : '600'
        }}
      >
        {note.content}
      </div>

      <div className="note-footer">
        <span className="note-date">{formatDate(note.updatedAt)}</span>
      </div>
    </div>
  );
}
