const fs = require('fs');
const path = require('path');

class MindKeep {
    constructor() {
        this.notes = [];
        this.categories = [{ name: 'General', color: '#4a9eff' }];
        this.currentNote = null;
        this.currentCategory = 'all';
        this.notesDir = path.join(__dirname, 'notes');
        this.imagesDir = path.join(__dirname, 'images');
        this.categoriesFile = path.join(__dirname, 'categories.json');
        this.init();
    }

    init() {
        this.ensureNotesDir();
        this.loadCategories();
        this.loadNotes();
        this.bindEvents();
        this.renderCategories();
        this.renderNotesList();
    }

    ensureNotesDir() {
        if (!fs.existsSync(this.notesDir)) {
            fs.mkdirSync(this.notesDir, { recursive: true });
        }
        if (!fs.existsSync(this.imagesDir)) {
            fs.mkdirSync(this.imagesDir, { recursive: true });
        }
    }

    loadCategories() {
        try {
            if (fs.existsSync(this.categoriesFile)) {
                const data = fs.readFileSync(this.categoriesFile, 'utf8');
                this.categories = JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    saveCategories() {
        try {
            fs.writeFileSync(this.categoriesFile, JSON.stringify(this.categories, null, 2));
        } catch (error) {
            console.error('Error saving categories:', error);
        }
    }

    loadNotes() {
        try {
            const files = fs.readdirSync(this.notesDir);
            this.notes = [];
            
            files.forEach(file => {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.notesDir, file);
                    const data = fs.readFileSync(filePath, 'utf8');
                    const note = JSON.parse(data);
                    this.notes.push(note);
                }
            });
            
            this.notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        } catch (error) {
            console.error('Error loading notes:', error);
        }
    }

    saveNote(noteData) {
        const noteId = noteData.id || Date.now().toString();
        const note = {
            ...noteData,
            id: noteId,
            updatedAt: new Date().toISOString()
        };

        if (!note.createdAt) {
            note.createdAt = note.updatedAt;
        }

        try {
            const filePath = path.join(this.notesDir, `${noteId}.json`);
            fs.writeFileSync(filePath, JSON.stringify(note, null, 2));
            
            const existingIndex = this.notes.findIndex(n => n.id === noteId);
            if (existingIndex >= 0) {
                this.notes[existingIndex] = note;
            } else {
                this.notes.unshift(note);
            }
            
            return note;
        } catch (error) {
            console.error('Error saving note:', error);
            throw error;
        }
    }

    deleteNote(noteId) {
        try {
            const filePath = path.join(this.notesDir, `${noteId}.json`);
            fs.unlinkSync(filePath);
            this.notes = this.notes.filter(n => n.id !== noteId);
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    }

    searchNotes(query) {
        if (!query.trim()) return this.getFilteredNotes();
        
        return this.getFilteredNotes().filter(note => 
            note.title.toLowerCase().includes(query.toLowerCase()) ||
            note.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
        );
    }

    getFilteredNotes() {
        if (this.currentCategory === 'all') {
            return this.notes;
        }
        return this.notes.filter(note => note.category === this.currentCategory);
    }

    bindEvents() {
        // Basic events
        document.getElementById('newNoteBtn').addEventListener('click', () => this.createNewNote());
        document.getElementById('createFirstNote').addEventListener('click', () => this.createNewNote());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveCurrentNote());
        document.getElementById('cancelBtn').addEventListener('click', () => this.cancelEdit());
        document.getElementById('editBtn').addEventListener('click', () => this.editCurrentNote());
        document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e.target.value));
        
        // Category buttons
        document.getElementById('newCategoryBtn').addEventListener('click', () => this.createNewCategory());
        document.getElementById('manageCategoriesBtn').addEventListener('click', () => this.manageCategories());
        document.getElementById('updateBtn').addEventListener('click', () => this.checkForUpdates());
        
        // Category selector
        document.getElementById('categorySelector').addEventListener('change', (e) => this.filterByCategory(e.target.value));
        
