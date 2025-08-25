const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class OptimizedDatabase {
    constructor() {
        this.dataDir = path.join(app.getPath('userData'), 'mindkeep-data');
        this.notesDir = path.join(this.dataDir, 'notes');
        this.backupsDir = path.join(this.dataDir, 'backups');
        this.metaFile = path.join(this.dataDir, 'meta.json');
        this.categoriesFile = path.join(this.dataDir, 'categories.json');
        
        // In-memory caches for performance
        this.notesCache = new Map();
        this.categoriesCache = [];
        this.metaCache = {
            totalNotes: 0,
            lastBackup: null,
            version: '1.0.0'
        };
        
        // Batch write optimization
        this.pendingWrites = new Set();
        this.writeTimeout = null;
        this.BATCH_DELAY = 500; // 500ms delay for batching writes
        
        this.ensureDirectories();
        this.loadData();
    }
    
    ensureDirectories() {
        [this.dataDir, this.notesDir, this.backupsDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }
    
    loadData() {
        // Load categories
        try {
            if (fs.existsSync(this.categoriesFile)) {
                this.categoriesCache = JSON.parse(fs.readFileSync(this.categoriesFile, 'utf8'));
            } else {
                this.categoriesCache = [{name: 'General', color: '#4a9eff', parent: null}];
                this.saveCategories();
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            this.categoriesCache = [{name: 'General', color: '#4a9eff', parent: null}];
        }
        
        // Load meta information
        try {
            if (fs.existsSync(this.metaFile)) {
                this.metaCache = { ...this.metaCache, ...JSON.parse(fs.readFileSync(this.metaFile, 'utf8')) };
            }
        } catch (error) {
            console.error('Error loading meta:', error);
        }
        
        // Load notes from individual files
        this.loadNotes();
    }
    
    loadNotes() {
        this.notesCache.clear();
        
        if (!fs.existsSync(this.notesDir)) return;
        
        const noteFiles = fs.readdirSync(this.notesDir).filter(file => file.endsWith('.json'));
        
        for (const file of noteFiles) {
            try {
                const noteData = JSON.parse(fs.readFileSync(path.join(this.notesDir, file), 'utf8'));
                this.notesCache.set(noteData.id, noteData);
            } catch (error) {
                console.error(`Error loading note ${file}:`, error);
            }
        }
        
        this.metaCache.totalNotes = this.notesCache.size;
    }
    
    // Optimized note operations
    async saveNote(note) {
        this.notesCache.set(note.id, { ...note });
        this.pendingWrites.add(note.id);
        
        // Batch writes for performance
        if (this.writeTimeout) {
            clearTimeout(this.writeTimeout);
        }
        
        this.writeTimeout = setTimeout(() => {
            this.flushPendingWrites();
        }, this.BATCH_DELAY);
        
        return true;
    }
    
    flushPendingWrites() {
        const writes = Array.from(this.pendingWrites);
        this.pendingWrites.clear();
        
        // Write notes in parallel
        const writePromises = writes.map(noteId => {
            const note = this.notesCache.get(noteId);
            if (note) {
                const filePath = path.join(this.notesDir, `${noteId}.json`);
                return fs.promises.writeFile(filePath, JSON.stringify(note, null, 2));
            }
        });
        
        Promise.all(writePromises).catch(error => {
            console.error('Error in batch write:', error);
        });
        
        // Update meta
        this.metaCache.totalNotes = this.notesCache.size;
        this.saveMeta();
    }
    
    deleteNote(id) {
        if (this.notesCache.has(id)) {
            this.notesCache.delete(id);
            const filePath = path.join(this.notesDir, `${id}.json`);
            
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            
            this.metaCache.totalNotes = this.notesCache.size;
            this.saveMeta();
            return true;
        }
        return false;
    }
    
    getNotes() {
        return Array.from(this.notesCache.values()).sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });
    }
    
    getNote(id) {
        return this.notesCache.get(id);
    }
    
    // Category operations
    getCategories() {
        return [...this.categoriesCache];
    }
    
    addCategory(name, color, parent = null) {
        this.categoriesCache.push({ name, color, parent });
        this.saveCategories();
        return true;
    }

    updateCategory(oldName, newName, color, parent = null) {
        // Find the category to update
        const categoryIndex = this.categoriesCache.findIndex(cat => cat.name === oldName);
        if (categoryIndex === -1) {
            throw new Error(`Category "${oldName}" not found`);
        }

        // Update the category
        this.categoriesCache[categoryIndex] = { name: newName, color, parent };

        // If the name changed, update all notes that use this category
        if (oldName !== newName) {
            for (const note of this.notesCache.values()) {
                if (note.category === oldName) {
                    note.category = newName;
                    this.saveNote(note);
                }
            }

            // Update any child categories that have this as parent
            for (const category of this.categoriesCache) {
                if (category.parent === oldName) {
                    category.parent = newName;
                }
            }
        }

        this.saveCategories();
        return true;
    }

    deleteCategory(name) {
        // Move notes to General category
        for (const note of this.notesCache.values()) {
            if (note.category === name) {
                note.category = 'General';
                this.saveNote(note);
            }
        }

        this.categoriesCache = this.categoriesCache.filter(cat => cat.name !== name);
        this.saveCategories();
        return true;
    }
    
    saveCategories() {
        fs.writeFileSync(this.categoriesFile, JSON.stringify(this.categoriesCache, null, 2));
    }
    
    saveMeta() {
        fs.writeFileSync(this.metaFile, JSON.stringify(this.metaCache, null, 2));
    }
    
    // Performance statistics
    getStats() {
        return {
            totalNotes: this.notesCache.size,
            totalCategories: this.categoriesCache.length,
            memoryUsage: process.memoryUsage(),
            cacheSize: this.notesCache.size
        };
    }
    
    // Force immediate write (for critical operations)
    async forceWrite() {
        if (this.writeTimeout) {
            clearTimeout(this.writeTimeout);
            this.writeTimeout = null;
        }
        this.flushPendingWrites();
    }
}

module.exports = OptimizedDatabase;
