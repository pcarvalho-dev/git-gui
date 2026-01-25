import { useState, useMemo, useEffect } from 'react';
import { useCommits, useBranches, useRepoStatus } from '@/hooks/useGit';
import { git } from '@/services/git';
import type { CommitInfo, BranchInfo, DiffInfo } from '@/types';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Loader2,
  GitMerge,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  FileText,
  FilePlus,
  FileX,
  FileEdit,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Maximize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useDiffViewerStore } from '@/stores/diffViewerStore';

// Colors for graph lanes - VS Code style
const LANE_COLORS = [
  '#f14c4c', // red
  '#3794ff', // blue
  '#23d18b', // green
  '#e5e510', // yellow
  '#bc3fbc', // magenta
  '#29b8db', // cyan
  '#f5ab35', // orange
  '#a371f7', // purple
];

const ROW_HEIGHT = 28;
const LANE_WIDTH = 16;
const NODE_RADIUS = 4;
const GRAPH_PADDING = 12;

interface GraphNode {
  commit: CommitInfo;
  lane: number;
  row: number;
  parentConnections: Array<{
    parentHash: string;
    parentLane: number;
    parentRow: number;
  }>;
}

function buildGraph(commits: CommitInfo[]): { nodes: GraphNode[]; maxLane: number } {
  if (commits.length === 0) return { nodes: [], maxLane: 0 };

  const nodes: GraphNode[] = [];
  const commitToRow = new Map<string, number>();
  const commitToLane = new Map<string, number>();
  const childCount = new Map<string, number>(); // Track how many children each commit has

  // Build commit index and child count
  commits.forEach((commit, idx) => {
    commitToRow.set(commit.hash, idx);
    commit.parents.forEach(parentHash => {
      childCount.set(parentHash, (childCount.get(parentHash) || 0) + 1);
    });
  });

  // Active lanes: which lanes have an ongoing line at each position
  // Maps lane number -> the commit hash that "owns" this lane going down
  const activeLanes = new Map<number, string>();

  // Find next available lane
  const getNextFreeLane = (): number => {
    let lane = 0;
    while (activeLanes.has(lane)) {
      lane++;
    }
    return lane;
  };

  // Process commits from top (newest) to bottom (oldest)
  commits.forEach((commit, row) => {
    let lane: number;

    // Check if this commit already has a lane assigned (from being a parent of previous commit)
    if (commitToLane.has(commit.hash)) {
      lane = commitToLane.get(commit.hash)!;
    } else {
      // First commit or new branch - assign new lane
      lane = getNextFreeLane();
      commitToLane.set(commit.hash, lane);
    }

    // This commit now occupies this lane
    activeLanes.set(lane, commit.hash);

    const parentConnections: GraphNode['parentConnections'] = [];

    // Process parents
    commit.parents.forEach((parentHash, parentIdx) => {
      const parentRow = commitToRow.get(parentHash);
      if (parentRow === undefined) return;

      let parentLane: number;

      if (commitToLane.has(parentHash)) {
        // Parent already has a lane
        parentLane = commitToLane.get(parentHash)!;
      } else if (parentIdx === 0) {
        // First parent continues in the same lane
        parentLane = lane;
        commitToLane.set(parentHash, parentLane);
      } else {
        // Secondary parent (merged branch) - needs a different lane
        // Find a free lane to the right
        parentLane = lane + 1;
        while (activeLanes.has(parentLane)) {
          parentLane++;
        }
        commitToLane.set(parentHash, parentLane);
        activeLanes.set(parentLane, parentHash);
      }

      parentConnections.push({
        parentHash,
        parentLane,
        parentRow,
      });
    });

    // After processing this commit, check if we can release its lane
    // We release the lane if this commit has only one child (the one we just processed from)
    // or if it's the first commit (no children point to it from above)
    const children = childCount.get(commit.hash) || 0;
    if (children <= 1 && commit.parents.length > 0) {
      // Check if any parent is NOT the first parent of this commit
      // If so, we need to keep the lane for the visual connection
      const firstParentLane = commit.parents.length > 0
        ? commitToLane.get(commit.parents[0])
        : undefined;

      if (firstParentLane === lane) {
        // First parent continues in this lane, lane stays active
      } else {
        // This lane might be ending here
      }
    }

    // Release lanes for commits that have been fully processed
    // A lane is released when we've passed the commit that owns it
    for (const [l, ownerHash] of activeLanes.entries()) {
      const ownerRow = commitToRow.get(ownerHash);
      if (ownerRow !== undefined && ownerRow < row) {
        // Check if any future commit still needs this lane
        const stillNeeded = commits.slice(row).some(c =>
          commitToLane.get(c.hash) === l ||
          c.parents.some(p => commitToLane.get(p) === l)
        );
        if (!stillNeeded) {
          activeLanes.delete(l);
        }
      }
    }

    nodes.push({
      commit,
      lane,
      row,
      parentConnections,
    });
  });

  const maxLane = Math.max(0, ...Array.from(commitToLane.values()));
  return { nodes, maxLane };
}

