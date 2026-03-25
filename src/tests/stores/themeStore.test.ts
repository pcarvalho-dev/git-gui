import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '@/stores/themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useThemeStore.setState({ theme: 'dark' });
    // Reseta o classList do documentElement
    document.documentElement.className = '';
  });

  it('tema padrão é dark', () => {
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('toggleTheme muda de dark para light', () => {
    useThemeStore.setState({ theme: 'dark' });
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('toggleTheme muda de light para dark', () => {
    useThemeStore.setState({ theme: 'light' });
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('setTheme define tema para light', () => {
    useThemeStore.getState().setTheme('light');
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('setTheme define tema para dark', () => {
    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('setTheme(dark) adiciona classe "dark" ao documentElement', () => {
    useThemeStore.getState().setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setTheme(light) remove classe "dark" do documentElement', () => {
    document.documentElement.classList.add('dark');
    useThemeStore.getState().setTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggleTheme atualiza a classe do documento', () => {
    useThemeStore.setState({ theme: 'dark' });
    document.documentElement.classList.add('dark');
    useThemeStore.getState().toggleTheme(); // dark → light
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
