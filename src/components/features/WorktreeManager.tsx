import { useState, useEffect } from 'react';
import { open as openDir } from '@tauri-apps/plugin-dialog';
import { git } from '@/services/git';
import { getErrorMessage } from '@/lib/error';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import ActionMenu from '@/components/ui/action-menu';
import { cn } from '@/lib/utils';
import {
  GitBranch,
  Lock,
  Unlock,
  Trash2,
  Plus,
  Loader2,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import type { WorktreeInfo } from '@/types';

export default function WorktreeManager() {
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    git.worktree
      .list()
      .then(setWorktrees)
      .catch((err) => {
        toast({
          title: 'Erro ao listar worktrees',
          description: getErrorMessage(err),
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleRemove = async (wt: WorktreeInfo, force = false) => {
    const confirmed = confirm(
      `Remover worktree "${wt.name}"?\n${wt.path}${force ? '\n\n(forçado: alterações não salvas serão perdidas)' : ''}`
    );
    if (!confirmed) return;

    try {
      await git.worktree.remove(wt.path, force);
      toast({ title: 'Worktree removido', description: wt.name });
      load();
    } catch (err) {
      const msg = getErrorMessage(err);
      if (!force && msg.toLowerCase().includes('modified')) {
        const retry = confirm(
          `O worktree "${wt.name}" tem alterações não salvas.\nForçar remoção e descartar?`
        );
        if (retry) handleRemove(wt, true);
      } else {
        toast({ title: 'Erro ao remover', description: msg, variant: 'destructive' });
      }
    }
  };

  const handleLock = async (wt: WorktreeInfo) => {
    try {
      if (wt.is_locked) {
        await git.worktree.unlock(wt.path);
        toast({ title: 'Worktree destravado', description: wt.name });
      } else {
        await git.worktree.lock(wt.path);
        toast({ title: 'Worktree travado', description: wt.name });
      }
      load();
    } catch (err) {
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' });
    }
  };

  const handleOpenAsRepo = async (wt: WorktreeInfo) => {
    try {
      await git.repo.open(wt.path);
      toast({ title: 'Worktree aberto', description: wt.name });
    } catch (err) {
      toast({ title: 'Erro ao abrir', description: getErrorMessage(err), variant: 'destructive' });
    }
  };

  const handleCopyPath = (wt: WorktreeInfo) => {
    navigator.clipboard.writeText(wt.path).catch(() => {});
    toast({ title: 'Caminho copiado', description: wt.path });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold">Worktrees</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={load} title="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Novo
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {worktrees.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhum worktree encontrado
            </div>
          ) : (
            worktrees.map((wt) => (
              <div
                key={wt.path}
                className={cn(
                  'rounded-lg border border-border p-4 flex items-start gap-3',
                  wt.is_main && 'bg-muted/30'
                )}
              >
                <GitBranch className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{wt.name}</span>
                    {wt.is_main && (
                      <span className="text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                        principal
                      </span>
                    )}
                    {wt.is_locked && (
                      <span className="text-xs bg-amber-500/15 text-amber-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        travado
                      </span>
                    )}
                    {wt.is_bare && (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        bare
                      </span>
                    )}
                  </div>
                  {wt.branch && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      branch: <span className="font-mono">{wt.branch}</span>
                    </div>
                  )}
                  <div className="mt-0.5 text-xs text-muted-foreground truncate" title={wt.path}>
                    {wt.path}
                  </div>
                  {wt.lock_reason && (
                    <div className="mt-0.5 text-xs text-amber-600 italic">{wt.lock_reason}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <ActionMenu
                    title={`Acoes de ${wt.name}`}
                    items={[
                      {
                        label: 'Abrir como repositório',
                        icon: FolderOpen,
                        onSelect: () => handleOpenAsRepo(wt),
                      },
                      {
                        label: 'Copiar caminho',
                        icon: FolderOpen,
                        onSelect: () => handleCopyPath(wt),
                      },
                      ...(!wt.is_main
                        ? [
                            {
                              label: wt.is_locked ? 'Destravar' : 'Travar',
                              icon: wt.is_locked ? Unlock : Lock,
                              onSelect: () => handleLock(wt),
                              separatorBefore: true,
                            },
                            {
                              label: 'Remover worktree',
                              icon: Trash2,
                              onSelect: () => handleRemove(wt, false),
                              destructive: true,
                              separatorBefore: false,
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <AddWorktreeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => {
          setAddOpen(false);
          load();
        }}
      />
    </div>
  );
}

interface AddWorktreeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function AddWorktreeDialog({ open, onOpenChange, onCreated }: AddWorktreeDialogProps) {
  const [path, setPath] = useState('');
  const [branch, setBranch] = useState('');
  const [createBranch, setCreateBranch] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSelectPath = async () => {
    const selected = await openDir({ directory: true, multiple: false, title: 'Pasta do worktree' });
    if (selected && typeof selected === 'string') {
      setPath(selected);
      if (!branch) {
        const name = selected.split('/').filter(Boolean).pop() ?? '';
        setBranch(name);
      }
    }
  };

  const handleSubmit = async () => {
    if (!path.trim() || !branch.trim()) return;

    setLoading(true);
    try {
      await git.worktree.add(path.trim(), branch.trim(), createBranch);
      toast({ title: 'Worktree criado', description: branch });
      setPath('');
      setBranch('');
      setCreateBranch(false);
      onCreated();
    } catch (err) {
      toast({ title: 'Erro ao criar worktree', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Worktree</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Pasta</Label>
            <div className="flex gap-2">
              <Input
                placeholder="/caminho/para/worktree"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleSelectPath}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{createBranch ? 'Nova branch' : 'Branch existente'}</Label>
            <Input
              placeholder={createBranch ? 'nome-da-nova-branch' : 'main, feature/foo…'}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="create-branch"
              checked={createBranch}
              onCheckedChange={(v) => setCreateBranch(v as boolean)}
            />
            <label htmlFor="create-branch" className="text-sm cursor-pointer select-none">
              Criar nova branch
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!path.trim() || !branch.trim() || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
