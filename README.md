# MindKeep - Personal Knowledge Database

A powerful, modern desktop application for organizing notes, images, and knowledge with advanced features and a beautiful interface.

## ✨ Features

### 📝 Rich Text Editing
- Advanced text editor with formatting toolbar
- Support for headings (H1, H2, H3), bold, italic, underline
- Bullet points, numbered lists, and blockquotes
- Code blocks with syntax highlighting
- Note linking system with @ mentions
- Real-time auto-save functionality

### 🖼️ Media Support
- Drag & drop image support
- Paste screenshots directly (Ctrl+V)
- Image resizing and positioning
- Support for multiple image formats

### 📁 Advanced Organization
- Hierarchical category system with unlimited nesting
- Custom category colors and icons
- Drag & drop category reordering
- Category context menus for quick actions
- Bulk note operations (move, delete multiple notes)

### 🔍 Powerful Search
- Advanced search index with fuzzy matching
- Search by title, content, tags, and categories
- Tag-based search with # prefix
- In-note search with floating search bar (Ctrl+F)
- Real-time search suggestions

### 💾 Data Management
- 3-slot backup system with timestamps
- Enhanced Import/Export system with drag & drop interface
- Smart tag extraction from #hashtags in content
- Automatic date/time cleanup during import
- Individual note export capabilities
- Duplicate detection and handling
- Real-time import progress tracking
- Automatic data validation and recovery
- Optimized database with caching

### 🎨 Modern Interface
- Multiple theme support (Light, Dark, Auto)
- Responsive design for all screen sizes
- Smooth animations and transitions
- Enhanced confirmation modals
- Drag & drop interface elements

### ⌨️ Productivity Features
- Comprehensive keyboard shortcuts
- Note templates system
- Pin important notes
- Recent notes tracking
- Performance monitoring and optimization
- Logging system for debugging

### 🔒 Security & Performance
- Secure file handling with validation
- Memory optimization and caching
- Debounced operations for smooth performance
- Error handling and recovery systems

## 🚀 Installation

### Prerequisites
- Node.js 16+
- npm or yarn package manager

### For Development
```bash
# Clone the repository
git clone <repository-url>
cd mindkeep-desktop

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building Executables
```bash
# Install dependencies
npm install

# Build for Windows
npm run build-win

# Build for macOS
npm run build-mac

# Build for Linux
npm run build-linux

# Build for all platforms
npm run build
```

The built applications will be available in the `dist/` directory.

## 📖 Usage Guide

### Getting Started
1. **Create Your First Note**: Click "New" button or press Ctrl+N
2. **Set Up Categories**: Click "+ Category" to create organized folders with custom colors
3. **Write and Format**: Use the rich text editor with formatting toolbar
4. **Add Media**: Drag & drop images or paste screenshots (Ctrl+V)
5. **Save Your Work**: Auto-save is enabled, or press Ctrl+S manually

### Advanced Features

#### Category Management
- **Create Hierarchical Categories**: Nest categories within each other
- **Custom Colors**: Assign unique colors to categories for visual organization
- **Drag & Drop**: Reorder categories by dragging them
- **Context Menus**: Right-click categories for quick actions

#### Search & Navigation
- **Global Search**: Use the search bar to find notes across all categories
- **Tag Search**: Use `#tagname` to search by specific tags
- **In-Note Search**: Press Ctrl+F while viewing/editing a note
- **Recent Notes**: Access recently modified notes quickly

#### Backup & Export
- **3-Slot Backup System**: Create up to 3 timestamped backups
- **Export Options**: Export notes as JSON, Markdown, or plain text
- **Import Notes**: Import from various formats into specific categories
- **Individual Export**: Export selected notes separately

#### Keyboard Shortcuts
- `Ctrl+N` - Create new note
- `Ctrl+S` - Save current note
- `Ctrl+F` - Search (global or in-note)
- `Ctrl+B` - Bold text
- `Ctrl+I` - Italic text
- `Ctrl+U` - Underline text
- `Ctrl+R` - Refresh data
- `F11` - Toggle fullscreen

## 🏗️ Architecture

### Core Components

#### Frontend (Renderer Process)
- **renderer.js** - Main application logic and UI interactions
- **modules/textEditor.js** - Rich text editing functionality
- **modules/themes.js** - Theme management system
- **modules/export.js** - Export/import functionality
- **modules/performance.js** - Performance optimization utilities
- **modules/logger.js** - Logging and debugging system

#### Backend (Main Process)
- **main.js** - Electron main process and IPC handlers
- **modules/database.js** - Optimized database operations
- **modules/backup.js** - Backup and restore system

#### Key Features Explained

##### Search Index System
The application uses an advanced search index that:
- Tokenizes content for fast full-text search
- Implements fuzzy matching for typos and partial matches
- Scores results based on relevance (title matches, exact phrases, etc.)
- Provides real-time search suggestions

##### Performance Optimization
- **Caching System**: In-memory caches for frequently accessed data
- **Debounced Operations**: Prevents excessive API calls during typing
- **Virtual Scrolling**: Efficient rendering of large note lists
- **Batch Processing**: Groups multiple operations for better performance

