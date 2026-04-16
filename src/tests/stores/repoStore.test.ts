import { beforeEach, describe, expect, it } from 'vitest';
import { useRepoStore } from '@/stores/repoStore';

describe('repoStore', () => {
  beforeEach(() => {
    useRepoStore.getState().clearSelections();
  });

  it('estado inicial: sem commit, arquivo ou issue selecionados', () => {
    const state = useRepoStore.getState();
    expect(state.selectedCommitHash).toBeNull();
    expect(state.selectedFilePath).toBeNull();
    expect(state.selectedFileStaged).toBe(false);
    expect(state.selectedIssueNumber).toBeNull();
    expect(state.compareBaseRef).toBeNull();
    expect(state.compareHeadRef).toBeNull();
  });

  it('setSelectedCommitHash define o hash', () => {
    useRepoStore.getState().setSelectedCommitHash('abc1234');
    expect(useRepoStore.getState().selectedCommitHash).toBe('abc1234');
  });

  it('setSelectedFilePath define caminho e contexto staged', () => {
    useRepoStore.getState().setSelectedFilePath('src/main.ts', true);
    const state = useRepoStore.getState();
    expect(state.selectedFilePath).toBe('src/main.ts');
    expect(state.selectedFileStaged).toBe(true);
  });

  it('setSelectedIssueNumber define a issue ativa', () => {
    useRepoStore.getState().setSelectedIssueNumber(42);
    expect(useRepoStore.getState().selectedIssueNumber).toBe(42);
  });

  it('setCompareRefs define as refs do compare atual', () => {
    useRepoStore.getState().setCompareRefs('main', 'feature/login');
    const state = useRepoStore.getState();
    expect(state.compareBaseRef).toBe('main');
    expect(state.compareHeadRef).toBe('feature/login');
  });

  it('clearSelections limpa todos os ponteiros de navegacao', () => {
    const store = useRepoStore.getState();
    store.setSelectedCommitHash('deadbeef');
    store.setSelectedFilePath('README.md', true);
    store.setSelectedIssueNumber(7);
    store.setCompareRefs('main', 'feature/login');
    store.clearSelections();

    const state = useRepoStore.getState();
    expect(state.selectedCommitHash).toBeNull();
    expect(state.selectedFilePath).toBeNull();
    expect(state.selectedFileStaged).toBe(false);
    expect(state.selectedIssueNumber).toBeNull();
    expect(state.compareBaseRef).toBeNull();
    expect(state.compareHeadRef).toBeNull();
  });
});
