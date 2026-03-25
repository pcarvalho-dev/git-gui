import { describe, it, expect, beforeEach } from 'vitest';
import { useTerminalStore } from '@/stores/terminalStore';

describe('terminalStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useTerminalStore.setState({ isOpen: false, height: 250, shellType: 'powershell' });
  });

  it('estado inicial: terminal fechado, altura 250, shell powershell', () => {
    const state = useTerminalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.height).toBe(250);
    expect(state.shellType).toBe('powershell');
  });

  it('openTerminal abre o terminal', () => {
    useTerminalStore.getState().openTerminal();
    expect(useTerminalStore.getState().isOpen).toBe(true);
  });

  it('closeTerminal fecha o terminal', () => {
    useTerminalStore.setState({ isOpen: true });
    useTerminalStore.getState().closeTerminal();
    expect(useTerminalStore.getState().isOpen).toBe(false);
  });

  it('toggleTerminal alterna estado aberto/fechado', () => {
    useTerminalStore.getState().toggleTerminal();
    expect(useTerminalStore.getState().isOpen).toBe(true);
    useTerminalStore.getState().toggleTerminal();
    expect(useTerminalStore.getState().isOpen).toBe(false);
  });

  it('setHeight define a altura do terminal', () => {
    useTerminalStore.getState().setHeight(400);
    expect(useTerminalStore.getState().height).toBe(400);
  });

  it('setHeight aplica altura mínima de 100', () => {
    useTerminalStore.getState().setHeight(50);
    expect(useTerminalStore.getState().height).toBe(100);
  });

  it('setHeight exatamente 100 é permitido', () => {
    useTerminalStore.getState().setHeight(100);
    expect(useTerminalStore.getState().height).toBe(100);
  });

  it('setShellType define o tipo de shell', () => {
    useTerminalStore.getState().setShellType('wsl');
    expect(useTerminalStore.getState().shellType).toBe('wsl');
  });

  it('setShellType aceita todos os tipos válidos', () => {
    const shells = ['powershell', 'cmd', 'wsl', 'gitbash'] as const;
    for (const shell of shells) {
      useTerminalStore.getState().setShellType(shell);
      expect(useTerminalStore.getState().shellType).toBe(shell);
    }
  });
});
