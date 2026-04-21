import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, GitCommit } from 'lucide-react';
import { git } from '@/services/git';
import { getErrorMessage } from '@/lib/error';
import { useToast } from '@/components/ui/use-toast';
import type { CommitInfo, DiffInfo } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import DiffViewer from './DiffViewer';

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
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diff, setDiff] = useState<DiffInfo | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !path) return;

    setLoading(true);
    setSelectedCommit(null);
    setDiff(null);

    git.fileHistory
      .get(path)
      .then((result) => {
        setCommits(result);
        if (result.length > 0) setSelectedCommit(result[0]);
      })
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

  useEffect(() => {
    if (!selectedCommit || !path) {
      setDiff(null);
      return;
    }

    let cancelled = false;
    setDiffLoading(true);

    git.diff
      .getFileAtCommit(selectedCommit.hash, path)
      .then((result) => {
        if (!cancelled) setDiff(result);
      })
      .catch(() => {
        if (!cancelled) setDiff(null);
      })
      .finally(() => {
        if (!cancelled) setDiffLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCommit, path]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Historico: {path}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <PanelGroup direction="horizontal" className="flex-1 overflow-hidden">
            <Panel defaultSize={35} minSize={25} maxSize={50}>
              <ScrollArea className="h-full border rounded-l">
                {commits.length > 0 ? (
                  <div className="divide-y divide-border">
                    {commits.map((commit) => (
                      <button
                        key={commit.hash}
                        className={`w-full text-left px-3 py-2.5 hover:bg-muted transition-colors ${
                          selectedCommit?.hash === commit.hash ? 'bg-muted' : ''
                        }`}
                        onClick={() => setSelectedCommit(commit)}
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
            </Panel>

            <PanelResizeHandle className="resize-handle resize-handle-horizontal" />

            <Panel minSize={40}>
              <div className="h-full border border-l-0 rounded-r overflow-hidden flex flex-col">
                {selectedCommit && (
                  <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground shrink-0">
                    <span className="font-mono">{selectedCommit.short_hash}</span>
                    <span className="truncate mx-2 flex-1">{selectedCommit.summary}</span>
                    <button
                      className="text-blue-500 hover:underline shrink-0"
                      onClick={() => {
                        onNavigateToCommit(selectedCommit.hash);
                        onOpenChange(false);
                      }}
                    >
                      Ver commit
                    </button>
                  </div>
                )}
                <div className="flex-1 overflow-auto">
                  {diffLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : diff ? (
                    <DiffViewer diff={diff} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                      {commits.length > 0
                        ? 'Selecione um commit para ver o diff'
                        : ''}
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          </PanelGroup>
        )}
      </DialogContent>
    </Dialog>
  );
}
