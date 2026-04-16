import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertCircle,
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  GitCommit,
  Loader2,
} from 'lucide-react';
import type { AppView } from '@/lib/navigation';
import {
  useBranches,
  useCommits,
  useCompareRefs,
  useRepoStatus,
} from '@/hooks/useGit';
import { getErrorMessage } from '@/lib/error';
import { cn } from '@/lib/utils';
import { useRepoStore } from '@/stores/repoStore';
import type { CommitInfo, DiffInfo } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import DiffViewer from './DiffViewer';

interface CompareViewProps {
  setView: (view: AppView) => void;
}

function normalizeRefName(reference: string | null | undefined): string {
  if (!reference) {
    return '';
  }

  return reference
    .replace(/^refs\/heads\//, '')
    .replace(/^refs\/remotes\//, '')
    .replace(/^refs\/tags\//, '');
}

function shortHash(hash: string | null | undefined): string {
  return hash?.slice(0, 7) || '-------';
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function CompareCommitColumn({
  title,
  emptyLabel,
  commits,
  onOpenCommit,
}: {
  title: string;
  emptyLabel: string;
  commits: CommitInfo[];
  onOpenCommit: (commit: CommitInfo) => void;
}) {
  return (
    <div className="flex min-h-0 flex-col bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{commits.length} commit(s)</div>
      </div>

      <ScrollArea className="flex-1">
        {commits.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {commits.map((commit) => (
              <button
                key={commit.hash}
                type="button"
                className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/60"
                onClick={() => onOpenCommit(commit)}
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{commit.short_hash}</span>
                  <span>{commit.author_name}</span>
                  <span>{format(new Date(commit.author_date * 1000), 'd MMM yyyy', { locale: ptBR })}</span>
                </div>
                <div className="mt-1 text-sm font-medium">{commit.summary}</div>
                {commit.body && (
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {commit.body}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function CompareDiffItem({
  diff,
  expanded,
  onToggle,
}: {
  diff: DiffInfo;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{diff.path}</div>
          {diff.old_path && diff.old_path !== diff.path && (
            <div className="truncate text-xs text-muted-foreground">{diff.old_path}</div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 text-xs">
          <span className="rounded bg-green-500/10 px-2 py-0.5 text-green-600">+{diff.additions}</span>
          <span className="rounded bg-red-500/10 px-2 py-0.5 text-red-600">-{diff.deletions}</span>
          <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">{diff.status}</span>
        </div>
      </button>

      {expanded && <DiffViewer diff={diff} />}
    </div>
  );
}

export default function CompareView({ setView }: CompareViewProps) {
  const { toast } = useToast();
  const { data: branches = [] } = useBranches();
  const { data: commits = [] } = useCommits(undefined, 80);
  const { data: status } = useRepoStatus();
  const compareBaseRef = useRepoStore((state) => state.compareBaseRef);
  const compareHeadRef = useRepoStore((state) => state.compareHeadRef);
  const setCompareRefs = useRepoStore((state) => state.setCompareRefs);
  const setSelectedCommitHash = useRepoStore((state) => state.setSelectedCommitHash);

  const currentBranch = branches.find((branch) => branch.is_current)?.name || status?.current_branch || 'HEAD';
  const currentUpstream = normalizeRefName(
    branches.find((branch) => branch.is_current)?.upstream
  );

  const defaultRefs = useMemo(() => {
    const base = compareBaseRef || currentUpstream || commits[1]?.hash || currentBranch;
    const head = compareHeadRef || currentBranch || commits[0]?.hash || 'HEAD';
    return { base, head };
  }, [commits, compareBaseRef, compareHeadRef, currentBranch, currentUpstream]);

  const [baseInput, setBaseInput] = useState('');
  const [headInput, setHeadInput] = useState('');
  const [submittedBaseRef, setSubmittedBaseRef] = useState('');
  const [submittedHeadRef, setSubmittedHeadRef] = useState('');
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (compareBaseRef && compareHeadRef) {
      setBaseInput(compareBaseRef);
      setHeadInput(compareHeadRef);
      setSubmittedBaseRef(compareBaseRef);
      setSubmittedHeadRef(compareHeadRef);
    }
  }, [compareBaseRef, compareHeadRef]);

  useEffect(() => {
    if (submittedBaseRef || submittedHeadRef) {
      return;
    }

    if (!defaultRefs.base || !defaultRefs.head) {
      return;
    }

    setBaseInput(defaultRefs.base);
    setHeadInput(defaultRefs.head);
    setSubmittedBaseRef(defaultRefs.base);
    setSubmittedHeadRef(defaultRefs.head);
  }, [defaultRefs.base, defaultRefs.head, submittedBaseRef, submittedHeadRef]);

  const compareQuery = useCompareRefs(
    submittedBaseRef,
    submittedHeadRef,
    !!submittedBaseRef && !!submittedHeadRef
  );

  const compare = compareQuery.data;
  const totalAdditions = compare?.diff.reduce((sum, item) => sum + item.additions, 0) || 0;
  const totalDeletions = compare?.diff.reduce((sum, item) => sum + item.deletions, 0) || 0;

  useEffect(() => {
    if (!compare) {
      setExpandedFiles(new Set());
      return;
    }

    if (compare.diff.length === 1) {
      setExpandedFiles(new Set([compare.diff[0].path]));
      return;
    }

    setExpandedFiles(new Set());
  }, [compare?.base_hash, compare?.head_hash, compare]);

  const refSuggestions = useMemo(() => {
    const values = new Set<string>();
    values.add('HEAD');

    if (currentBranch) {
      values.add(currentBranch);
    }

    if (currentUpstream) {
      values.add(currentUpstream);
    }

    branches.forEach((branch) => {
      values.add(branch.name);
    });

    commits.slice(0, 40).forEach((commit) => {
      values.add(commit.hash);
      values.add(commit.short_hash);
    });

    return Array.from(values).filter(Boolean).sort((left, right) => left.localeCompare(right));
  }, [branches, commits, currentBranch, currentUpstream]);

  const quickPresets = useMemo(() => {
    const presets = [
      currentUpstream && currentBranch
        ? {
            id: 'current-vs-upstream',
            label: 'Atual vs upstream',
            base: currentUpstream,
            head: currentBranch,
          }
        : null,
      commits[1]
        ? {
            id: 'latest-two',
            label: 'Ultimos 2 commits',
            base: commits[1].hash,
            head: commits[0]?.hash || commits[1].hash,
          }
        : null,
      compareBaseRef && compareHeadRef
        ? {
            id: 'last-compare',
            label: 'Ultimo compare',
            base: compareBaseRef,
            head: compareHeadRef,
          }
        : null,
    ].filter((preset): preset is { id: string; label: string; base: string; head: string } => Boolean(preset));

    const deduped = new Map<string, { id: string; label: string; base: string; head: string }>();
    presets.forEach((preset) => {
      deduped.set(`${preset.base}::${preset.head}`, preset);
    });
    return Array.from(deduped.values());
  }, [commits, compareBaseRef, compareHeadRef, currentBranch, currentUpstream]);

  const applyRefs = (base: string, head: string) => {
    const nextBase = base.trim();
    const nextHead = head.trim();
    if (!nextBase || !nextHead) {
      return;
    }

    setBaseInput(nextBase);
    setHeadInput(nextHead);
    setSubmittedBaseRef(nextBase);
    setSubmittedHeadRef(nextHead);
    setCompareRefs(nextBase, nextHead);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyRefs(baseInput, headInput);
  };

  const handleSwap = () => {
    applyRefs(headInput || submittedHeadRef, baseInput || submittedBaseRef);
  };

  const toggleFileExpanded = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleOpenCommit = (commit: CommitInfo) => {
    setSelectedCommitHash(commit.hash);
    setView('history');
  };

  const handleCopyHash = async (hash: string) => {
    await navigator.clipboard.writeText(hash);
    toast({
      title: 'Hash copiado',
      description: `${shortHash(hash)} copiado para a area de transferencia`,
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Compare</h2>
            <p className="text-sm text-muted-foreground">
              Compare branches ou commits e veja o diff agregado entre referencias.
            </p>
          </div>

          {compare && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {shortHash(compare.base_hash)} {'->'} {shortHash(compare.head_hash)}
            </div>
          )}
        </div>

        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Base
              </label>
              <Input
                list="compare-ref-options"
                placeholder="Ex.: main, origin/main, HEAD~3, abc1234"
                value={baseInput}
                onChange={(event) => setBaseInput(event.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Compare With
              </label>
              <Input
                list="compare-ref-options"
                placeholder="Ex.: feature/login, HEAD, def5678"
                value={headInput}
                onChange={(event) => setHeadInput(event.target.value)}
              />
            </div>
          </div>

          <datalist id="compare-ref-options">
            {refSuggestions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!baseInput.trim() || !headInput.trim()}>
              Comparar refs
            </Button>
            <Button type="button" variant="outline" onClick={handleSwap}>
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Trocar lados
            </Button>

            {quickPresets.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyRefs(preset.base, preset.head)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </form>
      </div>

      {compareQuery.isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : compareQuery.error ? (
        <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            Falha ao comparar referencias
          </div>
          <div className="mt-1 text-destructive/90">
            {getErrorMessage(compareQuery.error)}
          </div>
        </div>
      ) : compare ? (
        <>
          <div className="grid gap-3 border-b border-border px-4 py-4 md:grid-cols-4">
            <SummaryCard
              label={`Apenas em ${compare.head_ref}`}
              value={`${compare.ahead}`}
              hint="Commits presentes so no lado comparado"
            />
            <SummaryCard
              label={`Apenas em ${compare.base_ref}`}
              value={`${compare.behind}`}
              hint="Commits presentes so na base"
            />
            <SummaryCard
              label="Arquivos"
              value={`${compare.diff.length}`}
              hint={`${totalAdditions} adicoes e ${totalDeletions} remocoes`}
            />
            <SummaryCard
              label="Merge Base"
              value={shortHash(compare.merge_base_hash || compare.diff_base_hash)}
              hint={
                compare.uses_merge_base
                  ? 'Diff calculado a partir do merge-base'
                  : 'Diff direto entre as refs'
              }
            />
          </div>

          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="files" className="flex h-full flex-col">
              <div className="border-b border-border px-4 py-3">
                <TabsList>
                  <TabsTrigger value="files">Arquivos</TabsTrigger>
                  <TabsTrigger value="commits">Commits</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="files" className="mt-0 flex-1 overflow-hidden">
                <div className="flex h-full flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 text-sm">
                    <div>
                      <div className="font-medium">Mudancas de {compare.head_ref}</div>
                      <div className="text-xs text-muted-foreground">
                        {compare.uses_merge_base
                          ? `Usando merge-base ${shortHash(compare.diff_base_hash)}`
                          : `Comparacao direta contra ${compare.base_ref}`}
                      </div>
                    </div>

                    {compare.diff.length > 1 && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedFiles(new Set(compare.diff.map((item) => item.path)))}
                        >
                          Expandir tudo
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedFiles(new Set())}
                        >
                          Recolher tudo
                        </Button>
                      </div>
                    )}
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="space-y-3 p-4">
                      {compare.diff.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                          Nenhuma mudanca de conteudo entre essas referencias.
                        </div>
                      ) : (
                        compare.diff.map((diff) => (
                          <CompareDiffItem
                            key={diff.path}
                            diff={diff}
                            expanded={expandedFiles.has(diff.path)}
                            onToggle={() => toggleFileExpanded(diff.path)}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="commits" className="mt-0 flex-1 overflow-hidden">
                <div className="grid h-full gap-px bg-border md:grid-cols-2">
                  <CompareCommitColumn
                    title={`Apenas em ${compare.base_ref}`}
                    emptyLabel="Nenhum commit exclusivo na base."
                    commits={compare.base_only_commits}
                    onOpenCommit={handleOpenCommit}
                  />
                  <CompareCommitColumn
                    title={`Apenas em ${compare.head_ref}`}
                    emptyLabel="Nenhum commit exclusivo no lado comparado."
                    commits={compare.head_only_commits}
                    onOpenCommit={handleOpenCommit}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span>Base: {compare.base_ref}</span>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-muted hover:text-foreground'
                )}
                onClick={() => handleCopyHash(compare.base_hash)}
              >
                <Copy className="h-3 w-3" />
                {shortHash(compare.base_hash)}
              </button>
              <span>{'->'}</span>
              <span>Compare: {compare.head_ref}</span>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-muted hover:text-foreground'
                )}
                onClick={() => handleCopyHash(compare.head_hash)}
              >
                <Copy className="h-3 w-3" />
                {shortHash(compare.head_hash)}
              </button>
              <span className="ml-auto inline-flex items-center gap-1">
                <GitCommit className="h-3 w-3" />
                clique em um commit para abrir no historico
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Defina duas referencias para iniciar a comparacao.
        </div>
      )}
    </div>
  );
}
