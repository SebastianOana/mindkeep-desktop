// Theme management for MindKeep
class ThemeManager {
    constructor() {
        this.currentTheme = 'dark'; // default theme
        this.themes = {
            dark: {
                name: 'Dark',
                icon: '🌙',
                colors: {
                    '--bg-primary': '#2a2a2a',
                    '--bg-secondary': '#404040',
                    '--bg-tertiary': '#555555',
                    '--text-primary': '#e0e0e0',
                    '--text-secondary': '#b0b0b0',
                    '--text-muted': '#888888',
                    '--accent-primary': '#4a9eff',
                    '--accent-secondary': '#3d8bdb',
                    '--border-color': '#555555',
                    '--success-color': '#27ae60',
                    '--warning-color': '#f39c12',
                    '--error-color': '#e74c3c',
                    '--shadow': 'rgba(0, 0, 0, 0.3)'
                }
            },
            light: {
                name: 'Light',
                icon: '☀️',
                colors: {
                    '--bg-primary': '#ffffff',
                    '--bg-secondary': '#f8f9fa',
                    '--bg-tertiary': '#e9ecef',
                    '--text-primary': '#212529',
                    '--text-secondary': '#6c757d',
                    '--text-muted': '#adb5bd',
                    '--accent-primary': '#0d6efd',
                    '--accent-secondary': '#0b5ed7',
                    '--border-color': '#dee2e6',
                    '--success-color': '#198754',
                    '--warning-color': '#fd7e14',
                    '--error-color': '#dc3545',
                    '--shadow': 'rgba(0, 0, 0, 0.15)'
                }
            },
            midnight: {
                name: 'Midnight Blue',
                icon: '🌌',
                colors: {
                    '--bg-primary': '#0f1419',
                    '--bg-secondary': '#1a2332',
                    '--bg-tertiary': '#253041',
                    '--text-primary': '#e6f1ff',
                    '--text-secondary': '#b3d9ff',
                    '--text-muted': '#7aa3cc',
                    '--accent-primary': '#00d4ff',
                    '--accent-secondary': '#0099cc',
                    '--border-color': '#2d3748',
                    '--success-color': '#38a169',
                    '--warning-color': '#ed8936',
                    '--error-color': '#e53e3e',
                    '--shadow': 'rgba(0, 0, 0, 0.5)'
                }
            },
            forest: {
                name: 'Forest Green',
                icon: '🌲',
                colors: {
                    '--bg-primary': '#1a2e1a',
                    '--bg-secondary': '#2d4a2d',
                    '--bg-tertiary': '#3d5a3d',
                    '--text-primary': '#e8f5e8',
                    '--text-secondary': '#c8e6c8',
                    '--text-muted': '#a8d6a8',
                    '--accent-primary': '#4ade80',
                    '--accent-secondary': '#22c55e',
                    '--border-color': '#4a5d4a',
                    '--success-color': '#16a34a',
                    '--warning-color': '#eab308',
                    '--error-color': '#dc2626',
                    '--shadow': 'rgba(0, 0, 0, 0.4)'
                }
            },
            purple: {
                name: 'Purple Haze',
                icon: '🔮',
                colors: {
                    '--bg-primary': '#1e1b2e',
                    '--bg-secondary': '#2d2a42',
                    '--bg-tertiary': '#3c3856',
                    '--text-primary': '#f0eeff',
                    '--text-secondary': '#d0c7ff',
                    '--text-muted': '#b0a7d0',
                    '--accent-primary': '#a855f7',
                    '--accent-secondary': '#9333ea',
                    '--border-color': '#4c4669',
                    '--success-color': '#10b981',
                    '--warning-color': '#f59e0b',
                    '--error-color': '#ef4444',
                    '--shadow': 'rgba(0, 0, 0, 0.4)'
                }
            },
            sunset: {
                name: 'Sunset Orange',
                icon: '🌅',
                colors: {
                    '--bg-primary': '#2e1a0f',
                    '--bg-secondary': '#4a2d1a',
                    '--bg-tertiary': '#5a3d2a',
                    '--text-primary': '#fff5e6',
                    '--text-secondary': '#ffd9b3',
                    '--text-muted': '#cc9966',
                    '--accent-primary': '#ff6b35',
                    '--accent-secondary': '#e55a2b',
                    '--border-color': '#6b4423',
                    '--success-color': '#059669',
                    '--warning-color': '#d97706',
                    '--error-color': '#dc2626',
                    '--shadow': 'rgba(0, 0, 0, 0.4)'
                }
            },
            ocean: {
                name: 'Ocean Blue',
                icon: '🌊',
                colors: {
                    '--bg-primary': '#0c1821',
                    '--bg-secondary': '#1b2a3a',
                    '--bg-tertiary': '#2a3c4e',
                    '--text-primary': '#e6f3ff',
                    '--text-secondary': '#b3d9ff',
                    '--text-muted': '#7aa3cc',
                    '--accent-primary': '#06b6d4',
                    '--accent-secondary': '#0891b2',
                    '--border-color': '#334155',
                    '--success-color': '#10b981',
                    '--warning-color': '#f59e0b',
                    '--error-color': '#ef4444',
                    '--shadow': 'rgba(0, 0, 0, 0.4)'
                }
            },
            rose: {
                name: 'Rose Gold',
                icon: '🌹',
                colors: {
                    '--bg-primary': '#2a1f1f',
                    '--bg-secondary': '#3d2d2d',
                    '--bg-tertiary': '#4d3a3a',
                    '--text-primary': '#ffe6e6',
                    '--text-secondary': '#ffcccc',
                    '--text-muted': '#cc9999',
                    '--accent-primary': '#f43f5e',
                    '--accent-secondary': '#e11d48',
                    '--border-color': '#5d4444',
                    '--success-color': '#10b981',
                    '--warning-color': '#f59e0b',
                    '--error-color': '#dc2626',
                    '--shadow': 'rgba(0, 0, 0, 0.4)'
                }
            },
            cyberpunk: {
                name: 'Cyberpunk',
                icon: '🤖',
                colors: {
                    '--bg-primary': '#0a0a0a',
                    '--bg-secondary': '#1a1a2e',
                    '--bg-tertiary': '#16213e',
                    '--text-primary': '#00ff9f',
                    '--text-secondary': '#00d4aa',
                    '--text-muted': '#00a885',
                    '--accent-primary': '#ff0080',
                    '--accent-secondary': '#e6006b',
                    '--border-color': '#0f3460',
                    '--success-color': '#00ff9f',
                    '--warning-color': '#ffff00',
                    '--error-color': '#ff0040',
                    '--shadow': 'rgba(255, 0, 128, 0.3)'
                }
            },
            coffee: {
                name: 'Warm Coffee',
                icon: '☕',
                colors: {
                    '--bg-primary': '#2c1810',
                    '--bg-secondary': '#3e2723',
                    '--bg-tertiary': '#4e342e',
                    '--text-primary': '#f5e6d3',
                    '--text-secondary': '#d7c4b0',
                    '--text-muted': '#a1887f',
                    '--accent-primary': '#ff8a65',
                    '--accent-secondary': '#ff7043',
                    '--border-color': '#5d4037',
                    '--success-color': '#4caf50',
                    '--warning-color': '#ff9800',
                    '--error-color': '#f44336',
                    '--shadow': 'rgba(0, 0, 0, 0.4)'
                }
            },
            arctic: {
                name: 'Arctic Blue',
                icon: '❄️',
                colors: {
                    '--bg-primary': '#f0f8ff',
                    '--bg-secondary': '#e6f3ff',
                    '--bg-tertiary': '#d1e7ff',
                    '--text-primary': '#1e3a8a',
                    '--text-secondary': '#3b82f6',
                    '--text-muted': '#6b7280',
                    '--accent-primary': '#0ea5e9',
                    '--accent-secondary': '#0284c7',
                    '--border-color': '#bfdbfe',
                    '--success-color': '#059669',
                    '--warning-color': '#d97706',
                    '--error-color': '#dc2626',
                    '--shadow': 'rgba(59, 130, 246, 0.15)'
                }
            },
            neon: {
                name: 'Neon Green',
                icon: '💚',
                colors: {
                    '--bg-primary': '#0d1117',
                    '--bg-secondary': '#161b22',
                    '--bg-tertiary': '#21262d',
                    '--text-primary': '#39ff14',
                    '--text-secondary': '#32d912',
                    '--text-muted': '#2bb310',
                    '--accent-primary': '#39ff14',
                    '--accent-secondary': '#32d912',
                    '--border-color': '#30363d',
                    '--success-color': '#39ff14',
                    '--warning-color': '#ffff00',
                    '--error-color': '#ff073a',
                    '--shadow': 'rgba(57, 255, 20, 0.3)'
                }
            },
            vintage: {
                name: 'Vintage Sepia',
                icon: '📜',
                colors: {
                    '--bg-primary': '#f4f1e8',
                    '--bg-secondary': '#ede7d3',
                    '--bg-tertiary': '#e6dcc6',
                    '--text-primary': '#3c2e26',
                    '--text-secondary': '#5d4e37',
                    '--text-muted': '#8b7355',
                    '--accent-primary': '#8b4513',
                    '--accent-secondary': '#a0522d',
                    '--border-color': '#d2b48c',
                    '--success-color': '#228b22',
                    '--warning-color': '#ff8c00',
                    '--error-color': '#b22222',
                    '--shadow': 'rgba(60, 46, 38, 0.2)'
                }
            },
            contrast: {
                name: 'High Contrast',
                icon: '⚫',
                colors: {
                    '--bg-primary': '#000000',
                    '--bg-secondary': '#1a1a1a',
                    '--bg-tertiary': '#333333',
                    '--text-primary': '#ffffff',
                    '--text-secondary': '#e0e0e0',
                    '--text-muted': '#b0b0b0',
                    '--accent-primary': '#ffff00',
                    '--accent-secondary': '#ffcc00',
                    '--border-color': '#666666',
                    '--success-color': '#00ff00',
                    '--warning-color': '#ff8800',
                    '--error-color': '#ff0000',
                    '--shadow': 'rgba(255, 255, 255, 0.2)'
                }
            },
            pastel: {
                name: 'Pastel Dream',
                icon: '🌸',
                colors: {
                    '--bg-primary': '#fef7ff',
                    '--bg-secondary': '#fae8ff',
                    '--bg-tertiary': '#f3e8ff',
                    '--text-primary': '#581c87',
                    '--text-secondary': '#7c3aed',
                    '--text-muted': '#a78bfa',
                    '--accent-primary': '#c084fc',
                    '--accent-secondary': '#a855f7',
                    '--border-color': '#e9d5ff',
                    '--success-color': '#10b981',
                    '--warning-color': '#f59e0b',
                    '--error-color': '#ef4444',
                    '--shadow': 'rgba(196, 132, 252, 0.2)'
                }
            },
            matrix: {
                name: 'Matrix Green',
                icon: '🔋',
                colors: {
                    '--bg-primary': '#000000',
                    '--bg-secondary': '#001100',
                    '--bg-tertiary': '#002200',
                    '--text-primary': '#00ff00',
                    '--text-secondary': '#00cc00',
                    '--text-muted': '#009900',
                    '--accent-primary': '#00ff41',
                    '--accent-secondary': '#00cc33',
                    '--border-color': '#003300',
                    '--success-color': '#00ff00',
                    '--warning-color': '#ffff00',
                    '--error-color': '#ff0000',
                    '--shadow': 'rgba(0, 255, 0, 0.3)'
                }
            },
            dracula: {
                name: 'Dracula',
                icon: '🧛',
                colors: {
                    '--bg-primary': '#282a36',
                    '--bg-secondary': '#44475a',
                    '--bg-tertiary': '#6272a4',
                    '--text-primary': '#f8f8f2',
                    '--text-secondary': '#bd93f9',
                    '--text-muted': '#6272a4',
                    '--accent-primary': '#ff79c6',
                    '--accent-secondary': '#bd93f9',
                    '--border-color': '#44475a',
                    '--success-color': '#50fa7b',
                    '--warning-color': '#f1fa8c',
                    '--error-color': '#ff5555',
                    '--shadow': 'rgba(68, 71, 90, 0.4)'
                }
            },
            monokai: {
                name: 'Monokai',
                icon: '🎨',
                colors: {
                    '--bg-primary': '#272822',
                    '--bg-secondary': '#3e3d32',
                    '--bg-tertiary': '#49483e',
                    '--text-primary': '#f8f8f2',
                    '--text-secondary': '#a6e22e',
                    '--text-muted': '#75715e',
                    '--accent-primary': '#f92672',
                    '--accent-secondary': '#ae81ff',
                    '--border-color': '#49483e',
                    '--success-color': '#a6e22e',
                    '--warning-color': '#e6db74',
                    '--error-color': '#f92672',
                    '--shadow': 'rgba(39, 40, 34, 0.5)'
                }
            },
            solarized: {
                name: 'Solarized Dark',
                icon: '☀️',
                colors: {
                    '--bg-primary': '#002b36',
                    '--bg-secondary': '#073642',
                    '--bg-tertiary': '#586e75',
                    '--text-primary': '#839496',
                    '--text-secondary': '#93a1a1',
                    '--text-muted': '#657b83',
                    '--accent-primary': '#268bd2',
                    '--accent-secondary': '#2aa198',
                    '--border-color': '#073642',
                    '--success-color': '#859900',
                    '--warning-color': '#b58900',
                    '--error-color': '#dc322f',
                    '--shadow': 'rgba(0, 43, 54, 0.4)'
                }
            },
            gruvbox: {
                name: 'Gruvbox',
                icon: '🍂',
                colors: {
                    '--bg-primary': '#282828',
                    '--bg-secondary': '#3c3836',
                    '--bg-tertiary': '#504945',
                    '--text-primary': '#ebdbb2',
                    '--text-secondary': '#d5c4a1',
                    '--text-muted': '#a89984',
                    '--accent-primary': '#fe8019',
                    '--accent-secondary': '#d65d0e',
                    '--border-color': '#504945',
                    '--success-color': '#b8bb26',
                    '--warning-color': '#fabd2f',
                    '--error-color': '#fb4934',
                    '--shadow': 'rgba(40, 40, 40, 0.4)'
                }
            },
            tokyo: {
                name: 'Tokyo Night',
                icon: '🌃',
                colors: {
                    '--bg-primary': '#1a1b26',
                    '--bg-secondary': '#24283b',
                    '--bg-tertiary': '#414868',
                    '--text-primary': '#c0caf5',
                    '--text-secondary': '#a9b1d6',
                    '--text-muted': '#565f89',
                    '--accent-primary': '#7aa2f7',
                    '--accent-secondary': '#bb9af7',
                    '--border-color': '#414868',
                    '--success-color': '#9ece6a',
                    '--warning-color': '#e0af68',
                    '--error-color': '#f7768e',
                    '--shadow': 'rgba(26, 27, 38, 0.4)'
                }
            },
            nord: {
                name: 'Nord',
                icon: '🏔️',
                colors: {
                    '--bg-primary': '#2e3440',
                    '--bg-secondary': '#3b4252',
                    '--bg-tertiary': '#434c5e',
                    '--text-primary': '#eceff4',
                    '--text-secondary': '#d8dee9',
                    '--text-muted': '#81a1c1',
                    '--accent-primary': '#88c0d0',
                    '--accent-secondary': '#81a1c1',
                    '--border-color': '#434c5e',
                    '--success-color': '#a3be8c',
                    '--warning-color': '#ebcb8b',
                    '--error-color': '#bf616a',
                    '--shadow': 'rgba(46, 52, 64, 0.4)'
                }
            },
            onedark: {
                name: 'One Dark',
                icon: '⚫',
                colors: {
                    '--bg-primary': '#282c34',
                    '--bg-secondary': '#21252b',
                    '--bg-tertiary': '#3e4451',
                    '--text-primary': '#abb2bf',
                    '--text-secondary': '#9da5b4',
                    '--text-muted': '#5c6370',
                    '--accent-primary': '#61afef',
                    '--accent-secondary': '#c678dd',
                    '--border-color': '#3e4451',
                    '--success-color': '#98c379',
                    '--warning-color': '#e5c07b',
                    '--error-color': '#e06c75',
                    '--shadow': 'rgba(40, 44, 52, 0.4)'
                }
            },
            catppuccin: {
                name: 'Catppuccin',
                icon: '🐱',
                colors: {
                    '--bg-primary': '#1e1e2e',
                    '--bg-secondary': '#313244',
                    '--bg-tertiary': '#45475a',
                    '--text-primary': '#cdd6f4',
                    '--text-secondary': '#bac2de',
                    '--text-muted': '#a6adc8',
                    '--accent-primary': '#cba6f7',
                    '--accent-secondary': '#f5c2e7',
                    '--border-color': '#45475a',
                    '--success-color': '#a6e3a1',
                    '--warning-color': '#f9e2af',
                    '--error-color': '#f38ba8',
                    '--shadow': 'rgba(30, 30, 46, 0.4)'
                }
            }
        };
        
        this.loadSavedTheme();
    }

