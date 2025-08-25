const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');

class BackupManager {
    constructor(database) {
        this.database = database;
        this.backupsDir = path.join(app.getPath('userData'), 'mindkeep-data', 'backups');
        this.MAX_SLOTS = 3;
        
        this.ensureBackupDir();
    }
    
    ensureBackupDir() {
        if (!fs.existsSync(this.backupsDir)) {
            fs.mkdirSync(this.backupsDir, { recursive: true });
        }
    }
    
    // Create a backup in the specified slot (1, 2, or 3)
    async createBackup(slot = null) {
        try {
            // Force write any pending changes
            await this.database.forceWrite();
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupData = {
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                notes: this.database.getNotes(),
                categories: this.database.getCategories(),
                meta: this.database.metaCache
            };
            
            let filename;
            if (slot && slot >= 1 && slot <= this.MAX_SLOTS) {
                // Use specific slot
                filename = `backup-slot-${slot}.json`;
            } else {
                // Auto-assign to oldest slot or create new
                const slots = this.getBackupSlots();
                const oldestSlot = this.findOldestSlot(slots);
                filename = `backup-slot-${oldestSlot}.json`;
            }
            
            const backupPath = path.join(this.backupsDir, filename);
            
            // Add backup metadata
            backupData.slot = parseInt(filename.match(/slot-(\d+)/)[1]);
            backupData.filename = filename;
            
            await fs.promises.writeFile(backupPath, JSON.stringify(backupData, null, 2));
            
            // Update database meta with last backup info
            this.database.metaCache.lastBackup = {
                timestamp: backupData.timestamp,
                slot: backupData.slot,
                notesCount: backupData.notes.length
            };
            this.database.saveMeta();
            
            return {
                success: true,
                slot: backupData.slot,
                timestamp: backupData.timestamp,
                filename,
                notesCount: backupData.notes.length,
                categoriesCount: backupData.categories.length
            };
            
        } catch (error) {
            console.error('Backup creation failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Get information about all backup slots
    getBackupSlots() {
        const slots = [];
        
        for (let i = 1; i <= this.MAX_SLOTS; i++) {
            const filename = `backup-slot-${i}.json`;
            const backupPath = path.join(this.backupsDir, filename);
            
            if (fs.existsSync(backupPath)) {
                try {
                    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
                    slots.push({
                        slot: i,
                        exists: true,
                        timestamp: backupData.timestamp,
                        notesCount: backupData.notes?.length || 0,
                        categoriesCount: backupData.categories?.length || 0,
                        filename,
                        size: fs.statSync(backupPath).size
                    });
                } catch (error) {
                    slots.push({
                        slot: i,
                        exists: false,
                        error: 'Corrupted backup file'
                    });
                }
            } else {
                slots.push({
                    slot: i,
                    exists: false
                });
            }
        }
        
        return slots;
    }
    
    // Find the oldest slot for auto-backup
    findOldestSlot(slots) {
        const existingSlots = slots.filter(slot => slot.exists && !slot.error);
        
        if (existingSlots.length < this.MAX_SLOTS) {
            // Find first empty slot
            for (let i = 1; i <= this.MAX_SLOTS; i++) {
                if (!slots.find(slot => slot.slot === i && slot.exists)) {
                    return i;
                }
            }
        }
        
        // All slots occupied, find oldest
        existingSlots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        return existingSlots[0].slot;
    }
    
    // Restore from backup
    async restoreFromBackup(slot) {
        try {
            const filename = `backup-slot-${slot}.json`;
            const backupPath = path.join(this.backupsDir, filename);
            
            if (!fs.existsSync(backupPath)) {
                return {
                    success: false,
                    error: `Backup slot ${slot} does not exist`
                };
            }
            
            const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
            
            // Validate backup data
            if (!backupData.notes || !backupData.categories) {
                return {
                    success: false,
                    error: 'Invalid backup file format'
                };
            }
            
            // Clear current data
            this.database.notesCache.clear();
            this.database.categoriesCache = [];
            
            // Restore categories
            this.database.categoriesCache = [...backupData.categories];
            this.database.saveCategories();
            
            // Restore notes
            for (const note of backupData.notes) {
                await this.database.saveNote(note);
            }
            
            // Force write all changes
            await this.database.forceWrite();
            
            return {
                success: true,
                notesRestored: backupData.notes.length,
                categoriesRestored: backupData.categories.length,
                backupTimestamp: backupData.timestamp
            };
            
        } catch (error) {
            console.error('Restore failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Export backup to external file
    async exportBackup(slot) {
        try {
            const filename = `backup-slot-${slot}.json`;
            const backupPath = path.join(this.backupsDir, filename);
            
            if (!fs.existsSync(backupPath)) {
                return {
                    success: false,
                    error: `Backup slot ${slot} does not exist`
                };
            }
            
            const result = await dialog.showSaveDialog({
                title: 'Export Backup',
                defaultPath: `mindkeep-backup-${new Date().toISOString().split('T')[0]}.json`,
                filters: [
                    { name: 'JSON Files', extensions: ['json'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });
            
            if (!result.canceled && result.filePath) {
                await fs.promises.copyFile(backupPath, result.filePath);
                return {
                    success: true,
                    exportPath: result.filePath
                };
            }
            
            return {
                success: false,
                error: 'Export cancelled'
            };
            
        } catch (error) {
            console.error('Export failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Import backup from external file
    async importBackup(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return {
                    success: false,
                    error: 'File does not exist'
                };
            }
            
            const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Validate backup data
            if (!backupData.notes || !backupData.categories) {
                return {
                    success: false,
                    error: 'Invalid backup file format'
                };
            }
            
            // Find available slot or use oldest
            const slots = this.getBackupSlots();
            const targetSlot = this.findOldestSlot(slots);
            
            // Update backup data for import
            backupData.slot = targetSlot;
            backupData.timestamp = new Date().toISOString();
            backupData.filename = `backup-slot-${targetSlot}.json`;
            
            // Save to backup slot
            const backupPath = path.join(this.backupsDir, backupData.filename);
            await fs.promises.writeFile(backupPath, JSON.stringify(backupData, null, 2));
            
            return {
                success: true,
                slot: targetSlot,
                notesCount: backupData.notes.length,
                categoriesCount: backupData.categories.length
            };
            
        } catch (error) {
            console.error('Import failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Delete backup slot
    deleteBackup(slot) {
        try {
            const filename = `backup-slot-${slot}.json`;
            const backupPath = path.join(this.backupsDir, filename);
            
            if (fs.existsSync(backupPath)) {
                fs.unlinkSync(backupPath);
                return { success: true };
            }
            
            return {
                success: false,
                error: `Backup slot ${slot} does not exist`
            };
            
        } catch (error) {
            console.error('Delete backup failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = BackupManager;
