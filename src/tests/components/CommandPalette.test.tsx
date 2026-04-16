import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CommandPalette from '@/components/features/CommandPalette';
import { useRepoStore } from '@/stores/repoStore';
import type { BranchInfo, CommitInfo, Issue, RepoInfo, RepoStatus } from '@/types';

const mockBranches: BranchInfo[] = [
  {
    name: 'main',
    is_current: true,
    is_remote: false,
    is_head: true,
    commit_hash: 'abc1234',
    commit_message: 'base branch',
    upstream: 'origin/main',
    ahead: 0,
    behind: 0,
    author_name: 'Pablo',
    author_email: 'pablo@test.com',
    commit_date: Math.floor(Date.now() / 1000),
  },
  {
    name: 'feature/palette',
    is_current: false,
    is_remote: false,
    is_head: false,
    commit_hash: 'def5678',
    commit_message: 'feat: command palette',
    upstream: null,
    ahead: null,
    behind: null,
    author_name: 'Pablo',
    author_email: 'pablo@test.com',
    commit_date: Math.floor(Date.now() / 1000),
  },
];

const mockCommits: CommitInfo[] = [
  {
    hash: '1111111111111111',
    short_hash: '1111111',
    message: 'feat: add palette',
    summary: 'feat: add palette',
    body: null,
    author_name: 'Pablo',
    author_email: 'pablo@test.com',
    author_date: Math.floor(Date.now() / 1000),
    committer_name: 'Pablo',
    committer_email: 'pablo@test.com',
    committer_date: Math.floor(Date.now() / 1000),
    parents: [],
    is_merge: false,
  },
];

const mockIssues: Issue[] = [
  {
    number: 17,
    title: 'Create command palette',
    body: null,
    state: 'OPEN',
    author: 'pablo',
    labels: [],
    assignees: [],
    milestone_number: null,
    milestone_title: null,
    url: 'https://github.com/org/repo/issues/17',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    comments_count: 0,
    locked: false,
    active_lock_reason: null,
  },
];

const mockCheckoutMutate = vi.fn();

vi.mock('@/hooks/useGit', () => ({
  useBranches: vi.fn(() => ({ data: mockBranches, isLoading: false })),
  useCheckoutBranch: vi.fn(() => ({ mutate: mockCheckoutMutate, isPending: false })),
  useCommits: vi.fn(() => ({ data: mockCommits, isLoading: false })),
  useIssues: vi.fn(() => ({ data: mockIssues, isLoading: false })),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

describe('CommandPalette', () => {
  const repoInfo: RepoInfo = {
    path: '/repos/git-gui',
    name: 'git-gui',
    is_repo: true,
    is_bare: false,
    current_branch: 'main',
    has_remote: true,
    is_empty: false,
  };

  const status: RepoStatus = {
    current_branch: 'main',
    head_commit: '1111111',
    staged_files: [{ path: 'src/App.tsx', status: 'modified', is_binary: false }],
    unstaged_files: [],
    untracked_files: [],
    conflicted_files: [],
    ahead: 0,
    behind: 0,
    is_rebasing: false,
    is_merging: false,
    is_cherry_picking: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useRepoStore.getState().clearSelections();
  });

  it('seleciona arquivo e navega para a tela de arquivos', () => {
    const setView = vi.fn();

    render(
      <CommandPalette
        open={true}
        onOpenChange={vi.fn()}
        view="files"
        setView={setView}
        repoInfo={repoInfo}
        status={status}
        onOpenRepo={vi.fn()}
        onOpenSettings={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Buscar/i), {
      target: { value: 'src/App.tsx' },
    });
    fireEvent.click(screen.getByText('src/App.tsx'));

    const store = useRepoStore.getState();
    expect(store.selectedFilePath).toBe('src/App.tsx');
    expect(store.selectedFileStaged).toBe(true);
    expect(setView).toHaveBeenCalledWith('files');
  });

  it('seleciona commit e navega para historico', () => {
    const setView = vi.fn();

    render(
      <CommandPalette
        open={true}
        onOpenChange={vi.fn()}
        view="files"
        setView={setView}
        repoInfo={repoInfo}
        status={status}
        onOpenRepo={vi.fn()}
        onOpenSettings={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Buscar/i), {
      target: { value: 'feat: add palette' },
    });
    fireEvent.click(screen.getByText(/1111111 feat: add palette/i));

    expect(useRepoStore.getState().selectedCommitHash).toBe('1111111111111111');
    expect(setView).toHaveBeenCalledWith('history');
  });

  it('seleciona issue e navega para issues', () => {
    const setView = vi.fn();

    render(
      <CommandPalette
        open={true}
        onOpenChange={vi.fn()}
        view="files"
        setView={setView}
        repoInfo={repoInfo}
        status={status}
        onOpenRepo={vi.fn()}
        onOpenSettings={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Buscar/i), {
      target: { value: 'command palette' },
    });
    fireEvent.click(screen.getByText(/#17 Create command palette/i));

    expect(useRepoStore.getState().selectedIssueNumber).toBe(17);
    expect(setView).toHaveBeenCalledWith('issues');
  });
});
