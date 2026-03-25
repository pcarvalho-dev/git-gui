import { useState, useMemo } from 'react';
import {
  useIssues,
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
} from '@/hooks/useGit';
import { getErrorMessage } from '@/lib/error';
import { useToast } from '@/components/ui/use-toast';
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
import type { Issue, IssueLabel, IssueMilestone, GitHubProject } from '@/types';
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

// ─── Small UI Components ───────────────────

function IssueStateBadge({ state }: { state: string }) {
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

// ─── Create Issue Dialog ───────────────────

function CreateIssueDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<IssueLabel[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedMilestone, setSelectedMilestone] = useState<IssueMilestone | null>(null);
  const [selectedProject, setSelectedProject] = useState<GitHubProject | null>(null);

  const createIssue = useCreateIssue();
  const { toast } = useToast();

  const reset = () => {
    setTitle('');
    setBody('');
    setSelectedLabels([]);
    setSelectedAssignees([]);
    setSelectedMilestone(null);
    setSelectedProject(null);
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

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          Nova Issue
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Issue</DialogTitle>
        </DialogHeader>
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
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                placeholder="Descreva a issue em detalhes... (Markdown suportado)"
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={8}
                className="resize-none font-mono text-sm"
              />
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
      </DialogContent>
    </Dialog>
  );
}

// ─── Issue List Item ───────────────────────

function IssueListItem({
  issue,
  selected,
  onClick,
}: {
  issue: Issue;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'p-3 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors',
        selected && 'bg-muted'
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          {issue.state === 'OPEN'
            ? <CircleDot className="w-4 h-4 text-green-400" />
            : <CheckCircle className="w-4 h-4 text-purple-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug">{issue.title}</p>
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
        </div>
      </div>
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
  const { data: allMilestones = [] } = useMilestones();
  const { toast } = useToast();

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
      </div>
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
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingBody, setEditingBody] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');

  const { data: comments, isLoading: loadingComments, refetch: refetchComments } = useIssueComments(issue.number);
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
        onSuccess: () => { setNewComment(''); refetchComments(); },
        onError: (err) => toast({ title: 'Erro ao comentar', description: getErrorMessage(err), variant: 'destructive' }),
      }
    );
  };

  const startEditTitle = () => { setTitleDraft(issue.title); setEditingTitle(true); };
  const startEditBody = () => { setBodyDraft(issue.body ?? ''); setEditingBody(true); };

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <IssueStateBadge state={issue.state} />
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
                    <Textarea
                      value={bodyDraft}
                      onChange={e => setBodyDraft(e.target.value)}
                      rows={8}
                      className="resize-none font-mono text-sm"
                      autoFocus
                    />
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
                      <p className="text-sm whitespace-pre-wrap">{issue.body}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic cursor-pointer hover:text-foreground" onClick={startEditBody}>
                        Sem descrição. Clique para adicionar.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Comments */}
              {loadingComments ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando comentários...
                </div>
              ) : comments && comments.length > 0 ? (
                <div className="space-y-3">
                  {comments.map(c => (
                    <div key={c.id} className="rounded-lg border border-border overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
                        <div className="flex items-center gap-1.5">
                          <UserAvatar login={c.author} size={16} />
                          <span className="text-xs font-medium">{c.author}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
                      </div>
                      <div className="p-3">
                        <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </ScrollArea>

          {/* New Comment */}
          <div className="p-3 border-t border-border space-y-2">
            <Textarea
              placeholder="Escreva um comentário..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              rows={3}
              className="resize-none text-sm"
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleComment(); }}
            />
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

// ─── Filter Sidebar ───────────────────────

type FilterState = {
  label: string | null;
  assignee: string | null;
  milestone: string | null;
};

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
  const [filters, setFilters] = useState<FilterState>({ label: null, assignee: null, milestone: null });

  const { data: cliOk } = useGitHubCliStatus();
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
    if (!search) return issues;
    const q = search.toLowerCase();
    return issues.filter(i =>
      i.title.toLowerCase().includes(q) ||
      String(i.number).includes(q) ||
      i.author.toLowerCase().includes(q) ||
      i.labels.some(l => l.name.toLowerCase().includes(q))
    );
  }, [issues, search]);

  const openCount = issues?.filter(i => i.state === 'OPEN').length ?? 0;
  const closedCount = issues?.filter(i => i.state === 'CLOSED').length ?? 0;

  const hasActiveFilters = filters.label || filters.assignee || filters.milestone;

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
      <div className="w-80 flex flex-col border-r border-border shrink-0">
        {/* Header */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-semibold flex items-center gap-2">
              <CircleDot className="w-4 h-4" />
              Issues
            </h1>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
              </Button>
              <CreateIssueDialog onCreated={() => refetch()} />
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar issue..."
              value={search}
              onChange={e => setSearch(e.target.value)}
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
                onClick={() => setStateFilter(tab.key)}
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
              onSelect={v => setFilters(f => ({ ...f, label: v }))}
            />
            <FilterDropdown
              label="Assignee"
              icon={User}
              items={collaborators.map(c => ({ value: c.login, label: c.login }))}
              selected={filters.assignee}
              onSelect={v => setFilters(f => ({ ...f, assignee: v }))}
            />
            <FilterDropdown
              label="Milestone"
              icon={Milestone}
              items={milestones.map(m => ({ value: m.title, label: m.title }))}
              selected={filters.milestone}
              onSelect={v => setFilters(f => ({ ...f, milestone: v }))}
            />
            {hasActiveFilters && (
              <button
                onClick={() => setFilters({ label: null, assignee: null, milestone: null })}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 ml-auto"
              >
                <X className="w-3 h-3" />
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando issues...
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 gap-2 text-muted-foreground">
              <CircleDot className="w-8 h-8 opacity-30" />
              <p className="text-sm">Nenhuma issue encontrada</p>
              {hasActiveFilters && (
                <button
                  onClick={() => setFilters({ label: null, assignee: null, milestone: null })}
                  className="text-xs text-blue-400 hover:underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            filteredIssues.map(issue => (
              <IssueListItem
                key={issue.number}
                issue={issue}
                selected={selectedIssue?.number === issue.number}
                onClick={() => setSelectedIssue(issue)}
              />
            ))
          )}
        </ScrollArea>
      </div>

      {/* ── Right Panel: Issue Details ── */}
      <div className="flex-1 min-w-0">
        {selectedIssue ? (
          <IssueDetails
            key={selectedIssue.number}
            issue={issues?.find(i => i.number === selectedIssue.number) ?? selectedIssue}
            onRefresh={() => refetch()}
            onUpdated={(updated) => setSelectedIssue(updated)}
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
