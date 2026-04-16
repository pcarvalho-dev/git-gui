import { useMemo } from 'react';
import type { DiffInfo, LineInfo } from '@/types';
import { cn } from '@/lib/utils';
import { Loader2, Minus, Plus } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

  if (filename === 'dockerfile') return 'docker';
  if (filename === 'makefile') return 'makefile';
  if (filename === 'cmakelists.txt') return 'cmake';

  return extensionToLanguage[ext] || 'text';
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
}

function HighlightedLine({ content, language }: HighlightedLineProps) {
  if (!content.trim()) {
    return <span>{content || ' '}</span>;
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

interface DiffViewerProps {
  diff: DiffInfo;
  hunkActionLabel?: string;
  lineActionLabel?: string;
  isActionPending?: boolean;
  onActionHunk?: (hunkIndex: number) => void;
  onActionLine?: (hunkIndex: number, lineIndex: number) => void;
}

export default function DiffViewer({
  diff,
  hunkActionLabel,
  lineActionLabel,
  isActionPending = false,
  onActionHunk,
  onActionLine,
}: DiffViewerProps) {
  const language = useMemo(() => getLanguageFromPath(diff.path), [diff.path]);
  const actionIcon = hunkActionLabel?.toLowerCase().includes('unstage') ? Minus : Plus;
  const ActionIcon = actionIcon;

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
        return 'bg-green-950/40';
      case 'deletion':
        return 'bg-red-950/40';
      case 'header':
        return 'bg-blue-950/30';
      default:
        return '';
    }
  };

  const getOriginSymbol = (origin: string) => {
    switch (origin) {
      case '+':
        return <span className="text-green-400">+</span>;
      case '-':
        return <span className="text-red-400">-</span>;
      case '@':
        return <span className="text-blue-400">@</span>;
      default:
        return ' ';
    }
  };

  const canActOnLine = (line: LineInfo) =>
    typeof onActionLine === 'function' &&
    (line.line_type === 'addition' || line.line_type === 'deletion');

  return (
    <div className="font-mono text-xs">
      {/* Stats */}
      <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 px-4 py-2 flex items-center gap-4">
        <span className="text-green-400">+{diff.additions}</span>
        <span className="text-red-400">-{diff.deletions}</span>
        <span className="text-zinc-500 ml-auto">{diff.status}</span>
      </div>

      {/* Hunks */}
      {diff.hunks.map((hunk, hunkIdx) => (
        <div key={hunkIdx} className="border-b border-zinc-800">
          {/* Hunk Header */}
          <div className="bg-blue-950/30 px-4 py-1 text-blue-300 sticky top-9 flex items-center gap-3">
            <span className="truncate">{hunk.header}</span>
            {onActionHunk && hunkActionLabel && (
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 rounded border border-blue-400/30 px-2 py-0.5 text-[11px] font-medium text-blue-200 transition-colors hover:bg-blue-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onActionHunk(hunkIdx)}
                disabled={isActionPending}
                title={hunkActionLabel}
              >
                {isActionPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ActionIcon className="h-3 w-3" />
                )}
                {hunkActionLabel}
              </button>
            )}
          </div>

          {/* Lines */}
          <div>
            {hunk.lines.map((line, lineIdx) => (
              <div
                key={lineIdx}
                className={cn(
                  'flex hover:bg-zinc-800/50 transition-colors group/line',
                  getLineClass(line)
                )}
              >
                {/* Old Line Number */}
                <div className="w-12 px-2 py-0.5 text-right text-zinc-500 select-none border-r border-zinc-700/50 shrink-0">
                  {line.old_line || ''}
                </div>

                {/* New Line Number */}
                <div className="w-12 px-2 py-0.5 text-right text-zinc-500 select-none border-r border-zinc-700/50 shrink-0">
                  {line.new_line || ''}
                </div>

                {/* Origin Symbol */}
                <div className="w-6 text-center py-0.5 select-none shrink-0">
                  {getOriginSymbol(line.origin)}
                </div>

                {canActOnLine(line) && lineActionLabel && (
                  <button
                    type="button"
                    className="mx-1 my-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-700/70 text-zinc-300 opacity-0 transition hover:bg-zinc-700 group-hover/line:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => onActionLine?.(hunkIdx, lineIdx)}
                    disabled={isActionPending}
                    title={lineActionLabel}
                  >
                    {isActionPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ActionIcon className="h-3 w-3" />
                    )}
                  </button>
                )}

                {/* Content with syntax highlighting */}
                <pre className="flex-1 px-2 py-0.5 overflow-x-auto whitespace-pre">
                  <HighlightedLine content={line.content} language={language} />
                </pre>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
