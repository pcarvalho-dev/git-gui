import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/error';
import { useRebaseRange, useExecuteRebase } from '@/hooks/useGit';
import type { CommitInfo, RebaseActionType, RebaseEntry } from '@/types';
import { GripVertical, AlertTriangle, Loader2 } from 'lucide-react';

// ─── Action color map ────────────────────────────────────────

const ACTION_COLORS: Record<RebaseActionType, string> = {
  pick:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  reword: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  squash: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  fixup:  'bg-orange-500/15 text-orange-400 border-orange-500/30',
  drop:   'bg-red-500/15 text-red-400 border-red-500/30 opacity-50',
};

const ACTION_LABELS: Record<RebaseActionType, string> = {
  pick:   'pick',
  reword: 'reword',
  squash: 'squash',
  fixup:  'fixup',
  drop:   'drop',
};

// ─── Row item ────────────────────────────────────────────────

interface RowItem {
  id: string; // unique key for dnd-kit (= hash)
  commit: CommitInfo;
  action: RebaseActionType;
  message: string; // editable for reword/squash
}

function buildRows(commits: CommitInfo[]): RowItem[] {
  return commits.map((c) => ({
    id: c.hash,
    commit: c,
    action: 'pick',
    message: c.message,
  }));
}

// ─── Sortable row component ───────────────────────────────────

interface SortableRowProps {
  item: RowItem;
  onActionChange: (id: string, action: RebaseActionType) => void;
  onMessageChange: (id: string, msg: string) => void;
  isDragging?: boolean;
}

function SortableRow({ item, onActionChange, onMessageChange, isDragging }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSelf } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isDropped = item.action === 'drop';
  const isEditable = item.action === 'reword' || item.action === 'squash';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-start gap-2 p-2 rounded-md border border-transparent mb-1 transition-all',
        'bg-muted/30 hover:bg-muted/60',
        isSelf && 'opacity-0',
        isDragging && 'shadow-lg',
        isDropped && 'opacity-40'
      )}
    >
      {/* Drag handle */}
      <button
        className="mt-1.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Action selector */}
      <div className="shrink-0 w-24">
        <Select
          value={item.action}
          onValueChange={(v) => onActionChange(item.id, v as RebaseActionType)}
        >
          <SelectTrigger
            className={cn(
              'h-7 text-xs border px-2',
              ACTION_COLORS[item.action]
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ACTION_LABELS) as RebaseActionType[]).map((a) => (
              <SelectItem key={a} value={a} className="text-xs">
                {ACTION_LABELS[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Hash */}
      <span className="mt-1 text-xs font-mono text-muted-foreground shrink-0 w-14">
        {item.commit.short_hash}
      </span>

      {/* Message — editable when reword/squash */}
      <div className="flex-1 min-w-0">
        {isEditable ? (
          <textarea
            className="w-full text-xs bg-background border border-border rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            rows={2}
            value={item.message}
            onChange={(e) => onMessageChange(item.id, e.target.value)}
          />
        ) : (
          <span
            className={cn(
              'text-xs leading-5 line-clamp-2 break-words',
              isDropped && 'line-through text-muted-foreground'
            )}
          >
            {item.commit.summary}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Drag overlay ─────────────────────────────────────────────

function DragOverlayRow({ item }: { item: RowItem }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-md border border-border bg-background shadow-lg mb-1">
      <GripVertical className="w-4 h-4 mt-1.5 text-muted-foreground shrink-0" />
      <span className={cn('mt-1 text-xs px-1.5 py-0.5 rounded border shrink-0', ACTION_COLORS[item.action])}>
        {ACTION_LABELS[item.action]}
      </span>
      <span className="mt-1 text-xs font-mono text-muted-foreground shrink-0 w-14">
        {item.commit.short_hash}
      </span>
      <span className="text-xs leading-5 line-clamp-1 break-words">{item.commit.summary}</span>
    </div>
  );
}

// ─── Main dialog ──────────────────────────────────────────────

interface InteractiveRebaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseHash: string | null; // commit that acts as the rebase base (its children will be rebased)
  onSuccess?: () => void;
}

export default function InteractiveRebase({
  open,
  onOpenChange,
  baseHash,
  onSuccess,
}: InteractiveRebaseProps) {
  const { toast } = useToast();
  const { data: rangeCommits, isLoading } = useRebaseRange(open ? baseHash : null);
  const executeRebase = useExecuteRebase();

  const [rows, setRows] = useState<RowItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (rangeCommits) {
      setRows(buildRows(rangeCommits));
    }
  }, [rangeCommits]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setRows((prev) => {
        const oldIdx = prev.findIndex((r) => r.id === active.id);
        const newIdx = prev.findIndex((r) => r.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const handleActionChange = (id: string, action: RebaseActionType) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, action, message: action === 'reword' || action === 'squash' ? r.message : r.commit.message }
          : r
      )
    );
  };

  const handleMessageChange = (id: string, msg: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, message: msg } : r)));
  };

  const handleExecute = async () => {
    if (!baseHash) return;

    const entries: RebaseEntry[] = rows.map((r) => ({
      hash: r.id,
      action: r.action,
      message: (r.action === 'reword' || r.action === 'squash') ? r.message : undefined,
    }));

    try {
      await executeRebase.mutateAsync({ baseHash, entries });
      toast({ title: 'Rebase concluído', description: 'Histórico reescrito com sucesso.' });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast({
        title: 'Erro no rebase',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    }
  };

  const activeItem = rows.find((r) => r.id === activeId) ?? null;
  const nonDropped = rows.filter((r) => r.action !== 'drop').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border">
          <DialogTitle className="text-base">Rebase Interativo</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Arraste para reordenar · Escolha a ação por commit
          </p>
        </DialogHeader>

        {/* Warning */}
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-xs text-yellow-400">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Isso reescreve o histórico. Não use em commits já publicados no remoto.
          </span>
        </div>

        {/* Commit list */}
        <ScrollArea className="flex-1 px-4 py-3 min-h-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum commit para rebasear.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                {rows.map((item) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    onActionChange={handleActionChange}
                    onMessageChange={handleMessageChange}
                  />
                ))}
              </SortableContext>

              <DragOverlay>
                {activeItem ? <DragOverlayRow item={activeItem} /> : null}
              </DragOverlay>
            </DndContext>
          )}
        </ScrollArea>

        <DialogFooter className="px-4 pb-4 pt-3 border-t border-border flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            {nonDropped} de {rows.length} commit{rows.length !== 1 ? 's' : ''} serão aplicados
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleExecute}
              disabled={executeRebase.isPending || nonDropped === 0 || rows.length === 0}
            >
              {executeRebase.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Rebasing…
                </>
              ) : (
                'Executar Rebase'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