##### Security Features
- **Input Validation**: All user inputs are sanitized and validated
- **Secure File Handling**: Safe file operations with error recovery
- **XSS Prevention**: Content sanitization in rich text editor

## 📁 File Structure

```
mindkeep-desktop/
├── main.js                 # Electron main process
├── renderer.js             # Main application logic
├── index.html              # Application UI structure
├── style.css               # Application styling
├── preload.js              # Secure IPC bridge
├── modules/                # Core functionality modules
│   ├── database.js         # Database operations
│   ├── backup.js           # Backup system
│   ├── textEditor.js       # Rich text editor
│   ├── themes.js           # Theme management
│   ├── export.js           # Export/import
│   ├── performance.js      # Performance utilities
│   └── logger.js           # Logging system
├── package.json            # Dependencies and scripts
└── README.md              # This file
```

### Data Storage
- **User Data Directory**: `%APPDATA%/mindkeep-data` (Windows) or equivalent
- **Notes**: Individual JSON files in `notes/` subdirectory
- **Categories**: Stored in `categories.json`
- **Backups**: Timestamped backups in `backups/` subdirectory
- **Metadata**: Application metadata in `meta.json`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🐛 Troubleshooting

### Common Issues
- **App won't start**: Check Node.js version (16+ required)
- **Notes not saving**: Check file permissions in user data directory
- **Search not working**: Try refreshing data with Ctrl+R
- **Import fails**: Ensure file format is supported (JSON, MD, TXT)

### Debug Mode
Enable debug logging by setting the environment variable:
```bash
DEBUG=mindkeep npm run dev
```

## 🚀 Improvement Roadmap

### 🎯 High Priority Features
- **📱 Mobile Companion App**: Sync notes with mobile devices
- **☁️ Cloud Sync**: Optional cloud synchronization (Google Drive, Dropbox)
- **🔗 Advanced Linking**: Bidirectional note links and graph view
- **📊 Analytics Dashboard**: Note statistics and usage insights
- **🎨 Custom Themes**: User-created theme system
- **🔍 Advanced Search**: Regex search, saved searches, search history
- **📝 Note Templates**: Expandable template system with variables
- **🏷️ Smart Tags**: Auto-tagging based on content analysis

### 🛠️ Technical Improvements
- **⚡ Performance**: Virtual scrolling for large note lists
- **🔒 Security**: End-to-end encryption for sensitive notes
- **🌐 Web Version**: Browser-based version for universal access
- **📱 PWA Support**: Progressive Web App capabilities
- **🔄 Real-time Sync**: Multi-device real-time synchronization
- **🗄️ Database Migration**: Support for external databases (PostgreSQL, MySQL)
- **🎯 Plugin System**: Extensible architecture for third-party plugins
- **📈 Telemetry**: Optional usage analytics for improvement insights

### 🎨 UI/UX Enhancements
- **🖼️ Rich Media**: Video, audio, and PDF embedding
- **📐 Layout Options**: Multiple note view layouts (grid, list, cards)
- **🎭 Animations**: Smooth micro-interactions and transitions
- **🖱️ Gestures**: Touch and trackpad gesture support
- **📱 Responsive**: Better mobile and tablet experience
- **🎨 Customization**: Customizable toolbar and interface
- **🔍 Quick Actions**: Command palette for power users
- **📋 Clipboard**: Enhanced clipboard integration

### 🔧 Developer Experience
- **🧪 Testing**: Comprehensive test suite (unit, integration, e2e)
- **📚 Documentation**: API documentation and developer guides
- **🔄 CI/CD**: Automated testing and deployment pipeline
- **📦 Packaging**: Improved build and distribution system
- **🐛 Debugging**: Enhanced debugging tools and error reporting
- **📊 Monitoring**: Application performance monitoring
- **🔍 Code Quality**: ESLint, Prettier, and code analysis tools
- **📝 TypeScript**: Migration to TypeScript for better type safety

## 🔄 Version History

### v7.0.6 - Current Release
- **🏷️ Advanced Tagging System**: Smart autocomplete, popular tags, and comprehensive tag manager
- **🎨 Enhanced Organization**: Category templates, color picker, and visual indicators
- **📋 Professional Modals**: Consistent, enhanced modal design throughout the app
- **🔄 Improved Quick Capture**: Tag support, empty note handling, and modal management
- **🎯 Duplicate Prevention**: Intelligent tag deduplication and validation
- **📏 Optimized Layout**: Increased minimum width and better responsive design
- **🎨 Minimalist Scrollbars**: Beautiful, context-aware scrollbar styling
- **🔧 Robust Error Handling**: Enhanced stability and graceful degradation

### Previous Updates
- Enhanced search system with fuzzy matching and scoring
- Improved backup system with 3-slot management
- Responsive modal design for all screen sizes
- Fixed category loading issues in backup restore
- Added comprehensive keyboard shortcuts
- Implemented advanced text editor with note linking
- Added theme system with auto-detection
- Performance optimizations and caching improvements