        // Ctrl+S shortcut
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveCurrentNote();
            }
        });
        
        this.setupImageDragDrop();
        this.bindModalEvents();
    }

    bindModalEvents() {
        // Category modal events
        document.getElementById('saveCategoryBtn').addEventListener('click', () => this.saveCategoryModal());
        document.getElementById('closeCategoryBtn').addEventListener('click', () => this.closeCategoryModal());
        
        // Manage categories modal events
        document.getElementById('closeManageCategoriesBtn').addEventListener('click', () => this.closeManageCategoriesModal());
        
        // Update modal events
        document.getElementById('downloadUpdateBtn').addEventListener('click', () => this.downloadUpdate());
        document.getElementById('closeUpdateBtn').addEventListener('click', () => this.closeUpdateModal());
        document.getElementById('closeNoUpdateBtn').addEventListener('click', () => this.closeNoUpdateModal());
        document.getElementById('closeUpdateErrorBtn').addEventListener('click', () => this.closeUpdateErrorModal());
    }

    createNewCategory() {
        document.getElementById('categoryModal').style.display = 'flex';
        document.getElementById('categoryNameInput').focus();
    }

    closeCategoryModal() {
        document.getElementById('categoryModal').style.display = 'none';
        document.getElementById('categoryNameInput').value = '';
        document.getElementById('categoryColorInput').value = '#4a9eff';
    }

    saveCategoryModal() {
        const categoryName = document.getElementById('categoryNameInput').value.trim();
        const color = document.getElementById('categoryColorInput').value;
        
        if (categoryName) {
            const exists = this.categories.some(cat => cat.name === categoryName);
            if (!exists) {
                this.categories.push({ name: categoryName, color: color });
                this.saveCategories();
                this.renderCategories();
                this.closeCategoryModal();
            } else {
                alert('Category already exists!');
            }
        }
    }

    manageCategories() {
        document.getElementById('manageCategoriesModal').style.display = 'flex';
        this.renderCategoriesList();
    }

    closeManageCategoriesModal() {
        document.getElementById('manageCategoriesModal').style.display = 'none';
    }

    renderCategoriesList() {
        const categoriesList = document.getElementById('categoriesList');
        
        categoriesList.innerHTML = this.categories.map(cat => `
            <div class="category-item" style="border-left-color: ${cat.color};">
                <div class="category-info">
                    <span>${cat.name}</span>
                    <span style="color: #888;">(${cat.color})</span>
                </div>
                ${cat.name !== 'General' ? 
                    `<button class="category-delete" onclick="window.mindKeep.deleteCategoryFromModal('${cat.name}')">Delete</button>` : 
                    '<span style="color: #888;">Default</span>'
                }
            </div>
        `).join('');
    }

    deleteCategoryFromModal(categoryName) {
        if (confirm(`Delete category "${categoryName}"? Notes in this category will be moved to General.`)) {
            this.deleteCategory(categoryName);
            this.renderCategoriesList();
        }
    }

    deleteCategory(categoryName) {
        if (categoryName === 'General') {
            alert('Cannot delete General category');
            return;
        }
        
        if (confirm(`Delete category "${categoryName}"? Notes in this category will be moved to General.`)) {
            // Move notes to General
            this.notes.forEach(note => {
                if (note.category === categoryName) {
                    note.category = 'General';
                    this.saveNote(note);
                }
            });
            
            // Remove category
            this.categories = this.categories.filter(cat => cat.name !== categoryName);
            this.saveCategories();
            this.renderCategories();
            this.renderNotesList();
        }
    }

    filterByCategory(category) {
        this.currentCategory = category;
        this.renderNotesList();
    }

    renderCategories() {
        const categorySelector = document.getElementById('categorySelector');
        const noteCategory = document.getElementById('noteCategory');
        
        // Sidebar category filter
        categorySelector.innerHTML = '<option value="all">All Notes</option>' + 
            this.categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('');
        categorySelector.value = this.currentCategory;
        
        // Note category selector
        noteCategory.innerHTML = '<option value="">Select Category</option>' + 
            this.categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('');
    }

    setupImageDragDrop() {
        const imageContainer = document.getElementById('imageContainer');
        
        imageContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            imageContainer.classList.add('drag-over');
        });
        
        imageContainer.addEventListener('dragleave', (e) => {
            e.preventDefault();
            imageContainer.classList.remove('drag-over');
        });
        
        imageContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            imageContainer.classList.remove('drag-over');
            
            const files = Array.from(e.dataTransfer.files);
            files.forEach(file => {
                if (file.type.startsWith('image/')) {
                    this.addImageToNote(file);
                }
            });
        });
        
        // Paste support
        document.addEventListener('paste', (e) => {
            const items = Array.from(e.clipboardData.items);
            items.forEach(item => {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    this.addImageToNote(file);
                }
            });
        });
    }

    addImageToNote(file) {
        if (!this.currentNote) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;
            const imageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            
            // Save image to file system
            const imagePath = path.join(this.imagesDir, `${imageId}.png`);
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            try {
                fs.writeFileSync(imagePath, buffer);
                
                // Add to current note
                if (!this.currentNote.images) {
                    this.currentNote.images = [];
                }
                
                // Check if image already exists to prevent duplicates
                const exists = this.currentNote.images.some(img => img.data === imageData);
                if (!exists) {
                    this.currentNote.images.push({
                        id: imageId,
                        path: imagePath,
                        data: imageData
                    });
                    
                    this.renderImages();
                }
            } catch (error) {
                console.error('Error saving image:', error);
            }
        };
        reader.readAsDataURL(file);
    }

    renderImages() {
        const imageContainer = document.getElementById('imageContainer');
        
        if (!this.currentNote || !this.currentNote.images || this.currentNote.images.length === 0) {
            imageContainer.innerHTML = '<div class="drop-zone-text">Drop images here or paste screenshots</div>';
            return;
        }
        
        imageContainer.innerHTML = this.currentNote.images.map(image => `
            <div class="image-item" data-image-id="${image.id}">
                <img src="${image.data}" alt="Note image">
                <button class="image-delete" onclick="window.mindKeep.removeImage('${image.id}')">×</button>
            </div>
        `).join('');
    }

    removeImage(imageId) {
        if (this.currentNote && this.currentNote.images) {
            // Remove from note
            this.currentNote.images = this.currentNote.images.filter(img => img.id !== imageId);
            
            // Delete file from disk
            try {
                const imagePath = path.join(this.imagesDir, `${imageId}.png`);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            } catch (error) {
                console.error('Error deleting image file:', error);
            }
            
            this.renderImages();
        }
    }

    cleanupUnusedImages() {
        try {
            // Get all image files
            const imageFiles = fs.readdirSync(this.imagesDir);
            
            // Get all image IDs used in notes
            const usedImageIds = new Set();
            this.notes.forEach(note => {
                if (note.images) {
                    note.images.forEach(img => usedImageIds.add(img.id));
                }
            });
            
            // Delete unused images
            imageFiles.forEach(file => {
                const imageId = file.replace('.png', '');
                if (!usedImageIds.has(imageId)) {
                    const filePath = path.join(this.imagesDir, file);
                    fs.unlinkSync(filePath);
                }
            });
        } catch (error) {
            console.error('Error cleaning up images:', error);
        }
    }

    changeFont(fontFamily) {
        if (fontFamily) {
            document.execCommand('fontName', false, fontFamily);
            document.getElementById('fontSelector').value = ''; // Reset dropdown
        }
    }

    createNewNote() {
        this.currentNote = {
            id: null,
            title: '',
            content: '',
            description: '',
            category: this.currentCategory === 'all' ? 'General' : this.currentCategory,
            tags: [],
            images: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.showEditor();
    }

    editCurrentNote() {
        if (this.currentNote) {
            this.showEditor();
        }
    }

    saveCurrentNote() {
        const title = document.getElementById('noteTitle').value || 'Untitled';
        const content = document.getElementById('noteContent').innerHTML;
        const description = document.getElementById('noteDescription').value || '';
        const category = document.getElementById('noteCategory').value || 'General';
        const tagsInput = document.getElementById('noteTags').value;
        const tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag);

        const noteData = {
            ...this.currentNote,
            title,
            content,
            description,
            category,
            tags
        };

        this.currentNote = this.saveNote(noteData);
        this.cleanupUnusedImages();
        this.renderNotesList();
        this.showViewer();
    }

    cancelEdit() {
        if (this.currentNote && this.currentNote.id) {
            this.showViewer();
        } else {
            this.showWelcome();
        }
    }

    selectNote(note) {
        this.currentNote = note;
        this.showViewer();
        this.updateActiveNote();
    }

    handleSearch(query) {
        const filteredNotes = this.searchNotes(query);
        this.renderNotesList(filteredNotes);
    }

    showWelcome() {
        document.getElementById('welcomeScreen').style.display = 'flex';
        document.getElementById('editor').style.display = 'none';
        document.getElementById('viewer').style.display = 'none';
    }

    showEditor() {
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('editor').style.display = 'flex';
        document.getElementById('viewer').style.display = 'none';

        if (this.currentNote) {
            document.getElementById('noteTitle').value = this.currentNote.title || '';
            document.getElementById('noteContent').innerHTML = this.currentNote.content || '';
            document.getElementById('noteDescription').value = this.currentNote.description || '';
            document.getElementById('noteCategory').value = this.currentNote.category || 'General';
            document.getElementById('noteTags').value = this.currentNote.tags.join(', ');
            this.renderImages();
        }
    }

    showViewer() {
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('editor').style.display = 'none';
        document.getElementById('viewer').style.display = 'flex';

        if (this.currentNote) {
            document.getElementById('viewerTitle').textContent = this.currentNote.title;
            
            let content = this.currentNote.content || '';
            
            // Add images to viewer
            if (this.currentNote.images && this.currentNote.images.length > 0) {
                const imagesHtml = this.currentNote.images.map(image => 
                    `<img src="${image.data}" style="max-width: 100%; margin: 1rem 0; border-radius: 4px;" alt="Note image">`
                ).join('');
                content += '<div class="viewer-images">' + imagesHtml + '</div>';
            }
            
            document.getElementById('viewerContent').innerHTML = content;
            
            const metaDiv = document.getElementById('viewerMeta');
            metaDiv.innerHTML = `
                <span>Category: ${this.currentNote.category || 'General'}</span>
                <span>Created: ${new Date(this.currentNote.createdAt).toLocaleDateString()}</span>
                <span>Updated: ${new Date(this.currentNote.updatedAt).toLocaleDateString()}</span>
            `;
            
            const tagsDiv = document.getElementById('viewerTags');
            tagsDiv.innerHTML = this.currentNote.tags.map(tag => 
                `<span class="tag">#${tag}</span>`
            ).join('');
        }
    }

    renderNotesList(notesToRender = this.getFilteredNotes()) {
        const notesList = document.getElementById('notesList');
        
        if (notesToRender.length === 0) {
            notesList.innerHTML = '<div style="padding: 1rem; text-align: center; color: #888;">No notes found</div>';
            return;
        }

        notesList.innerHTML = notesToRender.map(note => {
            const category = this.categories.find(cat => cat.name === note.category) || { color: '#4a9eff' };
            return `
                <div class="note-item" data-note-id="${note.id}" style="border-left: 4px solid ${category.color};">
                    <div class="note-title">${note.title}</div>
                    ${note.description ? `<div class="note-description">${note.description}</div>` : ''}
                    <div class="note-meta">
                        <span class="note-date">${new Date(note.updatedAt).toLocaleDateString()}</span>
                        <button class="delete-btn" data-note-id="${note.id}">×</button>
                    </div>
                    ${note.tags && note.tags.length > 0 ? `
                        <div class="note-tags">
                            ${note.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        // Bind click events
        notesList.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-btn')) {
                    e.stopPropagation();
                    const noteId = e.target.dataset.noteId;
                    this.deleteNote(noteId);
                    this.renderNotesList();
                    if (this.currentNote && this.currentNote.id === noteId) {
                        this.currentNote = null;
                        this.showWelcome();
                    }
                } else {
                    const noteId = item.dataset.noteId;
                    const note = this.notes.find(n => n.id === noteId);
                    if (note) {
                        this.selectNote(note);
                    }
                }
            });
        });

        this.updateActiveNote();
    }

    updateActiveNote() {
        document.querySelectorAll('.note-item').forEach(item => {
            item.classList.remove('active');
        });

        if (this.currentNote) {
            const activeItem = document.querySelector(`[data-note-id="${this.currentNote.id}"]`);
            if (activeItem) {
                activeItem.classList.add('active');
            }
        }
    }

    async checkForUpdates() {
        try {
            const response = await fetch('https://api.github.com/repos/SebastianOana/mindkeep-desktop/releases/latest');
            const release = await response.json();
            const latestVersion = release.tag_name;
            const currentVersion = '1.0.0'; // Update this when you release new versions
            
            if (latestVersion !== currentVersion) {
                this.showUpdateAvailable(currentVersion, latestVersion, release.html_url);
            } else {
                this.showNoUpdate();
            }
        } catch (error) {
            this.showUpdateError();
        }
    }

    showUpdateAvailable(current, latest, downloadUrl) {
        this.updateDownloadUrl = downloadUrl;
        document.getElementById('updateMessage').textContent = `Current version: ${current}\nNew version: ${latest}`;
        document.getElementById('updateAvailableModal').style.display = 'flex';
    }

    showNoUpdate() {
        document.getElementById('noUpdateModal').style.display = 'flex';
    }

    showUpdateError() {
        document.getElementById('updateErrorModal').style.display = 'flex';
    }

    downloadUpdate() {
        if (this.updateDownloadUrl) {
            window.open(this.updateDownloadUrl, '_blank');
        }
        this.closeUpdateModal();
    }

    closeUpdateModal() {
        document.getElementById('updateAvailableModal').style.display = 'none';
    }

    closeNoUpdateModal() {
        document.getElementById('noUpdateModal').style.display = 'none';
    }

    closeUpdateErrorModal() {
        document.getElementById('updateErrorModal').style.display = 'none';
    }
}

// Initialize the app when DOM is loaded
window.mindKeep = null;

function initializeApp() {
    window.mindKeep = new MindKeep();
    console.log('MindKeep initialized');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}