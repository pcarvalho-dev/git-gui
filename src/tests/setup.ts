import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// Mock Tauri API - não disponível em ambiente de teste
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(null),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn().mockResolvedValue(null),
}));

// Limpa localStorage entre testes para não vazar estado dos stores persistidos
beforeEach(() => {
  localStorage.clear();
});
