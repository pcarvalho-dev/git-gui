import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  useDraggable,
} from '@dnd-kit/core';
import {
  useIssues,
  useIssue,
  useIssueComments,
  useGitHubProjects,
  useCreateIssue,
  useEditIssue,
  useCloseIssue,
  useReopenIssue,
  useAddIssueComment,
  useGitHubCliStatus,
  useLabels,
  useCreateLabel,
  useMilestones,
  useCollaborators,
  useEditIssueComment,
  useDeleteIssueComment,
  useEditLabel,
  useDeleteLabel,
  useCreateMilestone,
  useEditMilestone,
  useDeleteMilestone,
  useLockIssue,
  useUnlockIssue,
  useIssueTimeline,
  useIssueReactions,
  useAddIssueReaction,
  useCommentReactions,
  useAddCommentReaction,
  useIssueTemplates,
  useRepoInfo,
} from '@/hooks/useGit';
import { getErrorMessage } from '@/lib/error';
import { useRepoStore } from '@/stores/repoStore';
import { useToast } from '@/components/ui/use-toast';
import ActionMenu from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
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
import { cn } from '@/lib/utils';
import type { Issue, IssueLabel, IssueMilestone, GitHubProject, IssueTemplate } from '@/types';
import {
  CircleDot,
  CheckCircle,
  Plus,
  Search,
  MessageSquare,
  Loader2,
  RefreshCw,
  ChevronDown,
  Check,
  FolderKanban,
  ExternalLink,
  Send,
  AlertCircle,
  Tag,
  Milestone,
  User,
  X,
  Palette,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  LayoutGrid,
  List,
  ArrowUpDown,
  Settings,
  Eye,
  Clock,
  Bookmark,
  RotateCcw,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return 'ontem';
  if (diffDays < 7) return `${diffDays} dias atrás`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} sem atrás`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} meses atrás`;
  return date.toLocaleDateString('pt-BR');
}

function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '').padEnd(6, '0');
  const r = parseInt(hex.slice(0, 2), 16) || 0;
  const g = parseInt(hex.slice(2, 4), 16) || 0;
  const b = parseInt(hex.slice(4, 6), 16) || 0;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

function getAvatarUrl(login: string): string {
  return `https://github.com/${login}.png?size=32`;
}

// Sorting
type SortOption = 'newest' | 'oldest' | 'most-commented' | 'recently-updated' | 'least-updated';

function sortIssues(issues: Issue[], sort: SortOption): Issue[] {
  const arr = [...issues];
  switch (sort) {
    case 'newest':
      return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case 'oldest':
      return arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    case 'most-commented':
      return arr.sort((a, b) => b.comments_count - a.comments_count);
    case 'recently-updated':
      return arr.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    case 'least-updated':
      return arr.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
    default:
      return arr;
  }
}

// ─── Small UI Components ───────────────────

function IssueStateBadge({ state, locked }: { state: string; locked?: boolean }) {
  const isOpen = state === 'OPEN';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        isOpen
          ? 'bg-green-500/15 text-green-400'
          : 'bg-purple-500/15 text-purple-400'
      )}
    >
      {isOpen ? <CircleDot className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
      {isOpen ? 'Aberta' : 'Fechada'}
      {locked && <Lock className="w-3 h-3 ml-0.5" />}
    </span>
  );
}

