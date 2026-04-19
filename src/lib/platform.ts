import { invoke } from '@tauri-apps/api/core';
import type { ShellType } from '@/stores/terminalStore';

let cached: string | null = null;

export async function getPlatform(): Promise<string> {
  if (!cached) {
    cached = await invoke<string>('terminal_get_platform');
  }
  return cached;
}

export const WINDOWS_SHELLS: ShellType[] = ['powershell', 'cmd', 'wsl', 'gitbash'];
export const UNIX_SHELLS: ShellType[] = ['bash', 'zsh', 'fish', 'sh'];

export function isWindowsShell(shell: ShellType): boolean {
  return WINDOWS_SHELLS.includes(shell);
}

export function isUnixShell(shell: ShellType): boolean {
  return UNIX_SHELLS.includes(shell);
}

export function getDefaultShellForPlatform(platform: string): ShellType {
  return platform === 'windows' ? 'powershell' : 'bash';
}

export type TerminalEmulatorOption = { value: string; label: string };

export const LINUX_TERMINAL_OPTIONS: TerminalEmulatorOption[] = [
  { value: 'gnome-terminal', label: 'GNOME Terminal' },
  { value: 'konsole', label: 'Konsole' },
  { value: 'xfce4-terminal', label: 'XFCE Terminal' },
  { value: 'tilix', label: 'Tilix' },
  { value: 'alacritty', label: 'Alacritty' },
  { value: 'kitty', label: 'Kitty' },
  { value: 'xterm', label: 'XTerm' },
];

export const WINDOWS_TERMINAL_OPTIONS: TerminalEmulatorOption[] = [
  { value: 'wt', label: 'Windows Terminal' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'cmd', label: 'CMD' },
];

export const MACOS_TERMINAL_OPTIONS: TerminalEmulatorOption[] = [
  { value: 'terminal', label: 'Terminal' },
  { value: 'iterm', label: 'iTerm2' },
  { value: 'alacritty', label: 'Alacritty' },
  { value: 'kitty', label: 'Kitty' },
];

export function getTerminalEmulatorOptions(platform: string): TerminalEmulatorOption[] {
  if (platform === 'windows') return WINDOWS_TERMINAL_OPTIONS;
  if (platform === 'macos') return MACOS_TERMINAL_OPTIONS;
  return LINUX_TERMINAL_OPTIONS;
}

export function getDefaultTerminalEmulator(platform: string): string {
  if (platform === 'windows') return 'wt';
  if (platform === 'macos') return 'terminal';
  return 'gnome-terminal';
}
