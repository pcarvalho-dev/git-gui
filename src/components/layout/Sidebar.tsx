import type { RepoInfo, RepoStatus } from '@/types';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
} from 'lucide-react';

type View = 'graph' | 'files' | 'branches' | 'history' | 'stash' | 'remote';

interface SidebarProps {
  view: View;
  setView: (view: View) => void;
  repoInfo: RepoInfo;
  status?: RepoStatus;
  onRefresh: () => void;
}

export default function Sidebar({ view, setView, repoInfo, status, onRefresh }: SidebarProps) {
  const { theme, toggleTheme } = useThemeStore();

  const menuItems = [
    { id: 'graph' as View, label: 'Grafo', icon: Network, shortcut: '1' },
    { id: 'files' as View, label: 'Arquivos', icon: FileText, shortcut: '2' },
    { id: 'branches' as View, label: 'Branches', icon: GitBranch, shortcut: '3' },
    { id: 'history' as View, label: 'Histórico', icon: History, shortcut: '4' },
    { id: 'stash' as View, label: 'Stash', icon: Archive, shortcut: '5' },
    { id: 'remote' as View, label: 'Remotos', icon: Cloud, shortcut: '6' },
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
          <FolderOpen className="w-4 h-4 text-primary" />
          <h1 className="text-sm font-bold truncate">{repoInfo.name}</h1>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <GitBranch className="w-3 h-3" />
          <span className="truncate">{status?.current_branch || repoInfo.current_branch}</span>
          {status && (status.ahead > 0 || status.behind > 0) && (
            <span className="flex items-center gap-1 ml-auto">
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
        </div>
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
