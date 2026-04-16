import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IssuesManager from '@/components/features/IssuesManager';
import { useRepoStore } from '@/stores/repoStore';
import type { Issue, IssueLabel, IssueMilestone, Collaborator, GitHubProject } from '@/types';

// ─── Mock data ────────────────────────────

const labelBug: IssueLabel = { name: 'bug', color: 'd73a4a', description: 'Something is broken' };
const labelFeature: IssueLabel = { name: 'enhancement', color: '0075ca', description: null };
const labelDocs: IssueLabel = { name: 'documentation', color: '0e8a16', description: null };

const makeIssue = (overrides: Partial<Issue> = {}): Issue => ({
  number: 1,
  title: 'Issue de teste',
  body: 'Descrição da issue',
  state: 'OPEN',
  author: 'pablo',
  labels: [],
  assignees: [],
  milestone_number: null,
  milestone_title: null,
  url: 'https://github.com/org/repo/issues/1',
  created_at: new Date(Date.now() - 86400000).toISOString(),
  updated_at: new Date(Date.now() - 3600000).toISOString(),
  comments_count: 0,
  locked: false,
  active_lock_reason: null,
  ...overrides,
});

const issue1 = makeIssue({ number: 1, title: 'Bug no login', labels: [labelBug], assignees: ['pablo'], comments_count: 2 });
const issue2 = makeIssue({ number: 2, title: 'Melhorar performance', labels: [labelFeature], state: 'OPEN' });
const issue3 = makeIssue({ number: 3, title: 'Atualizar documentação', labels: [labelDocs], state: 'CLOSED' });

const milestones: IssueMilestone[] = [
  { number: 1, title: 'v1.0', description: null, state: 'open', open_issues: 3, closed_issues: 2, due_on: null },
  { number: 2, title: 'v2.0', description: null, state: 'open', open_issues: 0, closed_issues: 0, due_on: '2026-06-01T00:00:00Z' },
];

const collaborators: Collaborator[] = [
  { login: 'pablo', avatar_url: 'https://github.com/pablo.png' },
  { login: 'maria', avatar_url: 'https://github.com/maria.png' },
];

const projects: GitHubProject[] = [
  { number: 1, title: 'Backlog', url: 'https://github.com/orgs/org/projects/1', closed: false },
  { number: 2, title: 'Roadmap', url: 'https://github.com/orgs/org/projects/2', closed: false },
];

// ─── Mock factory helpers ─────────────────

const mockMutate = vi.fn();
const makeMutation = (opts: { isPending?: boolean } = {}) => ({
  mutate: mockMutate,
  isPending: opts.isPending ?? false,
});

// ─── Mocks ───────────────────────────────

