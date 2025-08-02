const { app, BrowserWindow, ipcMain } = require('electron');

// Safely require electron-updater
let autoUpdater;
try {
    autoUpdater = require('electron-updater').autoUpdater;
} catch (error) {
    console.log('electron-updater not available:', error.message);
    autoUpdater = null;
}

let mainWindow;

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

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});