function LabelBadge({ label, onRemove }: { label: IssueLabel; onRemove?: () => void }) {
  const bg = label.color ? `#${label.color.replace('#', '')}` : '#888';
  const textColor = getContrastColor(label.color || '888888');
  return (
    <span
      style={{ backgroundColor: bg, color: textColor }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
    >
      {label.name}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 hover:opacity-70">
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}

function UserAvatar({ login, size = 20 }: { login: string; size?: number }) {
  return (
    <img
      src={getAvatarUrl(login)}
      alt={login}
      width={size}
      height={size}
      className="rounded-full object-cover"
      onError={e => {
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}

// Markdown renderer
function MarkdownBody({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn('prose prose-invert prose-sm max-w-none text-sm', className)}
      style={{
        color: 'inherit',
        lineHeight: '1.6',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:underline">{children}</a>
          ),
          code: ({ className: cls, children, ...props }) => {
            const isInline = !cls;
            return isInline ? (
              <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props}>
                {children}
              </code>
            ) : (
              <code className={cn('block bg-muted p-3 rounded text-xs font-mono overflow-x-auto', cls)} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="bg-muted p-3 rounded overflow-x-auto mb-2">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-border pl-3 text-muted-foreground my-2">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
          h1: ({ children }) => <h1 className="text-base font-bold my-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold my-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold my-1">{children}</h3>,
          p: ({ children }) => <p className="my-1">{children}</p>,
          hr: () => <hr className="border-border my-3" />,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="text-xs border-collapse w-full">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-2 py-1 bg-muted text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2 py-1">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Reaction emoji map
const REACTION_EMOJIS: Record<string, string> = {
  '+1': '👍',
  '-1': '👎',
  'laugh': '😄',
  'hooray': '🎉',
  'confused': '😕',
  'heart': '❤️',
  'rocket': '🚀',
  'eyes': '👀',
};

function ReactionBar({
  reactions,
  onAdd,
}: {
  reactions: Record<string, unknown>[];
  onAdd: (content: string) => void;
}) {
  const counts: Record<string, number> = {};
  for (const r of reactions) {
    const content = r.content as string;
    if (content) {
      counts[content] = (counts[content] || 0) + 1;
    }
  }

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {Object.entries(REACTION_EMOJIS).map(([key, emoji]) => {
        const count = counts[key] || 0;
        return (
          <button
            key={key}
            onClick={() => onAdd(key)}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-border hover:bg-muted transition-colors',
              count > 0 && 'bg-muted border-foreground/20'
            )}
            title={key}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="text-muted-foreground">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── PRESET LABEL COLORS ──────────────────

const PRESET_COLORS = [
  'd73a4a', '0075ca', 'cfd3d7', 'e4e669', '0e8a16', 'e99695',
  'f9d0c4', 'fef2c0', 'c2e0c6', 'bfd4f2', 'd4c5f9', 'b60205',
  'd93f0b', 'fbca04', '0e8a16', '006b75', '1d76db', '0052cc',
  '5319e7', 'e11d48', '7c3aed', '1d4ed8', '0891b2', '059669',
];

// ─── Label Picker ─────────────────────────

function LabelPicker({
  selected,
  onChange,
}: {
  selected: IssueLabel[];
  onChange: (labels: IssueLabel[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('0075ca');
  const [newDesc, setNewDesc] = useState('');

  const { data: allLabels = [], refetch } = useLabels();
  const createLabel = useCreateLabel();
  const { toast } = useToast();

  const filtered = allLabels.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  const isSelected = (l: IssueLabel) => selected.some(s => s.name === l.name);

  const toggle = (l: IssueLabel) => {
    if (isSelected(l)) {
      onChange(selected.filter(s => s.name !== l.name));
    } else {
      onChange([...selected, l]);
    }
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createLabel.mutate(
      { name: newName.trim(), color: newColor, description: newDesc.trim() || undefined },
      {
        onSuccess: (created) => {
          onChange([...selected, created]);
          setCreating(false);
          setNewName('');
          setNewDesc('');
          refetch();
        },
        onError: (err) => {
          toast({ title: 'Erro ao criar label', description: getErrorMessage(err), variant: 'destructive' });
        },
      }
    );
  };

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) { setCreating(false); setSearch(''); } }}>
      <PopoverTrigger asChild>
        <button className="flex items-center justify-between w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors py-1 group">
          <span className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            {selected.length === 0 ? 'Labels' : `${selected.length} label${selected.length > 1 ? 's' : ''}`}
          </span>
          <ChevronDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        {!creating ? (
          <>
            <Input
              placeholder="Filtrar labels..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-7 text-xs mb-2"
            />
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  {allLabels.length === 0 ? 'Nenhuma label no repositório' : 'Nenhuma label encontrada'}
                </p>
              ) : (
                filtered.map(l => (
                  <button
                    key={l.name}
                    onClick={() => toggle(l)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-sm"
                  >
                    <Check className={cn('w-3.5 h-3.5 shrink-0', !isSelected(l) && 'opacity-0')} />
                    <LabelBadge label={l} />
                    {l.description && (
                      <span className="text-xs text-muted-foreground truncate flex-1">{l.description}</span>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-border mt-2 pt-2">
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full px-1 py-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Criar nova label
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold">Nova Label</p>
            <Input
              placeholder="Nome da label *"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="h-7 text-xs"
            />
            <Input
              placeholder="Descrição (opcional)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="h-7 text-xs"
            />
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Palette className="w-3 h-3" /> Cor</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    style={{ backgroundColor: `#${c}` }}
                    className={cn(
                      'w-5 h-5 rounded-full transition-transform',
                      newColor === c && 'ring-2 ring-offset-1 ring-foreground scale-110'
                    )}
                  />
                ))}
              </div>
              <Input
                placeholder="Hex (ex: ff5733)"
                value={newColor}
                onChange={e => setNewColor(e.target.value.replace('#', ''))}
                className="h-7 text-xs font-mono"
              />
              {newName && (
                <div className="flex items-center gap-1 text-xs">
                  Prévia: <LabelBadge label={{ name: newName, color: newColor, description: null }} />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="flex-1 h-7 text-xs"
                disabled={!newName.trim() || createLabel.isPending}
                onClick={handleCreate}
              >
                {createLabel.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Criar'}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Manage Labels Dialog ──────────────────

function ManageLabelsDialog() {
  const [open, setOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<IssueLabel | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const { data: labels = [], refetch } = useLabels();
  const editLabelMutation = useEditLabel();
  const deleteLabelMutation = useDeleteLabel();
  const { toast } = useToast();

  const startEdit = (l: IssueLabel) => {
    setEditingLabel(l);
    setEditName(l.name);
    setEditColor(l.color);
    setEditDesc(l.description ?? '');
  };

  const saveEdit = () => {
    if (!editingLabel || !editName.trim()) return;
    editLabelMutation.mutate(
      { oldName: editingLabel.name, newName: editName.trim(), color: editColor, description: editDesc },
      {
        onSuccess: () => {
          toast({ title: 'Label atualizada' });
          setEditingLabel(null);
          refetch();
        },
        onError: (err) => toast({ title: 'Erro ao editar label', description: getErrorMessage(err), variant: 'destructive' }),
      }
    );
  };

  const handleDelete = (name: string) => {
    if (!confirm(`Deletar label "${name}"?`)) return;
    deleteLabelMutation.mutate(name, {
      onSuccess: () => {
        toast({ title: 'Label deletada' });
        refetch();
      },
      onError: (err) => toast({ title: 'Erro ao deletar label', description: getErrorMessage(err), variant: 'destructive' }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-1 py-1 w-full">
          <Settings className="w-3.5 h-3.5" />
          Gerenciar Labels
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar Labels</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2 pr-3">
            {labels.map(l => (
              <div key={l.name} className="border border-border rounded-lg p-3">
                {editingLabel?.name === l.name ? (
                  <div className="space-y-2">
                    <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome" className="h-7 text-xs" />
                    <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Descrição" className="h-7 text-xs" />
                    <Input value={editColor} onChange={e => setEditColor(e.target.value.replace('#', ''))} placeholder="Cor hex" className="h-7 text-xs font-mono" />
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setEditColor(c)}
                          style={{ backgroundColor: `#${c}` }}
                          className={cn(
                            'w-4 h-4 rounded-full transition-transform',
                            editColor === c && 'ring-2 ring-offset-1 ring-foreground scale-110'
                          )}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingLabel(null)}>Cancelar</Button>
                      <Button size="sm" className="h-7 text-xs" onClick={saveEdit} disabled={editLabelMutation.isPending}>
                        {editLabelMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <LabelBadge label={l} />
                    {l.description && <span className="text-xs text-muted-foreground flex-1 truncate">{l.description}</span>}
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(l)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDelete(l.name)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Manage Milestones Dialog ─────────────

function ManageMilestonesDialog() {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingMs, setEditingMs] = useState<IssueMilestone | null>(null);
  const [form, setForm] = useState({ title: '', description: '', dueOn: '' });

  const { data: milestones = [], refetch } = useMilestones();
  const createMs = useCreateMilestone();
  const editMs = useEditMilestone();
  const deleteMs = useDeleteMilestone();
  const { toast } = useToast();

  const resetForm = () => setForm({ title: '', description: '', dueOn: '' });

  const startCreate = () => {
    resetForm();
    setEditingMs(null);
    setCreating(true);
  };

  const startEdit = (m: IssueMilestone) => {
    setCreating(false);
    setEditingMs(m);
    setForm({
      title: m.title,
      description: m.description ?? '',
      dueOn: m.due_on ? m.due_on.split('T')[0] : '',
    });
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    if (editingMs) {
      editMs.mutate(
        { number: editingMs.number, title: form.title, description: form.description || undefined, dueOn: form.dueOn || undefined },
        {
          onSuccess: () => { toast({ title: 'Milestone atualizada' }); setEditingMs(null); refetch(); },
          onError: (err) => toast({ title: 'Erro ao editar milestone', description: getErrorMessage(err), variant: 'destructive' }),
        }
      );
    } else {
      createMs.mutate(
        { title: form.title, description: form.description || undefined, dueOn: form.dueOn || undefined },
        {
          onSuccess: () => { toast({ title: 'Milestone criada' }); setCreating(false); resetForm(); refetch(); },
          onError: (err) => toast({ title: 'Erro ao criar milestone', description: getErrorMessage(err), variant: 'destructive' }),
        }
      );
    }
  };

  const handleToggleState = (m: IssueMilestone) => {
    const newState = m.state === 'open' ? 'closed' : 'open';
    editMs.mutate(
      { number: m.number, title: m.title, milestoneState: newState },
      {
        onSuccess: () => { toast({ title: `Milestone ${newState === 'open' ? 'reaberta' : 'fechada'}` }); refetch(); },
        onError: (err) => toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' }),
      }
    );
  };

  const handleDelete = (m: IssueMilestone) => {
    if (!confirm(`Deletar milestone "${m.title}"?`)) return;
    deleteMs.mutate(m.number, {
      onSuccess: () => { toast({ title: 'Milestone deletada' }); refetch(); },
      onError: (err) => toast({ title: 'Erro ao deletar', description: getErrorMessage(err), variant: 'destructive' }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-1 py-1 w-full">
          <Settings className="w-3.5 h-3.5" />
          Gerenciar Milestones
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Milestones</DialogTitle>
        </DialogHeader>
        {(creating || editingMs) && (
          <div className="border border-border rounded-lg p-3 space-y-2 mb-3">
            <p className="text-xs font-semibold">{editingMs ? 'Editar Milestone' : 'Nova Milestone'}</p>
            <Input placeholder="Título *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-7 text-xs" />
            <Textarea placeholder="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="text-xs resize-none" />
            <div>
              <label className="text-xs text-muted-foreground">Prazo (opcional)</label>
              <Input type="date" value={form.dueOn} onChange={e => setForm(f => ({ ...f, dueOn: e.target.value }))} className="h-7 text-xs mt-1" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCreating(false); setEditingMs(null); resetForm(); }}>Cancelar</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={!form.title.trim() || createMs.isPending || editMs.isPending}>
                {(createMs.isPending || editMs.isPending) ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </div>
        )}
        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-2 pr-3">
            {milestones.map(m => (
              <div key={m.number} className="border border-border rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{m.title}</span>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full', m.state === 'open' ? 'bg-green-500/15 text-green-400' : 'bg-muted text-muted-foreground')}>
                        {m.state === 'open' ? 'Aberta' : 'Fechada'}
                      </span>
                    </div>
                    {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
                    {m.due_on && <p className="text-xs text-muted-foreground mt-0.5">Prazo: {new Date(m.due_on).toLocaleDateString('pt-BR')}</p>}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{m.open_issues} abertas</span>
                      <span>·</span>
                      <span>{m.closed_issues} fechadas</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(m)} title="Editar">
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleToggleState(m)} title={m.state === 'open' ? 'Fechar' : 'Reabrir'}>
                      {m.state === 'open' ? <CheckCircle className="w-3 h-3" /> : <CircleDot className="w-3 h-3" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDelete(m)} title="Deletar">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        {!creating && !editingMs && (
          <Button size="sm" variant="outline" onClick={startCreate} className="mt-2 gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Nova Milestone
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Assignee Picker ──────────────────────

function AssigneePicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (assignees: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: collaborators = [] } = useCollaborators();

  const filtered = collaborators.filter(c =>
    c.login.toLowerCase().includes(search.toLowerCase())
  );

  const isSelected = (login: string) => selected.includes(login);

  const toggle = (login: string) => {
    if (isSelected(login)) {
      onChange(selected.filter(a => a !== login));
    } else {
      onChange([...selected, login]);
    }
  };

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) setSearch(''); }}>
      <PopoverTrigger asChild>
        <button className="flex items-center justify-between w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors py-1 group">
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {selected.length === 0 ? 'Assignees' : selected.join(', ')}
          </span>
          <ChevronDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <Input
          placeholder="Buscar usuário..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-7 text-xs mb-2"
        />
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              {collaborators.length === 0 ? 'Nenhum colaborador encontrado' : 'Nenhum resultado'}
            </p>
          ) : (
            filtered.map(c => (
              <button
                key={c.login}
                onClick={() => toggle(c.login)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-sm"
              >
                <Check className={cn('w-3.5 h-3.5 shrink-0', !isSelected(c.login) && 'opacity-0')} />
                <UserAvatar login={c.login} size={18} />
                <span>{c.login}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Milestone Picker ─────────────────────

function MilestonePicker({
  selected,
  onChange,
}: {
  selected: IssueMilestone | null;
  onChange: (m: IssueMilestone | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: milestones = [] } = useMilestones();
  const open_milestones = milestones.filter(m => m.state === 'open');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center justify-between w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors py-1 group">
          <span className="flex items-center gap-1.5">
            <Milestone className="w-3.5 h-3.5" />
            {selected ? selected.title : 'Milestone'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <div
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-muted',
            !selected && 'font-medium'
          )}
          onClick={() => { onChange(null); setOpen(false); }}
        >
          <Check className={cn('w-3.5 h-3.5', selected && 'opacity-0')} />
          Sem milestone
        </div>
        {open_milestones.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Nenhuma milestone aberta</p>
        ) : (
          open_milestones.map(m => {
            const total = m.open_issues + m.closed_issues;
            const pct = total > 0 ? Math.round((m.closed_issues / total) * 100) : 0;
            return (
              <div
                key={m.number}
                className={cn(
                  'px-2 py-1.5 rounded cursor-pointer hover:bg-muted',
                  selected?.number === m.number && 'bg-muted'
                )}
                onClick={() => { onChange(m); setOpen(false); }}
              >
                <div className="flex items-center gap-2">
                  <Check className={cn('w-3.5 h-3.5 shrink-0', selected?.number !== m.number && 'opacity-0')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.title}</p>
                    {total > 0 && (
                      <div className="mt-1">
                        <div className="h-1 rounded-full bg-muted-foreground/20 overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{pct}% completo</p>
                      </div>
                    )}
                    {m.due_on && (
                      <p className="text-xs text-muted-foreground">
                        Prazo: {new Date(m.due_on).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Project Picker ───────────────────────

function ProjectPicker({
  selected,
  onChange,
}: {
  selected: GitHubProject | null;
  onChange: (p: GitHubProject | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: projects = [] } = useGitHubProjects();
  const activeProjects = projects.filter(p => !p.closed);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center justify-between w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors py-1 group">
          <span className="flex items-center gap-1.5">
            <FolderKanban className="w-3.5 h-3.5" />
            {selected ? selected.title : 'Projects'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-muted',
            !selected && 'font-medium'
          )}
          onClick={() => { onChange(null); setOpen(false); }}
        >
          <Check className={cn('w-3.5 h-3.5', selected && 'opacity-0')} />
          Nenhum projeto
        </div>
        {activeProjects.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Nenhum projeto ativo</p>
        ) : (
          activeProjects.map(p => (
            <div
              key={p.number}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm',
                selected?.number === p.number && 'bg-muted'
              )}
              onClick={() => { onChange(p); setOpen(false); }}
            >
              <Check className={cn('w-3.5 h-3.5 shrink-0', selected?.number !== p.number && 'opacity-0')} />
              <span className="truncate flex-1">{p.title}</span>
              <span className="text-xs text-muted-foreground">#{p.number}</span>
            </div>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Issue Template Picker ─────────────────

function IssueTemplatePicker({
  templates,
  isLoading,
  onSelect,
}: {
  templates: IssueTemplate[];
  isLoading: boolean;
  onSelect: (template: IssueTemplate | null) => void;
}) {
  if (isLoading || templates.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Escolha um template ou crie uma issue em branco:</p>
      <div className="grid grid-cols-1 gap-2">
        {templates.map(t => (
          <button
            key={t.name}
            onClick={() => onSelect(t)}
            className="text-left border border-border rounded-lg p-3 hover:bg-muted transition-colors"
          >
            <p className="text-sm font-medium">{t.name}</p>
            {t.about && <p className="text-xs text-muted-foreground mt-0.5">{t.about}</p>}
          </button>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={() => onSelect(null)} className="w-full">
        Issue em branco
      </Button>
    </div>
  );
}

// ─── Create Issue Dialog ───────────────────

function CreateIssueDialog({
  onCreated,
  triggerClassName,
}: {
  onCreated: () => void;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'template' | 'form'>('template');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [bodyPreview, setBodyPreview] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<IssueLabel[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedMilestone, setSelectedMilestone] = useState<IssueMilestone | null>(null);
  const [selectedProject, setSelectedProject] = useState<GitHubProject | null>(null);

  const createIssue = useCreateIssue();
  const { data: templates = [], isLoading: templatesLoading } = useIssueTemplates();
  const { toast } = useToast();

  useEffect(() => {
    if (open && step === 'template' && !templatesLoading && templates.length === 0) {
      setStep('form');
    }
  }, [open, step, templatesLoading, templates.length]);

  const reset = () => {
    setTitle('');
    setBody('');
    setBodyPreview(false);
    setSelectedLabels([]);
    setSelectedAssignees([]);
    setSelectedMilestone(null);
    setSelectedProject(null);
    setStep(templates.length > 0 ? 'template' : 'form');
  };

  const handleTemplateSelect = (t: IssueTemplate | null) => {
    if (t) {
      setTitle(t.title);
      setBody(t.body);
    }
    setStep('form');
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    createIssue.mutate(
      {
        title: title.trim(),
        body: body.trim() || undefined,
        labels: selectedLabels.map(l => l.name),
        assignees: selectedAssignees,
        milestone: selectedMilestone?.title,
        project: selectedProject?.number,
      },
      {
        onSuccess: (issue) => {
          toast({ title: 'Issue criada', description: `#${issue.number} "${issue.title}"` });
          reset();
          setOpen(false);
          onCreated();
        },
        onError: (err) => {
          toast({ title: 'Erro ao criar issue', description: getErrorMessage(err), variant: 'destructive' });
        },
      }
    );
  };

  const handleOpen = (o: boolean) => {
    setOpen(o);
    if (!o) reset();
    else {
      setStep(templates.length > 0 ? 'template' : 'form');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className={cn('gap-1.5', triggerClassName)}>
          <Plus className="w-4 h-4" />
          Nova Issue
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{step === 'template' ? 'Escolher Template' : 'Nova Issue'}</DialogTitle>
        </DialogHeader>
        {step === 'template' ? (
          <IssueTemplatePicker templates={templates} isLoading={templatesLoading} onSelect={handleTemplateSelect} />
        ) : (
          <div className="flex gap-4 mt-2">
            {/* Main form */}
            <div className="flex-1 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Título *</label>
                <Input
                  placeholder="Título da issue..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Descrição</label>
                  <div className="flex gap-1">
                    <Button size="sm" variant={!bodyPreview ? 'secondary' : 'ghost'} className="h-6 px-2 text-xs" onClick={() => setBodyPreview(false)}>
                      <Pencil className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                    <Button size="sm" variant={bodyPreview ? 'secondary' : 'ghost'} className="h-6 px-2 text-xs" onClick={() => setBodyPreview(true)}>
                      <Eye className="w-3 h-3 mr-1" />
                      Preview
                    </Button>
                  </div>
                </div>
                {bodyPreview ? (
                  <div className="min-h-[180px] border border-border rounded-md p-3 bg-background">
                    {body ? <MarkdownBody content={body} /> : <p className="text-sm text-muted-foreground italic">Sem conteúdo</p>}
                  </div>
                ) : (
                  <Textarea
                    placeholder="Descreva a issue em detalhes... (Markdown suportado)"
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={8}
                    className="resize-none font-mono text-sm"
                  />
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleSubmit} disabled={!title.trim() || createIssue.isPending}>
                  {createIssue.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Criar Issue
                </Button>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="w-48 shrink-0 space-y-1 border-l border-border pl-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Detalhes</p>

              <div className="space-y-1 divide-y divide-border">
                <div className="pb-2">
                  <LabelPicker selected={selectedLabels} onChange={setSelectedLabels} />
                  {selectedLabels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {selectedLabels.map(l => (
                        <LabelBadge
                          key={l.name}
                          label={l}
                          onRemove={() => setSelectedLabels(selectedLabels.filter(s => s.name !== l.name))}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="py-2">
                  <AssigneePicker selected={selectedAssignees} onChange={setSelectedAssignees} />
                  {selectedAssignees.length > 0 && (
                    <div className="flex flex-col gap-1 mt-1.5">
                      {selectedAssignees.map(a => (
                        <div key={a} className="flex items-center gap-1.5 text-xs">
                          <UserAvatar login={a} size={16} />
                          <span>{a}</span>
                          <button
                            onClick={() => setSelectedAssignees(selectedAssignees.filter(x => x !== a))}
                            className="ml-auto text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="py-2">
                  <MilestonePicker selected={selectedMilestone} onChange={setSelectedMilestone} />
                  {selectedMilestone && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{selectedMilestone.title}</p>
                  )}
                </div>

                <div className="py-2">
                  <ProjectPicker selected={selectedProject} onChange={setSelectedProject} />
                  {selectedProject && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{selectedProject.title}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Issue List Item ───────────────────────

function IssueListItem({
  issue,
  selected,
  onClick,
  checked,
  onCheck,
  showCheckbox,
}: {
  issue: Issue;
  selected: boolean;
  onClick: () => void;
  checked?: boolean;
  onCheck?: (v: boolean) => void;
  showCheckbox?: boolean;
}) {
  const closeIssue = useCloseIssue();
  const reopenIssue = useReopenIssue();
  const { toast } = useToast();

  const handleClose = () => {
    closeIssue.mutate(issue.number, {
      onSuccess: () => toast({ title: 'Issue fechada' }),
      onError: (err) =>
        toast({
          title: 'Erro ao fechar issue',
          description: getErrorMessage(err),
          variant: 'destructive',
        }),
    });
  };

  const handleReopen = () => {
    reopenIssue.mutate(issue.number, {
      onSuccess: () => toast({ title: 'Issue reaberta' }),
      onError: (err) =>
        toast({
          title: 'Erro ao reabrir issue',
          description: getErrorMessage(err),
          variant: 'destructive',
        }),
    });
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-3 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors group',
        selected && 'bg-muted'
      )}
    >
      <div className="flex items-start gap-2">
        {showCheckbox && (
          <div
            className="mt-0.5 shrink-0"
            onClick={e => { e.stopPropagation(); onCheck?.(!checked); }}
          >
            <div className={cn(
              'w-4 h-4 rounded border-2 border-border flex items-center justify-center transition-colors',
              checked ? 'bg-primary border-primary' : 'opacity-0 group-hover:opacity-100'
            )}>
              {checked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
            </div>
          </div>
        )}
        <div className="mt-0.5 shrink-0">
          {issue.state === 'OPEN'
            ? <CircleDot className="w-4 h-4 text-green-400" />
            : <CheckCircle className="w-4 h-4 text-purple-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-medium leading-snug">{issue.title}</p>
            {issue.locked && <Lock className="w-3 h-3 text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            #{issue.number} · {issue.author} · {formatDate(issue.updated_at)}
            {issue.milestone_title && (
              <span className="ml-1 text-blue-400">· {issue.milestone_title}</span>
            )}
          </p>
          {issue.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {issue.labels.slice(0, 4).map(l => (
                <LabelBadge key={l.name} label={l} />
              ))}
              {issue.labels.length > 4 && (
                <span className="text-xs text-muted-foreground">+{issue.labels.length - 4}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {issue.comments_count > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="w-3 h-3" />
              {issue.comments_count}
            </div>
          )}
          {issue.assignees.length > 0 && (
            <div className="flex -space-x-1">
              {issue.assignees.slice(0, 3).map(a => (
                <UserAvatar key={a} login={a} size={16} />
              ))}
            </div>
          )}
          <ActionMenu
            title={`Acoes da issue #${issue.number}`}
            items={[
              {
                label: 'Abrir no GitHub',
                icon: ExternalLink,
                onSelect: () => window.open(issue.url, '_blank', 'noopener,noreferrer'),
              },
              ...(issue.state === 'OPEN'
                ? [
                    {
                      label: 'Fechar issue',
                      icon: X,
                      onSelect: handleClose,
                      destructive: true,
                      separatorBefore: true,
                    },
                  ]
                : [
                    {
                      label: 'Reabrir issue',
                      icon: RotateCcw,
                      onSelect: handleReopen,
                      separatorBefore: true,
                    },
                  ]),
            ]}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Action Bar ──────────────────────

function BulkActionBar({
  selectedIssues,
  allIssues,
  onClose,
}: {
  selectedIssues: Set<number>;
  allIssues: Issue[];
  onClose: () => void;
}) {
  const closeIssue = useCloseIssue();
  const reopenIssue = useReopenIssue();
  const editIssue = useEditIssue();
  const { data: allLabels = [] } = useLabels();
  const { toast } = useToast();
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);

  const selected = allIssues.filter(i => selectedIssues.has(i.number));
  const count = selected.length;

  const handleBulkClose = async () => {
    await Promise.all(selected.filter(i => i.state === 'OPEN').map(i => closeIssue.mutateAsync(i.number)));
    toast({ title: `${count} issue(s) fechadas` });
    onClose();
  };

  const handleBulkReopen = async () => {
    await Promise.all(selected.filter(i => i.state !== 'OPEN').map(i => reopenIssue.mutateAsync(i.number)));
    toast({ title: `${count} issue(s) reabertas` });
    onClose();
  };

  const handleAddLabel = (labelName: string) => {
    Promise.all(selected.map(i => editIssue.mutateAsync({ number: i.number, addLabels: [labelName], removeLabels: [], addAssignees: [], removeAssignees: [] })));
    toast({ title: `Label adicionada a ${count} issue(s)` });
    setLabelMenuOpen(false);
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-primary/10 border-b border-primary/20 text-xs">
      <span className="font-medium">{count} selecionada{count > 1 ? 's' : ''}</span>
      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={handleBulkClose}>Fechar</Button>
      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={handleBulkReopen}>Reabrir</Button>
      <Popover open={labelMenuOpen} onOpenChange={setLabelMenuOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-6 text-xs gap-1">
            <Tag className="w-3 h-3" />
            Adicionar Label
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1">
          {allLabels.map(l => (
            <button
              key={l.name}
              onClick={() => handleAddLabel(l.name)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-sm"
            >
              <LabelBadge label={l} />
            </button>
          ))}
        </PopoverContent>
      </Popover>
      <Button size="sm" variant="ghost" className="h-6 text-xs ml-auto" onClick={onClose}>
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

// ─── Editable Issue Detail Sidebar ────────

function IssueDetailSidebar({
  issue,
  onUpdated,
}: {
  issue: Issue;
  onUpdated: (updated: Issue) => void;
}) {
  const editIssue = useEditIssue();
  const lockIssue = useLockIssue();
  const unlockIssue = useUnlockIssue();
  const { data: allMilestones = [] } = useMilestones();
  const { toast } = useToast();
  const [lockReasonOpen, setLockReasonOpen] = useState(false);

  const currentMilestone = allMilestones.find(m => m.number === issue.milestone_number) ?? null;

  const handleLabelsChange = (newLabels: IssueLabel[]) => {
    const currentNames = issue.labels.map(l => l.name);
    const newNames = newLabels.map(l => l.name);
    const addLabels = newNames.filter(n => !currentNames.includes(n));
    const removeLabels = currentNames.filter(n => !newNames.includes(n));
    if (addLabels.length === 0 && removeLabels.length === 0) return;

    editIssue.mutate(
      { number: issue.number, addLabels, removeLabels },
      {
        onSuccess: (updated) => onUpdated(updated),
        onError: (err) => toast({ title: 'Erro ao editar labels', description: getErrorMessage(err), variant: 'destructive' }),
      }
    );
  };

  const handleAssigneesChange = (newAssignees: string[]) => {
    const current = issue.assignees;
    const addAssignees = newAssignees.filter(a => !current.includes(a));
    const removeAssignees = current.filter(a => !newAssignees.includes(a));
    if (addAssignees.length === 0 && removeAssignees.length === 0) return;

    editIssue.mutate(
      { number: issue.number, addAssignees, removeAssignees },
      {
        onSuccess: (updated) => onUpdated(updated),
        onError: (err) => toast({ title: 'Erro ao editar assignees', description: getErrorMessage(err), variant: 'destructive' }),
      }
    );
  };

  const handleMilestoneChange = (m: IssueMilestone | null) => {
    editIssue.mutate(
      { number: issue.number, milestone: m?.title ?? '' },
      {
        onSuccess: (updated) => onUpdated(updated),
        onError: (err) => toast({ title: 'Erro ao editar milestone', description: getErrorMessage(err), variant: 'destructive' }),
      }
    );
  };

  const handleLock = (reason: string) => {
    lockIssue.mutate(
      { number: issue.number, lockReason: reason },
      {
        onSuccess: () => { toast({ title: 'Issue bloqueada' }); setLockReasonOpen(false); },
        onError: (err) => toast({ title: 'Erro ao bloquear', description: getErrorMessage(err), variant: 'destructive' }),
      }
    );
  };

  const handleUnlock = () => {
    unlockIssue.mutate(issue.number, {
      onSuccess: () => toast({ title: 'Issue desbloqueada' }),
      onError: (err) => toast({ title: 'Erro ao desbloquear', description: getErrorMessage(err), variant: 'destructive' }),
    });
  };

  const lockReasons = [
    { value: 'off-topic', label: 'Off-topic' },
    { value: 'too heated', label: 'Muito acalorado' },
    { value: 'resolved', label: 'Resolvido' },
    { value: 'spam', label: 'Spam' },
  ];

  return (
    <div className="w-56 shrink-0 border-l border-border p-4 space-y-1">
      {editIssue.isPending && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Salvando...
        </div>
      )}

      <div className="divide-y divide-border space-y-1">
        {/* Labels */}
        <div className="pb-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Labels</h4>
          <LabelPicker selected={issue.labels} onChange={handleLabelsChange} />
          {issue.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {issue.labels.map(l => <LabelBadge key={l.name} label={l} />)}
            </div>
          )}
          {issue.labels.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">Nenhuma</p>
          )}
        </div>

        {/* Assignees */}
        <div className="py-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Assignees</h4>
          <AssigneePicker selected={issue.assignees} onChange={handleAssigneesChange} />
          {issue.assignees.length > 0 ? (
            <div className="space-y-1.5 mt-2">
              {issue.assignees.map(a => (
                <div key={a} className="flex items-center gap-1.5 text-xs">
                  <UserAvatar login={a} size={16} />
                  <span>{a}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Nenhum</p>
          )}
        </div>

        {/* Milestone */}
        <div className="py-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Milestone</h4>
          <MilestonePicker selected={currentMilestone} onChange={handleMilestoneChange} />
          {issue.milestone_title ? (
            <p className="text-xs text-blue-400 mt-1 truncate">{issue.milestone_title}</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Nenhuma</p>
          )}
        </div>

        {/* Lock / Unlock */}
        <div className="py-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Conversa</h4>
          {issue.locked ? (
            <div>
              <div className="flex items-center gap-1.5 text-xs text-orange-400 mb-1.5">
                <Lock className="w-3 h-3" />
                Bloqueada{issue.active_lock_reason ? ` (${issue.active_lock_reason})` : ''}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs w-full gap-1"
                onClick={handleUnlock}
                disabled={unlockIssue.isPending}
              >
                <Unlock className="w-3 h-3" />
                Desbloquear
              </Button>
            </div>
          ) : (
            <Popover open={lockReasonOpen} onOpenChange={setLockReasonOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-6 text-xs w-full gap-1">
                  <Lock className="w-3 h-3" />
                  Bloquear
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                <p className="text-xs font-semibold px-2 py-1 text-muted-foreground">Motivo do bloqueio</p>
                {lockReasons.map(r => (
                  <button
                    key={r.value}
                    onClick={() => handleLock(r.value)}
                    className="flex items-center w-full px-2 py-1.5 rounded hover:bg-muted text-sm"
                  >
                    {r.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Comment with Edit/Delete/Reactions ───

function CommentItem({
  comment,
  issueNumber,
}: {
  comment: { id: number; author: string; body: string; created_at: string };
  issueNumber: number;
}) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState('');
  const [preview, setPreview] = useState(false);

  const editComment = useEditIssueComment();
  const deleteComment = useDeleteIssueComment();
  const { data: reactions = [] } = useCommentReactions(comment.id);
  const addReaction = useAddCommentReaction();
  const { toast } = useToast();

  const startEdit = () => {
    setEditBody(comment.body);
    setEditing(true);
    setPreview(false);
  };

  const saveEdit = () => {
    if (!editBody.trim()) return;
    editComment.mutate(
      { commentId: comment.id, body: editBody, issueNumber },
      {
        onSuccess: () => { setEditing(false); },
        onError: (err) => toast({ title: 'Erro ao editar comentário', description: getErrorMessage(err), variant: 'destructive' }),
      }
    );
  };

  const handleDelete = () => {
    if (!confirm('Deletar este comentário?')) return;
    deleteComment.mutate(
      { commentId: comment.id, issueNumber },
      {
        onSuccess: () => {},
        onError: (err) => toast({ title: 'Erro ao deletar comentário', description: getErrorMessage(err), variant: 'destructive' }),
      }
    );
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-1.5">
          <UserAvatar login={comment.author} size={16} />
          <span className="text-xs font-medium">{comment.author}</span>
          <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
        </div>
        {!editing && (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={startEdit} title="Editar">
              <Pencil className="w-3 h-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={handleDelete} title="Deletar">
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="p-3 space-y-2">
          <div className="flex gap-1 mb-1">
            <Button size="sm" variant={!preview ? 'secondary' : 'ghost'} className="h-6 text-xs" onClick={() => setPreview(false)}>
              <Pencil className="w-3 h-3 mr-1" />Editar
            </Button>
            <Button size="sm" variant={preview ? 'secondary' : 'ghost'} className="h-6 text-xs" onClick={() => setPreview(true)}>
              <Eye className="w-3 h-3 mr-1" />Preview
            </Button>
          </div>
          {preview ? (
            <div className="min-h-[80px] border border-border rounded p-2 bg-background">
              <MarkdownBody content={editBody} />
            </div>
          ) : (
            <Textarea
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              rows={4}
              className="resize-none font-mono text-sm"
              autoFocus
            />
          )}
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button size="sm" onClick={saveEdit} disabled={editComment.isPending || !editBody.trim()}>
              {editComment.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Salvar
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-3">
          <MarkdownBody content={comment.body} />
          <ReactionBar
            reactions={reactions as Record<string, unknown>[]}
            onAdd={(content) => addReaction.mutate({ commentId: comment.id, content })}
          />
        </div>
      )}
    </div>
  );
}

// ─── Timeline Component ────────────────────

function TimelineEvent({ event }: { event: Record<string, unknown> }) {
  const eventType = event.event as string;
  const actor = (event.actor as { login: string; avatar_url?: string } | null);
  const createdAt = (event.created_at as string) || '';

  const getEventText = () => {
    switch (eventType) {
      case 'labeled': {
        const label = event.label as { name: string; color: string } | undefined;
        return <span>adicionou a label <LabelBadge label={{ name: label?.name ?? '', color: label?.color ?? '888', description: null }} /></span>;
      }
      case 'unlabeled': {
        const label = event.label as { name: string; color: string } | undefined;
        return <span>removeu a label <LabelBadge label={{ name: label?.name ?? '', color: label?.color ?? '888', description: null }} /></span>;
      }
      case 'assigned': {
        const assignee = event.assignee as { login: string } | undefined;
        return <span>atribuiu a {assignee?.login}</span>;
      }
      case 'unassigned': {
        const assignee = event.assignee as { login: string } | undefined;
        return <span>removeu {assignee?.login}</span>;
      }
      case 'closed': return <span className="text-purple-400">fechou</span>;
      case 'reopened': return <span className="text-green-400">reabriu</span>;
      case 'locked': return <span>bloqueou a conversa</span>;
      case 'unlocked': return <span>desbloqueou a conversa</span>;
      case 'milestoned': {
        const ms = event.milestone as { title: string } | undefined;
        return <span>adicionou ao milestone <span className="text-blue-400">{ms?.title}</span></span>;
      }
      case 'demilestoned': {
        const ms = event.milestone as { title: string } | undefined;
        return <span>removeu do milestone <span className="text-blue-400">{ms?.title}</span></span>;
      }
      case 'renamed': {
        const rename = event.rename as { from: string; to: string } | undefined;
        return <span>renomeou de <span className="line-through text-muted-foreground">{rename?.from}</span> para <span className="font-medium">{rename?.to}</span></span>;
      }
      default: return <span className="text-muted-foreground">{eventType}</span>;
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {actor ? (
        <UserAvatar login={actor.login} size={14} />
      ) : (
        <div className="w-3.5 h-3.5 rounded-full bg-muted" />
      )}
      <span>
        {actor && <span className="font-medium text-foreground">{actor.login}</span>} {getEventText()}
      </span>
      <span className="ml-auto text-xs">{formatDate(createdAt)}</span>
    </div>
  );
}

// ─── Issue Details ─────────────────────────

function IssueDetails({ issue, onRefresh, onUpdated }: {
  issue: Issue;
  onRefresh: () => void;
  onUpdated: (updated: Issue) => void;
}) {
  const [newComment, setNewComment] = useState('');
  const [newCommentPreview, setNewCommentPreview] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingBody, setEditingBody] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const [bodyEditPreview, setBodyEditPreview] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  const { data: comments, isLoading: loadingComments, refetch: refetchComments } = useIssueComments(issue.number);
  const { data: timeline = [] } = useIssueTimeline(issue.number);
  const { data: reactions = [] } = useIssueReactions(issue.number);
  const addReaction = useAddIssueReaction();
  const closeIssue = useCloseIssue();
  const reopenIssue = useReopenIssue();
  const addComment = useAddIssueComment();
  const editIssue = useEditIssue();
  const { toast } = useToast();

  const handleToggleState = () => {
    const isOpen = issue.state === 'OPEN';
    const action = isOpen ? closeIssue : reopenIssue;
    (action.mutate as (n: number, opts: object) => void)(issue.number, {
      onSuccess: () => {
        toast({ title: isOpen ? 'Issue fechada' : 'Issue reaberta', description: `#${issue.number} ${issue.title}` });
        onRefresh();
      },
      onError: (err: unknown) => {
        toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' });
      },
    });
  };

  const handleComment = () => {
    if (!newComment.trim()) return;
    addComment.mutate(
      { number: issue.number, body: newComment.trim() },
      {
        onSuccess: () => { setNewComment(''); setNewCommentPreview(false); refetchComments(); },
        onError: (err) => toast({ title: 'Erro ao comentar', description: getErrorMessage(err), variant: 'destructive' }),
      }
    );
  };

  const startEditTitle = () => { setTitleDraft(issue.title); setEditingTitle(true); };
  const startEditBody = () => { setBodyDraft(issue.body ?? ''); setEditingBody(true); setBodyEditPreview(false); };

  const saveTitle = () => {
    if (!titleDraft.trim() || titleDraft === issue.title) { setEditingTitle(false); return; }
    editIssue.mutate(
      { number: issue.number, title: titleDraft.trim() },
      {
        onSuccess: (updated) => { setEditingTitle(false); onUpdated(updated); },
        onError: (err) => toast({ title: 'Erro ao editar título', description: getErrorMessage(err), variant: 'destructive' }),
      }
    );
  };

  const saveBody = () => {
    if (bodyDraft === (issue.body ?? '')) { setEditingBody(false); return; }
    editIssue.mutate(
      { number: issue.number, body: bodyDraft },
      {
        onSuccess: (updated) => { setEditingBody(false); onUpdated(updated); },
        onError: (err) => toast({ title: 'Erro ao editar descrição', description: getErrorMessage(err), variant: 'destructive' }),
      }
    );
  };

  // Merge timeline events + comments
  const timelineItems = useMemo(() => {
    if (!showTimeline) return [];
    const events = timeline.filter((e) => {
      const evType = (e as Record<string, unknown>).event as string;
      return evType && evType !== 'commented';
    });
    return events.sort((a, b) => {
      const aTime = new Date((a as Record<string, unknown>).created_at as string).getTime();
      const bTime = new Date((b as Record<string, unknown>).created_at as string).getTime();
      return aTime - bTime;
    });
  }, [timeline, showTimeline]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <IssueStateBadge state={issue.state} locked={issue.locked} />
              <span className="text-xs text-muted-foreground">#{issue.number}</span>
            </div>

            {/* Editable title */}
            {editingTitle ? (
              <div className="flex gap-2 mt-1">
                <Input
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  className="h-8 text-sm font-semibold"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                />
                <Button size="sm" className="h-8 px-2" onClick={saveTitle} disabled={editIssue.isPending}>
                  {editIssue.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salvar'}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditingTitle(false)}>Cancelar</Button>
              </div>
            ) : (
              <h2
                className="text-base font-semibold mt-1 leading-snug cursor-pointer hover:underline group flex items-center gap-1"
                onClick={startEditTitle}
                title="Clique para editar o título"
              >
                {issue.title}
              </h2>
            )}

            <p className="text-xs text-muted-foreground mt-1">
              Aberta por <span className="font-medium">{issue.author}</span> · {formatDate(issue.created_at)} ·{' '}
              <span className="text-foreground">{issue.comments_count} comentário{issue.comments_count !== 1 ? 's' : ''}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className={cn('h-7 text-xs gap-1', showTimeline && 'bg-muted')}
              onClick={() => setShowTimeline(v => !v)}
              title="Timeline de atividades"
            >
              <Clock className="w-3.5 h-3.5" />
            </Button>
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              GitHub
            </a>
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleState}
              disabled={closeIssue.isPending || reopenIssue.isPending}
              className="gap-1.5"
            >
              {(closeIssue.isPending || reopenIssue.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {issue.state === 'OPEN' ? 'Fechar' : 'Reabrir'}
            </Button>
          </div>
        </div>
      </div>

      {/* Body + sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Body */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
                  <div className="flex items-center gap-1.5">
                    <UserAvatar login={issue.author} size={16} />
                    <span className="text-xs font-medium">{issue.author}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(issue.created_at)}</span>
                  </div>
                  {!editingBody && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-muted-foreground"
                      onClick={startEditBody}
                    >
                      Editar
                    </Button>
                  )}
                </div>
                {editingBody ? (
                  <div className="p-3 space-y-2">
                    <div className="flex gap-1 mb-1">
                      <Button size="sm" variant={!bodyEditPreview ? 'secondary' : 'ghost'} className="h-6 text-xs" onClick={() => setBodyEditPreview(false)}>
                        <Pencil className="w-3 h-3 mr-1" />Editar
                      </Button>
                      <Button size="sm" variant={bodyEditPreview ? 'secondary' : 'ghost'} className="h-6 text-xs" onClick={() => setBodyEditPreview(true)}>
                        <Eye className="w-3 h-3 mr-1" />Preview
                      </Button>
                    </div>
                    {bodyEditPreview ? (
                      <div className="min-h-[160px] border border-border rounded p-2 bg-background">
                        <MarkdownBody content={bodyDraft} />
                      </div>
                    ) : (
                      <Textarea
                        value={bodyDraft}
                        onChange={e => setBodyDraft(e.target.value)}
                        rows={8}
                        className="resize-none font-mono text-sm"
                        autoFocus
                      />
                    )}
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditingBody(false)}>Cancelar</Button>
                      <Button size="sm" onClick={saveBody} disabled={editIssue.isPending}>
                        {editIssue.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3">
                    {issue.body ? (
                      <MarkdownBody content={issue.body} />
                    ) : (
                      <p className="text-sm text-muted-foreground italic cursor-pointer hover:text-foreground" onClick={startEditBody}>
                        Sem descrição. Clique para adicionar.
                      </p>
                    )}
                    <ReactionBar
                      reactions={reactions as Record<string, unknown>[]}
                      onAdd={(content) => addReaction.mutate({ number: issue.number, content })}
                    />
                  </div>
                )}
              </div>

              {/* Timeline events */}
              {showTimeline && timelineItems.length > 0 && (
                <div className="space-y-1 border-l-2 border-border pl-3">
                  {timelineItems.map((event, idx) => (
                    <TimelineEvent key={idx} event={event as Record<string, unknown>} />
                  ))}
                </div>
              )}

              {/* Comments */}
              {loadingComments ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando comentários...
                </div>
              ) : comments && comments.length > 0 ? (
                <div className="space-y-3">
                  {comments.map(c => (
                    <CommentItem key={c.id} comment={c} issueNumber={issue.number} />
                  ))}
                </div>
              ) : null}
            </div>
          </ScrollArea>

          {/* New Comment */}
          <div className="p-3 border-t border-border space-y-2">
            <div className="flex gap-1 mb-1">
              <Button size="sm" variant={!newCommentPreview ? 'secondary' : 'ghost'} className="h-6 text-xs" onClick={() => setNewCommentPreview(false)}>
                <Pencil className="w-3 h-3 mr-1" />Editar
              </Button>
              <Button size="sm" variant={newCommentPreview ? 'secondary' : 'ghost'} className="h-6 text-xs" onClick={() => setNewCommentPreview(true)}>
                <Eye className="w-3 h-3 mr-1" />Preview
              </Button>
            </div>
            {newCommentPreview ? (
              <div className="min-h-[72px] border border-border rounded-md p-2 bg-background">
                {newComment ? <MarkdownBody content={newComment} /> : <p className="text-sm text-muted-foreground italic">Sem conteúdo</p>}
              </div>
            ) : (
              <Textarea
                placeholder="Escreva um comentário..."
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                rows={3}
                className="resize-none text-sm"
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleComment(); }}
              />
            )}
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Ctrl+Enter para enviar</span>
              <Button size="sm" onClick={handleComment} disabled={!newComment.trim() || addComment.isPending} className="gap-1.5">
                {addComment.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Comentar
              </Button>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <IssueDetailSidebar issue={issue} onUpdated={onUpdated} />
      </div>
    </div>
  );
}

// ─── Kanban Board ──────────────────────────

type KanbanColumn = 'open' | 'in-progress' | 'done';

function getIssueColumn(issue: Issue): KanbanColumn {
  if (issue.state !== 'OPEN') return 'done';
  const hasInProgress = issue.labels.some(l =>
    l.name.toLowerCase().includes('in progress') ||
    l.name.toLowerCase().includes('doing') ||
    l.name === 'in-progress'
  );
  if (hasInProgress) return 'in-progress';
  return 'open';
}

// Card content — rendered both inline and in DragOverlay
function KanbanCardContent({ issue }: { issue: Issue }) {
  return (
    <>
      <div className="flex items-start gap-1.5">
        {issue.state === 'OPEN'
          ? <CircleDot className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
          : <CheckCircle className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />}
        <p className="text-sm font-medium leading-snug">{issue.title}</p>
      </div>
      <p className="text-xs text-muted-foreground mt-1">#{issue.number}</p>
      {issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {issue.labels.slice(0, 3).map(l => <LabelBadge key={l.name} label={l} />)}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        {issue.comments_count > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <MessageSquare className="w-3 h-3" />
            {issue.comments_count}
          </span>
        )}
        {issue.assignees.length > 0 && (
          <div className="flex -space-x-1 ml-auto">
            {issue.assignees.slice(0, 2).map(a => <UserAvatar key={a} login={a} size={16} />)}
          </div>
        )}
      </div>
    </>
  );
}

function KanbanCard({
  issue,
  onClick,
}: {
  issue: Issue;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: issue.number,
    data: { issue },
  });

  // Track mouse start position to distinguish click from drag in onClick
  // Uses onMouseDown (not onPointerDown) so it doesn't conflict with dnd-kit listeners
  const mouseStart = React.useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onMouseDown={(e) => { mouseStart.current = { x: e.clientX, y: e.clientY }; }}
      onClick={(e) => {
        if (!mouseStart.current) return;
        const dx = Math.abs(e.clientX - mouseStart.current.x);
        const dy = Math.abs(e.clientY - mouseStart.current.y);
        if (dx > 6 || dy > 6) return; // was a drag, not a click
        onClick();
      }}
      style={{ opacity: isDragging ? 0 : 1, touchAction: 'none' }}
      className="bg-background border border-border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors"
    >
      <KanbanCardContent issue={issue} />
    </div>
  );
}

function KanbanColumnView({
  id,
  title,
  issues,
  color,
  onIssueClick,
}: {
  id: KanbanColumn;
  title: string;
  issues: Issue[];
  color: string;
  onIssueClick: (issue: Issue) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div className={cn(
      'flex flex-col rounded-lg border border-border bg-muted/20 min-w-[260px] w-[260px] max-h-full transition-colors',
      isOver && 'border-primary bg-primary/5'
    )}>
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <div className={cn('w-2.5 h-2.5 rounded-full', color)} />
        <span className="text-sm font-medium">{title}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{issues.length}</span>
      </div>
      {/* Droppable zone covers the full card list area */}
      <div ref={setNodeRef} className="flex-1 overflow-y-auto p-2 min-h-[120px]">
        <div className="space-y-2">
          {issues.map(issue => (
            <div key={issue.number} className="relative">
              <KanbanCard issue={issue} onClick={() => onIssueClick(issue)} />
            </div>
          ))}
          {issues.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Arraste issues aqui</p>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanBoard({
  issues,
  onIssueClick,
}: {
  issues: Issue[];
  onIssueClick: (issue: Issue) => void;
}) {
  const closeIssue = useCloseIssue();
  const reopenIssue = useReopenIssue();
  const editIssue = useEditIssue();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const columns = {
    open: issues.filter(i => getIssueColumn(i) === 'open'),
    'in-progress': issues.filter(i => getIssueColumn(i) === 'in-progress'),
    done: issues.filter(i => getIssueColumn(i) === 'done'),
  };

  // Optimistically patch all issues query caches
  const patchIssueCache = useCallback((number: number, patch: Partial<Issue>) => {
    queryClient.setQueriesData<Issue[]>({ queryKey: ['issues'] }, (old) =>
      old ? old.map(i => i.number === number ? { ...i, ...patch } : i) : old
    );
  }, [queryClient]);

  const handleDragStart = (event: DragStartEvent) => {
    const issue = issues.find(i => i.number === event.active.id);
    setActiveIssue(issue ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveIssue(null);
    const { active, over } = event;
    if (!over) return;

    const issue = issues.find(i => i.number === active.id);
    if (!issue) return;

    const targetColumn = over.id as KanbanColumn;
    if (!['open', 'in-progress', 'done'].includes(String(targetColumn))) return;

    const currentColumn = getIssueColumn(issue);
    if (targetColumn === currentColumn) return;

    // Compute optimistic state
    let optimisticPatch: Partial<Issue>;
    if (targetColumn === 'done') {
      optimisticPatch = { state: 'CLOSED' };
    } else if (targetColumn === 'in-progress') {
      const alreadyHas = issue.labels.some(l => l.name === 'in-progress');
      optimisticPatch = {
        state: 'OPEN',
        labels: alreadyHas ? issue.labels : [
          ...issue.labels,
          { name: 'in-progress', color: 'fbca04', description: null },
        ],
      };
    } else {
      optimisticPatch = {
        state: 'OPEN',
        labels: issue.labels.filter(l => l.name !== 'in-progress' && !l.name.toLowerCase().includes('doing')),
      };
    }

    // Update UI immediately
    patchIssueCache(issue.number, optimisticPatch);

    // Call API in background, rollback on error
    const rollback = () => {
      patchIssueCache(issue.number, issue); // restore original
      toast({ title: 'Erro ao mover issue', variant: 'destructive' });
    };

    if (targetColumn === 'done') {
      closeIssue.mutate(issue.number, { onError: rollback, onSuccess: () => toast({ title: `#${issue.number} fechada` }) });
    } else if (targetColumn === 'in-progress') {
      const doEdit = () => {
        if (!issue.labels.some(l => l.name === 'in-progress')) {
          editIssue.mutate({ number: issue.number, addLabels: ['in-progress'], removeLabels: [], addAssignees: [], removeAssignees: [] }, { onError: rollback });
        }
        toast({ title: `#${issue.number} movida para In Progress` });
      };
      if (issue.state !== 'OPEN') {
        reopenIssue.mutate(issue.number, { onError: rollback, onSuccess: doEdit });
      } else {
        doEdit();
      }
    } else {
      const toRemove = issue.labels.filter(l =>
        l.name === 'in-progress' || l.name.toLowerCase().includes('doing')
      ).map(l => l.name);
      const doEdit = () => {
        if (toRemove.length > 0) {
          editIssue.mutate({ number: issue.number, addLabels: [], removeLabels: toRemove, addAssignees: [], removeAssignees: [] }, { onError: rollback });
        }
        toast({ title: `#${issue.number} movida para Open` });
      };
      if (issue.state !== 'OPEN') {
        reopenIssue.mutate(issue.number, { onError: rollback, onSuccess: doEdit });
      } else {
        doEdit();
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 p-4 h-full overflow-x-auto">
        <KanbanColumnView id="open" title="Open" color="bg-green-500" issues={columns.open} onIssueClick={onIssueClick} />
        <KanbanColumnView id="in-progress" title="In Progress" color="bg-yellow-500" issues={columns['in-progress']} onIssueClick={onIssueClick} />
        <KanbanColumnView id="done" title="Done" color="bg-purple-500" issues={columns.done} onIssueClick={onIssueClick} />
      </div>
      <DragOverlay dropAnimation={null}>
        {activeIssue && (
          <div className="bg-background border border-primary rounded-lg p-3 shadow-xl w-[244px] cursor-grabbing">
            <KanbanCardContent issue={activeIssue} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ─── Filter Sidebar ───────────────────────

type FilterState = {
  label: string | null;
  assignee: string | null;
  milestone: string | null;
  createdAfter: string | null;
  createdBefore: string | null;
  noLabel: boolean;
  noMilestone: boolean;
  noAssignee: boolean;
};

type SavedPreset = {
  name: string;
  filters: FilterState;
  sort: SortOption;
  stateFilter: 'open' | 'closed' | 'all';
};

const PRESETS_KEY = 'gitarc-issue-presets';

function loadPresets(): SavedPreset[] {
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function savePresets(presets: SavedPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function FilterDropdown({
  label,
  icon: Icon,
  items,
  selected,
  onSelect,
}: {
  label: string;
  icon: React.FC<{ className?: string }>;
  items: { value: string; label: string; color?: string }[];
  selected: string | null;
  onSelect: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={cn('gap-1 h-7 text-xs px-2', selected && 'text-foreground font-medium')}>
          <Icon className="w-3.5 h-3.5" />
          {selected ?? label}
          <ChevronDown className="w-3 h-3 ml-0.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div
          className="flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-muted"
          onClick={() => { onSelect(null); setOpen(false); }}
        >
          <Check className={cn('w-3.5 h-3.5', selected && 'opacity-0')} />
          Todos
        </div>
        {items.map(item => (
          <div
            key={item.value}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-muted',
              selected === item.value && 'bg-muted'
            )}
            onClick={() => { onSelect(item.value); setOpen(false); }}
          >
            <Check className={cn('w-3.5 h-3.5 shrink-0', selected !== item.value && 'opacity-0')} />
            {item.color && (
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: `#${item.color}` }}
              />
            )}
            <span className="truncate">{item.label}</span>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ─── Main Component ────────────────────────

export default function IssuesManager() {
  const [stateFilter, setStateFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [search, setSearch] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const selectedIssueNumber = useRepoStore((state) => state.selectedIssueNumber);
  const setSelectedIssueNumber = useRepoStore((state) => state.setSelectedIssueNumber);
  const [filters, setFilters] = useState<FilterState>({
    label: null,
    assignee: null,
    milestone: null,
    createdAfter: null,
    createdBefore: null,
    noLabel: false,
    noMilestone: false,
    noAssignee: false,
  });
  const [sort, setSort] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [selectedNumbers, setSelectedNumbers] = useState<Set<number>>(new Set());
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(loadPresets);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

  const PER_PAGE = 25;

  const { data: repoInfo } = useRepoInfo();
  const repoOpen = repoInfo?.is_repo === true;
  const { data: cliOk } = useGitHubCliStatus();
  const { data: selectedIssueFromQuery } = useIssue(selectedIssueNumber ?? 0);
  const { data: allLabels = [] } = useLabels();
  const { data: collaborators = [] } = useCollaborators();
  const { data: milestones = [] } = useMilestones();

  const {
    data: issues,
    isLoading,
    refetch,
  } = useIssues(
    stateFilter === 'all' ? undefined : stateFilter,
    filters.label ?? undefined,
    filters.assignee ?? undefined,
    filters.milestone ?? undefined,
  );

  const filteredIssues = useMemo(() => {
    if (!issues) return [];
    let result = [...issues];

    // text search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        String(i.number).includes(q) ||
        i.author.toLowerCase().includes(q) ||
        i.labels.some(l => l.name.toLowerCase().includes(q))
      );
    }

    // Advanced filters
    if (filters.noLabel) result = result.filter(i => i.labels.length === 0);
    if (filters.noMilestone) result = result.filter(i => !i.milestone_number);
    if (filters.noAssignee) result = result.filter(i => i.assignees.length === 0);
    if (filters.createdAfter) {
      const afterDate = new Date(filters.createdAfter).getTime();
      result = result.filter(i => new Date(i.created_at).getTime() >= afterDate);
    }
    if (filters.createdBefore) {
      const beforeDate = new Date(filters.createdBefore).getTime();
      result = result.filter(i => new Date(i.created_at).getTime() <= beforeDate);
    }

    return sortIssues(result, sort);
  }, [issues, search, filters, sort]);

  const displayedIssues = useMemo(() => {
    return filteredIssues.slice(0, page * PER_PAGE);
  }, [filteredIssues, page]);

  const hasMore = displayedIssues.length < filteredIssues.length;

  useEffect(() => {
    if (!selectedIssueNumber) {
      setSelectedIssue(null);
      return;
    }

    const nextIssue =
      issues?.find((issue) => issue.number === selectedIssueNumber) ??
      selectedIssueFromQuery ??
      null;

    if (nextIssue) {
      setSelectedIssue(nextIssue);
    }
  }, [issues, selectedIssueFromQuery, selectedIssueNumber]);

  const openCount = issues?.filter(i => i.state === 'OPEN').length ?? 0;
  const closedCount = issues?.filter(i => i.state === 'CLOSED').length ?? 0;

  const hasActiveFilters = filters.label || filters.assignee || filters.milestone ||
    filters.noLabel || filters.noMilestone || filters.noAssignee ||
    filters.createdAfter || filters.createdBefore;

  const clearFilters = useCallback(() => {
    setFilters({ label: null, assignee: null, milestone: null, createdAfter: null, createdBefore: null, noLabel: false, noMilestone: false, noAssignee: false });
    setPage(1);
  }, []);

  const handleSavePreset = () => {
    const name = prompt('Nome do preset de filtros:');
    if (!name?.trim()) return;
    const newPresets = [...savedPresets, { name: name.trim(), filters, sort, stateFilter }];
    setSavedPresets(newPresets);
    savePresets(newPresets);
  };

  const handleLoadPreset = (preset: SavedPreset) => {
    setFilters(preset.filters);
    setSort(preset.sort);
    setStateFilter(preset.stateFilter);
    setPage(1);
  };

  const handleDeletePreset = (name: string) => {
    const newPresets = savedPresets.filter(p => p.name !== name);
    setSavedPresets(newPresets);
    savePresets(newPresets);
  };

  const toggleSelectIssue = (number: number, checked: boolean) => {
    setSelectedNumbers(prev => {
      const next = new Set(prev);
      if (checked) next.add(number);
      else next.delete(number);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedNumbers.size === displayedIssues.length) {
      setSelectedNumbers(new Set());
    } else {
      setSelectedNumbers(new Set(displayedIssues.map(i => i.number)));
    }
  };

  if (!repoOpen) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Nenhum repositório aberto</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Abra um repositório com remote do GitHub para gerenciar issues.
          </p>
        </div>
      </div>
    );
  }

  if (cliOk === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">GitHub CLI não encontrado</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Instale em{' '}
            <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">cli.github.com</span>
            {' '}e execute{' '}
            <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">gh auth login</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* ── Left Panel: Filters + Issue List ── */}
      <div className={cn('flex flex-col border-r border-border shrink-0', viewMode === 'board' ? 'w-80' : 'w-80')}>
        {/* Header */}
        <div className="p-3 border-b border-border space-y-2">
          <div className={cn(
            'flex gap-2',
            viewMode === 'board' ? 'flex-col items-stretch' : 'items-center justify-between'
          )}>
            <h1 className="text-sm font-semibold flex items-center gap-2">
              <CircleDot className="w-4 h-4" />
              Issues
            </h1>
            <div className={cn(
              'flex items-center gap-1',
              viewMode === 'board' && 'flex-wrap'
            )}>
              <div className="flex items-center rounded-md border border-border p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn('h-7 gap-1.5 px-2 text-xs', viewMode === 'list' && 'bg-muted')}
                  onClick={() => setViewMode('list')}
                  title="Visualização em lista"
                >
                  <List className="w-3.5 h-3.5" />
                  Lista
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn('h-7 gap-1.5 px-2 text-xs', viewMode === 'board' && 'bg-muted')}
                  onClick={() => setViewMode('board')}
                  title="Visualização em kanban"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Kanban
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => { refetch(); setPage(1); }}
                disabled={isLoading}
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
              </Button>
              <CreateIssueDialog
                onCreated={() => { refetch(); setPage(1); }}
                triggerClassName={cn(viewMode === 'board' && 'ml-auto')}
              />
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar issue..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 h-8 text-sm"
            />
          </div>

          {/* State Tabs */}
          <div className="flex gap-1">
            {([
              { key: 'open' as const, label: 'Abertas', count: openCount },
              { key: 'closed' as const, label: 'Fechadas', count: closedCount },
              { key: 'all' as const, label: 'Todas' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => { setStateFilter(tab.key); setPage(1); }}
                className={cn(
                  'flex-1 text-xs py-1 px-2 rounded transition-colors',
                  stateFilter === tab.key
                    ? 'bg-secondary text-secondary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {tab.label}
                {'count' in tab && issues && (
                  <span className="ml-1 text-muted-foreground">({tab.count})</span>
                )}
              </button>
            ))}
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap gap-1 items-center">
            <FilterDropdown
              label="Label"
              icon={Tag}
              items={allLabels.map(l => ({ value: l.name, label: l.name, color: l.color }))}
              selected={filters.label}
              onSelect={v => { setFilters(f => ({ ...f, label: v })); setPage(1); }}
            />
            <FilterDropdown
              label="Assignee"
              icon={User}
              items={collaborators.map(c => ({ value: c.login, label: c.login }))}
              selected={filters.assignee}
              onSelect={v => { setFilters(f => ({ ...f, assignee: v })); setPage(1); }}
            />
            <FilterDropdown
              label="Milestone"
              icon={Milestone}
              items={milestones.map(m => ({ value: m.title, label: m.title }))}
              selected={filters.milestone}
              onSelect={v => { setFilters(f => ({ ...f, milestone: v })); setPage(1); }}
            />
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 ml-auto"
              >
                <X className="w-3 h-3" />
                Limpar
              </button>
            )}
          </div>

          {/* Sort + Advanced Filters */}
          <div className="flex items-center gap-1">
            {/* Sort dropdown */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2">
                  <ArrowUpDown className="w-3 h-3" />
                  {sort === 'newest' ? 'Mais recentes' : sort === 'oldest' ? 'Mais antigas' : sort === 'most-commented' ? 'Mais comentadas' : sort === 'recently-updated' ? 'Atualiz. recentemente' : 'Menos atualizadas'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                {([
                  { value: 'newest', label: 'Mais recentes' },
                  { value: 'oldest', label: 'Mais antigas' },
                  { value: 'most-commented', label: 'Mais comentadas' },
                  { value: 'recently-updated', label: 'Atualiz. recentemente' },
                  { value: 'least-updated', label: 'Menos atualizadas' },
                ] as { value: SortOption; label: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSort(opt.value)}
                    className={cn(
                      'flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-muted',
                      sort === opt.value && 'bg-muted font-medium'
                    )}
                  >
                    <Check className={cn('w-3 h-3', sort !== opt.value && 'opacity-0')} />
                    {opt.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Advanced filters */}
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-6 text-xs gap-1 px-2 ml-auto', advancedFiltersOpen && 'bg-muted')}
              onClick={() => setAdvancedFiltersOpen(v => !v)}
            >
              <Settings className="w-3 h-3" />
            </Button>

            {/* Save preset */}
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2" onClick={handleSavePreset} title="Salvar filtros como preset">
              <Bookmark className="w-3 h-3" />
            </Button>
          </div>

          {/* Advanced filters panel */}
          {advancedFiltersOpen && (
            <div className="border border-border rounded-lg p-2 space-y-2 text-xs">
              <p className="font-semibold text-muted-foreground">Filtros avançados</p>
              <div className="flex items-center gap-2">
                <label>Criada após:</label>
                <input
                  type="date"
                  value={filters.createdAfter ?? ''}
                  onChange={e => setFilters(f => ({ ...f, createdAfter: e.target.value || null }))}
                  className="flex-1 h-6 bg-background border border-border rounded px-1 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <label>Criada antes:</label>
                <input
                  type="date"
                  value={filters.createdBefore ?? ''}
                  onChange={e => setFilters(f => ({ ...f, createdBefore: e.target.value || null }))}
                  className="flex-1 h-6 bg-background border border-border rounded px-1 text-xs"
                />
              </div>
              <div className="space-y-1">
                {[
                  { key: 'noLabel', label: 'Sem label' },
                  { key: 'noMilestone', label: 'Sem milestone' },
                  { key: 'noAssignee', label: 'Sem assignee' },
                ].map(opt => (
                  <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters[opt.key as keyof FilterState] as boolean}
                      onChange={e => setFilters(f => ({ ...f, [opt.key]: e.target.checked }))}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Saved presets */}
          {savedPresets.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {savedPresets.map(p => (
                <div key={p.name} className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleLoadPreset(p)}
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                  >
                    <Bookmark className="w-2.5 h-2.5" />
                    {p.name}
                  </button>
                  <button
                    onClick={() => handleDeletePreset(p.name)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Manage Labels/Milestones */}
          <div className="border-t border-border pt-1 space-y-0.5">
            <ManageLabelsDialog />
            <ManageMilestonesDialog />
          </div>
        </div>

        {/* List */}
        {viewMode === 'list' && (
          <ScrollArea className="flex-1">
            {/* Bulk select header */}
            {displayedIssues.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/20">
                <div
                  className={cn(
                    'w-4 h-4 rounded border-2 border-border flex items-center justify-center cursor-pointer transition-colors',
                    selectedNumbers.size === displayedIssues.length && selectedNumbers.size > 0 && 'bg-primary border-primary'
                  )}
                  onClick={toggleSelectAll}
                >
                  {selectedNumbers.size === displayedIssues.length && selectedNumbers.size > 0 && (
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {selectedNumbers.size > 0 && (
              <BulkActionBar
                selectedIssues={selectedNumbers}
                allIssues={filteredIssues}
                onClose={() => setSelectedNumbers(new Set())}
              />
            )}

            {isLoading ? (
              <div className="flex items-center justify-center p-8 gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando issues...
              </div>
            ) : displayedIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 gap-2 text-muted-foreground">
                <CircleDot className="w-8 h-8 opacity-30" />
                <p className="text-sm">Nenhuma issue encontrada</p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            ) : (
              <>
                {displayedIssues.map(issue => (
                  <IssueListItem
                    key={issue.number}
                    issue={issue}
                    selected={selectedIssue?.number === issue.number}
                    onClick={() => {
                      setSelectedIssue(issue);
                      setSelectedIssueNumber(issue.number);
                    }}
                    checked={selectedNumbers.has(issue.number)}
                    onCheck={(v) => toggleSelectIssue(issue.number, v)}
                    showCheckbox={true}
                  />
                ))}
                {hasMore && (
                  <div className="p-3 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setPage(p => p + 1)}
                    >
                      Carregar mais ({filteredIssues.length - displayedIssues.length} restantes)
                    </Button>
                  </div>
                )}
              </>
            )}
          </ScrollArea>
        )}
      </div>

      {/* ── Right Panel: Issue Details or Board ── */}
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
        {viewMode === 'board' ? (
          isLoading ? (
            <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              Carregando...
            </div>
          ) : (
            <KanbanBoard
              issues={filteredIssues}
              onIssueClick={(issue) => {
                setSelectedIssue(issue);
                setSelectedIssueNumber(issue.number);
                setViewMode('list');
              }}
            />
          )
        ) : selectedIssue ? (
          <IssueDetails
            key={selectedIssue.number}
            issue={issues?.find(i => i.number === selectedIssue.number) ?? selectedIssue}
            onRefresh={() => refetch()}
            onUpdated={(updated) => {
              setSelectedIssue(updated);
              setSelectedIssueNumber(updated.number);
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <CircleDot className="w-12 h-12 opacity-20" />
            <p className="text-sm">Selecione uma issue para ver os detalhes</p>
          </div>
        )}
      </div>
    </div>
  );
}
