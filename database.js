const Database = require('better-sqlite3');
const path = require('path');

class DatabaseManager {
    constructor(dbPath) {
        this.db = new Database(dbPath);
        this.initTables();
    }

    initTables() {
        // Categories table
        this.db.exec(`CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            color TEXT NOT NULL,
            parent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Notes table
        this.db.exec(`CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT,
            category TEXT NOT NULL,
            description TEXT,
            tags TEXT,
            is_pinned INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Add is_pinned column if it doesn't exist (for existing databases)
        try {
            this.db.exec(`ALTER TABLE notes ADD COLUMN is_pinned INTEGER DEFAULT 0`);
        } catch (err) {
            // Ignore error if column already exists
        }

        // Insert default categories if they don't exist
        this.db.exec(`INSERT OR IGNORE INTO categories (name, color, parent) VALUES 
            ('General', '#4a9eff', NULL),
            ('Work', '#28a745', NULL),
            ('Projects', '#ffc107', 'Work'),
            ('Meetings', '#17a2b8', 'Work')`);
    }

    // Categories methods
    getCategories() {
        const rows = this.db.prepare('SELECT * FROM categories ORDER BY name').all();
        return Promise.resolve(rows.map(row => ({
            name: row.name,
            color: row.color,
            parent: row.parent
        })));
    }

    addCategory(name, color, parent = null) {
        try {
            const stmt = this.db.prepare('INSERT INTO categories (name, color, parent) VALUES (?, ?, ?)');
            const result = stmt.run(name, color, parent);
            return Promise.resolve(result.lastInsertRowid);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    deleteCategory(name) {
        try {
            const transaction = this.db.transaction(() => {
                this.db.prepare('UPDATE notes SET category = "General" WHERE category = ?').run(name);
                this.db.prepare('UPDATE categories SET parent = NULL WHERE parent = ?').run(name);
                const result = this.db.prepare('DELETE FROM categories WHERE name = ?').run(name);
                return result.changes;
            });
            return Promise.resolve(transaction());
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Notes methods
    getNotes(sortBy = 'updated_at DESC') {
        try {
            const rows = this.db.prepare(`SELECT * FROM notes ORDER BY is_pinned DESC, ${sortBy}`).all();
            return Promise.resolve(rows.map(row => ({
                id: row.id,
                title: row.title,
                content: row.content,
                category: row.category,
                description: row.description,
                tags: row.tags ? row.tags.split(',') : [],
                isPinned: row.is_pinned === 1,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            })));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    saveNote(note) {
        try {
            const tags = Array.isArray(note.tags) ? note.tags.join(',') : note.tags;
            const stmt = this.db.prepare(`INSERT OR REPLACE INTO notes 
                (id, title, content, category, description, tags, is_pinned, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            const result = stmt.run(note.id, note.title, note.content, note.category, note.description, 
                 tags, note.isPinned ? 1 : 0, note.createdAt, note.updatedAt);
            return Promise.resolve(result.changes);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    deleteNote(id) {
        try {
            const result = this.db.prepare('DELETE FROM notes WHERE id = ?').run(id);
            return Promise.resolve(result.changes);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    searchNotes(searchTerm) {
        return new Promise((resolve, reject) => {
            const term = `%${searchTerm}%`;
            this.db.all(`SELECT * FROM notes 
                WHERE title LIKE ? OR content LIKE ? OR description LIKE ?
                ORDER BY is_pinned DESC, updated_at DESC`, [term, term, term], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => ({
                    id: row.id,
                    title: row.title,
                    content: row.content,
                    category: row.category,
                    description: row.description,
                    tags: row.tags ? row.tags.split(',') : [],
                    isPinned: row.is_pinned === 1,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                })));
            });
        });
    }

    // Migration from JSON files
    migrateFromJSON(notesDir, categoriesFile) {
        const fs = require('fs');
        const path = require('path');
        
        return new Promise((resolve, reject) => {
            try {
                // Migrate categories
                if (fs.existsSync(categoriesFile)) {
                    const categoriesData = JSON.parse(fs.readFileSync(categoriesFile, 'utf8'));
                    categoriesData.forEach(cat => {
                        this.db.run('INSERT OR IGNORE INTO categories (name, color, parent) VALUES (?, ?, ?)',
                            [cat.name, cat.color, cat.parent]);
                    });
                }
                
                // Migrate notes
                if (fs.existsSync(notesDir)) {
                    const files = fs.readdirSync(notesDir);
                    files.forEach(file => {
                        if (file.endsWith('.json')) {
                            const noteData = JSON.parse(fs.readFileSync(path.join(notesDir, file), 'utf8'));
                            const tags = Array.isArray(noteData.tags) ? noteData.tags.join(',') : '';
                            this.db.run(`INSERT OR IGNORE INTO notes 
                                (id, title, content, category, description, tags, created_at, updated_at) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                [noteData.id, noteData.title, noteData.content, noteData.category, 
                                 noteData.description || '', tags, noteData.createdAt, noteData.updatedAt]);
                        }
                    });
                }
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    togglePinNote(id) {
        try {
            const result = this.db.prepare('UPDATE notes SET is_pinned = 1 - is_pinned WHERE id = ?').run(id);
            return Promise.resolve(result.changes);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    close() {
        this.db.close();
    }
}

module.exports = DatabaseManager;