/**
 * MindKeep Desktop - Renderer Process
 *
 * This is the main renderer process that handles all UI interactions,
 * data management, and user interface logic for the MindKeep application.
 *
 * Key Features:
 * - Rich text editing with formatting toolbar
 * - Advanced search with fuzzy matching
 * - Category management with drag & drop
 * - Import/Export with smart tag extraction
 * - Theme management and responsive design
 * - Performance monitoring and optimization
 *
 * Architecture:
 * - Uses modular design with separate modules for specific functionality
 * - Implements MVC-like pattern with clear separation of concerns
 * - Utilizes modern JavaScript features (async/await, ES6+)
 * - Follows security best practices with input validation
 */

// ============================================================================
// GLOBAL STATE MANAGEMENT
// ============================================================================

// Core application data
let categories = [];        // Array of note categories with metadata
let notes = [];            // Array of all notes in the application
let editingCategory = null; // Currently selected category for editing

// UI state variables are declared later in the file to avoid conflicts

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

/**
 * Initializes the MindKeep application
 * Loads data, builds search index, and sets up the UI
 */
async function initApp() {
    try {
        logger.info('Initializing MindKeep application');
        performanceMonitor.start('app-initialization');

        // Load categories from database
        logger.debug('Loading categories from database');
        categories = await window.electronAPI.getCategories();
        logger.info(`Loaded ${categories.length} categories`);

        // Load notes from database
        logger.debug('Loading notes from database');
        notes = await window.electronAPI.getNotes();
        logger.info(`Loaded ${notes.length} notes`);

        // Build search index for better performance
        logger.debug('Building search index');
        searchIndex.clear();
        notes.forEach(note => {
            const searchContent = `${note.title} ${note.content} ${note.description || ''} ${(note.tags || []).join(' ')}`;
            searchIndex.addDocument(note.id, searchContent, {
                title: note.title,
                category: note.category,
                updatedAt: note.updatedAt
            });
        });
        logger.info('Search index built successfully');

        updateCategorySelector();
        updateNotesList();

        performanceMonitor.end('app-initialization');
        logger.info('Application initialized successfully');
    } catch (error) {
        logger.error('Initialization error', error);
        updateCategorySelector();
        updateNotesList();

        // Show user-friendly error message
        showAlert('⚠️ Warning', 'Some data could not be loaded. The app will continue with limited functionality.');
    }
}

async function loadNotes() {
    try {
        notes = await window.electronAPI.getNotes();

        // Initialize managers after notes are loaded
        if (typeof initializeTagManager === 'function') {
            initializeTagManager();
        }
        if (typeof initializeTaskManager === 'function') {
            initializeTaskManager();
        }
    } catch (error) {
        console.error('Error loading notes:', error);
    }
}

// UI State Management
let currentCategory = 'all';        // Currently selected category filter ('all' or category name)
let bulkMode = false;               // Whether bulk selection mode is active
let selectedNotes = new Set();      // Set of selected note IDs in bulk mode

let expandedCategories = new Set();

// Helper function to calculate total note count for a category (including all subcategories)
function getTotalNoteCount(categoryName) {
    // Get direct notes in this category
    let totalCount = notes.filter(note => note.category === categoryName).length;

    // Get all subcategories recursively
    const getSubcategories = (parentName) => {
        const subcategories = categories.filter(cat => cat.parent === parentName);
        subcategories.forEach(subCat => {
            const subCatNotes = notes.filter(note => note.category === subCat.name).length;
            totalCount += subCatNotes;
            getSubcategories(subCat.name); // Recursive call for nested subcategories
        });
    };

    getSubcategories(categoryName);

    // Debug logging for development
    if (logger && logger.debug) {
        logger.debug(`Total note count for "${categoryName}": ${totalCount}`);
    }

    return totalCount;
}

// Enhanced search function with advanced filtering
function performEnhancedSearch(searchTerm, notesToFilter) {
    // Handle special search syntax
    if (searchTerm.startsWith('#')) {
        // Tag search: #tagname
        const tagSearch = searchTerm.substring(1).toLowerCase();
        return notesToFilter.filter(note =>
            note.tags && note.tags.some(tag => tag.toLowerCase().includes(tagSearch))
        );
    }

    if (searchTerm.startsWith('category:')) {
        // Category search: category:work
        const categorySearch = searchTerm.substring(9).toLowerCase();
        return notesToFilter.filter(note =>
            note.category && note.category.toLowerCase().includes(categorySearch)
        );
    }

    if (searchTerm.startsWith('date:')) {
        // Date search: date:2024 or date:2024-01
        const dateSearch = searchTerm.substring(5);
        return notesToFilter.filter(note => {
            const noteDate = new Date(note.updatedAt).toISOString().substring(0, 10);
            return noteDate.includes(dateSearch);
        });
    }

    if (searchTerm.includes(' AND ')) {
        // AND search: term1 AND term2
        const terms = searchTerm.split(' AND ').map(t => t.trim().toLowerCase());
        return notesToFilter.filter(note => {
            const searchContent = `${note.title} ${note.content} ${note.description || ''} ${(note.tags || []).join(' ')}`.toLowerCase();
            return terms.every(term => searchContent.includes(term));
        });
    }

    if (searchTerm.includes(' OR ')) {
        // OR search: term1 OR term2
        const terms = searchTerm.split(' OR ').map(t => t.trim().toLowerCase());
        return notesToFilter.filter(note => {
            const searchContent = `${note.title} ${note.content} ${note.description || ''} ${(note.tags || []).join(' ')}`.toLowerCase();
            return terms.some(term => searchContent.includes(term));
        });
    }

    // Default: use search index for better performance
    const searchResults = searchIndex.search(searchTerm);
    const searchResultIds = new Set(searchResults);
    return notesToFilter.filter(note => searchResultIds.has(note.id));
}

function updateCategorySelector() {
    const tree = document.getElementById('categoriesTree');
    const noteCategory = document.getElementById('noteCategory');

    const buildCategoryOptions = (cats, parentName = null, level = 0) => {
        const children = cats.filter(cat => cat.parent === parentName);
        let options = '';

        children.forEach(cat => {
            const indent = '\u00A0\u00A0\u00A0\u00A0'.repeat(level);
            options += `<option value="${cat.name}">${indent}${cat.name}</option>`;
            options += buildCategoryOptions(cats, cat.name, level + 1);
        });

        return options;
    };
    
    // Build tree structure
    const allNotesCount = notes.length;
    
    let treeHtml = `
        <div class="category-item root-category ${currentCategory === 'all' ? 'active' : ''}" onclick="selectCategory('all')">
            <span class="category-icon">📁</span>
            <span class="category-name">All Notes</span>
            <span class="note-count">${allNotesCount}</span>
        </div>
    `;
    
    categories.filter(cat => !cat.parent).forEach(cat => {
        const noteCount = getTotalNoteCount(cat.name);
        const children = categories.filter(c => c.parent === cat.name);
        const hasChildren = children.length > 0;
        const isExpanded = expandedCategories.has(cat.name);

        treeHtml += `
            <div class="category-item ${currentCategory === cat.name ? 'active' : ''}"
                    data-category-name="${cat.name}"
                    ondragover="handleCategoryReorderDragOver(event)"
                    ondragleave="handleCategoryDragLeave(event)"
                    ondrop="handleCategoryReorderDrop(event)">
                <span class="drag-handle"
                        draggable="true"
                        ondragstart="handleCategoryDragStart(event)"
                        ondragend="handleCategoryDragEnd(event)"
                        title="Drag to reorder">⋮</span>
                ${hasChildren ? `<span class="expand-arrow ${isExpanded ? 'expanded' : ''}" onclick="toggleCategory('${cat.name}'); event.stopPropagation();">▶</span>` : '<span class="expand-spacer"></span>'}
                <span class="category-icon" style="color: ${cat.color}" onclick="selectCategory('${cat.name}')">📁</span>
                <span class="category-name" onclick="selectCategory('${cat.name}')" oncontextmenu="window.showCategoryContextMenu(event, '${cat.name}'); return false;">${cat.name}</span>
                <span class="note-count" onclick="selectCategory('${cat.name}')">${noteCount}</span>
            </div>
        `;
        
        if (hasChildren && isExpanded) {
            const buildSubTree = (parentName, level) => {
                const subChildren = categories.filter(c => c.parent === parentName);
                let subHtml = '';
                subChildren.forEach(subCat => {
                    const subNoteCount = getTotalNoteCount(subCat.name);
                    const subSubChildren = categories.filter(c => c.parent === subCat.name);
                    const subHasChildren = subSubChildren.length > 0;
                    const subIsExpanded = expandedCategories.has(subCat.name);
                    const marginLeft = level * 1.5;
                    
                    subHtml += `
                        <div class="category-item ${currentCategory === subCat.name ? 'active' : ''}" 
                                style="margin-left: ${marginLeft}rem;"
                                data-category-name="${subCat.name}"
                                ondragover="handleCategoryReorderDragOver(event)" 
                                ondragleave="handleCategoryDragLeave(event)" 
                                ondrop="handleCategoryReorderDrop(event)">
                            <span class="drag-handle" 
                                    draggable="true"
                                    ondragstart="handleCategoryDragStart(event)"
                                    ondragend="handleCategoryDragEnd(event)"
                                    title="Drag to reorder">⋮</span>
                            ${subHasChildren ? `<span class="expand-arrow ${subIsExpanded ? 'expanded' : ''}" onclick="toggleCategory('${subCat.name}'); event.stopPropagation();">▶</span>` : '<span class="expand-spacer"></span>'}
                            <span class="category-icon" style="color: ${subCat.color}" onclick="selectCategory('${subCat.name}')">📁</span>
                            <span class="category-name" onclick="selectCategory('${subCat.name}')" oncontextmenu="window.showCategoryContextMenu(event, '${subCat.name}'); return false;">${subCat.name}</span>
                            <span class="note-count" onclick="selectCategory('${subCat.name}')">${subNoteCount}</span>
                        </div>
                    `;
                    
                    if (subHasChildren && subIsExpanded) {
                        subHtml += buildSubTree(subCat.name, level + 1);
                    }
                });
                return subHtml;
            };
            
            treeHtml += buildSubTree(cat.name, 1);
        }
    });
    
    tree.innerHTML = treeHtml;
    
    const noteOptions = '<option value="">Select Category</option>' + buildCategoryOptions(categories);
    noteCategory.innerHTML = noteOptions;
}

function toggleCategory(categoryName) {
    if (expandedCategories.has(categoryName)) {
        expandedCategories.delete(categoryName);
    } else {
        expandedCategories.add(categoryName);
    }
    updateCategorySelector();
}

function selectCategory(categoryName) {
    currentCategory = categoryName;
    updateCategorySelector();
    updateNotesList();
}



function updateNotesList() {
    const notesList = document.getElementById('notesList');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    logger.debug('Updating notes list', { searchTerm, currentCategory });

    // Filter notes by selected category
    let filteredNotes = currentCategory === 'all' ?
        notes : notes.filter(note => note.category === currentCategory);

    // Filter by search term using enhanced search logic
    if (searchTerm) {
        filteredNotes = performEnhancedSearch(searchTerm, filteredNotes);
    }
    
    if (filteredNotes.length === 0) {
        notesList.innerHTML = '<div class="no-notes-message">No notes found</div>';
        return;
    }
    
    notesList.innerHTML = filteredNotes.map(note => {
        const category = categories.find(cat => cat.name === note.category) || { color: '#4a9eff' };
        const isSelected = selectedNotes.has(note.id);
        const checkboxHtml = bulkMode ? `<input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleNoteSelection('${note.id}')" onclick="event.stopPropagation()">` : '';
        const pinIcon = note.isPinned ? '📌' : '';
        
        return `
            <div class="note-item ${isSelected ? 'selected' : ''} ${note.isPinned ? 'pinned' : ''}"
                    style="border-left: 4px solid ${category.color};"
                    data-note-id="${note.id}"
                    onclick="${bulkMode ? `toggleNoteSelection('${note.id}')` : `viewNote('${note.id}')`}"
                    oncontextmenu="showNoteContextMenu(event, '${note.id}'); return false;">
                ${checkboxHtml}
                <div class="note-content-wrapper">
                    <div class="note-title">
                        ${pinIcon}
                        <span>${highlightSearchTerm(note.title)}</span>
                    </div>
                    <div class="note-date">${new Date(note.updatedAt).toLocaleDateString()}</div>
                </div>
                ${!bulkMode ? `<button class="pin-btn" onclick="togglePin('${note.id}'); event.stopPropagation();" title="${note.isPinned ? 'Unpin' : 'Pin'} note">${note.isPinned ? '📌' : '📍'}</button>` : ''}
            </div>
        `;
    }).join('');
}

// Process note links @NoteName
function processNoteLinks(text) {
    if (!text) return text;
    
    return text.replace(/@([A-Za-z0-9\s\-_]+)/g, (_, noteName) => {
        const trimmedName = noteName.trim();
        const linkedNote = notes.find(note => 
            note.title.toLowerCase().trim() === trimmedName.toLowerCase().trim()
        );
        
        if (linkedNote) {
            return `<span class="note-link" data-note-id="${linkedNote.id}" style="color: #4a9eff !important; cursor: pointer; text-decoration: underline; font-weight: bold; background: rgba(74, 158, 255, 0.1); padding: 0.1rem 0.2rem; border-radius: 3px;">@${trimmedName}</span>`;
        } else {
            return `<span style="color: #888;">@${trimmedName}</span>`;
        }
    });
}

// Bulk operations
function toggleBulkMode() {
    bulkMode = !bulkMode;
    selectedNotes.clear();
    const bulkActions = document.getElementById('bulkActions');
    const toggleBtn = document.querySelector('.bulk-toggle-btn');
    const toggleIcon = toggleBtn.querySelector('.btn-icon');
    const toggleText = toggleBtn.querySelector('.btn-text');
    const newNoteBtn = document.querySelector('.new-note-btn');
    const templateBtn = document.querySelector('.template-btn');

    bulkActions.style.display = bulkMode ? 'flex' : 'none';

    if (bulkMode) {
        toggleBtn.style.display = 'none';
        newNoteBtn.style.display = 'none';
        templateBtn.style.display = 'none';
    } else {
        toggleBtn.style.display = 'flex';
        newNoteBtn.style.display = 'flex';
        templateBtn.style.display = 'flex';
        toggleIcon.textContent = '☑️';
        toggleText.textContent = 'Select';
        // Remove any inline styles and active class
        toggleBtn.style.background = '';
        toggleBtn.classList.remove('active');
    }

    updateNotesList();
}

function toggleNoteSelection(noteId) {
    if (selectedNotes.has(noteId)) {
        selectedNotes.delete(noteId);
    } else {
        selectedNotes.add(noteId);
    }
    
    // Update selection counter immediately
    updateSelectionCounter();
    updateNotesList();
}

function updateSelectionCounter() {
    const bulkActions = document.getElementById('bulkActions');
    const selectionCount = document.querySelector('.selection-count');
    
    if (bulkActions && selectionCount && bulkMode) {
        const count = selectedNotes.size;
        bulkActions.setAttribute('data-selected-count', count);
        selectionCount.textContent = `${count} selected`;
        
        // Enable/disable action buttons based on selection
        const actionButtons = document.querySelectorAll('.bulk-btn:not(.bulk-exit-btn)');
        actionButtons.forEach(btn => {
            btn.disabled = count === 0;
            btn.style.opacity = count === 0 ? '0.5' : '1';
        });
    }
}

function bulkDelete() {
    if (selectedNotes.size === 0) {
        showAlert('⚠️ Warning', 'No notes selected.');
        return;
    }
    
    showConfirm(
        'Delete Selected Notes',
        `<div class="delete-warning">
            <div class="warning-icon">🗑️</div>
            <div class="warning-text">
                <strong>Delete ${selectedNotes.size} selected note${selectedNotes.size > 1 ? 's' : ''}?</strong>
                <p>This action cannot be undone.</p>
            </div>
        </div>`,
        () => {
        selectedNotes.forEach(noteId => {
            try {
                const filePath = path.join(notesDir, noteId + '.json');
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                notes = notes.filter(note => note.id !== noteId);
            } catch (error) {
                console.error('Error deleting note:', error);
            }
        });
        
            selectedNotes.clear();
            updateNotesList();
            showAlert('✅ Success', 'Selected notes deleted!');
        },
        'Delete Notes',
        '🗑️'
    );
}

function bulkMove() {
    if (selectedNotes.size === 0) {
        showAlert('⚠️ Warning', 'No notes selected.');
        return;
    }
    
    document.getElementById('selectedCount').textContent = selectedNotes.size;
    const buildHierarchicalOptions = (parentName = null, level = 0) => {
        const children = categories.filter(cat => cat.parent === parentName);
        let options = '';
        
        children.forEach(cat => {
            const indent = '\u00A0\u00A0\u00A0'.repeat(level);
            options += `<option value="${cat.name}">${indent}${cat.name}</option>`;
            options += buildHierarchicalOptions(cat.name, level + 1);
        });
        
        return options;
    };
    
    const bulkMoveSelect = document.getElementById('bulkMoveToCategory');
    bulkMoveSelect.innerHTML = '<option value="">Select Category</option>' + buildHierarchicalOptions();
    document.getElementById('bulkMoveModal').style.display = 'flex';
}

async function confirmBulkMove() {
    const newCategory = document.getElementById('bulkMoveToCategory').value;
    if (!newCategory) {
        showAlert('⚠️ Warning', 'Please select a category.');
        return;
    }

    logger.info('Bulk moving notes to category', { count: selectedNotes.size, newCategory });
    performanceMonitor.start('bulk-move-notes');

    try {
        const movePromises = [];

        selectedNotes.forEach(noteId => {
            const note = notes.find(n => n.id === noteId);
            if (note) {
                note.category = newCategory;
                note.updatedAt = new Date().toISOString();

                // Add to batch for saving
                movePromises.push(window.electronAPI.saveNote(note));

                // Update search index
                const searchContent = `${note.title} ${note.content} ${note.description || ''} ${(note.tags || []).join(' ')}`;
                searchIndex.addDocument(note.id, searchContent, {
                    title: note.title,
                    category: note.category,
                    updatedAt: note.updatedAt
                });
            }
        });

        // Save all notes in parallel
        await Promise.all(movePromises);

        // Refresh notes from database
        notes = await window.electronAPI.getNotes();

        selectedNotes.clear();
        updateNotesList();
        updateCategorySelector();
        closeBulkMoveModal();

        performanceMonitor.end('bulk-move-notes');
        logger.info('Bulk move completed successfully', { count: movePromises.length, newCategory });
        showAlert('✅ Success', `${movePromises.length} notes moved to "${newCategory}" successfully!`);
    } catch (error) {
        logger.error('Error in bulk move', { newCategory, error });
        showAlert('❌ Error', 'Error moving notes: ' + error.message);
    }
}

function closeBulkMoveModal() {
    document.getElementById('bulkMoveModal').style.display = 'none';
}

// Find duplicates
function findDuplicates() {
    const duplicates = [];
    const seen = new Map();
    
    notes.forEach(note => {
        const key = note.title.toLowerCase().trim();
        if (seen.has(key)) {
            const existing = seen.get(key);
            if (!duplicates.find(d => d.original.id === existing.id)) {
                duplicates.push({ original: existing, duplicates: [note] });
            } else {
                duplicates.find(d => d.original.id === existing.id).duplicates.push(note);
            }
        } else {
            seen.set(key, note);
        }
    });
    
    if (duplicates.length === 0) {
        showAlert('✅ No Duplicates', 'No duplicate notes found!');
        return;
    }
    
    const duplicatesList = document.getElementById('duplicatesList');
    duplicatesList.innerHTML = duplicates.map(group => `
        <div class="duplicate-group" style="margin-bottom: 20px; padding: 15px; background: #333; border-radius: 8px;">
            <h4 style="color: #e0e0e0; margin-bottom: 10px;">"${group.original.title}"</h4>
            <div class="duplicate-item" style="margin-bottom: 10px; padding: 10px; background: #404040; border-radius: 4px;">
                <strong>Original:</strong> ${new Date(group.original.createdAt).toLocaleDateString()}
                <button onclick="viewNote('${group.original.id}'); closeDuplicatesModal();" style="margin-left: 10px;">View</button>
            </div>
            ${group.duplicates.map(dup => `
                <div class="duplicate-item" style="margin-bottom: 5px; padding: 10px; background: #555; border-radius: 4px;">
                    <strong>Duplicate:</strong> ${new Date(dup.createdAt).toLocaleDateString()}
                    <button onclick="viewNote('${dup.id}'); closeDuplicatesModal();" style="margin-left: 10px;">View</button>
                    <button onclick="deleteDuplicate('${dup.id}')" style="margin-left: 5px; background: #d32f2f;">Delete</button>
                </div>
            `).join('')}
        </div>
    `).join('');
    
    document.getElementById('duplicatesModal').style.display = 'flex';
}

async function deleteDuplicate(noteId) {
    const note = notes.find(n => n.id === noteId);
    showConfirm(
        'Delete Duplicate Note',
        `<div class="delete-warning">
            <div class="warning-icon">🗑️</div>
            <div class="warning-text">
                <strong>Delete "${note ? note.title : 'Unknown'}"?</strong>
                <p>This duplicate note will be permanently deleted.</p>
                <p style="color: #888; font-size: 0.9rem; margin-top: 0.5rem;">The original note will remain untouched.</p>
            </div>
        </div>`,
        async () => {
            try {
                await window.electronAPI.deleteNote(noteId);
                notes = await window.electronAPI.getNotes();
                updateNotesList();
                findDuplicates(); // Refresh duplicates list
                showAlert('✅ Success', 'Duplicate note deleted!');
            } catch (error) {
                showAlert('❌ Error', 'Error deleting note: ' + error.message);
            }
        },
        'Delete Duplicate',
        '🗑️'
    );
}

function closeDuplicatesModal() {
    document.getElementById('duplicatesModal').style.display = 'none';
}

