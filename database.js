const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor(dbPath) {
        this.db = new sqlite3.Database(dbPath);
        this.initTables();
    }

    initTables() {
        this.db.serialize(() => {
            // Categories table
            this.db.run(`CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                color TEXT NOT NULL,
                parent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Notes table
            this.db.run(`CREATE TABLE IF NOT EXISTS notes (
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
            this.db.run(`ALTER TABLE notes ADD COLUMN is_pinned INTEGER DEFAULT 0`, (err) => {
                // Ignore error if column already exists
            });

            // Insert default categories if they don't exist
            this.db.run(`INSERT OR IGNORE INTO categories (name, color, parent) VALUES 
                ('General', '#4a9eff', NULL),
                ('Work', '#28a745', NULL),
                ('Projects', '#ffc107', 'Work'),
                ('Meetings', '#17a2b8', 'Work')`);
        });
    }

    // Categories methods
    getCategories() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM categories ORDER BY name', (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => ({
                    name: row.name,
                    color: row.color,
                    parent: row.parent
                })));
            });
        });
    }

    addCategory(name, color, parent = null) {
        return new Promise((resolve, reject) => {
            this.db.run('INSERT INTO categories (name, color, parent) VALUES (?, ?, ?)', 
                [name, color, parent], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    deleteCategory(name) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Move notes to General
                this.db.run('UPDATE notes SET category = "General" WHERE category = ?', [name]);
                // Update child categories to root
                this.db.run('UPDATE categories SET parent = NULL WHERE parent = ?', [name]);
                // Delete category
                this.db.run('DELETE FROM categories WHERE name = ?', [name], function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                });
            });
        });
    }

    // Notes methods
    getNotes(sortBy = 'updated_at DESC') {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT * FROM notes ORDER BY is_pinned DESC, ${sortBy}`, (err, rows) => {
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

    saveNote(note) {
        return new Promise((resolve, reject) => {
            const tags = Array.isArray(note.tags) ? note.tags.join(',') : note.tags;
            this.db.run(`INSERT OR REPLACE INTO notes 
                (id, title, content, category, description, tags, is_pinned, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [note.id, note.title, note.content, note.category, note.description, 
                 tags, note.isPinned ? 1 : 0, note.createdAt, note.updatedAt], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    deleteNote(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM notes WHERE id = ?', [id], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
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
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE notes SET is_pinned = 1 - is_pinned WHERE id = ?', [id], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = Database;