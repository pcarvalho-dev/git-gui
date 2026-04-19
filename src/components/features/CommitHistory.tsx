import { useEffect, useState } from 'react';
import {
  useCherryPickCommit,
  useCommits,
  useResetCommit,
  useRevertCommit,
} from '@/hooks/useGit';
import { git } from '@/services/git';
import { getErrorMessage } from '@/lib/error';
import { useRepoStore } from '@/stores/repoStore';
import { useDiffViewerStore } from '@/stores/diffViewerStore';
import type { CommitInfo, DiffInfo } from '@/types';
import FileHistoryDialog from './FileHistoryDialog';
import InteractiveRebase from './InteractiveRebase';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import ActionMenu from '@/components/ui/action-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowRightLeft,
  Search,
  Loader2,
  GitCommit,
  GitMerge,
  Copy,
  RotateCcw,
  Undo2,
  History,
  Columns2,
  Workflow,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import DiffViewer from './DiffViewer';

interface CommitHistoryProps {
  onOpenCompare: (baseRef: string, headRef: string) => void;
}

export default function CommitHistory({ onOpenCompare }: CommitHistoryProps) {
  const { data: commits, isLoading } = useCommits();
  const cherryPickCommit = useCherryPickCommit();
  const revertCommit = useRevertCommit();
  const resetCommit = useResetCommit();
  const selectedCommitHash = useRepoStore((state) => state.selectedCommitHash);
  const setSelectedCommitHash = useRepoStore((state) => state.setSelectedCommitHash);
  const setPendingNavView = useRepoStore((state) => state.setPendingNavView);
  const openDiff = useDiffViewerStore((state) => state.openDiff);
  const [search, setSearch] = useState('');
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [commitDiff, setCommitDiff] = useState<DiffInfo[] | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [fileHistoryOpen, setFileHistoryOpen] = useState(false);
  const [fileHistoryPath, setFileHistoryPath] = useState<string | null>(null);
  const [rebaseOpen, setRebaseOpen] = useState(false);
  const [rebaseBaseHash, setRebaseBaseHash] = useState<string | null>(null);
  const { toast } = useToast();

  const handleOpenRebase = (commit: CommitInfo) => {
    const base = commit.parents[0] ?? null;
    if (!base) return;
    setRebaseBaseHash(base);
    setRebaseOpen(true);
  };

  const handleNavigateToCommit = (hash: string) => {
    setSelectedCommitHash(hash);
    setPendingNavView('history');
  };

  const filteredCommits = commits?.filter((commit) => {
    if (!search) {
      return true;
    }

    const term = search.toLowerCase();
    return (
      commit.summary.toLowerCase().includes(term) ||
      commit.author_name.toLowerCase().includes(term) ||
      commit.short_hash.includes(term) ||
      commit.hash.includes(term)
    );
  });

  useEffect(() => {
    if (!selectedCommitHash) {
      setSelectedCommit(null);
      setCommitDiff(null);
      return;
    }

    const nextCommit =
      commits?.find((commit) => commit.hash === selectedCommitHash) || null;
    setSelectedCommit(nextCommit);
  }, [commits, selectedCommitHash]);

  useEffect(() => {
    if (!selectedCommit) {
      setCommitDiff(null);
      return;
    }

    let cancelled = false;
    setDiffLoading(true);

    git.diff
      .getCommit(selectedCommit.hash)
      .then((diff) => {
        if (!cancelled) {
          setCommitDiff(diff);
        }
      })
      .catch((err) => {
        console.error('Failed to load diff:', err);
        if (!cancelled) {
          setCommitDiff(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDiffLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCommit]);

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    toast({
      title: 'Copiado',
      description: 'Hash copiado para a area de transferencia',
    });
  };

  const handleCherryPick = (commit: CommitInfo) => {
    if (!confirm(`Aplicar cherry-pick do commit ${commit.short_hash}?`)) {
      return;
    }

    cherryPickCommit.mutate(commit.hash, {
      onSuccess: () => {
        toast({
          title: 'Cherry-pick concluido',
          description: `Commit ${commit.short_hash} aplicado na branch atual`,
        });
      },
      onError: (err) => {
        toast({
          title: 'Erro no cherry-pick',
          description: getErrorMessage(err),
          variant: 'destructive',
        });
      },
    });
  };

  const handleRevert = (commit: CommitInfo) => {
    if (!confirm(`Reverter o commit ${commit.short_hash}?`)) {
      return;
    }

    revertCommit.mutate(commit.hash, {
      onSuccess: () => {
        toast({
          title: 'Commit revertido',
          description: `Reversao criada para ${commit.short_hash}`,
        });
      },
      onError: (err) => {
        toast({
          title: 'Erro ao reverter commit',
          description: getErrorMessage(err),
          variant: 'destructive',
        });
      },
    });
  };

  const handleReset = (commit: CommitInfo, mode: 'soft' | 'mixed' | 'hard') => {
    if (!confirm(`Fazer reset ${mode} para ${commit.short_hash}?`)) {
      return;
    }

    resetCommit.mutate(
      { commitHash: commit.hash, mode },
      {
        onSuccess: () => {
          toast({
            title: 'Reset concluido',
            description: `HEAD movido para ${commit.short_hash} com reset ${mode}`,
          });
        },
        onError: (err) => {
          toast({
            title: 'Erro no reset',
            description: getErrorMessage(err),
            variant: 'destructive',
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
    <PanelGroup direction="horizontal" autoSaveId="commit-history">
      <Panel defaultSize={40} minSize={25} maxSize={60}>
        <div className="flex h-full flex-col border-r border-border">
          <div className="border-b border-border px-4 py-3">
            <h2 className="mb-2 font-semibold">Historico</h2>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar commits..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2">
              {filteredCommits?.map((commit) => (
                <div
                  key={commit.hash}
                  className={cn(
                    'cursor-pointer rounded px-3 py-2 hover:bg-muted',
                    selectedCommit?.hash === commit.hash && 'bg-muted'
                  )}
                  onClick={() => setSelectedCommitHash(commit.hash)}
                >
                  <div className="flex items-center gap-2">
                    {commit.is_merge ? (
                      <GitMerge className="h-4 w-4 shrink-0 text-purple-500" />
                    ) : (
                      <GitCommit className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="font-mono text-xs text-muted-foreground">
                      {commit.short_hash}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm">{commit.summary}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{commit.author_name}</span>
                    <span>•</span>
                    <span>
                      {format(new Date(commit.author_date * 1000), 'd MMM yyyy', {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>
              ))}

              {filteredCommits?.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  Nenhum commit encontrado
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </Panel>

      <PanelResizeHandle className="resize-handle resize-handle-horizontal" />

      <Panel minSize={30}>
        <div className="flex h-full flex-col">
          {selectedCommit ? (
            <>
              <div className="border-b border-border px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Detalhes do Commit</h3>
                  <ActionMenu
                    alwaysVisible
                    title="Acoes do commit"
                    items={[
                      {
                        label: 'Comparar com HEAD atual',
                        icon: ArrowRightLeft,
                        onSelect: () => onOpenCompare('HEAD', selectedCommit.hash),
                      },
                      ...(selectedCommit.parents[0]
                        ? [
                            {
                              label: 'Comparar com parent',
                              icon: ArrowRightLeft,
                              onSelect: () => onOpenCompare(selectedCommit.parents[0], selectedCommit.hash),
                            },
                          ]
                        : []),
                      {
                        label: 'Cherry-pick',
                        icon: GitCommit,
                        onSelect: () => handleCherryPick(selectedCommit),
                        disabled:
                          cherryPickCommit.isPending ||
                          revertCommit.isPending ||
                          resetCommit.isPending,
                        separatorBefore: true,
                      },
                      {
                        label: 'Reverter commit',
                        icon: RotateCcw,
                        onSelect: () => handleRevert(selectedCommit),
                        disabled:
                          cherryPickCommit.isPending ||
                          revertCommit.isPending ||
                          resetCommit.isPending,
                      },
                      {
                        label: 'Reset soft',
                        icon: Undo2,
                        onSelect: () => handleReset(selectedCommit, 'soft'),
                        disabled:
                          cherryPickCommit.isPending ||
                          revertCommit.isPending ||
                          resetCommit.isPending,
                        separatorBefore: true,
                      },
                      {
                        label: 'Reset mixed',
                        icon: Undo2,
                        onSelect: () => handleReset(selectedCommit, 'mixed'),
                        disabled:
                          cherryPickCommit.isPending ||
                          revertCommit.isPending ||
                          resetCommit.isPending,
                      },
                      {
                        label: 'Reset hard',
                        icon: Undo2,
                        onSelect: () => handleReset(selectedCommit, 'hard'),
                        disabled:
                          cherryPickCommit.isPending ||
                          revertCommit.isPending ||
                          resetCommit.isPending,
                        destructive: true,
                      },
                      {
                        label: 'Rebase interativo a partir daqui',
                        icon: Workflow,
                        onSelect: () => handleOpenRebase(selectedCommit),
                        disabled: !selectedCommit.parents[0],
                        separatorBefore: true,
                      },
                      {
                        label: 'Copiar hash completo',
                        icon: Copy,
                        onSelect: () => copyHash(selectedCommit.hash),
                        separatorBefore: true,
                      },
                    ]}
                  />
                </div>
              </div>

              <div className="space-y-3 border-b border-border p-4">
                <div>
                  <div className="text-xs text-muted-foreground">Hash</div>
                  <div className="font-mono text-sm">{selectedCommit.hash}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Mensagem</div>
                  <div className="whitespace-pre-wrap text-sm">{selectedCommit.message}</div>
                </div>
                <div className="flex gap-8">
                  <div>
                    <div className="text-xs text-muted-foreground">Autor</div>
                    <div className="text-sm">{selectedCommit.author_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedCommit.author_email}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Data</div>
                    <div className="text-sm">
                      {format(new Date(selectedCommit.author_date * 1000), 'PPpp', {
                        locale: ptBR,
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1">
                {diffLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : commitDiff && commitDiff.length > 0 ? (
                  <div>
                    <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
                      {commitDiff.length} arquivo(s) alterado(s)
                    </div>
                    {commitDiff.map((diff) => (
                      <div key={diff.path} className="border-b border-border">
                        <div className="flex items-center gap-2 bg-muted/30 px-4 py-2 text-sm font-medium">
                          <span className="flex-1 truncate">{diff.path}</span>
                          <span className="text-xs text-green-600">+{diff.additions}</span>
                          <span className="text-xs text-red-600">-{diff.deletions}</span>
                          <button
                            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Ver lado a lado"
                            onClick={() => selectedCommit && openDiff(diff, selectedCommit, commitDiff ?? [])}
                          >
                            <Columns2 className="w-3.5 h-3.5" />
                          </button>
                          <ActionMenu
                            title={`Acoes de ${diff.path}`}
                            triggerClassName="h-5 w-5"
                            items={[
                              {
                                label: 'Historico do arquivo',
                                icon: History,
                                onSelect: () => {
                                  setFileHistoryPath(diff.path);
                                  setFileHistoryOpen(true);
                                },
                              },
                            ]}
                          />
                        </div>
                        <DiffViewer diff={diff} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    Nenhuma alteracao neste commit
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Selecione um commit para ver os detalhes
            </div>
          )}
        </div>
      </Panel>
    </PanelGroup>

    <FileHistoryDialog
      path={fileHistoryPath}
      open={fileHistoryOpen}
      onOpenChange={setFileHistoryOpen}
      onNavigateToCommit={handleNavigateToCommit}
    />
    <InteractiveRebase
      open={rebaseOpen}
      onOpenChange={setRebaseOpen}
      baseHash={rebaseBaseHash}
    />
    </>
  );
}