// Move single note
function moveNoteToCategory() {
    if (!currentNote) return;
    
    const buildHierarchicalOptions = (parentName = null, level = 0) => {
        const children = categories.filter(cat => cat.parent === parentName && cat.name !== currentNote.category);
        let options = '';
        
        children.forEach(cat => {
            const indent = '\u00A0\u00A0\u00A0'.repeat(level);
            options += `<option value="${cat.name}">${indent}${cat.name}</option>`;
            options += buildHierarchicalOptions(cat.name, level + 1);
        });
        
        return options;
    };
    
    const moveSelect = document.getElementById('moveToCategory');
    moveSelect.innerHTML = '<option value="">Select Category</option>' + buildHierarchicalOptions();
    document.getElementById('moveNoteModal').style.display = 'flex';
}

async function confirmMoveNote() {
    const newCategory = document.getElementById('moveToCategory').value;
    if (!newCategory) {
        showAlert('⚠️ Warning', 'Please select a category.');
        return;
    }

    logger.info('Moving note to category', { noteId: currentNote.id, newCategory });

    currentNote.category = newCategory;
    currentNote.updatedAt = new Date().toISOString();

    try {
        performanceMonitor.start('move-note');

        // Use the secure API to save the note
        await window.electronAPI.saveNote(currentNote);

        // Refresh notes from database
        notes = await window.electronAPI.getNotes();

        // Update search index
        const searchContent = `${currentNote.title} ${currentNote.content} ${currentNote.description || ''} ${(currentNote.tags || []).join(' ')}`;
        searchIndex.addDocument(currentNote.id, searchContent, {
            title: currentNote.title,
            category: currentNote.category,
            updatedAt: currentNote.updatedAt
        });

        updateNotesList();
        updateCategorySelector();
        viewNote(currentNote.id); // Refresh viewer
        closeMoveNoteModal();

        performanceMonitor.end('move-note');
        logger.info('Note moved successfully', { noteId: currentNote.id, newCategory });
        showAlert('✅ Success', `Note moved to "${newCategory}" successfully!`);
    } catch (error) {
        logger.error('Error moving note', { noteId: currentNote.id, newCategory, error });
        showAlert('❌ Error', 'Error moving note: ' + error.message);
    }
}

function closeMoveNoteModal() {
    document.getElementById('moveNoteModal').style.display = 'none';
}

// Current Note State
let currentNote = null;             // Currently selected/editing note object
let isFromQuickCapture = false;     // Flag to track if we're editing from quick capture

function viewNote(noteId) {
    currentNote = notes.find(note => note.id === noteId);
    if (currentNote) {
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('editor').style.display = 'none';
        document.getElementById('viewer').style.display = 'flex';
        
        document.getElementById('viewerTitle').textContent = currentNote.title;
        document.getElementById('viewerMeta').innerHTML = `
            <span>Category: ${currentNote.category}</span> • 
            <span>Created: ${new Date(currentNote.createdAt).toLocaleString()}</span> • 
            <span>Updated: ${new Date(currentNote.updatedAt).toLocaleString()}</span>
            ${currentNote.tags && currentNote.tags.length > 0 ? `<br><span style="color: #ffc107;">🏷️ ${currentNote.tags.map(tag => '#' + tag).join(' ')}</span>` : ''}
            ${currentNote.description ? `<br><span style="color: #4a9eff; font-style: italic;">📝 ${currentNote.description}</span>` : ''}
        `;
        
        // Process note links and set content
        const processedContent = processNoteLinks(currentNote.content || '');
        document.getElementById('viewerContent').innerHTML = processedContent || '<em>No content</em>';
        
        // Store original content for search functionality
        originalContent = document.getElementById('viewerContent').innerHTML;
    }
}

function editNote() {
    if (currentNote) {
        document.getElementById('viewer').style.display = 'none';
        document.getElementById('editor').style.display = 'flex';
        
        document.getElementById('noteTitle').value = currentNote.title;
        document.getElementById('noteContent').innerHTML = currentNote.content || '';
        document.getElementById('noteCategory').value = currentNote.category;
        document.getElementById('noteTags').value = currentNote.tags && currentNote.tags.length > 0 ? currentNote.tags.map(tag => '#' + tag).join(' ') : '';
        document.getElementById('noteDescription').value = currentNote.description;
        
        // Focus the content editor
        setTimeout(() => {
            document.getElementById('noteContent').focus();
        }, 100);
    }
}

async function deleteNote() {
    if (!currentNote) return;
    
    showConfirm(
        'Delete Note',
        `<div class="delete-warning">
            <div class="warning-icon">🗑️</div>
            <div class="warning-text">
                <strong>Delete "${currentNote.title}"?</strong>
                <p>This note will be permanently deleted and cannot be recovered.</p>
                <div style="margin-top: 1rem; padding: 0.5rem; background: #333; border-radius: 4px;">
                    <div style="font-size: 0.85rem; color: #bbb;">Category: ${currentNote.category}</div>
                    <div style="font-size: 0.85rem; color: #bbb;">Created: ${new Date(currentNote.createdAt).toLocaleDateString()}</div>
                </div>
            </div>
        </div>`,
        async () => {
            try {
                await window.electronAPI.deleteNote(currentNote.id);
                notes = await window.electronAPI.getNotes();

                // Update UI
                updateNotesList();

                // Go back to welcome screen
                document.getElementById('viewer').style.display = 'none';
                document.getElementById('welcomeScreen').style.display = 'flex';

                currentNote = null;
                showAlert('🗑️ Deleted', 'Note deleted successfully!');
            } catch (error) {
                showAlert('❌ Error', 'Error deleting note: ' + error.message);
            }
        },
        'Delete Note',
        '🗑️'
    );
}

// Modal functions
function showAlert(title, message, callback) {
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMessage').textContent = message;
    document.getElementById('alertModal').style.display = 'flex';
    
    // Store callback for when OK is clicked
    window.alertCallback = callback;
}

function closeAlert() {
    document.getElementById('alertModal').style.display = 'none';
    
    // Execute callback if provided
    if (window.alertCallback) {
        window.alertCallback();
        window.alertCallback = null;
    }
}

