# MindKeep - Personal Knowledge Database

A powerful desktop application for organizing notes, images, and knowledge with categories and rich text editing.

## Features

- 📝 Rich text editing with formatting tools
- 🖼️ Image support (drag & drop, paste screenshots)
- 📁 Category management with custom colors
- 🏷️ Tag system for organization
- 🔍 Search functionality
- 💾 Offline storage
- ⌨️ Keyboard shortcuts (Ctrl+S to save)

## Installation

### For Development
```bash
npm install
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

## Usage

1. **Create Notes**: Click "New Note" to start writing
2. **Add Categories**: Use "+ Category" to create colored categories
3. **Add Images**: Drag & drop or paste screenshots (Ctrl+V)
4. **Format Text**: Use toolbar buttons for bold, italic, lists, etc.
5. **Search**: Use the search bar to find notes by title or tags
6. **Save**: Press Ctrl+S or click Save button

## File Structure

- `notes/` - JSON files containing note data
- `images/` - Stored images from notes
- `categories.json` - Category definitions with colors

## License

MIT License