vi.mock('@/components/ui/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

const mockUseIssues = vi.fn();
const mockUseIssue = vi.fn();
const mockUseIssueComments = vi.fn();
const mockUseLabels = vi.fn();
const mockUseMilestones = vi.fn();
const mockUseCollaborators = vi.fn();
const mockUseGitHubProjects = vi.fn();
const mockUseGitHubCliStatus = vi.fn();
const mockUseRepoInfo = vi.fn();
const mockUseCreateIssue = vi.fn();
const mockUseEditIssue = vi.fn();
const mockUseCloseIssue = vi.fn();
const mockUseReopenIssue = vi.fn();
const mockUseAddIssueComment = vi.fn();
const mockUseCreateLabel = vi.fn();
const mockNoOp = vi.fn();

vi.mock('@/hooks/useGit', () => ({
  useIssues: (...args: unknown[]) => mockUseIssues(...args),
  useIssue: (...args: unknown[]) => mockUseIssue(...args),
  useIssueComments: (...args: unknown[]) => mockUseIssueComments(...args),
  useLabels: () => mockUseLabels(),
  useMilestones: () => mockUseMilestones(),
  useCollaborators: () => mockUseCollaborators(),
  useGitHubProjects: () => mockUseGitHubProjects(),
  useGitHubCliStatus: () => mockUseGitHubCliStatus(),
  useRepoInfo: () => mockUseRepoInfo(),
  useCreateIssue: () => mockUseCreateIssue(),
  useEditIssue: () => mockUseEditIssue(),
  useCloseIssue: () => mockUseCloseIssue(),
  useReopenIssue: () => mockUseReopenIssue(),
  useAddIssueComment: () => mockUseAddIssueComment(),
  useCreateLabel: () => mockUseCreateLabel(),
  useEditLabel: () => mockNoOp(),
  useDeleteLabel: () => mockNoOp(),
  useCreateMilestone: () => mockNoOp(),
  useEditMilestone: () => mockNoOp(),
  useDeleteMilestone: () => mockNoOp(),
  useEditIssueComment: () => mockNoOp(),
  useDeleteIssueComment: () => mockNoOp(),
  useLockIssue: () => mockNoOp(),
  useUnlockIssue: () => mockNoOp(),
  useIssueTimeline: () => ({ data: [], isLoading: false }),
  useIssueReactions: () => ({ data: [], isLoading: false }),
  useAddIssueReaction: () => mockNoOp(),
  useCommentReactions: () => ({ data: [], isLoading: false }),
  useAddCommentReaction: () => mockNoOp(),
  useIssueTemplates: () => ({ data: [], isLoading: false }),
}));

// ─── Setup ────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  useRepoStore.getState().clearSelections();

  mockUseGitHubCliStatus.mockReturnValue({ data: true });
  mockUseRepoInfo.mockReturnValue({ data: { is_repo: true } });
  mockNoOp.mockReturnValue(makeMutation());
  mockUseIssues.mockReturnValue({ data: [issue1, issue2], isLoading: false, refetch: vi.fn() });
  mockUseIssue.mockReturnValue({ data: null, isLoading: false, refetch: vi.fn() });
  mockUseIssueComments.mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() });
  mockUseLabels.mockReturnValue({ data: [labelBug, labelFeature, labelDocs], refetch: vi.fn() });
  mockUseMilestones.mockReturnValue({ data: milestones });
  mockUseCollaborators.mockReturnValue({ data: collaborators });
  mockUseGitHubProjects.mockReturnValue({ data: projects });
  mockUseCreateIssue.mockReturnValue(makeMutation());
  mockUseEditIssue.mockReturnValue(makeMutation());
  mockUseCloseIssue.mockReturnValue(makeMutation());
  mockUseReopenIssue.mockReturnValue(makeMutation());
  mockUseAddIssueComment.mockReturnValue(makeMutation());
  mockUseCreateLabel.mockReturnValue(makeMutation());
});

// ─── Testes ───────────────────────────────

