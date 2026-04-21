import { useMemo, useState } from 'react';
import type { DiffInfo, HunkInfo, LineInfo } from '@/types';
import { cn } from '@/lib/utils';
import { Loader2, Minus, Plus, Columns2, AlignLeft } from 'lucide-react';
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

interface SideBySideRow {
  leftLineNo: number | null;
  leftContent: string;
  leftType: 'context' | 'deletion' | 'empty';
  rightLineNo: number | null;
  rightContent: string;
  rightType: 'context' | 'addition' | 'empty';
  isHunkHeader?: boolean;
  hunkHeader?: string;
}

function buildSideBySide(hunks: HunkInfo[]): SideBySideRow[] {
  const rows: SideBySideRow[] = [];
  for (const hunk of hunks) {
    rows.push({ leftLineNo: null, leftContent: '', leftType: 'empty', rightLineNo: null, rightContent: '', rightType: 'empty', isHunkHeader: true, hunkHeader: hunk.header });
    let i = 0;
    while (i < hunk.lines.length) {
      const line = hunk.lines[i];
      if (line.line_type === 'context') {
        rows.push({ leftLineNo: line.old_line, leftContent: line.content, leftType: 'context', rightLineNo: line.new_line, rightContent: line.content, rightType: 'context' });
        i++;
      } else if (line.line_type === 'deletion') {
        const dels: LineInfo[] = [];
        while (i < hunk.lines.length && hunk.lines[i].line_type === 'deletion') { dels.push(hunk.lines[i]); i++; }
        const adds: LineInfo[] = [];
        while (i < hunk.lines.length && hunk.lines[i].line_type === 'addition') { adds.push(hunk.lines[i]); i++; }
        const len = Math.max(dels.length, adds.length);
        for (let j = 0; j < len; j++) {
          const d = dels[j]; const a = adds[j];
          rows.push({ leftLineNo: d?.old_line ?? null, leftContent: d?.content ?? '', leftType: d ? 'deletion' : 'empty', rightLineNo: a?.new_line ?? null, rightContent: a?.content ?? '', rightType: a ? 'addition' : 'empty' });
        }
      } else if (line.line_type === 'addition') {
        rows.push({ leftLineNo: null, leftContent: '', leftType: 'empty', rightLineNo: line.new_line, rightContent: line.content, rightType: 'addition' });
        i++;
      } else { i++; }
    }
  }
  return rows;
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
  const [sideBySide, setSideBySide] = useState(false);
  const sideBySideRows = useMemo(() => sideBySide ? buildSideBySide(diff.hunks) : [], [sideBySide, diff.hunks]);

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

  if (sideBySide) {
    return (
      <div className="font-mono text-xs flex flex-col h-full">
        {/* Stats + toggle */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 px-4 py-2 flex items-center gap-4">
          <span className="text-green-400">+{diff.additions}</span>
          <span className="text-red-400">-{diff.deletions}</span>
          <span className="text-zinc-500">{diff.status}</span>
          <button type="button" onClick={() => setSideBySide(false)} className="ml-auto flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded px-2 py-0.5" title="Vista unificada">
            <AlignLeft className="h-3 w-3" />
            Unificado
          </button>
        </div>
        {/* Side-by-side */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left */}
          <div className="flex-1 overflow-x-auto border-r border-zinc-700/50">
            <div className="px-2 py-1 bg-red-950/40 text-red-300 text-[11px] font-medium sticky top-0">
              {diff.old_path || diff.path} (anterior)
            </div>
            <table className="w-full">
              <tbody>
                {sideBySideRows.map((row, i) => {
                  if (row.isHunkHeader) return (
                    <tr key={i} className="bg-blue-950/30"><td colSpan={2} className="px-2 py-1 text-blue-300 text-[11px] truncate">{row.hunkHeader}</td></tr>
                  );
                  return (
                    <tr key={i} className={cn('h-[22px]', row.leftType === 'deletion' && 'bg-red-950/40', row.leftType === 'empty' && 'bg-zinc-900/60')}>
                      <td className="w-10 px-1 text-right text-zinc-500 select-none border-r border-zinc-700/40 text-[11px]">{row.leftLineNo || ''}</td>
                      <td className="px-2 whitespace-pre overflow-hidden">
                        {row.leftType === 'deletion' && <span className="text-red-400 mr-1 select-none">-</span>}
                        {row.leftType !== 'empty' && <HighlightedLine content={row.leftContent} language={language} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Right */}
          <div className="flex-1 overflow-x-auto">
            <div className="px-2 py-1 bg-green-950/40 text-green-300 text-[11px] font-medium sticky top-0">
              {diff.path} (atual)
            </div>
            <table className="w-full">
              <tbody>
                {sideBySideRows.map((row, i) => {
                  if (row.isHunkHeader) return (
                    <tr key={i} className="bg-blue-950/30"><td colSpan={2} className="px-2 py-1 text-blue-300 text-[11px] truncate">{row.hunkHeader}</td></tr>
                  );
                  return (
                    <tr key={i} className={cn('h-[22px]', row.rightType === 'addition' && 'bg-green-950/40', row.rightType === 'empty' && 'bg-zinc-900/60')}>
                      <td className="w-10 px-1 text-right text-zinc-500 select-none border-r border-zinc-700/40 text-[11px]">{row.rightLineNo || ''}</td>
                      <td className="px-2 whitespace-pre overflow-hidden">
                        {row.rightType === 'addition' && <span className="text-green-400 mr-1 select-none">+</span>}
                        {row.rightType !== 'empty' && <HighlightedLine content={row.rightContent} language={language} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="font-mono text-xs">
      {/* Stats */}
      <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 px-4 py-2 flex items-center gap-4">
        <span className="text-green-400">+{diff.additions}</span>
        <span className="text-red-400">-{diff.deletions}</span>
        <span className="text-zinc-500">{diff.status}</span>
        <button type="button" onClick={() => setSideBySide(true)} className="ml-auto flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded px-2 py-0.5" title="Vista lado a lado">
          <Columns2 className="h-3 w-3" />
          Lado a lado
        </button>
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
