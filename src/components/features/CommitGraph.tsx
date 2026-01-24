import { useState } from 'react';
import { useCommits, useBranches } from '@/hooks/useGit';
import type { CommitInfo } from '@/types';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, GitMerge } from 'lucide-react';

export default function CommitGraph() {
  const { data: commits, isLoading } = useCommits();
  const { data: branches } = useBranches();
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!commits || commits.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Nenhum commit encontrado
      </div>
    );
  }

  // Simple lane assignment based on parent relationships
  const commitLanes = new Map<string, number>();
  let maxLane = 0;

  commits.forEach((commit) => {
    if (commit.parents.length === 0) {
      commitLanes.set(commit.hash, 0);
    } else if (commit.is_merge) {
      // Merge commits stay in lane 0
      commitLanes.set(commit.hash, 0);
    } else {
      const parentLane = commitLanes.get(commit.parents[0]) || 0;
      commitLanes.set(commit.hash, parentLane);
    }
    maxLane = Math.max(maxLane, commitLanes.get(commit.hash) || 0);
  });

  const laneColors = [
    'hsl(var(--primary))',
    '#22c55e',
    '#f59e0b',
    '#ec4899',
    '#8b5cf6',
    '#06b6d4',
  ];

  const getLaneColor = (lane: number) => laneColors[lane % laneColors.length];

  return (
    <PanelGroup direction="horizontal" autoSaveId="commit-graph">
      {/* Graph + Commits List */}
      <Panel defaultSize={65} minSize={40}>
        <div className="h-full flex flex-col border-r border-border">
          <div className="px-4 py-2 border-b border-border">
            <h2 className="font-semibold">Histórico de Commits</h2>
            <p className="text-xs text-muted-foreground">{commits.length} commits</p>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2">
              {commits.map((commit, idx) => {
                const lane = commitLanes.get(commit.hash) || 0;
                const color = getLaneColor(lane);
                const isSelected = selectedCommit?.hash === commit.hash;

                return (
                  <div
                    key={commit.hash}
                    className={cn(
                      'flex items-start gap-3 px-2 py-2 rounded cursor-pointer hover:bg-muted group',
                      isSelected && 'bg-muted'
                    )}
                    onClick={() => setSelectedCommit(commit)}
                  >
                    {/* Graph Node */}
                    <div className="relative w-8 shrink-0 flex justify-center">
                      {/* Vertical line */}
                      {idx < commits.length - 1 && (
                        <div
                          className="absolute top-5 bottom-0 w-0.5"
                          style={{ backgroundColor: color, left: '50%', transform: 'translateX(-50%)' }}
                        />
                      )}
                      {idx > 0 && (
                        <div
                          className="absolute top-0 bottom-5 w-0.5"
                          style={{ backgroundColor: color, left: '50%', transform: 'translateX(-50%)' }}
                        />
                      )}

                      {/* Node */}
                      <div
                        className={cn(
                          'relative z-10 w-5 h-5 rounded-full flex items-center justify-center',
                          'bg-background border-2'
                        )}
                        style={{ borderColor: color }}
                      >
                        {commit.is_merge ? (
                          <GitMerge className="w-3 h-3" style={{ color }} />
                        ) : (
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        )}
                      </div>
                    </div>

                    {/* Commit Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {commit.short_hash}
                        </span>
                        {branches
                          ?.filter((b) => b.commit_hash?.startsWith(commit.short_hash))
                          .map((b) => (
                            <span
                              key={b.name}
                              className={cn(
                                'text-xs px-1.5 py-0.5 rounded',
                                b.is_current
                                  ? 'bg-primary text-primary-foreground'
                                  : b.is_remote
                                  ? 'bg-muted text-muted-foreground'
                                  : 'bg-secondary text-secondary-foreground'
                              )}
                            >
                              {b.name}
                            </span>
                          ))}
                      </div>
                      <div className="text-sm truncate">{commit.summary}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{commit.author_name}</span>
                        <span>•</span>
                        <span>
                          {format(new Date(commit.author_date * 1000), "d 'de' MMM, HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </Panel>

      <PanelResizeHandle className="resize-handle resize-handle-horizontal" />

      {/* Commit Details */}
      <Panel defaultSize={35} minSize={20} maxSize={50}>
        <div className="h-full flex flex-col">
          {selectedCommit ? (
            <>
              <div className="px-4 py-2 border-b border-border">
                <h3 className="font-semibold">Detalhes do Commit</h3>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase">Hash</div>
                    <div className="font-mono text-sm">{selectedCommit.hash}</div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground uppercase">Mensagem</div>
                    <div className="text-sm whitespace-pre-wrap">{selectedCommit.message}</div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground uppercase">Autor</div>
                    <div className="text-sm">
                      {selectedCommit.author_name}
                      <span className="text-muted-foreground"> &lt;{selectedCommit.author_email}&gt;</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(selectedCommit.author_date * 1000), "PPpp", { locale: ptBR })}
                    </div>
                  </div>

                  {selectedCommit.parents.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground uppercase">
                        {selectedCommit.parents.length > 1 ? 'Parents' : 'Parent'}
                      </div>
                      {selectedCommit.parents.map((parent) => (
                        <div key={parent} className="font-mono text-xs">
                          {parent.slice(0, 7)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