// Enhanced confirmation modal
function showConfirm(title, message, onConfirm, confirmText = 'Confirm', icon = '⚠️') {
    document.getElementById('confirmTitle').innerHTML = `${icon} ${title}`;
    document.getElementById('confirmMessage').innerHTML = message;
    document.getElementById('confirmYesBtn').textContent = confirmText;
    document.getElementById('confirmYesBtn').onclick = () => {
        closeConfirmModal();
        onConfirm();
    };
    document.getElementById('confirmModal').style.display = 'flex';
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

function createNewCategory() {
    editingCategory = null;
    document.getElementById('categoryNameInput').value = '';
    document.getElementById('categoryColorInput').value = '#4a9eff';
    
    const buildHierarchicalOptions = (parentName = null, level = 0) => {
        const children = categories.filter(cat => cat.parent === parentName);
        let options = '';
        
        children.forEach(cat => {
            const indent = '\u00A0\u00A0\u00A0'.repeat(level);
            options += `<option value="${cat.name}">${indent}${cat.name}</option>`;
            options += buildHierarchicalOptions(cat.name, level + 1);
        });
        
        return options;
    };
    
    let parentOptions = '<option value="">No parent (root category)</option>';
    parentOptions += buildHierarchicalOptions();
    document.getElementById('parentCategoryInput').innerHTML = parentOptions;
    
    document.getElementById('categoryModal').style.display = 'flex';
    document.getElementById('categoryNameInput').focus();
}

function closeCategoryModal() {
    document.getElementById('categoryModal').style.display = 'none';
    document.getElementById('categoryNameInput').value = '';
    document.getElementById('categoryColorInput').value = '#4a9eff';
    document.getElementById('parentCategoryInput').value = '';

    // Reset editing state
    editingCategory = null;
    document.getElementById('categoryModalTitle').textContent = '📁 Add Category';
    document.getElementById('categorySaveBtn').textContent = 'Create';
}

async function saveCategoryModal() {
    const categoryName = document.getElementById('categoryNameInput').value.trim();
    const parentCategory = document.getElementById('parentCategoryInput').value || null;
    const color = document.getElementById('categoryColorInput').value;

    logger.debug('Saving category', { categoryName, parentCategory, color, editingCategory });

    if (!categoryName) {
        logger.warn('Attempted to save category without name');
        showAlert('⚠️ Warning', 'Please enter a category name.');
        return;
    }

    try {
        performanceMonitor.start('save-category');

        if (editingCategory) {
            // Editing existing category
            const existingCategory = categories.find(cat =>
                cat.name.toLowerCase() === categoryName.toLowerCase() &&
                cat.name !== editingCategory
            );

            if (existingCategory) {
                logger.warn('Attempted to rename category to existing name', { categoryName, editingCategory });
                showAlert('⚠️ Warning', `A category named "${categoryName}" already exists. Please choose a different name.`);
                return;
            }

            // Update the category
            await window.electronAPI.updateCategory(editingCategory, categoryName, color, parentCategory);
            logger.info(`Category "${editingCategory}" updated to "${categoryName}"`);
            showAlert('✅ Success', `Category updated successfully!`);

        } else {
            // Creating new category
            const existingCategory = categories.find(cat =>
                cat.name.toLowerCase() === categoryName.toLowerCase()
            );

            if (existingCategory) {
                logger.warn('Attempted to create duplicate category', { categoryName });
                showAlert('⚠️ Warning', `A category named "${categoryName}" already exists. Please choose a different name.`);
                return;
            }

            // Create new category
            await window.electronAPI.addCategory(categoryName, color, parentCategory);
            logger.info(`Category "${categoryName}" created successfully`);
            showAlert('✅ Success', `Category "${categoryName}" created!`);
        }

        // Refresh data and UI
        categories = await window.electronAPI.getCategories();
        notes = await window.electronAPI.getNotes(); // Refresh notes in case category names changed
        updateCategorySelector();
        updateNotesList();
        closeCategoryModal();

        performanceMonitor.end('save-category');

    } catch (error) {
        logger.error('Error saving category', { categoryName, editingCategory, error });
        showAlert('❌ Error', 'Error saving category: ' + error.message);
    }
}

function manageCategories() {
    document.getElementById('manageCategoriesModal').style.display = 'flex';
    renderCategoriesList();
}

function closeManageCategoriesModal() {
    document.getElementById('manageCategoriesModal').style.display = 'none';
}

function deleteCategory(categoryName, fromContextMenu = false) {
    if (!fromContextMenu) {
        closeManageCategoriesModal();
    }
    
    const noteCount = notes.filter(note => note.category === categoryName).length;
    const childCategories = categories.filter(cat => cat.parent === categoryName);
    const affectedNotes = notes.filter(note => note.category === categoryName);
    
    let messageHtml = `
        <div class="delete-warning">
            <div class="warning-icon">⚠️</div>
            <div class="warning-text">
                <strong>Delete "${categoryName}" category?</strong>
                <p>This action cannot be undone.</p>
            </div>
        </div>
        
        <div class="impact-details">
    `;
    
    if (noteCount > 0) {
        messageHtml += `
            <div class="impact-item notes-impact">
                <div class="impact-icon">📝</div>
                <div class="impact-content">
                    <strong>${noteCount} note${noteCount > 1 ? 's' : ''} will be moved to "General"</strong>
                    <div class="affected-notes">
                        ${affectedNotes.slice(0, 3).map(note => `<span class="note-title">• ${note.title}</span>`).join('')}
                        ${noteCount > 3 ? `<span class="more-notes">... and ${noteCount - 3} more</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    if (childCategories.length > 0) {
        messageHtml += `
            <div class="impact-item subcategories-impact">
                <div class="impact-icon">📁</div>
                <div class="impact-content">
                    <strong>${childCategories.length} subcategor${childCategories.length > 1 ? 'ies' : 'y'} will become root categor${childCategories.length > 1 ? 'ies' : 'y'}</strong>
                    <div class="affected-categories">
                        ${childCategories.map(cat => `<span class="category-name" style="color: ${cat.color}">• ${cat.name}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    if (noteCount === 0 && childCategories.length === 0) {
        messageHtml += `
            <div class="impact-item safe-delete">
                <div class="impact-icon">✅</div>
                <div class="impact-content">
                    <strong>Safe to delete</strong>
                    <p>This category is empty and has no subcategories.</p>
                </div>
            </div>
        `;
    }
    
    messageHtml += '</div>';
    
    document.getElementById('deleteCategoryMessage').innerHTML = messageHtml;
    document.getElementById('confirmDeleteBtn').onclick = () => confirmDeleteCategory(categoryName, fromContextMenu);
    document.getElementById('deleteCategoryModal').style.display = 'flex';
}

async function confirmDeleteCategory(categoryName, fromContextMenu = false) {
    try {
        await window.electronAPI.deleteCategory(categoryName);
        categories = await window.electronAPI.getCategories();
        notes = await window.electronAPI.getNotes();
        updateCategorySelector();
        updateNotesList();
        renderCategoriesList();
        closeDeleteCategoryModal();
        if (fromContextMenu) {
            showAlert('✅ Success', 'Category deleted successfully.');
        } else {
            showAlert('✅ Success', 'Category deleted successfully.', () => {
                document.getElementById('manageCategoriesModal').style.display = 'flex';
            });
        }
    } catch (error) {
        showAlert('❌ Error', 'Error deleting category: ' + error.message);
    }
}

function closeDeleteCategoryModal() {
    document.getElementById('deleteCategoryModal').style.display = 'none';
}

function renderCategoriesList() {
    const categoriesList = document.getElementById('categoriesList');

    categoriesList.innerHTML = categories.map(cat => {
        const noteCount = getTotalNoteCount(cat.name);
        return `
            <div class="category-item" style="border-left-color: ${cat.color};">
                <div class="category-info">
                    <span>${cat.name}</span>
                    <span style="color: #888;">(${cat.color}) - ${noteCount} notes</span>
                </div>
                ${cat.name !== 'General' ?
                    `<button class="category-delete" onclick="deleteCategory('${cat.name}')">
                        <span>🗑️</span>
                        <span>Delete</span>
                    </button>` :
                    '<span style="color: #888;">Default</span>'
                }
            </div>
        `;
    }).join('');
}



const defaultTemplates = {
    meeting: {
        title: 'Meeting Notes - {date}',
        content: `<h2>Meeting: [Topic]</h2>
<p><strong>Date:</strong> {date}</p>
<p><strong>Attendees:</strong></p>
<ul><li></li></ul>

<h3>Agenda</h3>
<ul><li></li></ul>

<h3>Discussion Points</h3>
<ul><li></li></ul>

<h3>Action Items</h3>
<ul><li>[ ] </li></ul>

<h3>Next Steps</h3>
<p></p>`,
        tags: ['meeting', 'work'],
        displayName: 'Meeting Notes',
        isDefault: true
    },
    daily: {
        title: 'Daily Journal - {date}',
        content: `<h2>{date}</h2>

<h3>Today's Goals</h3>
<ul><li>[ ] </li></ul>

<h3>What Happened</h3>
<p></p>

<h3>Thoughts & Reflections</h3>
<p></p>

<h3>Tomorrow's Focus</h3>
<ul><li></li></ul>`,
        tags: ['journal', 'daily'],
        displayName: 'Daily Journal',
        isDefault: true
    },
    project: {
        title: 'Project: [Name]',
        content: `<h2>Project Overview</h2>
<p><strong>Start Date:</strong> {date}</p>
<p><strong>Deadline:</strong></p>
<p><strong>Status:</strong> Planning</p>

<h3>Objectives</h3>
<ul><li></li></ul>

<h3>Requirements</h3>
<ul><li></li></ul>

<h3>Tasks</h3>
<ul><li>[ ] </li></ul>

<h3>Resources</h3>
<ul><li></li></ul>

<h3>Notes</h3>
<p></p>`,
        tags: ['project', 'planning'],
        displayName: 'Project Plan',
        isDefault: true
    },
    todo: {
        title: 'To-Do List - {date}',
        content: `<h2>Tasks for {date}</h2>

<h3>High Priority</h3>
<ul><li>[ ] </li></ul>

<h3>Medium Priority</h3>
<ul><li>[ ] </li></ul>

<h3>Low Priority</h3>
<ul><li>[ ] </li></ul>

<h3>Completed</h3>
<ul><li>[x] </li></ul>`,
        tags: ['todo', 'tasks'],
        displayName: 'To-Do List',
        isDefault: true
    },
    research: {
        title: 'Research: [Topic]',
        content: `<h2>Research Topic</h2>
<p><strong>Date:</strong> {date}</p>
<p><strong>Purpose:</strong></p>

<h3>Key Questions</h3>
<ul><li></li></ul>

<h3>Sources</h3>
<ul><li></li></ul>

<h3>Findings</h3>
<p></p>

<h3>Conclusions</h3>
<p></p>

<h3>Next Steps</h3>
<ul><li></li></ul>`,
        tags: ['research', 'study'],
        displayName: 'Research Notes',
        isDefault: true
    },
    blank: {
        title: '',
        content: '',
        tags: [],
        displayName: 'Blank Note',
        isDefault: true
    }
};

let templates = { ...defaultTemplates };

function showTemplateModal() {
    updateTemplateList();
    document.getElementById('templateModal').style.display = 'flex';
}

function updateTemplateList() {
    const templateList = document.getElementById('templateList');
    const templateIcons = {
        meeting: '💼',
        daily: '📅',
        project: '📁',
        todo: '✅',
        research: '🔍',
        blank: '📄'
    };
    
    templateList.innerHTML = Object.keys(templates).map(key => {
        const template = templates[key];
        const icon = templateIcons[key] || template.icon || '📄';
        return `
            <div class="template-item" onclick="createFromTemplate('${key}')">
                <span class="template-icon">${icon}</span>
                <span class="template-name">${template.displayName || key}</span>
                <div class="template-actions">
                    <button class="template-edit-btn" onclick="editTemplate('${key}'); event.stopPropagation();" title="Edit template">✏️</button>
                    <button class="template-delete-btn" onclick="deleteTemplate('${key}'); event.stopPropagation();" title="Delete template">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function closeTemplateModal() {
    document.getElementById('templateModal').style.display = 'none';
}

function showAddTemplateForm() {
    editingTemplateKey = null;
    document.querySelector('#addTemplateModal h3').textContent = '➕ Create Template';
    document.querySelector('#addTemplateModal .modal-btn.save').textContent = 'Save Template';
    
    document.getElementById('templateNameInput').value = '';
    document.getElementById('templateIconInput').value = '';
    document.getElementById('templateTitleInput').value = '';
    document.getElementById('templateContentInput').value = '';
    
    document.getElementById('templateModal').style.display = 'none';
    document.getElementById('addTemplateModal').style.display = 'flex';
    document.getElementById('templateNameInput').focus();
}

function closeAddTemplateModal() {
    document.getElementById('addTemplateModal').style.display = 'none';
    document.getElementById('templateNameInput').value = '';
    document.getElementById('templateIconInput').value = '';
    document.getElementById('templateTitleInput').value = '';
    document.getElementById('templateContentInput').value = '';
}

function saveTemplate() {
    const name = document.getElementById('templateNameInput').value.trim();
    const icon = document.getElementById('templateIconInput').value.trim() || '📄';
    const title = document.getElementById('templateTitleInput').value.trim();
    const content = document.getElementById('templateContentInput').value.trim();
    
    if (!name) {
        showAlert('⚠️ Warning', 'Please enter a template name.');
        return;
    }
    
    const isEditing = editingTemplateKey !== null;
    const templateKey = isEditing ? editingTemplateKey : name.toLowerCase().replace(/\s+/g, '_');
    
    templates[templateKey] = {
        title: title || name,
        content: content,
        tags: templates[templateKey]?.tags || [],
        displayName: name,
        icon: icon,
        isDefault: templates[templateKey]?.isDefault || false
    };
    
    closeAddTemplateModal();
    const action = isEditing ? 'updated' : 'created';
    showAlert('✅ Success', `Template "${name}" ${action}!`, () => {
        showTemplateModal();
    });
    
    editingTemplateKey = null;
}

function deleteTemplate(templateKey) {
    const template = templates[templateKey];
    if (template) {
        closeTemplateModal();
        showConfirm(
            'Delete Template',
            `<div class="delete-warning">
                <div class="warning-icon">🗑️</div>
                <div class="warning-text">
                    <strong>Delete "${template.displayName || template.title}" template?</strong>
                    <p>This template will be permanently removed.</p>
                </div>
            </div>`,
            () => {
                delete templates[templateKey];
                showAlert('✅ Success', 'Template deleted!', () => {
                    showTemplateModal();
                });
            },
            'Delete Template',
            '🗑️'
        );
        
        // Override cancel to return to template modal
        document.getElementById('confirmModal').querySelector('.modal-btn.cancel').onclick = () => {
            closeConfirmModal();
            showTemplateModal();
        };
    }
}

function resetTemplates() {
    closeTemplateModal();
    showConfirm(
        'Reset Templates',
        `<div class="delete-warning">
            <div class="warning-text">
                <strong>Reset all templates to defaults?</strong>
                <p>This will remove all custom templates and restore the original ones.</p>
            </div>
        </div>`,
        () => {
            templates = { ...defaultTemplates };
            showAlert('✅ Success', 'Templates reset to defaults!', () => {
                showTemplateModal();
            });
        },
        'Reset Templates',
        '🔄'
    );
    
    // Override cancel to return to template modal
    document.getElementById('confirmModal').querySelector('.modal-btn.cancel').onclick = () => {
        closeConfirmModal();
        showTemplateModal();
    };
}

let editingTemplateKey = null;

function editTemplate(templateKey) {
    const template = templates[templateKey];
    if (template) {
        editingTemplateKey = templateKey;
        
        document.getElementById('templateEditorName').value = template.displayName || template.title || templateKey;
        document.getElementById('templateEditorIcon').value = template.icon || '';
        document.getElementById('templateEditorTitle').value = template.title || '';
        document.getElementById('templateEditorContent').innerHTML = template.content || '';
        
        closeTemplateModal();
        document.getElementById('templateEditorModal').style.display = 'flex';
        document.getElementById('templateEditorName').focus();
    }
}

function closeTemplateEditor() {
    document.getElementById('templateEditorModal').style.display = 'none';
    editingTemplateKey = null;
    showTemplateModal();
}

function saveTemplateEditor() {
    const name = document.getElementById('templateEditorName').value.trim();
    const icon = document.getElementById('templateEditorIcon').value.trim() || '📄';
    const title = document.getElementById('templateEditorTitle').value.trim();
    const content = document.getElementById('templateEditorContent').innerHTML;
    
    if (!name) {
        showAlert('⚠️ Warning', 'Please enter a template name.');
        return;
    }
    
    const templateKey = editingTemplateKey;
    
    templates[templateKey] = {
        title: title || name,
        content: content,
        tags: templates[templateKey]?.tags || [],
        displayName: name,
        icon: icon,
        isDefault: templates[templateKey]?.isDefault || false
    };
    
    closeTemplateEditor();
    showAlert('✅ Success', `Template "${name}" updated!`, () => {
        showTemplateModal();
    });
    
    editingTemplateKey = null;
}

function formatTemplateText(command) {
    initializeEditors(); // Ensure editors are initialized
    if (templateEditor) {
        templateEditor.formatText(command);
    }
}

function formatTemplateHeading(tag) {
    initializeEditors();
    if (templateEditor) {
        templateEditor.formatHeading(tag);
    }
}

function insertTemplatePlaceholder() {
    initializeEditors();
    if (templateEditor) {
        templateEditor.insertHTML('{date}');
    }
}

function createFromTemplate(templateType) {
    const template = templates[templateType];
    const today = new Date().toLocaleDateString();

    currentNote = null;
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('viewer').style.display = 'none';
    document.getElementById('editor').style.display = 'flex';

    document.getElementById('noteTitle').value = template.title.replace('{date}', today);
    document.getElementById('noteContent').innerHTML = template.content.replace(/{date}/g, today);

    // Set category to current category if one is selected, otherwise use General
    const defaultCategory = (currentCategory && currentCategory !== 'all') ? currentCategory : 'General';
    document.getElementById('noteCategory').value = defaultCategory;

    document.getElementById('noteTags').value = template.tags.join(', ');
    document.getElementById('noteDescription').value = '';

    closeTemplateModal();

    setTimeout(() => {
        document.getElementById('noteContent').focus();
    }, 100);
}

function createNewNote() {
    createFromTemplate('blank');
}

let blockCounter = 0;

let selectedBlock = null;
let clickPosition = null;

function createBlockAtClick(event) {
    if (event.target.classList.contains('content-grid')) {
        const grid = document.getElementById('noteContent');
        const rect = grid.getBoundingClientRect();
        clickPosition = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
        
        if (selectedBlock) {
            selectedBlock.classList.remove('selected');
        }
        selectedBlock = null;
    }
}

function createBlockOnType() {
    if (clickPosition && !selectedBlock) {
        const grid = document.getElementById('noteContent');
        const block = document.createElement('div');
        block.className = 'note-block selected';
        block.style.left = clickPosition.x + 'px';
        block.style.top = clickPosition.y + 'px';
        block.innerHTML = `<textarea oninput="autoResize(this); saveBlockContent(this)" onkeydown="handleBlockKeyDown(event)" onclick="selectBlock(this.parentElement); event.stopPropagation()"></textarea>`;
        grid.appendChild(block);
        makeDraggable(block);
        selectedBlock = block;
        clickPosition = null;
        return block.querySelector('textarea');
    }
    return null;
}

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    textarea.style.width = Math.max(100, textarea.value.length * 8 + 20) + 'px';
}

function selectBlock(block) {
    if (selectedBlock) {
        selectedBlock.classList.remove('selected');
    }
    selectedBlock = block;
    block.classList.add('selected');
    block.querySelector('textarea').focus();
}

function handleBlockKeyDown(event) {
    if ((event.key === 'Delete' || event.key === 'Backspace') && event.target.value === '') {
        if (selectedBlock) {
            selectedBlock.remove();
            selectedBlock = null;
        }
        event.preventDefault();
    }
}

function handleKeyDown(event) {
    if (!selectedBlock && clickPosition) {
        const textarea = createBlockOnType();
        if (textarea) {
            textarea.value = event.key;
            autoResize(textarea);
            event.preventDefault();
        }
    }
}

function deleteBlock(btn) {
    btn.closest('.note-block').remove();
}

function saveBlockContent(_textarea) {
    // Auto-save functionality can be added here
}

function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    element.onmousedown = dragMouseDown;
    
    function dragMouseDown(e) {
        if (e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }
    
    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

async function saveCurrentNote() {
    const title = document.getElementById('noteTitle').value || 'Untitled';
    const content = document.getElementById('noteContent').innerHTML;
    const category = document.getElementById('noteCategory').value || 'General';
    let tagsInput = document.getElementById('noteTags').value.trim();
    let tags = [];
    if (tagsInput) {
        if (tagsInput.includes('#')) {
            // Handle #tag1 #tag2 format
            tags = tagsInput.split(/\s+/).map(t => t.replace('#', '').trim()).filter(t => t);
        } else {
            // Handle comma-separated format
            tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);
        }
    }
    const description = document.getElementById('noteDescription').value;
    
    // Check for duplicate note title
    const existingNote = notes.find(note => 
        note.title.toLowerCase() === title.toLowerCase() && 
        (!currentNote || note.id !== currentNote.id)
    );
    
    if (existingNote) {
        showAlert('⚠️ Warning', `A note with the title "${title}" already exists. Please choose a different title.`);
        return;
    }
    
    let note;
    if (currentNote) {
        // Editing existing note
        note = {
            ...currentNote,
            title: title,
            content: content,
            category: category,
            tags: tags,
            description: description,
            updatedAt: new Date().toISOString()
        };
    } else {
        // Creating new note
        note = {
            id: Date.now().toString(),
            title: title,
            content: content,
            category: category,
            tags: tags,
            description: description,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }
    
    try {
        await window.electronAPI.saveNote(note);
        notes = await window.electronAPI.getNotes();

        currentNote = note;
        updateNotesList();

        document.getElementById('editor').style.display = 'none';
        document.getElementById('viewer').style.display = 'flex';

        // Reset quick capture flag
        isFromQuickCapture = false;

        // Update viewer with processed links
        viewNote(note.id);

        // Also update the notes list to refresh any links there
        updateNotesList();

        showAlert('✅ Success', 'Note "' + title + '" saved!');
    } catch (error) {
        showAlert('❌ Error', 'Error saving note: ' + error.message);
    }
}

function cancelEdit() {
    document.getElementById('editor').style.display = 'none';

    if (isFromQuickCapture) {
        // If we came from quick capture, go back to welcome screen
        isFromQuickCapture = false;
        currentNote = null;
        document.getElementById('viewer').style.display = 'none';
        document.getElementById('welcomeScreen').style.display = 'flex';
    } else if (currentNote) {
        document.getElementById('viewer').style.display = 'flex';
        viewNote(currentNote.id);
    } else {
        document.getElementById('welcomeScreen').style.display = 'flex';
    }
}

let currentVersion = 'Unknown';
let latestVersion = 'Unknown';

// Get current version from main process
async function getCurrentVersion() {
    try {
        currentVersion = await window.electronAPI.getAppVersion();
        return currentVersion;
    } catch (error) {
        console.error('Error getting app version:', error);
        return 'Unknown';
    }
}

// Setup IPC listeners for update events
window.electronAPI.onUpdateChecking(() => {
    document.getElementById('updateBtn').textContent = 'Checking...';
    document.getElementById('updateBtn').disabled = true;
});

window.electronAPI.onUpdateAvailable((_, version) => {
    latestVersion = version;
    document.getElementById('currentVersionText').textContent = currentVersion;
    document.getElementById('latestVersionText').textContent = latestVersion;
    document.getElementById('updateAvailableModal').style.display = 'flex';
    document.getElementById('updateBtn').textContent = 'Check Updates';
    document.getElementById('updateBtn').disabled = false;
});

window.electronAPI.onUpdateNotAvailable(() => {
    showAlert('✅ Up to Date', `You have the latest version! (${currentVersion})`);
    document.getElementById('updateBtn').textContent = 'Check Updates';
    document.getElementById('updateBtn').disabled = false;
});

window.electronAPI.onCurrentVersion((_, version) => {
    currentVersion = version; // Update currentVersion with the app's version
});

window.electronAPI.onUpdateError((_, error) => {
    showAlert('❌ Error', 'Update error: ' + error);
    document.getElementById('updateBtn').textContent = 'Check Updates';
    document.getElementById('updateBtn').disabled = false;
});

window.electronAPI.onUpdateProgress((_, percent) => {
    document.getElementById('updateProgress').style.display = 'block';
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressText').textContent = `Downloading... ${Math.round(percent)}%`;
});

window.electronAPI.onUpdateDownloaded(() => {
    document.getElementById('updateProgress').style.display = 'none';
    document.getElementById('installUpdateBtn').textContent = 'Restart & Install';
    document.getElementById('installUpdateBtn').disabled = false;
    showAlert('✅ Download Complete', 'Update downloaded! Click "Restart & Install" to apply the update.');
});

async function checkForUpdates() {
    await getCurrentVersion();
    await window.electronAPI.checkForUpdates();
}

function closeUpdateAvailableModal() {
    document.getElementById('updateAvailableModal').style.display = 'none';
}

async function installUpdate() {
    const installBtn = document.getElementById('installUpdateBtn');
    installBtn.disabled = true;
    installBtn.textContent = 'Installing...';

    await window.electronAPI.installUpdate();
}



// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    initSearchListeners();
    setupNoteLinking();
    setupNoteLinkClicks();

    // Initialize theme manager
    themeManager.setupSystemThemeDetection();
    themeManager.updateThemeSelector();

    logger.info('DOM loaded and app initialized');
});

// Listen for global shortcuts
window.electronAPI.onShortcutNewNote(() => {
    createNewNote();
});

window.electronAPI.onShortcutFocusSearch(() => {
    document.getElementById('searchInput').focus();
    document.getElementById('searchInput').select();
});

// Listen for quick capture shortcut
if (window.electronAPI.onShortcutQuickCapture) {
    window.electronAPI.onShortcutQuickCapture(() => {
        showQuickCapture();
    });
}

// Listen for advanced search shortcut
if (window.electronAPI.onShortcutAdvancedSearch) {
    window.electronAPI.onShortcutAdvancedSearch(() => {
        toggleAdvancedSearch();
    });
}

// Add search functionality with debouncing
document.getElementById('searchInput').addEventListener('input', () => {
    debouncer.debounce('search', () => {
        performanceMonitor.start('search-operation');
        updateNotesList();
        performanceMonitor.end('search-operation');
    }, 300);
});

// Initialize text editors
let noteEditor;
let templateEditor;

// Function to initialize editors
function initializeEditors() {
    const noteContent = document.getElementById('noteContent');
    const templateContent = document.getElementById('templateEditorContent');

    if (noteContent && !noteEditor) {
        noteEditor = new TextEditor(noteContent);
    }
    if (templateContent && !templateEditor) {
        templateEditor = new TextEditor(templateContent);
    }
}

// Initialize editors when DOM is ready and also call it when needed
document.addEventListener('DOMContentLoaded', initializeEditors);

// Rich text formatting functions using modern TextEditor
function formatText(command) {
    initializeEditors(); // Ensure editors are initialized
    if (noteEditor) {
        noteEditor.formatText(command);
    }
}

function formatHeading(tag) {
    initializeEditors();
    if (noteEditor) {
        noteEditor.formatHeading(tag);
    }
}

function formatCode() {
    initializeEditors();
    if (noteEditor) {
        noteEditor.insertInlineCode();
    }
}

function highlightText() {
    initializeEditors();
    if (noteEditor) {
        noteEditor.highlightText('#ffff00');
    }
}

function alignText(alignment) {
    initializeEditors();
    if (noteEditor) {
        noteEditor.alignText(alignment);
    }
}

function undoRedo(action) {
    initializeEditors();
    if (noteEditor) {
        noteEditor.undoRedo(action);
    }
}

function insertLineBreak() {
    initializeEditors();
    if (noteEditor) {
        noteEditor.insertHorizontalRule();
    }
}

function formatCodeBlock() {
    initializeEditors();
    if (noteEditor) {
        noteEditor.insertCodeBlock();
    }
}



// Search highlighting function
function highlightSearchTerm(text) {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (!searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark style="background: #ffff00; color: #000;">$1</mark>');
}

// Sorting function
async function changeSorting() {
    const sortBy = document.getElementById('sortSelector').value;
    notes = await window.electronAPI.getNotesSorted(sortBy);
    updateNotesList();
}

// Pin toggle function
async function togglePin(noteId) {
    try {
        await window.electronAPI.togglePinNote(noteId);
        notes = await window.electronAPI.getNotes();
        updateNotesList();
    } catch (error) {
        showAlert('❌ Error', 'Error toggling pin: ' + error.message);
    }
}

// In-note search variables
let currentMatches = [];
let currentMatchIndex = -1;
let originalContent = '';

// Floating search functions
function openInNoteSearch() {
    const isViewer = document.getElementById('viewer').style.display !== 'none';
    const isEditor = document.getElementById('editor').style.display !== 'none';
    
    if (isViewer || isEditor) {
        const contentElement = isViewer ? document.getElementById('viewerContent') : document.getElementById('noteContent');
        const floatingSearch = document.getElementById('floatingSearch');
        const floatingSearchInput = document.getElementById('floatingSearchInput');
        
        if (contentElement && floatingSearch && floatingSearchInput) {
            originalContent = contentElement.innerHTML;
            floatingSearch.style.display = 'flex';
            floatingSearchInput.focus();
            floatingSearchInput.value = '';
            document.getElementById('floatingSearchResults').textContent = '';
        }
    }
}

function closeFloatingSearch() {
    const floatingSearch = document.getElementById('floatingSearch');
    const floatingSearchInput = document.getElementById('floatingSearchInput');
    const isViewer = document.getElementById('viewer').style.display !== 'none';
    const contentElement = isViewer ? document.getElementById('viewerContent') : document.getElementById('noteContent');
    
    if (floatingSearch) floatingSearch.style.display = 'none';
    if (floatingSearchInput) floatingSearchInput.value = '';
    if (originalContent && contentElement) {
        contentElement.innerHTML = originalContent;
    }
    document.getElementById('floatingSearchResults').textContent = '';
    
    currentMatches = [];
    currentMatchIndex = -1;
}

function navigateSearch(direction) {
    const searchTerm = document.getElementById('floatingSearchInput').value;
    if (!searchTerm) return;
    
    const isViewer = document.getElementById('viewer').style.display !== 'none';
    const contentElement = isViewer ? document.getElementById('viewerContent') : document.getElementById('noteContent');
    searchInContent(contentElement, searchTerm, direction, 'floatingSearchResults');
}

function searchInContent(contentElement, searchTerm, direction, resultsId) {
    if (!searchTerm) {
        contentElement.innerHTML = originalContent;
        currentMatches = [];
        currentMatchIndex = -1;
        document.getElementById(resultsId).textContent = '';
        return;
    }
    
    // If this is navigation, just update which match is current
    if (direction && currentMatches.length > 0) {
        if (direction === 'next') {
            currentMatchIndex = (currentMatchIndex + 1) % currentMatches.length;
        } else if (direction === 'prev') {
            currentMatchIndex = currentMatchIndex <= 0 ? currentMatches.length - 1 : currentMatchIndex - 1;
        }
        
        // Remove current highlighting
        contentElement.querySelectorAll('.current-match').forEach(el => {
            el.className = 'search-match';
            el.removeAttribute('id');
        });
        
        // Highlight new current match
        const allMatches = contentElement.querySelectorAll('.search-match');
        if (allMatches[currentMatchIndex]) {
            allMatches[currentMatchIndex].className = 'current-match';
            allMatches[currentMatchIndex].id = 'current-search-match';
            allMatches[currentMatchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        document.getElementById(resultsId).textContent = `${currentMatchIndex + 1} of ${currentMatches.length}`;
        return;
    }
    
    // Initial search
    contentElement.innerHTML = originalContent;
    
    const textContent = contentElement.textContent || contentElement.innerText || '';
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const textMatches = [...textContent.matchAll(new RegExp(escapedTerm, 'gi'))];
    
    if (textMatches.length === 0) {
        document.getElementById(resultsId).textContent = 'No matches';
        return;
    }
    
    currentMatches = textMatches;
    currentMatchIndex = 0;
    
    // Get all text nodes and replace matches
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = originalContent;
    
    let matchIndex = 0;
    const walker = document.createTreeWalker(
        tempDiv,
        NodeFilter.SHOW_TEXT
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }
    
    textNodes.forEach(textNode => {
        const text = textNode.textContent;
        if (new RegExp(escapedTerm, 'i').test(text)) {
            const highlightedText = text.replace(new RegExp(escapedTerm, 'gi'), (match) => {
                const className = matchIndex === 0 ? 'current-match' : 'search-match';
                const id = matchIndex === 0 ? 'current-search-match' : '';
                matchIndex++;
                return `<span class="${className}" ${id ? `id="${id}"` : ''}>${match}</span>`;
            });
            
            const wrapper = document.createElement('div');
            wrapper.innerHTML = highlightedText;
            
            while (wrapper.firstChild) {
                textNode.parentNode.insertBefore(wrapper.firstChild, textNode);
            }
            textNode.parentNode.removeChild(textNode);
        }
    });
    
    const highlightedHTML = tempDiv.innerHTML;
    
    contentElement.innerHTML = highlightedHTML;
    
    // Scroll to first match
    const firstMatch = document.getElementById('current-search-match');
    if (firstMatch) {
        firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    document.getElementById(resultsId).textContent = `1 of ${textMatches.length}`;
}

// Global keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Only handle shortcuts if no modal is open
    const modalsOpen = document.querySelectorAll('.modal[style*="flex"]').length > 0;
    if (modalsOpen) return;
    
    const isViewer = document.getElementById('viewer').style.display !== 'none';
    const isEditor = document.getElementById('editor').style.display !== 'none';
    
    // Ctrl+S - Save note
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (isEditor) {
            saveCurrentNote();
        }
    }
    
    // Ctrl+N - New note
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        createNewNote();
    }

    // Ctrl+Shift+N - Quick capture
    if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        showQuickCapture();
    }

    // Ctrl+Shift+F - Advanced search
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        toggleAdvancedSearch();
    }
    
    // Ctrl+F - Focus search or in-note search
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        if (isViewer || isEditor) {
            openInNoteSearch();
        } else {
            document.getElementById('searchInput').focus();
            document.getElementById('searchInput').select();
        }
    }
    
    // Ctrl+R - Refresh/reload data
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        location.reload();
    }
    
    // Escape - Close floating search
    if (e.key === 'Escape') {
        if (document.getElementById('floatingSearch').style.display !== 'none') {
            closeFloatingSearch();
        }
    }
});



// Initialize floating search listener
function initSearchListeners() {
    const floatingSearchInput = document.getElementById('floatingSearchInput');

    if (floatingSearchInput) {
        floatingSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.trim();
            const isViewer = document.getElementById('viewer').style.display !== 'none';
            const contentElement = isViewer ? document.getElementById('viewerContent') : document.getElementById('noteContent');

            if (searchTerm && contentElement) {
                searchInContent(contentElement, searchTerm, null, 'floatingSearchResults');
            } else if (contentElement && originalContent) {
                contentElement.innerHTML = originalContent;
                document.getElementById('floatingSearchResults').textContent = '';
            }
        });
    }
}

// Advanced Search Functions
function toggleAdvancedSearch() {
    const modal = document.getElementById('advancedSearchModal');
    const searchCategory = document.getElementById('searchCategory');
    const searchBar = document.querySelector('.search-bar');
    const advancedBtn = document.getElementById('advancedSearchBtn');

    if (modal.style.display === 'none' || !modal.style.display) {
        // Show advanced search
        // Populate category dropdown
        const buildCategoryOptions = (cats, parentName = null, level = 0) => {
            const children = cats.filter(cat => cat.parent === parentName);
            let options = '';

            children.forEach(cat => {
                const indent = '\u00A0\u00A0\u00A0\u00A0'.repeat(level);
                options += `<option value="${cat.name}">${indent}${cat.name}</option>`;
                options += buildCategoryOptions(cats, cat.name, level + 1);
            });

            return options;
        };

        searchCategory.innerHTML = '<option value="">All Categories</option>' + buildCategoryOptions(categories);
        modal.style.display = 'flex';
        searchBar.classList.add('advanced-active');
        advancedBtn.classList.add('active');
    } else {
        // Close advanced search
        modal.style.display = 'none';
        searchBar.classList.remove('advanced-active');
        advancedBtn.classList.remove('active');
    }
}

function closeAdvancedSearch() {
    const modal = document.getElementById('advancedSearchModal');
    const searchBar = document.querySelector('.search-bar');
    const advancedBtn = document.getElementById('advancedSearchBtn');

    modal.style.display = 'none';
    searchBar.classList.remove('advanced-active');
    advancedBtn.classList.remove('active');
}

function clearAdvancedSearch() {
    document.getElementById('searchInTitle').checked = true;
    document.getElementById('searchInContent').checked = true;
    document.getElementById('searchInTags').checked = true;
    document.getElementById('searchInDescription').checked = true;
    document.getElementById('searchCategory').value = '';
    document.getElementById('searchDateFrom').value = '';
    document.getElementById('searchDateTo').value = '';
    document.getElementById('searchTags').value = '';
    document.getElementById('searchPinnedOnly').checked = false;
    document.getElementById('searchInput').value = '';
    updateNotesList();
}

function performAdvancedSearch() {
    const searchInTitle = document.getElementById('searchInTitle').checked;
    const searchInContent = document.getElementById('searchInContent').checked;
    const searchInTags = document.getElementById('searchInTags').checked;
    const searchInDescription = document.getElementById('searchInDescription').checked;
    const searchCategory = document.getElementById('searchCategory').value;
    const searchDateFrom = document.getElementById('searchDateFrom').value;
    const searchDateTo = document.getElementById('searchDateTo').value;
    const searchTags = document.getElementById('searchTags').value;
    const searchPinnedOnly = document.getElementById('searchPinnedOnly').checked;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    let filteredNotes = currentCategory === 'all' ? notes : notes.filter(note => note.category === currentCategory);

    // Apply advanced filters
    if (searchCategory) {
        filteredNotes = filteredNotes.filter(note => note.category === searchCategory);
    }

    if (searchDateFrom) {
        const fromDate = new Date(searchDateFrom);
        filteredNotes = filteredNotes.filter(note => new Date(note.updatedAt) >= fromDate);
    }

    if (searchDateTo) {
        const toDate = new Date(searchDateTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        filteredNotes = filteredNotes.filter(note => new Date(note.updatedAt) <= toDate);
    }

    if (searchTags) {
        const tagsToSearch = searchTags.split(',').map(t => t.trim().toLowerCase());
        filteredNotes = filteredNotes.filter(note =>
            note.tags && tagsToSearch.some(searchTag =>
                note.tags.some(noteTag => noteTag.toLowerCase().includes(searchTag))
            )
        );
    }

    if (searchPinnedOnly) {
        filteredNotes = filteredNotes.filter(note => note.isPinned);
    }

    if (searchTerm) {
        filteredNotes = filteredNotes.filter(note => {
            let searchContent = '';
            if (searchInTitle) searchContent += note.title + ' ';
            if (searchInContent) searchContent += note.content + ' ';
            if (searchInTags) searchContent += (note.tags || []).join(' ') + ' ';
            if (searchInDescription) searchContent += (note.description || '') + ' ';

            return searchContent.toLowerCase().includes(searchTerm);
        });
    }

    // Update the notes list with filtered results
    displayFilteredNotes(filteredNotes);
    closeAdvancedSearch();
}

function displayFilteredNotes(filteredNotes) {
    const notesList = document.getElementById('notesList');

    if (filteredNotes.length === 0) {
        notesList.innerHTML = '<div class="no-notes-message">No notes found matching your criteria</div>';
        return;
    }

    notesList.innerHTML = filteredNotes.map(note => {
        const category = categories.find(cat => cat.name === note.category) || { color: '#4a9eff' };
        const isSelected = selectedNotes.has(note.id);
        const checkboxHtml = bulkMode ? `<input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleNoteSelection('${note.id}')" onclick="event.stopPropagation()">` : '';
        const pinIcon = note.isPinned ? '📌' : '';

        return `
            <div class="note-item ${isSelected ? 'selected' : ''} ${note.isPinned ? 'pinned' : ''}"
                    style="border-left: 4px solid ${category.color};"
                    data-note-id="${note.id}"
                    onclick="${bulkMode ? `toggleNoteSelection('${note.id}')` : `viewNote('${note.id}')`}"
                    oncontextmenu="showNoteContextMenu(event, '${note.id}'); return false;">
                ${checkboxHtml}
                <div class="note-content-wrapper">
                    <div class="note-title">
                        ${pinIcon}
                        <span>${highlightSearchTerm(note.title)}</span>
                    </div>
                    <div class="note-date">${new Date(note.updatedAt).toLocaleDateString()}</div>
                </div>
                ${!bulkMode ? `<button class="pin-btn" onclick="togglePin('${note.id}'); event.stopPropagation();" title="${note.isPinned ? 'Unpin' : 'Pin'} note">${note.isPinned ? '📌' : '📍'}</button>` : ''}
            </div>
        `;
    }).join('');
}

// Quick Capture Functions
function showQuickCapture() {
    const modal = document.getElementById('quickCaptureModal');
    const categorySelect = document.getElementById('quickCaptureCategory');

    // Populate category dropdown
    const buildCategoryOptions = (cats, parentName = null, level = 0) => {
        const children = cats.filter(cat => cat.parent === parentName);
        let options = '';

        children.forEach(cat => {
            const indent = '\u00A0\u00A0\u00A0\u00A0'.repeat(level);
            options += `<option value="${cat.name}">${indent}${cat.name}</option>`;
            options += buildCategoryOptions(cats, cat.name, level + 1);
        });

        return options;
    };

    categorySelect.innerHTML = '<option value="">Select Category</option>' + buildCategoryOptions(categories);

    // Set default category to current category if one is selected
    if (currentCategory && currentCategory !== 'all') {
        categorySelect.value = currentCategory;
    }

    // Clear previous content
    document.getElementById('quickCaptureTitle').value = '';
    document.getElementById('quickCaptureContent').value = '';

    modal.style.display = 'flex';

    // Focus on title input
    setTimeout(() => {
        document.getElementById('quickCaptureTitle').focus();
    }, 100);
}

function closeQuickCapture() {
    document.getElementById('quickCaptureModal').style.display = 'none';

    // Clear form
    document.getElementById('quickCaptureTitle').value = '';
    document.getElementById('quickCaptureContent').value = '';
    document.getElementById('quickCaptureCategory').value = '';
}

function closeAdvancedSearch() {
    document.getElementById('advancedSearchModal').style.display = 'none';
}

// Mobile menu functionality
function toggleMobileMenu() {
    const headerControls = document.getElementById('headerControls');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');

    headerControls.classList.toggle('mobile-open');
    mobileMenuBtn.classList.toggle('active');
}

// Close mobile menu when clicking outside
document.addEventListener('click', function(event) {
    const headerControls = document.getElementById('headerControls');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');

    if (!headerControls.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
        headerControls.classList.remove('mobile-open');
        mobileMenuBtn.classList.remove('active');
    }
});

// Close mobile menu when window is resized to desktop
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        const headerControls = document.getElementById('headerControls');
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');

        headerControls.classList.remove('mobile-open');
        mobileMenuBtn.classList.remove('active');
    }
});

