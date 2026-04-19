import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, GitCommit } from 'lucide-react';
import { git } from '@/services/git';
import { getErrorMessage } from '@/lib/error';
import { useToast } from '@/components/ui/use-toast';
import type { CommitInfo } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FileHistoryDialogProps {
  path: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToCommit: (hash: string) => void;
}

export default function FileHistoryDialog({
  path,
  open,
  onOpenChange,
  onNavigateToCommit,
}: FileHistoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !path) return;

    setLoading(true);
    git.fileHistory
      .get(path)
      .then(setCommits)
      .catch((err) => {
        setCommits([]);
        toast({
          title: 'Erro ao carregar historico',
          description: getErrorMessage(err),
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  }, [open, path]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historico: {path}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] border rounded">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : commits.length > 0 ? (
            <div className="divide-y divide-border">
              {commits.map((commit) => (
                <button
                  key={commit.hash}
                  className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors"
                  onClick={() => {
                    onNavigateToCommit(commit.hash);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <GitCommit className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-mono text-xs text-muted-foreground">
                      {commit.short_hash}
                    </span>
                    <span className="text-sm truncate">{commit.summary}</span>
                  </div>
                  <div className="mt-0.5 ml-5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{commit.author_name}</span>
                    <span>·</span>
                    <span>
                      {format(new Date(commit.author_date * 1000), 'd MMM yyyy', {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhum historico encontrado
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
