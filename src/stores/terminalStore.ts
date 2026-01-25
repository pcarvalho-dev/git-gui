import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ShellType = 'powershell' | 'cmd' | 'wsl' | 'gitbash';

interface TerminalState {
  isOpen: boolean;
  height: number;
  shellType: ShellType;
  toggleTerminal: () => void;
  openTerminal: () => void;
  closeTerminal: () => void;
  setHeight: (height: number) => void;
  setShellType: (shell: ShellType) => void;
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set) => ({
      isOpen: false,
      height: 250,
      shellType: 'powershell',
      toggleTerminal: () => set((state) => ({ isOpen: !state.isOpen })),
      openTerminal: () => set({ isOpen: true }),
      closeTerminal: () => set({ isOpen: false }),
      setHeight: (height) => set({ height: Math.max(100, height) }),
      setShellType: (shellType) => set({ shellType }),
    }),
    {
      name: 'terminal-settings',
      partialize: (state) => ({ shellType: state.shellType, height: state.height }),
    }
  )
);
