import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '@/stores/settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.getState().resetToDefaults();
  });

  it('valores padrão corretos', () => {
    const state = useSettingsStore.getState();
    expect(state.themeMode).toBe('system');
    expect(state.fontSize).toBe(14);
    expect(state.editorFontSize).toBe(13);
    expect(state.editorTabSize).toBe(4);
    expect(state.editorWordWrap).toBe(true);
    expect(state.autoFetchInterval).toBe(0);
    expect(state.defaultView).toBe('files');
    expect(state.confirmBeforeDiscard).toBe(true);
    expect(state.showHiddenFiles).toBe(false);
    expect(state.defaultShell).toBe('powershell');
    expect(state.terminalFontSize).toBe(13);
  });

  it('setThemeMode define o modo de tema', () => {
    useSettingsStore.getState().setThemeMode('dark');
    expect(useSettingsStore.getState().themeMode).toBe('dark');
  });

  it('setFontSize define o tamanho da fonte', () => {
    useSettingsStore.getState().setFontSize(16);
    expect(useSettingsStore.getState().fontSize).toBe(16);
  });

  it('setFontFamily define a família da fonte', () => {
    useSettingsStore.getState().setFontFamily('monospace');
    expect(useSettingsStore.getState().fontFamily).toBe('monospace');
  });

  it('setEditorFontSize define tamanho da fonte do editor', () => {
    useSettingsStore.getState().setEditorFontSize(15);
    expect(useSettingsStore.getState().editorFontSize).toBe(15);
  });

  it('setEditorTabSize define tamanho do tab', () => {
    useSettingsStore.getState().setEditorTabSize(2);
    expect(useSettingsStore.getState().editorTabSize).toBe(2);
  });

  it('setEditorWordWrap define word wrap', () => {
    useSettingsStore.getState().setEditorWordWrap(false);
    expect(useSettingsStore.getState().editorWordWrap).toBe(false);
  });

  it('setGitUserName define nome do usuário git', () => {
    useSettingsStore.getState().setGitUserName('João');
    expect(useSettingsStore.getState().gitUserName).toBe('João');
  });

  it('setGitUserEmail define email do usuário git', () => {
    useSettingsStore.getState().setGitUserEmail('joao@exemplo.com');
    expect(useSettingsStore.getState().gitUserEmail).toBe('joao@exemplo.com');
  });

  it('setAutoFetchInterval define intervalo de fetch automático', () => {
    useSettingsStore.getState().setAutoFetchInterval(5);
    expect(useSettingsStore.getState().autoFetchInterval).toBe(5);
  });

  it('setDefaultView define a view padrão', () => {
    useSettingsStore.getState().setDefaultView('branches');
    expect(useSettingsStore.getState().defaultView).toBe('branches');
  });

  it('setConfirmBeforeDiscard define confirmação antes de descartar', () => {
    useSettingsStore.getState().setConfirmBeforeDiscard(false);
    expect(useSettingsStore.getState().confirmBeforeDiscard).toBe(false);
  });

  it('setShowHiddenFiles define exibição de arquivos ocultos', () => {
    useSettingsStore.getState().setShowHiddenFiles(true);
    expect(useSettingsStore.getState().showHiddenFiles).toBe(true);
  });

  it('setDefaultShell define o shell padrão', () => {
    useSettingsStore.getState().setDefaultShell('gitbash');
    expect(useSettingsStore.getState().defaultShell).toBe('gitbash');
  });

  it('setTerminalFontSize define o tamanho da fonte do terminal', () => {
    useSettingsStore.getState().setTerminalFontSize(14);
    expect(useSettingsStore.getState().terminalFontSize).toBe(14);
  });

  it('resetToDefaults restaura todos os valores padrão', () => {
    useSettingsStore.getState().setFontSize(20);
    useSettingsStore.getState().setGitUserName('Teste');
    useSettingsStore.getState().setDefaultShell('cmd');
    useSettingsStore.getState().resetToDefaults();
    const state = useSettingsStore.getState();
    expect(state.fontSize).toBe(14);
    expect(state.gitUserName).toBe('');
    expect(state.defaultShell).toBe('powershell');
  });
});