    // Load saved theme from localStorage
    loadSavedTheme() {
        const saved = localStorage.getItem('mindkeep-theme');
        if (saved && this.themes[saved]) {
            this.currentTheme = saved;
        }
        this.applyTheme(this.currentTheme);
    }

    // Save theme to localStorage
    saveTheme(themeName) {
        localStorage.setItem('mindkeep-theme', themeName);
        logger.info(`Theme saved: ${themeName}`);
    }

    // Apply theme to document
    applyTheme(themeName) {
        if (!this.themes[themeName]) {
            logger.warn(`Theme not found: ${themeName}`);
            return false;
        }

        const theme = this.themes[themeName];
        const root = document.documentElement;

        // Apply CSS custom properties
        Object.entries(theme.colors).forEach(([property, value]) => {
            root.style.setProperty(property, value);
        });

        this.currentTheme = themeName;
        this.saveTheme(themeName);
        
        // Update theme selector if it exists
        this.updateThemeSelector();
        
        logger.info(`Theme applied: ${theme.name}`);
        return true;
    }

    // Switch to next theme
    nextTheme() {
        const themeNames = Object.keys(this.themes);
        const currentIndex = themeNames.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % themeNames.length;
        const nextTheme = themeNames[nextIndex];
        
        this.applyTheme(nextTheme);
        return nextTheme;
    }

