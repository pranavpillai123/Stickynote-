import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../components/Toast';
import { generateId } from '../utils/constants';
import Header from '../components/Header';
import NoteCard from '../components/NoteCard';
import NoteModal from '../components/NoteModal';
import ConfirmDialog from '../components/ConfirmDialog';
import ColorPicker from '../components/ColorPicker';
import SettingsModal from '../components/SettingsModal';
import AboutModal from '../components/AboutModal';
import '../styles/dashboard.css';

export default function Dashboard() {
  const [notes, setNotes] = useState([]);
  const [username, setUsername] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [colorPicker, setColorPicker] = useState({ visible: false, noteId: null, position: { top: 0, left: 0 }, color: null });
  const { theme, toggleTheme } = useTheme();
  const showToast = useToast();
  const navigate = useNavigate();
  const boardRef = useRef(null);
  const [tick, setTick] = useState(0);

  // ── Sidebar and Sorting States ──
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return localStorage.getItem('stickyboard_sidebar_open') !== 'false';
  });
  const [activeCategory, setActiveCategory] = useState('all');

  const [notesSortBy, setNotesSortBy] = useState(() => localStorage.getItem('stickyboard_notes_sort_by') || 'custom');
  const [notesSortOrder, setNotesSortOrder] = useState(() => localStorage.getItem('stickyboard_notes_sort_order') || 'desc');
  const [remindersSortBy, setRemindersSortBy] = useState(() => localStorage.getItem('stickyboard_reminders_sort_by') || 'custom');
  const [remindersSortOrder, setRemindersSortOrder] = useState(() => localStorage.getItem('stickyboard_reminders_sort_order') || 'asc');

  // Sync sorting preferences to localStorage
  useEffect(() => {
    localStorage.setItem('stickyboard_notes_sort_by', notesSortBy);
  }, [notesSortBy]);
  useEffect(() => {
    localStorage.setItem('stickyboard_notes_sort_order', notesSortOrder);
  }, [notesSortOrder]);
  useEffect(() => {
    localStorage.setItem('stickyboard_reminders_sort_by', remindersSortBy);
  }, [remindersSortBy]);
  useEffect(() => {
    localStorage.setItem('stickyboard_reminders_sort_order', remindersSortOrder);
  }, [remindersSortOrder]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('stickyboard_sidebar_open', String(next));
      return next;
    });
  }, []);

  // ── Auto refresh relative times every 10 seconds ──
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // ── Load session & notes ──
  useEffect(() => {
    const loadSession = async () => {
      try {
        const me = await api.getMe();
        if (!me.authenticated) {
          navigate('/login');
          return;
        }
        setUsername(me.username);
        const notesData = await api.getNotes();
        setNotes(notesData);
      } catch {
        navigate('/login');
      }
    };
    loadSession();
  }, [navigate]);

  // ── Save notes to backend ──
  const saveNotes = useCallback(async (updatedNotes) => {
    setNotes(updatedNotes);
    try {
      await api.saveNotes(updatedNotes);
    } catch (err) {
      console.error('Failed to save notes', err);
    }
  }, []);

  // ── CRUD ──
  const handleCreateNote = useCallback(({ title, content, color, font, reminderAt }) => {
    const note = {
      id: generateId(),
      title: title.trim() || 'Untitled',
      content: content.trim(),
      color: color || 'yellow',
      font: font || 'Caveat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      reminderAt: reminderAt || null,
    };
    const updated = [note, ...notes];
    saveNotes(updated);
    showToast('✨', 'Note created!');
    setModalOpen(false);
    setEditingNote(null);
  }, [notes, saveNotes, showToast]);

  const handleUpdateNote = useCallback(({ title, content, color, font, reminderAt }) => {
    const updated = notes.map((n) =>
      n.id === editingNote.id
        ? { ...n, title: title.trim() || 'Untitled', content: content.trim(), color, font: font || 'Caveat', reminderAt: reminderAt !== undefined ? reminderAt : n.reminderAt, updatedAt: Date.now() }
        : n
    );
    saveNotes(updated);
    showToast('✏️', 'Note updated!');
    setModalOpen(false);
    setEditingNote(null);
  }, [notes, editingNote, saveNotes, showToast]);

  const handleModalSave = useCallback((data) => {
    if (editingNote) {
      handleUpdateNote(data);
    } else {
      handleCreateNote(data);
    }
  }, [editingNote, handleCreateNote, handleUpdateNote]);

  const handleDeleteNote = useCallback((id) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!pendingDeleteId) return;
    const updated = notes.filter((n) => n.id !== pendingDeleteId);
    saveNotes(updated);
    showToast('🗑️', 'Note deleted');
    setConfirmOpen(false);
    setPendingDeleteId(null);
  }, [pendingDeleteId, notes, saveNotes, showToast]);

  const confirmDeleteAccount = async () => {
    try {
      await api.deleteAccount();
      showToast('🗑️', 'Account deleted successfully.');
      setDeleteAccountOpen(false);
      navigate('/login');
    } catch (err) {
      showToast('❌', err.message || 'Failed to delete account.');
    }
  };

  const handleEditNote = useCallback((id) => {
    const note = notes.find((n) => n.id === id);
    if (note) {
      setEditingNote(note);
      setModalOpen(true);
    }
  }, [notes]);

  const handleNewNote = useCallback(() => {
    setEditingNote(null);
    setModalOpen(true);
  }, []);

  // ── Color picker ──
  const handleColorPick = useCallback((noteId, anchorEl) => {
    const rect = anchorEl.getBoundingClientRect();
    const note = notes.find((n) => n.id === noteId);
    setColorPicker({
      visible: true,
      noteId,
      position: { top: rect.bottom + 8, left: rect.left - 40 },
      color: note?.color || 'yellow',
    });
  }, [notes]);

  const handleColorSelect = useCallback((colorName) => {
    if (!colorPicker.noteId) return;
    const updated = notes.map((n) =>
      n.id === colorPicker.noteId ? { ...n, color: colorName, updatedAt: Date.now() } : n
    );
    saveNotes(updated);
    setColorPicker((prev) => ({ ...prev, visible: false }));
  }, [colorPicker.noteId, notes, saveNotes]);

  // ── Close color picker on outside click ──
  useEffect(() => {
    const handleClick = (e) => {
      if (colorPicker.visible && !e.target.closest('.color-picker-popover') && !e.target.closest('.color-btn')) {
        setColorPicker((prev) => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [colorPicker.visible]);

  // ── Drag & Drop ──
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    const targetCard = e.target.closest('.note-card');
    if (!targetCard || targetCard.dataset.id === draggedId) return;

    const targetId = targetCard.dataset.id;
    const draggedNote = notes.find((n) => n.id === draggedId);
    const targetNote = notes.find((n) => n.id === targetId);
    if (!draggedNote || !targetNote) return;

    const isDraggedTimed = !!draggedNote.reminderAt;

    // Check if dragging is allowed under active sorting
    const activeSortBy = isDraggedTimed ? remindersSortBy : notesSortBy;
    if (activeSortBy !== 'custom') {
      showToast('⚠️', 'Please set sorting to "Custom (Drag & Drop)" to reorder.');
      return;
    }

    const draggedIndex = notes.findIndex((n) => n.id === draggedId);
    const targetIndex = notes.findIndex((n) => n.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const reordered = [...notes];
    const [dragged] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, dragged);
    saveNotes(reordered);
  };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (confirmOpen) {
          setConfirmOpen(false);
          setPendingDeleteId(null);
        } else if (deleteAccountOpen) {
          setDeleteAccountOpen(false);
        } else if (settingsOpen) {
          setSettingsOpen(false);
        } else if (modalOpen) {
          setModalOpen(false);
          setEditingNote(null);
        }
        setColorPicker((prev) => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirmOpen, deleteAccountOpen, settingsOpen, modalOpen]);

  // ── Filter notes ──
  const query = searchQuery.toLowerCase();
  const filteredNotes = notes.map((n) => {
    const titleStr = n.title ? n.title.toLowerCase() : '';
    const contentStr = n.content ? n.content.toLowerCase() : '';
    return {
      ...n,
      _hidden: query ? !(titleStr.includes(query) || contentStr.includes(query)) : false,
    };
  });

  const timedNotes = filteredNotes.filter((n) => n.reminderAt);
  const untimedNotes = filteredNotes.filter((n) => !n.reminderAt);

  // ── Sorting functions ──
  const getSortedNotes = (list, sortBy, sortOrder) => {
    if (sortBy === 'custom') return list;
    return [...list].sort((a, b) => {
      let valA, valB;
      if (sortBy === 'title') {
        valA = (a.title || '').trim().toLowerCase();
        valB = (b.title || '').trim().toLowerCase();
      } else if (sortBy === 'created') {
        valA = Number(a.createdAt) || 0;
        valB = Number(b.createdAt) || 0;
      } else if (sortBy === 'updated') {
        valA = Number(a.updatedAt) || 0;
        valB = Number(b.updatedAt) || 0;
      } else if (sortBy === 'color') {
        valA = a.color || '';
        valB = b.color || '';
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const getSortedReminders = (list, sortBy, sortOrder) => {
    if (sortBy === 'custom') return list;
    return [...list].sort((a, b) => {
      let valA, valB;
      if (sortBy === 'reminderTime') {
        valA = a.reminderAt ? new Date(a.reminderAt).getTime() : Infinity;
        valB = b.reminderAt ? new Date(b.reminderAt).getTime() : Infinity;
      } else if (sortBy === 'title') {
        valA = (a.title || '').trim().toLowerCase();
        valB = (b.title || '').trim().toLowerCase();
      } else if (sortBy === 'created') {
        valA = Number(a.createdAt) || 0;
        valB = Number(b.createdAt) || 0;
      } else if (sortBy === 'updated') {
        valA = Number(a.updatedAt) || 0;
        valB = Number(b.updatedAt) || 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedTimedNotes = getSortedReminders(timedNotes, remindersSortBy, remindersSortOrder);
  const sortedUntimedNotes = getSortedNotes(untimedNotes, notesSortBy, notesSortOrder);

  const visibleTimedCount = timedNotes.filter((n) => !n._hidden).length;
  const visibleUntimedCount = untimedNotes.filter((n) => !n._hidden).length;
  const totalVisibleCount = visibleTimedCount + visibleUntimedCount;

  const showTimedSection = (activeCategory === 'all' || activeCategory === 'reminders') && timedNotes.length > 0;
  const showUntimedSection = (activeCategory === 'all' || activeCategory === 'notes') && untimedNotes.length > 0;

  return (
    <>
      <Header
        username={username}
        theme={theme}
        toggleTheme={toggleTheme}
        onSearch={setSearchQuery}
        onNewNote={handleNewNote}
        onToggleSidebar={handleToggleSidebar}
        sidebarOpen={sidebarOpen}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
      />

      <div className={`dashboard-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <aside className="sidebar">
          <nav className="sidebar-nav">
            <button
              className={`sidebar-item ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              <span className="sidebar-icon">📂</span>
              <span className="sidebar-label">All Items</span>
              <span className="sidebar-count">{notes.length}</span>
            </button>
            <button
              className={`sidebar-item ${activeCategory === 'notes' ? 'active' : ''}`}
              onClick={() => setActiveCategory('notes')}
            >
              <span className="sidebar-icon">📝</span>
              <span className="sidebar-label">Notes</span>
              <span className="sidebar-count">{notes.filter((n) => !n.reminderAt).length}</span>
            </button>
            <button
              className={`sidebar-item ${activeCategory === 'reminders' ? 'active' : ''}`}
              onClick={() => setActiveCategory('reminders')}
            >
              <span className="sidebar-icon">⏰</span>
              <span className="sidebar-label">Reminders</span>
              <span className="sidebar-count">{notes.filter((n) => n.reminderAt).length}</span>
            </button>
          </nav>
        </aside>

        <main id="board" ref={boardRef} onDragOver={handleDragOver} onDrop={handleDrop}>
          {notes.length === 0 ? (
            <div className="empty-state" id="empty-state">
              <div className="empty-illustration">
                <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                  <rect x="20" y="25" width="50" height="55" rx="6" fill="url(#e1)" transform="rotate(-8 45 52)" />
                  <rect x="50" y="20" width="50" height="55" rx="6" fill="url(#e2)" transform="rotate(5 75 47)" />
                  <rect x="35" y="40" width="50" height="55" rx="6" fill="url(#e3)" transform="rotate(-2 60 67)" />
                  <defs>
                    <linearGradient id="e1" x1="20" y1="25" x2="70" y2="80"><stop stopColor="#fbbf24" /><stop offset="1" stopColor="#f59e0b" /></linearGradient>
                    <linearGradient id="e2" x1="50" y1="20" x2="100" y2="75"><stop stopColor="#a78bfa" /><stop offset="1" stopColor="#7c3aed" /></linearGradient>
                    <linearGradient id="e3" x1="35" y1="40" x2="85" y2="95"><stop stopColor="#34d399" /><stop offset="1" stopColor="#059669" /></linearGradient>
                  </defs>
                </svg>
              </div>
              <h2>No notes yet</h2>
              <p>Click <strong>"New Note"</strong> to start capturing your ideas!</p>
            </div>
          ) : searchQuery && totalVisibleCount === 0 ? (
            <div className="empty-state" id="search-empty-state">
              <div className="empty-illustration" style={{ fontSize: '4.5rem' }}>🔍</div>
              <h2>No matches found</h2>
              <p>We couldn't find anything matching "{searchQuery}"</p>
            </div>
          ) : activeCategory === 'notes' && untimedNotes.length === 0 ? (
            <div className="empty-state" id="notes-empty-state">
              <div className="empty-illustration" style={{ fontSize: '4.5rem' }}>📝</div>
              <h2>No simple notes</h2>
              <p>Create a note without a reminder to see it here!</p>
            </div>
          ) : activeCategory === 'reminders' && timedNotes.length === 0 ? (
            <div className="empty-state" id="reminders-empty-state">
              <div className="empty-illustration" style={{ fontSize: '4.5rem' }}>⏰</div>
              <h2>No reminders set</h2>
              <p>Add a reminder date/time to a note to see it here!</p>
            </div>
          ) : (
            <>
              {showTimedSection && (
                <div className="board-section" id="timed-section">
                  <div className="section-header">
                    <h3 className="section-title">Reminders</h3>
                    <div className="sort-controls">
                      <span className="sort-label">Sort:</span>
                      <select
                        value={remindersSortBy}
                        onChange={(e) => setRemindersSortBy(e.target.value)}
                        className="sort-select"
                      >
                        <option value="custom">Custom (Drag & Drop)</option>
                        <option value="reminderTime">Reminder Time</option>
                        <option value="title">Alphabetical (Title)</option>
                        <option value="updated">Modified Time</option>
                        <option value="created">Date Created</option>
                      </select>
                      {remindersSortBy !== 'custom' && (
                        <button
                          className="btn-sort-order"
                          onClick={() => setRemindersSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                          title={remindersSortOrder === 'asc' ? 'Sort Descending' : 'Sort Ascending'}
                        >
                          {remindersSortOrder === 'asc' ? '▲' : '▼'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="board-grid" id="timed-board">
                    {sortedTimedNotes.map((note, i) => (
                      <div key={note.id} className={note._hidden ? 'filtered-out-wrapper' : ''}>
                        <NoteCard
                          note={note}
                          index={i}
                          onEdit={handleEditNote}
                          onDelete={handleDeleteNote}
                          onColorPick={handleColorPick}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showUntimedSection && (
                <div className="board-section" id="untimed-section">
                  <div className="section-header">
                    <h3 className="section-title">Notes</h3>
                    <div className="sort-controls">
                      <span className="sort-label">Sort:</span>
                      <select
                        value={notesSortBy}
                        onChange={(e) => setNotesSortBy(e.target.value)}
                        className="sort-select"
                      >
                        <option value="custom">Custom (Drag & Drop)</option>
                        <option value="title">Alphabetical (Title)</option>
                        <option value="updated">Modified Time</option>
                        <option value="created">Date Created</option>
                        <option value="color">Color</option>
                      </select>
                      {notesSortBy !== 'custom' && (
                        <button
                          className="btn-sort-order"
                          onClick={() => setNotesSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                          title={notesSortOrder === 'asc' ? 'Sort Descending' : 'Sort Ascending'}
                        >
                          {notesSortOrder === 'asc' ? '▲' : '▼'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="board-grid" id="untimed-board">
                    {sortedUntimedNotes.map((note, i) => (
                      <div key={note.id} className={note._hidden ? 'filtered-out-wrapper' : ''}>
                        <NoteCard
                          note={note}
                          index={i}
                          onEdit={handleEditNote}
                          onDelete={handleDeleteNote}
                          onColorPick={handleColorPick}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <ColorPicker
        visible={colorPicker.visible}
        position={colorPicker.position}
        activeColor={colorPicker.color}
        onSelect={handleColorSelect}
      />

      <NoteModal
        visible={modalOpen}
        editingNote={editingNote}
        onSave={handleModalSave}
        onClose={() => { setModalOpen(false); setEditingNote(null); }}
      />

      <ConfirmDialog
        visible={confirmOpen}
        onConfirm={confirmDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDeleteId(null); }}
      />

      <ConfirmDialog
        visible={deleteAccountOpen}
        title="Delete Account?"
        message="This will permanently delete your account and all of your notes. This action cannot be undone."
        confirmText="Delete permanently"
        onConfirm={confirmDeleteAccount}
        onCancel={() => setDeleteAccountOpen(false)}
      />

      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onDeleteAccount={() => setDeleteAccountOpen(true)}
        username={username}
      />

      <AboutModal
        visible={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />
    </>
  );
}
