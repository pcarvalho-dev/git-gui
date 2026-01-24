import { useState } from 'react';
import { useRemotes, useFetch, usePull, usePush, useRepoStatus } from '@/hooks/useGit';
import { git } from '@/services/git';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  Cloud,
  Plus,
  Trash2,
  Loader2,
  Download,
  Upload,
  RefreshCw,
  Link,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export default function RemoteManager() {
  const { data: remotes, isLoading, refetch } = useRemotes();
  const { data: status } = useRepoStatus();
  const fetchRemote = useFetch();
  const pullRemote = usePull();
  const pushRemote = usePush();
  const { toast } = useToast();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newRemoteName, setNewRemoteName] = useState('');
  const [newRemoteUrl, setNewRemoteUrl] = useState('');
  const [addingRemote, setAddingRemote] = useState(false);

  const handleAddRemote = async () => {
    if (!newRemoteName.trim() || !newRemoteUrl.trim()) return;

    setAddingRemote(true);
    try {
      await git.remote.add(newRemoteName.trim(), newRemoteUrl.trim());
      toast({ title: 'Remote adicionado', description: `Remote "${newRemoteName}" foi adicionado` });
      setNewRemoteName('');
      setNewRemoteUrl('');
      setShowAddDialog(false);
      refetch();
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Falha ao adicionar remote',
        variant: 'destructive',
      });
    } finally {
      setAddingRemote(false);
    }
  };

  const handleRemoveRemote = async (name: string) => {
    if (!confirm(`Remover remote "${name}"?`)) return;

    try {
      await git.remote.remove(name);
      toast({ title: 'Remote removido' });
      refetch();
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Falha ao remover remote',
        variant: 'destructive',
      });
    }
  };

  const handleFetch = (remote?: string) => {
    fetchRemote.mutate(remote, {
      onSuccess: () => {
        toast({ title: 'Fetch concluído', description: 'Referências atualizadas' });
      },
      onError: (err) => {
        toast({
          title: 'Erro',
          description: err instanceof Error ? err.message : 'Falha no fetch',
          variant: 'destructive',
        });
      },
    });
  };

  const handlePull = (remote: string) => {
    const branch = status?.current_branch || 'main';
    pullRemote.mutate(
      { remote, branch },
      {
        onSuccess: (result) => {
          const msg =
            result === 'already-up-to-date'
              ? 'Já está atualizado'
              : result === 'fast-forward'
              ? 'Fast-forward'
              : 'Merge realizado';
          toast({ title: 'Pull concluído', description: msg });
        },
        onError: (err) => {
          toast({
            title: 'Erro',
            description: err instanceof Error ? err.message : 'Falha no pull',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handlePush = (remote: string, force = false) => {
    const branch = status?.current_branch || 'main';
    pushRemote.mutate(
      { remote, branch, force },
      {
        onSuccess: () => {
          toast({ title: 'Push concluído', description: 'Alterações enviadas' });
        },
        onError: (err) => {
          toast({
            title: 'Erro',
            description: err instanceof Error ? err.message : 'Falha no push',
            variant: 'destructive',
          });
        },
      }
    );
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
          <h2 className="font-semibold">Remotos</h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleFetch()}
              disabled={fetchRemote.isPending}
            >
              {fetchRemote.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              Fetch All
            </Button>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Remote</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Input
                    placeholder="Nome (ex: origin)"
                    value={newRemoteName}
                    onChange={(e) => setNewRemoteName(e.target.value)}
                  />
                  <Input
                    placeholder="URL"
                    value={newRemoteUrl}
                    onChange={(e) => setNewRemoteUrl(e.target.value)}
                  />
                  <Button
                    onClick={handleAddRemote}
                    disabled={!newRemoteName.trim() || !newRemoteUrl.trim() || addingRemote}
                    className="w-full"
                  >
                    {addingRemote ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Cloud className="w-4 h-4 mr-2" />
                    )}
                    Adicionar Remote
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Sync Status */}
        {status && (status.ahead > 0 || status.behind > 0) && (
          <div className="flex items-center gap-4 mt-2 text-sm">
            {status.ahead > 0 && (
              <span className="text-green-600 flex items-center gap-1">
                <ArrowUp className="w-4 h-4" />
                {status.ahead} commit{status.ahead !== 1 ? 's' : ''} ahead
              </span>
            )}
            {status.behind > 0 && (
              <span className="text-orange-600 flex items-center gap-1">
                <ArrowDown className="w-4 h-4" />
                {status.behind} commit{status.behind !== 1 ? 's' : ''} behind
              </span>
            )}
          </div>
        )}
      </div>

      {/* Remotes List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {remotes && remotes.length > 0 ? (
            remotes.map((remote) => (
              <div
                key={remote.name}
                className="p-4 rounded-lg border border-border"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-primary" />
                    <span className="font-semibold">{remote.name}</span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleRemoveRemote(remote.name)}
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Link className="w-3.5 h-3.5" />
                    <span className="truncate">{remote.fetch_url}</span>
                  </div>
                  {remote.push_url !== remote.fetch_url && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Upload className="w-3.5 h-3.5" />
                      <span className="truncate">{remote.push_url}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleFetch(remote.name)}
                    disabled={fetchRemote.isPending}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    Fetch
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePull(remote.name)}
                    disabled={pullRemote.isPending}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Pull
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePush(remote.name)}
                    disabled={pushRemote.isPending}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Push
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <Cloud className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum remote configurado</p>
              <p className="text-sm mt-1">
                Adicione um remote para sincronizar com repositórios remotos
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