    // Switch to previous theme
    previousTheme() {
        const themeNames = Object.keys(this.themes);
        const currentIndex = themeNames.indexOf(this.currentTheme);
        const prevIndex = currentIndex === 0 ? themeNames.length - 1 : currentIndex - 1;
        const prevTheme = themeNames[prevIndex];
        
        this.applyTheme(prevTheme);
        return prevTheme;
    }

    // Get current theme info
    getCurrentTheme() {
        return {
            name: this.currentTheme,
            ...this.themes[this.currentTheme]
        };
    }

    // Get all available themes
    getAllThemes() {
        return Object.entries(this.themes).map(([key, theme]) => ({
            key,
            ...theme
        }));
    }

    // Update theme selector UI
    updateThemeSelector() {
        const selector = document.getElementById('themeSelector');
        if (selector) {
            selector.value = this.currentTheme;

            // Update the options to reflect current theme
            const themes = this.getAllThemes();
            selector.innerHTML = themes.map(theme =>
                `<option value="${theme.key}" ${theme.key === this.currentTheme ? 'selected' : ''}>
                    ${theme.icon} ${theme.name}
                </option>`
            ).join('');
        }
    }

    // Create theme selector HTML
    createThemeSelector() {
        const themes = this.getAllThemes();
        return `
            <select id="themeSelector" class="theme-selector" onchange="themeManager.applyTheme(this.value)">
                ${themes.map(theme => 
                    `<option value="${theme.key}" ${theme.key === this.currentTheme ? 'selected' : ''}>
                        ${theme.icon} ${theme.name}
                    </option>`
                ).join('')}
            </select>
        `;
    }

