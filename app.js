/* ========================================
   StickyBoard — Modern Sticky Notes App
   ======================================== */

(() => {
  'use strict';

  // ── Constants ──
  const STORAGE_KEY = 'stickyboard_notes';
  const THEME_KEY = 'stickyboard_theme';
  const COLORS = [
    { name: 'yellow', hex: '#fde68a' },
    { name: 'pink',   hex: '#f9a8d4' },
    { name: 'blue',   hex: '#93c5fd' },
    { name: 'green',  hex: '#6ee7b7' },
    { name: 'purple', hex: '#c4b5fd' },
    { name: 'orange', hex: '#fdba74' },
    { name: 'teal',   hex: '#5eead4' },
    { name: 'rose',   hex: '#fda4af' },
  ];

  // ── DOM Refs ──
  const board = document.getElementById('board');
  const emptyState = document.getElementById('empty-state');
  const btnAddNote = document.getElementById('btn-add-note');
  const btnToggleTheme = document.getElementById('btn-toggle-theme');
  const searchInput = document.getElementById('search-input');
  const colorPickerPopover = document.getElementById('color-picker-popover');
  const colorPickerGrid = document.getElementById('color-picker-grid');

  // Modal & Confirm elements (will be created dynamically)
  let modalOverlay, modalTitle, modalTitleInput, modalContentInput, modalColorsContainer, modalSaveBtn, modalCancelBtn, modalCloseBtn;
  let confirmOverlay, confirmDeleteBtn, confirmCancelBtn;
  let toastContainer;

  // ── State ──
  let notes = [];
  let editingNoteId = null;           // null = creating new, string = editing existing
  let pendingDeleteId = null;
  let activeColorPickerNoteId = null;
  let currentUser = null;

  // ── Init ──
  function init() {
    loadTheme();
    createModal();
    createConfirmDialog();
    createToastContainer();
    renderColorPickerGrid();
    bindEvents();
    loadUserSession();
  }

  // ── User Session ──
  async function loadUserSession() {
    try {
      const res = await fetch('/api/me');
      const data = await res.json();
      if (data.authenticated) {
        currentUser = data.username;
        const nameEl = document.getElementById('user-display-name');
        if (nameEl) nameEl.textContent = data.username;
        await loadNotes();
        renderNotes();
      } else {
        window.location.href = '/login';
      }
    } catch {
      // Fallback for static testing
      loadNotes();
      renderNotes();
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    window.location.href = '/login';
  }

  // ── Theme ──
  function updateFlatpickrTheme(theme) {
    const link = document.getElementById('flatpickr-theme');
    if (link) {
      if (theme === 'dark') {
        link.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/themes/dark.css';
      } else {
        link.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
      }
    }
  }

  function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateFlatpickrTheme(savedTheme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    updateFlatpickrTheme(next);
  }

  // ── Notes CRUD ──
  async function loadNotes() {
    if (currentUser) {
      try {
        const res = await fetch('/api/notes');
        if (res.ok) {
          notes = await res.json();
          return;
        }
      } catch (err) {
        console.error('Failed to load notes from backend', err);
      }
    }
    // Fallback
    try {
      notes = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      notes = [];
    }
  }

  function saveNotes() {
    if (currentUser) {
      fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notes)
      }).catch(err => console.error('Failed to save notes to backend', err));
    }
    // Also save locally as a backup
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  function createNote(title, content, color, reminderAt) {
    const note = {
      id: generateId(),
      title: title.trim() || 'Untitled',
      content: content.trim(),
      color: color || 'yellow',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      reminderAt: reminderAt || null,
    };
    notes.unshift(note);
    saveNotes();
    renderNotes();
    showToast('✨', 'Note created!');
    return note;
  }

  function updateNote(id, title, content, color, reminderAt) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    note.title = title.trim() || 'Untitled';
    note.content = content.trim();
    note.color = color || note.color;
    note.reminderAt = reminderAt !== undefined ? reminderAt : note.reminderAt;
    note.updatedAt = Date.now();
    saveNotes();
    renderNotes();
    showToast('✏️', 'Note updated!');
  }

  function deleteNote(id) {
    const card = document.querySelector(`.note-card[data-id="${id}"]`);
    if (card) {
      card.classList.add('deleting');
      setTimeout(() => {
        notes = notes.filter(n => n.id !== id);
        saveNotes();
        renderNotes();
        showToast('🗑️', 'Note deleted');
      }, 350);
    } else {
      notes = notes.filter(n => n.id !== id);
      saveNotes();
      renderNotes();
    }
  }

  function changeNoteColor(id, color) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    note.color = color;
    note.updatedAt = Date.now();
    saveNotes();
    const card = document.querySelector(`.note-card[data-id="${id}"]`);
    if (card) card.setAttribute('data-color', color);
  }

  // ── Render ──
  function renderNotes() {
    // Remove existing note cards
    const existingCards = document.querySelectorAll('.note-card');
    existingCards.forEach(card => card.remove());

    const timedBoard = document.getElementById('timed-board');
    const untimedBoard = document.getElementById('untimed-board');
    const timedSection = document.getElementById('timed-section');
    const untimedSection = document.getElementById('untimed-section');

    if (notes.length === 0) {
      emptyState.classList.remove('hidden');
      timedSection.style.display = 'none';
      untimedSection.style.display = 'none';
      return;
    }

    emptyState.classList.add('hidden');

    let hasTimed = false;
    let hasUntimed = false;

    notes.forEach((note, index) => {
      const card = buildNoteCard(note, index);
      if (note.reminderAt) {
        timedBoard.appendChild(card);
        hasTimed = true;
      } else {
        untimedBoard.appendChild(card);
        hasUntimed = true;
      }
    });

    timedSection.style.display = hasTimed ? 'flex' : 'none';
    untimedSection.style.display = hasUntimed ? 'flex' : 'none';

    // Re-apply search filter if there's a query
    if (searchInput.value.trim()) {
      filterNotes(searchInput.value.trim());
    }
  }

  function buildNoteCard(note, index) {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.setAttribute('data-id', note.id);
    card.setAttribute('data-color', note.color);
    card.style.animationDelay = `${index * 0.05}s`;
    card.draggable = true;

    let reminderHtml = '';
    if (note.reminderAt) {
      const now = Date.now();
      const remTime = new Date(note.reminderAt).getTime();
      const diff = remTime - now;
      if (diff <= 0) {
        reminderHtml = `<div class="note-reminder-badge expired">⚠️ Expired</div>`;
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / 1000 / 60) % 60);
        let timeStr = '';
        if (days > 0) timeStr = `${days}d ${hours}h left`;
        else if (hours > 0) timeStr = `${hours}h ${mins}m left`;
        else timeStr = `${mins}m left`;
        reminderHtml = `<div class="note-reminder-badge active">⏰ ${timeStr}</div>`;
      }
    }

    card.innerHTML = `
      <div class="note-header">
        <div class="note-title">${escapeHtml(note.title)}</div>
        <div class="note-actions">
          <button class="note-action-btn edit-btn" title="Edit note" data-id="${note.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="note-action-btn color-btn" title="Change color" data-id="${note.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/>
            </svg>
          </button>
          <button class="note-action-btn delete-btn" title="Delete note" data-id="${note.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
      ${reminderHtml}
      <div class="note-body">${escapeHtml(note.content).replace(/\n/g, '<br>')}</div>
      <div class="note-footer">
        <span class="note-date">${formatDate(note.updatedAt)}</span>
      </div>
    `;

    return card;
  }

  // ── Modal (New / Edit) ──
  function createModal() {
    modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.id = 'note-modal';
    modalOverlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2 id="modal-title">New Note</h2>
          <button class="modal-close-btn" id="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-field">
            <label for="modal-note-title">Title</label>
            <input type="text" id="modal-note-title" placeholder="Give your note a title…" maxlength="120" />
          </div>
          <div class="modal-field">
            <label for="modal-note-content">Content</label>
            <textarea id="modal-note-content" placeholder="Write your note here…" maxlength="2000"></textarea>
          </div>
          <div class="modal-field">
            <label for="modal-note-reminder">Reminder (Optional)</label>
            <input type="text" id="modal-note-reminder" placeholder="Select date and time" autocomplete="off" />
          </div>
          <div class="modal-field">
            <label>Color</label>
            <div class="modal-colors" id="modal-colors"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="modal-cancel-btn">Cancel</button>
          <button class="btn-save" id="modal-save-btn">Save Note</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalOverlay);

    modalTitle = document.getElementById('modal-title');
    modalTitleInput = document.getElementById('modal-note-title');
    modalContentInput = document.getElementById('modal-note-content');
    modalColorsContainer = document.getElementById('modal-colors');
    modalSaveBtn = document.getElementById('modal-save-btn');
    modalCancelBtn = document.getElementById('modal-cancel-btn');
    modalCloseBtn = document.getElementById('modal-close-btn');
    window.modalReminderInput = document.getElementById('modal-note-reminder');

    window.reminderPicker = flatpickr(window.modalReminderInput, {
      enableTime: true,
      time_24hr: true,
      dateFormat: "Y-m-d H:i",
      minDate: new Date(),
      disableMobile: "true"
    });

    // Render color options
    COLORS.forEach(c => {
      const swatch = document.createElement('div');
      swatch.className = 'modal-color-option';
      swatch.setAttribute('data-color', c.name);
      swatch.style.background = c.hex;
      swatch.title = c.name;
      modalColorsContainer.appendChild(swatch);
    });
  }

  function openModal(noteId) {
    editingNoteId = noteId || null;

    window.reminderPicker.set('minDate', new Date());

    if (editingNoteId) {
      const note = notes.find(n => n.id === editingNoteId);
      if (!note) return;
      modalTitle.textContent = 'Edit Note';
      modalTitleInput.value = note.title;
      modalContentInput.value = note.content;
      window.reminderPicker.setDate(note.reminderAt ? new Date(note.reminderAt) : null);
      selectModalColor(note.color);
      modalSaveBtn.textContent = 'Save Changes';
    } else {
      modalTitle.textContent = 'New Note';
      modalTitleInput.value = '';
      modalContentInput.value = '';
      window.reminderPicker.clear();
      selectModalColor('yellow');
      modalSaveBtn.textContent = 'Create Note';
    }

    modalOverlay.classList.add('visible');
    setTimeout(() => modalTitleInput.focus(), 200);
  }

  function closeModal() {
    modalOverlay.classList.remove('visible');
    editingNoteId = null;
  }

  function selectModalColor(colorName) {
    const options = modalColorsContainer.querySelectorAll('.modal-color-option');
    options.forEach(opt => {
      opt.classList.toggle('selected', opt.getAttribute('data-color') === colorName);
    });
  }

  function getSelectedModalColor() {
    const selected = modalColorsContainer.querySelector('.modal-color-option.selected');
    return selected ? selected.getAttribute('data-color') : 'yellow';
  }

  function handleModalSave() {
    const title = modalTitleInput.value;
    const content = modalContentInput.value;
    const color = getSelectedModalColor();
    const selectedDate = window.reminderPicker.selectedDates[0];
    const reminderAt = selectedDate ? selectedDate.toISOString() : null;

    if (selectedDate && selectedDate <= new Date()) {
      showToast('⚠️', 'Reminder time must be in the future!');
      window.modalReminderInput.parentElement.style.animation = 'shake 0.3s ease';
      setTimeout(() => window.modalReminderInput.parentElement.style.animation = '', 300);
      return;
    }

    if (!title.trim() && !content.trim()) {
      modalTitleInput.style.animation = 'shake 0.3s ease';
      setTimeout(() => modalTitleInput.style.animation = '', 300);
      return;
    }

    if (editingNoteId) {
      updateNote(editingNoteId, title, content, color, reminderAt);
    } else {
      createNote(title, content, color, reminderAt);
    }

    closeModal();
  }

  // ── Confirm Delete ──
  function createConfirmDialog() {
    confirmOverlay = document.createElement('div');
    confirmOverlay.className = 'confirm-overlay';
    confirmOverlay.id = 'confirm-delete';
    confirmOverlay.innerHTML = `
      <div class="confirm-dialog">
        <h3>Delete this note?</h3>
        <p>This action cannot be undone.</p>
        <div class="confirm-actions">
          <button class="btn-secondary" id="confirm-cancel-btn">Cancel</button>
          <button class="btn-danger" id="confirm-delete-btn">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(confirmOverlay);

    confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    confirmCancelBtn = document.getElementById('confirm-cancel-btn');
  }

  function openConfirm(noteId) {
    pendingDeleteId = noteId;
    confirmOverlay.classList.add('visible');
  }

  function closeConfirm() {
    confirmOverlay.classList.remove('visible');
    pendingDeleteId = null;
  }

  // ── Toast ──
  function createToastContainer() {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  function showToast(icon, message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ── Color Picker Popover ──
  function renderColorPickerGrid() {
    colorPickerGrid.innerHTML = '';
    COLORS.forEach(c => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.setAttribute('data-color', c.name);
      swatch.style.background = c.hex;
      swatch.title = c.name;
      colorPickerGrid.appendChild(swatch);
    });
  }

  function showColorPicker(noteId, anchorEl) {
    activeColorPickerNoteId = noteId;
    const rect = anchorEl.getBoundingClientRect();
    colorPickerPopover.style.top = `${rect.bottom + 8}px`;
    colorPickerPopover.style.left = `${rect.left - 40}px`;

    // Mark active color
    const note = notes.find(n => n.id === noteId);
    const swatches = colorPickerGrid.querySelectorAll('.color-swatch');
    swatches.forEach(s => s.classList.toggle('active', s.getAttribute('data-color') === note?.color));

    colorPickerPopover.classList.add('visible');
  }

  function hideColorPicker() {
    colorPickerPopover.classList.remove('visible');
    activeColorPickerNoteId = null;
  }

  // ── Search / Filter ──
  function filterNotes(query) {
    const q = query.toLowerCase();
    const cards = board.querySelectorAll('.note-card');
    cards.forEach(card => {
      const note = notes.find(n => n.id === card.getAttribute('data-id'));
      if (!note) return;
      const match = note.title.toLowerCase().includes(q) || note.content.toLowerCase().includes(q);
      card.classList.toggle('filtered-out', !match);
    });
  }

  // ── Drag & Drop ──
  let draggedId = null;

  function handleDragStart(e) {
    const card = e.target.closest('.note-card');
    if (!card) return;
    draggedId = card.getAttribute('data-id');
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd(e) {
    const card = e.target.closest('.note-card');
    if (card) card.classList.remove('dragging');
    draggedId = null;
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = e.target.closest('.note-card');
    if (!card || card.getAttribute('data-id') === draggedId) return;

    const draggingCard = board.querySelector(`.note-card[data-id="${draggedId}"]`);
    if (!draggingCard) return;

    const rect = card.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      board.insertBefore(draggingCard, card);
    } else {
      board.insertBefore(draggingCard, card.nextSibling);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    // Re-order notes array to match DOM order
    const cardIds = [...board.querySelectorAll('.note-card')].map(c => c.getAttribute('data-id'));
    const reordered = cardIds.map(id => notes.find(n => n.id === id)).filter(Boolean);
    // Add any notes not in DOM (shouldn't happen but safety)
    notes.forEach(n => { if (!reordered.find(r => r.id === n.id)) reordered.push(n); });
    notes = reordered;
    saveNotes();
  }

  // ── Event Binding ──
  function bindEvents() {
    // Add note button
    btnAddNote.addEventListener('click', () => openModal(null));

    // Sort notes button
    const btnSortNotes = document.getElementById('btn-sort-notes');
    if (btnSortNotes) {
      btnSortNotes.addEventListener('click', () => {
        const now = Date.now();
        notes.sort((a, b) => {
          const aRem = a.reminderAt ? new Date(a.reminderAt).getTime() : null;
          const bRem = b.reminderAt ? new Date(b.reminderAt).getTime() : null;
          
          if (aRem && bRem) {
            const aExp = aRem < now;
            const bExp = bRem < now;
            if (aExp !== bExp) return aExp ? 1 : -1;
            return aRem - bRem;
          }
          if (aRem) return -1;
          if (bRem) return 1;
          return b.updatedAt - a.updatedAt;
        });
        saveNotes();
        renderNotes();
        showToast('🔄', 'Sorted by reminders');
      });
    }

    // Theme toggle
    btnToggleTheme.addEventListener('click', toggleTheme);

    // Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', handleLogout);
    }

    // Search
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      if (q) {
        filterNotes(q);
      } else {
        board.querySelectorAll('.note-card').forEach(c => c.classList.remove('filtered-out'));
      }
    });

    // Board delegation — note action buttons
    board.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.edit-btn');
      const deleteBtn = e.target.closest('.delete-btn');
      const colorBtn = e.target.closest('.color-btn');

      if (editBtn) {
        e.stopPropagation();
        openModal(editBtn.getAttribute('data-id'));
      } else if (deleteBtn) {
        e.stopPropagation();
        openConfirm(deleteBtn.getAttribute('data-id'));
      } else if (colorBtn) {
        e.stopPropagation();
        showColorPicker(colorBtn.getAttribute('data-id'), colorBtn);
      }
    });

    // Double-click to edit
    board.addEventListener('dblclick', (e) => {
      const card = e.target.closest('.note-card');
      if (card && !e.target.closest('.note-actions')) {
        openModal(card.getAttribute('data-id'));
      }
    });

    // Drag & Drop
    board.addEventListener('dragstart', handleDragStart);
    board.addEventListener('dragend', handleDragEnd);
    board.addEventListener('dragover', handleDragOver);
    board.addEventListener('drop', handleDrop);

    // Modal events
    modalSaveBtn.addEventListener('click', handleModalSave);
    modalCancelBtn.addEventListener('click', closeModal);
    modalCloseBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
    modalColorsContainer.addEventListener('click', (e) => {
      const swatch = e.target.closest('.modal-color-option');
      if (swatch) selectModalColor(swatch.getAttribute('data-color'));
    });

    // Modal keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (confirmOverlay.classList.contains('visible')) {
          closeConfirm();
        } else if (modalOverlay.classList.contains('visible')) {
          closeModal();
        }
        hideColorPicker();
      }
      // Ctrl/Cmd + Enter to save in modal
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && modalOverlay.classList.contains('visible')) {
        handleModalSave();
      }
    });

    // Confirm delete events
    confirmDeleteBtn.addEventListener('click', () => {
      if (pendingDeleteId) deleteNote(pendingDeleteId);
      closeConfirm();
    });
    confirmCancelBtn.addEventListener('click', closeConfirm);
    confirmOverlay.addEventListener('click', (e) => {
      if (e.target === confirmOverlay) closeConfirm();
    });

    // Color picker popover
    colorPickerGrid.addEventListener('click', (e) => {
      const swatch = e.target.closest('.color-swatch');
      if (swatch && activeColorPickerNoteId) {
        changeNoteColor(activeColorPickerNoteId, swatch.getAttribute('data-color'));
        hideColorPicker();
      }
    });

    // Close color picker on outside click
    document.addEventListener('click', (e) => {
      if (!colorPickerPopover.contains(e.target) && !e.target.closest('.color-btn')) {
        hideColorPicker();
      }
    });
  }

  // ── Helpers ──
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(timestamp) {
    const d = new Date(timestamp);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;

    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  }

  // ── Boot ──
  init();
})();
