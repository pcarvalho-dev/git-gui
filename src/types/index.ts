// Repository
export interface RepoInfo {
  path: string;
  name: string;
  is_repo: boolean;
  is_bare: boolean;
  current_branch: string | null;
  has_remote: boolean;
  is_empty: boolean;
}

export interface RecentRepo {
  path: string;
  name: string;
  last_opened: number;
}

// Status
export interface RepoStatus {
  current_branch: string;
  head_commit: string | null;
  staged_files: FileStatus[];
  unstaged_files: FileStatus[];
  untracked_files: string[];
  conflicted_files: string[];
  ahead: number;
  behind: number;
  is_rebasing: boolean;
  is_merging: boolean;
  is_cherry_picking: boolean;
}

export interface FileStatus {
  path: string;
  status: FileStatusType;
  is_binary: boolean;
}

export type FileStatusType = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'untracked' | 'ignored' | 'conflicted';

export interface PartialHunkSelection {
  hunk_index: number;
  line_indexes?: number[];
}

// Commits
export interface CommitInfo {
  hash: string;
  short_hash: string;
  message: string;
  summary: string;
  body: string | null;
  author_name: string;
  author_email: string;
  author_date: number;
  committer_name: string;
  committer_email: string;
  committer_date: number;
  parents: string[];
  is_merge: boolean;
}

export interface CompareResult {
  base_ref: string;
  head_ref: string;
  base_hash: string;
  head_hash: string;
  merge_base_hash: string | null;
  diff_base_hash: string;
  uses_merge_base: boolean;
  ahead: number;
  behind: number;
  base_only_commits: CommitInfo[];
  head_only_commits: CommitInfo[];
  diff: DiffInfo[];
}

// Branches
export interface BranchInfo {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  is_head: boolean;
  commit_hash: string | null;
  commit_message: string | null;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
  author_name: string | null;
  author_email: string | null;
  commit_date: number | null;
}

// Diff
export interface DiffInfo {
  path: string;
  old_path: string | null;
  status: string;
  additions: number;
  deletions: number;
  is_binary: boolean;
  hunks: HunkInfo[];
}

export interface HunkInfo {
  header: string;
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: LineInfo[];
}

export interface LineInfo {
  old_line: number | null;
  new_line: number | null;
  content: string;
  origin: string;
  line_type: LineType;
}

export type LineType = 'context' | 'addition' | 'deletion' | 'header' | 'binary';

export interface BlameInfo {
  line: number;
  commit_hash: string;
  author: string;
  date: number;
  content: string;
}

// Remote
export interface RemoteInfo {
  name: string;
  fetch_url: string;
  push_url: string;
}

// Stash
export interface StashInfo {
  index: number;
  message: string;
  commit_hash: string;
  branch: string | null;
  date: number;
}

// Error
export interface AppError {
  code: string;
  message: string;
  details: string | null;
}

// Pull Requests
export interface PullRequest {
  number: number;
  title: string;
  body: string | null;
  state: string;
  author: string;
  head_branch: string;
  base_branch: string;
  url: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  draft: boolean;
  mergeable: boolean | null;
  additions: number;
  deletions: number;
  changed_files: number;
  reviewers: string[];
  labels: string[];
}

export interface PullRequestReview {
  id: number;
  author: string;
  state: string;
  body: string | null;
  submitted_at: string;
}

export interface PullRequestComment {
  id: number;
  author: string;
  body: string;
  path: string | null;
  line: number | null;
  created_at: string;
}

export interface PullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string | null;
}

// Issues
export interface IssueLabel {
  name: string;
  color: string;
  description: string | null;
}

export interface IssueMilestone {
  number: number;
  title: string;
  description: string | null;
  state: string;
  open_issues: number;
  closed_issues: number;
  due_on: string | null;
}

export interface Collaborator {
  login: string;
  avatar_url: string;
}

export interface Issue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  author: string;
  labels: IssueLabel[];
  assignees: string[];
  milestone_number: number | null;
  milestone_title: string | null;
  url: string;
  created_at: string;
  updated_at: string;
  comments_count: number;
  locked: boolean;
  active_lock_reason: string | null;
}

export interface IssueTemplate {
  name: string;
  about: string;
  title: string;
  body: string;
}

export interface CheckRun {
  name: string;
  state: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  link: string;
  workflow_name: string | null;
  bucket: string | null;
}

export interface IssueReaction {
  id: number;
  content: string;
  user: { login: string; avatar_url: string } | null;
}

export interface IssueTimelineEvent {
  event: string;
  actor: { login: string; avatar_url: string } | null;
  created_at: string;
  label?: { name: string; color: string };
  assignee?: { login: string };
  milestone?: { title: string };
  rename?: { from: string; to: string };
  body?: string;
  id?: number;
  author?: { login: string; avatar_url: string };
}

export interface IssueComment {
  id: number;
  author: string;
  body: string;
  created_at: string;
}

export interface GitHubProject {
  number: number;
  title: string;
  url: string;
  closed: boolean;
}

// Interactive Rebase
export type RebaseActionType = 'pick' | 'reword' | 'squash' | 'fixup' | 'drop';

export interface RebaseEntry {
  hash: string;
  action: RebaseActionType;
  message?: string;
}

// Conflict Resolution
export interface ConflictInfo {
  path: string;
  ours_content: string;
  theirs_content: string;
  base_content: string | null;
  conflicts: ConflictSection[];
}

export interface ConflictSection {
  id: number;
  ours: string;
  theirs: string;
  base: string | null;
  start_line: number;
  end_line: number;
}
