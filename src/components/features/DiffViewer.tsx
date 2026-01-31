import { useMemo } from 'react';
import type { DiffInfo, LineInfo } from '@/types';
import { cn } from '@/lib/utils';
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
}

export default function DiffViewer({ diff }: DiffViewerProps) {
  const language = useMemo(() => getLanguageFromPath(diff.path), [diff.path]);

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
          <div className="bg-blue-950/30 px-4 py-1 text-blue-300 sticky top-9">
            {hunk.header}
          </div>

          {/* Lines */}
          <div>
            {hunk.lines.map((line, lineIdx) => (
              <div
                key={lineIdx}
                className={cn(
                  'flex hover:bg-zinc-800/50 transition-colors',
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
