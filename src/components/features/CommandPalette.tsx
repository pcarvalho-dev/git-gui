import { useEffect, useMemo, useState } from 'react';
import {
  CircleDot,
  Code,
  FileText,
  FolderOpen,
  GitBranch,
  GitCommit,
  Loader2,
  Moon,
  RefreshCw,
  Settings,
  Sun,
  Terminal,
} from 'lucide-react';
import type { RepoInfo, RepoStatus } from '@/types';
import {
  useBranches,
  useCheckoutBranch,
  useCommits,
  useIssues,
} from '@/hooks/useGit';
import { APP_VIEWS, type AppView } from '@/lib/navigation';
import { getErrorMessage } from '@/lib/error';
import { git } from '@/services/git';
import { useThemeStore } from '@/stores/themeStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useRepoStore } from '@/stores/repoStore';
import { useToast } from '@/components/ui/use-toast';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: AppView;
  setView: (view: AppView) => void;
  repoInfo?: RepoInfo;
  status?: RepoStatus;
  onOpenRepo: () => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
}

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  searchText: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  onSelect: () => void;
}

function PaletteRow({
  icon: Icon,
  label,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
}) {
  return (
    <>
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{label}</div>
        {description && (
          <div className="truncate text-xs text-muted-foreground">{description}</div>
        )}
      </div>
    </>
  );
}

