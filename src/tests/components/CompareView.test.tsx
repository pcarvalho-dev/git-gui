import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CompareView from '@/components/features/CompareView';
import { useRepoStore } from '@/stores/repoStore';
import type { BranchInfo, CommitInfo, CompareResult, RepoStatus } from '@/types';

const now = Math.floor(Date.now() / 1000);

const mockBranches: BranchInfo[] = [
  {
    name: 'main',
    is_current: true,
    is_remote: false,
    is_head: true,
    commit_hash: 'aaa1111',
    commit_message: 'base branch',
    upstream: 'refs/remotes/origin/main',
    ahead: 0,
    behind: 0,
    author_name: 'Pablo',
    author_email: 'pablo@test.com',
    commit_date: now,
  },
  {
    name: 'feature/login',
    is_current: false,
    is_remote: false,
    is_head: false,
    commit_hash: 'bbb2222',
    commit_message: 'feat: login',
    upstream: null,
    ahead: null,
    behind: null,
    author_name: 'Pablo',
    author_email: 'pablo@test.com',
    commit_date: now,
  },
];

const mockCommits: CommitInfo[] = [
  {
    hash: 'bbbbbbbbbbbbbbbb',
    short_hash: 'bbbbbbb',
    message: 'feat: login',
    summary: 'feat: login',
    body: null,
    author_name: 'Pablo',
    author_email: 'pablo@test.com',
    author_date: now,
    committer_name: 'Pablo',
    committer_email: 'pablo@test.com',
    committer_date: now,
    parents: ['aaaaaaaaaaaaaaaa'],
    is_merge: false,
  },
  {
    hash: 'aaaaaaaaaaaaaaaa',
    short_hash: 'aaaaaaa',
    message: 'chore: base',
    summary: 'chore: base',
    body: null,
    author_name: 'Pablo',
    author_email: 'pablo@test.com',
    author_date: now - 3600,
    committer_name: 'Pablo',
    committer_email: 'pablo@test.com',
    committer_date: now - 3600,
    parents: [],
    is_merge: false,
  },
];

const mockStatus: RepoStatus = {
  current_branch: 'main',
  head_commit: 'aaa1111',
  staged_files: [],
  unstaged_files: [],
  untracked_files: [],
  conflicted_files: [],
  ahead: 0,
  behind: 0,
  is_rebasing: false,
  is_merging: false,
  is_cherry_picking: false,
};

const mockCompareResult: CompareResult = {
  base_ref: 'main',
  head_ref: 'feature/login',
  base_hash: 'aaaaaaaaaaaaaaaa',
  head_hash: 'bbbbbbbbbbbbbbbb',
  merge_base_hash: 'aaaaaaaaaaaaaaaa',
  diff_base_hash: 'aaaaaaaaaaaaaaaa',
  uses_merge_base: true,
  ahead: 1,
  behind: 0,
  base_only_commits: [],
  head_only_commits: [mockCommits[0]],
  diff: [
    {
      path: 'src/app.tsx',
      old_path: null,
      status: 'modified',
      additions: 1,
      deletions: 1,
      is_binary: false,
      hunks: [
        {
          header: '@@ -1,1 +1,1 @@',
          old_start: 1,
          old_lines: 1,
          new_start: 1,
          new_lines: 1,
          lines: [
            {
              old_line: 1,
              new_line: null,
              content: 'const a = 1;',
              origin: '-',
              line_type: 'deletion',
            },
            {
              old_line: null,
              new_line: 1,
              content: 'const a = 2;',
              origin: '+',
              line_type: 'addition',
            },
          ],
        },
      ],
    },
  ],
};

const mockUseCompareRefs = vi.fn();

vi.mock('@/hooks/useGit', () => ({
  useBranches: vi.fn(() => ({ data: mockBranches, isLoading: false })),
  useCommits: vi.fn(() => ({ data: mockCommits, isLoading: false })),
  useRepoStatus: vi.fn(() => ({ data: mockStatus, isLoading: false })),
  useCompareRefs: (...args: unknown[]) => mockUseCompareRefs(...args),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

describe('CompareView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRepoStore.getState().clearSelections();
    useRepoStore.getState().setCompareRefs('main', 'feature/login');
    mockUseCompareRefs.mockReturnValue({
      data: mockCompareResult,
      isLoading: false,
      error: null,
    });
  });

  it('renderiza resumo e arquivos do compare atual', () => {
    render(<CompareView setView={vi.fn()} />);

    expect(screen.getByDisplayValue('main')).toBeInTheDocument();
    expect(screen.getByDisplayValue('feature/login')).toBeInTheDocument();
    expect(screen.getByText('Apenas em feature/login')).toBeInTheDocument();
    expect(screen.getByText('Diff calculado a partir do merge-base')).toBeInTheDocument();
    expect(screen.getByText('src/app.tsx')).toBeInTheDocument();
  });

  it('troca as refs quando o usuario inverte os lados', () => {
    render(<CompareView setView={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Trocar lados/i }));

    expect(screen.getByDisplayValue('feature/login')).toBeInTheDocument();
    expect(screen.getByDisplayValue('main')).toBeInTheDocument();
    expect(useRepoStore.getState().compareBaseRef).toBe('feature/login');
    expect(useRepoStore.getState().compareHeadRef).toBe('main');
  });
});
