// Type definitions for the preload script API
interface ElectronAPI {
  // Database operations
  getCategories: () => Promise<any[]>;
  addCategory: (name: string, color: string, parent: string | null) => Promise<number>;
  deleteCategory: (name: string) => Promise<number>;
  
  getNotes: () => Promise<any[]>;
  saveNote: (note: any) => Promise<number>;
  deleteNote: (id: string) => Promise<number>;
  getNotesSorted: (sortBy: string) => Promise<any[]>;
  togglePinNote: (id: string) => Promise<number>;
  
  // Update functionality
  checkForUpdates: () => Promise<any>;
  installUpdate: () => Promise<void>;
  getAppVersion: () => Promise<string>;
  
  // Event listeners for updates
  onUpdateChecking: (callback: () => void) => void;
  onUpdateAvailable: (callback: (event: any, version: string) => void) => void;
  onUpdateNotAvailable: (callback: () => void) => void;
  onUpdateError: (callback: (event: any, error: string) => void) => void;
  onUpdateProgress: (callback: (event: any, percent: number) => void) => void;
  onUpdateDownloaded: (callback: () => void) => void;
  onCurrentVersion: (callback: (event: any, version: string) => void) => void;
  
  // Keyboard shortcuts
  onShortcutNewNote: (callback: () => void) => void;
  onShortcutFocusSearch: (callback: () => void) => void;
  
  // Remove listeners
  removeAllListeners: (channel: string) => void;
}

interface NodeAPI {
  platform: string;
  versions: any;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    nodeAPI: NodeAPI;
  }
}

export {};
