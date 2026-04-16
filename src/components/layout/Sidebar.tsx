import { useState } from 'react';
import type { RepoInfo, RepoStatus } from '@/types';
import { useThemeStore } from '@/stores/themeStore';
import { useTerminalStore } from '@/stores/terminalStore';
import {
  usePush,
  usePull,
  useRemotes,
  useBranches,
  useCheckoutBranch,
  useCloseRepoById,
  useOpenRepos,
} from '@/hooks/useGit';
import { git } from '@/services/git';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/error';
import { APP_VIEWS, type AppView } from '@/lib/navigation';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GitBranch,
  Moon,
  Sun,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  FolderOpen,
  Upload,
  Download,
  Loader2,
  ChevronDown,
  Check,
  X,
  Terminal,
  Settings,
  Code,
  ChevronUp,
  GitBranch as BranchIcon,
} from 'lucide-react';

interface SidebarProps {
  view: AppView;
  setView: (view: AppView) => void;
  repoInfo: RepoInfo;
  status?: RepoStatus;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export default function Sidebar({
  view,
  setView,
  repoInfo,
  status,
  onRefresh,
  onOpenSettings,
}: SidebarProps) {
  const { theme, toggleTheme } = useThemeStore();
  const { isOpen: terminalOpen, toggleTerminal } = useTerminalStore();
  const { toast } = useToast();
  const { data: remotes } = useRemotes();
  const { data: branches } = useBranches();
  const { data: openRepos } = useOpenRepos();
  const checkoutBranch = useCheckoutBranch();
  const closeRepoById = useCloseRepoById();
  const pushRemote = usePush();
  const pullRemote = usePull();
  const [branchPopoverOpen, setBranchPopoverOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState('');
  const [pullFromPopoverOpen, setPullFromPopoverOpen] = useState(false);
  const [pullFromSearch, setPullFromSearch] = useState('');

  const handleCloseRepo = () => {
    const activeRepo = openRepos?.find((repo) => repo.is_active);
    if (activeRepo) {
      closeRepoById.mutate(activeRepo.id);
    }
  };

  const defaultRemote = remotes?.[0]?.name || 'origin';
  const currentBranch = status?.current_branch || 'main';

  const localBranches = branches?.filter((branch) => !branch.is_remote) || [];
  const filteredLocalBranches = localBranches.filter((branch) =>
    branch.name.toLowerCase().includes(branchSearch.toLowerCase())
  );

  const handleCheckout = (name: string) => {
    checkoutBranch.mutate(name, {
      onSuccess: () => {
        toast({ title: 'Branch ativada', description: `Checkout para "${name}"` });
        setBranchPopoverOpen(false);
      },
      onError: (err) => {
        toast({
          title: 'Erro ao trocar branch',
          description: getErrorMessage(err),
          variant: 'destructive',
        });
      },
    });
  };

  const handlePush = () => {
    pushRemote.mutate(
      { remote: defaultRemote, branch: currentBranch, force: false },
      {
        onSuccess: () => {
          toast({ title: 'Push concluido', description: 'Alteracoes enviadas' });
        },
        onError: (err) => {
          console.error('Push error:', err);
          toast({
            title: 'Erro no Push',
            description: getErrorMessage(err),
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handlePull = (branch?: string) => {
    const targetBranch = branch || currentBranch;
    pullRemote.mutate(
      { remote: defaultRemote, branch: targetBranch },
      {
        onSuccess: (result) => {
          const message =
            result === 'already-up-to-date'
              ? 'Ja esta atualizado'
              : result === 'fast-forward'
                ? 'Fast-forward'
                : 'Merge realizado';

          toast({
            title: 'Pull concluido',
            description: branch ? `Pull de ${branch} concluido` : message,
          });
          setPullFromPopoverOpen(false);
        },
        onError: (err) => {
          console.error('Pull error:', err);
          toast({
            title: 'Erro no Pull',
            description: getErrorMessage(err),
            variant: 'destructive',
          });
        },
      }
    );
  };

  const remoteBranches =
    branches?.filter(
      (branch) => branch.is_remote && branch.name.startsWith(`${defaultRemote}/`)
    ) || [];
  const remoteBranchNames = remoteBranches.map((branch) =>
    branch.name.replace(`${defaultRemote}/`, '')
  );
  const filteredRemoteBranchNames = remoteBranchNames.filter((branch) =>
    branch.toLowerCase().includes(pullFromSearch.toLowerCase())
  );

  const changesCount =
    (status?.staged_files.length || 0) +
    (status?.unstaged_files.length || 0) +
    (status?.untracked_files.length || 0);

  return (
    <div className="h-full min-w-0 border-r border-border bg-card flex flex-col">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
          <h1 className="flex-1 truncate text-sm font-bold">{repoInfo.name}</h1>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleCloseRepo}
            title="Fechar repositorio"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Popover
          open={branchPopoverOpen}
          onOpenChange={(open) => {
            setBranchPopoverOpen(open);
            if (!open) {
              setBranchSearch('');
            }
          }}
        >
          <PopoverTrigger asChild>
            <button
              className="mt-2 -mx-1.5 flex w-full items-center gap-2 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Trocar branch"
            >
              <GitBranch className="h-3 w-3 shrink-0" />
              <span className="flex-1 truncate text-left">
                {status?.current_branch || repoInfo.current_branch}
              </span>
              {status && (status.ahead > 0 || status.behind > 0) && (
                <span className="flex shrink-0 items-center gap-1">
                  {status.ahead > 0 && (
                    <span className="flex items-center text-green-500">
                      <ArrowUp className="h-3 w-3" />
                      {status.ahead}
                    </span>
                  )}
                  {status.behind > 0 && (
                    <span className="flex items-center text-orange-500">
                      <ArrowDown className="h-3 w-3" />
                      {status.behind}
                    </span>
                  )}
                </span>
              )}
              <ChevronDown className="h-3 w-3 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <div className="border-b border-border p-2">
              <input
                type="text"
                placeholder="Buscar branch..."
                value={branchSearch}
                onChange={(event) => setBranchSearch(event.target.value)}
                className="w-full rounded bg-muted px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
            <ScrollArea className="max-h-64">
              <div className="p-1">
                {filteredLocalBranches.map((branch) => (
                  <button
                    key={branch.name}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted',
                      branch.is_current && 'bg-primary/10'
                    )}
                    onClick={() => !branch.is_current && handleCheckout(branch.name)}
                    disabled={branch.is_current || checkoutBranch.isPending}
                  >
                    <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{branch.name}</span>
                    {branch.is_current && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                    )}
                    {checkoutBranch.isPending &&
                      checkoutBranch.variables === branch.name && (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      )}
                  </button>
                ))}
                {filteredLocalBranches.length === 0 && (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    {branchSearch
                      ? 'Nenhuma branch encontrada'
                      : 'Nenhuma branch local'}
                  </div>
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {status?.head_commit && (
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            {status.head_commit}
          </div>
        )}
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {APP_VIEWS.map((item) => {
          const Icon = item.icon;
          const isActive = view === item.id;
          const showBadge = item.id === 'files' && changesCount > 0;

          return (
            <Button
              key={item.id}
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn(
                'relative w-full min-w-0 justify-start',
                isActive && 'bg-secondary'
              )}
              onClick={() => setView(item.id)}
            >
              <Icon className="mr-2 h-4 w-4 shrink-0" />
              <span className="flex-1 truncate text-left">{item.label}</span>
              {showBadge && (
                <span className="ml-1 shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                  {changesCount}
                </span>
              )}
              <span className="ml-1 shrink-0 text-xs text-muted-foreground opacity-50">
                {item.shortcut}
              </span>
            </Button>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-border p-2">
        <div className="mb-2 flex gap-1">
          <div className="flex flex-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-r-none border-r-0"
              onClick={() => handlePull()}
              disabled={pullRemote.isPending || !remotes?.length}
              title={`Pull de ${defaultRemote}/${currentBranch}`}
            >
              {pullRemote.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Download className="mr-1 h-4 w-4" />
                  Pull
                </>
              )}
            </Button>
            <Popover
              open={pullFromPopoverOpen}
              onOpenChange={(open) => {
                setPullFromPopoverOpen(open);
                if (!open) {
                  setPullFromSearch('');
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-l-none px-1.5"
                  disabled={pullRemote.isPending || !remotes?.length}
                  title="Pull de outra branch"
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0" align="start">
                <div className="border-b border-border p-2">
                  <input
                    type="text"
                    placeholder="Buscar branch..."
                    value={pullFromSearch}
                    onChange={(event) => setPullFromSearch(event.target.value)}
                    className="w-full rounded bg-muted px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                </div>
                <ScrollArea className="max-h-48">
                  <div className="p-1">
                    {filteredRemoteBranchNames.map((branch) => (
                      <button
                        key={branch}
                        className={cn(
                          'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted',
                          branch === currentBranch && 'bg-primary/10'
                        )}
                        onClick={() => handlePull(branch)}
                        disabled={pullRemote.isPending}
                      >
                        <BranchIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{branch}</span>
                        {pullRemote.isPending && (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                        )}
                      </button>
                    ))}
                    {filteredRemoteBranchNames.length === 0 && (
                      <div className="py-4 text-center text-xs text-muted-foreground">
                        {pullFromSearch
                          ? 'Nenhuma branch encontrada'
                          : 'Nenhuma branch remota'}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handlePush}
            disabled={pushRemote.isPending || !remotes?.length}
            title={`Push para ${defaultRemote}/${currentBranch}`}
          >
            {pushRemote.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Upload className="mr-1 h-4 w-4" />
                Push
              </>
            )}
          </Button>
        </div>

        <Button variant="ghost" className="w-full min-w-0 justify-start" onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">Atualizar</span>
          <span className="ml-1 shrink-0 text-xs text-muted-foreground opacity-50">R</span>
        </Button>

        <Button
          variant={terminalOpen ? 'secondary' : 'ghost'}
          className="w-full min-w-0 justify-start"
          onClick={toggleTerminal}
        >
          <Terminal className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">Terminal</span>
          <span className="ml-1 shrink-0 text-xs text-muted-foreground opacity-50">`</span>
        </Button>

        <Button
          variant="ghost"
          className="w-full min-w-0 justify-start"
          onClick={() => {
            git.repo.openInVscode().catch((err: unknown) => {
              toast({
                title: 'Erro',
                description: getErrorMessage(err),
                variant: 'destructive',
              });
            });
          }}
          title="Abrir no VS Code"
        >
          <Code className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">Abrir no VS Code</span>
        </Button>

        <Button
          variant="ghost"
          className="w-full min-w-0 justify-start"
          onClick={() => {
            git.repo.openInExplorer().catch((err: unknown) => {
              toast({
                title: 'Erro',
                description: getErrorMessage(err),
                variant: 'destructive',
              });
            });
          }}
          title="Abrir pasta no explorador"
        >
          <FolderOpen className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">Abrir Pasta</span>
        </Button>

        <Button
          variant="ghost"
          className="w-full min-w-0 justify-start"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="mr-2 h-4 w-4 shrink-0" />
              <span className="flex-1 truncate text-left">Tema Claro</span>
            </>
          ) : (
            <>
              <Moon className="mr-2 h-4 w-4 shrink-0" />
              <span className="flex-1 truncate text-left">Tema Escuro</span>
            </>
          )}
        </Button>

        <Button
          variant="ghost"
          className="w-full min-w-0 justify-start"
          onClick={onOpenSettings}
        >
          <Settings className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">Configuracoes</span>
        </Button>
      </div>
    </div>
  );
}
