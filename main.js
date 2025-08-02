const { app, BrowserWindow } = require('electron');

// Safely require electron-updater
let autoUpdater;
try {
    autoUpdater = require('electron-updater').autoUpdater;
} catch (error) {
    console.log('electron-updater not available:', error.message);
    autoUpdater = null;
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();
    
    // Only check for updates in production
    if (autoUpdater) {
        autoUpdater.checkForUpdatesAndNotify();
    }
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});