import { invoke } from '@tauri-apps/api/core';
import type {
  RepoInfo,
  RepoStatus,
  RecentRepo,
  CommitInfo,
  BranchInfo,
  DiffInfo,
  BlameInfo,
  RemoteInfo,
  StashInfo,
  PullRequest,
  PullRequestReview,
  PullRequestComment,
  PullRequestFile,
  ConflictInfo,
} from '@/types';

// Repository
export const repoService = {
  open: (path: string) => invoke<RepoInfo>('open_repo', { path }),
  close: () => invoke<void>('close_repo'),
  getInfo: () => invoke<RepoInfo>('get_repo_info'),
  getStatus: () => invoke<RepoStatus>('get_repo_status'),
  init: (path: string, bare = false) => invoke<RepoInfo>('init_repo', { path, bare }),
  clone: (url: string, path: string) => invoke<RepoInfo>('clone_repo', { url, path }),
  getRecent: () => invoke<RecentRepo[]>('get_recent_repos'),
  removeRecent: (path: string) => invoke<void>('remove_recent_repo', { path }),
  clearRecent: () => invoke<void>('clear_recent_repos'),
  getConfig: (key: string) => invoke<string | null>('get_git_config_value', { key }),
  setConfig: (key: string, value: string) => invoke<void>('set_git_config_value', { key, value }),
  openInVscode: () => invoke<void>('open_in_vscode'),
  readFile: (path: string) => invoke<string>('read_file', { path }),
  writeFile: (path: string, content: string) => invoke<void>('write_file', { path, content }),
};

// Commits
export const commitService = {
  list: (branch?: string, limit = 100, skip = 0) =>
    invoke<CommitInfo[]>('get_commits', { branch, limit, skip }),
  get: (hash: string) => invoke<CommitInfo>('get_commit', { hash }),
  create: (message: string, amend = false) =>
    invoke<string>('create_commit', { message, amend }),
  cherryPick: (commitHash: string) => invoke<string>('cherry_pick', { commitHash }),
  revert: (commitHash: string) => invoke<string>('revert_commit', { commitHash }),
  reset: (commitHash: string, mode: 'soft' | 'mixed' | 'hard') =>
    invoke<void>('reset_to_commit', { commitHash, mode }),
};

// Staging
export const stagingService = {
  stageFiles: (files: string[]) => invoke<void>('stage_files', { files }),
  unstageFiles: (files: string[]) => invoke<void>('unstage_files', { files }),
  stageAll: () => invoke<void>('stage_all'),
  unstageAll: () => invoke<void>('unstage_all'),
  discardChanges: (files: string[]) => invoke<void>('discard_changes', { files }),
};

// Branches
export const branchService = {
  list: () => invoke<BranchInfo[]>('get_branches'),
  getCurrent: () => invoke<string>('get_current_branch'),
  create: (name: string, checkout = false) =>
    invoke<void>('create_branch', { name, checkout }),
  checkout: (name: string) => invoke<void>('checkout_branch', { name }),
  delete: (name: string, force = false) =>
    invoke<void>('delete_branch', { name, force }),
  rename: (oldName: string, newName: string) =>
    invoke<void>('rename_branch', { oldName, newName }),
  merge: (name: string) => invoke<string>('merge_branch', { name }),
};

// Diff
export const diffService = {
  getWorking: () => invoke<DiffInfo[]>('get_working_diff'),
  getStaged: () => invoke<DiffInfo[]>('get_staged_diff'),
  getCommit: (commitHash: string) => invoke<DiffInfo[]>('get_commit_diff', { commitHash }),
  getFile: (path: string, staged: boolean) =>
    invoke<DiffInfo>('get_file_diff', { path, staged }),
  getBlame: (path: string) => invoke<BlameInfo[]>('get_file_blame', { path }),
};

// Remote
export const remoteService = {
  list: () => invoke<RemoteInfo[]>('get_remotes'),
  add: (name: string, url: string) => invoke<void>('add_remote', { name, url }),
  remove: (name: string) => invoke<void>('remove_remote', { name }),
  rename: (oldName: string, newName: string) =>
    invoke<void>('rename_remote', { oldName, newName }),
  fetch: (remote?: string) => invoke<void>('fetch_remote', { remote }),
  pull: (remote: string, branch: string) =>
    invoke<string>('pull_remote', { remote, branch }),
  push: (remote: string, branch: string, force = false) =>
    invoke<void>('push_remote', { remote, branch, force }),
  setUpstream: (branch: string, remote: string, remoteBranch: string) =>
    invoke<void>('set_upstream', { branch, remote, remoteBranch }),
};

// Stash
export const stashService = {
  list: () => invoke<StashInfo[]>('get_stash_list'),
  create: (message?: string, includeUntracked = false, keepIndex = false) =>
    invoke<string>('create_stash', { message, includeUntracked, keepIndex }),
  apply: (index: number) => invoke<void>('apply_stash', { index }),
  pop: (index: number) => invoke<void>('pop_stash', { index }),
  drop: (index: number) => invoke<void>('drop_stash', { index }),
  clear: () => invoke<void>('clear_stashes'),
};

// Pull Requests (GitHub)
export const prService = {
  checkCli: () => invoke<boolean>('check_github_cli'),
  list: (state?: string, limit?: number) =>
    invoke<PullRequest[]>('list_pull_requests', { prState: state, limit }),
  get: (number: number) => invoke<PullRequest>('get_pull_request', { number }),
  create: (title: string, body: string | null, base: string, head?: string, draft = false) =>
    invoke<PullRequest>('create_pull_request', { title, body, base, head, draft }),
  getReviews: (number: number) =>
    invoke<PullRequestReview[]>('get_pull_request_reviews', { number }),
  getComments: (number: number) =>
    invoke<PullRequestComment[]>('get_pull_request_comments', { number }),
  getFiles: (number: number) =>
    invoke<PullRequestFile[]>('get_pull_request_files', { number }),
  review: (number: number, action: 'approve' | 'request-changes' | 'comment', body?: string) =>
    invoke<void>('review_pull_request', { number, action, body }),
  comment: (number: number, body: string) =>
    invoke<void>('comment_pull_request', { number, body }),
  merge: (number: number, method: 'merge' | 'squash' | 'rebase', deleteBranch = false) =>
    invoke<void>('merge_pull_request', { number, method, deleteBranch }),
  close: (number: number) => invoke<void>('close_pull_request', { number }),
  reopen: (number: number) => invoke<void>('reopen_pull_request', { number }),
  ready: (number: number) => invoke<void>('ready_pull_request', { number }),
  getDiff: (number: number) => invoke<string>('get_pull_request_diff', { number }),
  checkout: (number: number) => invoke<void>('checkout_pull_request', { number }),
};

// Conflict Resolution
export const conflictService = {
  getInfo: (path: string) => invoke<ConflictInfo>('get_conflict_info', { path }),
  getFile: (path: string) => invoke<string>('get_conflicted_file', { path }),
  resolve: (path: string, content: string, markResolved = true) =>
    invoke<void>('resolve_conflict', { path, content, markResolved }),
  abortMerge: () => invoke<void>('abort_merge'),
};

// Unified API
export const git = {
  repo: repoService,
  commit: commitService,
  staging: stagingService,
  branch: branchService,
  diff: diffService,
  remote: remoteService,
  stash: stashService,
  pr: prService,
  conflict: conflictService,
};

export default git;
