import { useState } from 'react';
import { useRemotes, useFetch, usePull, usePush, useRepoStatus, useBranches } from '@/hooks/useGit';
import { git } from '@/services/git';
import { getErrorMessage } from '@/lib/error';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
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
  ChevronUp,
  GitBranch,
} from 'lucide-react';

export default function RemoteManager() {
  const { data: remotes, isLoading, refetch } = useRemotes();
  const { data: status } = useRepoStatus();
  const { data: branches } = useBranches();
  const fetchRemote = useFetch();
  const pullRemote = usePull();
  const pushRemote = usePush();
  const { toast } = useToast();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newRemoteName, setNewRemoteName] = useState('');
  const [newRemoteUrl, setNewRemoteUrl] = useState('');
  const [addingRemote, setAddingRemote] = useState(false);
  const [pullFromPopover, setPullFromPopover] = useState<string | null>(null);
  const [pullFromSearch, setPullFromSearch] = useState('');

  // Get remote branches for a specific remote
  const getRemoteBranches = (remoteName: string) => {
    return branches
      ?.filter(b => b.is_remote && b.name.startsWith(`${remoteName}/`))
      .map(b => b.name.replace(`${remoteName}/`, '')) || [];
  };

  // Get filtered remote branches based on search
  const getFilteredRemoteBranches = (remoteName: string) => {
    return getRemoteBranches(remoteName).filter(b =>
      b.toLowerCase().includes(pullFromSearch.toLowerCase())
    );
  };

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
        description: getErrorMessage(err),
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
        description: getErrorMessage(err),
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
        console.error('Fetch error:', err);
        toast({
          title: 'Erro no Fetch',
          description: getErrorMessage(err),
          variant: 'destructive',
        });
      },
    });
  };

  const handlePull = (remote: string, branch?: string) => {
    const targetBranch = branch || status?.current_branch || 'main';
    pullRemote.mutate(
      { remote, branch: targetBranch },
      {
        onSuccess: (result) => {
          const msg =
            result === 'already-up-to-date'
              ? 'Já está atualizado'
              : result === 'fast-forward'
              ? 'Fast-forward'
              : 'Merge realizado';
          toast({ title: 'Pull concluído', description: branch ? `Pull de ${branch} concluído` : msg });
          setPullFromPopover(null);
        },
        onError: (err) => {
          console.error('Pull error:', err);
          toast({
            title: 'Erro no Pull',
            description: getErrorMessage(err),
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
          console.error('Push error:', err);
          toast({
            title: 'Erro no Push',
            description: getErrorMessage(err),
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
                  <div className="flex">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-r-none border-r-0"
                      onClick={() => handlePull(remote.name)}
                      disabled={pullRemote.isPending}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Pull
                    </Button>
                    <Popover
                      open={pullFromPopover === remote.name}
                      onOpenChange={(open) => {
                        setPullFromPopover(open ? remote.name : null);
                        if (!open) setPullFromSearch('');
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="px-1.5 rounded-l-none"
                          disabled={pullRemote.isPending}
                          title="Pull de outra branch"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-0" align="start">
                        <div className="p-2 border-b border-border">
                          <input
                            type="text"
                            placeholder="Buscar branch..."
                            value={pullFromSearch}
                            onChange={(e) => setPullFromSearch(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm bg-muted rounded border-0 outline-none focus:ring-1 focus:ring-primary"
                            autoFocus
                          />
                        </div>
                        <ScrollArea className="max-h-48">
                          <div className="p-1">
                            {getFilteredRemoteBranches(remote.name).map((branch) => (
                              <button
                                key={branch}
                                className={cn(
                                  'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left',
                                  branch === status?.current_branch && 'bg-primary/10'
                                )}
                                onClick={() => handlePull(remote.name, branch)}
                                disabled={pullRemote.isPending}
                              >
                                <GitBranch className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate flex-1">{branch}</span>
                                {pullRemote.isPending && (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                )}
                              </button>
                            ))}
                            {getFilteredRemoteBranches(remote.name).length === 0 && (
                              <div className="text-xs text-muted-foreground text-center py-4">
                                {pullFromSearch ? 'Nenhuma branch encontrada' : 'Faça fetch primeiro'}
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>
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
