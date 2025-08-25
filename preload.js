const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  getCategories: () => ipcRenderer.invoke('db-get-categories'),
  addCategory: (name, color, parent) => ipcRenderer.invoke('db-add-category', name, color, parent),
  updateCategory: (oldName, newName, color, parent) => ipcRenderer.invoke('db-update-category', oldName, newName, color, parent),
  deleteCategory: (name) => ipcRenderer.invoke('db-delete-category', name),
  
  getNotes: () => ipcRenderer.invoke('db-get-notes'),
  saveNote: (note) => ipcRenderer.invoke('db-save-note', note),
  deleteNote: (id) => ipcRenderer.invoke('db-delete-note', id),
  getNotesSorted: (sortBy) => ipcRenderer.invoke('db-get-notes-sorted', sortBy),
  togglePinNote: (id) => ipcRenderer.invoke('db-toggle-pin-note', id),
  
  // Update functionality
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Event listeners for updates
  onUpdateChecking: (callback) => ipcRenderer.on('update-checking', callback),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
  onUpdateError: (callback) => ipcRenderer.on('update-error', callback),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onCurrentVersion: (callback) => ipcRenderer.on('current-version', callback),
  
  // Keyboard shortcuts
  onShortcutNewNote: (callback) => ipcRenderer.on('shortcut-new-note', callback),
  onShortcutQuickCapture: (callback) => ipcRenderer.on('shortcut-quick-capture', callback),
  onShortcutFocusSearch: (callback) => ipcRenderer.on('shortcut-focus-search', callback),
  onShortcutAdvancedSearch: (callback) => ipcRenderer.on('shortcut-advanced-search', callback),

  // Generic IPC invoke method
  invoke: (channel, ...args) => {
    const validChannels = [
      'db-get-notes', 'db-save-note', 'db-delete-note', 'db-get-categories',
      'db-add-category', 'db-delete-category', 'db-get-notes-sorted', 'db-toggle-pin-note',
      'db-get-stats', 'backup-create', 'backup-get-slots', 'backup-restore',
      'backup-export', 'backup-import', 'backup-delete'
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Invalid IPC channel: ${channel}`);
  },

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Expose a limited set of Node.js APIs for file operations if needed
contextBridge.exposeInMainWorld('nodeAPI', {
  // We'll keep this minimal and secure
  platform: process.platform,
  versions: process.versions
});
