import { useState, useEffect } from 'react';
import { git } from '@/services/git';
import { getErrorMessage } from '@/lib/error';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Package,
  RefreshCw,
  Plus,
  Loader2,
  Trash2,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  GitCommit,
} from 'lucide-react';
import type { SubmoduleInfo } from '@/types';

function StatusBadge({ status }: { status: SubmoduleInfo['status'] }) {
  switch (status) {
    case 'clean':
      return (
        <span className="inline-flex items-center gap-1 text-xs bg-green-500/15 text-green-500 px-1.5 py-0.5 rounded">
          <CheckCircle className="h-3 w-3" />
          atualizado
        </span>
      );
    case 'modified':
      return (
        <span className="inline-flex items-center gap-1 text-xs bg-yellow-500/15 text-yellow-500 px-1.5 py-0.5 rounded">
          <AlertCircle className="h-3 w-3" />
          modificado
        </span>
      );
    case 'uninitialized':
      return (
        <span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
          <Clock className="h-3 w-3" />
          não iniciado
        </span>
      );
    case 'out_of_sync':
      return (
        <span className="inline-flex items-center gap-1 text-xs bg-blue-500/15 text-blue-500 px-1.5 py-0.5 rounded">
          <AlertCircle className="h-3 w-3" />
          desatualizado
        </span>
      );
    default:
      return (
        <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
          {status}
        </span>
      );
  }
}

export default function SubmoduleManager() {
  const [submodules, setSubmodules] = useState<SubmoduleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingName, setUpdatingName] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    git.submodule
      .list()
      .then(setSubmodules)
      .catch((err) => {
        toast({
          title: 'Erro ao listar submodulos',
          description: getErrorMessage(err),
          variant: 'destructive',
        });
        setSubmodules([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpdate = async (sub: SubmoduleInfo) => {
    setUpdatingName(sub.name);
    try {
      await git.submodule.update(sub.name);
      toast({ title: 'Submodulo atualizado', description: sub.name });
      load();
    } catch (err) {
      toast({ title: 'Erro ao atualizar', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setUpdatingName(null);
    }
  };

  const handleRemove = async (sub: SubmoduleInfo) => {
    if (!confirm(`Remover submodulo "${sub.name}"?\n${sub.path}\n\nEsta ação é irreversível.`)) return;
    try {
      await git.submodule.remove(sub.name);
      toast({ title: 'Submodulo removido', description: sub.name });
      load();
    } catch (err) {
      toast({ title: 'Erro ao remover', description: getErrorMessage(err), variant: 'destructive' });
    }
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
        <h2 className="font-semibold">Submodulos</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={load} title="Atualizar lista">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {submodules.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground space-y-2">
              <Package className="h-10 w-10 mx-auto opacity-30" />
              <p>Nenhum submodulo encontrado</p>
              <p className="text-xs">Use o botão "Adicionar" para vincular um repositório externo.</p>
            </div>
          ) : (
            submodules.map((sub) => (
              <div
                key={sub.name}
                className={cn(
                  'rounded-lg border border-border p-4 flex items-start gap-3',
                  sub.status === 'uninitialized' && 'opacity-70'
                )}
              >
                <Package className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{sub.name}</span>
                    <StatusBadge status={sub.status} />
                  </div>
                  {sub.url && (
                    <div className="mt-0.5 text-xs text-muted-foreground truncate" title={sub.url}>
                      {sub.url}
                    </div>
                  )}
                  <div className="mt-0.5 text-xs text-muted-foreground font-mono truncate" title={sub.path}>
                    {sub.path}
                  </div>
                  {sub.head_commit && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <GitCommit className="h-3 w-3" />
                      <span className="font-mono">{sub.head_commit.slice(0, 8)}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(sub.status === 'uninitialized' || sub.status === 'out_of_sync') && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={updatingName === sub.name}
                      onClick={() => handleUpdate(sub)}
                      title="Inicializar / atualizar submodulo"
                    >
                      {updatingName === sub.name ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3 mr-1" />
                      )}
                      {sub.status === 'uninitialized' ? 'Iniciar' : 'Atualizar'}
                    </Button>
                  )}
                  <ActionMenu
                    title={`Acoes de ${sub.name}`}
                    items={[
                      {
                        label: 'Inicializar / atualizar',
                        icon: Download,
                        onSelect: () => handleUpdate(sub),
                        disabled: updatingName === sub.name,
                      },
                      {
                        label: 'Remover submodulo',
                        icon: Trash2,
                        onSelect: () => handleRemove(sub),
                        destructive: true,
                        separatorBefore: true,
                      },
                    ]}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <AddSubmoduleDialog
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

interface AddSubmoduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function AddSubmoduleDialog({ open, onOpenChange, onCreated }: AddSubmoduleDialogProps) {
  const [url, setUrl] = useState('');
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!url.trim() || !path.trim()) return;

    setLoading(true);
    try {
      await git.submodule.add(url.trim(), path.trim());
      toast({ title: 'Submodulo adicionado', description: path });
      setUrl('');
      setPath('');
      onCreated();
    } catch (err) {
      toast({
        title: 'Erro ao adicionar submodulo',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Submodulo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>URL do repositório</Label>
            <Input
              placeholder="https://github.com/user/repo.git"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (!path) {
                  const name = e.target.value.split('/').pop()?.replace(/\.git$/, '') ?? '';
                  if (name) setPath(name);
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Caminho local</Label>
            <Input
              placeholder="libs/minha-lib"
              value={path}
              onChange={(e) => setPath(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Relativo à raiz do repositório
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!url.trim() || !path.trim() || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