// Enhanced Organization Features

// Tag Management System
class TagManager {
    constructor() {
        this.allTags = new Set();
        this.tagUsageCount = new Map();
        this.initializeTagSystem();
    }

    initializeTagSystem() {
        try {
            // Initialize tag autocomplete for main editor
            const tagInput = document.getElementById('noteTags');
            if (tagInput) {
                // Remove existing listeners to prevent duplicates
                tagInput.removeEventListener('input', this.handleTagInput);
                tagInput.removeEventListener('keydown', this.handleTagKeydown);

                // Add new listeners
                tagInput.addEventListener('input', (e) => this.handleTagInput(e));
                tagInput.addEventListener('keydown', (e) => this.handleTagKeydown(e));
            }

            // Initialize tag autocomplete for quick capture
            const quickTagInput = document.getElementById('quickCaptureTags');
            if (quickTagInput) {
                // Remove existing listeners to prevent duplicates
                quickTagInput.removeEventListener('input', this.handleQuickCaptureTagInput);
                quickTagInput.removeEventListener('keydown', this.handleQuickCaptureTagKeydown);

                // Add new listeners
                quickTagInput.addEventListener('input', (e) => this.handleQuickCaptureTagInput(e));
                quickTagInput.addEventListener('keydown', (e) => this.handleQuickCaptureTagKeydown(e));
            }

            // Update tag data from existing notes
            this.updateTagData();
            this.setupPresetColorHandlers();
            this.setupTemplateHandlers();
        } catch (error) {
            console.warn('TagManager initialization error:', error);
        }
    }

    updateTagData() {
        try {
            this.allTags.clear();
            this.tagUsageCount.clear();

            // Make sure notes array exists and is valid
            if (!notes || !Array.isArray(notes)) {
                console.warn('Notes array not available for tag processing');
                return;
            }

            notes.forEach(note => {
                if (note && note.tags && Array.isArray(note.tags)) {
                    note.tags.forEach(tag => {
                        if (tag && typeof tag === 'string') {
                            // Clean tag: remove #, commas, trim, and lowercase
                            const cleanTag = tag.replace(/[#,]/g, '').trim().toLowerCase();
                            if (cleanTag) {
                                this.allTags.add(cleanTag);
                                this.tagUsageCount.set(cleanTag, (this.tagUsageCount.get(cleanTag) || 0) + 1);
                            }
                        }
                    });
                }
            });

            this.updatePopularTags();
            this.updateQuickCapturePopularTags();
        } catch (error) {
            console.warn('Error updating tag data:', error);
        }
    }

    // Quick Capture Tag Handling
    handleQuickCaptureTagInput(e) {
        const input = e.target.value;
        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = input.substring(0, cursorPos);
        const lastComma = textBeforeCursor.lastIndexOf(',');
        const currentTag = textBeforeCursor.substring(lastComma + 1).trim().toLowerCase();

        if (currentTag.length > 0) {
            this.showQuickCaptureTagSuggestions(currentTag, e.target);
        } else {
            this.hideQuickCaptureTagSuggestions();
        }
    }

    showQuickCaptureTagSuggestions(query, inputElement) {
        // Get existing tags from the input
        const existingTags = this.getExistingTagsFromInput(inputElement);

        const suggestions = Array.from(this.allTags)
            .filter(tag => {
                // Only show tags that match query, aren't exact match, and don't already exist
                return tag.includes(query) &&
                       tag !== query &&
                       !existingTags.includes(tag.toLowerCase());
            })
            .sort((a, b) => {
                const aCount = this.tagUsageCount.get(a) || 0;
                const bCount = this.tagUsageCount.get(b) || 0;
                return bCount - aCount;
            })
            .slice(0, 8);

        if (suggestions.length === 0) {
            this.hideQuickCaptureTagSuggestions();
            return;
        }

        const suggestionsDiv = document.getElementById('quickCaptureTagSuggestions');
        suggestionsDiv.innerHTML = suggestions.map(tag => `
            <div class="tag-suggestion" data-tag="${tag}">
                <span>#${tag}</span>
                <span class="tag-count">${this.tagUsageCount.get(tag) || 0}</span>
            </div>
        `).join('');

        suggestionsDiv.style.display = 'block';

        // Add click handlers
        suggestionsDiv.querySelectorAll('.tag-suggestion').forEach(item => {
            item.addEventListener('click', () => {
                this.insertTag(item.dataset.tag, inputElement);
                this.hideQuickCaptureTagSuggestions();
            });
        });
    }

    hideQuickCaptureTagSuggestions() {
        const suggestionsDiv = document.getElementById('quickCaptureTagSuggestions');
        if (suggestionsDiv) {
            suggestionsDiv.style.display = 'none';
        }
    }

    handleQuickCaptureTagKeydown(e) {
        const suggestionsDiv = document.getElementById('quickCaptureTagSuggestions');
        if (suggestionsDiv.style.display === 'none') return;

        const suggestions = suggestionsDiv.querySelectorAll('.tag-suggestion');
        let selected = suggestionsDiv.querySelector('.tag-suggestion.selected');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!selected) {
                suggestions[0]?.classList.add('selected');
            } else {
                selected.classList.remove('selected');
                const next = selected.nextElementSibling || suggestions[0];
                next.classList.add('selected');
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!selected) {
                suggestions[suggestions.length - 1]?.classList.add('selected');
            } else {
                selected.classList.remove('selected');
                const prev = selected.previousElementSibling || suggestions[suggestions.length - 1];
                prev.classList.add('selected');
            }
        } else if (e.key === 'Enter' && selected) {
            e.preventDefault();
            this.insertTag(selected.dataset.tag, e.target);
            this.hideQuickCaptureTagSuggestions();
        } else if (e.key === 'Escape') {
            this.hideQuickCaptureTagSuggestions();
        }
    }

