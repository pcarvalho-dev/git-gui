import React, { useState } from 'react';
import {
  useGitHubCliStatus,
  usePullRequests,
  usePullRequest,
  usePRReviews,
  usePRComments,
  usePRFiles,
  usePRDiff,
  useCreatePR,
  useReviewPR,
  useCommentPR,
  useMergePR,
  useClosePR,
  useCheckoutPR,
  useBranches,
  useRepoStatus,
} from '@/hooks/useGit';

// Helper to extract error message from Tauri errors
function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    if (e.message) {
      const msg = String(e.message);
      const details = e.details ? `: ${e.details}` : '';
      return msg + details;
    }
    return JSON.stringify(err);
  }
  return 'Erro desconhecido';
}
import type { PullRequest } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  GitPullRequest,
  Plus,
  Check,
  X,
  MessageSquare,
  GitMerge,
  FileText,
  Loader2,
  AlertCircle,
  ExternalLink,
  GitBranch,
  Clock,
  User,
  ChevronRight,
  Download,
  CheckCircle,
  XCircle,
  Eye,
} from 'lucide-react';

function PRStatusBadge({ pr }: { pr: PullRequest }) {
  if (pr.draft) {
    return (
      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
        Draft
      </span>
    );
  }
  if (pr.state === 'MERGED') {
    return (
      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
        Merged
      </span>
    );
  }
  if (pr.state === 'CLOSED') {
    return (
      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
        Closed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
      Open
    </span>
  );
}

function PRListItem({
  pr,
  isSelected,
  onClick,
}: {
  pr: PullRequest;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        'p-3 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors',
        isSelected && 'bg-muted'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <GitPullRequest
          className={cn(
            'w-4 h-4 mt-0.5 shrink-0',
            pr.state === 'MERGED' && 'text-purple-400',
            pr.state === 'CLOSED' && 'text-red-400',
            pr.state === 'OPEN' && 'text-green-400'
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{pr.title}</span>
            <PRStatusBadge pr={pr} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>#{pr.number}</span>
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {pr.author}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(pr.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className="text-muted-foreground">
              {pr.head_branch} <ChevronRight className="w-3 h-3 inline" /> {pr.base_branch}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatePRDialog({ onSuccess }: { onSuccess: () => void }) {
  const { data: branches } = useBranches();
  const { data: status } = useRepoStatus();
  const createPR = useCreatePR();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [base, setBase] = useState('main');
  const [draft, setDraft] = useState(false);
  const [open, setOpen] = useState(false);

  const currentBranch = status?.current_branch || '';
  const localBranches = branches?.filter((b) => !b.is_remote) || [];

  const handleCreate = () => {
    if (!title.trim()) {
      toast({ title: 'Erro', description: 'Titulo e obrigatorio', variant: 'destructive' });
      return;
    }

    createPR.mutate(
      {
        title: title.trim(),
        body: body.trim() || null,
        base,
        head: currentBranch,
        draft,
      },
      {
        onSuccess: (pr) => {
          toast({ title: 'PR criado', description: `Pull Request #${pr.number} criado` });
          setTitle('');
          setBody('');
          setDraft(false);
          setOpen(false);
          onSuccess();
        },
        onError: (err) => {
          toast({
            title: 'Erro ao criar PR',
            description: getErrorMessage(err),
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Novo PR
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar Pull Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">De:</span>
            <span className="font-medium">{currentBranch}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Para:</span>
            <select
              value={base}
              onChange={(e) => setBase(e.target.value)}
              className="bg-background border border-border rounded px-2 py-1 text-sm"
            >
              {localBranches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            placeholder="Titulo do Pull Request"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <Textarea
            placeholder="Descricao (opcional)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
          />

          <div className="flex items-center gap-2">
            <Checkbox
              id="draft"
              checked={draft}
              onCheckedChange={(checked) => setDraft(checked === true)}
            />
            <label htmlFor="draft" className="text-sm">
              Criar como Draft
            </label>
          </div>

          <Button
            onClick={handleCreate}
            disabled={!title.trim() || createPR.isPending}
            className="w-full"
          >
            {createPR.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <GitPullRequest className="w-4 h-4 mr-2" />
            )}
            Criar Pull Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
  oldLineNum: number | null;
  newLineNum: number | null;
}

function FileDiffView({ diff, filename }: { diff: string; filename: string }) {
  // Parse the diff to extract only the relevant file's diff with line numbers
  const parsedDiff = React.useMemo(() => {
    const lines = diff.split('\n');
    let capturing = false;
    const result: DiffLine[] = [];
    let oldLine = 0;
    let newLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this is the start of a new file diff
      if (line.startsWith('diff --git')) {
        if (line.includes(filename)) {
          capturing = true;
          result.length = 0;
        } else if (capturing) {
          break;
        }
        continue;
      }

      if (!capturing) continue;

      // Skip metadata lines
      if (line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++') ||
          line.startsWith('new file') || line.startsWith('deleted file')) {
        continue;
      }

      // Parse hunk header to get line numbers
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          oldLine = parseInt(match[1], 10);
          newLine = parseInt(match[2], 10);
        }
        result.push({ type: 'header', content: line, oldLineNum: null, newLineNum: null });
        continue;
      }

      // Parse content lines
      if (line.startsWith('+')) {
        result.push({ type: 'add', content: line.slice(1), oldLineNum: null, newLineNum: newLine++ });
      } else if (line.startsWith('-')) {
        result.push({ type: 'remove', content: line.slice(1), oldLineNum: oldLine++, newLineNum: null });
      } else {
        result.push({ type: 'context', content: line.slice(1) || line, oldLineNum: oldLine++, newLineNum: newLine++ });
      }
    }

    return result;
  }, [diff, filename]);

  if (parsedDiff.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        Diff não encontrado para este arquivo
      </div>
    );
  }

  return (
    <div className="text-xs font-mono">
      {parsedDiff.map((line, i) => {
        if (line.type === 'header') {
          return (
            <div key={i} className="bg-blue-500/10 text-blue-400 px-4 py-1 border-y border-border">
              {line.content}
            </div>
          );
        }

        const bgClass = line.type === 'add'
          ? 'bg-green-500/15'
          : line.type === 'remove'
            ? 'bg-red-500/15'
            : '';

        const textClass = line.type === 'add'
          ? 'text-green-400'
          : line.type === 'remove'
            ? 'text-red-400'
            : 'text-foreground';

        const symbol = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';

        return (
          <div key={i} className={cn('flex hover:bg-muted/50', bgClass)}>
            {/* Old line number */}
            <div className="w-12 shrink-0 text-right pr-2 text-muted-foreground select-none border-r border-border bg-muted/30">
              {line.oldLineNum ?? ''}
            </div>
            {/* New line number */}
            <div className="w-12 shrink-0 text-right pr-2 text-muted-foreground select-none border-r border-border bg-muted/30">
              {line.newLineNum ?? ''}
            </div>
            {/* Symbol */}
            <div className={cn('w-6 shrink-0 text-center select-none', textClass)}>
              {symbol}
            </div>
            {/* Content */}
            <div className={cn('flex-1 whitespace-pre overflow-x-auto pr-4', textClass)}>
              {line.content || ' '}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PRDetails({ number }: { number: number }) {
  const { data: pr, isLoading } = usePullRequest(number);
  const { data: reviews } = usePRReviews(number);
  const { data: comments } = usePRComments(number);
  const { data: files } = usePRFiles(number);
  const { data: diff, isLoading: diffLoading } = usePRDiff(number);
  const reviewPR = useReviewPR();
  const commentPR = useCommentPR();
  const mergePR = useMergePR();
  const closePR = useClosePR();
  const checkoutPR = useCheckoutPR();
  const { toast } = useToast();

  const [reviewBody, setReviewBody] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [mergeMethod, setMergeMethod] = useState<'merge' | 'squash' | 'rebase'>('squash');
  const [deleteBranchOnMerge, setDeleteBranchOnMerge] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pr) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        PR nao encontrado
      </div>
    );
  }

  const handleReview = (action: 'approve' | 'request-changes' | 'comment') => {
    reviewPR.mutate(
      { number, action, body: reviewBody || undefined },
      {
        onSuccess: () => {
          toast({
            title: 'Review enviado',
            description:
              action === 'approve'
                ? 'PR aprovado'
                : action === 'request-changes'
                ? 'Alteracoes solicitadas'
                : 'Comentario adicionado',
          });
          setReviewBody('');
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

  const handleComment = () => {
    if (!commentBody.trim()) return;
    commentPR.mutate(
      { number, body: commentBody.trim() },
      {
        onSuccess: () => {
          toast({ title: 'Comentario adicionado' });
          setCommentBody('');
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

  const handleMerge = () => {
    if (!confirm('Tem certeza que deseja fazer merge deste PR?')) return;
    mergePR.mutate(
      { number, method: mergeMethod, deleteBranch: deleteBranchOnMerge },
      {
        onSuccess: () => {
          toast({ title: 'PR merged', description: 'Pull Request merged com sucesso' });
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

  const handleClose = () => {
    if (!confirm('Tem certeza que deseja fechar este PR?')) return;
    closePR.mutate(number, {
      onSuccess: () => {
        toast({ title: 'PR fechado' });
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

  const handleCheckout = () => {
    checkoutPR.mutate(number, {
      onSuccess: () => {
        toast({ title: 'Checkout realizado', description: `Branch do PR #${number} ativada` });
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg truncate">{pr.title}</h3>
              <PRStatusBadge pr={pr} />
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span>#{pr.number}</span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {pr.author}
              </span>
            </div>
          </div>
          <a
            href={pr.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Branch info */}
        <div className="flex items-center gap-2 mt-3 text-sm">
          <GitBranch className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{pr.head_branch}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{pr.base_branch}</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-sm">
          <span className="text-green-500">+{pr.additions}</span>
          <span className="text-red-500">-{pr.deletions}</span>
          <span className="text-muted-foreground">{pr.changed_files} arquivos</span>
        </div>

        {/* Actions */}
        {pr.state === 'OPEN' && (
          <div className="flex items-center gap-2 mt-4">
            <Button size="sm" variant="outline" onClick={handleCheckout}>
              <Download className="w-4 h-4 mr-1" />
              Checkout
            </Button>
            <Button size="sm" variant="destructive" onClick={handleClose}>
              <X className="w-4 h-4 mr-1" />
              Fechar
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
        <TabsList className="px-4 justify-start">
          <TabsTrigger value="overview">Visao Geral</TabsTrigger>
          <TabsTrigger value="files">Arquivos ({files?.length || 0})</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Description */}
              {pr.body && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Descricao</h4>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded">
                    {pr.body}
                  </div>
                </div>
              )}

              {/* Reviews */}
              <div>
                <h4 className="text-sm font-medium mb-2">Reviews ({reviews?.length || 0})</h4>
                {reviews && reviews.length > 0 ? (
                  <div className="space-y-2">
                    {reviews.map((review) => (
                      <div
                        key={review.id}
                        className="flex items-start gap-2 p-2 bg-muted/50 rounded"
                      >
                        {review.state === 'APPROVED' && (
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        )}
                        {review.state === 'CHANGES_REQUESTED' && (
                          <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
                        )}
                        {review.state === 'COMMENTED' && (
                          <Eye className="w-4 h-4 text-muted-foreground mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{review.author}</div>
                          {review.body && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {review.body}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Nenhum review ainda</div>
                )}
              </div>

              {/* Comments */}
              <div>
                <h4 className="text-sm font-medium mb-2">Comentarios ({comments?.length || 0})</h4>
                {comments && comments.length > 0 ? (
                  <div className="space-y-2">
                    {comments.map((comment) => (
                      <div key={comment.id} className="p-2 bg-muted/50 rounded">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{comment.author}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                        <div className="text-sm mt-1">{comment.body}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Nenhum comentario</div>
                )}

                {/* Add comment */}
                <div className="mt-3 space-y-2">
                  <Textarea
                    placeholder="Adicionar comentario..."
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    rows={2}
                  />
                  <Button
                    size="sm"
                    onClick={handleComment}
                    disabled={!commentBody.trim() || commentPR.isPending}
                  >
                    {commentPR.isPending ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <MessageSquare className="w-4 h-4 mr-1" />
                    )}
                    Comentar
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="files" className="flex-1 overflow-hidden mt-0">
          <div className="h-full flex">
            {/* File list */}
            <div className="w-72 border-r border-border flex flex-col">
              <ScrollArea className="flex-1">
                <div className="p-2">
                  {files && files.length > 0 ? (
                    <div className="space-y-0.5">
                      {files.map((file) => (
                        <div
                          key={file.filename}
                          className={cn(
                            'flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted',
                            selectedFile === file.filename && 'bg-muted'
                          )}
                          onClick={() => setSelectedFile(file.filename)}
                        >
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate flex-1" title={file.filename}>
                            {file.filename.split('/').pop()}
                          </span>
                          <span className="text-xs text-green-500 shrink-0">+{file.additions}</span>
                          <span className="text-xs text-red-500 shrink-0">-{file.deletions}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      Nenhum arquivo alterado
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Diff viewer */}
            <div className="flex-1 flex flex-col min-w-0">
              {selectedFile ? (
                <>
                  <div className="px-4 py-2 border-b border-border bg-muted/30">
                    <span className="text-sm font-mono">{selectedFile}</span>
                  </div>
                  <ScrollArea className="flex-1">
                    {diffLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : diff ? (
                      <FileDiffView diff={diff} filename={selectedFile} />
                    ) : (
                      <div className="text-sm text-muted-foreground text-center py-8">
                        Diff não disponível
                      </div>
                    )}
                  </ScrollArea>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Selecione um arquivo para ver as alterações
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="review" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {pr.state === 'OPEN' ? (
                <>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Enviar Review</h4>
                    <Textarea
                      placeholder="Comentario do review (opcional)"
                      value={reviewBody}
                      onChange={(e) => setReviewBody(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReview('comment')}
                        disabled={reviewPR.isPending}
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Comentar
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleReview('approve')}
                        disabled={reviewPR.isPending}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReview('request-changes')}
                        disabled={reviewPR.isPending}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Solicitar Alteracoes
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <h4 className="text-sm font-medium mb-2">Merge</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm text-muted-foreground">Metodo de merge</label>
                        <select
                          value={mergeMethod}
                          onChange={(e) =>
                            setMergeMethod(e.target.value as 'merge' | 'squash' | 'rebase')
                          }
                          className="w-full mt-1 bg-background border border-border rounded px-3 py-2 text-sm"
                        >
                          <option value="squash">Squash and merge</option>
                          <option value="merge">Create a merge commit</option>
                          <option value="rebase">Rebase and merge</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="deleteBranch"
                          checked={deleteBranchOnMerge}
                          onCheckedChange={(checked) => setDeleteBranchOnMerge(checked === true)}
                        />
                        <label htmlFor="deleteBranch" className="text-sm">
                          Deletar branch apos merge
                        </label>
                      </div>
                      <Button
                        className="w-full bg-purple-600 hover:bg-purple-700"
                        onClick={handleMerge}
                        disabled={mergePR.isPending || pr.mergeable === false}
                      >
                        {mergePR.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <GitMerge className="w-4 h-4 mr-2" />
                        )}
                        Merge Pull Request
                      </Button>
                      {pr.mergeable === false && (
                        <div className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Este PR tem conflitos que precisam ser resolvidos
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  Este PR esta {pr.state === 'MERGED' ? 'merged' : 'fechado'}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function PullRequestManager() {
  const { data: ghCliOk, isLoading: checkingCli } = useGitHubCliStatus();
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [selectedPR, setSelectedPR] = useState<number | null>(null);

  const { data: pullRequests, isLoading, refetch } = usePullRequests(filter);

  if (checkingCli) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ghCliOk) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
        <h2 className="text-lg font-semibold mb-2">GitHub CLI nao configurado</h2>
        <p className="text-muted-foreground mb-4 max-w-md">
          Para gerenciar Pull Requests, voce precisa instalar e configurar o GitHub CLI (gh).
        </p>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>1. Instale o GitHub CLI:</p>
          <code className="block bg-muted px-3 py-2 rounded">
            winget install GitHub.cli
          </code>
          <p className="mt-2">2. Faca login:</p>
          <code className="block bg-muted px-3 py-2 rounded">gh auth login</code>
        </div>
        <Button className="mt-6" onClick={() => window.location.reload()}>
          Verificar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* PR List */}
      <div className="w-80 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Pull Requests</h2>
            <CreatePRDialog onSuccess={() => refetch()} />
          </div>
          <div className="flex gap-1">
            {(['open', 'closed', 'all'] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? 'secondary' : 'ghost'}
                onClick={() => setFilter(f)}
                className="text-xs"
              >
                {f === 'open' ? 'Abertos' : f === 'closed' ? 'Fechados' : 'Todos'}
              </Button>
            ))}
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : pullRequests && pullRequests.length > 0 ? (
            pullRequests.map((pr) => (
              <PRListItem
                key={pr.number}
                pr={pr}
                isSelected={selectedPR === pr.number}
                onClick={() => setSelectedPR(pr.number)}
              />
            ))
          ) : (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Nenhum PR encontrado
            </div>
          )}
        </ScrollArea>
      </div>

      {/* PR Details */}
      <div className="flex-1">
        {selectedPR ? (
          <PRDetails number={selectedPR} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Selecione um PR para ver detalhes
          </div>
        )}
      </div>
    </div>
  );
}
