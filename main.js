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
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
    
    // Setup auto-updater events
    if (autoUpdater) {
		console.log('Auto updater initialized');
        autoUpdater.on('checking-for-update', () => {
			console.log('Checking for update...');
            mainWindow.webContents.send('update-checking');
        });
        
        autoUpdater.on('update-available', (info) => {
			console.log('Update available:', info.version);
            mainWindow.webContents.send('update-available', info.version);
        });
        
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

ipcMain.handle('db-get-notes', () => {
    return [...notesCache].sort((a, b) => {
        // Pinned notes always come first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        // Then sort by updated date
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
});

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
        // Pinned notes always come first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        
        // Then sort by the specified criteria
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