function GraphSvg({
  nodes,
  maxLane,
  selectedHash,
  onSelectCommit
}: {
  nodes: GraphNode[];
  maxLane: number;
  selectedHash: string | null;
  onSelectCommit: (commit: CommitInfo) => void;
}) {
  const width = GRAPH_PADDING * 2 + (maxLane + 1) * LANE_WIDTH;
  const height = nodes.length * ROW_HEIGHT;

  const getLaneX = (lane: number) => GRAPH_PADDING + lane * LANE_WIDTH + LANE_WIDTH / 2;
  const getRowY = (row: number) => row * ROW_HEIGHT + ROW_HEIGHT / 2;

  return (
    <svg
      width={width}
      height={height}
      className="shrink-0"
      style={{ minWidth: width }}
    >
      {/* Draw connections first (behind nodes) */}
      {nodes.map((node) => (
        node.parentConnections.map((conn, idx) => {
          const startX = getLaneX(node.lane);
          const startY = getRowY(node.row);
          const endX = getLaneX(conn.parentLane);
          const endY = getRowY(conn.parentRow);

          // Use parent's lane color for the line going to that parent
          const lineColor = LANE_COLORS[conn.parentLane % LANE_COLORS.length];

          // Direct vertical line (same lane)
          if (node.lane === conn.parentLane) {
            return (
              <line
                key={`${node.commit.hash}-${conn.parentHash}-${idx}`}
                x1={startX}
                y1={startY + NODE_RADIUS}
                x2={endX}
                y2={endY - NODE_RADIUS}
                stroke={lineColor}
                strokeWidth={2}
              />
            );
          }

          // Diagonal/curved connection for merge
          // Line goes from commit down, then curves to parent's lane
          const curveStartY = startY + NODE_RADIUS + 4;
          const curveEndY = curveStartY + 12;

          return (
            <path
              key={`${node.commit.hash}-${conn.parentHash}-${idx}`}
              d={`M ${startX} ${startY + NODE_RADIUS}
                  L ${startX} ${curveStartY}
                  C ${startX} ${curveEndY}, ${endX} ${curveStartY}, ${endX} ${curveEndY}
                  L ${endX} ${endY - NODE_RADIUS}`}
              fill="none"
              stroke={lineColor}
              strokeWidth={2}
            />
          );
        })
      ))}


      {/* Draw nodes on top */}
      {nodes.map((node) => {
        const x = getLaneX(node.lane);
        const y = getRowY(node.row);
        const color = LANE_COLORS[node.lane % LANE_COLORS.length];
        const isSelected = selectedHash === node.commit.hash;

        return (
          <g
            key={node.commit.hash}
            onClick={() => onSelectCommit(node.commit)}
            className="cursor-pointer"
          >
            {/* Selection highlight */}
            {isSelected && (
              <rect
                x={0}
                y={y - ROW_HEIGHT / 2}
                width="100%"
                height={ROW_HEIGHT}
                fill="hsl(var(--muted))"
                className="pointer-events-none"
              />
            )}

            {/* Node circle */}
            {node.commit.is_merge ? (
              <>
                <circle
                  cx={x}
                  cy={y}
                  r={NODE_RADIUS + 2}
                  fill="hsl(var(--background))"
                  stroke={color}
                  strokeWidth={2}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={NODE_RADIUS - 1}
                  fill={color}
                />
              </>
            ) : (
              <circle
                cx={x}
                cy={y}
                r={NODE_RADIUS}
                fill={color}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

interface BranchBadgeProps {
  branch: BranchInfo;
}

function BranchBadge({ branch }: BranchBadgeProps) {
  const isRemote = branch.is_remote;
  const isCurrent = branch.is_current;

  return (
    <span
      className={cn(
        'inline-flex items-center text-xs px-1.5 py-0.5 rounded border font-medium whitespace-nowrap',
        isCurrent && 'bg-blue-500/20 border-blue-500 text-blue-400',
        isRemote && !isCurrent && 'bg-green-500/20 border-green-500 text-green-400',
        !isRemote && !isCurrent && 'bg-orange-500/20 border-orange-500 text-orange-400'
      )}
    >
      {branch.name}
    </span>
  );
}

// File status icon component
function FileStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'added':
      return <FilePlus className="w-4 h-4 text-green-500" />;
    case 'deleted':
      return <FileX className="w-4 h-4 text-red-500" />;
    case 'modified':
      return <FileEdit className="w-4 h-4 text-yellow-500" />;
    case 'renamed':
      return <FileText className="w-4 h-4 text-blue-500" />;
    default:
      return <FileText className="w-4 h-4 text-muted-foreground" />;
  }
}

// Diff viewer component for a single file
function FileDiffViewer({ diff, isExpanded, onToggle, commit, allDiffs }: {
  diff: DiffInfo;
  isExpanded: boolean;
  onToggle: () => void;
  commit: CommitInfo;
  allDiffs: DiffInfo[];
}) {
  const { openDiff } = useDiffViewerStore();

  const handleOpenFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    openDiff(diff, commit, allDiffs);
  };

  return (
    <div className="border border-border rounded-md overflow-hidden">
      {/* File header */}
      <div
        className="flex items-start gap-2 px-3 py-2 bg-muted/50 cursor-pointer hover:bg-muted"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <FileStatusIcon status={diff.status} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium break-all">{diff.path}</div>
          {diff.old_path && diff.old_path !== diff.path && (
            <div className="text-xs text-muted-foreground break-all">
              ← {diff.old_path}
            </div>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs">
            {diff.additions > 0 && (
              <span className="text-green-500 flex items-center gap-0.5">
                <Plus className="w-3 h-3" />
                {diff.additions}
              </span>
            )}
            {diff.deletions > 0 && (
              <span className="text-red-500 flex items-center gap-0.5">
                <Minus className="w-3 h-3" />
                {diff.deletions}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={handleOpenFullscreen}
          title="Abrir comparacao lado a lado"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Diff content */}
      {isExpanded && (
        <div className="overflow-x-auto">
          {diff.is_binary ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Arquivo binário
            </div>
          ) : diff.hunks.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Sem alterações de conteúdo
            </div>
          ) : (
            <table className="text-xs font-mono min-w-full">
              <tbody>
                {diff.hunks.map((hunk, hunkIdx) => (
                  <React.Fragment key={hunkIdx}>
                    {/* Hunk header */}
                    <tr className="bg-blue-500/10">
                      <td colSpan={3} className="px-2 py-1 text-blue-400">
                        {hunk.header}
                      </td>
                    </tr>
                    {/* Lines */}
                    {hunk.lines.map((line, lineIdx) => {
                      const isAddition = line.line_type === 'addition';
                      const isDeletion = line.line_type === 'deletion';
                      const isContext = line.line_type === 'context';

                      return (
                        <tr
                          key={`${hunkIdx}-${lineIdx}`}
                          className={cn(
                            isAddition && 'bg-green-500/10',
                            isDeletion && 'bg-red-500/10'
                          )}
                        >
                          <td className="px-2 py-0.5 text-muted-foreground text-right select-none w-12 border-r border-border">
                            {line.old_line || ''}
                          </td>
                          <td className="px-2 py-0.5 text-muted-foreground text-right select-none w-12 border-r border-border">
                            {line.new_line || ''}
                          </td>
                          <td className={cn(
                            'px-2 py-0.5 whitespace-pre',
                            isAddition && 'text-green-400',
                            isDeletion && 'text-red-400',
                            isContext && 'text-foreground'
                          )}>
                            {line.content}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// Import React for Fragment
import React from 'react';

export default function CommitGraph() {
  const { data: commits, isLoading } = useCommits(undefined, 500);
  const { data: branches } = useBranches();
  const { data: status } = useRepoStatus();
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [commitDiff, setCommitDiff] = useState<DiffInfo[] | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Fetch diff when commit is selected
  useEffect(() => {
    if (!selectedCommit) {
      setCommitDiff(null);
      setExpandedFiles(new Set());
      return;
    }

    const fetchDiff = async () => {
      setDiffLoading(true);
      try {
        const diff = await git.diff.getCommit(selectedCommit.hash);
        setCommitDiff(diff);
        // Auto-expand first file if there's only one
        if (diff.length === 1) {
          setExpandedFiles(new Set([diff[0].path]));
        } else {
          setExpandedFiles(new Set());
        }
      } catch (err) {
        console.error('Failed to fetch commit diff:', err);
        setCommitDiff(null);
      } finally {
        setDiffLoading(false);
      }
    };

    fetchDiff();
  }, [selectedCommit?.hash]);

  const toggleFileExpanded = (path: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const expandAllFiles = () => {
    if (commitDiff) {
      setExpandedFiles(new Set(commitDiff.map(d => d.path)));
    }
  };

  const collapseAllFiles = () => {
    setExpandedFiles(new Set());
  };

  const { nodes, maxLane } = useMemo(() => {
    if (!commits || commits.length === 0) return { nodes: [], maxLane: 0 };
    return buildGraph(commits);
  }, [commits]);

  // Map commit hashes to branches (branch.commit_hash is 7 chars, commit.hash is full)
  const commitBranches = useMemo(() => {
    const map = new Map<string, BranchInfo[]>();
    if (!commits || !branches) return map;

    commits.forEach(commit => {
      const matchingBranches = branches.filter(branch =>
        branch.commit_hash && commit.hash.startsWith(branch.commit_hash)
      );
      if (matchingBranches.length > 0) {
        map.set(commit.hash, matchingBranches);
      }
    });
    return map;
  }, [branches, commits]);

  // Find ahead/behind markers
  const currentBranchCommitHash = branches?.find(b => b.is_current)?.commit_hash;
  const upstreamBranchCommitHash = branches?.find(b =>
    b.is_remote && b.name === `origin/${status?.current_branch}`
  )?.commit_hash;

  const copyHash = async (hash: string) => {
    await navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
    toast({ title: 'Hash copiado!' });
  };

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

  return (
    <PanelGroup direction="horizontal" autoSaveId="commit-graph">
      {/* Graph + Commits List */}
      <Panel defaultSize={65} minSize={40}>
        <div className="h-full flex flex-col border-r border-border">
          {/* Header */}
          <div className="px-4 py-2 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm">GRAPH</h2>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {status && status.ahead > 0 && (
                <span className="flex items-center gap-1 text-green-500">
                  <ArrowUp className="w-3 h-3" />
                  {status.ahead} outgoing
                </span>
              )}
              {status && status.behind > 0 && (
                <span className="flex items-center gap-1 text-orange-500">
                  <ArrowDown className="w-3 h-3" />
                  {status.behind} incoming
                </span>
              )}
              <span className="text-muted-foreground">{commits.length} commits</span>
            </div>
          </div>

          {/* Outgoing/Incoming indicators */}
          {status && (status.ahead > 0 || status.behind > 0) && (
            <div className="border-b border-border">
              {status.ahead > 0 && (
                <div className="px-4 py-1.5 text-xs flex items-center gap-2 bg-green-500/5">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-green-400 font-medium">Outgoing Changes</span>
                  <span className="text-muted-foreground ml-auto">{status.current_branch}</span>
                </div>
              )}
              {status.behind > 0 && (
                <div className="px-4 py-1.5 text-xs flex items-center gap-2 bg-orange-500/5">
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className="text-orange-400 font-medium">Incoming Changes</span>
                  <span className="text-muted-foreground ml-auto">origin/{status.current_branch}</span>
                </div>
              )}
            </div>
          )}

          {/* Commit List */}
          <ScrollArea className="flex-1">
            <div className="flex">
              {/* Graph Column */}
              <GraphSvg
                nodes={nodes}
                maxLane={maxLane}
                selectedHash={selectedCommit?.hash || null}
                onSelectCommit={setSelectedCommit}
              />

              {/* Commits Column */}
              <div className="flex-1 min-w-0">
                {nodes.map((node) => {
                  const commit = node.commit;
                  const isSelected = selectedCommit?.hash === commit.hash;
                  const nodeBranches = commitBranches.get(commit.hash) || [];
                  const color = LANE_COLORS[node.lane % LANE_COLORS.length];

                  // Determine if this is an outgoing or incoming commit
                  const isOutgoing = status && status.ahead > 0 &&
                    currentBranchCommitHash &&
                    node.row < (status.ahead);
                  const isIncoming = status && status.behind > 0 &&
                    upstreamBranchCommitHash === commit.hash;

                  return (
                    <div
                      key={commit.hash}
                      className={cn(
                        'flex items-center gap-2 px-2 cursor-pointer hover:bg-muted/50',
                        isSelected && 'bg-muted',
                        isOutgoing && 'bg-green-500/5',
                        isIncoming && 'bg-orange-500/5'
                      )}
                      style={{ height: ROW_HEIGHT }}
                      onClick={() => setSelectedCommit(commit)}
                    >
                      {/* Merge icon */}
                      {commit.is_merge && (
                        <GitMerge
                          className="w-3 h-3 shrink-0"
                          style={{ color }}
                        />
                      )}

                      {/* Commit message */}
                      <span className="truncate text-sm flex-1 min-w-0">
                        {commit.summary}
                      </span>

                      {/* Branch badges */}
                      {nodeBranches.length > 0 && (
                        <div className="flex items-center gap-1 shrink-0">
                          {nodeBranches.slice(0, 3).map(branch => (
                            <BranchBadge key={branch.name} branch={branch} />
                          ))}
                          {nodeBranches.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{nodeBranches.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Author */}
                      <span className="text-xs text-muted-foreground shrink-0 w-28 truncate text-right">
                        {commit.author_name}
                      </span>

                      {/* Date */}
                      <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">
                        {formatDistanceToNow(new Date(commit.author_date * 1000), {
                          addSuffix: false,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </div>
      </Panel>

      <PanelResizeHandle className="resize-handle resize-handle-horizontal" />

      {/* Commit Details */}
      <Panel defaultSize={35} minSize={20} maxSize={50}>
        <div className="h-full flex flex-col bg-card overflow-hidden">
          {selectedCommit ? (
            <>
              <div className="px-4 py-2 border-b border-border">
                <h3 className="font-semibold text-sm">COMMIT</h3>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4 min-w-0">
                  {/* Hash */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">SHA</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all flex-1">
                        {selectedCommit.short_hash}
                      </code>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        onClick={() => copyHash(selectedCommit.hash)}
                        title="Copiar hash completo"
                      >
                        {copiedHash === selectedCommit.hash ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Branches at this commit */}
                  {commitBranches.get(selectedCommit.hash)?.length && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Branches</div>
                      <div className="flex flex-wrap gap-1">
                        {commitBranches.get(selectedCommit.hash)?.map(branch => (
                          <BranchBadge key={branch.name} branch={branch} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Message</div>
                    <div className="text-sm font-medium">{selectedCommit.summary}</div>
                    {selectedCommit.body && (
                      <div className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                        {selectedCommit.body}
                      </div>
                    )}
                  </div>

                  {/* Author */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Author</div>
                    <div className="text-sm">
                      <div className="font-medium">{selectedCommit.author_name}</div>
                      <div className="text-muted-foreground text-xs break-all">
                        {selectedCommit.author_email}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(selectedCommit.author_date * 1000), "PPpp", { locale: ptBR })}
                    </div>
                  </div>

                  {/* Committer (if different) */}
                  {selectedCommit.committer_name !== selectedCommit.author_name && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Committer</div>
                      <div className="text-sm">
                        <div className="font-medium">{selectedCommit.committer_name}</div>
                        <div className="text-muted-foreground text-xs break-all">
                          {selectedCommit.committer_email}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(selectedCommit.committer_date * 1000), "PPpp", { locale: ptBR })}
                      </div>
                    </div>
                  )}

                  {/* Parents */}
                  {selectedCommit.parents.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        {selectedCommit.parents.length > 1 ? 'Parents' : 'Parent'}
                      </div>
                      <div className="space-y-1">
                        {selectedCommit.parents.map((parent, idx) => (
                          <div key={parent} className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                              {parent.slice(0, 7)}
                            </code>
                            {selectedCommit.is_merge && idx === 1 && (
                              <span className="text-xs text-muted-foreground">(merged)</span>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5"
                              onClick={() => copyHash(parent)}
                            >
                              {copiedHash === parent ? (
                                <Check className="w-2.5 h-2.5 text-green-500" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Changed Files */}
                  <div className="min-w-0">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="text-xs text-muted-foreground truncate min-w-0">
                        Arquivos alterados {commitDiff && `(${commitDiff.length})`}
                      </div>
                      {commitDiff && commitDiff.length > 1 && (
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2"
                            onClick={expandAllFiles}
                          >
                            Expandir
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2"
                            onClick={collapseAllFiles}
                          >
                            Recolher
                          </Button>
                        </div>
                      )}
                    </div>

                    {diffLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : commitDiff && commitDiff.length > 0 && selectedCommit ? (
                      <div className="space-y-2">
                        {commitDiff.map((diff) => (
                          <FileDiffViewer
                            key={diff.path}
                            diff={diff}
                            isExpanded={expandedFiles.has(diff.path)}
                            onToggle={() => toggleFileExpanded(diff.path)}
                            commit={selectedCommit}
                            allDiffs={commitDiff}
                          />
                        ))}
                      </div>
                    ) : commitDiff && commitDiff.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        Nenhum arquivo alterado
                      </div>
                    ) : null}
                  </div>
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Selecione um commit para ver detalhes
            </div>
          )}
        </div>
      </Panel>
    </PanelGroup>
  );
}
