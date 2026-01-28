import { useState } from 'react';
import {
  useRepoStatus,
  useStageFiles,
  useUnstageFiles,
  useUnstageAll,
  useCreateCommit,
  useDiscardChanges,
  useFileDiff,
} from '@/hooks/useGit';
import type { FileStatus } from '@/types';
import { git } from '@/services/git';
import { getErrorMessage } from '@/lib/error';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
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
} from 'lucide-react';
import DiffViewer from './DiffViewer';
import ConflictResolver from './ConflictResolver';
import CodeEditor from './CodeEditor';

export default function WorkingArea() {
  const { data: status } = useRepoStatus();
  const stageFiles = useStageFiles();
  const unstageFiles = useUnstageFiles();
  const unstageAll = useUnstageAll();
  const createCommit = useCreateCommit();
  const discardChanges = useDiscardChanges();
  const { toast } = useToast();

  const [message, setMessage] = useState('');
  const [amend, setAmend] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ path: string; staged: boolean } | null>(null);
  const [conflictToResolve, setConflictToResolve] = useState<string | null>(null);
  const [fileToEdit, setFileToEdit] = useState<string | null>(null);
  const [abortingMerge, setAbortingMerge] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    conflicts: true,
    staged: true,
    unstaged: true,
    untracked: true,
  });

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

  const handleDiscard = (files: string[]) => {
    if (confirm(`Descartar alterações em ${files.length} arquivo(s)?`)) {
      discardChanges.mutate(files);
      if (selectedFile && files.includes(selectedFile.path)) {
        setSelectedFile(null);
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
        onClick={() => setSelectedFile({ path, staged })}
      >
        {getStatusIcon(fileStatus)}
        <File className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm truncate">{path}</span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              setFileToEdit(path);
            }}
            title="Editar arquivo"
          >
            <Pencil className="w-3 h-3" />
          </Button>
          {staged ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                handleUnstage([path]);
              }}
            >
              <Minus className="w-3 h-3" />
            </Button>
          ) : (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStage([path]);
                }}
              >
                <Plus className="w-3 h-3" />
              </Button>
              {!isUntracked && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDiscard([path]);
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </>
          )}
        </div>
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
      <Button
        size="sm"
        variant="outline"
        className="h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          setConflictToResolve(path);
        }}
      >
        Resolver
      </Button>
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

            <Button
              onClick={handleCommit}
              disabled={createCommit.isPending || !message.trim() || !status?.staged_files.length}
              className="w-full"
            >
              {createCommit.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <GitCommit className="w-4 h-4 mr-2" />
              )}
              Commit ({status?.staged_files.length || 0} arquivo{(status?.staged_files.length || 0) !== 1 ? 's' : ''})
            </Button>
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
                <div className="text-sm font-medium">{selectedFile.path}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedFile.staged ? 'Staged' : 'Working Directory'}
                </div>
              </div>
              <ScrollArea className="flex-1">
                {diffLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : fileDiff ? (
                  <DiffViewer diff={fileDiff} />
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
    </PanelGroup>
  );
}
