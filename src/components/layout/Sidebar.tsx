import { useState } from 'react';
import type { RepoInfo, RepoStatus } from '@/types';
import { useThemeStore } from '@/stores/themeStore';
import { usePush, usePull, useRemotes, useBranches, useCheckoutBranch, queryKeys } from '@/hooks/useGit';
import { useQueryClient } from '@tanstack/react-query';
import { git } from '@/services/git';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

// Helper to extract error message from Tauri errors
function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    if (e.message) {
      const msg = String(e.message);
      const details = e.details ? ` - ${e.details}` : '';
      return msg + details;
    }
    return JSON.stringify(err);
  }
  return 'Erro desconhecido';
}
import {
  GitBranch,
  History,
  FileText,
  Network,
  Archive,
  Moon,
  Sun,
  Cloud,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  FolderOpen,
  Upload,
  Download,
  Loader2,
  ChevronDown,
  Check,
  GitPullRequestDraft,
  X,
} from 'lucide-react';

type View = 'graph' | 'files' | 'branches' | 'history' | 'stash' | 'remote' | 'pr';

interface SidebarProps {
  view: View;
  setView: (view: View) => void;
  repoInfo: RepoInfo;
  status?: RepoStatus;
  onRefresh: () => void;
}

export default function Sidebar({ view, setView, repoInfo, status, onRefresh }: SidebarProps) {
  const { theme, toggleTheme } = useThemeStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: remotes } = useRemotes();
  const { data: branches } = useBranches();
  const checkoutBranch = useCheckoutBranch();
  const pushRemote = usePush();
  const pullRemote = usePull();
  const [branchPopoverOpen, setBranchPopoverOpen] = useState(false);

  const handleCloseRepo = () => {
    // Update UI immediately
    queryClient.setQueryData(queryKeys.repoInfo, { is_repo: false });
    queryClient.clear();
    // Call backend in background
    git.repo.close().catch(() => {});
  };

  const defaultRemote = remotes?.[0]?.name || 'origin';
  const currentBranch = status?.current_branch || 'main';

  const localBranches = branches?.filter(b => !b.is_remote) || [];

  const handleCheckout = (name: string) => {
    checkoutBranch.mutate(name, {
      onSuccess: () => {
        toast({ title: 'Branch ativada', description: `Checkout para "${name}"` });
        setBranchPopoverOpen(false);
      },
      onError: (err) => {
        toast({
          title: 'Erro',
          description: err instanceof Error ? err.message : 'Falha ao trocar branch',
          variant: 'destructive',
        });
      },
    });
  };

  const handlePush = () => {
    pushRemote.mutate(
      { remote: defaultRemote, branch: currentBranch, force: false },
      {
        onSuccess: () => toast({ title: 'Push concluído', description: 'Alterações enviadas' }),
        onError: (err) => {
          console.error('Push error:', err);
          toast({ title: 'Erro no Push', description: getErrorMessage(err), variant: 'destructive' });
        },
      }
    );
  };

  const handlePull = () => {
    pullRemote.mutate(
      { remote: defaultRemote, branch: currentBranch },
      {
        onSuccess: (result) => {
          const msg = result === 'already-up-to-date' ? 'Já está atualizado' : result === 'fast-forward' ? 'Fast-forward' : 'Merge realizado';
          toast({ title: 'Pull concluído', description: msg });
        },
        onError: (err) => {
          console.error('Pull error:', err);
          toast({ title: 'Erro no Pull', description: getErrorMessage(err), variant: 'destructive' });
        },
      }
    );
  };

  const menuItems = [
    { id: 'graph' as View, label: 'Grafo', icon: Network, shortcut: '1' },
    { id: 'files' as View, label: 'Arquivos', icon: FileText, shortcut: '2' },
    { id: 'branches' as View, label: 'Branches', icon: GitBranch, shortcut: '3' },
    { id: 'history' as View, label: 'Histórico', icon: History, shortcut: '4' },
    { id: 'stash' as View, label: 'Stash', icon: Archive, shortcut: '5' },
    { id: 'remote' as View, label: 'Remotos', icon: Cloud, shortcut: '6' },
    { id: 'pr' as View, label: 'Pull Requests', icon: GitPullRequestDraft, shortcut: '7' },
  ];

  const changesCount =
    (status?.staged_files.length || 0) +
    (status?.unstaged_files.length || 0) +
    (status?.untracked_files.length || 0);

  return (
    <div className="h-full bg-card border-r border-border flex flex-col">
      {/* Repo Info */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-primary shrink-0" />
          <h1 className="text-sm font-bold truncate flex-1">{repoInfo.name}</h1>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleCloseRepo}
            title="Fechar repositorio"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Branch Selector */}
        <Popover open={branchPopoverOpen} onOpenChange={setBranchPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              className="mt-2 w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded px-1.5 py-1 -mx-1.5 transition-colors"
              title="Trocar branch"
            >
              <GitBranch className="w-3 h-3 shrink-0" />
              <span className="truncate flex-1 text-left">{status?.current_branch || repoInfo.current_branch}</span>
              {status && (status.ahead > 0 || status.behind > 0) && (
                <span className="flex items-center gap-1 shrink-0">
                  {status.ahead > 0 && (
                    <span className="flex items-center text-green-500">
                      <ArrowUp className="w-3 h-3" />
                      {status.ahead}
                    </span>
                  )}
                  {status.behind > 0 && (
                    <span className="flex items-center text-orange-500">
                      <ArrowDown className="w-3 h-3" />
                      {status.behind}
                    </span>
                  )}
                </span>
              )}
              <ChevronDown className="w-3 h-3 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <div className="px-3 py-2 border-b border-border">
              <div className="text-xs font-semibold text-muted-foreground">
                Trocar Branch ({localBranches.length})
              </div>
            </div>
            <ScrollArea className="max-h-64">
              <div className="p-1">
                {localBranches.map((branch) => (
                  <button
                    key={branch.name}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left',
                      branch.is_current && 'bg-primary/10'
                    )}
                    onClick={() => !branch.is_current && handleCheckout(branch.name)}
                    disabled={branch.is_current || checkoutBranch.isPending}
                  >
                    <GitBranch className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{branch.name}</span>
                    {branch.is_current && (
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                    )}
                    {checkoutBranch.isPending && checkoutBranch.variables === branch.name && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    )}
                  </button>
                ))}
                {localBranches.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    Nenhuma branch local
                  </div>
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {status?.head_commit && (
          <div className="mt-1 text-xs text-muted-foreground font-mono">
            {status.head_commit}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = view === item.id;
          const showBadge = item.id === 'files' && changesCount > 0;

          return (
            <Button
              key={item.id}
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start relative',
                isActive && 'bg-secondary'
              )}
              onClick={() => setView(item.id)}
            >
              <Icon className="w-4 h-4 mr-2" />
              <span className="flex-1 text-left">{item.label}</span>
              {showBadge && (
                <span className="ml-auto bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                  {changesCount}
                </span>
              )}
              <span className="ml-2 text-xs text-muted-foreground opacity-50">
                {item.shortcut}
              </span>
            </Button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border space-y-1">
        {/* Quick Sync Buttons */}
        <div className="flex gap-1 mb-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handlePull}
            disabled={pullRemote.isPending || !remotes?.length}
            title={`Pull de ${defaultRemote}/${currentBranch}`}
          >
            {pullRemote.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Download className="w-4 h-4 mr-1" />
                Pull
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handlePush}
            disabled={pushRemote.isPending || !remotes?.length}
            title={`Push para ${defaultRemote}/${currentBranch}`}
          >
            {pushRemote.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Upload className="w-4 h-4 mr-1" />
                Push
              </>
            )}
          </Button>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={onRefresh}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
          <span className="ml-auto text-xs text-muted-foreground opacity-50">R</span>
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 mr-2" />
              Tema Claro
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 mr-2" />
              Tema Escuro
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