describe('IssuesManager', () => {

  // ── Renderização básica ────────────────

  describe('renderização inicial', () => {
    it('exibe o título "Issues"', () => {
      render(<IssuesManager />);
      expect(screen.getByText('Issues')).toBeInTheDocument();
    });

    it('exibe o campo de busca', () => {
      render(<IssuesManager />);
      expect(screen.getByPlaceholderText('Buscar issue...')).toBeInTheDocument();
    });

    it('exibe botão "Nova Issue"', () => {
      render(<IssuesManager />);
      expect(screen.getByText('Nova Issue')).toBeInTheDocument();
    });

    it('exibe abas Abertas, Fechadas, Todas', () => {
      render(<IssuesManager />);
      expect(screen.getByText('Abertas')).toBeInTheDocument();
      expect(screen.getByText('Fechadas')).toBeInTheDocument();
      expect(screen.getByText('Todas')).toBeInTheDocument();
    });

    it('exibe as issues carregadas', () => {
      render(<IssuesManager />);
      expect(screen.getByText('Bug no login')).toBeInTheDocument();
      expect(screen.getByText('Melhorar performance')).toBeInTheDocument();
    });

    it('exibe label colorida na issue', () => {
      render(<IssuesManager />);
      expect(screen.getByText('bug')).toBeInTheDocument();
      expect(screen.getByText('enhancement')).toBeInTheDocument();
    });

    it('exibe contagem de comentários', () => {
      render(<IssuesManager />);
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('exibe mensagem de seleção quando nenhuma issue está selecionada', () => {
      render(<IssuesManager />);
      expect(screen.getByText('Selecione uma issue para ver os detalhes')).toBeInTheDocument();
    });
  });

  // ── Estado de carregamento ─────────────

  describe('estados de carregamento', () => {
    it('exibe spinner enquanto carrega issues', () => {
      mockUseIssues.mockReturnValue({ data: undefined, isLoading: true, refetch: vi.fn() });
      render(<IssuesManager />);
      expect(screen.getByText('Carregando issues...')).toBeInTheDocument();
    });

    it('exibe mensagem quando não há issues', () => {
      mockUseIssues.mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() });
      render(<IssuesManager />);
      expect(screen.getByText('Nenhuma issue encontrada')).toBeInTheDocument();
    });
  });

  // ── GH CLI ausente ─────────────────────

  describe('GitHub CLI não encontrado', () => {
    it('exibe tela de erro quando CLI não está instalado', () => {
      mockUseGitHubCliStatus.mockReturnValue({ data: false });
      render(<IssuesManager />);
      expect(screen.getByText('GitHub CLI não encontrado')).toBeInTheDocument();
      expect(screen.getByText(/cli.github.com/)).toBeInTheDocument();
    });

    it('não exibe lista de issues quando CLI não encontrado', () => {
      mockUseGitHubCliStatus.mockReturnValue({ data: false });
      render(<IssuesManager />);
      expect(screen.queryByText('Bug no login')).not.toBeInTheDocument();
    });
  });

  // ── Busca ─────────────────────────────

  describe('busca de issues', () => {
    it('filtra issues pelo título', () => {
      render(<IssuesManager />);
      fireEvent.change(screen.getByPlaceholderText('Buscar issue...'), { target: { value: 'bug' } });
      expect(screen.getByText('Bug no login')).toBeInTheDocument();
      expect(screen.queryByText('Melhorar performance')).not.toBeInTheDocument();
    });

    it('busca é case-insensitive', () => {
      render(<IssuesManager />);
      fireEvent.change(screen.getByPlaceholderText('Buscar issue...'), { target: { value: 'BUG' } });
      expect(screen.getByText('Bug no login')).toBeInTheDocument();
    });

    it('filtra por número da issue', () => {
      render(<IssuesManager />);
      fireEvent.change(screen.getByPlaceholderText('Buscar issue...'), { target: { value: '2' } });
      expect(screen.getByText('Melhorar performance')).toBeInTheDocument();
      expect(screen.queryByText('Bug no login')).not.toBeInTheDocument();
    });

    it('busca vazia exibe todas as issues', () => {
      render(<IssuesManager />);
      const input = screen.getByPlaceholderText('Buscar issue...');
      fireEvent.change(input, { target: { value: 'bug' } });
      fireEvent.change(input, { target: { value: '' } });
      expect(screen.getByText('Bug no login')).toBeInTheDocument();
      expect(screen.getByText('Melhorar performance')).toBeInTheDocument();
    });

    it('busca sem resultado exibe mensagem', () => {
      render(<IssuesManager />);
      fireEvent.change(screen.getByPlaceholderText('Buscar issue...'), { target: { value: 'xyzxyz' } });
      expect(screen.getByText('Nenhuma issue encontrada')).toBeInTheDocument();
    });
  });

  // ── Filtro por estado ──────────────────

  describe('filtro por estado', () => {
    it('aba "Abertas" é ativa por padrão', () => {
      render(<IssuesManager />);
      expect(mockUseIssues).toHaveBeenCalledWith('open', undefined, undefined, undefined);
    });

    it('clicar em "Fechadas" passa state=closed', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Fechadas'));
      expect(mockUseIssues).toHaveBeenCalledWith('closed', undefined, undefined, undefined);
    });

    it('clicar em "Todas" passa state=undefined', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Todas'));
      expect(mockUseIssues).toHaveBeenCalledWith(undefined, undefined, undefined, undefined);
    });
  });

  // ── Seleção de issue ──────────────────

  describe('seleção de issue', () => {
    it('clicar na issue exibe seu detalhe', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getAllByText('pablo').length).toBeGreaterThanOrEqual(1);
    });

    it('detalhe exibe estado da issue', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      expect(screen.getByText('Aberta')).toBeInTheDocument();
    });

    it('detalhe exibe link para o GitHub', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      expect(screen.getByText('GitHub')).toBeInTheDocument();
    });

    it('detalhe exibe corpo da issue', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      expect(screen.getByText('Descrição da issue')).toBeInTheDocument();
    });

    it('issue sem descrição exibe texto de placeholder', () => {
      mockUseIssues.mockReturnValue({
        data: [makeIssue({ body: null })],
        isLoading: false,
        refetch: vi.fn(),
      });
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Issue de teste'));
      expect(screen.getByText(/Sem descrição/)).toBeInTheDocument();
    });

    it('botão "Fechar" aparece para issue aberta', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      expect(screen.getByText('Fechar')).toBeInTheDocument();
    });

    it('botão "Reabrir" aparece para issue fechada', () => {
      mockUseIssues.mockReturnValue({
        data: [makeIssue({ state: 'CLOSED' })],
        isLoading: false,
        refetch: vi.fn(),
      });
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Issue de teste'));
      expect(screen.getByText('Reabrir')).toBeInTheDocument();
    });
  });

  // ── Fechar/Reabrir issue ───────────────

  describe('fechar e reabrir issue', () => {
    it('clicar em "Fechar" chama closeIssue.mutate', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      fireEvent.click(screen.getByText('Fechar'));
      expect(mockMutate).toHaveBeenCalledWith(1, expect.any(Object));
    });

    it('clicar em "Reabrir" chama reopenIssue.mutate', () => {
      const reopenMutate = vi.fn();
      mockUseReopenIssue.mockReturnValue({ mutate: reopenMutate, isPending: false });
      mockUseIssues.mockReturnValue({
        data: [makeIssue({ state: 'CLOSED' })],
        isLoading: false,
        refetch: vi.fn(),
      });
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Issue de teste'));
      fireEvent.click(screen.getByText('Reabrir'));
      expect(reopenMutate).toHaveBeenCalledWith(1, expect.any(Object));
    });

    it('spinner aparece enquanto fechando issue', () => {
      mockUseCloseIssue.mockReturnValue({ mutate: mockMutate, isPending: true });
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      // botão deve estar desabilitado
      const btn = screen.getByText('Fechar').closest('button');
      expect(btn).toBeDisabled();
    });
  });

  // ── Edição de título ──────────────────

  describe('edição de título', () => {
    it('clicar no título abre o campo de edição', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      // clicar no título no painel de detalhe
      const title = screen.getAllByText('Bug no login').find(
        el => el.tagName === 'H2'
      );
      expect(title).toBeDefined();
      fireEvent.click(title!);
      expect(screen.getByDisplayValue('Bug no login')).toBeInTheDocument();
    });

    it('pressionar Enter salva o título', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      const h2 = screen.getAllByText('Bug no login').find(el => el.tagName === 'H2')!;
      fireEvent.click(h2);
      const input = screen.getByDisplayValue('Bug no login');
      fireEvent.change(input, { target: { value: 'Novo título' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ number: 1, title: 'Novo título' }),
        expect.any(Object)
      );
    });

    it('pressionar Escape cancela a edição do título', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      const h2 = screen.getAllByText('Bug no login').find(el => el.tagName === 'H2')!;
      fireEvent.click(h2);
      const input = screen.getByDisplayValue('Bug no login');
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByDisplayValue('Bug no login')).not.toBeInTheDocument();
    });
  });

  // ── Edição do corpo ───────────────────

  describe('edição do corpo', () => {
    it('botão "Editar" aparece no cabeçalho do corpo', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      expect(screen.getAllByText('Editar').length).toBeGreaterThan(0);
    });

    it('clicar em "Editar" abre textarea com conteúdo atual', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      fireEvent.click(screen.getAllByText('Editar')[0]);
      expect(screen.getByDisplayValue('Descrição da issue')).toBeInTheDocument();
    });

    it('"Cancelar" fecha a edição do corpo', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      fireEvent.click(screen.getAllByText('Editar')[0]);
      fireEvent.click(screen.getByText('Cancelar'));
      expect(screen.queryByDisplayValue('Descrição da issue')).not.toBeInTheDocument();
    });

    it('"Salvar" chama editIssue com o novo body', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      fireEvent.click(screen.getAllByText('Editar')[0]);
      const textarea = screen.getByDisplayValue('Descrição da issue');
      fireEvent.change(textarea, { target: { value: 'Corpo atualizado' } });
      fireEvent.click(screen.getByText('Salvar'));
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ number: 1, body: 'Corpo atualizado' }),
        expect.any(Object)
      );
    });
  });

  // ── Comentários ───────────────────────

  describe('comentários', () => {
    it('exibe comentários da issue', () => {
      mockUseIssueComments.mockReturnValue({
        data: [
          { id: 1, author: 'maria', body: 'Ótima issue!', created_at: new Date().toISOString() },
        ],
        isLoading: false,
        refetch: vi.fn(),
      });
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      expect(screen.getByText('Ótima issue!')).toBeInTheDocument();
      expect(screen.getByText('maria')).toBeInTheDocument();
    });

    it('spinner aparece enquanto carrega comentários', () => {
      mockUseIssueComments.mockReturnValue({ data: undefined, isLoading: true, refetch: vi.fn() });
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      expect(screen.getByText('Carregando comentários...')).toBeInTheDocument();
    });

    it('campo de novo comentário está presente', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      expect(screen.getByPlaceholderText('Escreva um comentário...')).toBeInTheDocument();
    });

    it('clicar em "Comentar" chama addComment.mutate', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      const textarea = screen.getByPlaceholderText('Escreva um comentário...');
      fireEvent.change(textarea, { target: { value: 'Meu comentário' } });
      fireEvent.click(screen.getByText('Comentar'));
      expect(mockMutate).toHaveBeenCalledWith(
        { number: 1, body: 'Meu comentário' },
        expect.any(Object)
      );
    });

    it('botão "Comentar" fica desabilitado quando textarea vazio', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      const btn = screen.getByText('Comentar').closest('button');
      expect(btn).toBeDisabled();
    });

    it('Ctrl+Enter também envia o comentário', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      const textarea = screen.getByPlaceholderText('Escreva um comentário...');
      fireEvent.change(textarea, { target: { value: 'Via atalho' } });
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
      expect(mockMutate).toHaveBeenCalledWith(
        { number: 1, body: 'Via atalho' },
        expect.any(Object)
      );
    });
  });

  // ── Sidebar editável ──────────────────

  describe('sidebar de detalhes - labels', () => {
    it('exibe seção "Labels" na sidebar', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      expect(screen.getByText('Labels')).toBeInTheDocument();
    });

    it('exibe as labels atuais da issue na sidebar', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      // "bug" aparece tanto na lista quanto na sidebar
      const bugsOccurrences = screen.getAllByText('bug');
      expect(bugsOccurrences.length).toBeGreaterThanOrEqual(1);
    });

    it('exibe "Nenhuma" quando issue não tem labels', () => {
      mockUseIssues.mockReturnValue({
        data: [makeIssue({ labels: [] })],
        isLoading: false,
        refetch: vi.fn(),
      });
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Issue de teste'));
      // Múltiplos "Nenhuma" podem aparecer (labels, assignees)
      expect(screen.getAllByText('Nenhuma').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('sidebar de detalhes - assignees', () => {
    it('exibe seção "Assignees" na sidebar', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      expect(screen.getByText('Assignees')).toBeInTheDocument();
    });

    it('exibe os assignees da issue', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      // "pablo" aparece como autor e como assignee
      expect(screen.getAllByText('pablo').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('sidebar de detalhes - milestone', () => {
    it('exibe seção "Milestone" na sidebar', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      // "Milestone" aparece no filtro e na sidebar; getAllByText garante pelo menos 1
      expect(screen.getAllByText('Milestone').length).toBeGreaterThanOrEqual(1);
    });

    it('exibe título do milestone quando definido', () => {
      mockUseIssues.mockReturnValue({
        data: [makeIssue({ milestone_number: 1, milestone_title: 'v1.0' })],
        isLoading: false,
        refetch: vi.fn(),
      });
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Issue de teste'));
      expect(screen.getAllByText('v1.0').length).toBeGreaterThanOrEqual(1);
    });

    it('exibe "Nenhuma" quando sem milestone', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Bug no login'));
      expect(screen.getAllByText('Nenhuma').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Criar issue ───────────────────────

  describe('criar issue', () => {
    it('clicar em "Nova Issue" abre o dialog', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Nova Issue'));
      expect(screen.getByText('Nova Issue', { selector: '[role="dialog"] *' }) ||
        screen.getByPlaceholderText('Título da issue...')).toBeInTheDocument();
    });

    it('dialog tem campo de título', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Nova Issue'));
      expect(screen.getByPlaceholderText('Título da issue...')).toBeInTheDocument();
    });

    it('dialog tem textarea para descrição', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Nova Issue'));
      expect(screen.getByPlaceholderText(/Descreva a issue/)).toBeInTheDocument();
    });

    it('botão "Criar Issue" fica desabilitado sem título', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Nova Issue'));
      const btn = screen.getByRole('button', { name: 'Criar Issue' });
      expect(btn).toBeDisabled();
    });

    it('preencher título habilita o botão criar', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Nova Issue'));
      fireEvent.change(screen.getByPlaceholderText('Título da issue...'), {
        target: { value: 'Novo bug' },
      });
      expect(screen.getByRole('button', { name: 'Criar Issue' })).not.toBeDisabled();
    });

    it('criar issue chama createIssue.mutate com título', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Nova Issue'));
      fireEvent.change(screen.getByPlaceholderText('Título da issue...'), {
        target: { value: 'Novo bug' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Criar Issue' }));
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Novo bug' }),
        expect.any(Object)
      );
    });

    it('criar issue passa labels selecionadas', () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Nova Issue'));
      fireEvent.change(screen.getByPlaceholderText('Título da issue...'), {
        target: { value: 'Com label' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Criar Issue' }));
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ labels: expect.any(Array) }),
        expect.any(Object)
      );
    });

    it('spinner aparece ao criar issue', () => {
      mockUseCreateIssue.mockReturnValue({ mutate: mockMutate, isPending: true });
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Nova Issue'));
      fireEvent.change(screen.getByPlaceholderText('Título da issue...'), {
        target: { value: 'Loading...' },
      });
      const btn = screen.getByRole('button', { name: /Criar Issue/i });
      expect(btn).toBeDisabled();
    });
  });

  // ── Filtros avançados ─────────────────

  describe('filtros avançados', () => {
    it('exibe botão de filtro "Label"', () => {
      render(<IssuesManager />);
      expect(screen.getByText('Label')).toBeInTheDocument();
    });

    it('exibe botão de filtro "Assignee"', () => {
      render(<IssuesManager />);
      expect(screen.getByText('Assignee')).toBeInTheDocument();
    });

    it('exibe botão de filtro "Milestone"', () => {
      render(<IssuesManager />);
      expect(screen.getByText('Milestone')).toBeInTheDocument();
    });

    it('selecionar filtro de label passa para useIssues', async () => {
      render(<IssuesManager />);
      // Abre dropdown de Label
      fireEvent.click(screen.getByText('Label'));
      // Clica no label "bug" no dropdown
      const bugOptions = await screen.findAllByText('bug');
      fireEvent.click(bugOptions[bugOptions.length - 1]);
      await waitFor(() => {
        expect(mockUseIssues).toHaveBeenCalledWith('open', 'bug', undefined, undefined);
      });
    });

    it('selecionar filtro de assignee passa para useIssues', async () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Assignee'));
      const pabloOptions = await screen.findAllByText('pablo');
      fireEvent.click(pabloOptions[pabloOptions.length - 1]);
      await waitFor(() => {
        expect(mockUseIssues).toHaveBeenCalledWith('open', undefined, 'pablo', undefined);
      });
    });

    it('botão "Limpar" aparece quando filtro está ativo', async () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Label'));
      const bugOptions = await screen.findAllByText('bug');
      fireEvent.click(bugOptions[bugOptions.length - 1]);
      await waitFor(() => {
        expect(screen.getByText('Limpar')).toBeInTheDocument();
      });
    });

    it('clicar em "Limpar" remove todos os filtros', async () => {
      render(<IssuesManager />);
      fireEvent.click(screen.getByText('Label'));
      const bugOptions = await screen.findAllByText('bug');
      fireEvent.click(bugOptions[bugOptions.length - 1]);
      await waitFor(() => screen.getByText('Limpar'));
      fireEvent.click(screen.getByText('Limpar'));
      await waitFor(() => {
        expect(mockUseIssues).toHaveBeenCalledWith('open', undefined, undefined, undefined);
      });
    });
  });

  // ── Milestone na lista ────────────────

  describe('milestone na lista de issues', () => {
    it('exibe nome do milestone na linha da issue', () => {
      mockUseIssues.mockReturnValue({
        data: [makeIssue({ milestone_number: 1, milestone_title: 'v1.0' })],
        isLoading: false,
        refetch: vi.fn(),
      });
      render(<IssuesManager />);
      // O texto é "· v1.0" dentro de um span, então buscamos por regex
      expect(screen.getByText(/v1\.0/)).toBeInTheDocument();
    });
  });
});
