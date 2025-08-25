/**
 * MindKeep Desktop - Main Process
 *
 * This is the main Electron process that manages the application lifecycle,
 * creates the browser window, handles IPC communication, and manages the database.
 *
 * Key responsibilities:
 * - Application window management
 * - Database operations (SQLite)
 * - Backup and restore functionality
 * - Auto-updater integration
 * - Menu and system integration
 */

// Core Electron modules
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

// Custom modules for data management
const OptimizedDatabase = require('./modules/database');  // SQLite database wrapper
const BackupManager = require('./modules/backup');        // Backup/restore functionality

// Auto-updater setup with error handling
// This allows the app to work even if electron-updater is not installed
let autoUpdater;
try {
    autoUpdater = require('electron-updater').autoUpdater;
} catch (error) {
    console.log('electron-updater not available:', error.message);
    autoUpdater = null;
}

// Global application state
let mainWindow;      // Main application window
let database;        // Database instance
let backupManager;   // Backup manager instance

/**
 * Creates the main application window with security best practices
 * and sets up auto-updater event handlers
 */
function createWindow() {
    // Create the main browser window with security-focused configuration
    mainWindow = new BrowserWindow({
        width: 1200,           // Default window width
        height: 800,           // Default window height
        minWidth: 850,         // Minimum resizable width (increased for new tag button)
        minHeight: 600,        // Minimum resizable height
        webPreferences: {
            nodeIntegration: false,    // Disable Node.js in renderer for security
            contextIsolation: true,    // Enable context isolation for security
            preload: path.join(__dirname, 'preload.js')  // Secure IPC bridge
        }
    });

    // Load the main HTML file
    mainWindow.loadFile('index.html');

    // Setup auto-updater event handlers if available
    if (autoUpdater) {
        console.log('Auto updater initialized');

        // Notify renderer when checking for updates
        autoUpdater.on('checking-for-update', () => {
            console.log('Checking for update...');
            mainWindow.webContents.send('update-checking');
        });

        // Notify renderer when update is available
        autoUpdater.on('update-available', (info) => {
            console.log('Update available:', info.version);
            mainWindow.webContents.send('update-available', info.version);
        });

        // Notify renderer when no update is available
        autoUpdater.on('update-not-available', () => {
            console.log('Update not available.');
            mainWindow.webContents.send('update-not-available');
        });
        
        autoUpdater.on('error', (err) => {
			console.error('Update error:', err);
            mainWindow.webContents.send('update-error', err.message);
        });
        
        autoUpdater.on('download-progress', (progressObj) => {
			console.log('Download progress:', progressObj.percent);
            mainWindow.webContents.send('update-progress', progressObj.percent);
        });
        
        autoUpdater.on('update-downloaded', () => {
			console.log('Update downloaded.');
            mainWindow.webContents.send('update-downloaded');
        });
    }
}

app.on('will-finish-launching', () => {
  app.on('ready', () => {
    app.commandLine.appendSwitch(
        '--disk-cache-dir',
        path.join(app.getPath('userData'), 'GPUCache'));
  })
})

// IPC handlers for update functionality
ipcMain.handle('check-for-updates', async () => {
    if (autoUpdater) {
		const version = app.getVersion();
		console.log('Manual check for updates triggered');
		mainWindow.webContents.send('current-version', version); // Send current version to the renderer
        return await autoUpdater.checkForUpdates();
    }
    return null;
});

ipcMain.handle('install-update', () => {
    if (autoUpdater) {
        autoUpdater.quitAndInstall();
    }
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

// Optimized database handlers
ipcMain.handle('db-get-categories', () => database.getCategories());

ipcMain.handle('db-add-category', (_, name, color, parent) => {
    return database.addCategory(name, color, parent);
});

ipcMain.handle('db-update-category', (_, oldName, newName, color, parent) => {
    return database.updateCategory(oldName, newName, color, parent);
});

ipcMain.handle('db-delete-category', (_, name) => {
    return database.deleteCategory(name);
});

ipcMain.handle('db-get-notes', () => {
    return database.getNotes();
});

ipcMain.handle('db-save-note', (_, note) => {
    return database.saveNote(note);
});

ipcMain.handle('db-delete-note', (_, id) => {
    return database.deleteNote(id);
});

ipcMain.handle('db-get-notes-sorted', (_, sortBy) => {
    const notes = database.getNotes();
    return notes.sort((a, b) => {
        // Pinned notes always come first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        // Then sort by the specified criteria
        if (sortBy.includes('title')) return sortBy.includes('DESC') ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title);
        return sortBy.includes('DESC') ? new Date(b.updatedAt) - new Date(a.updatedAt) : new Date(a.updatedAt) - new Date(b.updatedAt);
    });
});

ipcMain.handle('db-toggle-pin-note', (_, id) => {
    const note = database.getNote(id);
    if (note) {
        note.isPinned = !note.isPinned;
        return database.saveNote(note);
    }
    return false;
});

// Database statistics
ipcMain.handle('db-get-stats', () => {
    return database.getStats();
});

// Backup system handlers
ipcMain.handle('backup-create', (_, slot) => {
    return backupManager.createBackup(slot);
});

ipcMain.handle('backup-get-slots', () => {
    return backupManager.getBackupSlots();
});

ipcMain.handle('backup-restore', (_, slot) => {
    return backupManager.restoreFromBackup(slot);
});

ipcMain.handle('backup-export', (_, slot) => {
    return backupManager.exportBackup(slot);
});

ipcMain.handle('backup-import', (_, filePath) => {
    return backupManager.importBackup(filePath);
});

ipcMain.handle('backup-delete', (_, slot) => {
    return backupManager.deleteBackup(slot);
});

function initializeDatabase() {
    database = new OptimizedDatabase();
    backupManager = new BackupManager(database);
    console.log('Optimized database initialized');
}



app.whenReady().then(() => {
    initializeDatabase();
    createWindow();
    
    // Create menu with shortcuts
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Note',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => mainWindow.webContents.send('shortcut-new-note')
                },
                {
                    label: 'Quick Capture',
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: () => mainWindow.webContents.send('shortcut-quick-capture')
                },
                {
                    label: 'Search',
                    accelerator: 'CmdOrCtrl+F',
                    click: () => mainWindow.webContents.send('shortcut-focus-search')
                },
                {
                    label: 'Advanced Search',
                    accelerator: 'CmdOrCtrl+Shift+F',
                    click: () => mainWindow.webContents.send('shortcut-advanced-search')
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => app.quit()
                }
            ]
        }
    ];
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