    updateQuickCapturePopularTags() {
        const popularTagsList = document.getElementById('quickCapturePopularTags');
        if (!popularTagsList) return;

        const popularTags = Array.from(this.tagUsageCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([tag, count]) => ({ tag, count }));

        popularTagsList.innerHTML = popularTags.map(({ tag, count }) => `
            <span class="popular-tag" data-tag="${tag}" title="Used ${count} times">
                #${tag}
            </span>
        `).join('');

        // Add click handlers for popular tags
        popularTagsList.querySelectorAll('.popular-tag').forEach(tagElement => {
            tagElement.addEventListener('click', () => {
                const tagInput = document.getElementById('quickCaptureTags');
                if (tagInput) {
                    const currentValue = tagInput.value.trim();
                    const newTag = tagElement.dataset.tag;

                    // Check if tag already exists (normalize both for comparison)
                    const existingTags = this.getExistingTagsFromInput(tagInput);
                    const normalizedNewTag = newTag.replace(/[#,]/g, '').trim().toLowerCase();

                    if (existingTags.includes(normalizedNewTag)) {
                        return; // Don't add duplicate
                    }

                    if (currentValue) {
                        tagInput.value = currentValue + (currentValue.endsWith(',') ? ' ' : ', ') + newTag + ', ';
                    } else {
                        tagInput.value = newTag + ', ';
                    }
                    tagInput.focus();
                }
            });
        });
    }

    handleTagInput(e) {
        const input = e.target.value;
        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = input.substring(0, cursorPos);
        const lastComma = textBeforeCursor.lastIndexOf(',');
        const currentTag = textBeforeCursor.substring(lastComma + 1).trim().toLowerCase();

        if (currentTag.length > 0) {
            this.showTagSuggestions(currentTag, e.target);
        } else {
            this.hideTagSuggestions();
        }
    }

    showTagSuggestions(query, inputElement) {
        // Get existing tags from the input
        const existingTags = this.getExistingTagsFromInput(inputElement);

        const suggestions = Array.from(this.allTags)
            .filter(tag => {
                // Only show tags that match query, aren't exact match, and don't already exist
                return tag.includes(query) &&
                       tag !== query &&
                       !existingTags.includes(tag.toLowerCase());
            })
            .sort((a, b) => {
                const aCount = this.tagUsageCount.get(a) || 0;
                const bCount = this.tagUsageCount.get(b) || 0;
                return bCount - aCount;
            })
            .slice(0, 8);

        if (suggestions.length === 0) {
            this.hideTagSuggestions();
            return;
        }

        const suggestionsDiv = document.getElementById('tagSuggestions');
        suggestionsDiv.innerHTML = suggestions.map(tag => `
            <div class="tag-suggestion" data-tag="${tag}">
                <span>#${tag}</span>
                <span class="tag-count">${this.tagUsageCount.get(tag) || 0}</span>
            </div>
        `).join('');

        suggestionsDiv.style.display = 'block';

        // Add click handlers
        suggestionsDiv.querySelectorAll('.tag-suggestion').forEach(item => {
            item.addEventListener('click', () => {
                this.insertTag(item.dataset.tag, inputElement);
                this.hideTagSuggestions();
            });
        });
    }

    getExistingTagsFromInput(inputElement) {
        const value = inputElement.value.toLowerCase();

        // Handle both formats: "#tag1 #tag2" and "tag1, tag2"
        let tags = [];

        if (value.includes('#')) {
            // Handle #tag1 #tag2 format
            tags = value.split(/\s+/)
                .map(tag => tag.replace(/[#,]/g, '').trim())
                .filter(tag => tag.length > 0);
        } else {
            // Handle tag1, tag2 format
            tags = value.split(',')
                .map(tag => tag.replace(/[#,]/g, '').trim())
                .filter(tag => tag.length > 0);
        }

        return tags;
    }

    insertTag(tag, inputElement) {
        // Check if tag already exists to prevent duplicates
        const existingTags = this.getExistingTagsFromInput(inputElement);
        const normalizedTag = tag.replace(/[#,]/g, '').trim().toLowerCase();

        if (existingTags.includes(normalizedTag)) {
            return; // Don't insert duplicate
        }

        const input = inputElement.value;
        const cursorPos = inputElement.selectionStart;
        const textBeforeCursor = input.substring(0, cursorPos);
        const textAfterCursor = input.substring(cursorPos);
        const lastComma = textBeforeCursor.lastIndexOf(',');

        const beforeTag = textBeforeCursor.substring(0, lastComma + 1);
        const newValue = beforeTag + (beforeTag.endsWith(',') ? ' ' : '') + tag + ', ' + textAfterCursor;

        inputElement.value = newValue;
        const newCursorPos = beforeTag.length + tag.length + 2;
        inputElement.setSelectionRange(newCursorPos, newCursorPos);
        inputElement.focus();
    }

    hideTagSuggestions() {
        const suggestionsDiv = document.getElementById('tagSuggestions');
        if (suggestionsDiv) {
            suggestionsDiv.style.display = 'none';
        }
    }

    handleTagKeydown(e) {
        const suggestionsDiv = document.getElementById('tagSuggestions');
        if (suggestionsDiv.style.display === 'none') return;

        const suggestions = suggestionsDiv.querySelectorAll('.tag-suggestion');
        let selected = suggestionsDiv.querySelector('.tag-suggestion.selected');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!selected) {
                suggestions[0]?.classList.add('selected');
            } else {
                selected.classList.remove('selected');
                const next = selected.nextElementSibling || suggestions[0];
                next.classList.add('selected');
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!selected) {
                suggestions[suggestions.length - 1]?.classList.add('selected');
            } else {
                selected.classList.remove('selected');
                const prev = selected.previousElementSibling || suggestions[suggestions.length - 1];
                prev.classList.add('selected');
            }
        } else if (e.key === 'Enter' && selected) {
            e.preventDefault();
            this.insertTag(selected.dataset.tag, e.target);
            this.hideTagSuggestions();
        } else if (e.key === 'Escape') {
            this.hideTagSuggestions();
        }
    }

    updatePopularTags() {
        const popularTagsList = document.getElementById('popularTagsList');
        if (!popularTagsList) return;

        const popularTags = Array.from(this.tagUsageCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tag, count]) => ({ tag, count }));

        popularTagsList.innerHTML = popularTags.map(({ tag, count }) => `
            <span class="popular-tag" data-tag="${tag}" title="Used ${count} times">
                #${tag}
            </span>
        `).join('');

        // Add click handlers for popular tags
        popularTagsList.querySelectorAll('.popular-tag').forEach(tagElement => {
            tagElement.addEventListener('click', () => {
                const tagInput = document.getElementById('noteTags');
                if (tagInput) {
                    const currentValue = tagInput.value.trim();
                    const newTag = tagElement.dataset.tag;

                    // Check if tag already exists (normalize both for comparison)
                    const existingTags = this.getExistingTagsFromInput(tagInput);
                    const normalizedNewTag = newTag.replace(/[#,]/g, '').trim().toLowerCase();

                    if (existingTags.includes(normalizedNewTag)) {
                        return; // Don't add duplicate
                    }

                    if (currentValue) {
                        tagInput.value = currentValue + (currentValue.endsWith(',') ? ' ' : ', ') + newTag + ', ';
                    } else {
                        tagInput.value = newTag + ', ';
                    }
                    tagInput.focus();
                }
            });
        });
    }

    setupPresetColorHandlers() {
        document.querySelectorAll('.preset-color').forEach(colorBtn => {
            colorBtn.addEventListener('click', () => {
                const color = colorBtn.dataset.color;
                const colorInput = document.getElementById('categoryColorInput');
                if (colorInput) {
                    colorInput.value = color;
                }

                // Update visual selection
                document.querySelectorAll('.preset-color').forEach(btn => btn.classList.remove('selected'));
                colorBtn.classList.add('selected');
            });
        });
    }

    setupTemplateHandlers() {
        const templates = {
            work: { name: 'Work', color: '#4A9EFF', subcategories: ['Meetings', 'Projects', 'Tasks', 'Reports'] },
            personal: { name: 'Personal', color: '#10B981', subcategories: ['Health', 'Finance', 'Family', 'Hobbies'] },
            projects: { name: 'Projects', color: '#F59E0B', subcategories: ['Planning', 'Development', 'Testing', 'Documentation'] },
            learning: { name: 'Learning', color: '#8B5CF6', subcategories: ['Courses', 'Books', 'Research', 'Notes'] }
        };

        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const templateKey = btn.dataset.template;
                const template = templates[templateKey];

                if (template) {
                    const nameInput = document.getElementById('categoryNameInput');
                    const colorInput = document.getElementById('categoryColorInput');

                    if (nameInput) nameInput.value = template.name;
                    if (colorInput) colorInput.value = template.color;

                    // Update preset color selection
                    document.querySelectorAll('.preset-color').forEach(colorBtn => {
                        colorBtn.classList.toggle('selected', colorBtn.dataset.color === template.color);
                    });

                    // Update template selection
                    document.querySelectorAll('.template-btn').forEach(templateBtn => {
                        templateBtn.classList.remove('selected');
                    });
                    btn.classList.add('selected');
                }
            });
        });
    }

    // Tag Manager Modal Functions
    populateTagManager() {
        this.updateTagStats();
        this.updateAllTagsList();
        this.setupTagSearch();
    }

    updateTagStats() {
        const totalTagsElement = document.getElementById('totalTagsCount');
        const mostUsedTagElement = document.getElementById('mostUsedTag');

        if (totalTagsElement) {
            totalTagsElement.textContent = this.allTags.size;
        }

        if (mostUsedTagElement) {
            const mostUsed = Array.from(this.tagUsageCount.entries())
                .sort((a, b) => b[1] - a[1])[0];
            mostUsedTagElement.textContent = mostUsed ? `#${mostUsed[0]} (${mostUsed[1]})` : '-';
        }
    }

    updateAllTagsList() {
        const allTagsList = document.getElementById('allTagsList');
        if (!allTagsList) return;

        const sortedTags = Array.from(this.tagUsageCount.entries())
            .sort((a, b) => b[1] - a[1]);

        allTagsList.innerHTML = sortedTags.map(([tag, count]) => `
            <div class="tag-item">
                <span class="tag-name">#${tag}</span>
                <div class="tag-usage">
                    <span class="tag-usage-count">${count}</span>
                    <div class="tag-actions">
                        <button class="tag-action-btn" onclick="tagManager.searchByTag('${tag}')" title="Find notes with this tag">🔍</button>
                        <button class="tag-action-btn" onclick="tagManager.renameTag('${tag}')" title="Rename tag">✏️</button>
                        <button class="tag-action-btn" onclick="tagManager.deleteTag('${tag}')" title="Delete tag">🗑️</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    setupTagSearch() {
        const tagSearchInput = document.getElementById('tagSearchInput');
        if (!tagSearchInput) return;

        tagSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const tagItems = document.querySelectorAll('.tag-item');

            tagItems.forEach(item => {
                const tagName = item.querySelector('.tag-name').textContent.toLowerCase();
                item.style.display = tagName.includes(query) ? 'flex' : 'none';
            });
        });
    }

    searchByTag(tag) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = `#${tag}`;
            // Trigger search
            const event = new Event('input', { bubbles: true });
            searchInput.dispatchEvent(event);
        }
        closeTagManager();
    }

    renameTag(oldTag) {
        const newTag = prompt(`Rename tag "${oldTag}" to:`, oldTag);
        if (newTag && newTag !== oldTag && newTag.trim()) {
            const cleanNewTag = newTag.trim().toLowerCase().replace('#', '');

            // Update all notes with this tag
            notes.forEach(note => {
                if (note.tags && Array.isArray(note.tags)) {
                    const tagIndex = note.tags.findIndex(t => t.replace('#', '').toLowerCase() === oldTag);
                    if (tagIndex !== -1) {
                        note.tags[tagIndex] = cleanNewTag;
                    }
                }
            });

            // Save all updated notes
            this.saveAllNotes();
            this.updateTagData();
            this.populateTagManager();
        }
    }

    deleteTag(tag) {
        if (confirm(`Delete tag "${tag}" from all notes? This cannot be undone.`)) {
            // Remove tag from all notes
            notes.forEach(note => {
                if (note.tags && Array.isArray(note.tags)) {
                    note.tags = note.tags.filter(t => t.replace('#', '').toLowerCase() !== tag);
                }
            });

            // Save all updated notes
            this.saveAllNotes();
            this.updateTagData();
            this.populateTagManager();
        }
    }

    showUnusedTags() {
        const unusedTags = Array.from(this.allTags).filter(tag => {
            return !notes.some(note =>
                note.tags && note.tags.some(t => t.replace('#', '').toLowerCase() === tag)
            );
        });

        if (unusedTags.length === 0) {
            showEnhancedModal(
                '✅ No Unused Tags',
                'Great! All your tags are being used in your notes.',
                [{ text: 'OK', action: () => {} }]
            );
        } else {
            const tagsList = unusedTags.map(tag => `<span class="unused-tag">#${tag}</span>`).join(' ');
            showEnhancedModal(
                '🏷️ Unused Tags Found',
                `Found ${unusedTags.length} unused tags:<br><br><div class="unused-tags-list">${tagsList}</div><br>Would you like to delete these unused tags?`,
                [
                    {
                        text: 'Delete All',
                        action: () => this.deleteUnusedTags(unusedTags),
                        style: 'danger'
                    },
                    { text: 'Keep Them', action: () => {} }
                ]
            );
        }
    }

    deleteUnusedTags(unusedTags) {
        // Remove unused tags from the system
        unusedTags.forEach(tag => {
            this.allTags.delete(tag);
            this.tagUsageCount.delete(tag);
        });

        this.updateTagData();
        this.populateTagManager();

        showEnhancedModal(
            '✅ Tags Deleted',
            `Successfully deleted ${unusedTags.length} unused tags.`,
            [{ text: 'OK', action: () => {} }]
        );
    }

    exportTags() {
        const tagData = Array.from(this.tagUsageCount.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([tag, count]) => ({ tag, count }));

        const csvContent = 'Tag,Usage Count\n' +
            tagData.map(({ tag, count }) => `"${tag}",${count}`).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mindkeep-tags-export.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    async saveAllNotes() {
        // This would need to be implemented based on your save mechanism
        // For now, just trigger a refresh
        if (typeof updateNotesList === 'function') {
            updateNotesList();
        }
    }
}

// Initialize tag manager
let tagManager;

// Initialize task manager
let taskManager;

// Initialize tag manager after notes are loaded
function initializeTagManager() {
    if (!tagManager) {
        tagManager = new TagManager();
    }
}

// Initialize task manager
function initializeTaskManager() {
    if (!taskManager) {
        taskManager = new TaskManager();
    }
}

// Initialize dedicated task manager
function initializeDedicatedTaskManager() {
    if (!dedicatedTaskManager) {
        dedicatedTaskManager = new DedicatedTaskManager();
        window.dedicatedTaskManager = dedicatedTaskManager; // Make globally accessible
        console.log('Dedicated task manager initialized and attached to window');
    }
}

// Dedicated Task Interface Functions
function showNotesView() {
    document.getElementById('notesTab').classList.add('active');
    document.getElementById('tasksTab').classList.remove('active');
    document.getElementById('notesView').classList.add('active');
    document.getElementById('tasksView').classList.remove('active');

    // Show search bar in notes view
    const searchBar = document.querySelector('.search-bar');
    if (searchBar) {
        searchBar.style.display = 'flex';
    }
}

function showTasksView() {
    document.getElementById('notesTab').classList.remove('active');
    document.getElementById('tasksTab').classList.add('active');
    document.getElementById('notesView').classList.remove('active');
    document.getElementById('tasksView').classList.add('active');

    // Hide search bar in tasks view
    const searchBar = document.querySelector('.search-bar');
    if (searchBar) {
        searchBar.style.display = 'none';
    }

    // Initialize task manager if not already done
    if (!dedicatedTaskManager) {
        console.log('Initializing dedicated task manager...');
        initializeDedicatedTaskManager();
    }

    // Setup filter button event listeners
    setupFilterButtons();

    // Initialize and refresh task view
    if (dedicatedTaskManager) {
        console.log('Refreshing task views...');
        dedicatedTaskManager.refreshTaskListsView();
        dedicatedTaskManager.refreshTasksView();
    } else {
        console.log('Task manager still not initialized!');
    }
}

function setupFilterButtons() {
    const filterAll = document.getElementById('filterAll');
    const filterPending = document.getElementById('filterPending');
    const filterCompleted = document.getElementById('filterCompleted');

    if (filterAll) {
        filterAll.addEventListener('click', () => filterTasks('all'));
    }
    if (filterPending) {
        filterPending.addEventListener('click', () => filterTasks('pending'));
    }
    if (filterCompleted) {
        filterCompleted.addEventListener('click', () => filterTasks('completed'));
    }
}

function showNewTaskModal() {
    document.getElementById('newTaskModal').style.display = 'flex';
    document.getElementById('taskTitle').focus();

    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('taskDueDate').min = today;

    // Update the task list dropdown with all available lists
    if (dedicatedTaskManager) {
        dedicatedTaskManager.updateTaskListDropdown();

        // Set the task list dropdown to the currently selected list
        const taskListSelect = document.getElementById('taskList');
        if (taskListSelect) {
            taskListSelect.value = dedicatedTaskManager.currentListId;
        }
    }
}

function closeNewTaskModal() {
    document.getElementById('newTaskModal').style.display = 'none';
    // Clear form
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDescription').value = '';
    document.getElementById('taskPriority').value = 'medium';
    document.getElementById('taskDueDate').value = '';
    document.getElementById('taskList').value = 'default';
}

function showNewTaskListModal() {
    document.getElementById('newTaskListModal').style.display = 'flex';
    document.getElementById('taskListName').focus();

    // Add color picker event handlers
    setTimeout(() => {
        const colorInput = document.getElementById('taskListColor');
        const presetColors = document.querySelectorAll('#newTaskListModal .preset-color');

        // Remove existing event listeners to prevent duplicates
        presetColors.forEach(colorBtn => {
            const newBtn = colorBtn.cloneNode(true);
            colorBtn.parentNode.replaceChild(newBtn, colorBtn);
        });

        // Re-select preset colors after cloning
        const newPresetColors = document.querySelectorAll('#newTaskListModal .preset-color');

        newPresetColors.forEach(colorBtn => {
            colorBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const color = colorBtn.dataset.color;
                if (colorInput) {
                    colorInput.value = color;
                }
                // Update visual feedback
                newPresetColors.forEach(btn => btn.classList.remove('selected'));
                colorBtn.classList.add('selected');
            });
        });

        // Also handle custom color input changes
        if (colorInput) {
            colorInput.addEventListener('input', () => {
                // Remove selection from preset colors when custom color is chosen
                newPresetColors.forEach(btn => btn.classList.remove('selected'));
            });
        }
    }, 100);
}

function closeNewTaskListModal() {
    document.getElementById('newTaskListModal').style.display = 'none';
    // Clear form
    document.getElementById('taskListName').value = '';
    document.getElementById('taskListIcon').value = '📝';
    document.getElementById('taskListColor').value = '#4a9eff';
}

function createTask() {
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const priority = document.getElementById('taskPriority').value;
    const dueDate = document.getElementById('taskDueDate').value;
    const listId = document.getElementById('taskList').value;

    if (!title) {
        showAlert('⚠️ Warning', 'Please enter a task title.');
        return;
    }

    if (dedicatedTaskManager) {
        dedicatedTaskManager.createTask({
            title,
            description,
            priority,
            dueDate,
            listId
        });
    }

    closeNewTaskModal();
    showAlert('✅ Success', 'Task created successfully!');
}

function createTaskList() {
    const name = document.getElementById('taskListName').value.trim();
    const icon = document.getElementById('taskListIcon').value;
    const color = document.getElementById('taskListColor').value;

    if (!name) {
        showAlert('⚠️ Warning', 'Please enter a list name.');
        return;
    }

    // Check for duplicate names
    if (dedicatedTaskManager) {
        const existingList = Array.from(dedicatedTaskManager.taskLists.values())
            .find(list => list.name.toLowerCase() === name.toLowerCase());

        if (existingList) {
            showAlert('⚠️ Warning', 'A task list with this name already exists.');
            return;
        }

        dedicatedTaskManager.createTaskList({
            name,
            icon,
            color
        });

        // Close modal immediately after successful creation
        closeNewTaskListModal();
        showAlert('✅ Success', 'Task list created successfully!');
    } else {
        showAlert('❌ Error', 'Task manager not initialized.');
    }
}

let currentEditingTaskId = null;

function editTask(taskId) {
    if (!dedicatedTaskManager) return;

    const task = dedicatedTaskManager.tasks.get(taskId);
    if (!task) {
        showAlert('❌ Error', 'Task not found.');
        return;
    }

    currentEditingTaskId = taskId;

    // Populate the edit form with current task data
    document.getElementById('editTaskTitle').value = task.title;
    document.getElementById('editTaskDescription').value = task.description || '';
    document.getElementById('editTaskPriority').value = task.priority;
    document.getElementById('editTaskDueDate').value = task.dueDate || '';

    // Update task list dropdown for edit modal
    updateEditTaskListDropdown();
    document.getElementById('editTaskList').value = task.listId;

    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('editTaskDueDate').min = today;

    // Show the edit modal
    document.getElementById('editTaskModal').style.display = 'flex';
    document.getElementById('editTaskTitle').focus();
}

function closeEditTaskModal() {
    document.getElementById('editTaskModal').style.display = 'none';
    currentEditingTaskId = null;

    // Clear form
    document.getElementById('editTaskTitle').value = '';
    document.getElementById('editTaskDescription').value = '';
    document.getElementById('editTaskPriority').value = 'medium';
    document.getElementById('editTaskDueDate').value = '';
    document.getElementById('editTaskList').value = 'default';
}

function updateEditTaskListDropdown() {
    const taskListSelect = document.getElementById('editTaskList');
    if (!taskListSelect || !dedicatedTaskManager) return;

    // Clear existing options
    taskListSelect.innerHTML = '';

    // Add all task lists
    Array.from(dedicatedTaskManager.taskLists.values()).forEach(list => {
        const option = document.createElement('option');
        option.value = list.id;
        option.textContent = list.name;
        taskListSelect.appendChild(option);
    });
}

function updateTask() {
    if (!currentEditingTaskId || !dedicatedTaskManager) return;

    const title = document.getElementById('editTaskTitle').value.trim();
    const description = document.getElementById('editTaskDescription').value.trim();
    const priority = document.getElementById('editTaskPriority').value;
    const dueDate = document.getElementById('editTaskDueDate').value;
    const listId = document.getElementById('editTaskList').value;

    if (!title) {
        showAlert('⚠️ Warning', 'Please enter a task title.');
        return;
    }

    const task = dedicatedTaskManager.tasks.get(currentEditingTaskId);
    if (task) {
        // Update task properties
        task.title = title;
        task.description = description;
        task.priority = priority;
        task.dueDate = dueDate;
        task.listId = listId;
        task.updatedAt = new Date().toISOString();

        // Save and refresh
        dedicatedTaskManager.saveTaskData();
        dedicatedTaskManager.refreshTasksView();
        dedicatedTaskManager.refreshTaskListsView();
    }

    closeEditTaskModal();
    showAlert('✅ Success', 'Task updated successfully!');
}

// Global function for task list selection
function selectTaskList(listId) {
    if (dedicatedTaskManager) {
        dedicatedTaskManager.selectTaskList(listId);
    }
}

// Global function for task sorting
function sortTasksGlobal() {
    if (dedicatedTaskManager) {
        dedicatedTaskManager.refreshTasksView();
    }
}

// Global function for dedicated task filtering
function filterTasks(filter) {
    console.log('Filter clicked:', filter);
    if (dedicatedTaskManager) {
        console.log('Calling filterTasks on manager');
        dedicatedTaskManager.filterTasks(filter);
    } else {
        console.log('dedicatedTaskManager not found');
    }
}

// Direct filter function attached to window
window.filterTasksDirectly = function(filter) {
    console.log('Direct filter clicked:', filter);
    if (window.dedicatedTaskManager) {
        console.log('Using window.dedicatedTaskManager');
        window.dedicatedTaskManager.filterTasks(filter);
    } else if (dedicatedTaskManager) {
        console.log('Using global dedicatedTaskManager');
        dedicatedTaskManager.filterTasks(filter);
    } else {
        console.log('No task manager found!');
    }
};

// Task List Context Menu Functions
function showTaskListContextMenu(event, listId) {
    event.preventDefault();
    event.stopPropagation();

    // Don't allow context menu on default list
    if (listId === 'default') {
        return;
    }

    const list = dedicatedTaskManager.taskLists.get(listId);
    if (!list) return;

    showEnhancedModal(
        `📋 ${list.name}`,
        `
        <div class="context-menu-content">
            <p>What would you like to do with this task list?</p>
        </div>
        `,
        [
            {
                text: '✏️ Edit',
                action: () => editTaskList(listId),
                style: 'primary'
            },
            {
                text: '🗑️ Delete',
                action: () => confirmDeleteTaskList(listId),
                style: 'danger'
            },
            {
                text: 'Cancel',
                action: () => {}
            }
        ]
    );
}

function editTaskList(listId) {
    const list = dedicatedTaskManager.taskLists.get(listId);
    if (!list) return;

    // Pre-fill the edit modal with current values
    document.getElementById('taskListName').value = list.name;
    document.getElementById('taskListIcon').value = list.icon;
    document.getElementById('taskListColor').value = list.color;

    // Change modal title and button
    document.querySelector('#newTaskListModal h3').textContent = '✏️ Edit Task List';
    document.querySelector('#newTaskListModal .modal-btn.save').textContent = 'Update List';
    document.querySelector('#newTaskListModal .modal-btn.save').onclick = () => updateTaskList(listId);

    showNewTaskListModal();
}

function updateTaskList(listId) {
    const name = document.getElementById('taskListName').value.trim();
    const icon = document.getElementById('taskListIcon').value;
    const color = document.getElementById('taskListColor').value;

    if (!name) {
        showAlert('⚠️ Warning', 'Please enter a list name.');
        return;
    }

    if (dedicatedTaskManager) {
        const list = dedicatedTaskManager.taskLists.get(listId);
        if (list) {
            list.name = name;
            list.icon = icon;
            list.color = color;

            dedicatedTaskManager.saveTaskData();
            dedicatedTaskManager.refreshTaskListsView();
        }
    }

    // Reset modal for next use
    document.querySelector('#newTaskListModal h3').textContent = '📋 Create New Task List';
    document.querySelector('#newTaskListModal .modal-btn.save').textContent = 'Create List';
    document.querySelector('#newTaskListModal .modal-btn.save').onclick = createTaskList;

    closeNewTaskListModal();
    showAlert('✅ Success', 'Task list updated successfully!');
}

function confirmDeleteTaskList(listId) {
    const list = dedicatedTaskManager.taskLists.get(listId);
    if (!list) return;

    const taskCount = dedicatedTaskManager.getTasksForList(listId).length;
    const message = taskCount > 0
        ? `Are you sure you want to delete "${list.name}"? This will also delete ${taskCount} task(s) in this list.`
        : `Are you sure you want to delete "${list.name}"?`;

    showConfirmModal(
        '🗑️ Delete Task List',
        message,
        () => {
            dedicatedTaskManager.deleteTaskList(listId);
            showAlert('✅ Success', 'Task list deleted successfully!');
        }
    );
}

// Call this after notes are loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for notes to load, then initialize managers
    setTimeout(() => {
        initializeTagManager();
        initializeTaskManager();
    }, 500);
});

// Dedicated Task Management System
class DedicatedTaskManager {
    constructor() {
        this.tasks = new Map(); // taskId -> task object
        this.taskLists = new Map(); // listId -> list object
        this.currentListId = 'default';
        this.currentFilter = 'all';
        this.initializeTaskSystem();
    }

    initializeTaskSystem() {
        try {
            this.loadTaskData();
            this.setupDefaultList();
        } catch (error) {
            console.warn('DedicatedTaskManager initialization error:', error);
        }
    }

    setupDefaultList() {
        if (!this.taskLists.has('default')) {
            this.taskLists.set('default', {
                id: 'default',
                name: 'General Tasks',
                icon: '📝',
                color: '#4A9EFF',
                createdAt: new Date().toISOString()
            });
        }
    }

    async loadTaskData() {
        try {
            // Load tasks from localStorage for now (could be database later)
            const savedTasks = localStorage.getItem('mindkeep_tasks');
            const savedLists = localStorage.getItem('mindkeep_task_lists');

            if (savedTasks) {
                const tasksArray = JSON.parse(savedTasks);
                tasksArray.forEach(task => this.tasks.set(task.id, task));
            }

            if (savedLists) {
                const listsArray = JSON.parse(savedLists);
                listsArray.forEach(list => this.taskLists.set(list.id, list));
            }
        } catch (error) {
            console.warn('Error loading task data:', error);
        }
    }

    async saveTaskData() {
        try {
            const tasksArray = Array.from(this.tasks.values());
            const listsArray = Array.from(this.taskLists.values());

            localStorage.setItem('mindkeep_tasks', JSON.stringify(tasksArray));
            localStorage.setItem('mindkeep_task_lists', JSON.stringify(listsArray));
        } catch (error) {
            console.warn('Error saving task data:', error);
        }
    }

    createTask(taskData) {
        const task = {
            id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            title: taskData.title,
            description: taskData.description || '',
            priority: taskData.priority || 'medium',
            dueDate: taskData.dueDate || null,
            listId: taskData.listId || 'default',
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: null
        };

        this.tasks.set(task.id, task);
        this.saveTaskData();
        this.refreshTasksView();
        return task;
    }

    createTaskList(listData) {
        const list = {
            id: `list_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: listData.name,
            icon: listData.icon || '📝',
            color: listData.color || '#4A9EFF',
            createdAt: new Date().toISOString()
        };

        this.taskLists.set(list.id, list);
        this.saveTaskData();
        this.refreshTaskListsView();
        this.updateTaskListDropdown(); // Update dropdown immediately
        return list;
    }

    toggleTask(taskId) {
        const task = this.tasks.get(taskId);
        if (task) {
            task.completed = !task.completed;
            task.updatedAt = new Date().toISOString();

            // Handle completion timestamps
            if (task.completed) {
                task.completedAt = new Date().toISOString();
            } else {
                // If reopening task, remove completion timestamp
                task.completedAt = null;
            }

            this.saveTaskData();
            this.refreshTasksView();
        }
    }

    deleteTask(taskId) {
        if (this.tasks.has(taskId)) {
            this.tasks.delete(taskId);
            this.saveTaskData();
            this.refreshTasksView();
        }
    }

    deleteTaskList(listId) {
        if (listId === 'default') return; // Can't delete default list

        // Delete all tasks in this list
        const tasksToDelete = Array.from(this.tasks.values())
            .filter(task => task.listId === listId)
            .map(task => task.id);

        tasksToDelete.forEach(taskId => this.tasks.delete(taskId));
        this.taskLists.delete(listId);

        // Switch to default list if current list was deleted
        if (this.currentListId === listId) {
            this.currentListId = 'default';
        }

        this.saveTaskData();
        this.refreshTaskListsView();
        this.refreshTasksView();
    }

    getTasksForList(listId) {
        return Array.from(this.tasks.values())
            .filter(task => task.listId === listId);
    }

    getFilteredTasks(listId, filter) {
        const tasks = this.getTasksForList(listId);
        console.log(`Filtering ${tasks.length} tasks with filter: ${filter}`);

        let filtered;
        switch (filter) {
            case 'pending':
                filtered = tasks.filter(task => !task.completed);
                break;
            case 'completed':
                filtered = tasks.filter(task => task.completed);
                break;
            default:
                filtered = tasks;
        }

        console.log(`Filtered result: ${filtered.length} tasks`);
        return filtered;
    }

    refreshTasksView() {
        if (document.getElementById('tasksView').classList.contains('active')) {
            this.renderTasks();
        }
    }

    refreshTaskListsView() {
        if (document.getElementById('tasksView').classList.contains('active')) {
            this.renderTaskLists();
            this.updateTaskListDropdown();
        }
    }

    updateTaskListDropdown() {
        const taskListSelect = document.getElementById('taskList');
        if (!taskListSelect) {
            console.warn('Task list dropdown not found');
            return;
        }

        // Clear existing options
        taskListSelect.innerHTML = '';

        // Add all task lists
        const lists = Array.from(this.taskLists.values());
        console.log('Updating dropdown with lists:', lists);

        lists.forEach(list => {
            const option = document.createElement('option');
            option.value = list.id;
            option.textContent = list.name;
            taskListSelect.appendChild(option);
        });

        console.log('Dropdown updated with', lists.length, 'lists');
    }

    renderTaskLists() {
        const container = document.getElementById('taskLists');
        if (!container) return;

        const lists = Array.from(this.taskLists.values());

        container.innerHTML = lists.map(list => {
            const taskCount = this.getTasksForList(list.id).length;
            const isActive = list.id === this.currentListId;

            return `
                <div class="task-list-item ${isActive ? 'active' : ''}"
                     data-list-id="${list.id}"
                     style="border-left-color: ${list.color};"
                     onclick="dedicatedTaskManager.selectTaskList('${list.id}')"
                     oncontextmenu="showTaskListContextMenu(event, '${list.id}')">
                    <span class="list-icon">${list.icon}</span>
                    <span class="list-name">${list.name}</span>
                    <span class="task-count" style="background-color: ${list.color};">${taskCount}</span>
                </div>
            `;
        }).join('');
    }

    renderTasks() {
        const container = document.getElementById('tasksContainer');
        if (!container) return;

        const tasks = this.getFilteredTasks(this.currentListId, this.currentFilter);

        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="no-tasks-message">
                    <div class="no-tasks-icon">✅</div>
                    <h3>No tasks yet</h3>
                    <p>Create your first task to get started!</p>
                    <button onclick="showNewTaskModal()" class="task-btn primary">
                        <span class="btn-icon">➕</span>
                        <span class="btn-text">Create Task</span>
                    </button>
                </div>
            `;
            return;
        }

        // Sort tasks based on current sort option
        this.sortTasks(tasks);

        container.innerHTML = tasks.map(task => this.renderTaskItem(task)).join('');
    }