    // Create theme toggle button
    createThemeToggle() {
        const currentTheme = this.themes[this.currentTheme];
        return `
            <button id="themeToggle" class="theme-toggle" onclick="themeManager.nextTheme()" title="Switch theme">
                ${currentTheme.icon} ${currentTheme.name}
            </button>
        `;
    }

    // Add custom theme
    addCustomTheme(name, colors, icon = '🎨') {
        this.themes[name] = {
            name: name.charAt(0).toUpperCase() + name.slice(1),
            icon,
            colors
        };
        logger.info(`Custom theme added: ${name}`);
    }

    // Remove custom theme
    removeCustomTheme(name) {
        if (this.themes[name] && !['dark', 'light'].includes(name)) {
            delete this.themes[name];
            
            // Switch to default if current theme was removed
            if (this.currentTheme === name) {
                this.applyTheme('dark');
            }
            
            logger.info(`Custom theme removed: ${name}`);
            return true;
        }
        return false;
    }

    // Export current theme
    exportTheme() {
        const theme = this.getCurrentTheme();
        const exportData = {
            name: theme.name,
            icon: theme.icon,
            colors: theme.colors,
            exported: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `mindkeep-theme-${this.currentTheme}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        logger.info(`Theme exported: ${theme.name}`);
    }

    // Import theme from JSON
    async importTheme(file) {
        try {
            const text = await file.text();
            const themeData = JSON.parse(text);
            
            if (!themeData.colors || !themeData.name) {
                throw new Error('Invalid theme file format');
            }
            
            const themeName = themeData.name.toLowerCase().replace(/\s+/g, '_');
            this.addCustomTheme(themeName, themeData.colors, themeData.icon || '🎨');
            
            logger.info(`Theme imported: ${themeData.name}`);
            return themeName;
        } catch (error) {
            logger.error('Theme import failed', error);
            throw error;
        }
    }

    // Auto-detect system theme preference
    detectSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    // Set up system theme detection
    setupSystemThemeDetection() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addListener((e) => {
                const systemTheme = e.matches ? 'dark' : 'light';
                logger.info(`System theme changed to: ${systemTheme}`);
                
                // Only auto-switch if user hasn't manually selected a theme
                const userTheme = localStorage.getItem('mindkeep-theme');
                if (!userTheme) {
                    this.applyTheme(systemTheme);
                }
            });
        }
    }
}

// Create global instance
const themeManager = new ThemeManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ThemeManager, themeManager };
} else {
    window.ThemeManager = ThemeManager;
    window.themeManager = themeManager;
}
