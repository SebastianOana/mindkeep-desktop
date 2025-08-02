const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const Database = require('./database');

// Safely require electron-updater
let autoUpdater;
try {
    autoUpdater = require('electron-updater').autoUpdater;
} catch (error) {
    console.log('electron-updater not available:', error.message);
    autoUpdater = null;
}

let mainWindow;
let db;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
    
    // Setup auto-updater events
    if (autoUpdater) {
        autoUpdater.on('checking-for-update', () => {
            mainWindow.webContents.send('update-checking');
        });
        
        autoUpdater.on('update-available', (info) => {
            mainWindow.webContents.send('update-available', info.version);
        });
        
        autoUpdater.on('update-not-available', () => {
            mainWindow.webContents.send('update-not-available');
        });
        
        autoUpdater.on('error', (err) => {
            mainWindow.webContents.send('update-error', err.message);
        });
        
        autoUpdater.on('download-progress', (progressObj) => {
            mainWindow.webContents.send('update-progress', progressObj.percent);
        });
        
        autoUpdater.on('update-downloaded', () => {
            mainWindow.webContents.send('update-downloaded');
        });
    }
}

// IPC handlers for update functionality
ipcMain.handle('check-for-updates', async () => {
    if (autoUpdater) {
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

// Database IPC handlers
ipcMain.handle('db-get-categories', async () => {
    return await db.getCategories();
});

ipcMain.handle('db-add-category', async (event, name, color, parent) => {
    return await db.addCategory(name, color, parent);
});

ipcMain.handle('db-delete-category', async (event, name) => {
    return await db.deleteCategory(name);
});

ipcMain.handle('db-get-notes', async () => {
    return await db.getNotes();
});

ipcMain.handle('db-save-note', async (event, note) => {
    return await db.saveNote(note);
});

ipcMain.handle('db-delete-note', async (event, id) => {
    return await db.deleteNote(id);
});

ipcMain.handle('db-search-notes', async (event, searchTerm) => {
    return await db.searchNotes(searchTerm);
});

ipcMain.handle('db-get-notes-sorted', async (event, sortBy) => {
    return await db.getNotes(sortBy);
});

ipcMain.handle('db-toggle-pin-note', async (event, id) => {
    return await db.togglePinNote(id);
});

app.whenReady().then(async () => {
    // Initialize database
    const dbPath = path.join(app.getPath('userData'), 'mindkeep.db');
    db = new Database(dbPath);
    
    // Migrate existing JSON data if it exists
    const notesDir = path.join(process.cwd(), 'notes');
    const categoriesFile = path.join(process.cwd(), 'categories.json');
    try {
        await db.migrateFromJSON(notesDir, categoriesFile);
        console.log('Migration from JSON completed');
    } catch (error) {
        console.log('No JSON data to migrate or migration failed:', error.message);
    }
    
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
                    label: 'Search',
                    accelerator: 'CmdOrCtrl+F',
                    click: () => mainWindow.webContents.send('shortcut-focus-search')
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