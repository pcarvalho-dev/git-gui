import { useMemo } from 'react';
import { useDiffViewerStore } from '@/stores/diffViewerStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  FilePlus,
  FileX,
  FileEdit,
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { DiffInfo, HunkInfo, LineInfo } from '@/types';

// Map file extensions to language names for syntax highlighting
const extensionToLanguage: Record<string, string> = {
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  py: 'python',
  rb: 'ruby',
  java: 'java',
  kt: 'kotlin',
  go: 'go',
  rs: 'rust',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  m: 'objectivec',
  mm: 'objectivec',
  scala: 'scala',
  r: 'r',
  sql: 'sql',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  ps1: 'powershell',
  dockerfile: 'docker',
  makefile: 'makefile',
  cmake: 'cmake',
  gradle: 'groovy',
  groovy: 'groovy',
  lua: 'lua',
  perl: 'perl',
  pl: 'perl',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  clj: 'clojure',
  vim: 'vim',
  vue: 'vue',
  svelte: 'svelte',
};

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const filename = path.split('/').pop()?.toLowerCase() || '';

  // Check for special filenames
  if (filename === 'dockerfile') return 'docker';
  if (filename === 'makefile') return 'makefile';
  if (filename === 'cmakelists.txt') return 'cmake';

  return extensionToLanguage[ext] || 'text';
}

// Build side-by-side line pairs from hunks
interface SideBySideLine {
  leftLineNo: number | null;
  leftContent: string;
  leftType: 'context' | 'deletion' | 'empty';
  rightLineNo: number | null;
  rightContent: string;
  rightType: 'context' | 'addition' | 'empty';
  isHunkHeader?: boolean;
  hunkHeader?: string;
}

function buildSideBySideLines(hunks: HunkInfo[]): SideBySideLine[] {
  const result: SideBySideLine[] = [];

  for (const hunk of hunks) {
    // Add hunk header
    result.push({
      leftLineNo: null,
      leftContent: '',
      leftType: 'empty',
      rightLineNo: null,
      rightContent: '',
      rightType: 'empty',
      isHunkHeader: true,
      hunkHeader: hunk.header,
    });

    // Process lines - group deletions and additions for better pairing
    let i = 0;
    while (i < hunk.lines.length) {
      const line = hunk.lines[i];

      if (line.line_type === 'context') {
        result.push({
          leftLineNo: line.old_line,
          leftContent: line.content,
          leftType: 'context',
          rightLineNo: line.new_line,
          rightContent: line.content,
          rightType: 'context',
        });
        i++;
      } else if (line.line_type === 'deletion') {
        // Collect consecutive deletions
        const deletions: LineInfo[] = [];
        while (i < hunk.lines.length && hunk.lines[i].line_type === 'deletion') {
          deletions.push(hunk.lines[i]);
          i++;
        }

        // Collect consecutive additions
        const additions: LineInfo[] = [];
        while (i < hunk.lines.length && hunk.lines[i].line_type === 'addition') {
          additions.push(hunk.lines[i]);
          i++;
        }

        // Pair them up
        const maxLen = Math.max(deletions.length, additions.length);
        for (let j = 0; j < maxLen; j++) {
          const del = deletions[j];
          const add = additions[j];

          result.push({
            leftLineNo: del?.old_line ?? null,
            leftContent: del?.content ?? '',
            leftType: del ? 'deletion' : 'empty',
            rightLineNo: add?.new_line ?? null,
            rightContent: add?.content ?? '',
            rightType: add ? 'addition' : 'empty',
          });
        }
      } else if (line.line_type === 'addition') {
        // Additions without preceding deletions
        result.push({
          leftLineNo: null,
          leftContent: '',
          leftType: 'empty',
          rightLineNo: line.new_line,
          rightContent: line.content,
          rightType: 'addition',
        });
        i++;
      } else {
        i++;
      }
    }
  }

  return result;
}

function FileStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'added':
      return <FilePlus className="w-4 h-4 text-green-500" />;
    case 'deleted':
      return <FileX className="w-4 h-4 text-red-500" />;
    case 'modified':
      return <FileEdit className="w-4 h-4 text-yellow-500" />;
    case 'renamed':
      return <FileText className="w-4 h-4 text-blue-500" />;
    default:
      return <FileText className="w-4 h-4 text-muted-foreground" />;
  }
}

// Custom style based on vscDarkPlus but with transparent background
const customStyle = {
  ...vscDarkPlus,
  'pre[class*="language-"]': {
    ...vscDarkPlus['pre[class*="language-"]'],
    background: 'transparent',
    margin: 0,
    padding: 0,
  },
  'code[class*="language-"]': {
    ...vscDarkPlus['code[class*="language-"]'],
    background: 'transparent',
  },
};

interface HighlightedLineProps {
  content: string;
  language: string;
  className?: string;
}

function HighlightedLine({ content, language, className }: HighlightedLineProps) {
  if (!content.trim()) {
    return <span className={className}>{content || ' '}</span>;
  }

  return (
    <SyntaxHighlighter
      language={language}
      style={customStyle}
      customStyle={{
        background: 'transparent',
        margin: 0,
        padding: 0,
        display: 'inline',
        fontSize: 'inherit',
        lineHeight: 'inherit',
      }}
      codeTagProps={{
        style: {
          background: 'transparent',
          fontSize: 'inherit',
          lineHeight: 'inherit',
        },
      }}
      PreTag="span"
      CodeTag="span"
    >
      {content}
    </SyntaxHighlighter>
  );
}

