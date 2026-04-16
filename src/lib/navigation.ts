import {
  Archive,
  ArrowRightLeft,
  CircleDot,
  Cloud,
  FileText,
  GitBranch,
  GitPullRequestDraft,
  History,
  Network,
  type LucideIcon,
} from 'lucide-react';

export type AppView =
  | 'graph'
  | 'files'
  | 'branches'
  | 'history'
  | 'compare'
  | 'stash'
  | 'remote'
  | 'pr'
  | 'issues';

export interface AppViewConfig {
  id: AppView;
  label: string;
  icon: LucideIcon;
  shortcut: string;
  keywords: string[];
}

export const APP_VIEWS: AppViewConfig[] = [
  {
    id: 'graph',
    label: 'Grafo',
    icon: Network,
    shortcut: '1',
    keywords: ['commits', 'graph', 'history', 'visualizacao'],
  },
  {
    id: 'files',
    label: 'Arquivos',
    icon: FileText,
    shortcut: '2',
    keywords: ['files', 'working tree', 'changes', 'diff'],
  },
  {
    id: 'branches',
    label: 'Branches',
    icon: GitBranch,
    shortcut: '3',
    keywords: ['branch', 'checkout', 'merge'],
  },
  {
    id: 'history',
    label: 'Historico',
    icon: History,
    shortcut: '4',
    keywords: ['commits', 'log', 'history'],
  },
  {
    id: 'compare',
    label: 'Compare',
    icon: ArrowRightLeft,
    shortcut: '9',
    keywords: ['compare', 'branches', 'commits', 'diff', 'range'],
  },
  {
    id: 'stash',
    label: 'Stash',
    icon: Archive,
    shortcut: '5',
    keywords: ['stash', 'shelve'],
  },
  {
    id: 'remote',
    label: 'Remotos',
    icon: Cloud,
    shortcut: '6',
    keywords: ['remote', 'origin', 'push', 'pull'],
  },
  {
    id: 'pr',
    label: 'Pull Requests',
    icon: GitPullRequestDraft,
    shortcut: '7',
    keywords: ['pull request', 'pr', 'review'],
  },
  {
    id: 'issues',
    label: 'Issues',
    icon: CircleDot,
    shortcut: '8',
    keywords: ['issues', 'github', 'tickets'],
  },
];
