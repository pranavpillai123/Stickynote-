export default function ConfirmDialog({ 
  visible, 
  onConfirm, 
  onCancel, 
  title = "Delete this note?", 
  message = "This action cannot be undone.", 
  confirmText = "Delete" 
}) {
  if (!visible) return null;

  return (
    <div
      className={`confirm-overlay${visible ? ' visible' : ''}`}
      id="confirm-delete"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="confirm-dialog">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="btn-secondary" id="confirm-cancel-btn" onClick={onCancel}>Cancel</button>
          <button className="btn-danger" id="confirm-delete-btn" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
