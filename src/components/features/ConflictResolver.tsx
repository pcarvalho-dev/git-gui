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
  Columns2,
  AlignLeft,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/useGit';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Map file extensions to language names
const extensionToLanguage: Record<string, string> = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  py: 'python', rb: 'ruby', java: 'java', go: 'go', rs: 'rust',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp', php: 'php',
  swift: 'swift', scala: 'scala', sql: 'sql', html: 'html', xml: 'xml',
  css: 'css', scss: 'scss', json: 'json', yaml: 'yaml', yml: 'yaml',
  md: 'markdown', sh: 'bash', bash: 'bash', ps1: 'powershell',
};

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return extensionToLanguage[ext] || 'text';
}

const customStyle = {
  ...vscDarkPlus,
  'pre[class*="language-"]': { ...vscDarkPlus['pre[class*="language-"]'], background: 'transparent', margin: 0, padding: 0 },
  'code[class*="language-"]': { ...vscDarkPlus['code[class*="language-"]'], background: 'transparent' },
};

function HighlightedLine({ content, language }: { content: string; language: string }) {
  if (!content.trim()) return <span>{content || ' '}</span>;
  return (
    <SyntaxHighlighter
      language={language}
      style={customStyle}
      customStyle={{ background: 'transparent', margin: 0, padding: 0, display: 'inline', fontSize: 'inherit', lineHeight: 'inherit' }}
      codeTagProps={{ style: { background: 'transparent', fontSize: 'inherit', lineHeight: 'inherit' } }}
      PreTag="span"
      CodeTag="span"
    >
      {content}
    </SyntaxHighlighter>
  );
}

interface ConflictResolverProps {
  filePath: string | null;
  onClose: () => void;
}

interface ParsedConflict {
  id: number;
  oursLines: string[];
  baseLines: string[];
  theirsLines: string[];
  startLine: number;
  hasBase: boolean;
}

interface ConflictResolution {
  id: number;
  choice: 'ours' | 'theirs' | 'both' | 'both-theirs-first' | null;
}

