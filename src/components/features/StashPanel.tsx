import { useState } from 'react';
import {
  useStashes,
  useCreateStash,
  useApplyStash,
  usePopStash,
  useDropStash,
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Archive,
  Plus,
  Play,
  Trash2,
  Loader2,
  ArrowDownToLine,
  GitBranch,
} from 'lucide-react';

export default function StashPanel() {
  const { data: stashes, isLoading } = useStashes();
  const createStash = useCreateStash();
  const applyStash = useApplyStash();
  const popStash = usePopStash();
  const dropStash = useDropStash();
  const { toast } = useToast();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [stashMessage, setStashMessage] = useState('');
  const [includeUntracked, setIncludeUntracked] = useState(false);
  const [keepIndex, setKeepIndex] = useState(false);

  const handleCreate = () => {
    createStash.mutate(
      {
        message: stashMessage || undefined,
        includeUntracked,
        keepIndex,
      },
      {
        onSuccess: () => {
          toast({ title: 'Stash criado', description: 'Alterações guardadas no stash' });
          setStashMessage('');
          setIncludeUntracked(false);
          setKeepIndex(false);
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
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Novo Stash
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Stash</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="Mensagem (opcional)"
                  value={stashMessage}
                  onChange={(e) => setStashMessage(e.target.value)}
                />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="includeUntracked"
                      checked={includeUntracked}
                      onCheckedChange={(c) => setIncludeUntracked(c === true)}
                    />
                    <label htmlFor="includeUntracked" className="text-sm">
                      Incluir arquivos não rastreados
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

                <Button
                  onClick={handleCreate}
                  disabled={createStash.isPending}
                  className="w-full"
                >
                  {createStash.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Archive className="w-4 h-4 mr-2" />
                  )}
                  Criar Stash
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stash List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {stashes && stashes.length > 0 ? (
            stashes.map((stash) => (
              <div
                key={stash.index}
                className="px-3 py-3 rounded hover:bg-muted border border-border mb-2"
              >
                <div className="flex items-start gap-3">
                  <Archive className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {`stash@{${stash.index}}`}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {stash.commit_hash}
                      </span>
                    </div>
                    <div className="text-sm mt-1">{stash.message}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {stash.branch && (
                        <>
                          <GitBranch className="w-3 h-3" />
                          <span>{stash.branch}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>
                        {format(new Date(stash.date * 1000), "d MMM yyyy, HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApply(stash.index)}
                    disabled={applyStash.isPending}
                  >
                    <Play className="w-3.5 h-3.5 mr-1" />
                    Aplicar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePop(stash.index)}
                    disabled={popStash.isPending}
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5 mr-1" />
                    Pop
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => handleDrop(stash.index)}
                    disabled={dropStash.isPending}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Remover
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <Archive className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum stash</p>
              <p className="text-sm mt-1">
                Use stash para guardar alterações temporariamente
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
