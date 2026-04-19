import { useState } from 'react';
import {
  useRepoStatus,
  useStageFiles,
  useStagePartial,
  useUnstageFiles,
  useUnstagePartial,
  useUnstageAll,
  useCreateCommit,
  useDiscardChanges,
  useFileDiff,
  useCreateStash,
} from '@/hooks/useGit';
import type { BlameInfo, FileStatus, PartialHunkSelection } from '@/types';
import { git } from '@/services/git';
import { getErrorMessage } from '@/lib/error';
import { useRepoStore } from '@/stores/repoStore';
import FileHistoryDialog from './FileHistoryDialog';
import { useDiffViewerStore } from '@/stores/diffViewerStore';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import ActionMenu from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  Plus,
  Minus,
  File,
  GitCommit,
  Loader2,
  ChevronRight,
  ChevronDown,
  Trash2,
  AlertTriangle,
  XCircle,
  Pencil,
  Archive,
  UserRoundSearch,
  History,
  Columns2,
} from 'lucide-react';
import DiffViewer from './DiffViewer';
import ConflictResolver from './ConflictResolver';
import CodeEditor from './CodeEditor';

export default function WorkingArea() {
  const { data: status } = useRepoStatus();
  const stageFiles = useStageFiles();
  const stagePartial = useStagePartial();
  const unstageFiles = useUnstageFiles();
  const unstagePartial = useUnstagePartial();
  const unstageAll = useUnstageAll();
  const createCommit = useCreateCommit();
  const discardChanges = useDiscardChanges();
  const createStash = useCreateStash();
  const { toast } = useToast();

  const [message, setMessage] = useState('');
  const [amend, setAmend] = useState(false);
  const selectedFilePath = useRepoStore((state) => state.selectedFilePath);
  const selectedFileStaged = useRepoStore((state) => state.selectedFileStaged);
  const setSelectedFilePath = useRepoStore((state) => state.setSelectedFilePath);
  const setSelectedCommitHash = useRepoStore((state) => state.setSelectedCommitHash);
  const setPendingNavView = useRepoStore((state) => state.setPendingNavView);
  const openDiff = useDiffViewerStore((state) => state.openDiff);
  const [conflictToResolve, setConflictToResolve] = useState<string | null>(null);
  const [fileToEdit, setFileToEdit] = useState<string | null>(null);
  const [abortingMerge, setAbortingMerge] = useState(false);
  const [stashPopoverOpen, setStashPopoverOpen] = useState(false);
  const [stashMessage, setStashMessage] = useState('');
  const [stashIncludeUntracked, setStashIncludeUntracked] = useState(true);
  const [blameOpen, setBlameOpen] = useState(false);
  const [blameLoading, setBlameLoading] = useState(false);
  const [blameLines, setBlameLines] = useState<BlameInfo[]>([]);
  const [blamePath, setBlamePath] = useState<string | null>(null);
  const [fileHistoryOpen, setFileHistoryOpen] = useState(false);
  const [fileHistoryPath, setFileHistoryPath] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    conflicts: true,
    staged: true,
    unstaged: true,
    untracked: true,
  });
  const selectedFile = selectedFilePath
    ? { path: selectedFilePath, staged: selectedFileStaged }
    : null;

  // Count total changes for stash
  const totalChanges = (status?.staged_files.length || 0) +
                       (status?.unstaged_files.length || 0) +
                       (status?.untracked_files.length || 0);

  const handleQuickStash = () => {
    createStash.mutate(
      { message: undefined, includeUntracked: true, keepIndex: false },
      {
        onSuccess: () => {
          toast({ title: 'Stash criado', description: 'Alterações guardadas no stash' });
        },
        onError: (err) => {
          toast({
            title: 'Erro ao criar stash',
            description: getErrorMessage(err),
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleStashWithMessage = () => {
    createStash.mutate(
      { message: stashMessage || undefined, includeUntracked: stashIncludeUntracked, keepIndex: false },
      {
        onSuccess: () => {
          toast({ title: 'Stash criado', description: 'Alterações guardadas no stash' });
          setStashMessage('');
          setStashPopoverOpen(false);
        },
        onError: (err) => {
          toast({
            title: 'Erro ao criar stash',
            description: getErrorMessage(err),
            variant: 'destructive',
          });
        },
      }
    );
  };

  const { data: fileDiff, isLoading: diffLoading } = useFileDiff(
    selectedFile?.path || '',
    selectedFile?.staged || false
  );

  const toggleSection = (section: 'conflicts' | 'staged' | 'unstaged' | 'untracked') => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleAbortMerge = async () => {
    if (!confirm('Deseja abortar o merge? Todas as alterações serão descartadas.')) return;

    setAbortingMerge(true);
    try {
      await git.conflict.abortMerge();
      toast({ title: 'Merge abortado', description: 'O merge foi cancelado com sucesso' });
    } catch (err) {
      toast({
        title: 'Erro',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setAbortingMerge(false);
    }
  };

  const handleStage = (files: string[]) => {
    stageFiles.mutate(files);
  };

  const handleUnstage = (files: string[]) => {
    unstageFiles.mutate(files);
  };

  const handlePartialChange = (
    path: string,
    selections: PartialHunkSelection[],
    staged: boolean
  ) => {
    const mutation = staged ? unstagePartial : stagePartial;
    const verb = staged ? 'Unstage parcial' : 'Stage parcial';

    mutation.mutate(
      { path, selections },
      {
        onSuccess: () => {
          toast({
            title: verb,
            description: `Alteracoes aplicadas em ${path}`,
          });
        },
        onError: (err) => {
          toast({
            title: `Erro no ${verb.toLowerCase()}`,
            description: getErrorMessage(err),
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleDiscard = (files: string[]) => {
    if (confirm(`Descartar alterações em ${files.length} arquivo(s)?`)) {
      discardChanges.mutate(files);
      if (selectedFile && files.includes(selectedFile.path)) {
        setSelectedFilePath(null);
      }
    }
  };

  const handleCommit = () => {
    if (!message.trim()) {
      toast({
        title: 'Erro',
        description: 'A mensagem de commit não pode estar vazia',
        variant: 'destructive',
      });
      return;
    }

    createCommit.mutate(
      { message: message.trim(), amend },
      {
        onSuccess: () => {
          toast({ title: 'Sucesso', description: 'Commit criado com sucesso' });
          setMessage('');
          setAmend(false);
        },
        onError: (err: unknown) => {
          let errorMessage = 'Falha ao criar commit';
          let errorDetails: string | undefined;

          if (err instanceof Error) {
            errorMessage = err.message;
          } else if (typeof err === 'string') {
            // Tauri may return error as JSON string
            try {
              const parsed = JSON.parse(err);
              errorMessage = parsed.message || err;
              errorDetails = parsed.details;
            } catch {
              errorMessage = err;
            }
          } else if (err && typeof err === 'object') {
            const e = err as { message?: string; details?: string };
            errorMessage = e.message || 'Falha ao criar commit';
            errorDetails = e.details;
          }

          toast({
            title: 'Erro',
            description: errorDetails ? `${errorMessage}\n${errorDetails}` : errorMessage,
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleOpenBlame = async () => {
    if (!selectedFile) return;
    await handleOpenBlameForPath(selectedFile.path, selectedFile.staged);
  };

  const handleOpenBlameForPath = async (path: string, staged = false) => {
    setSelectedFilePath(path, staged);
    setBlamePath(path);
    setBlameOpen(true);
    setBlameLoading(true);

    try {
      const blame = await git.diff.getBlame(path);
      setBlameLines(blame);
    } catch (err) {
      setBlameLines([]);
      toast({
        title: 'Erro ao carregar blame',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setBlameLoading(false);
    }
  };

  const handleOpenFileHistory = (path: string) => {
    setFileHistoryPath(path);
    setFileHistoryOpen(true);
  };

  const handleNavigateToCommit = (hash: string) => {
    setSelectedCommitHash(hash);
    setPendingNavView('history');
  };

  const supportsPartialSelection =
    !!selectedFile &&
    !!fileDiff &&
    !fileDiff.is_binary &&
    ['added', 'modified', 'deleted'].includes(fileDiff.status);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'added':
        return <span className="text-green-500 font-mono text-xs">A</span>;
      case 'modified':
        return <span className="text-yellow-500 font-mono text-xs">M</span>;
      case 'deleted':
        return <span className="text-red-500 font-mono text-xs">D</span>;
      case 'renamed':
        return <span className="text-blue-500 font-mono text-xs">R</span>;
      default:
        return <span className="text-muted-foreground font-mono text-xs">?</span>;
    }
  };

  const FileItem = ({
    file,
    staged,
    isUntracked = false,
  }: {
    file: FileStatus | string;
    staged: boolean;
    isUntracked?: boolean;
  }) => {
    const path = typeof file === 'string' ? file : file.path;
    const fileStatus = typeof file === 'string' ? 'untracked' : file.status;
    const isSelected = selectedFile?.path === path && selectedFile?.staged === staged;

    return (
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted group',
          isSelected && 'bg-muted'
        )}
        onClick={() => setSelectedFilePath(path, staged)}
      >
        {getStatusIcon(fileStatus)}
        <File className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm truncate">{path}</span>

        <ActionMenu
          title={`Acoes do arquivo ${path}`}
          triggerClassName="h-6 w-6"
          items={[
            {
              label: 'Editar arquivo',
              icon: Pencil,
              onSelect: () => setFileToEdit(path),
            },
            {
              label: 'Historico do arquivo',
              icon: History,
              onSelect: () => handleOpenFileHistory(path),
            },
            {
              label: 'Ver blame',
              icon: UserRoundSearch,
              onSelect: () => handleOpenBlameForPath(path, staged),
            },
            ...(staged
              ? [
                  {
                    label: 'Unstage',
                    icon: Minus,
                    onSelect: () => handleUnstage([path]),
                    separatorBefore: true,
                  },
                ]
              : [
                  {
                    label: 'Stage',
                    icon: Plus,
                    onSelect: () => handleStage([path]),
                    separatorBefore: true,
                  },
                  ...(!isUntracked
                    ? [
                        {
                          label: 'Descartar alteracoes',
                          icon: Trash2,
                          onSelect: () => handleDiscard([path]),
                          destructive: true,
                        },
                      ]
                    : []),
                ]),
          ]}
        />
      </div>
    );
  };

  const ConflictFileItem = ({ path }: { path: string }) => (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted group',
        'bg-red-500/10 border border-red-500/20'
      )}
      onClick={() => setConflictToResolve(path)}
    >
      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
      <File className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="flex-1 text-sm truncate">{path}</span>
      <ActionMenu
        title={`Acoes do conflito ${path}`}
        triggerClassName="h-6 w-6"
        items={[
          {
            label: 'Resolver conflito',
            icon: AlertTriangle,
            onSelect: () => setConflictToResolve(path),
          },
        ]}
      />
    </div>
  );

  const SectionHeader = ({
    title,
    count,
    section,
    actions,
    variant,
  }: {
    title: string;
    count: number;
    section: 'conflicts' | 'staged' | 'unstaged' | 'untracked';
    actions?: React.ReactNode;
    variant?: 'default' | 'danger';
  }) => (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/50 rounded',
        variant === 'danger' && 'bg-red-500/10'
      )}
      onClick={() => toggleSection(section)}
    >
      {expandedSections[section] ? (
        <ChevronDown className={cn('w-4 h-4', variant === 'danger' && 'text-red-500')} />
      ) : (
        <ChevronRight className={cn('w-4 h-4', variant === 'danger' && 'text-red-500')} />
      )}
      <span className={cn(
        'text-xs font-semibold uppercase',
        variant === 'danger' ? 'text-red-500' : 'text-muted-foreground'
      )}>
        {title}
      </span>
      <span className={cn(
        'text-xs',
        variant === 'danger' ? 'text-red-500' : 'text-muted-foreground'
      )}>({count})</span>
      <div className="ml-auto">{actions}</div>
    </div>
  );

  return (
    <PanelGroup direction="horizontal" autoSaveId="working-area">
      {/* Files Panel */}
      <Panel defaultSize={35} minSize={20} maxSize={50}>
        <div className="h-full flex flex-col border-r border-border">
          <ScrollArea className="flex-1">
            <div className="p-2">
              {/* Conflicted Files */}
              {status && status.conflicted_files.length > 0 && (
                <div className="mb-2">
                  <SectionHeader
                    title="Conflitos"
                    count={status.conflicted_files.length}
                    section="conflicts"
                    variant="danger"
                    actions={
                      status.is_merging && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs text-red-500 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAbortMerge();
                          }}
                          disabled={abortingMerge}
                        >
                          {abortingMerge ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          Abortar Merge
                        </Button>
                      )
                    }
                  />
                  {expandedSections.conflicts && (
                    <div className="ml-2 space-y-1">
                      {status.conflicted_files.map((path) => (
                        <ConflictFileItem key={path} path={path} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Staged Files */}
              {status && status.staged_files.length > 0 && (
                <div className="mb-2">
                  <SectionHeader
                    title="Staged"
                    count={status.staged_files.length}
                    section="staged"
                    actions={
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          unstageAll.mutate();
                        }}
                      >
                        Unstage All
                      </Button>
                    }
                  />
                  {expandedSections.staged && (
                    <div className="ml-2">
                      {status.staged_files.map((file) => (
                        <FileItem key={file.path} file={file} staged={true} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Unstaged Files */}
              {status && status.unstaged_files.length > 0 && (
                <div className="mb-2">
                  <SectionHeader
                    title="Modificados"
                    count={status.unstaged_files.length}
                    section="unstaged"
                    actions={
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          const files = status.unstaged_files.map((f) => f.path);
                          handleStage(files);
                        }}
                      >
                        Stage All
                      </Button>
                    }
                  />
                  {expandedSections.unstaged && (
                    <div className="ml-2">
                      {status.unstaged_files.map((file) => (
                        <FileItem key={file.path} file={file} staged={false} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Untracked Files */}
              {status && status.untracked_files.length > 0 && (
                <div className="mb-2">
                  <SectionHeader
                    title="Não Rastreados"
                    count={status.untracked_files.length}
                    section="untracked"
                    actions={
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStage(status.untracked_files);
                        }}
                      >
                        Stage All
                      </Button>
                    }
                  />
                  {expandedSections.untracked && (
                    <div className="ml-2">
                      {status.untracked_files.map((path) => (
                        <FileItem key={path} file={path} staged={false} isUntracked />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Empty State */}
              {status &&
                status.conflicted_files.length === 0 &&
                status.staged_files.length === 0 &&
                status.unstaged_files.length === 0 &&
                status.untracked_files.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    Nenhuma alteração
                  </div>
                )}
            </div>
          </ScrollArea>

          {/* Commit Panel */}
          <div className="border-t border-border p-3 space-y-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mensagem do commit..."
              className="min-h-20 resize-none text-sm"
            />

            <div className="flex items-center gap-2">
              <Checkbox
                id="amend"
                checked={amend}
                onCheckedChange={(checked) => setAmend(checked === true)}
              />
              <label htmlFor="amend" className="text-xs text-muted-foreground">
                Amend (modificar último commit)
              </label>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCommit}
                disabled={createCommit.isPending || !message.trim() || !status?.staged_files.length}
                className="flex-1"
              >
                {createCommit.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <GitCommit className="w-4 h-4 mr-2" />
                )}
                Commit ({status?.staged_files.length || 0})
              </Button>

              {/* Stash Button with Popover */}
              {totalChanges > 0 && (
                <Popover open={stashPopoverOpen} onOpenChange={setStashPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={createStash.isPending || totalChanges === 0}
                      title="Guardar alterações no stash"
                    >
                      {createStash.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Archive className="w-4 h-4" />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="end">
                    <div className="space-y-3">
                      <div className="font-medium text-sm">Criar Stash</div>
                      <div className="text-xs text-muted-foreground">
                        {totalChanges} arquivo{totalChanges !== 1 ? 's' : ''} será{totalChanges !== 1 ? 'ão' : ''} guardado{totalChanges !== 1 ? 's' : ''}
                      </div>

                      <Input
                        placeholder="Mensagem (opcional)"
                        value={stashMessage}
                        onChange={(e) => setStashMessage(e.target.value)}
                        className="text-sm"
                      />

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="stashUntracked"
                          checked={stashIncludeUntracked}
                          onCheckedChange={(c) => setStashIncludeUntracked(c === true)}
                        />
                        <label htmlFor="stashUntracked" className="text-xs">
                          Incluir não rastreados ({status?.untracked_files.length || 0})
                        </label>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={handleQuickStash}
                          disabled={createStash.isPending}
                        >
                          Stash Rápido
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={handleStashWithMessage}
                          disabled={createStash.isPending}
                        >
                          {createStash.isPending ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Archive className="w-3 h-3 mr-1" />
                          )}
                          Criar
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </div>
      </Panel>

      <PanelResizeHandle className="resize-handle resize-handle-horizontal" />

      {/* Diff Panel */}
      <Panel minSize={30}>
        <div className="h-full flex flex-col">
          {selectedFile ? (
            <>
              <div className="px-4 py-2 border-b border-border bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{selectedFile.path}</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedFile.staged ? 'Staged' : 'Working Directory'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {fileDiff && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDiff(fileDiff, null, [fileDiff])}
                        title="Ver lado a lado"
                      >
                        <Columns2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={handleOpenBlame}>
                      <UserRoundSearch className="w-4 h-4 mr-1" />
                      Blame
                    </Button>
                  </div>
                </div>
              </div>
              <ScrollArea className="flex-1">
                {diffLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : fileDiff ? (
                  <DiffViewer
                    diff={fileDiff}
                    hunkActionLabel={
                      supportsPartialSelection
                        ? selectedFile.staged
                          ? 'Unstage hunk'
                          : 'Stage hunk'
                        : undefined
                    }
                    lineActionLabel={
                      supportsPartialSelection
                        ? selectedFile.staged
                          ? 'Unstage line'
                          : 'Stage line'
                        : undefined
                    }
                    isActionPending={stagePartial.isPending || unstagePartial.isPending}
                    onActionHunk={
                      supportsPartialSelection
                        ? (hunkIndex) =>
                            handlePartialChange(
                              selectedFile.path,
                              [{ hunk_index: hunkIndex }],
                              selectedFile.staged
                            )
                        : undefined
                    }
                    onActionLine={
                      supportsPartialSelection
                        ? (hunkIndex, lineIndex) =>
                            handlePartialChange(
                              selectedFile.path,
                              [{ hunk_index: hunkIndex, line_indexes: [lineIndex] }],
                              selectedFile.staged
                            )
                        : undefined
                    }
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Não foi possível carregar o diff
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Selecione um arquivo para ver as alterações
            </div>
          )}
        </div>
      </Panel>

      {/* Conflict Resolver Modal */}
      <ConflictResolver
        filePath={conflictToResolve}
        onClose={() => setConflictToResolve(null)}
      />

      {/* Code Editor Modal */}
      <CodeEditor
        filePath={fileToEdit}
        onClose={() => setFileToEdit(null)}
      />

      <Dialog open={blameOpen} onOpenChange={setBlameOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Blame: {blamePath}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] border rounded">
            {blameLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : blameLines.length > 0 ? (
              <div className="divide-y divide-border">
                {blameLines.map((line) => (
                  <div key={line.line} className="grid grid-cols-[40px_80px_120px_100px_1fr] gap-2 px-3 py-1.5 text-xs hover:bg-muted/30">
                    <span className="font-mono text-muted-foreground text-right">{line.line}</span>
                    <button
                      className="font-mono text-blue-500 hover:underline text-left truncate"
                      title={`Ver commit ${line.commit_hash}`}
                      onClick={() => {
                        handleNavigateToCommit(line.commit_hash);
                        setBlameOpen(false);
                      }}
                    >
                      {line.commit_hash}
                    </button>
                    <span className="truncate text-muted-foreground" title={line.author}>{line.author}</span>
                    <span className="text-muted-foreground">
                      {new Date(line.date * 1000).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="font-mono truncate">{line.content}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma informacao de blame disponivel
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <FileHistoryDialog
        path={fileHistoryPath}
        open={fileHistoryOpen}
        onOpenChange={setFileHistoryOpen}
        onNavigateToCommit={handleNavigateToCommit}
      />
    </PanelGroup>
  );
}