interface ParsedFile {
  lines: Array<{
    type: 'normal' | 'conflict-start' | 'conflict-ours' | 'conflict-base' | 'conflict-separator' | 'conflict-theirs' | 'conflict-end';
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
  let inBase = false;
  let inTheirs = false;
  let currentConflict: ParsedConflict | null = null;
  let conflictId = 0;
  let lineNumber = 1;

  for (const rawLine of rawLines) {
    if (rawLine.startsWith('<<<<<<<')) {
      inConflict = true;
      inOurs = true;
      inBase = false;
      inTheirs = false;
      currentConflict = { id: conflictId, oursLines: [], baseLines: [], theirsLines: [], startLine: lineNumber, hasBase: false };
      lines.push({ type: 'conflict-start', content: rawLine, conflictId, lineNumber });
    } else if (rawLine.startsWith('|||||||') && inConflict) {
      // diff3 base section
      inOurs = false;
      inBase = true;
      inTheirs = false;
      if (currentConflict) currentConflict.hasBase = true;
      lines.push({ type: 'conflict-separator', content: rawLine, conflictId, lineNumber });
    } else if (rawLine.startsWith('=======') && inConflict) {
      inOurs = false;
      inBase = false;
      inTheirs = true;
      lines.push({ type: 'conflict-separator', content: rawLine, conflictId, lineNumber });
    } else if (rawLine.startsWith('>>>>>>>') && inConflict) {
      lines.push({ type: 'conflict-end', content: rawLine, conflictId, lineNumber });
      if (currentConflict) conflicts.push(currentConflict);
      inConflict = false;
      inOurs = false;
      inBase = false;
      inTheirs = false;
      currentConflict = null;
      conflictId++;
    } else if (inConflict) {
      if (inOurs) {
        lines.push({ type: 'conflict-ours', content: rawLine, conflictId, lineNumber });
        currentConflict?.oursLines.push(rawLine);
      } else if (inBase) {
        lines.push({ type: 'conflict-base', content: rawLine, conflictId, lineNumber });
        currentConflict?.baseLines.push(rawLine);
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

function ConflictLineBlock({ lines, bgClass, borderClass, label }: { lines: string[]; bgClass: string; borderClass: string; label: string; language: string }) {
  return (
    <div className={`border-l-4 ${borderClass} ${bgClass} flex-1 min-w-0 overflow-x-auto`}>
      <div className={`px-2 py-1 text-xs font-semibold ${borderClass.replace('border', 'text')}`}>{label}</div>
      {lines.length > 0 ? lines.map((l, i) => (
        <div key={i} className="flex font-mono text-xs">
          <span className="w-8 px-1 text-right text-zinc-500 select-none border-r border-zinc-700/40 shrink-0">{i + 1}</span>
          <pre className="px-2 py-0.5 flex-1 whitespace-pre">{l || ' '}</pre>
        </div>
      )) : (
        <div className="px-3 py-1 text-xs text-zinc-500 italic">(vazio)</div>
      )}
    </div>
  );
}

interface SplitConflictViewProps {
  parsedFile: ParsedFile | null;
  conflicts: ParsedConflict[];
  resolutions: ConflictResolution[];
  resolvedContent: string;
  allResolved: boolean;
  language: string;
  onResolve: (id: number, choice: ConflictResolution['choice']) => void;
}

function SplitConflictView({ parsedFile, conflicts, resolutions, resolvedContent, allResolved, language, onResolve }: SplitConflictViewProps) {
  const hasAnyBase = conflicts.some(c => c.hasBase);
  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Column headers */}
        <div className={`grid ${hasAnyBase ? 'grid-cols-3' : 'grid-cols-2'} border-b border-border shrink-0`}>
          <div className="px-3 py-2 bg-blue-950/40 text-blue-300 text-xs font-semibold border-r border-border">Atual (HEAD)</div>
          {hasAnyBase && <div className="px-3 py-2 bg-zinc-800 text-zinc-300 text-xs font-semibold border-r border-border">Base</div>}
          <div className="px-3 py-2 bg-green-950/40 text-green-300 text-xs font-semibold">Incoming</div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-0">
            {/* Normal lines before first conflict (context) */}
            {parsedFile?.lines.filter(l => l.type === 'normal').length === 0 && conflicts.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">Nenhum conflito encontrado</div>
            )}

            {conflicts.map((conflict) => {
              const resolution = resolutions.find(r => r.id === conflict.id);
              const isResolved = resolution?.choice != null;

              return (
                <div key={conflict.id} className="border-b border-border">
                  {/* Action bar */}
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500/10 border-b border-yellow-500/20">
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium mr-2">
                      Conflito {conflict.id + 1}
                    </span>
                    {(['ours', 'theirs', 'both', 'both-theirs-first'] as const).map(choice => {
                      const labels = { ours: 'Aceitar Atual', theirs: 'Aceitar Incoming', both: 'Ambos', 'both-theirs-first': 'Ambos (Incoming 1º)' };
                      return (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => onResolve(conflict.id, choice)}
                          className={`h-6 text-xs px-2 rounded border transition-colors ${resolution?.choice === choice ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                        >
                          {labels[choice]}
                        </button>
                      );
                    })}
                    {isResolved && <Check className="w-4 h-4 text-green-500 ml-2 shrink-0" />}
                  </div>

                  {/* Three-column content */}
                  {isResolved && resolution?.choice ? (
                    <div className="bg-green-950/20 border-l-4 border-green-500 px-3 py-2">
                      <div className="text-xs text-green-400 font-medium mb-1">Resolvido</div>
                      {(resolution.choice === 'ours' ? conflict.oursLines :
                        resolution.choice === 'theirs' ? conflict.theirsLines :
                        resolution.choice === 'both' ? [...conflict.oursLines, ...conflict.theirsLines] :
                        [...conflict.theirsLines, ...conflict.oursLines]).map((l, i) => (
                          <div key={i} className="font-mono text-xs px-2 py-0.5 whitespace-pre">{l || ' '}</div>
                        ))}
                    </div>
                  ) : (
                    <div className={`grid ${hasAnyBase ? 'grid-cols-3' : 'grid-cols-2'} min-h-[40px]`}>
                      <ConflictLineBlock lines={conflict.oursLines} bgClass="bg-blue-950/20" borderClass="border-blue-500" label="HEAD" language={language} />
                      {hasAnyBase && <ConflictLineBlock lines={conflict.baseLines} bgClass="bg-zinc-800/30" borderClass="border-zinc-500" label="Base" language={language} />}
                      <ConflictLineBlock lines={conflict.theirsLines} bgClass="bg-green-950/20" borderClass="border-green-500" label="Incoming" language={language} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Preview column */}
      <div className="w-[35%] flex flex-col border-l border-border">
        <div className="px-3 py-2 bg-muted/50 border-b border-border text-sm font-medium flex items-center justify-between">
          <span>Preview</span>
          {allResolved && (
            <span className="text-xs text-green-500 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Todos resolvidos
            </span>
          )}
        </div>
        <ScrollArea className="flex-1 bg-muted/20">
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap">{resolvedContent}</pre>
        </ScrollArea>
      </div>
    </div>
  );
}

export default function ConflictResolver({ filePath, onClose }: ConflictResolverProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rawContent, setRawContent] = useState<string>('');
  const [resolutions, setResolutions] = useState<ConflictResolution[]>([]);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('split');

  const language = useMemo(() => filePath ? getLanguageFromPath(filePath) : 'text', [filePath]);

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
            <div key={`resolved-${conflictId}`} className="bg-green-950/30 border-l-4 border-green-500">
              {resolvedLines.map((content, idx) => (
                <div key={idx} className="flex font-mono text-sm">
                  <span className="w-12 px-2 text-right text-zinc-500 bg-green-950/20 select-none border-r border-zinc-700/50">
                    {idx + 1}
                  </span>
                  <pre className="flex-1 px-3 py-0.5 overflow-x-auto">
                    <HighlightedLine content={content || ' '} language={language} />
                  </pre>
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
            <div key={`ours-header-${conflictId}`} className="bg-blue-950/50 px-3 py-1 text-xs font-medium text-blue-300 border-l-4 border-blue-500">
              Atual (HEAD)
            </div>
          );

          const oursLines: JSX.Element[] = [];
          i++; // Skip conflict-start
          while (i < parsedFile.lines.length && parsedFile.lines[i].type === 'conflict-ours') {
            const oursLine = parsedFile.lines[i];
            oursLines.push(
              <div key={`ours-${conflictId}-${i}`} className="flex font-mono text-sm bg-blue-950/30">
                <span className="w-12 px-2 text-right text-zinc-500 bg-blue-950/20 select-none border-r border-zinc-700/50">
                  {oursLine.lineNumber}
                </span>
                <pre className="flex-1 px-3 py-0.5 overflow-x-auto">
                  <HighlightedLine content={oursLine.content || ' '} language={language} />
                </pre>
              </div>
            );
            i++;
          }
          elements.push(
            <div key={`ours-content-${conflictId}`} className="border-l-4 border-blue-500">
              {oursLines.length > 0 ? oursLines : (
                <div className="flex font-mono text-sm bg-blue-950/30 text-zinc-500 italic">
                  <span className="w-12 px-2 bg-blue-950/20 border-r border-zinc-700/50"></span>
                  <span className="px-3 py-0.5">(vazio)</span>
                </div>
              )}
            </div>
          );

          // Separator
          i++; // Skip separator

          // Incoming (Theirs) section
          elements.push(
            <div key={`theirs-header-${conflictId}`} className="bg-green-950/50 px-3 py-1 text-xs font-medium text-green-300 border-l-4 border-green-500">
              Incoming (Merge)
            </div>
          );

          const theirsLines: JSX.Element[] = [];
          while (i < parsedFile.lines.length && parsedFile.lines[i].type === 'conflict-theirs') {
            const theirsLine = parsedFile.lines[i];
            theirsLines.push(
              <div key={`theirs-${conflictId}-${i}`} className="flex font-mono text-sm bg-green-950/30">
                <span className="w-12 px-2 text-right text-zinc-500 bg-green-950/20 select-none border-r border-zinc-700/50">
                  {theirsLine.lineNumber}
                </span>
                <pre className="flex-1 px-3 py-0.5 overflow-x-auto">
                  <HighlightedLine content={theirsLine.content || ' '} language={language} />
                </pre>
              </div>
            );
            i++;
          }
          elements.push(
            <div key={`theirs-content-${conflictId}`} className="border-l-4 border-green-500">
              {theirsLines.length > 0 ? theirsLines : (
                <div className="flex font-mono text-sm bg-green-950/30 text-zinc-500 italic">
                  <span className="w-12 px-2 bg-green-950/20 border-r border-zinc-700/50"></span>
                  <span className="px-3 py-0.5">(vazio)</span>
                </div>
              )}
            </div>
          );
        }
      } else if (line.type === 'normal') {
        elements.push(
          <div key={`normal-${i}`} className="flex font-mono text-sm">
            <span className="w-12 px-2 text-right text-zinc-500 bg-zinc-900/50 select-none border-r border-zinc-700/50">
              {line.lineNumber}
            </span>
            <pre className="flex-1 px-3 py-0.5 overflow-x-auto">
              <HighlightedLine content={line.content || ' '} language={language} />
            </pre>
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
          <div className="flex items-center border border-border rounded overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2 py-1 text-xs flex items-center gap-1 ${viewMode === 'split' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Vista lado a lado"
            >
              <Columns2 className="w-3 h-3" />
              Split
            </button>
            <button
              type="button"
              onClick={() => setViewMode('unified')}
              className={`px-2 py-1 text-xs flex items-center gap-1 ${viewMode === 'unified' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Vista unificada"
            >
              <AlignLeft className="w-3 h-3" />
              Unificado
            </button>
          </div>
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
      ) : viewMode === 'split' ? (
        <SplitConflictView
          parsedFile={parsedFile}
          conflicts={parsedFile?.conflicts || []}
          resolutions={resolutions}
          resolvedContent={resolvedContent}
          allResolved={allResolved}
          language={language}
          onResolve={handleResolve}
        />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Unified editor */}
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
