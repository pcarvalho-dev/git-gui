import type { DiffInfo, LineInfo } from '@/types';
import { cn } from '@/lib/utils';

interface DiffViewerProps {
  diff: DiffInfo;
}

export default function DiffViewer({ diff }: DiffViewerProps) {
  if (diff.is_binary) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Arquivo binário - não é possível exibir diff
      </div>
    );
  }

  if (diff.hunks.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Nenhuma alteração para exibir
      </div>
    );
  }

  const getLineClass = (line: LineInfo) => {
    switch (line.line_type) {
      case 'addition':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'deletion':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'header':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      default:
        return '';
    }
  };

  const getOriginSymbol = (origin: string) => {
    switch (origin) {
      case '+':
        return '+';
      case '-':
        return '-';
      case '@':
        return '@';
      default:
        return ' ';
    }
  };

  return (
    <div className="font-mono text-xs">
      {/* Stats */}
      <div className="sticky top-0 bg-background border-b border-border px-4 py-2 flex items-center gap-4">
        <span className="text-green-600 dark:text-green-400">+{diff.additions}</span>
        <span className="text-red-600 dark:text-red-400">-{diff.deletions}</span>
        <span className="text-muted-foreground ml-auto">{diff.status}</span>
      </div>

      {/* Hunks */}
      {diff.hunks.map((hunk, hunkIdx) => (
        <div key={hunkIdx} className="border-b border-border">
          {/* Hunk Header */}
          <div className="bg-blue-500/5 px-4 py-1 text-blue-600 dark:text-blue-400 sticky top-9">
            {hunk.header}
          </div>

          {/* Lines */}
          <div>
            {hunk.lines.map((line, lineIdx) => (
              <div
                key={lineIdx}
                className={cn(
                  'flex hover:bg-muted/30 transition-colors',
                  getLineClass(line)
                )}
              >
                {/* Old Line Number */}
                <div className="w-12 px-2 py-0.5 text-right text-muted-foreground select-none border-r border-border shrink-0">
                  {line.old_line || ''}
                </div>

                {/* New Line Number */}
                <div className="w-12 px-2 py-0.5 text-right text-muted-foreground select-none border-r border-border shrink-0">
                  {line.new_line || ''}
                </div>

                {/* Origin Symbol */}
                <div className="w-6 text-center py-0.5 select-none shrink-0">
                  {getOriginSymbol(line.origin)}
                </div>

                {/* Content */}
                <pre className="flex-1 px-2 py-0.5 overflow-x-auto whitespace-pre">
                  {line.content}
                </pre>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