function DiffContent({ diff }: { diff: DiffInfo }) {
  const sideBySideLines = useMemo(
    () => buildSideBySideLines(diff.hunks),
    [diff.hunks]
  );

  const language = useMemo(() => getLanguageFromPath(diff.path), [diff.path]);

  if (diff.is_binary) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Arquivo binario - nao e possivel exibir diff
      </div>
    );
  }

  if (diff.hunks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Sem alteracoes de conteudo
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left side - Old content */}
      <div className="flex-1 flex flex-col border-r border-border min-w-0">
        <div className="px-3 py-2 bg-red-950/50 border-b border-border text-sm font-medium text-red-300 shrink-0">
          {diff.old_path || diff.path} (anterior)
        </div>
        <ScrollArea className="flex-1">
          <table className="w-full text-xs font-mono">
            <tbody>
              {sideBySideLines.map((line, idx) => {
                if (line.isHunkHeader) {
                  return (
                    <tr key={idx} className="bg-blue-950/30">
                      <td
                        colSpan={2}
                        className="px-2 py-1 text-blue-300 text-center"
                      >
                        {line.hunkHeader}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={idx}
                    className={cn(
                      'h-6',
                      line.leftType === 'deletion' && 'bg-red-950/40',
                      line.leftType === 'empty' && 'bg-zinc-900/50'
                    )}
                  >
                    <td className="px-2 text-zinc-500 text-right select-none w-12 border-r border-zinc-700/50">
                      {line.leftLineNo || ''}
                    </td>
                    <td className="px-2 whitespace-pre overflow-hidden">
                      {line.leftType === 'empty' ? (
                        <span className="text-zinc-700">{line.leftContent || ' '}</span>
                      ) : line.leftType === 'deletion' ? (
                        <span className="relative">
                          <span className="absolute left-[-8px] text-red-400 select-none">-</span>
                          <HighlightedLine content={line.leftContent} language={language} />
                        </span>
                      ) : (
                        <HighlightedLine content={line.leftContent} language={language} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>
      </div>

      {/* Right side - New content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-3 py-2 bg-green-950/50 border-b border-border text-sm font-medium text-green-300 shrink-0">
          {diff.path} (atual)
        </div>
        <ScrollArea className="flex-1">
          <table className="w-full text-xs font-mono">
            <tbody>
              {sideBySideLines.map((line, idx) => {
                if (line.isHunkHeader) {
                  return (
                    <tr key={idx} className="bg-blue-950/30">
                      <td
                        colSpan={2}
                        className="px-2 py-1 text-blue-300 text-center"
                      >
                        {line.hunkHeader}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={idx}
                    className={cn(
                      'h-6',
                      line.rightType === 'addition' && 'bg-green-950/40',
                      line.rightType === 'empty' && 'bg-zinc-900/50'
                    )}
                  >
                    <td className="px-2 text-zinc-500 text-right select-none w-12 border-r border-zinc-700/50">
                      {line.rightLineNo || ''}
                    </td>
                    <td className="px-2 whitespace-pre overflow-hidden">
                      {line.rightType === 'empty' ? (
                        <span className="text-zinc-700">{line.rightContent || ' '}</span>
                      ) : line.rightType === 'addition' ? (
                        <span className="relative">
                          <span className="absolute left-[-8px] text-green-400 select-none">+</span>
                          <HighlightedLine content={line.rightContent} language={language} />
                        </span>
                      ) : (
                        <HighlightedLine content={line.rightContent} language={language} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>
      </div>
    </div>
  );
}

export default function SideBySideDiff() {
  const { isOpen, diff, commit, allDiffs, currentIndex, closeDiff, nextDiff, prevDiff, goToDiff } =
    useDiffViewerStore();

  if (!isOpen || !diff || !commit) {
    return null;
  }

  const hasNext = currentIndex < allDiffs.length - 1;
  const hasPrev = currentIndex > 0;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <FileStatusIcon status={diff.status} />
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{diff.path}</div>
            <div className="text-xs text-muted-foreground truncate">
              Commit: {commit.short_hash} - {commit.summary}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* File navigation */}
          {allDiffs.length > 1 && (
            <div className="flex items-center gap-1 mr-4">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={prevDiff}
                disabled={!hasPrev}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                {currentIndex + 1} / {allDiffs.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={nextDiff}
                disabled={!hasNext}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 text-xs mr-4">
            <span className="text-green-500">+{diff.additions}</span>
            <span className="text-red-500">-{diff.deletions}</span>
          </div>

          <Button variant="ghost" size="icon" onClick={closeDiff}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* File tabs */}
      {allDiffs.length > 1 && (
        <div className="flex border-b border-border bg-muted/30 overflow-x-auto shrink-0">
          {allDiffs.map((d, idx) => (
            <button
              key={d.path}
              onClick={() => goToDiff(idx)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-xs border-r border-border hover:bg-muted/50 whitespace-nowrap',
                idx === currentIndex && 'bg-background border-b-2 border-b-primary'
              )}
            >
              <FileStatusIcon status={d.status} />
              <span className="max-w-40 truncate">{d.path.split('/').pop()}</span>
            </button>
          ))}
        </div>
      )}

      {/* Diff content */}
      <div className="flex-1 overflow-hidden">
        <DiffContent diff={diff} />
      </div>
    </div>
  );
}
