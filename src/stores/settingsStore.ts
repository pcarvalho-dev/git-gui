import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'pt-BR' | 'en-US';
export type DefaultView = 'graph' | 'files' | 'branches' | 'history' | 'stash' | 'remote' | 'pr';

interface SettingsState {
  // Appearance
  themeMode: ThemeMode;
  fontSize: number;
  fontFamily: string;

  // Editor
  editorFontSize: number;
  editorFontFamily: string;
  editorTabSize: number;
  editorWordWrap: boolean;

  // Git
  gitUserName: string;
  gitUserEmail: string;
  autoFetchInterval: number; // in minutes, 0 = disabled

  // Behavior
  defaultView: DefaultView;
  confirmBeforeDiscard: boolean;
  showHiddenFiles: boolean;

  // Terminal
  defaultShell: 'powershell' | 'cmd' | 'wsl' | 'gitbash';
  terminalFontSize: number;

  // Actions
  setThemeMode: (mode: ThemeMode) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setEditorFontSize: (size: number) => void;
  setEditorFontFamily: (family: string) => void;
  setEditorTabSize: (size: number) => void;
  setEditorWordWrap: (wrap: boolean) => void;
  setGitUserName: (name: string) => void;
  setGitUserEmail: (email: string) => void;
  setAutoFetchInterval: (interval: number) => void;
  setDefaultView: (view: DefaultView) => void;
  setConfirmBeforeDiscard: (confirm: boolean) => void;
  setShowHiddenFiles: (show: boolean) => void;
  setDefaultShell: (shell: 'powershell' | 'cmd' | 'wsl' | 'gitbash') => void;
  setTerminalFontSize: (size: number) => void;
  resetToDefaults: () => void;
}

const defaultSettings = {
  themeMode: 'system' as ThemeMode,
  fontSize: 14,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  editorFontSize: 13,
  editorFontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, monospace',
  editorTabSize: 4,
  editorWordWrap: true,
  gitUserName: '',
  gitUserEmail: '',
  autoFetchInterval: 0,
  defaultView: 'files' as DefaultView,
  confirmBeforeDiscard: true,
  showHiddenFiles: false,
  defaultShell: 'powershell' as const,
  terminalFontSize: 13,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setThemeMode: (themeMode) => set({ themeMode }),
      setFontSize: (fontSize) => set({ fontSize }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setEditorFontSize: (editorFontSize) => set({ editorFontSize }),
      setEditorFontFamily: (editorFontFamily) => set({ editorFontFamily }),
      setEditorTabSize: (editorTabSize) => set({ editorTabSize }),
      setEditorWordWrap: (editorWordWrap) => set({ editorWordWrap }),
      setGitUserName: (gitUserName) => set({ gitUserName }),
      setGitUserEmail: (gitUserEmail) => set({ gitUserEmail }),
      setAutoFetchInterval: (autoFetchInterval) => set({ autoFetchInterval }),
      setDefaultView: (defaultView) => set({ defaultView }),
      setConfirmBeforeDiscard: (confirmBeforeDiscard) => set({ confirmBeforeDiscard }),
      setShowHiddenFiles: (showHiddenFiles) => set({ showHiddenFiles }),
      setDefaultShell: (defaultShell) => set({ defaultShell }),
      setTerminalFontSize: (terminalFontSize) => set({ terminalFontSize }),
      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: 'app-settings',
    }
  )
);
