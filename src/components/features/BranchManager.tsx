import { useState } from 'react';
import {
  useBranches,
  useCreateBranch,
  useCheckoutBranch,
  useDeleteBranch,
  useMergeBranch,
  useGitConfig,
} from '@/hooks/useGit';
import { getErrorMessage } from '@/lib/error';
import type { BranchInfo } from '@/types';
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
import { cn } from '@/lib/utils';
import {
  GitBranch,
  Plus,
  Trash2,
  GitMerge,
  Check,
  Loader2,
  Cloud,
  ArrowUp,
  ArrowDown,
  Search,
  Clock,
  User,
  Users,
} from 'lucide-react';

type OwnerFilter = 'all' | 'mine' | 'others' | 'old';

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'hoje';
  } else if (diffDays === 1) {
    return 'ontem';
  } else if (diffDays < 7) {
    return `${diffDays} dias`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} sem`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  }
}

export default function BranchManager() {
  const { data: branches, isLoading } = useBranches();
  const { data: userEmail } = useGitConfig('user.email');
  const createBranch = useCreateBranch();
  const checkoutBranch = useCheckoutBranch();
  const deleteBranch = useDeleteBranch();
  const mergeBranch = useMergeBranch();
  const { toast } = useToast();

  const [newBranchName, setNewBranchName] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filter, setFilter] = useState<'all' | 'local' | 'remote'>('all');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const [search, setSearch] = useState('');

  // 2 months ago in seconds (Unix timestamp)
  const twoMonthsAgo = Math.floor(Date.now() / 1000) - (60 * 60 * 24 * 60);

  const filteredBranches = branches?.filter((b) => {
    const matchesFilter = filter === 'all' || (filter === 'local' && !b.is_remote) || (filter === 'remote' && b.is_remote);
    const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase());

    // Owner/age filter
    let matchesOwnerFilter = true;
    if (ownerFilter === 'mine' && userEmail) {
      matchesOwnerFilter = b.author_email?.toLowerCase() === userEmail.toLowerCase();
    } else if (ownerFilter === 'others' && userEmail) {
      matchesOwnerFilter = b.author_email?.toLowerCase() !== userEmail.toLowerCase();
    } else if (ownerFilter === 'old') {
      matchesOwnerFilter = b.commit_date != null && b.commit_date < twoMonthsAgo;
    }

    return matchesFilter && matchesSearch && matchesOwnerFilter;
  });

  const localBranches = filteredBranches?.filter((b) => !b.is_remote) || [];
  const remoteBranches = filteredBranches?.filter((b) => b.is_remote) || [];

  const handleCreate = () => {
    if (!newBranchName.trim()) return;

    createBranch.mutate(
      { name: newBranchName.trim(), checkout: true },
      {
        onSuccess: () => {
          toast({ title: 'Branch criada', description: `Branch "${newBranchName}" criada e ativada` });
          setNewBranchName('');
          setShowCreateDialog(false);
        },
        onError: (err) => {
          toast({
            title: 'Erro ao criar branch',
            description: getErrorMessage(err),
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleCheckout = (name: string) => {
    checkoutBranch.mutate(name, {
      onSuccess: () => {
        toast({ title: 'Branch ativada', description: `Checkout para "${name}"` });
      },
      onError: (err) => {
        toast({
          title: 'Erro ao trocar branch',
          description: getErrorMessage(err),
          variant: 'destructive',
        });
      },
    });
  };

  const handleDelete = (name: string, force = false) => {
    if (!confirm(`Deletar branch "${name}"?`)) return;

    deleteBranch.mutate(
      { name, force },
      {
        onSuccess: () => {
          toast({ title: 'Branch deletada', description: `Branch "${name}" foi removida` });
        },
        onError: (err) => {
          toast({
            title: 'Erro ao deletar branch',
            description: getErrorMessage(err),
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleMerge = (name: string) => {
    if (!confirm(`Fazer merge de "${name}" na branch atual?`)) return;

    mergeBranch.mutate(name, {
      onSuccess: (result) => {
        toast({
          title: 'Merge concluído',
          description: result === 'fast-forward' ? 'Fast-forward merge' : 'Merge commit criado',
        });
      },
      onError: (err) => {
        toast({
          title: 'Erro no merge',
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

  const BranchItem = ({ branch }: { branch: BranchInfo }) => (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded hover:bg-muted group',
        branch.is_current && 'bg-primary/5'
      )}
    >
      {branch.is_remote ? (
        <Cloud className="w-4 h-4 text-muted-foreground shrink-0" />
      ) : (
        <GitBranch className="w-4 h-4 text-muted-foreground shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm truncate', branch.is_current && 'font-semibold')}>
            {branch.name}
          </span>
          {branch.is_current && (
            <Check className="w-3 h-3 text-primary shrink-0" />
          )}
        </div>
        {branch.commit_message && (
          <div className="text-xs text-muted-foreground truncate">
            {branch.commit_message}
          </div>
        )}
        <div className="flex items-center gap-2 text-xs mt-0.5 text-muted-foreground">
          {branch.author_name && (
            <span className="flex items-center gap-1" title={branch.author_email || ''}>
              <User className="w-3 h-3" />
              {branch.author_name}
            </span>
          )}
          {branch.commit_date && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(branch.commit_date)}
            </span>
          )}
          {branch.ahead != null && branch.ahead > 0 && (
            <span className="text-green-600 flex items-center">
              <ArrowUp className="w-3 h-3" />
              {branch.ahead}
            </span>
          )}
          {branch.behind != null && branch.behind > 0 && (
            <span className="text-orange-600 flex items-center">
              <ArrowDown className="w-3 h-3" />
              {branch.behind}
            </span>
          )}
        </div>
      </div>

      {!branch.is_current && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!branch.is_remote && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => handleCheckout(branch.name)}
                title="Checkout"
              >
                <Check className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => handleMerge(branch.name)}
                title="Merge"
              >
                <GitMerge className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={() => handleDelete(branch.name)}
                title="Deletar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          {branch.is_remote && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => handleCheckout(branch.name)}
              title="Checkout"
            >
              <Check className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Branches</h2>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Nova Branch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Branch</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="Nome da branch"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <Button
                  onClick={handleCreate}
                  disabled={!newBranchName.trim() || createBranch.isPending}
                  className="w-full"
                >
                  {createBranch.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <GitBranch className="w-4 h-4 mr-2" />
                  )}
                  Criar e Checkout
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar branch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Filter */}
        <div className="flex gap-1">
          {(['all', 'local', 'remote'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'secondary' : 'ghost'}
              onClick={() => setFilter(f)}
              className="text-xs"
            >
              {f === 'all' ? 'Todas' : f === 'local' ? 'Locais' : 'Remotas'}
            </Button>
          ))}
        </div>

        {/* Owner/Age Filter */}
        <div className="flex gap-1 mt-2">
          <Button
            size="sm"
            variant={ownerFilter === 'all' ? 'secondary' : 'ghost'}
            onClick={() => setOwnerFilter('all')}
            className="text-xs"
          >
            Todas
          </Button>
          <Button
            size="sm"
            variant={ownerFilter === 'mine' ? 'secondary' : 'ghost'}
            onClick={() => setOwnerFilter('mine')}
            className="text-xs"
            title="Branches criadas por mim"
          >
            <User className="w-3 h-3 mr-1" />
            Minhas
          </Button>
          <Button
            size="sm"
            variant={ownerFilter === 'others' ? 'secondary' : 'ghost'}
            onClick={() => setOwnerFilter('others')}
            className="text-xs"
            title="Branches de outros"
          >
            <Users className="w-3 h-3 mr-1" />
            Outros
          </Button>
          <Button
            size="sm"
            variant={ownerFilter === 'old' ? 'secondary' : 'ghost'}
            onClick={() => setOwnerFilter('old')}
            className="text-xs"
            title="Branches antigas (+2 meses)"
          >
            <Clock className="w-3 h-3 mr-1" />
            Antigas
          </Button>
        </div>
      </div>

      {/* Branches List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {localBranches.length === 0 && remoteBranches.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              {search ? 'Nenhuma branch encontrada' : 'Nenhuma branch disponível'}
            </div>
          )}

          {localBranches.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
                LOCAL ({localBranches.length})
              </div>
              {localBranches.map((branch) => (
                <BranchItem key={branch.name} branch={branch} />
              ))}
            </div>
          )}

          {remoteBranches.length > 0 && filter !== 'local' && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
                REMOTE ({remoteBranches.length})
              </div>
              {remoteBranches.map((branch) => (
                <BranchItem key={branch.name} branch={branch} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
