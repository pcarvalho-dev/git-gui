import { useState, useMemo } from 'react';
import {
  useStashes,
  useCreateStash,
  useApplyStash,
  usePopStash,
  useDropStash,
  useRepoStatus,
} from '@/hooks/useGit';
import { getErrorMessage } from '@/lib/error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Archive,
  Plus,
  Play,
  Trash2,
  Loader2,
  ArrowDownToLine,
  GitBranch,
  Zap,
  Clock,
  Info,
  FileText,
  FilePlus,
  FileEdit,
  FileMinus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileItem {
  path: string;
  type: 'staged' | 'unstaged' | 'untracked';
  status?: string;
}

export default function StashPanel() {
  const { data: stashes, isLoading } = useStashes();
  const { data: status } = useRepoStatus();
  const createStash = useCreateStash();
  const applyStash = useApplyStash();
  const popStash = usePopStash();
  const dropStash = useDropStash();
  const { toast } = useToast();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [stashMessage, setStashMessage] = useState('');
  const [includeUntracked, setIncludeUntracked] = useState(true);
  const [keepIndex, setKeepIndex] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectSpecificFiles, setSelectSpecificFiles] = useState(false);

  // Build file list from status
  const allFiles = useMemo<FileItem[]>(() => {
    if (!status) return [];
    const files: FileItem[] = [];

    status.staged_files.forEach(f => {
      files.push({ path: f.path, type: 'staged', status: f.status });
    });
    status.unstaged_files.forEach(f => {
      files.push({ path: f.path, type: 'unstaged', status: f.status });
    });
    status.untracked_files.forEach(path => {
      files.push({ path, type: 'untracked', status: 'untracked' });
    });

    return files;
  }, [status]);

  // When dialog opens, select all files by default
  const handleOpenDialog = (open: boolean) => {
    setShowCreateDialog(open);
    if (open) {
      setSelectedFiles(new Set(allFiles.map(f => f.path)));
      setSelectSpecificFiles(false);
    }
  };

  const toggleFile = (path: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const selectAllFiles = () => {
    setSelectedFiles(new Set(allFiles.map(f => f.path)));
  };

  const deselectAllFiles = () => {
    setSelectedFiles(new Set());
  };

  const getFileIcon = (file: FileItem) => {
    if (file.type === 'untracked') return <FilePlus className="w-3.5 h-3.5 text-green-500" />;
    if (file.status === 'added') return <FilePlus className="w-3.5 h-3.5 text-green-500" />;
    if (file.status === 'deleted') return <FileMinus className="w-3.5 h-3.5 text-red-500" />;
    if (file.status === 'modified') return <FileEdit className="w-3.5 h-3.5 text-yellow-500" />;
    return <FileText className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  // Count current changes
  const stagedCount = status?.staged_files.length || 0;
  const unstagedCount = status?.unstaged_files.length || 0;
  const untrackedCount = status?.untracked_files.length || 0;
  const totalChanges = stagedCount + unstagedCount + untrackedCount;
  const hasChanges = totalChanges > 0;

  const handleQuickStash = () => {
    createStash.mutate(
      { message: undefined, includeUntracked: true, keepIndex: false },
      {
        onSuccess: () => {
          toast({ title: 'Stash criado', description: 'Alterações guardadas no stash' });
        },
        onError: (err) => {
          toast({
            title: 'Erro',
            description: getErrorMessage(err),
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleCreate = () => {
    // Determine if we're stashing specific files
    const filesToStash = selectSpecificFiles && selectedFiles.size > 0 && selectedFiles.size < allFiles.length
      ? Array.from(selectedFiles)
      : undefined;

    createStash.mutate(
      {
        message: stashMessage || undefined,
        includeUntracked: filesToStash ? true : includeUntracked,
        keepIndex: filesToStash ? false : keepIndex,
        files: filesToStash,
      },
      {
        onSuccess: () => {
          toast({ title: 'Stash criado', description: 'Alterações guardadas no stash' });
          setStashMessage('');
          setIncludeUntracked(true);
          setKeepIndex(false);
          setSelectSpecificFiles(false);
          setSelectedFiles(new Set());
          setShowCreateDialog(false);
        },
        onError: (err) => {
          toast({
            title: 'Erro',
            description: getErrorMessage(err),
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleApply = (index: number) => {
    applyStash.mutate(index, {
      onSuccess: () => {
        toast({ title: 'Stash aplicado', description: 'Alterações restauradas' });
      },
      onError: (err) => {
        toast({
          title: 'Erro',
          description: getErrorMessage(err),
          variant: 'destructive',
        });
      },
    });
  };

  const handlePop = (index: number) => {
    popStash.mutate(index, {
      onSuccess: () => {
        toast({ title: 'Stash aplicado e removido', description: 'Alterações restauradas' });
      },
      onError: (err) => {
        toast({
          title: 'Erro',
          description: getErrorMessage(err),
          variant: 'destructive',
        });
      },
    });
  };

  const handleDrop = (index: number) => {
    if (!confirm('Remover este stash? Esta ação não pode ser desfeita.')) return;

    dropStash.mutate(index, {
      onSuccess: () => {
        toast({ title: 'Stash removido' });
      },
      onError: (err) => {
        toast({
          title: 'Erro',
          description: getErrorMessage(err),
          variant: 'destructive',
        });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Stashes</h2>
          <div className="flex items-center gap-2">
            {/* Quick Stash Button */}
            {hasChanges && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleQuickStash}
                disabled={createStash.isPending}
                title={`Stash rápido (${totalChanges} arquivo${totalChanges !== 1 ? 's' : ''})`}
              >
                {createStash.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
              </Button>
            )}

            <Dialog open={showCreateDialog} onOpenChange={handleOpenDialog}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!hasChanges}>
                  <Plus className="w-4 h-4 mr-1" />
                  Novo Stash
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Criar Stash</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Current changes summary */}
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Info className="w-4 h-4" />
                      <span>Alterações a serem guardadas:</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-semibold text-yellow-500">{stagedCount}</div>
                        <div className="text-xs text-muted-foreground">Staged</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-blue-500">{unstagedCount}</div>
                        <div className="text-xs text-muted-foreground">Modificados</div>
                      </div>
                      <div>
                        <div className={cn("text-lg font-semibold", includeUntracked ? "text-green-500" : "text-muted-foreground")}>
                          {untrackedCount}
                        </div>
                        <div className="text-xs text-muted-foreground">Não rastreados</div>
                      </div>
                    </div>
                  </div>

                  <Input
                    placeholder="Mensagem descritiva (opcional)"
                    value={stashMessage}
                    onChange={(e) => setStashMessage(e.target.value)}
                  />

                  {/* Toggle for file selection mode */}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="selectSpecificFiles"
                      checked={selectSpecificFiles}
                      onCheckedChange={(c) => setSelectSpecificFiles(c === true)}
                    />
                    <label htmlFor="selectSpecificFiles" className="text-sm font-medium">
                      Escolher arquivos específicos
                    </label>
                  </div>

                  {/* File selection list */}
                  {selectSpecificFiles && (
                    <div className="border border-border rounded-lg">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                        <span className="text-xs text-muted-foreground">
                          {selectedFiles.size} de {allFiles.length} arquivo{allFiles.length !== 1 ? 's' : ''} selecionado{selectedFiles.size !== 1 ? 's' : ''}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2"
                            onClick={selectAllFiles}
                          >
                            Todos
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2"
                            onClick={deselectAllFiles}
                          >
                            Nenhum
                          </Button>
                        </div>
                      </div>
                      <ScrollArea className="h-48">
                        <div className="p-2 space-y-1">
                          {allFiles.map((file) => (
                            <div
                              key={`${file.type}-${file.path}`}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer",
                                selectedFiles.has(file.path) && "bg-muted/30"
                              )}
                              onClick={() => toggleFile(file.path)}
                            >
                              <Checkbox
                                checked={selectedFiles.has(file.path)}
                                onCheckedChange={() => toggleFile(file.path)}
                              />
                              {getFileIcon(file)}
                              <span className="text-sm truncate flex-1" title={file.path}>
                                {file.path}
                              </span>
                              <span className={cn(
                                "text-xs px-1.5 py-0.5 rounded",
                                file.type === 'staged' && "bg-yellow-500/20 text-yellow-500",
                                file.type === 'unstaged' && "bg-blue-500/20 text-blue-500",
                                file.type === 'untracked' && "bg-green-500/20 text-green-500"
                              )}>
                                {file.type === 'staged' ? 'S' : file.type === 'unstaged' ? 'M' : 'N'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Options when not selecting specific files */}
                  {!selectSpecificFiles && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="includeUntracked"
                          checked={includeUntracked}
                          onCheckedChange={(c) => setIncludeUntracked(c === true)}
                        />
                        <label htmlFor="includeUntracked" className="text-sm">
                          Incluir arquivos não rastreados ({untrackedCount})
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="keepIndex"
                          checked={keepIndex}
                          onCheckedChange={(c) => setKeepIndex(c === true)}
                        />
                        <label htmlFor="keepIndex" className="text-sm">
                          Manter arquivos staged
                        </label>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleCreate}
                    disabled={createStash.isPending || !hasChanges || (selectSpecificFiles && selectedFiles.size === 0)}
                    className="w-full"
                  >
                    {createStash.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Archive className="w-4 h-4 mr-2" />
                    )}
                    {selectSpecificFiles
                      ? `Criar Stash (${selectedFiles.size} arquivo${selectedFiles.size !== 1 ? 's' : ''})`
                      : `Criar Stash (${includeUntracked ? totalChanges : stagedCount + unstagedCount} arquivo${(includeUntracked ? totalChanges : stagedCount + unstagedCount) !== 1 ? 's' : ''})`
                    }
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Current changes indicator */}
        {hasChanges && (
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
            <span className="text-yellow-500">{stagedCount} staged</span>
            <span>•</span>
            <span className="text-blue-500">{unstagedCount} modificados</span>
            <span>•</span>
            <span className="text-green-500">{untrackedCount} novos</span>
          </div>
        )}
      </div>

      {/* Stash List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {stashes && stashes.length > 0 ? (
            <div className="space-y-2">
              {stashes.map((stash) => (
                <div
                  key={stash.index}
                  className="px-3 py-3 rounded-lg hover:bg-muted/50 border border-border bg-card transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Archive className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                          stash@{'{' + stash.index + '}'}
                        </span>
                        {stash.branch && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <GitBranch className="w-3 h-3" />
                            {stash.branch}
                          </span>
                        )}
                      </div>
                      <div className="text-sm mt-1.5 font-medium">
                        {stash.message || 'WIP on ' + (stash.branch || 'branch')}
                      </div>
                      <div
                        className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground"
                        title={format(new Date(stash.date * 1000), "PPpp", { locale: ptBR })}
                      >
                        <Clock className="w-3 h-3" />
                        <span>
                          {formatDistanceToNow(new Date(stash.date * 1000), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handlePop(stash.index)}
                      disabled={popStash.isPending}
                      className="flex-1"
                      title="Aplicar e remover do stash"
                    >
                      {popStash.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <ArrowDownToLine className="w-3.5 h-3.5 mr-1" />
                      )}
                      Pop
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApply(stash.index)}
                      disabled={applyStash.isPending}
                      className="flex-1"
                      title="Aplicar e manter no stash"
                    >
                      {applyStash.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 mr-1" />
                      )}
                      Aplicar
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDrop(stash.index)}
                      disabled={dropStash.isPending}
                      title="Remover stash"
                    >
                      {dropStash.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <Archive className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p className="font-medium">Nenhum stash salvo</p>
              <p className="text-sm mt-1 max-w-xs mx-auto">
                Use o stash para guardar alterações temporariamente sem fazer commit
              </p>
              {hasChanges && (
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => handleOpenDialog(true)}
                  disabled={createStash.isPending}
                >
                  {createStash.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Archive className="w-4 h-4 mr-2" />
                  )}
                  Criar primeiro stash ({totalChanges} arquivo{totalChanges !== 1 ? 's' : ''})
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
