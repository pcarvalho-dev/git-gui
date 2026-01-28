import { useState, useEffect, useMemo } from 'react';
import { git } from '@/services/git';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/lib/error';
import {
  Loader2,
  X,
  Save,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/useGit';

interface ConflictResolverProps {
  filePath: string | null;
  onClose: () => void;
}

interface ParsedConflict {
  id: number;
  oursLines: string[];
  theirsLines: string[];
  startLine: number;
}

interface ConflictResolution {
  id: number;
  choice: 'ours' | 'theirs' | 'both' | 'both-theirs-first' | null;
}

interface ParsedFile {
  lines: Array<{
    type: 'normal' | 'conflict-start' | 'conflict-ours' | 'conflict-separator' | 'conflict-theirs' | 'conflict-end';
    content: string;
    conflictId?: number;
    lineNumber: number;
  }>;
  conflicts: ParsedConflict[];
}

function parseConflictedFile(content: string): ParsedFile {
  const rawLines = content.split('\n');
  const lines: ParsedFile['lines'] = [];
  const conflicts: ParsedConflict[] = [];

  let inConflict = false;
  let inOurs = false;
  let inTheirs = false;
  let currentConflict: ParsedConflict | null = null;
  let conflictId = 0;
  let lineNumber = 1;

  for (const rawLine of rawLines) {
    if (rawLine.startsWith('<<<<<<<')) {
      inConflict = true;
      inOurs = true;
      currentConflict = {
        id: conflictId,
        oursLines: [],
        theirsLines: [],
        startLine: lineNumber,
      };
      lines.push({ type: 'conflict-start', content: rawLine, conflictId, lineNumber });
    } else if (rawLine.startsWith('=======') && inConflict) {
      inOurs = false;
      inTheirs = true;
      lines.push({ type: 'conflict-separator', content: rawLine, conflictId, lineNumber });
    } else if (rawLine.startsWith('>>>>>>>') && inConflict) {
      lines.push({ type: 'conflict-end', content: rawLine, conflictId, lineNumber });
      if (currentConflict) {
        conflicts.push(currentConflict);
      }
      inConflict = false;
      inOurs = false;
      inTheirs = false;
      currentConflict = null;
      conflictId++;
    } else if (inConflict) {
      if (inOurs) {
        lines.push({ type: 'conflict-ours', content: rawLine, conflictId, lineNumber });
        currentConflict?.oursLines.push(rawLine);
      } else if (inTheirs) {
        lines.push({ type: 'conflict-theirs', content: rawLine, conflictId, lineNumber });
        currentConflict?.theirsLines.push(rawLine);
      }
    } else {
      lines.push({ type: 'normal', content: rawLine, lineNumber });
    }
    lineNumber++;
  }

  return { lines, conflicts };
}

function buildResolvedContent(parsedFile: ParsedFile, resolutions: ConflictResolution[]): string {
  const result: string[] = [];
  let skipUntilEnd = false;
  let currentConflictId: number | undefined;

  for (const line of parsedFile.lines) {
    if (line.type === 'conflict-start') {
      skipUntilEnd = true;
      currentConflictId = line.conflictId;

      const resolution = resolutions.find(r => r.id === currentConflictId);
      const conflict = parsedFile.conflicts.find(c => c.id === currentConflictId);

      if (resolution && conflict) {
        switch (resolution.choice) {
          case 'ours':
            result.push(...conflict.oursLines);
            break;
          case 'theirs':
            result.push(...conflict.theirsLines);
            break;
          case 'both':
            result.push(...conflict.oursLines);
            result.push(...conflict.theirsLines);
            break;
          case 'both-theirs-first':
            result.push(...conflict.theirsLines);
            result.push(...conflict.oursLines);
            break;
          default:
            // Not resolved yet, keep conflict markers
            result.push(line.content);
            skipUntilEnd = false;
        }
      }
    } else if (line.type === 'conflict-end') {
      if (!skipUntilEnd) {
        result.push(line.content);
      }
      skipUntilEnd = false;
      currentConflictId = undefined;
    } else if (skipUntilEnd) {
      // Skip conflict content lines when resolved
      continue;
    } else if (line.type === 'normal') {
      result.push(line.content);
    } else if (!skipUntilEnd) {
      // Unresolved conflict lines
      result.push(line.content);
    }
  }

  return result.join('\n');
}

export default function ConflictResolver({ filePath, onClose }: ConflictResolverProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rawContent, setRawContent] = useState<string>('');
  const [resolutions, setResolutions] = useState<ConflictResolution[]>([]);

  const parsedFile = useMemo(() => {
    if (!rawContent) return null;
    return parseConflictedFile(rawContent);
  }, [rawContent]);

  const resolvedContent = useMemo(() => {
    if (!parsedFile) return '';
    return buildResolvedContent(parsedFile, resolutions);
  }, [parsedFile, resolutions]);

  const allResolved = useMemo(() => {
    if (!parsedFile) return false;
    return parsedFile.conflicts.every(c =>
      resolutions.find(r => r.id === c.id)?.choice != null
    );
  }, [parsedFile, resolutions]);

  const resolvedCount = useMemo(() => {
    return resolutions.filter(r => r.choice != null).length;
  }, [resolutions]);

  // Load conflict file
  useEffect(() => {
    if (!filePath) return;

    const loadConflict = async () => {
      setLoading(true);
      try {
        const content = await git.conflict.getFile(filePath);
        setRawContent(content);

        const parsed = parseConflictedFile(content);
        setResolutions(parsed.conflicts.map(c => ({ id: c.id, choice: null })));
      } catch (err) {
        toast({
          title: 'Erro',
          description: getErrorMessage(err),
          variant: 'destructive',
        });
        onClose();
      } finally {
        setLoading(false);
      }
    };

    loadConflict();
  }, [filePath, toast, onClose]);

  const handleResolve = (conflictId: number, choice: ConflictResolution['choice']) => {
    setResolutions(prev =>
      prev.map(r => (r.id === conflictId ? { ...r, choice } : r))
    );
  };

  const handleSave = async () => {
    if (!filePath || !allResolved) return;

    setSaving(true);
    try {
      await git.conflict.resolve(filePath, resolvedContent, true);
      toast({ title: 'Conflito resolvido', description: `${filePath} foi marcado como resolvido` });
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      onClose();
    } catch (err) {
      toast({
        title: 'Erro',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!filePath) return null;

  const ConflictActions = ({ conflictId }: { conflictId: number }) => {
    const resolution = resolutions.find(r => r.id === conflictId);

    return (
      <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 border-y border-yellow-500/30">
        <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium mr-2">
          Conflito {conflictId + 1}
        </span>
        <Button
          size="sm"
          variant={resolution?.choice === 'ours' ? 'default' : 'ghost'}
          className="h-6 text-xs px-2"
          onClick={() => handleResolve(conflictId, 'ours')}
        >
          Aceitar Atual
        </Button>
        <Button
          size="sm"
          variant={resolution?.choice === 'theirs' ? 'default' : 'ghost'}
          className="h-6 text-xs px-2"
          onClick={() => handleResolve(conflictId, 'theirs')}
        >
          Aceitar Incoming
        </Button>
        <Button
          size="sm"
          variant={resolution?.choice === 'both' ? 'default' : 'ghost'}
          className="h-6 text-xs px-2"
          onClick={() => handleResolve(conflictId, 'both')}
        >
          Aceitar Ambos
        </Button>
        <Button
          size="sm"
          variant={resolution?.choice === 'both-theirs-first' ? 'default' : 'ghost'}
          className="h-6 text-xs px-2"
          onClick={() => handleResolve(conflictId, 'both-theirs-first')}
        >
          Ambos (Incoming Primeiro)
        </Button>
        {resolution?.choice && (
          <Check className="w-4 h-4 text-green-500 ml-2" />
        )}
      </div>
    );
  };

  const renderConflictedFile = () => {
    if (!parsedFile) return null;

    const elements: JSX.Element[] = [];
    let i = 0;

    while (i < parsedFile.lines.length) {
      const line = parsedFile.lines[i];

      if (line.type === 'conflict-start') {
        const conflictId = line.conflictId!;
        const resolution = resolutions.find(r => r.id === conflictId);
        const conflict = parsedFile.conflicts.find(c => c.id === conflictId);

        // Add conflict action bar
        elements.push(
          <ConflictActions key={`actions-${conflictId}`} conflictId={conflictId} />
        );

        if (resolution?.choice && conflict) {
          // Show resolved content
          let resolvedLines: string[] = [];
          switch (resolution.choice) {
            case 'ours':
              resolvedLines = conflict.oursLines;
              break;
            case 'theirs':
              resolvedLines = conflict.theirsLines;
              break;
            case 'both':
              resolvedLines = [...conflict.oursLines, ...conflict.theirsLines];
              break;
            case 'both-theirs-first':
              resolvedLines = [...conflict.theirsLines, ...conflict.oursLines];
              break;
          }

          elements.push(
            <div key={`resolved-${conflictId}`} className="bg-green-500/10 border-l-4 border-green-500">
              {resolvedLines.map((content, idx) => (
                <div key={idx} className="flex font-mono text-sm">
                  <span className="w-12 px-2 text-right text-muted-foreground bg-green-500/5 select-none border-r border-border">
                    {idx + 1}
                  </span>
                  <pre className="flex-1 px-3 py-0.5 overflow-x-auto">{content || ' '}</pre>
                </div>
              ))}
            </div>
          );

          // Skip to end of conflict
          while (i < parsedFile.lines.length && parsedFile.lines[i].type !== 'conflict-end') {
            i++;
          }
        } else {
          // Show unresolved conflict with both versions
          // Current (Ours) section
          elements.push(
            <div key={`ours-header-${conflictId}`} className="bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 border-l-4 border-blue-500">
              Atual (HEAD)
            </div>
          );

          const oursLines: JSX.Element[] = [];
          i++; // Skip conflict-start
          while (i < parsedFile.lines.length && parsedFile.lines[i].type === 'conflict-ours') {
            const oursLine = parsedFile.lines[i];
            oursLines.push(
              <div key={`ours-${conflictId}-${i}`} className="flex font-mono text-sm bg-blue-500/10">
                <span className="w-12 px-2 text-right text-muted-foreground bg-blue-500/5 select-none border-r border-border">
                  {oursLine.lineNumber}
                </span>
                <pre className="flex-1 px-3 py-0.5 overflow-x-auto">{oursLine.content || ' '}</pre>
              </div>
            );
            i++;
          }
          elements.push(
            <div key={`ours-content-${conflictId}`} className="border-l-4 border-blue-500">
              {oursLines.length > 0 ? oursLines : (
                <div className="flex font-mono text-sm bg-blue-500/10 text-muted-foreground italic">
                  <span className="w-12 px-2 bg-blue-500/5 border-r border-border"></span>
                  <span className="px-3 py-0.5">(vazio)</span>
                </div>
              )}
            </div>
          );

          // Separator
          i++; // Skip separator

          // Incoming (Theirs) section
          elements.push(
            <div key={`theirs-header-${conflictId}`} className="bg-green-500/20 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400 border-l-4 border-green-500">
              Incoming (Merge)
            </div>
          );

          const theirsLines: JSX.Element[] = [];
          while (i < parsedFile.lines.length && parsedFile.lines[i].type === 'conflict-theirs') {
            const theirsLine = parsedFile.lines[i];
            theirsLines.push(
              <div key={`theirs-${conflictId}-${i}`} className="flex font-mono text-sm bg-green-500/10">
                <span className="w-12 px-2 text-right text-muted-foreground bg-green-500/5 select-none border-r border-border">
                  {theirsLine.lineNumber}
                </span>
                <pre className="flex-1 px-3 py-0.5 overflow-x-auto">{theirsLine.content || ' '}</pre>
              </div>
            );
            i++;
          }
          elements.push(
            <div key={`theirs-content-${conflictId}`} className="border-l-4 border-green-500">
              {theirsLines.length > 0 ? theirsLines : (
                <div className="flex font-mono text-sm bg-green-500/10 text-muted-foreground italic">
                  <span className="w-12 px-2 bg-green-500/5 border-r border-border"></span>
                  <span className="px-3 py-0.5">(vazio)</span>
                </div>
              )}
            </div>
          );
        }
      } else if (line.type === 'normal') {
        elements.push(
          <div key={`normal-${i}`} className="flex font-mono text-sm">
            <span className="w-12 px-2 text-right text-muted-foreground bg-muted/30 select-none border-r border-border">
              {line.lineNumber}
            </span>
            <pre className="flex-1 px-3 py-0.5 overflow-x-auto">{line.content || ' '}</pre>
          </div>
        );
      }

      i++;
    }

    return elements;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0 bg-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={onClose} className="gap-1">
            <X className="w-4 h-4" />
            Fechar
          </Button>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <span className="font-semibold">Resolver Conflitos:</span>
            <span className="text-muted-foreground font-mono text-sm">{filePath}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {resolvedCount} de {parsedFile?.conflicts.length || 0} conflitos resolvidos
          </span>
          <Button onClick={handleSave} disabled={saving || !allResolved}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar e Marcar Resolvido
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Editor */}
          <div className="flex-1 flex flex-col border-r border-border">
            <div className="px-3 py-2 bg-muted/50 border-b border-border text-sm font-medium">
              Editor de Conflitos
            </div>
            <ScrollArea className="flex-1">
              <div className="min-w-max">
                {renderConflictedFile()}
              </div>
            </ScrollArea>
          </div>

          {/* Preview */}
          <div className="w-[40%] flex flex-col">
            <div className="px-3 py-2 bg-muted/50 border-b border-border text-sm font-medium flex items-center justify-between">
              <span>Preview do Resultado</span>
              {allResolved && (
                <span className="text-xs text-green-500 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Todos resolvidos
                </span>
              )}
            </div>
            <ScrollArea className="flex-1 bg-muted/20">
              <pre className="p-4 text-sm font-mono whitespace-pre-wrap">{resolvedContent}</pre>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
