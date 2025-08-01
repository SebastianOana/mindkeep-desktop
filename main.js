const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Safely require electron-updater
let autoUpdater;
try {
    autoUpdater = require('electron-updater').autoUpdater;
} catch (error) {
    console.log('electron-updater not available:', error.message);
    autoUpdater = null;
}

let mainWindow;
let notesCache = [];
let categoriesCache = [];
const notesFile = path.join(app.getPath('userData'), 'notes.json');
const categoriesFile = path.join(app.getPath('userData'), 'categories.json');

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

// Cached JSON handlers for performance
ipcMain.handle('db-get-categories', () => categoriesCache);

ipcMain.handle('db-add-category', (event, name, color, parent) => {
    categoriesCache.push({name, color, parent});
    fs.writeFileSync(categoriesFile, JSON.stringify(categoriesCache, null, 2));
    return categoriesCache.length;
});

ipcMain.handle('db-delete-category', (event, name) => {
    notesCache.forEach(note => { if (note.category === name) note.category = 'General'; });
    categoriesCache = categoriesCache.filter(cat => cat.name !== name);
    fs.writeFileSync(notesFile, JSON.stringify(notesCache, null, 2));
    fs.writeFileSync(categoriesFile, JSON.stringify(categoriesCache, null, 2));
    return 1;
});

ipcMain.handle('db-get-notes', () => notesCache);

ipcMain.handle('db-save-note', (event, note) => {
    const index = notesCache.findIndex(n => n.id === note.id);
    if (index >= 0) notesCache[index] = note;
    else notesCache.push(note);
    fs.writeFileSync(notesFile, JSON.stringify(notesCache, null, 2));
    return 1;
});

ipcMain.handle('db-delete-note', (event, id) => {
    notesCache = notesCache.filter(n => n.id !== id);
    fs.writeFileSync(notesFile, JSON.stringify(notesCache, null, 2));
    return 1;
});

ipcMain.handle('db-get-notes-sorted', (event, sortBy) => {
    return [...notesCache].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return b.isPinned - a.isPinned;
        if (sortBy.includes('title')) return sortBy.includes('DESC') ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title);
        return sortBy.includes('DESC') ? new Date(b.updatedAt) - new Date(a.updatedAt) : new Date(a.updatedAt) - new Date(b.updatedAt);
    });
});

ipcMain.handle('db-toggle-pin-note', (event, id) => {
    const note = notesCache.find(n => n.id === id);
    if (note) {
        note.isPinned = !note.isPinned;
        fs.writeFileSync(notesFile, JSON.stringify(notesCache, null, 2));
    }
    return 1;
});

function loadData() {
    try {
        notesCache = JSON.parse(fs.readFileSync(notesFile, 'utf8'));
    } catch {
        notesCache = [];
    }
    try {
        categoriesCache = JSON.parse(fs.readFileSync(categoriesFile, 'utf8'));
    } catch {
        categoriesCache = [{name: 'General', color: '#4a9eff', parent: null}];
        fs.writeFileSync(categoriesFile, JSON.stringify(categoriesCache, null, 2));
    }
}

app.whenReady().then(() => {
    loadData();
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