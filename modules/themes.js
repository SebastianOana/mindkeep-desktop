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
                    '--bg-primary': '#f5f6fa',
                    '--bg-secondary': '#e8eaf0',
                    '--bg-tertiary': '#dcdde1',
                    '--text-primary': '#2f3542',
                    '--text-secondary': '#57606f',
                    '--text-muted': '#747d8c',
                    '--accent-primary': '#3742fa',
                    '--accent-secondary': '#2f3542',
                    '--border-color': '#c8d6e5',
                    '--success-color': '#2ed573',
                    '--warning-color': '#ffa502',
                    '--error-color': '#ff3838',
                    '--shadow': 'rgba(0, 0, 0, 0.08)'
                }
            },
            blue: {
                name: 'Ocean Blue',
                icon: '🌊',
                colors: {
                    '--bg-primary': '#1a1f36',
                    '--bg-secondary': '#2d3561',
                    '--bg-tertiary': '#404b7c',
                    '--text-primary': '#e8eaed',
                    '--text-secondary': '#c1c5d0',
                    '--text-muted': '#9aa0ac',
                    '--accent-primary': '#00d4ff',
                    '--accent-secondary': '#00b8e6',
                    '--border-color': '#404b7c',
                    '--success-color': '#00ff88',
                    '--warning-color': '#ffb347',
                    '--error-color': '#ff6b6b',
                    '--shadow': 'rgba(0, 0, 0, 0.4)'
                }
            },
            purple: {
                name: 'Purple Haze',
                icon: '🔮',
                colors: {
                    '--bg-primary': '#2d1b69',
                    '--bg-secondary': '#3e2a7a',
                    '--bg-tertiary': '#4f3a8b',
                    '--text-primary': '#f0f0f0',
                    '--text-secondary': '#d0d0d0',
                    '--text-muted': '#a0a0a0',
                    '--accent-primary': '#9d4edd',
                    '--accent-secondary': '#7b2cbf',
                    '--border-color': '#4f3a8b',
                    '--success-color': '#06ffa5',
                    '--warning-color': '#ffbe0b',
                    '--error-color': '#fb8500',
                    '--shadow': 'rgba(0, 0, 0, 0.5)'
                }
            },
            green: {
                name: 'Forest Green',
                icon: '🌲',
                colors: {
                    '--bg-primary': '#1b2f1b',
                    '--bg-secondary': '#2d4a2d',
                    '--bg-tertiary': '#3f5f3f',
                    '--text-primary': '#e8f5e8',
                    '--text-secondary': '#c8e6c8',
                    '--text-muted': '#a8d6a8',
                    '--accent-primary': '#4ade80',
                    '--accent-secondary': '#22c55e',
                    '--border-color': '#3f5f3f',
                    '--success-color': '#10b981',
                    '--warning-color': '#f59e0b',
                    '--error-color': '#ef4444',
                    '--shadow': 'rgba(0, 0, 0, 0.4)'
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