    sortTasks(tasks) {
        const sortSelect = document.getElementById('taskSort');
        const sortBy = sortSelect ? sortSelect.value : 'created';

        tasks.sort((a, b) => {
            switch (sortBy) {
                case 'priority':
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    const aPriority = priorityOrder[a.priority] || 2;
                    const bPriority = priorityOrder[b.priority] || 2;
                    if (aPriority !== bPriority) return bPriority - aPriority;
                    return new Date(b.createdAt) - new Date(a.createdAt);

                case 'alphabetical':
                    return a.title.localeCompare(b.title);

                case 'dueDate':
                    if (a.dueDate && b.dueDate) {
                        return new Date(a.dueDate) - new Date(b.dueDate);
                    }
                    if (a.dueDate) return -1;
                    if (b.dueDate) return 1;
                    return new Date(b.createdAt) - new Date(a.createdAt);

                case 'created':
                default:
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });
    }

    renderTaskItem(task) {
        const priorityIcons = { high: '🔴', medium: '🟡', low: '🟢' };
        const dueDateText = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '';
        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;

        // Format timestamps
        const createdDate = new Date(task.createdAt).toLocaleDateString();
        const createdTime = new Date(task.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const createdText = `${createdDate} ${createdTime}`;
        const completedText = task.completedAt ?
            `${new Date(task.completedAt).toLocaleDateString()} ${new Date(task.completedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` :
            '';

        return `
            <div class="task-item-card ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
                <div class="task-item-header">
                    <input type="checkbox" class="task-checkbox-large"
                           ${task.completed ? 'checked' : ''}
                           onchange="dedicatedTaskManager.toggleTask('${task.id}')">
                    <div class="task-item-content">
                        <h4 class="task-item-title">${task.title}</h4>
                        ${task.description ? `<p class="task-item-description">${task.description}</p>` : ''}
                        <div class="task-item-meta">
                            <span class="task-priority-badge ${task.priority}">
                                ${priorityIcons[task.priority]} ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                            </span>
                            ${task.dueDate ? `<span class="task-due-date ${isOverdue ? 'overdue' : ''}">📅Due: ${dueDateText}</span>` : ''}
                            <span class="task-timestamp" title="Created: ${createdText}">
                                🕒 Created: ${createdText}
                            </span>
                            ${task.completedAt ? `<span class="task-completed-timestamp" title="Completed: ${completedText}">✅ Completed: ${completedText}</span>` : ''}
                        </div>
                    </div>
                    <div class="task-item-actions">
                        <button class="task-action-btn-small" onclick="editTask('${task.id}')" title="Edit">✏️</button>
                        <button class="task-action-btn-small" onclick="dedicatedTaskManager.deleteTask('${task.id}')" title="Delete">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }

    selectTaskList(listId) {
        this.currentListId = listId;
        this.refreshTaskListsView();
        this.refreshTasksView();
    }

    filterTasks(filter) {
        console.log(`Setting filter to: ${filter}`);
        this.currentFilter = filter;

        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            const isActive = btn.dataset.filter === filter;
            btn.classList.toggle('active', isActive);
            console.log(`Button ${btn.dataset.filter} active: ${isActive}`);
        });

        console.log('Refreshing tasks view...');
        this.refreshTasksView();
    }
}

// Initialize dedicated task manager
let dedicatedTaskManager;

// Call this after notes are loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for notes to load, then initialize managers
    setTimeout(() => {
        initializeTagManager();
        initializeTaskManager();
        initializeDedicatedTaskManager();
    }, 500);
});

// Also initialize when the app loads
window.addEventListener('load', () => {
    setTimeout(() => {
        if (!dedicatedTaskManager) {
            initializeDedicatedTaskManager();
        }
    }, 1000);
});

// Update managers when notes change
function refreshTagManager() {
    if (tagManager) {
        tagManager.updateTagData();
    }
}

function refreshTaskManager() {
    if (taskManager) {
        taskManager.updateTaskData();
    }
}

function refreshAllManagers() {
    refreshTagManager();
    refreshTaskManager();
}

// Tag Manager Modal Functions
function showTagManager() {
    if (tagManager) {
        tagManager.updateTagData();
        tagManager.populateTagManager();
    }
    document.getElementById('tagManagerModal').style.display = 'flex';
}

function closeTagManager() {
    document.getElementById('tagManagerModal').style.display = 'none';
}

function showUnusedTags() {
    if (tagManager) {
        tagManager.showUnusedTags();
    }
}

function exportTags() {
    if (tagManager) {
        tagManager.exportTags();
    }
}

// Enhanced Modal System
function showEnhancedModal(title, message, buttons = [{ text: 'OK', action: () => {} }]) {
    // Create modal HTML
    const modalId = 'enhancedModal_' + Date.now();
    const buttonsHtml = buttons.map((btn, index) => {
        const btnClass = btn.style === 'danger' ? 'modal-btn danger' : 'modal-btn';
        return `<button onclick="handleEnhancedModalAction('${modalId}', ${index})" class="${btnClass}">${btn.text}</button>`;
    }).join('');

    const modalHtml = `
        <div id="${modalId}" class="modal enhanced-modal" style="display: flex;">
            <div class="modal-content enhanced-modal-content">
                <button class="modal-close" onclick="closeEnhancedModal('${modalId}')">&times;</button>
                <h3>${title}</h3>
                <div class="enhanced-modal-message">${message}</div>
                <div class="modal-buttons">
                    ${buttonsHtml}
                </div>
            </div>
        </div>
    `;

    // Add to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Store button actions
    window.enhancedModalActions = window.enhancedModalActions || {};
    window.enhancedModalActions[modalId] = buttons.map(btn => btn.action);

    // Focus first button
    setTimeout(() => {
        const firstBtn = document.querySelector(`#${modalId} .modal-btn`);
        if (firstBtn) firstBtn.focus();
    }, 100);
}

function handleEnhancedModalAction(modalId, buttonIndex) {
    const actions = window.enhancedModalActions[modalId];
    if (actions && actions[buttonIndex]) {
        actions[buttonIndex]();
    }
    closeEnhancedModal(modalId);
}

function closeEnhancedModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
    // Clean up stored actions
    if (window.enhancedModalActions) {
        delete window.enhancedModalActions[modalId];
    }
}

// Enhanced Confirm Modal
function showConfirmModal(title, message, onConfirm, onCancel) {
    showEnhancedModal(title, message, [
        { text: 'Yes', action: onConfirm, style: 'primary' },
        { text: 'No', action: onCancel || (() => {}) }
    ]);
}

// Task Manager Functions
function showTaskManager() {
    if (taskManager) {
        taskManager.updateTaskData();
        populateTaskFilters();
    }
    document.getElementById('taskManagerModal').style.display = 'flex';
}

function closeTaskManager() {
    document.getElementById('taskManagerModal').style.display = 'none';
}

function populateTaskFilters() {
    const categoryFilter = document.getElementById('taskFilterCategory');
    if (!categoryFilter) return;

    // Clear existing options except "All Categories"
    categoryFilter.innerHTML = '<option value="all">All Categories</option>';

    // Add categories from notes
    const categoriesSet = new Set();
    notes.forEach(note => {
        if (note.category) {
            categoriesSet.add(note.category);
        }
    });

    Array.from(categoriesSet).sort().forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
}

function filterTasks() {
    if (!taskManager) return;

    const statusFilter = document.getElementById('taskFilterStatus').value;
    const priorityFilter = document.getElementById('taskFilterPriority').value;
    const categoryFilter = document.getElementById('taskFilterCategory').value;

    const filter = {};
    if (statusFilter !== 'all') {
        if (statusFilter === 'pending') filter.completed = false;
        if (statusFilter === 'completed') filter.completed = true;
        if (statusFilter === 'overdue') filter.overdue = true;
    }
    if (priorityFilter !== 'all') filter.priority = priorityFilter;
    if (categoryFilter !== 'all') filter.category = categoryFilter;

    const filteredTasks = taskManager.getAllTasks(filter);
    const dashboardElement = document.getElementById('taskDashboard');
    if (dashboardElement) {
        dashboardElement.innerHTML = taskManager.renderTaskDashboard(filteredTasks);
    }
}

function openNoteFromTask(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (note) {
        selectNote(noteId);
        closeTaskManager();
    }
}

function editTaskInNote(noteId) {
    openNoteFromTask(noteId);
    // Focus on the content editor
    setTimeout(() => {
        const contentEditor = document.getElementById('noteContent');
        if (contentEditor) {
            contentEditor.focus();
        }
    }, 100);
}

function exportTasks() {
    if (!taskManager) return;

    const allTasks = taskManager.getAllTasks();
    const csvContent = 'Task,Status,Priority,Due Date,Note,Category,Tags\n' +
        allTasks.map(task => {
            const status = task.completed ? 'Completed' : 'Pending';
            const dueDate = task.dueDate || '';
            const tags = task.tags.join('; ');
            return `"${task.text}","${status}","${task.priority}","${dueDate}","${task.noteTitle}","${task.category}","${tags}"`;
        }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mindkeep-tasks-export.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function showTaskHelp() {
    showEnhancedModal(
        '✅ Simple Task Help',
        `
        <div class="task-help-content">
            <h4>Creating Tasks</h4>
            <p>Simply type checkboxes in your notes:</p>
            <code>☐ Incomplete task</code><br>
            <code>☑ Completed task</code>

            <h4>How It Works</h4>
            <p>• Type ☐ or ☑ anywhere in your notes</p>
            <p>• Click the checkbox to toggle completion</p>
            <p>• View all tasks in the Task Dashboard</p>
            <p>• Tasks automatically sync across your notes</p>

            <h4>Task Dashboard</h4>
            <p>• See all tasks from all your notes</p>
            <p>• Click checkboxes to mark complete/incomplete</p>
            <p>• Click note names to jump to the source</p>
            <p>• Simple and clean interface</p>
        </div>
        `,
        [{ text: 'Got it!', action: () => {} }]
    );
}

// Header Menu Functions
function toggleMenu() {
    const menu = document.getElementById('headerMenu');
    const isVisible = menu.style.display === 'block';

    if (isVisible) {
        closeMenu();
    } else {
        // Close any other open menus first
        closeAllMenus();
        menu.style.display = 'block';

        // Add click outside listener
        setTimeout(() => {
            document.addEventListener('click', handleMenuClickOutside);
        }, 0);
    }
}

function closeMenu() {
    const menu = document.getElementById('headerMenu');
    menu.style.display = 'none';
    document.removeEventListener('click', handleMenuClickOutside);
}

function closeAllMenus() {
    const menus = document.querySelectorAll('.header-dropdown');
    menus.forEach(menu => menu.style.display = 'none');
    document.removeEventListener('click', handleMenuClickOutside);
}

function handleMenuClickOutside(event) {
    const menu = document.getElementById('headerMenu');
    const menuBtn = document.getElementById('menuBtn');

    if (!menu.contains(event.target) && !menuBtn.contains(event.target)) {
        closeMenu();
    }
}

function showSettings() {
    showEnhancedModal(
        '⚙️ Settings',
        `
        <div class="settings-content">
            <h4>Application Settings</h4>
            <p>Settings panel coming soon!</p>
            <p>Current features available:</p>
            <ul>
                <li>Theme selection (dropdown in header)</li>
                <li>Category management</li>
                <li>Tag organization</li>
                <li>Task management</li>
                <li>Backup & restore</li>
            </ul>
        </div>
        `,
        [{ text: 'OK', action: () => {} }]
    );
}

function showAbout() {
    showEnhancedModal(
        'ℹ️ About MindKeep',
        `
        <div class="about-content">
            <h4>MindKeep v7.0.6</h4>
            <p>A modern, feature-rich note-taking application</p>

            <h4>Features</h4>
            <ul>
                <li>📝 Rich text editing with formatting</li>
                <li>🏷️ Smart tagging system with autocomplete</li>
                <li>✅ Simple task management</li>
                <li>📁 Category organization with colors</li>
                <li>🔍 Powerful search functionality</li>
                <li>🎨 Multiple beautiful themes</li>
                <li>💾 Backup & restore system</li>
                <li>📤 Export capabilities</li>
            </ul>

            <h4>Built With</h4>
            <p>Electron, SQLite, and modern web technologies</p>

            <p><strong>Made with ❤️ for productivity enthusiasts</strong></p>
        </div>
        `,
        [{ text: 'Close', action: () => {} }]
    );
}

async function saveQuickCapture() {
    const title = document.getElementById('quickCaptureTitle').value.trim() || 'Quick Note';
    const content = document.getElementById('quickCaptureContent').value.trim();
    const category = document.getElementById('quickCaptureCategory').value || 'General';

    if (!content) {
        // Hide quick capture modal temporarily
        const quickCaptureModal = document.getElementById('quickCaptureModal');
        quickCaptureModal.style.display = 'none';

        showConfirmModal(
            '⚠️ Empty Note',
            'Do you want to save this note without any content?',
            async () => {
                // User confirmed - save empty note
                await performQuickCaptureSave(title, content, category);
            },
            () => {
                // User cancelled - show quick capture modal again
                quickCaptureModal.style.display = 'flex';
                document.getElementById('quickCaptureContent').focus();
            }
        );
        return;
    }

    // Extract this logic to a separate function for reuse
    await performQuickCaptureSave(title, content, category);
}

async function performQuickCaptureSave(title, content, category) {
    // Get tags from quick capture if available
    const tagsInput = document.getElementById('quickCaptureTags');
    let tags = [];
    if (tagsInput && tagsInput.value.trim()) {
        const tagsValue = tagsInput.value.trim();
        if (tagsValue.includes('#')) {
            tags = tagsValue.split(/\s+/).map(t => t.replace('#', '').trim()).filter(t => t);
        } else {
            tags = tagsValue.split(',').map(t => t.trim()).filter(t => t);
        }
    }

    // Check for duplicate title
    const existingNote = notes.find(note =>
        note.title.toLowerCase() === title.toLowerCase()
    );

    if (existingNote) {
        showAlert('⚠️ Warning', `A note with the title "${title}" already exists. Please choose a different title.`);
        return;
    }

    const note = {
        id: Date.now().toString(),
        title: title,
        content: content,
        category: category,
        tags: tags,
        description: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        await window.electronAPI.saveNote(note);
        notes = await window.electronAPI.getNotes();

        // Update search index
        const searchContent = `${note.title} ${note.content} ${note.description || ''} ${(note.tags || []).join(' ')}`;
        searchIndex.addDocument(note.id, searchContent, {
            title: note.title,
            category: note.category,
            updatedAt: note.updatedAt
        });

        updateNotesList();
        updateCategorySelector();

        // Refresh tag manager if it exists
        if (tagManager) {
            tagManager.updateTagData();
        }

        closeQuickCapture();

        showAlert('✅ Success', `Quick note "${title}" saved!`);

    } catch (error) {
        showAlert('❌ Error', 'Error saving quick note: ' + error.message);
    }
}

async function saveAndEditQuickCapture() {
    const title = document.getElementById('quickCaptureTitle').value.trim() || 'Quick Note';
    const content = document.getElementById('quickCaptureContent').value.trim();
    const category = document.getElementById('quickCaptureCategory').value || 'General';

    if (!content) {
        // Hide quick capture modal temporarily
        const quickCaptureModal = document.getElementById('quickCaptureModal');
        quickCaptureModal.style.display = 'none';

        showConfirmModal(
            '⚠️ Empty Note',
            'Do you want to save this empty note and edit it?',
            async () => {
                // User confirmed - save empty note and edit
                await performSaveAndEditQuickCapture(title, content, category);
            },
            () => {
                // User cancelled - show quick capture modal again
                quickCaptureModal.style.display = 'flex';
                document.getElementById('quickCaptureContent').focus();
            }
        );
        return;
    }

    // Extract this logic to a separate function for reuse
    await performSaveAndEditQuickCapture(title, content, category);
}

async function performSaveAndEditQuickCapture(title, content, category) {
    // Get tags from quick capture if available
    const tagsInput = document.getElementById('quickCaptureTags');
    let tags = [];
    if (tagsInput && tagsInput.value.trim()) {
        const tagsValue = tagsInput.value.trim();
        if (tagsValue.includes('#')) {
            tags = tagsValue.split(/\s+/).map(t => t.replace('#', '').trim()).filter(t => t);
        } else {
            tags = tagsValue.split(',').map(t => t.trim()).filter(t => t);
        }
    }

    // Check for duplicate title
    const existingNote = notes.find(note =>
        note.title.toLowerCase() === title.toLowerCase()
    );

    if (existingNote) {
        showAlert('⚠️ Warning', `A note with the title "${title}" already exists. Please choose a different title.`);
        return;
    }

    const note = {
        id: Date.now().toString(),
        title: title,
        content: content,
        category: category,
        tags: tags,
        description: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        await window.electronAPI.saveNote(note);
        notes = await window.electronAPI.getNotes();

        // Update search index
        const searchContent = `${note.title} ${note.content} ${note.description || ''} ${(note.tags || []).join(' ')}`;
        searchIndex.addDocument(note.id, searchContent, {
            title: note.title,
            category: note.category,
            updatedAt: note.updatedAt
        });

        updateNotesList();
        updateCategorySelector();

        // Refresh tag manager if it exists
        if (tagManager) {
            tagManager.updateTagData();
        }

        closeQuickCapture();

        // Open the note for editing
        currentNote = note;
        isFromQuickCapture = true;
        editNote();

    } catch (error) {
        showAlert('❌ Error', 'Error saving quick note: ' + error.message);
    }
}

// Category drag and drop functions (keeping for category reordering)
let draggedNoteId = null;

function handleCategoryDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

function handleCategoryDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

async function handleCategoryDrop(event, categoryName) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    
    if (draggedNoteId && categoryName) {
        const note = notes.find(n => n.id === draggedNoteId);
        if (note && note.category !== categoryName) {
            note.category = categoryName;
            note.updatedAt = new Date().toISOString();
            
            try {
                await window.electronAPI.saveNote(note);
                notes = await window.electronAPI.getNotes();
                updateNotesList();
                updateCategorySelector();
                showAlert('✅ Success', `Note moved to ${categoryName}`);
            } catch (error) {
                showAlert('❌ Error', 'Error moving note: ' + error.message);
            }
        }
    }
}

// Note linking improvements
let linkSuggestionDiv = null;
let selectedSuggestionIndex = -1;
let currentSuggestions = [];

function setupNoteLinking() {
    const noteContent = document.getElementById('noteContent');
    if (noteContent) {
        noteContent.addEventListener('input', handleNoteLinkInput);
        noteContent.addEventListener('keydown', function(e) {
            if (linkSuggestionDiv && linkSuggestionDiv.style.display === 'block') {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedSuggestionIndex = (selectedSuggestionIndex + 1) % currentSuggestions.length;
                    updateSuggestionSelection();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedSuggestionIndex = selectedSuggestionIndex <= 0 ? currentSuggestions.length - 1 : selectedSuggestionIndex - 1;
                    updateSuggestionSelection();
                } else if ((e.key === 'Enter' || e.key === 'Tab') && selectedSuggestionIndex >= 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    insertNoteLink(currentSuggestions[selectedSuggestionIndex].title);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    hideLinkSuggestions();
                }
            }
        });
    }
}

function handleNoteLinkInput(_event) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const textContent = range.startContainer.textContent || '';
    const cursorPos = range.startOffset;
    
    const beforeCursor = textContent.substring(0, cursorPos);
    const linkMatch = beforeCursor.match(/@([\w\s-]*)$/);
    
    if (linkMatch) {
        const searchTerm = linkMatch[1].toLowerCase();
        showLinkSuggestions(searchTerm, range);
    } else {
        hideLinkSuggestions();
    }
}

function showLinkSuggestions(searchTerm, range) {
    currentSuggestions = notes.filter(note => 
        (searchTerm === '' || note.title.toLowerCase().includes(searchTerm)) && 
        (!currentNote || note.id !== currentNote.id)
    ).slice(0, 8);
    
    if (currentSuggestions.length === 0) {
        hideLinkSuggestions();
        return;
    }
    
    selectedSuggestionIndex = 0;
    
    if (!linkSuggestionDiv) {
        linkSuggestionDiv = document.createElement('div');
        linkSuggestionDiv.className = 'link-suggestion';
        document.body.appendChild(linkSuggestionDiv);
    }
    
    const rect = range.getBoundingClientRect();
    linkSuggestionDiv.style.left = rect.left + 'px';
    linkSuggestionDiv.style.top = (rect.bottom + 5) + 'px';
    linkSuggestionDiv.style.display = 'block';
    
    updateSuggestionSelection();
}

function updateSuggestionSelection() {
    linkSuggestionDiv.innerHTML = currentSuggestions.map((note, index) => {
        const category = categories.find(cat => cat.name === note.category) || { color: '#4a9eff' };
        return `<div class="link-suggestion-item ${index === selectedSuggestionIndex ? 'selected' : ''}" onclick="event.stopPropagation(); insertNoteLink('${note.title.replace(/'/g, "\\'")}')"; return false;">
            <div class="suggestion-title">${note.title}</div>
            <div class="suggestion-meta" style="color: ${category.color}">${note.category}</div>
        </div>`;
    }).join('');
}

function hideLinkSuggestions() {
    if (linkSuggestionDiv) {
        linkSuggestionDiv.style.display = 'none';
    }
    selectedSuggestionIndex = -1;
    currentSuggestions = [];
}

function insertNoteLink(noteTitle) {
    const editor = document.getElementById('noteContent');
    const selection = window.getSelection();
    
    if (selection.rangeCount === 0) {
        hideLinkSuggestions();
        return;
    }
    
    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    const cursorPos = range.startOffset;
    
    if (textNode.nodeType === Node.TEXT_NODE) {
        const text = textNode.textContent;
        const beforeCursor = text.substring(0, cursorPos);
        const linkMatch = beforeCursor.match(/@([\w\s-]*)$/);
        
        if (linkMatch) {
            const startPos = cursorPos - linkMatch[0].length;
            const beforeLink = text.substring(0, startPos);
            const afterCursor = text.substring(cursorPos);
            
            textNode.textContent = beforeLink + `@${noteTitle} ` + afterCursor;
            
            // Set cursor after the inserted link
            const newPos = startPos + `@${noteTitle} `.length;
            range.setStart(textNode, newPos);
            range.setEnd(textNode, newPos);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
    
    hideLinkSuggestions();
    editor.focus();
}

// Setup click handlers for note links
function setupNoteLinkClicks() {
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('note-link') && event.target.getAttribute('data-note-id')) {
            event.preventDefault();
            event.stopPropagation();
            const noteId = event.target.getAttribute('data-note-id');
            viewNote(noteId);
        }
    });
}

