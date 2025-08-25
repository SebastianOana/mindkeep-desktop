# MindKeep Desktop - Technical Documentation

## 📋 Current System Overview

### Architecture
MindKeep is built using Electron with a clean separation between main and renderer processes:

- **Main Process** (`main.js`): Handles system integration, database operations, and IPC
- **Renderer Process** (`renderer.js`): Manages UI, user interactions, and application logic
- **Preload Script** (`preload.js`): Secure bridge between main and renderer processes

### Core Technologies
- **Electron**: Cross-platform desktop application framework
- **SQLite**: Local database for data persistence (via custom database module)
- **Vanilla JavaScript**: No external UI frameworks for maximum performance
- **CSS Grid/Flexbox**: Modern layout techniques for responsive design
- **HTML5**: Semantic markup with accessibility considerations

## 🗂️ File Structure & Responsibilities

### Core Files
```
├── main.js                 # Electron main process, IPC handlers, app lifecycle
├── renderer.js             # UI logic, data management, user interactions
├── preload.js              # Secure IPC bridge with context isolation
├── index.html              # Complete UI structure and modals
├── style.css               # Comprehensive styling with CSS variables
└── package.json            # Dependencies, scripts, build configuration
```

### Modules Directory
```
modules/
├── database.js             # Optimized SQLite operations with caching
├── backup.js               # 3-slot backup system with compression
├── textEditor.js           # Rich text editing with formatting toolbar
├── themes.js               # Dynamic theme management system
├── export.js               # Export functionality for various formats
├── performance.js          # Performance monitoring and optimization
└── logger.js               # Comprehensive logging system
```

## 🔧 Key Features Implementation

### 1. Enhanced Import/Export System
**Location**: `renderer.js` (lines 2919-3500+)
**Features**:
- Drag & drop file interface with visual feedback
- Smart tag extraction from #hashtags in content
- Automatic date/time cleanup during import
- Real-time progress tracking with detailed feedback
- Support for JSON, Markdown, and Text files
- Duplicate detection and handling

**Key Functions**:
- `initializeImport()`: Sets up event listeners and UI
- `processSelectedFiles()`: Validates and processes selected files
- `importSingleFile()`: Handles individual file import with error handling
- `extractTitleFromContent()`: Smart title extraction from various formats

### 2. Advanced Search System
**Location**: `renderer.js` (search-related functions)
**Features**:
- Fuzzy matching with scoring algorithm
- Real-time search suggestions
- Tag-based search with # prefix
- In-note search with floating search bar
- Performance-optimized search index

### 3. Category Management
**Location**: `renderer.js` (category functions)
**Features**:
- Hierarchical category structure
- Drag & drop reordering
- Custom colors and icons
- Context menus for quick actions
- Bulk operations support

### 4. Rich Text Editor
**Location**: `modules/textEditor.js`
**Features**:
- Formatting toolbar with common options
- Note linking with @ mentions
- Image drag & drop support
- Auto-save functionality
- Keyboard shortcuts

### 5. Theme System
**Location**: `modules/themes.js`
**Features**:
- Dynamic CSS variable updates
- Light, dark, and auto themes
- System theme detection
- Smooth transitions between themes

## 🎨 UI/UX Design Patterns

### Modal System
- Centralized modal management with `showMainModal()` and `closeMainModal()`
- Enhanced confirmation dialogs with custom styling
- Responsive design that adapts to screen size
- Keyboard navigation support

### Responsive Design
- CSS Grid for main layout structure
- Flexbox for component-level layouts
- Media queries for mobile and tablet support
- Scalable typography and spacing

### Visual Feedback
- Loading states with progress indicators
- Hover effects and transitions
- Success/error notifications
- Drag & drop visual cues

## 🔒 Security Implementation

### Input Validation
- All user inputs are sanitized before processing
- File type validation for imports
- Content sanitization in rich text editor
- XSS prevention measures

### Secure IPC
- Context isolation enabled in renderer process
- No direct Node.js access in renderer
- Preload script acts as secure bridge
- Minimal API surface exposure

## 📊 Performance Optimizations

### Caching Strategy
- In-memory caches for frequently accessed data
- Search index for fast full-text search
- Debounced operations to prevent excessive API calls
- Lazy loading for large datasets

### Memory Management
- Efficient DOM manipulation
- Event listener cleanup
- Garbage collection considerations
- Resource cleanup on app close

## 🧪 Testing & Debugging

### Debug Functions
Available in browser console:
- `testImportSystem()`: Tests import system initialization
- `testTagExtraction()`: Tests hashtag parsing logic
- `performanceMonitor.getStats()`: Performance metrics
- `logger.getLogs()`: Application logs

### Error Handling
- Comprehensive try-catch blocks
- Graceful degradation for missing features
- User-friendly error messages
- Automatic error recovery where possible

## 🔄 Data Flow

### Application Startup
1. Main process creates window and loads HTML
2. Renderer process initializes modules
3. Database connection established
4. Categories and notes loaded from database
5. Search index built
6. UI updated with loaded data

### Note Operations
1. User interaction triggers event handler
2. Data validation and sanitization
3. Database operation via IPC
4. Local state update
5. UI refresh
6. Search index update (if needed)

### Import Process
1. File selection (drag & drop or browse)
2. File validation and preview generation
3. User configuration (category, tags, options)
4. File processing with progress tracking
5. Database insertion with error handling
6. UI update and success notification

## 🚀 Build & Distribution

### Development
```bash
npm install          # Install dependencies
npm run dev         # Start development mode
```

### Production Build
```bash
npm run build-win   # Windows executable
npm run build-mac   # macOS application
npm run build-linux # Linux AppImage
```

### Auto-updater
- Integrated electron-updater for automatic updates
- GitHub releases as update source
- Graceful fallback if updater unavailable

## 📈 Performance Metrics

### Current Performance
- **Startup Time**: ~2-3 seconds for 1000+ notes
- **Search Speed**: <100ms for most queries
- **Memory Usage**: ~150-200MB typical
- **Database Operations**: <50ms for most queries

### Optimization Opportunities
- Virtual scrolling for large note lists
- Web Workers for heavy computations
- IndexedDB for client-side caching
- Code splitting for faster startup
