import { useOpenRepos, useSetActiveRepo, useCloseRepoById } from '@/hooks/useGit';
import { cn } from '@/lib/utils';
import { X, FolderGit2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RepoTabsProps {
  onAddRepo: () => void;
}

export default function RepoTabs({ onAddRepo }: RepoTabsProps) {
  const { data: openRepos } = useOpenRepos();
  const setActiveRepo = useSetActiveRepo();
  const closeRepo = useCloseRepoById();

  if (!openRepos || openRepos.length === 0) {
    return null;
  }

  const handleTabClick = (id: string, isActive: boolean) => {
    if (!isActive) {
      setActiveRepo.mutate(id);
    }
  };

  const handleCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    closeRepo.mutate(id);
  };

  return (
    <div className="flex items-center bg-background border-b border-border">
      <div className="flex-1 flex items-center overflow-x-auto">
        {openRepos.map((repo) => (
          <div
            key={repo.id}
            className={cn(
              'group flex items-center gap-2 px-3 py-1.5 border-r border-border cursor-pointer hover:bg-muted/50 transition-colors min-w-0 max-w-[200px]',
              repo.is_active && 'bg-card border-b-2 border-b-primary'
            )}
            onClick={() => handleTabClick(repo.id, repo.is_active)}
            title={repo.path}
          >
            <FolderGit2 className={cn(
              'w-4 h-4 shrink-0',
              repo.is_active ? 'text-primary' : 'text-muted-foreground'
            )} />
            <span className={cn(
              'text-sm truncate',
              repo.is_active ? 'font-medium' : 'text-muted-foreground'
            )}>
              {repo.name}
            </span>
            <button
              className="ml-auto p-0.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => handleCloseTab(e, repo.id)}
              title="Fechar repositório"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 mx-1"
        onClick={onAddRepo}
        title="Abrir outro repositório"
      >
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}
