import { describe, it, expect, beforeEach } from 'vitest';
import { useRepoStore } from '@/stores/repoStore';

describe('repoStore', () => {
  beforeEach(() => {
    useRepoStore.setState({ selectedCommitHash: null, selectedFilePath: null });
  });

  it('estado inicial: sem commit e sem arquivo selecionado', () => {
    const { selectedCommitHash, selectedFilePath } = useRepoStore.getState();
    expect(selectedCommitHash).toBeNull();
    expect(selectedFilePath).toBeNull();
  });

  it('setSelectedCommitHash define o hash', () => {
    useRepoStore.getState().setSelectedCommitHash('abc1234');
    expect(useRepoStore.getState().selectedCommitHash).toBe('abc1234');
  });

  it('setSelectedCommitHash aceita null para limpar seleção', () => {
    useRepoStore.getState().setSelectedCommitHash('abc1234');
    useRepoStore.getState().setSelectedCommitHash(null);
    expect(useRepoStore.getState().selectedCommitHash).toBeNull();
  });

  it('setSelectedFilePath define o caminho do arquivo', () => {
    useRepoStore.getState().setSelectedFilePath('src/main.ts');
    expect(useRepoStore.getState().selectedFilePath).toBe('src/main.ts');
  });

  it('setSelectedFilePath aceita null para limpar seleção', () => {
    useRepoStore.getState().setSelectedFilePath('src/main.ts');
    useRepoStore.getState().setSelectedFilePath(null);
    expect(useRepoStore.getState().selectedFilePath).toBeNull();
  });

  it('commit e arquivo podem ser definidos independentemente', () => {
    useRepoStore.getState().setSelectedCommitHash('deadbeef');
    useRepoStore.getState().setSelectedFilePath('README.md');
    const state = useRepoStore.getState();
    expect(state.selectedCommitHash).toBe('deadbeef');
    expect(state.selectedFilePath).toBe('README.md');
  });
});