// Category context menu functions
let contextCategoryName = null;

function showCategoryContextMenu(event, categoryName) {
    event.preventDefault();
    event.stopPropagation();
    
    if (categoryName === 'General') return;
    
    contextCategoryName = categoryName;
    const categoryContextMenu = document.getElementById('categoryContextMenu');
    
    if (categoryContextMenu) {
        // Show menu temporarily to get its dimensions
        categoryContextMenu.style.display = 'block';
        categoryContextMenu.style.visibility = 'hidden';
        
        const menuRect = categoryContextMenu.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        
        let left = event.pageX;
        let top = event.pageY;
        
        // Check if menu would go off the bottom of the screen
        if (event.clientY + menuRect.height > windowHeight) {
            top = event.pageY - menuRect.height;
        }
        
        // Check if menu would go off the right of the screen
        if (event.clientX + menuRect.width > windowWidth) {
            left = event.pageX - menuRect.width;
        }
        
        categoryContextMenu.style.left = left + 'px';
        categoryContextMenu.style.top = top + 'px';
        categoryContextMenu.style.visibility = 'visible';
        
        setTimeout(() => {
            document.addEventListener('click', hideCategoryContextMenu, { once: true });
        }, 0);
    }
};

function hideCategoryContextMenu() {
    document.getElementById('categoryContextMenu').style.display = 'none';
    contextCategoryName = null;
}

function contextEditCategory() {
    if (contextCategoryName) {
        const category = categories.find(cat => cat.name === contextCategoryName);
        if (category) {
            editingCategory = contextCategoryName;
            document.getElementById('categoryModalTitle').textContent = '✏️ Edit Category';
            document.getElementById('categorySaveBtn').textContent = 'Update';
            document.getElementById('categoryNameInput').value = category.name;
            document.getElementById('categoryColorInput').value = category.color;
            
            const buildHierarchicalOptions = (parentName = null, level = 0) => {
                const children = categories.filter(cat => cat.parent === parentName && cat.name !== contextCategoryName);
                let options = '';
                children.forEach(cat => {
                    const indent = '\u00A0\u00A0\u00A0'.repeat(level);
                    options += `<option value="${cat.name}">${indent}${cat.name}</option>`;
                    options += buildHierarchicalOptions(cat.name, level + 1);
                });
                return options;
            };
            
            const parentSelect = document.getElementById('parentCategoryInput');
            parentSelect.innerHTML = '<option value="">No parent (root category)</option>' + buildHierarchicalOptions();
            parentSelect.value = category.parent || '';
            
            document.getElementById('categoryModal').style.display = 'flex';
            document.getElementById('categoryNameInput').focus();
        }
    }
    hideCategoryContextMenu();
}

function contextCreateSubcategory() {
    if (contextCategoryName) {
        editingCategory = null;
        document.getElementById('categoryModalTitle').textContent = '📁 Add Subcategory';
        document.getElementById('categorySaveBtn').textContent = 'Create';
        document.getElementById('categoryNameInput').value = '';
        document.getElementById('categoryColorInput').value = '#4a9eff';
        
        const buildHierarchicalOptions = (parentName = null, level = 0) => {
            const children = categories.filter(cat => cat.parent === parentName);
            let options = '';
            children.forEach(cat => {
                const indent = '\u00A0\u00A0\u00A0'.repeat(level);
                options += `<option value="${cat.name}">${indent}${cat.name}</option>`;
                options += buildHierarchicalOptions(cat.name, level + 1);
            });
            return options;
        };
        
        const parentSelect = document.getElementById('parentCategoryInput');
        parentSelect.innerHTML = '<option value="">No parent (root category)</option>' + buildHierarchicalOptions();
        parentSelect.value = contextCategoryName;
        
        document.getElementById('categoryModal').style.display = 'flex';
        document.getElementById('categoryNameInput').focus();
    }
    hideCategoryContextMenu();
}

function contextDeleteCategory() {
    if (contextCategoryName) {
        deleteCategory(contextCategoryName, true); // true = from context menu
    }
    hideCategoryContextMenu();
}

// Note context menu functions
let contextNoteId = null;

function showNoteContextMenu(event, noteId) {
    event.preventDefault();
    event.stopPropagation();
    
    contextNoteId = noteId;
    const noteContextMenu = document.getElementById('noteContextMenu');
    
    if (noteContextMenu) {
        // Show menu temporarily to get its dimensions
        noteContextMenu.style.display = 'block';
        noteContextMenu.style.visibility = 'hidden';
        
        const menuRect = noteContextMenu.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        
        let left = event.pageX;
        let top = event.pageY;
        
        // Check if menu would go off the bottom of the screen
        if (event.clientY + menuRect.height > windowHeight) {
            top = event.pageY - menuRect.height;
        }
        
        // Check if menu would go off the right of the screen
        if (event.clientX + menuRect.width > windowWidth) {
            left = event.pageX - menuRect.width;
        }
        
        noteContextMenu.style.left = left + 'px';
        noteContextMenu.style.top = top + 'px';
        noteContextMenu.style.visibility = 'visible';
        
        setTimeout(() => {
            document.addEventListener('click', hideNoteContextMenu, { once: true });
        }, 0);
    }
}

function hideNoteContextMenu() {
    document.getElementById('noteContextMenu').style.display = 'none';
    contextNoteId = null;
}

function contextEditNote() {
    if (contextNoteId) {
        viewNote(contextNoteId);
        setTimeout(() => editNote(), 100);
    }
    hideNoteContextMenu();
}

function contextMoveNote() {
    if (contextNoteId) {
        currentNote = notes.find(n => n.id === contextNoteId);
        moveNoteToCategory();
    }
    hideNoteContextMenu();
}

function contextPinNote() {
    if (contextNoteId) {
        togglePin(contextNoteId);
    }
    hideNoteContextMenu();
}

function contextDeleteNote() {
    if (contextNoteId) {
        currentNote = notes.find(n => n.id === contextNoteId);
        deleteNote();
    }
    hideNoteContextMenu();
}

// Category drag and drop reordering
let draggedCategoryName = null;

function handleCategoryDragStart(event) {
    const categoryItem = event.target.closest('.category-item');
    draggedCategoryName = categoryItem.dataset.categoryName;
    categoryItem.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
}

function handleCategoryDragEnd(event) {
    const categoryItem = event.target.closest('.category-item');
    categoryItem.classList.remove('dragging');
    draggedCategoryName = null;
    // Remove all drag-over indicators
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.remove('drag-over-reorder');
    });
}

function handleCategoryReorderDragOver(event) {
    if (!draggedCategoryName) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    const targetCategoryName = event.currentTarget.dataset.categoryName;
    if (targetCategoryName && targetCategoryName !== draggedCategoryName) {
        event.currentTarget.classList.add('drag-over-reorder');
    }
}

async function handleCategoryReorderDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over-reorder');
    
    const targetCategoryName = event.currentTarget.dataset.categoryName;
    
    if (draggedCategoryName && targetCategoryName && draggedCategoryName !== targetCategoryName) {
        // Find the categories in the array
        const draggedIndex = categories.findIndex(cat => cat.name === draggedCategoryName);
        const targetIndex = categories.findIndex(cat => cat.name === targetCategoryName);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
            // Swap the categories in the array
            const draggedCategory = categories[draggedIndex];
            categories.splice(draggedIndex, 1);
            categories.splice(targetIndex, 0, draggedCategory);
            
            // Update the display
            updateCategorySelector();
        }
    }
}

// Enhanced Import/Export Modal functionality
function showExportModal() {
    showMainModal('exportModal');

    // Initialize import system
    populateImportCategories();
    setTimeout(() => initializeImport(), 100);

    // Show import tab by default
    showImportExportTab('import');
}

function closeExportModal() {
    closeMainModal('exportModal');

    // Reset import state
    importFiles = [];
    const panel = document.getElementById('importOptionsPanel');
    const progress = document.getElementById('importProgress');
    const fileInput = document.getElementById('importFileInput');

    if (panel) panel.style.display = 'none';
    if (progress) progress.style.display = 'none';
    if (fileInput) fileInput.value = '';
}

function showImportExportTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.import-export-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    const activeTab = document.querySelector(`[onclick="showImportExportTab('${tabName}')"]`);
    if (activeTab) activeTab.classList.add('active');

    // Show/hide tab content
    const importTab = document.getElementById('importTab');
    const exportTab = document.getElementById('exportTab');

    if (importTab && exportTab) {
        if (tabName === 'import') {
            importTab.style.display = 'block';
            exportTab.style.display = 'none';
        } else {
            importTab.style.display = 'none';
            exportTab.style.display = 'block';

            // Update export scope options when showing export tab
            updateExportOptions();
        }
    }
}

function updateExportOptions() {
    const currentRadio = document.querySelector('input[name="exportScope"][value="current"]');
    const categoryRadio = document.querySelector('input[name="exportScope"][value="category"]');

    if (!currentRadio || !categoryRadio) return;

    // Show/hide current note option
    const currentOption = currentRadio.closest('.scope-option');
    if (currentOption) {
        currentOption.style.display = currentNote ? 'flex' : 'none';
    }

    // Show/hide category option
    const categoryOption = categoryRadio.closest('.scope-option');
    if (categoryOption) {
        categoryOption.style.display = (currentCategory && currentCategory !== 'all') ? 'flex' : 'none';
    }

    // Set default selection
    if (currentNote) {
        currentRadio.checked = true;
    } else {
        document.querySelector('input[name="exportScope"][value="all"]').checked = true;
    }
}

// Old performExport function removed - using new exportNotes function instead

// Context menu export function
async function contextExportNote() {
    if (contextNoteId) {
        const note = notes.find(n => n.id === contextNoteId);
        if (note) {
            try {
                const result = await exportManager.exportAndDownload(note, 'markdown');
                await showEnhancedAlert('Export Complete', `Exported "${note.title}" as ${result.filename}`, 'success');
            } catch (error) {
                logger.error('Context export failed', error);
                await showEnhancedAlert('Export Failed', 'Export failed: ' + error.message, 'error');
            }
        }
    }
    hideCategoryContextMenu();
}

// Show welcome screen (home page)
function showWelcomeScreen() {
    logger.info('Showing welcome screen');

    // Clear current note selection
    currentNote = null;

    // Hide editor and viewer
    document.getElementById('noteEditor').style.display = 'none';
    document.getElementById('noteViewer').style.display = 'none';

    // Show welcome screen
    document.getElementById('welcomeScreen').style.display = 'flex';

    // Clear any selected note styling
    document.querySelectorAll('.note-item.selected').forEach(item => {
        item.classList.remove('selected');
    });

    // Reset category to "All Notes" if desired
    currentCategory = 'all';
    updateCategorySelector();
    updateNotesList();

    // Clear any bulk selection
    if (bulkMode) {
        toggleBulkMode();
    }

    logger.info('Welcome screen displayed');
}

// Refresh the entire app
async function refreshApp() {
    logger.info('Refreshing application');

    try {
        // Reload data from database
        categories = await window.electronAPI.getCategories();
        notes = await window.electronAPI.getNotes();

        // Rebuild search index
        searchIndex.clear();
        notes.forEach(note => {
            const searchContent = `${note.title} ${note.content} ${note.description || ''} ${(note.tags || []).join(' ')}`;
            searchIndex.addDocument(note.id, searchContent, {
                title: note.title,
                category: note.category,
                updatedAt: note.updatedAt
            });
        });

        // Reset UI state
        currentNote = null;
        currentCategory = 'all';

        // Clear any bulk selection
        if (bulkMode) {
            toggleBulkMode();
        }

        // Update UI
        updateCategorySelector();
        updateNotesList();
        showWelcomeScreen();

        logger.info('Application refreshed successfully');
    } catch (error) {
        logger.error('Error refreshing application', error);
        showAlert('❌ Error', 'Failed to refresh application data');
    }
}

// Enhanced Modal Management System
let modalStack = [];
let currentMainModal = null;

function showEnhancedConfirm(options) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmationModal');
        const icon = document.getElementById('confirmationIcon');
        const title = document.getElementById('confirmationTitle');
        const message = document.getElementById('confirmationMessage');
        const details = document.getElementById('confirmationDetails');
        const confirmBtn = document.getElementById('confirmationConfirm');
        const cancelBtn = document.getElementById('confirmationCancel');

        // Store current main modal if any
        if (currentMainModal) {
            modalStack.push(currentMainModal);
            document.getElementById(currentMainModal).style.display = 'none';
        }

        // Set content
        icon.textContent = options.icon || '⚠️';
        title.textContent = options.title || 'Confirm Action';
        message.textContent = options.message || 'Are you sure you want to proceed?';

        // Set details if provided
        if (options.details) {
            details.innerHTML = options.details;
            details.style.display = 'block';
        } else {
            details.style.display = 'none';
        }

        // Set button text
        confirmBtn.textContent = options.confirmText || 'Confirm';
        cancelBtn.textContent = options.cancelText || 'Cancel';

        // Set button styles based on type
        confirmBtn.className = 'modal-btn ' + (options.type === 'danger' ? 'delete-confirm' : 'save');

        // Show modal
        modal.style.display = 'flex';

        // Handle responses
        const handleConfirm = () => {
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            modal.style.display = 'none';
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);

            // Restore previous modal if any
            if (modalStack.length > 0) {
                const previousModal = modalStack.pop();
                document.getElementById(previousModal).style.display = 'flex';
                currentMainModal = previousModal;
            } else {
                currentMainModal = null;
            }
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

function showEnhancedAlert(title, message, type = 'info') {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    return showEnhancedConfirm({
        icon: icons[type] || icons.info,
        title: title,
        message: message,
        confirmText: 'OK',
        cancelText: null
    }).then(() => {
        // Alert only has OK button, so we don't need to handle the result
    });
}

// Track main modals
function showMainModal(modalId) {
    currentMainModal = modalId;
    document.getElementById(modalId).style.display = 'flex';
}

function closeMainModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    if (currentMainModal === modalId) {
        currentMainModal = null;
    }
}

// Backup System Functions
function showBackupModal() {
    showMainModal('backupModal');
    loadBackupSlots();
    showBackupTab('manage');
}

function closeBackupModal() {
    closeMainModal('backupModal');
}

function showBackupTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.backup-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[onclick="showBackupTab('${tabName}')"]`).classList.add('active');

    // Show/hide tab content
    document.getElementById('backupTabManage').style.display = tabName === 'manage' ? 'block' : 'none';
    document.getElementById('backupTabImport').style.display = tabName === 'import' ? 'block' : 'none';

    if (tabName === 'import') {
        loadExportBackupOptions();
    }
}

async function loadBackupSlots() {
    try {
        const slots = await window.electronAPI.invoke('backup-get-slots');
        const slotsContainer = document.getElementById('backupSlots');

        slotsContainer.innerHTML = slots.map(slot => {
            if (slot.exists && !slot.error) {
                const date = new Date(slot.timestamp);
                const formattedDate = date.toLocaleDateString();
                const formattedTime = date.toLocaleTimeString();

                return `
                    <div class="backup-slot">
                        <div class="backup-slot-info">
                            <div class="backup-slot-title">Backup Slot ${slot.slot}</div>
                            <div class="backup-slot-details">
                                📅 ${formattedDate} at ${formattedTime}<br>
                                📝 ${slot.notesCount} notes, 📁 ${slot.categoriesCount} categories
                            </div>
                        </div>
                        <div class="backup-slot-actions">
                            <button class="backup-slot-btn restore" onclick="restoreBackup(${slot.slot})">Restore</button>
                            <button class="backup-slot-btn" onclick="exportBackup(${slot.slot})">Export</button>
                            <button class="backup-slot-btn delete" onclick="deleteBackup(${slot.slot})">Delete</button>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="backup-slot empty">
                        <div class="backup-slot-info">
                            <div class="backup-slot-title">Backup Slot ${slot.slot}</div>
                            <div class="backup-slot-details">Empty slot - available for new backup</div>
                        </div>
                        <div class="backup-slot-actions">
                            <button class="backup-slot-btn" onclick="createBackupInSlot(${slot.slot})">Create Backup</button>
                        </div>
                    </div>
                `;
            }
        }).join('');

    } catch (error) {
        logger.error('Failed to load backup slots', error);
        showAlert('❌ Error', 'Failed to load backup slots: ' + error.message);
    }
}

async function createBackup(slot = null) {
    try {
        logger.info('Creating backup', { slot });

        const result = await window.electronAPI.invoke('backup-create', slot);

        if (result.success) {
            await showEnhancedAlert('Backup Created', `Backup successfully created in slot ${result.slot}!\n${result.notesCount} notes backed up.`, 'success');
            loadBackupSlots(); // Refresh the slots display
        } else {
            await showEnhancedAlert('Backup Failed', 'Backup failed: ' + result.error, 'error');
        }

    } catch (error) {
        logger.error('Backup creation failed', error);
        await showEnhancedAlert('Backup Failed', 'Backup failed: ' + error.message, 'error');
    }
}

async function createBackupInSlot(slot) {
    await createBackup(slot);
}

async function restoreBackup(slot) {
    const confirmed = await showEnhancedConfirm({
        icon: '🔄',
        title: 'Restore Backup',
        message: `Are you sure you want to restore from backup slot ${slot}?`,
        details: `
            <h4>⚠️ Warning:</h4>
            <ul>
                <li>This will replace ALL current notes and categories</li>
                <li>Your current data will be lost unless backed up</li>
                <li>This action cannot be undone</li>
            </ul>
        `,
        confirmText: 'Restore Backup',
        cancelText: 'Cancel',
        type: 'danger'
    });

    if (!confirmed) return;

    try {
        logger.info('Restoring backup', { slot });

        const result = await window.electronAPI.invoke('backup-restore', slot);

        if (result.success) {
            await showEnhancedAlert('Restore Complete', `Backup restored successfully!\n${result.notesRestored} notes and ${result.categoriesRestored} categories restored.`, 'success');

            // Refresh the entire app
            notes = await window.electronAPI.getNotes();
            categories = await window.electronAPI.getCategories();
            updateNotesList();
            updateCategorySelector();
            closeBackupModal();

        } else {
            await showEnhancedAlert('Restore Failed', 'Restore failed: ' + result.error, 'error');
        }

    } catch (error) {
        logger.error('Backup restore failed', error);
        await showEnhancedAlert('Restore Failed', 'Restore failed: ' + error.message, 'error');
    }
}

async function exportBackup(slot) {
    try {
        logger.info('Exporting backup', { slot });

        const result = await window.electronAPI.invoke('backup-export', slot);

        if (result.success) {
            await showEnhancedAlert('Export Complete', `Backup exported successfully to:\n${result.exportPath}`, 'success');
        } else {
            await showEnhancedAlert('Export Failed', 'Export failed: ' + result.error, 'error');
        }

    } catch (error) {
        logger.error('Backup export failed', error);
        await showEnhancedAlert('Export Failed', 'Export failed: ' + error.message, 'error');
    }
}

async function deleteBackup(slot) {
    const confirmed = await showEnhancedConfirm({
        icon: '🗑️',
        title: 'Delete Backup',
        message: `Are you sure you want to delete backup slot ${slot}?`,
        details: `
            <h4>⚠️ Warning:</h4>
            <ul>
                <li>This backup will be permanently deleted</li>
                <li>You will not be able to restore from this slot</li>
                <li>This action cannot be undone</li>
            </ul>
        `,
        confirmText: 'Delete Backup',
        cancelText: 'Cancel',
        type: 'danger'
    });

    if (!confirmed) return;

    try {
        logger.info('Deleting backup', { slot });

        const result = await window.electronAPI.invoke('backup-delete', slot);

        if (result.success) {
            await showEnhancedAlert('Backup Deleted', `Backup slot ${slot} deleted successfully.`, 'success');
            loadBackupSlots(); // Refresh the slots display
        } else {
            await showEnhancedAlert('Delete Failed', 'Delete failed: ' + result.error, 'error');
        }

    } catch (error) {
        logger.error('Backup delete failed', error);
        await showEnhancedAlert('Delete Failed', 'Delete failed: ' + error.message, 'error');
    }
}

async function loadExportBackupOptions() {
    try {
        const slots = await window.electronAPI.invoke('backup-get-slots');
        const select = document.getElementById('exportBackupSlot');

        select.innerHTML = '<option value="">Select backup slot to export</option>';

        slots.forEach(slot => {
            if (slot.exists && !slot.error) {
                const date = new Date(slot.timestamp);
                const formattedDate = date.toLocaleDateString();
                const formattedTime = date.toLocaleTimeString();

                select.innerHTML += `
                    <option value="${slot.slot}">
                        Slot ${slot.slot} - ${formattedDate} ${formattedTime} (${slot.notesCount} notes)
                    </option>
                `;
            }
        });

    } catch (error) {
        logger.error('Failed to load export options', error);
    }
}

async function importBackupFile() {
    const fileInput = document.getElementById('importFileInput');
    const file = fileInput.files[0];

    if (!file) {
        showAlert('⚠️ Warning', 'Please select a backup file to import.');
        return;
    }

    try {
        logger.info('Importing backup file', { filename: file.name });

        const result = await window.electronAPI.invoke('backup-import', file.path);

        if (result.success) {
            showAlert('✅ Success', `Backup imported successfully to slot ${result.slot}!\n${result.notesCount} notes and ${result.categoriesCount} categories imported.`);
            loadBackupSlots(); // Refresh the slots display
            fileInput.value = ''; // Clear the file input
        } else {
            showAlert('❌ Error', 'Import failed: ' + result.error);
        }

    } catch (error) {
        logger.error('Backup import failed', error);
        showAlert('❌ Error', 'Import failed: ' + error.message);
    }
}

async function exportBackupFile() {
    const select = document.getElementById('exportBackupSlot');
    const slot = select.value;

    if (!slot) {
        await showEnhancedAlert('Select Backup', 'Please select a backup slot to export.', 'warning');
        return;
    }

    await exportBackup(parseInt(slot));
}

// Load categories for import dropdown
async function loadImportCategories() {
    try {
        const categories = await window.electronAPI.invoke('db-get-categories');
        const select = document.getElementById('importCategorySelect');

        select.innerHTML = '';
        categories.forEach(category => {
            select.innerHTML += `<option value="${category.name}">${category.name}</option>`;
        });

    } catch (error) {
        logger.error('Failed to load import categories', error);
    }
}

// ============================================================================
// ENHANCED IMPORT/EXPORT SYSTEM
// ============================================================================

/**
 * Import System State Management
 * Handles file selection, processing, and import configuration
 */
let importFiles = [];               // Array of files selected for import
let importSettings = {              // Import configuration object
    category: '',                   // Target category for imported notes
    tags: '',                      // Additional tags to add to imported notes
    createCategoryFromFolder: true, // Whether to create categories from folder names
    skipDuplicates: true           // Whether to skip notes with duplicate titles
};

// Initialize import functionality
function initializeImport() {
    logger.info('Initializing import system');

    const dropzone = document.getElementById('importDropzone');
    const fileInput = document.getElementById('importFileInput');
    const categorySelect = document.getElementById('importCategorySelect');

    logger.info('Import elements found', {
        dropzone: !!dropzone,
        fileInput: !!fileInput,
        categorySelect: !!categorySelect
    });

    if (!dropzone || !fileInput || !categorySelect) {
        logger.error('Missing import elements');
        return;
    }

    // Populate category dropdown
    populateImportCategories();

    // Remove existing event listeners to prevent duplicates
    fileInput.removeEventListener('change', handleFileSelection);
    dropzone.removeEventListener('dragover', handleDragOver);
    dropzone.removeEventListener('dragleave', handleDragLeave);
    dropzone.removeEventListener('drop', handleFileDrop);

    // File input change handler
    fileInput.addEventListener('change', handleFileSelection);

    // Drag and drop handlers
    dropzone.addEventListener('dragover', handleDragOver);
    dropzone.addEventListener('dragleave', handleDragLeave);
    dropzone.addEventListener('drop', handleFileDrop);

    // Settings handlers
    const tagsInput = document.getElementById('importTagsInput');
    const duplicatesCheckbox = document.getElementById('skipDuplicates');

    if (tagsInput) {
        tagsInput.removeEventListener('input', updateImportSettings);
        tagsInput.addEventListener('input', updateImportSettings);
    }
    if (duplicatesCheckbox) {
        duplicatesCheckbox.removeEventListener('change', updateImportSettings);
        duplicatesCheckbox.addEventListener('change', updateImportSettings);
    }

    categorySelect.removeEventListener('change', updateImportSettings);
    categorySelect.addEventListener('change', updateImportSettings);

    logger.info('Import system initialized successfully');
}

function populateImportCategories() {
    const select = document.getElementById('importCategorySelect');
    if (!select) return;

    select.innerHTML = '<option value="">Select category...</option>';

    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        select.appendChild(option);
    });
}

function handleFileSelection(event) {
    console.log('File selection event triggered');
    const files = Array.from(event.target.files);
    console.log('Selected files:', files.map(f => ({ name: f.name, size: f.size })));
    processSelectedFiles(files);
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('dragover');
}

function handleFileDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');

    const files = Array.from(event.dataTransfer.files);
    processSelectedFiles(files);
}

function processSelectedFiles(files) {
    // Filter supported files
    const supportedExtensions = ['json', 'md', 'markdown', 'txt'];
    const validFiles = files.filter(file => {
        const extension = file.name.toLowerCase().split('.').pop();
        return supportedExtensions.includes(extension);
    });

    logger.info('Processing selected files', {
        totalFiles: files.length,
        validFiles: validFiles.length,
        fileNames: validFiles.map(f => f.name)
    });

    if (validFiles.length === 0) {
        showEnhancedAlert('No Valid Files', 'Please select JSON, Markdown (.md), or Text (.txt) files', 'warning');
        return;
    }

    importFiles = validFiles;
    showImportOptions();
    generateImportPreview();
}

function showImportOptions() {
    const panel = document.getElementById('importOptionsPanel');
    const progress = document.getElementById('importProgress');
    if (panel) panel.style.display = 'block';
    if (progress) progress.style.display = 'none';
}

function updateImportSettings() {
    const categorySelect = document.getElementById('importCategorySelect');
    const tagsInput = document.getElementById('importTagsInput');
    const folderCheckbox = document.getElementById('createCategoryFromFolder');
    const duplicatesCheckbox = document.getElementById('skipDuplicates');

    importSettings.category = categorySelect ? categorySelect.value : '';
    importSettings.tags = tagsInput ? tagsInput.value : '';
    importSettings.createCategoryFromFolder = folderCheckbox ? folderCheckbox.checked : true;
    importSettings.skipDuplicates = duplicatesCheckbox ? duplicatesCheckbox.checked : true;

    generateImportPreview();
}

async function generateImportPreview() {
    const previewList = document.getElementById('previewList');
    if (!previewList) return;

    previewList.innerHTML = '';

    for (let file of importFiles) {
        const previewItem = await createPreviewItem(file);
        previewList.appendChild(previewItem);
    }

    // Update import button
    const importBtn = document.getElementById('startImportBtn');
    if (importBtn) {
        const validFiles = importFiles.filter(file => !file.isDuplicate || !importSettings.skipDuplicates);
        importBtn.disabled = validFiles.length === 0;

        const btnText = importBtn.querySelector('.btn-text');
        if (btnText) btnText.textContent = `Import ${validFiles.length} Notes`;
    }
}

async function createPreviewItem(file) {
    const item = document.createElement('div');
    item.className = 'preview-item';

    const extension = file.name.toLowerCase().split('.').pop();
    const icon = getFileIcon(extension);

    // Check for duplicates
    const isDuplicate = await checkForDuplicate(file);
    file.isDuplicate = isDuplicate;

    let statusClass = 'ready';
    let statusText = 'Ready';

    if (isDuplicate && importSettings.skipDuplicates) {
        statusClass = 'duplicate';
        statusText = 'Duplicate (Skip)';
    } else if (isDuplicate) {
        statusClass = 'duplicate';
        statusText = 'Duplicate';
    }

    item.innerHTML = `
        <div class="preview-icon">${icon}</div>
        <div class="preview-info">
            <div class="preview-name">${file.name}</div>
            <div class="preview-details">${formatFileSize(file.size)} • ${extension.toUpperCase()}</div>
        </div>
        <div class="preview-status ${statusClass}">${statusText}</div>
    `;

    return item;
}

function getFileIcon(extension) {
    const icons = {
        'json': '🔧',
        'md': '📝',
        'markdown': '📝',
        'txt': '📄'
    };
    return icons[extension] || '📄';
}

async function checkForDuplicate(file) {
    try {
        const content = await readFileContent(file);
        const title = extractTitleFromContent(content, file);

        logger.info('Checking for duplicate', { filename: file.name, extractedTitle: title });

        const isDuplicate = notes.some(note => note.title.toLowerCase() === title.toLowerCase());

        if (isDuplicate) {
            logger.info('Duplicate found', { title, filename: file.name });
        }

        return isDuplicate;
    } catch (error) {
        logger.error('Error checking for duplicate', { filename: file.name, error });
        return false;
    }
}

function extractTitleFromContent(content, file) {
    const extension = file.name.toLowerCase().split('.').pop();

    if (extension === 'json') {
        try {
            const data = JSON.parse(content);

            // Handle array of notes (exported format)
            if (Array.isArray(data)) {
                if (data.length > 0 && data[0].title) {
                    return data[0].title; // Return title of first note for duplicate checking
                }
                return file.name.replace('.json', '');
            }

            // Handle single note object
            return data.title || file.name.replace('.json', '');
        } catch (e) {
            logger.error('Error parsing JSON for title extraction', { filename: file.name, error: e });
            return file.name.replace('.json', '');
        }
    } else if (extension === 'md' || extension === 'markdown') {
        const lines = content.split('\n');
        const firstLine = lines[0].trim();
        if (firstLine.startsWith('#')) {
            return firstLine.replace(/^#+\s*/, '');
        }
        return file.name.replace(/\.(md|markdown)$/, '');
    } else {
        const lines = content.split('\n');
        return lines[0].trim() || file.name.replace('.txt', '');
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function cancelImport() {
    importFiles = [];
    const panel = document.getElementById('importOptionsPanel');
    const fileInput = document.getElementById('importFileInput');
    if (panel) panel.style.display = 'none';
    if (fileInput) fileInput.value = '';
}

// Read file content as text
function readFileContent(file) {
    console.log('Reading file:', file.name);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('File read successfully:', file.name, 'Length:', e.target.result.length);
            resolve(e.target.result);
        };
        reader.onerror = (e) => {
            console.error('Failed to read file:', file.name, e);
            reject(new Error('Failed to read file'));
        };
        reader.readAsText(file);
    });
}

async function startImport() {
    console.log('=== START IMPORT ===');
    console.log('Import files:', importFiles.map(f => ({ name: f.name, size: f.size })));
    console.log('Import settings:', importSettings);

    if (importFiles.length === 0) {
        console.log('No files to import');
        return;
    }

    // Show progress
    const panel = document.getElementById('importOptionsPanel');
    const progress = document.getElementById('importProgress');
    if (panel) panel.style.display = 'none';
    if (progress) progress.style.display = 'block';

    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const progressDetails = document.getElementById('progressDetails');

    let imported = 0;
    let skipped = 0;
    let errors = [];

    const validFiles = importFiles.filter(file => !file.isDuplicate || !importSettings.skipDuplicates);

    for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];

        // Update progress
        const progress = ((i + 1) / validFiles.length) * 100;
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `${i + 1} of ${validFiles.length} files`;

        try {
            const result = await importSingleFile(file);
            if (result.success) {
                imported++;
                if (progressDetails) progressDetails.innerHTML += `<div>✅ ${file.name} - ${result.message}</div>`;
            } else {
                if (result.skipped) {
                    skipped++;
                    if (progressDetails) progressDetails.innerHTML += `<div>⏭️ ${file.name} - ${result.message}</div>`;
                } else {
                    errors.push(`${file.name}: ${result.message}`);
                    if (progressDetails) progressDetails.innerHTML += `<div>❌ ${file.name} - ${result.message}</div>`;
                }
            }
        } catch (error) {
            errors.push(`${file.name}: ${error.message}`);
            if (progressDetails) progressDetails.innerHTML += `<div>❌ ${file.name} - ${error.message}</div>`;
        }

        // Scroll to bottom
        if (progressDetails) progressDetails.scrollTop = progressDetails.scrollHeight;

        // Small delay for UI updates
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Show completion message
    setTimeout(() => {
        let message = `Import completed!\n\n`;
        message += `✅ Imported: ${imported} notes\n`;
        if (skipped > 0) message += `⏭️ Skipped: ${skipped} duplicates\n`;
        if (errors.length > 0) message += `❌ Errors: ${errors.length}\n`;

        showEnhancedAlert('📥 Import Complete', message, 'success');

        if (imported > 0) {
            loadNotes().then(() => {
                updateNotesList();
                updateCategorySelector();
            });
        }

        // Reset import state
        importFiles = [];
        if (progress) progress.style.display = 'none';
        const fileInput = document.getElementById('importFileInput');
        if (fileInput) fileInput.value = '';

        if (imported > 0) {
            closeBackupModal();
        }
    }, 1000);
}

async function importSingleFile(file) {
    try {
        const content = await readFileContent(file);
        const extension = file.name.toLowerCase().split('.').pop();

        logger.info('Importing file', { filename: file.name, extension, contentLength: content.length });

        let notesToImport = [];

        if (extension === 'json') {
            try {
                const jsonData = JSON.parse(content);
                logger.info('Parsed JSON data', { isArray: Array.isArray(jsonData), hasTitle: !!jsonData.title });

                if (Array.isArray(jsonData)) {
                    // Handle array of notes - import ALL notes
                    for (let noteItem of jsonData) {
                        if (noteItem && noteItem.title) {
                            notesToImport.push(noteItem);
                        }
                    }
                    if (notesToImport.length === 0) {
                        return { success: false, message: 'No valid notes found in JSON array' };
                    }
                } else if (jsonData.title) {
                    // Single note object
                    notesToImport.push(jsonData);
                } else {
                    logger.error('Invalid JSON format', jsonData);
                    return { success: false, message: 'Invalid JSON format - missing title field' };
                }
            } catch (e) {
                logger.error('JSON parse error', e);
                return { success: false, message: `Invalid JSON format: ${e.message}` };
            }
        } else if (extension === 'md' || extension === 'markdown') {
            const lines = content.split('\n');
            let title = file.name.replace(/\.(md|markdown)$/, '');
            let noteContent = content;
            let extractedTags = [];

            // Extract title from first heading
            const firstLine = lines[0]?.trim();
            if (firstLine?.startsWith('#')) {
                title = firstLine.replace(/^#+\s*/, '');
                noteContent = lines.slice(1).join('\n').trim();
            }

            // Extract tags from top lines (lines that start with # and contain hashtags)
            const contentLines = noteContent.split('\n');
            const tagLines = [];
            const remainingLines = [];
            let foundNonTagLine = false;

            for (let line of contentLines) {
                const trimmedLine = line.trim();
                if (!foundNonTagLine && trimmedLine && trimmedLine.includes('#') && !trimmedLine.startsWith('#')) {
                    // Extract hashtags from this line
                    const hashtags = trimmedLine.match(/#\w+/g);
                    if (hashtags) {
                        extractedTags.push(...hashtags);
                        tagLines.push(line);
                        continue;
                    }
                }
                foundNonTagLine = true;
                remainingLines.push(line);
            }

            // Clean up extracted tags (remove # symbol)
            extractedTags = extractedTags.map(tag => tag.substring(1));

            // Update content without tag lines
            if (tagLines.length > 0) {
                noteContent = remainingLines.join('\n').trim();
            }

            notesToImport.push({
                title: title,
                content: noteContent,
                tags: extractedTags
            });
        } else if (extension === 'txt') {
            const lines = content.split('\n');
            let title = file.name.replace('.txt', '');
            let noteContent = content;
            let extractedTags = [];

            // Use first line as title if it's short
            if (lines.length > 1 && lines[0].length < 100 && lines[1].trim() === '') {
                title = lines[0].trim();
                noteContent = lines.slice(2).join('\n').trim();
            }

            // Extract tags from top lines (lines that contain hashtags)
            const contentLines = noteContent.split('\n');
            const tagLines = [];
            const remainingLines = [];
            let foundNonTagLine = false;

            for (let line of contentLines) {
                const trimmedLine = line.trim();
                if (!foundNonTagLine && trimmedLine && trimmedLine.includes('#') && trimmedLine.match(/#\w+/)) {
                    // Extract hashtags from this line
                    const hashtags = trimmedLine.match(/#\w+/g);
                    if (hashtags) {
                        extractedTags.push(...hashtags);
                        tagLines.push(line);
                        continue;
                    }
                }
                foundNonTagLine = true;
                remainingLines.push(line);
            }

            // Clean up extracted tags (remove # symbol)
            extractedTags = extractedTags.map(tag => tag.substring(1));

            // Update content without tag lines
            if (tagLines.length > 0) {
                noteContent = remainingLines.join('\n').trim();
            }

            notesToImport.push({
                title: title,
                content: noteContent,
                tags: extractedTags
            });
        }

        if (notesToImport.length === 0) {
            return { success: false, message: 'Could not extract any note data from file' };
        }

        let importedCount = 0;
        let errors = [];

        // Import all notes found in the file
        for (let noteData of notesToImport) {
            try {
                // Skip if duplicate and skipDuplicates is enabled
                if (importSettings.skipDuplicates) {
                    const isDuplicate = notes.some(note =>
                        note.title.toLowerCase() === noteData.title.toLowerCase()
                    );
                    if (isDuplicate) {
                        continue; // Skip this note
                    }
                }

                // Clean content - remove date/time patterns that might appear as text
                let cleanContent = noteData.content || '';

                // Remove common date patterns from the beginning of content
                cleanContent = cleanContent.replace(/^(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}-\d{1,2}-\d{4})\s*\n?/gm, '');
                cleanContent = cleanContent.replace(/^(\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?)\s*\n?/gm, '');
                cleanContent = cleanContent.replace(/^(Created|Updated|Modified):\s*.*\n?/gmi, '');
                cleanContent = cleanContent.trim();

                // Merge tags from content extraction and existing tags
                const allTags = [...new Set([...(noteData.tags || []), ...(importSettings.tags ? importSettings.tags.split(/[,\s]+/).filter(tag => tag.trim()) : [])])];

                // Create note object
                const note = {
                    id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 11),
                    title: noteData.title,
                    content: cleanContent,
                    category: importSettings.category || noteData.category || 'General',
                    tags: allTags,
                    description: noteData.description || '',
                    createdAt: noteData.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    isPinned: noteData.isPinned || false
                };

                // Tags are already handled above in allTags merge

                // Save to database
                await window.electronAPI.saveNote(note);
                notes.push(note);

                // Add to search index
                const searchContent = `${note.title} ${note.content} ${note.description || ''} ${(note.tags || []).join(' ')}`;
                searchIndex.addDocument(note.id, searchContent, {
                    title: note.title,
                    category: note.category,
                    updatedAt: note.updatedAt
                });

                importedCount++;
                logger.info('Successfully imported note', { title: note.title, id: note.id });

            } catch (error) {
                logger.error('Error importing individual note', { title: noteData.title, error });
                errors.push(`"${noteData.title}": ${error.message}`);
            }
        }

        if (importedCount > 0) {
            let message = `Imported ${importedCount} note${importedCount > 1 ? 's' : ''}`;
            if (errors.length > 0) {
                message += ` (${errors.length} failed)`;
            }
            return { success: true, message };
        } else {
            return { success: false, message: errors.length > 0 ? errors.join(', ') : 'No notes were imported' };
        }

    } catch (error) {
        logger.error('Error importing file', { filename: file.name, error });
        return { success: false, message: error.message };
    }
}

// Enhanced Export Function
async function exportNotes() {
    const scope = document.querySelector('input[name="exportScope"]:checked')?.value || 'current';
    const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'json';

    let notesToExport = [];
    let filename = 'notes';

    try {
        switch (scope) {
            case 'current':
                if (!currentNote) {
                    await showEnhancedAlert('No Note Selected', 'Please select a note to export.', 'warning');
                    return;
                }
                notesToExport = [currentNote];
                filename = currentNote.title.replace(/[^a-zA-Z0-9]/g, '_');
                break;

            case 'category':
                if (currentCategory === 'all') {
                    notesToExport = notes;
                    filename = 'all_notes';
                } else {
                    notesToExport = notes.filter(note => note.category === currentCategory);
                    filename = `${currentCategory}_notes`.replace(/[^a-zA-Z0-9]/g, '_');
                }
                break;

            case 'all':
                notesToExport = notes;
                filename = 'all_notes';
                break;
        }

        if (notesToExport.length === 0) {
            await showEnhancedAlert('No Notes to Export', 'No notes found to export.', 'warning');
            return;
        }

        let content, mimeType, extension;

        switch (format) {
            case 'json':
                content = JSON.stringify(notesToExport, null, 2);
                mimeType = 'application/json';
                extension = 'json';
                break;

            case 'markdown':
                content = notesToExport.map(note => `# ${note.title}\n\n${note.content}\n\n---\n`).join('\n');
                mimeType = 'text/markdown';
                extension = 'md';
                break;

            case 'text':
                content = notesToExport.map(note => `${note.title}\n\n${note.content}\n\n${'='.repeat(50)}\n`).join('\n');
                mimeType = 'text/plain';
                extension = 'txt';
                break;
        }

        // Create and download file
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        await showEnhancedAlert('Export Complete', `Exported ${notesToExport.length} notes as ${filename}.${extension}`, 'success');

    } catch (error) {
        logger.error('Export failed', error);
        await showEnhancedAlert('Export Failed', 'Export failed: ' + error.message, 'error');
    }
}

// Test functions for debugging import
window.testImportSystem = function() {
    console.log('=== TESTING IMPORT SYSTEM ===');

    // Test if elements exist
    const dropzone = document.getElementById('importDropzone');
    const fileInput = document.getElementById('importFileInput');
    const categorySelect = document.getElementById('importCategorySelect');

    console.log('Elements found:', {
        dropzone: !!dropzone,
        fileInput: !!fileInput,
        categorySelect: !!categorySelect
    });

    // Test if functions exist
    console.log('Functions available:', {
        initializeImport: typeof initializeImport,
        startImport: typeof startImport,
        processSelectedFiles: typeof processSelectedFiles
    });

    // Test initialization
    try {
        initializeImport();
        console.log('Import system initialized successfully');
    } catch (error) {
        console.error('Failed to initialize import system:', error);
    }

    console.log('Current state:', {
        importFiles: importFiles.length,
        importSettings: importSettings,
        notesCount: notes.length,
        categoriesCount: categories.length
    });
};

// Test tag extraction
window.testTagExtraction = function() {
    const testContent = `#work #project #important
This is a note with tags at the top.

Some content here.
More content.`;

    console.log('Testing tag extraction:');
    console.log('Input:', testContent);

    const lines = testContent.split('\n');
    const tagLines = [];
    const remainingLines = [];
    let foundNonTagLine = false;
    let extractedTags = [];

    for (let line of lines) {
        const trimmedLine = line.trim();
        if (!foundNonTagLine && trimmedLine && trimmedLine.includes('#') && trimmedLine.match(/#\w+/)) {
            const hashtags = trimmedLine.match(/#\w+/g);
            if (hashtags) {
                extractedTags.push(...hashtags);
                tagLines.push(line);
                continue;
            }
        }
        foundNonTagLine = true;
        remainingLines.push(line);
    }

    extractedTags = extractedTags.map(tag => tag.substring(1));

    console.log('Extracted tags:', extractedTags);
    console.log('Cleaned content:', remainingLines.join('\n').trim());
};

// Make functions globally accessible for HTML onclick handlers
window.showCategoryContextMenu = showCategoryContextMenu;
window.refreshApp = refreshApp;
window.cancelImport = cancelImport;
window.startImport = startImport;
window.exportNotes = exportNotes;
window.showImportExportTab = showImportExportTab;
