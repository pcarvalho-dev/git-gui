import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { BlameInfo } from '@/types';

interface BlameGroup {
  commitHash: string;
  author: string;
  date: number;
  color: string;
  lines: BlameInfo[];
  startLine: number;
}

function hashColor(hash: string): string {
  let h = 0;
  for (let i = 0; i < hash.length; i++) {
    h = (h * 31 + hash.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue}, 55%, 38%)`;
}

function groupBlameLines(lines: BlameInfo[]): BlameGroup[] {
  const groups: BlameGroup[] = [];
  let current: BlameGroup | null = null;

  for (const line of lines) {
    if (!current || current.commitHash !== line.commit_hash) {
      current = {
        commitHash: line.commit_hash,
        author: line.author,
        date: line.date,
        color: hashColor(line.commit_hash),
        lines: [],
        startLine: line.line,
      };
      groups.push(current);
    }
    current.lines.push(line);
  }

  return groups;
}

interface BlameViewerProps {
  lines: BlameInfo[];
  loading: boolean;
  onNavigateToCommit: (hash: string) => void;
}

export default function BlameViewer({ lines, loading, onNavigateToCommit }: BlameViewerProps) {
  const groups = useMemo(() => groupBlameLines(lines), [lines]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma informacao de blame disponivel
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="font-mono text-xs">
        {groups.map((group) => (
          <div key={`${group.commitHash}-${group.startLine}`} className="flex">
            <div
              className="w-[200px] shrink-0 px-2 pt-1.5 text-right select-none"
              style={{ borderLeft: `3px solid ${group.color}` }}
            >
              <button
                className="font-mono hover:underline truncate block w-full text-right"
                style={{ color: group.color }}
                onClick={() => onNavigateToCommit(group.commitHash)}
                title={`Ir para commit ${group.commitHash}`}
              >
                {group.commitHash}
              </button>
              <div className="text-muted-foreground truncate">{group.author}</div>
              <div className="text-muted-foreground">
                {format(new Date(group.date * 1000), 'd MMM yyyy', { locale: ptBR })}
              </div>
            </div>
            <div className="flex-1 min-w-0 border-l border-border">
              {group.lines.map((line) => (
                <div
                  key={line.line}
                  className="flex gap-2 px-2 py-0.5 hover:bg-muted/30"
                >
                  <span className="w-8 text-right text-muted-foreground shrink-0 select-none">
                    {line.line}
                  </span>
                  <span className="whitespace-pre truncate">{line.content}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
