import { describe, it, expect, beforeEach } from 'vitest';
import { useDiffViewerStore } from '@/stores/diffViewerStore';
import type { DiffInfo, CommitInfo } from '@/types';

const makeDiff = (path: string): DiffInfo => ({
  path,
  old_path: path,
  hunks: [],
  additions: 0,
  deletions: 0,
  is_binary: false,
  status: 'modified',
});

const makeCommit = (): CommitInfo => ({
  hash: 'abc1234567890',
  short_hash: 'abc1234',
  message: 'feat: teste',
  summary: 'feat: teste',
  body: null,
  author_name: 'Test',
  author_email: 'test@test.com',
  author_date: 0,
  committer_name: 'Test',
  committer_email: 'test@test.com',
  committer_date: 0,
  parents: [],
  is_merge: false,
});

describe('diffViewerStore', () => {
  beforeEach(() => {
    useDiffViewerStore.setState({
      isOpen: false,
      diff: null,
      commit: null,
      allDiffs: [],
      currentIndex: 0,
    });
  });

  it('estado inicial correto', () => {
    const state = useDiffViewerStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.diff).toBeNull();
    expect(state.commit).toBeNull();
    expect(state.allDiffs).toHaveLength(0);
    expect(state.currentIndex).toBe(0);
  });

  it('openDiff abre o viewer com diff e commit', () => {
    const diff = makeDiff('src/index.ts');
    const commit = makeCommit();
    useDiffViewerStore.getState().openDiff(diff, commit);
    const state = useDiffViewerStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.diff?.path).toBe('src/index.ts');
    expect(state.commit?.hash).toBe('abc1234567890');
  });

  it('openDiff define currentIndex com base na posição no array', () => {
    const diffs = [makeDiff('a.ts'), makeDiff('b.ts'), makeDiff('c.ts')];
    const commit = makeCommit();
    useDiffViewerStore.getState().openDiff(diffs[1], commit, diffs);
    expect(useDiffViewerStore.getState().currentIndex).toBe(1);
  });

  it('openDiff define currentIndex 0 quando diff não está no array', () => {
    const diffs = [makeDiff('a.ts'), makeDiff('b.ts')];
    const commit = makeCommit();
    useDiffViewerStore.getState().openDiff(makeDiff('z.ts'), commit, diffs);
    expect(useDiffViewerStore.getState().currentIndex).toBe(0);
  });

  it('closeDiff reseta todo o estado', () => {
    const diff = makeDiff('src/index.ts');
    const commit = makeCommit();
    useDiffViewerStore.getState().openDiff(diff, commit);
    useDiffViewerStore.getState().closeDiff();
    const state = useDiffViewerStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.diff).toBeNull();
    expect(state.commit).toBeNull();
    expect(state.allDiffs).toHaveLength(0);
    expect(state.currentIndex).toBe(0);
  });

  it('nextDiff avança para o próximo diff', () => {
    const diffs = [makeDiff('a.ts'), makeDiff('b.ts'), makeDiff('c.ts')];
    const commit = makeCommit();
    useDiffViewerStore.getState().openDiff(diffs[0], commit, diffs);
    useDiffViewerStore.getState().nextDiff();
    expect(useDiffViewerStore.getState().currentIndex).toBe(1);
    expect(useDiffViewerStore.getState().diff?.path).toBe('b.ts');
  });

  it('nextDiff não passa do último elemento', () => {
    const diffs = [makeDiff('a.ts'), makeDiff('b.ts')];
    const commit = makeCommit();
    useDiffViewerStore.getState().openDiff(diffs[1], commit, diffs);
    useDiffViewerStore.getState().nextDiff();
    expect(useDiffViewerStore.getState().currentIndex).toBe(1);
  });

  it('prevDiff volta para o diff anterior', () => {
    const diffs = [makeDiff('a.ts'), makeDiff('b.ts'), makeDiff('c.ts')];
    const commit = makeCommit();
    useDiffViewerStore.getState().openDiff(diffs[2], commit, diffs);
    useDiffViewerStore.getState().prevDiff();
    expect(useDiffViewerStore.getState().currentIndex).toBe(1);
    expect(useDiffViewerStore.getState().diff?.path).toBe('b.ts');
  });

  it('prevDiff não passa do primeiro elemento', () => {
    const diffs = [makeDiff('a.ts'), makeDiff('b.ts')];
    const commit = makeCommit();
    useDiffViewerStore.getState().openDiff(diffs[0], commit, diffs);
    useDiffViewerStore.getState().prevDiff();
    expect(useDiffViewerStore.getState().currentIndex).toBe(0);
  });

  it('goToDiff vai para índice específico', () => {
    const diffs = [makeDiff('a.ts'), makeDiff('b.ts'), makeDiff('c.ts')];
    const commit = makeCommit();
    useDiffViewerStore.getState().openDiff(diffs[0], commit, diffs);
    useDiffViewerStore.getState().goToDiff(2);
    expect(useDiffViewerStore.getState().currentIndex).toBe(2);
    expect(useDiffViewerStore.getState().diff?.path).toBe('c.ts');
  });

  it('goToDiff ignora índice fora dos limites', () => {
    const diffs = [makeDiff('a.ts'), makeDiff('b.ts')];
    const commit = makeCommit();
    useDiffViewerStore.getState().openDiff(diffs[0], commit, diffs);
    useDiffViewerStore.getState().goToDiff(10);
    expect(useDiffViewerStore.getState().currentIndex).toBe(0);
  });
});
