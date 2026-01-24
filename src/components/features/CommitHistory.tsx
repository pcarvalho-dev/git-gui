import { useState } from 'react';
import { useCommits } from '@/hooks/useGit';
import { git } from '@/services/git';
import type { CommitInfo, DiffInfo } from '@/types';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search,
  Loader2,
  GitCommit,
  GitMerge,
  Copy,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import DiffViewer from './DiffViewer';

export default function CommitHistory() {
  const { data: commits, isLoading } = useCommits();
  const [search, setSearch] = useState('');
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [commitDiff, setCommitDiff] = useState<DiffInfo[] | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const { toast } = useToast();

  const filteredCommits = commits?.filter((c) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      c.summary.toLowerCase().includes(term) ||
      c.author_name.toLowerCase().includes(term) ||
      c.short_hash.includes(term) ||
      c.hash.includes(term)
    );
  });

  const handleSelectCommit = async (commit: CommitInfo) => {
    setSelectedCommit(commit);
    setDiffLoading(true);
    try {
      const diff = await git.diff.getCommit(commit.hash);
      setCommitDiff(diff);
    } catch (err) {
      console.error('Failed to load diff:', err);
      setCommitDiff(null);
    } finally {
      setDiffLoading(false);
    }
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    toast({ title: 'Copiado', description: 'Hash copiado para a área de transferência' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PanelGroup direction="horizontal" autoSaveId="commit-history">
      {/* Commits List */}
      <Panel defaultSize={40} minSize={25} maxSize={60}>
        <div className="h-full flex flex-col border-r border-border">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold mb-2">Histórico</h2>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar commits..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                    'px-3 py-2 rounded cursor-pointer hover:bg-muted',
                    selectedCommit?.hash === commit.hash && 'bg-muted'
                  )}
                  onClick={() => handleSelectCommit(commit)}
                >
                  <div className="flex items-center gap-2">
                    {commit.is_merge ? (
                      <GitMerge className="w-4 h-4 text-purple-500 shrink-0" />
                    ) : (
                      <GitCommit className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-mono text-xs text-muted-foreground">
                      {commit.short_hash}
                    </span>
                  </div>
                  <div className="text-sm mt-1 line-clamp-2">{commit.summary}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <span>{commit.author_name}</span>
                    <span>•</span>
                    <span>
                      {format(new Date(commit.author_date * 1000), "d MMM yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>
              ))}

              {filteredCommits?.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  Nenhum commit encontrado
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </Panel>

      <PanelResizeHandle className="resize-handle resize-handle-horizontal" />

      {/* Commit Details */}
      <Panel minSize={30}>
        <div className="h-full flex flex-col">
          {selectedCommit ? (
            <>
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Detalhes do Commit</h3>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => copyHash(selectedCommit.hash)}
                      title="Copiar hash"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-4 border-b border-border space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground">Hash</div>
                  <div className="font-mono text-sm">{selectedCommit.hash}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Mensagem</div>
                  <div className="text-sm whitespace-pre-wrap">{selectedCommit.message}</div>
                </div>
                <div className="flex gap-8">
                  <div>
                    <div className="text-xs text-muted-foreground">Autor</div>
                    <div className="text-sm">{selectedCommit.author_name}</div>
                    <div className="text-xs text-muted-foreground">{selectedCommit.author_email}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Data</div>
                    <div className="text-sm">
                      {format(new Date(selectedCommit.author_date * 1000), "PPpp", {
                        locale: ptBR,
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1">
                {diffLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : commitDiff && commitDiff.length > 0 ? (
                  <div>
                    <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
                      {commitDiff.length} arquivo(s) alterado(s)
                    </div>
                    {commitDiff.map((diff) => (
                      <div key={diff.path} className="border-b border-border">
                        <div className="px-4 py-2 bg-muted/30 text-sm font-medium flex items-center gap-2">
                          <span className="truncate">{diff.path}</span>
                          <span className="text-green-600 text-xs">+{diff.additions}</span>
                          <span className="text-red-600 text-xs">-{diff.deletions}</span>
                        </div>
                        <DiffViewer diff={diff} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    Nenhuma alteração neste commit
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Selecione um commit para ver os detalhes
            </div>
          )}
        </div>
      </Panel>
    </PanelGroup>
  );
}