export default function CommandPalette({
  open,
  onOpenChange,
  view,
  setView,
  repoInfo,
  status,
  onOpenRepo,
  onOpenSettings,
  onRefresh,
}: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const { theme, toggleTheme } = useThemeStore();
  const { isOpen: terminalOpen, toggleTerminal } = useTerminalStore();
  const { terminalEmulator } = useSettingsStore();
  const { toast } = useToast();
  const repoOpen = repoInfo?.is_repo === true;
  const checkoutBranch = useCheckoutBranch();
  const { data: branches = [], isLoading: branchesLoading } = useBranches(repoOpen);
  const { data: commits = [], isLoading: commitsLoading } = useCommits(undefined, 100, repoOpen);
  const { data: issues = [], isLoading: issuesLoading } = useIssues(
    undefined,
    undefined,
    undefined,
    undefined,
    repoOpen
  );
  const setSelectedCommitHash = useRepoStore((state) => state.setSelectedCommitHash);
  const setSelectedFilePath = useRepoStore((state) => state.setSelectedFilePath);
  const setSelectedIssueNumber = useRepoStore((state) => state.setSelectedIssueNumber);

  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  const closeAndRun = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  const viewItems = useMemo<PaletteItem[]>(
    () =>
      APP_VIEWS.map((item) => ({
        id: `view-${item.id}`,
        label: item.label,
        description:
          item.id === view ? 'Tela atual' : `Ir para ${item.label.toLowerCase()}`,
        searchText: [item.label, ...item.keywords].join(' '),
        icon: item.icon,
        shortcut: `Ctrl+${item.shortcut}`,
        onSelect: () => closeAndRun(() => setView(item.id)),
      })),
    [view, setView]
  );

  const actionItems = useMemo<PaletteItem[]>(
    () => [
      {
        id: 'action-open-repo',
        label: 'Abrir repositorio',
        description: 'Selecionar outro repositorio local',
        searchText: 'abrir repositorio open repo folder',
        icon: FolderOpen,
        onSelect: () => closeAndRun(onOpenRepo),
      },
      {
        id: 'action-refresh',
        label: 'Atualizar dados',
        description: 'Recarregar status, branches e historico',
        searchText: 'refresh reload atualizar dados',
        icon: RefreshCw,
        shortcut: 'Ctrl+R',
        onSelect: () => closeAndRun(onRefresh),
      },
      {
        id: 'action-terminal',
        label: terminalOpen ? 'Fechar terminal' : 'Abrir terminal',
        description: terminalOpen ? 'Ocultar terminal embutido' : 'Mostrar terminal embutido',
        searchText: 'terminal shell console',
        icon: Terminal,
        shortcut: 'Ctrl+`',
        onSelect: () => closeAndRun(toggleTerminal),
      },
      {
        id: 'action-vscode',
        label: 'Abrir no VS Code',
        description: 'Abrir o repositorio atual no VS Code',
        searchText: 'vscode code editor open',
        icon: Code,
        onSelect: () =>
          closeAndRun(() => {
            git.repo.openInVscode().catch((err: unknown) => {
              toast({
                title: 'Erro',
                description: getErrorMessage(err),
                variant: 'destructive',
              });
            });
          }),
      },
      {
        id: 'action-explorer',
        label: 'Abrir pasta',
        description: 'Abrir o repositorio no explorador de arquivos',
        searchText: 'explorer folder pasta diretorio',
        icon: FolderOpen,
        onSelect: () =>
          closeAndRun(() => {
            git.repo.openInExplorer().catch((err: unknown) => {
              toast({
                title: 'Erro',
                description: getErrorMessage(err),
                variant: 'destructive',
              });
            });
          }),
      },
      {
        id: 'action-external-terminal',
        label: 'Abrir no terminal externo',
        description: 'Abrir o repositorio no terminal do sistema',
        searchText: 'terminal externo sistema abrir',
        icon: Terminal,
        onSelect: () =>
          closeAndRun(() => {
            git.repo.openInTerminal(terminalEmulator).catch((err: unknown) => {
              toast({
                title: 'Erro ao abrir terminal',
                description: getErrorMessage(err),
                variant: 'destructive',
              });
            });
          }),
      },
      {
        id: 'action-theme',
        label: theme === 'dark' ? 'Tema claro' : 'Tema escuro',
        description: 'Alternar tema da interface',
        searchText: 'theme tema dark light claro escuro',
        icon: theme === 'dark' ? Sun : Moon,
        onSelect: () => closeAndRun(toggleTheme),
      },
      {
        id: 'action-settings',
        label: 'Abrir configuracoes',
        description: 'Abrir preferencias do aplicativo',
        searchText: 'settings preferencias configuracoes',
        icon: Settings,
        onSelect: () => closeAndRun(onOpenSettings),
      },
    ],
    [onOpenRepo, onOpenSettings, onRefresh, terminalEmulator, terminalOpen, theme, toggleTerminal, toggleTheme, toast]
  );

  const branchItems = useMemo<PaletteItem[]>(
    () =>
      branches
        .filter((branch) => !branch.is_remote)
        .slice(0, 20)
        .map((branch) => ({
          id: `branch-${branch.name}`,
          label: branch.name,
          description: branch.is_current
            ? 'Branch atual'
            : branch.commit_message || 'Fazer checkout',
          searchText: `${branch.name} ${branch.commit_message || ''} branch checkout`,
          icon: GitBranch,
          onSelect: () =>
            closeAndRun(() => {
              if (branch.is_current) {
                setView('branches');
                return;
              }

              checkoutBranch.mutate(branch.name, {
                onSuccess: () => {
                  toast({
                    title: 'Branch ativada',
                    description: `Checkout para "${branch.name}"`,
                  });
                },
                onError: (err) => {
                  toast({
                    title: 'Erro ao trocar branch',
                    description: getErrorMessage(err),
                    variant: 'destructive',
                  });
                },
              });
            }),
        })),
    [branches, checkoutBranch, setView, toast]
  );

  const fileItems = useMemo<PaletteItem[]>(() => {
    if (!status) {
      return [];
    }

    const conflicted = status.conflicted_files.map((path) => ({
      id: `file-conflict-${path}`,
      label: path,
      description: 'Conflito',
      searchText: `${path} conflicted merge`,
      icon: FileText,
      onSelect: () =>
        closeAndRun(() => {
          setSelectedFilePath(path, false);
          setView('files');
        }),
    }));

    const staged = status.staged_files.map((file) => ({
      id: `file-staged-${file.path}`,
      label: file.path,
      description: `Staged · ${file.status}`,
      searchText: `${file.path} staged ${file.status}`,
      icon: FileText,
      onSelect: () =>
        closeAndRun(() => {
          setSelectedFilePath(file.path, true);
          setView('files');
        }),
    }));

    const unstaged = status.unstaged_files.map((file) => ({
      id: `file-working-${file.path}`,
      label: file.path,
      description: `Working tree · ${file.status}`,
      searchText: `${file.path} working ${file.status}`,
      icon: FileText,
      onSelect: () =>
        closeAndRun(() => {
          setSelectedFilePath(file.path, false);
          setView('files');
        }),
    }));

    const untracked = status.untracked_files.map((path) => ({
      id: `file-untracked-${path}`,
      label: path,
      description: 'Nao rastreado',
      searchText: `${path} untracked`,
      icon: FileText,
      onSelect: () =>
        closeAndRun(() => {
          setSelectedFilePath(path, false);
          setView('files');
        }),
    }));

    return [...conflicted, ...staged, ...unstaged, ...untracked].slice(0, 30);
  }, [closeAndRun, setSelectedFilePath, setView, status]);

  const commitItems = useMemo<PaletteItem[]>(
    () =>
      commits.slice(0, 20).map((commit) => ({
        id: `commit-${commit.hash}`,
        label: `${commit.short_hash} ${commit.summary}`,
        description: commit.author_name,
        searchText: `${commit.hash} ${commit.short_hash} ${commit.summary} ${commit.author_name}`,
        icon: GitCommit,
        onSelect: () =>
          closeAndRun(() => {
            setSelectedCommitHash(commit.hash);
            setView('history');
          }),
      })),
    [commits, setSelectedCommitHash, setView]
  );

  const issueItems = useMemo<PaletteItem[]>(
    () =>
      issues.slice(0, 20).map((issue) => ({
        id: `issue-${issue.number}`,
        label: `#${issue.number} ${issue.title}`,
        description: issue.state === 'OPEN' ? 'Issue aberta' : 'Issue fechada',
        searchText: `${issue.number} ${issue.title} ${issue.author} issue`,
        icon: CircleDot,
        onSelect: () =>
          closeAndRun(() => {
            setSelectedIssueNumber(issue.number);
            setView('issues');
          }),
      })),
    [issues, setSelectedIssueNumber, setView]
  );

  const loadingEntities = branchesLoading || commitsLoading || issuesLoading;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder={
          repoOpen
            ? `Buscar acoes, arquivos, branches, commits e issues em ${repoInfo?.name ?? 'repo'}...`
            : 'Buscar acoes do aplicativo...'
        }
      />
      <CommandList>
        <CommandEmpty>Nenhum comando encontrado.</CommandEmpty>

        <CommandGroup heading="Navegacao">
          {viewItems.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.searchText}`}
              onSelect={item.onSelect}
            >
              <PaletteRow
                icon={item.icon}
                label={item.label}
                description={item.description}
              />
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Acoes">
          {actionItems.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.searchText}`}
              onSelect={item.onSelect}
            >
              <PaletteRow
                icon={item.icon}
                label={item.label}
                description={item.description}
              />
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        {repoOpen && (
          <>
            <CommandSeparator />

            <CommandGroup heading="Branches">
              {branchItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.searchText}`}
                  onSelect={item.onSelect}
                >
                  <PaletteRow
                    icon={item.icon}
                    label={item.label}
                    description={item.description}
                  />
                </CommandItem>
              ))}
              {branchItems.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  {branchesLoading ? 'Carregando branches...' : 'Nenhuma branch local encontrada.'}
                </div>
              )}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Arquivos">
              {fileItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.searchText}`}
                  onSelect={item.onSelect}
                >
                  <PaletteRow
                    icon={item.icon}
                    label={item.label}
                    description={item.description}
                  />
                </CommandItem>
              ))}
              {fileItems.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Nenhum arquivo alterado no momento.
                </div>
              )}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Commits">
              {commitItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.searchText}`}
                  onSelect={item.onSelect}
                >
                  <PaletteRow
                    icon={item.icon}
                    label={item.label}
                    description={item.description}
                  />
                </CommandItem>
              ))}
              {commitItems.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  {commitsLoading ? 'Carregando commits...' : 'Nenhum commit encontrado.'}
                </div>
              )}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Issues">
              {issueItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.searchText}`}
                  onSelect={item.onSelect}
                >
                  <PaletteRow
                    icon={item.icon}
                    label={item.label}
                    description={item.description}
                  />
                </CommandItem>
              ))}
              {issueItems.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  {issuesLoading ? 'Carregando issues...' : 'Nenhuma issue carregada.'}
                </div>
              )}
            </CommandGroup>
          </>
        )}

        {loadingEntities && repoOpen && (
          <>
            <CommandSeparator />
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Sincronizando entidades da palette...
            </div>
          </>
        )}

        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate">
              {repoInfo?.name ? `Repositorio atual: ${repoInfo.name}` : 'Nenhum repositorio aberto'}
            </span>
            <span className={cn('shrink-0', open && 'text-foreground')}>Ctrl/Cmd+K</span>
          </div>
        </div>
      </CommandList>
    </CommandDialog>
  );
}
