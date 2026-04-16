import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BranchManager from '@/components/features/BranchManager';
import type { BranchInfo } from '@/types';

// Mock completo dos hooks do git
const mockBranches: BranchInfo[] = [
  {
    name: 'main',
    is_current: true,
    is_remote: false,
    is_head: true,
    commit_hash: 'abc1234',
    commit_message: 'feat: initial commit',
    upstream: 'origin/main',
    ahead: 0,
    behind: 0,
    author_name: 'Pablo',
    author_email: 'pablo@test.com',
    commit_date: Math.floor(Date.now() / 1000) - 86400,
  },
  {
    name: 'feature-login',
    is_current: false,
    is_remote: false,
    is_head: false,
    commit_hash: 'def5678',
    commit_message: 'feat: add login',
    upstream: null,
    ahead: null,
    behind: null,
    author_name: 'Pablo',
    author_email: 'pablo@test.com',
    commit_date: Math.floor(Date.now() / 1000) - 86400,
  },
  {
    name: 'origin/feature-login',
    is_current: false,
    is_remote: true,
    is_head: false,
    commit_hash: 'def5678',
    commit_message: 'feat: add login',
    upstream: null,
    ahead: null,
    behind: null,
    author_name: 'Pablo',
    author_email: 'pablo@test.com',
    commit_date: Math.floor(Date.now() / 1000) - 86400,
  },
  {
    name: 'fix-bug-123',
    is_current: false,
    is_remote: false,
    is_head: false,
    commit_hash: 'aaa0000',
    commit_message: 'fix: corrigir bug',
    upstream: null,
    ahead: null,
    behind: null,
    author_name: 'Outro Dev',
    author_email: 'outro@test.com',
    commit_date: Math.floor(Date.now() / 1000) - 86400,
  },
];

const mockOpenRepos = [
  { id: 'repo-1', path: '/repos/back', name: 'back', is_active: true },
];

vi.mock('@/hooks/useGit', () => ({
  useBranches: vi.fn(() => ({ data: mockBranches, isLoading: false })),
  useGitConfig: vi.fn(() => ({ data: 'pablo@test.com' })),
  useOpenRepos: vi.fn(() => ({ data: mockOpenRepos })),
  useCreateBranch: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useCheckoutBranch: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteBranch: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useMergeBranch: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

describe('BranchManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza o título "Branches"', () => {
    render(<BranchManager onOpenCompare={vi.fn()} />);
    expect(screen.getByText('Branches')).toBeInTheDocument();
  });

  it('exibe o campo de busca', () => {
    render(<BranchManager onOpenCompare={vi.fn()} />);
    expect(screen.getByPlaceholderText('Buscar branch...')).toBeInTheDocument();
  });

  it('exibe botão "Nova Branch"', () => {
    render(<BranchManager onOpenCompare={vi.fn()} />);
    expect(screen.getByText('Nova Branch')).toBeInTheDocument();
  });

  it('exibe todas as branches por padrão', () => {
    render(<BranchManager onOpenCompare={vi.fn()} />);
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('feature-login')).toBeInTheDocument();
    expect(screen.getByText('fix-bug-123')).toBeInTheDocument();
  });

  it('filtra branches pelo campo de busca', () => {
    render(<BranchManager onOpenCompare={vi.fn()} />);
    const input = screen.getByPlaceholderText('Buscar branch...');
    fireEvent.change(input, { target: { value: 'feature' } });
    expect(screen.getByText('feature-login')).toBeInTheDocument();
    expect(screen.queryByText('fix-bug-123')).not.toBeInTheDocument();
    expect(screen.queryByText('main')).not.toBeInTheDocument();
  });

  it('busca é case-insensitive', () => {
    render(<BranchManager onOpenCompare={vi.fn()} />);
    const input = screen.getByPlaceholderText('Buscar branch...');
    fireEvent.change(input, { target: { value: 'FEATURE' } });
    expect(screen.getByText('feature-login')).toBeInTheDocument();
  });

  it('busca vazia exibe todas as branches', () => {
    render(<BranchManager onOpenCompare={vi.fn()} />);
    const input = screen.getByPlaceholderText('Buscar branch...');
    fireEvent.change(input, { target: { value: 'fix' } });
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('feature-login')).toBeInTheDocument();
    expect(screen.getByText('fix-bug-123')).toBeInTheDocument();
  });

  it('filtra por tipo "Locais" - exibe apenas branches locais', () => {
    render(<BranchManager onOpenCompare={vi.fn()} />);
    fireEvent.click(screen.getByText('Locais'));
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('feature-login')).toBeInTheDocument();
    expect(screen.queryByText('origin/feature-login')).not.toBeInTheDocument();
  });

  it('filtra por tipo "Remotas" - exibe apenas branches remotas', () => {
    render(<BranchManager onOpenCompare={vi.fn()} />);
    fireEvent.click(screen.getByText('Remotas'));
    expect(screen.queryByText('main')).not.toBeInTheDocument();
    expect(screen.getByText('origin/feature-login')).toBeInTheDocument();
  });

  it('exibe seção LOCAL com branches locais', () => {
    render(<BranchManager onOpenCompare={vi.fn()} />);
    expect(screen.getByText(/LOCAL/i)).toBeInTheDocument();
  });

  it('exibe seção REMOTA com branches remotas', () => {
    render(<BranchManager onOpenCompare={vi.fn()} />);
    expect(screen.getByText(/REMOTA/i)).toBeInTheDocument();
  });

  it('busca sem resultados não quebra a interface', () => {
    render(<BranchManager />);
    const input = screen.getByPlaceholderText('Buscar branch...');
    fireEvent.change(input, { target: { value: 'xyzxyzxyz' } });
    // Não deve haver erro, só não mostra nenhuma branch
    expect(screen.queryByText('main')).not.toBeInTheDocument();
    expect(screen.queryByText('feature-login')).not.toBeInTheDocument();
  });
});
