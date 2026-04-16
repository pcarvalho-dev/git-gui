import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { git } from '@/services/git';

// Query Keys
export const queryKeys = {
  repoInfo: ['repo', 'info'] as const,
  repoStatus: ['repo', 'status'] as const,
  openRepos: ['open', 'repos'] as const,
  recentRepos: ['recent', 'repos'] as const,
  commits: (branch?: string) => ['commits', branch] as const,
  branches: ['branches'] as const,
  remotes: ['remotes'] as const,
  stashes: ['stashes'] as const,
  workingDiff: ['diff', 'working'] as const,
  stagedDiff: ['diff', 'staged'] as const,
  commitDiff: (hash: string) => ['diff', 'commit', hash] as const,
  fileDiff: (path: string, staged: boolean) => ['diff', 'file', path, staged] as const,
  compareRefs: (baseRef: string, headRef: string) => ['compare', baseRef, headRef] as const,
  pullRequests: (state?: string) => ['pullRequests', state] as const,
  pullRequest: (number: number) => ['pullRequest', number] as const,
  prReviews: (number: number) => ['prReviews', number] as const,
  prComments: (number: number) => ['prComments', number] as const,
  prFiles: (number: number) => ['prFiles', number] as const,
  ghCliStatus: ['ghCliStatus'] as const,
  gitConfig: (key: string) => ['gitConfig', key] as const,
  issues: (state?: string, label?: string, assignee?: string, milestone?: string) => ['issues', state, label, assignee, milestone] as const,
  issue: (number: number) => ['issue', number] as const,
  issueComments: (number: number) => ['issueComments', number] as const,
  githubProjects: ['githubProjects'] as const,
  labels: ['labels'] as const,
  milestones: ['milestones'] as const,
  collaborators: ['collaborators'] as const,
};

// Git Config Hooks
export function useGitConfig(key: string) {
  return useQuery({
    queryKey: queryKeys.gitConfig(key),
    queryFn: () => git.repo.getConfig(key),
    staleTime: Infinity,
  });
}

// Repository Hooks
export function useRepoInfo(enabled = true) {
  return useQuery({
    queryKey: queryKeys.repoInfo,
    queryFn: git.repo.getInfo,
    enabled,
    staleTime: Infinity,
  });
}

export function useRepoStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.repoStatus,
    queryFn: git.repo.getStatus,
    refetchInterval: 5000,
    enabled,
  });
}

export function useRecentRepos() {
  return useQuery({
    queryKey: queryKeys.recentRepos,
    queryFn: git.repo.getRecent,
    staleTime: 30000,
  });
}

export function useOpenRepos() {
  return useQuery({
    queryKey: queryKeys.openRepos,
    queryFn: git.repo.getOpenRepos,
    staleTime: 1000,
  });
}

export function useOpenRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (path: string) => git.repo.open(path),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.repoInfo, data);
      queryClient.invalidateQueries({ queryKey: queryKeys.openRepos });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentRepos });
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      queryClient.invalidateQueries({ queryKey: ['compare'] });
    },
  });
}

export function useCloneRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ url, path }: { url: string; path: string }) => git.repo.clone(url, path),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.repoInfo, data);
      queryClient.invalidateQueries({ queryKey: queryKeys.openRepos });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentRepos });
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      queryClient.invalidateQueries({ queryKey: ['compare'] });
    },
  });
}

export function useInitRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ path, bare }: { path: string; bare?: boolean }) => {
      const info = await git.repo.init(path, bare);
      if (bare) {
        return info;
      }
      return git.repo.open(path);
    },
    onSuccess: (data) => {
      if (!data.is_bare) {
        queryClient.setQueryData(queryKeys.repoInfo, data);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.openRepos });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentRepos });
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      queryClient.invalidateQueries({ queryKey: ['compare'] });
    },
  });
}

export function useCloseRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: git.repo.close,
    onSuccess: () => {
      // Set repo info to indicate no repo is open
      queryClient.setQueryData(queryKeys.repoInfo, { is_repo: false });
      // Clear all other cached data
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'repo' });
      queryClient.removeQueries({ queryKey: queryKeys.repoStatus });
      queryClient.removeQueries({ queryKey: ['compare'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.openRepos });
    },
  });
}

export function useCloseRepoById() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => git.repo.closeById(id),
    onSuccess: async () => {
      // First, get the updated list of open repos
      const openRepos = await git.repo.getOpenRepos();
      queryClient.setQueryData(queryKeys.openRepos, openRepos);

      if (openRepos.length === 0) {
        // No repos left - clear all data and show welcome screen
        queryClient.setQueryData(queryKeys.repoInfo, { is_repo: false });
        queryClient.removeQueries({ queryKey: queryKeys.repoStatus });
        queryClient.removeQueries({ queryKey: ['commits'] });
        queryClient.removeQueries({ queryKey: queryKeys.branches });
        queryClient.removeQueries({ queryKey: queryKeys.remotes });
        queryClient.removeQueries({ queryKey: queryKeys.stashes });
        queryClient.removeQueries({ queryKey: ['compare'] });
      } else {
        // Still have repos - refresh data for the new active repo
        queryClient.invalidateQueries({ queryKey: queryKeys.repoInfo });
        queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
        queryClient.invalidateQueries({ queryKey: ['commits'] });
        queryClient.invalidateQueries({ queryKey: queryKeys.branches });
        queryClient.invalidateQueries({ queryKey: ['compare'] });
      }
    },
  });
}

export function useSetActiveRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => git.repo.setActiveRepo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.openRepos });
      queryClient.invalidateQueries({ queryKey: queryKeys.repoInfo });
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      queryClient.invalidateQueries({ queryKey: queryKeys.remotes });
      queryClient.invalidateQueries({ queryKey: queryKeys.stashes });
      queryClient.invalidateQueries({ queryKey: ['pullRequests'] });
      queryClient.invalidateQueries({ queryKey: ['compare'] });
    },
  });
}

export function useRemoveRecentRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: git.repo.removeRecent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recentRepos });
    },
  });
}

// Commit Hooks
export function useCommits(branch?: string, limit = 100, enabled = true) {
  return useQuery({
    queryKey: queryKeys.commits(branch),
    queryFn: () => git.commit.list(branch, limit),
    enabled,
  });
}

export function useCreateCommit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ message, amend }: { message: string; amend?: boolean }) =>
      git.commit.create(message, amend),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      queryClient.invalidateQueries({ queryKey: ['compare'] });
    },
  });
}

export function useCherryPickCommit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commitHash: string) => git.commit.cherryPick(commitHash),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      queryClient.invalidateQueries({ queryKey: ['compare'] });
    },
  });
}

export function useRevertCommit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commitHash: string) => git.commit.revert(commitHash),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      queryClient.invalidateQueries({ queryKey: ['compare'] });
    },
  });
}

export function useResetCommit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commitHash, mode }: { commitHash: string; mode: 'soft' | 'mixed' | 'hard' }) =>
      git.commit.reset(commitHash, mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      queryClient.invalidateQueries({ queryKey: queryKeys.workingDiff });
      queryClient.invalidateQueries({ queryKey: queryKeys.stagedDiff });
      queryClient.invalidateQueries({ queryKey: ['compare'] });
    },
  });
}

// Staging Hooks
export function useStageFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: git.staging.stageFiles,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: queryKeys.workingDiff });
      queryClient.invalidateQueries({ queryKey: queryKeys.stagedDiff });
    },
  });
}

export function useUnstageFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: git.staging.unstageFiles,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: queryKeys.workingDiff });
      queryClient.invalidateQueries({ queryKey: queryKeys.stagedDiff });
    },
  });
}

export function useStageAll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: git.staging.stageAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
    },
  });
}

export function useUnstageAll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: git.staging.unstageAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
    },
  });
}

export function useDiscardChanges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: git.staging.discardChanges,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: queryKeys.workingDiff });
    },
  });
}

// Branch Hooks
export function useBranches(enabled = true) {
  return useQuery({
    queryKey: queryKeys.branches,
    queryFn: git.branch.list,
    enabled,
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, checkout }: { name: string; checkout?: boolean }) =>
      git.branch.create(name, checkout),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: ['compare'] });
    },
  });
}

export function useCheckoutBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: git.branch.checkout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: ['compare'] });
    },
  });
}

export function useDeleteBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      git.branch.delete(name, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      queryClient.invalidateQueries({ queryKey: ['compare'] });
    },
  });
}

export function useMergeBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: git.branch.merge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      queryClient.invalidateQueries({ queryKey: ['compare'] });
    },
  });
}

// Diff Hooks
export function useWorkingDiff() {
  return useQuery({
    queryKey: queryKeys.workingDiff,
    queryFn: git.diff.getWorking,
  });
}

export function useStagedDiff() {
  return useQuery({
    queryKey: queryKeys.stagedDiff,
    queryFn: git.diff.getStaged,
  });
}

export function useFileDiff(path: string, staged: boolean) {
  return useQuery({
    queryKey: queryKeys.fileDiff(path, staged),
    queryFn: () => git.diff.getFile(path, staged),
    enabled: !!path,
  });
}

export function useCompareRefs(baseRef: string, headRef: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.compareRefs(baseRef, headRef),
    queryFn: () => git.compare.refs(baseRef, headRef),
    enabled: enabled && !!baseRef.trim() && !!headRef.trim(),
  });
}

// Remote Hooks
export function useRemotes() {
  return useQuery({
    queryKey: queryKeys.remotes,
    queryFn: git.remote.list,
  });
}

export function useFetch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (remote?: string) => git.remote.fetch(remote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: ['compare'] });
    },
  });
}

export function usePull() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ remote, branch }: { remote: string; branch: string }) =>
      git.remote.pull(remote, branch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      queryClient.invalidateQueries({ queryKey: ['compare'] });
    },
  });
}

export function usePush() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ remote, branch, force }: { remote: string; branch: string; force?: boolean }) =>
      git.remote.push(remote, branch, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
    },
  });
}

// Stash Hooks
export function useStashes() {
  return useQuery({
    queryKey: queryKeys.stashes,
    queryFn: git.stash.list,
  });
}

export function useCreateStash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ message, includeUntracked, keepIndex, files }: {
      message?: string;
      includeUntracked?: boolean;
      keepIndex?: boolean;
      files?: string[];
    }) => git.stash.create(message, includeUntracked, keepIndex, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stashes });
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
    },
  });
}

export function useApplyStash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: git.stash.apply,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
    },
  });
}

export function usePopStash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: git.stash.pop,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stashes });
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
    },
  });
}

export function useDropStash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: git.stash.drop,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stashes });
    },
  });
}

// Utility hook for refreshing all data
export function useRefreshAll() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
    queryClient.invalidateQueries({ queryKey: ['commits'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.branches });
    queryClient.invalidateQueries({ queryKey: queryKeys.remotes });
    queryClient.invalidateQueries({ queryKey: queryKeys.stashes });
    queryClient.invalidateQueries({ queryKey: ['pullRequests'] });
    queryClient.invalidateQueries({ queryKey: ['compare'] });
  };
}

// Pull Request Hooks
export function useGitHubCliStatus() {
  const repoInfo = useQueryClient().getQueryData<{ is_repo: boolean }>(queryKeys.repoInfo);
  const repoOpen = repoInfo?.is_repo === true;
  return useQuery({
    queryKey: [...queryKeys.ghCliStatus, repoOpen] as const,
    queryFn: git.pr.checkCli,
    staleTime: 60000,
    retry: false,
    enabled: repoOpen,
  });
}

export function usePullRequests(state?: string) {
  return useQuery({
    queryKey: queryKeys.pullRequests(state),
    queryFn: () => git.pr.list(state),
    staleTime: 30000,
  });
}

export function usePullRequest(number: number) {
  return useQuery({
    queryKey: queryKeys.pullRequest(number),
    queryFn: () => git.pr.get(number),
    enabled: number > 0,
  });
}

export function usePRReviews(number: number) {
  return useQuery({
    queryKey: queryKeys.prReviews(number),
    queryFn: () => git.pr.getReviews(number),
    enabled: number > 0,
  });
}

export function usePRComments(number: number) {
  return useQuery({
    queryKey: queryKeys.prComments(number),
    queryFn: () => git.pr.getComments(number),
    enabled: number > 0,
  });
}

export function usePRFiles(number: number) {
  return useQuery({
    queryKey: queryKeys.prFiles(number),
    queryFn: () => git.pr.getFiles(number),
    enabled: number > 0,
  });
}

export function usePRDiff(number: number) {
  return useQuery({
    queryKey: ['prDiff', number] as const,
    queryFn: () => git.pr.getDiff(number),
    enabled: number > 0,
  });
}

export function useCreatePR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ title, body, base, head, draft }: {
      title: string;
      body: string | null;
      base: string;
      head?: string;
      draft?: boolean;
    }) => git.pr.create(title, body, base, head, draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pullRequests'] });
    },
  });
}

export function useReviewPR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ number, action, body }: {
      number: number;
      action: 'approve' | 'request-changes' | 'comment';
      body?: string;
    }) => git.pr.review(number, action, body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pullRequest(variables.number) });
      queryClient.invalidateQueries({ queryKey: queryKeys.prReviews(variables.number) });
    },
  });
}

export function useCommentPR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ number, body }: { number: number; body: string }) =>
      git.pr.comment(number, body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prComments(variables.number) });
    },
  });
}

export function useMergePR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ number, method, deleteBranch }: {
      number: number;
      method: 'merge' | 'squash' | 'rebase';
      deleteBranch?: boolean;
    }) => git.pr.merge(number, method, deleteBranch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pullRequests'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
    },
  });
}

export function useClosePR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: git.pr.close,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pullRequests'] });
    },
  });
}

export function useReopenPR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: git.pr.reopen,
    onSuccess: (_, number) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pullRequest(number) });
      queryClient.invalidateQueries({ queryKey: ['pullRequests'] });
    },
  });
}

export function useReadyPR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: git.pr.ready,
    onSuccess: (_, number) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pullRequest(number) });
      queryClient.invalidateQueries({ queryKey: ['pullRequests'] });
    },
  });
}

export function useCheckoutPR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: git.pr.checkout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
    },
  });
}

// ─── Issue Hooks ──────────────────────────

export function useIssues(
  state?: string,
  label?: string,
  assignee?: string,
  milestone?: string,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.issues(state, label, assignee, milestone),
    queryFn: () => git.issue.list(state, undefined, label, assignee, milestone),
    staleTime: 30000,
    enabled,
  });
}

export function useIssue(number: number) {
  return useQuery({
    queryKey: queryKeys.issue(number),
    queryFn: () => git.issue.get(number),
    enabled: number > 0,
  });
}

export function useIssueComments(number: number) {
  return useQuery({
    queryKey: queryKeys.issueComments(number),
    queryFn: () => git.issue.listComments(number),
    enabled: number > 0,
  });
}

export function useGitHubProjects() {
  return useQuery({
    queryKey: queryKeys.githubProjects,
    queryFn: git.issue.listProjects,
    staleTime: 60000,
    retry: false,
  });
}

export function useLabels() {
  return useQuery({
    queryKey: queryKeys.labels,
    queryFn: git.issue.listLabels,
    staleTime: 60000,
    retry: false,
  });
}

export function useCreateLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color, description }: { name: string; color: string; description?: string }) =>
      git.issue.createLabel(name, color, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels });
    },
  });
}

export function useMilestones() {
  return useQuery({
    queryKey: queryKeys.milestones,
    queryFn: git.issue.listMilestones,
    staleTime: 60000,
    retry: false,
  });
}

export function useCollaborators() {
  return useQuery({
    queryKey: queryKeys.collaborators,
    queryFn: git.issue.listCollaborators,
    staleTime: 120000,
    retry: false,
  });
}

export function useCreateIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title, body, labels, assignees, milestone, project }: {
      title: string;
      body?: string;
      labels?: string[];
      assignees?: string[];
      milestone?: string;
      project?: number;
    }) => git.issue.create(title, body, labels, assignees, milestone, project),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

export function useEditIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      number,
      ...opts
    }: {
      number: number;
      title?: string;
      body?: string;
      addLabels?: string[];
      removeLabels?: string[];
      addAssignees?: string[];
      removeAssignees?: string[];
      milestone?: string;
    }) => git.issue.edit(number, opts),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.setQueryData(['issue', updated.number], updated);
    },
  });
}

export function useCloseIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (number: number) => git.issue.close(number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

export function useReopenIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (number: number) => git.issue.reopen(number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

export function useAddIssueComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ number, body }: { number: number; body: string }) =>
      git.issue.addComment(number, body),
    onSuccess: (_, { number }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issueComments(number) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issue(number) });
    },
  });
}

export function useEditIssueComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: number; body: string; issueNumber: number }) =>
      git.issue.editComment(commentId, body),
    onSuccess: (_, { issueNumber }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issueComments(issueNumber) });
    },
  });
}

export function useDeleteIssueComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId }: { commentId: number; issueNumber: number }) =>
      git.issue.deleteComment(commentId),
    onSuccess: (_, { issueNumber }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issueComments(issueNumber) });
    },
  });
}

export function useEditLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ oldName, newName, color, description }: { oldName: string; newName: string; color: string; description: string }) =>
      git.issue.editLabel(oldName, newName, color, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels });
    },
  });
}

export function useDeleteLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => git.issue.deleteLabel(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels });
    },
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title, description, dueOn }: { title: string; description?: string; dueOn?: string }) =>
      git.issue.createMilestone(title, description, dueOn),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones });
    },
  });
}

export function useEditMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ number, title, description, dueOn, milestoneState }: {
      number: number;
      title: string;
      description?: string;
      dueOn?: string;
      milestoneState?: string;
    }) => git.issue.editMilestone(number, title, description, dueOn, milestoneState),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones });
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (number: number) => git.issue.deleteMilestone(number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones });
    },
  });
}

export function useLockIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ number, lockReason }: { number: number; lockReason?: string }) =>
      git.issue.lockIssue(number, lockReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

export function useUnlockIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (number: number) => git.issue.unlockIssue(number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

export function useIssueTimeline(number: number) {
  return useQuery({
    queryKey: ['issueTimeline', number],
    queryFn: () => git.issue.getTimeline(number),
    enabled: number > 0,
    staleTime: 30000,
  });
}

export function useIssueReactions(number: number) {
  return useQuery({
    queryKey: ['issueReactions', number],
    queryFn: () => git.issue.listReactions(number),
    enabled: number > 0,
    staleTime: 30000,
    retry: false,
  });
}

export function useAddIssueReaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ number, content }: { number: number; content: string }) =>
      git.issue.addReaction(number, content),
    onSuccess: (_, { number }) => {
      queryClient.invalidateQueries({ queryKey: ['issueReactions', number] });
    },
  });
}

export function useCommentReactions(commentId: number) {
  return useQuery({
    queryKey: ['commentReactions', commentId],
    queryFn: () => git.issue.listCommentReactions(commentId),
    enabled: commentId > 0,
    staleTime: 30000,
    retry: false,
  });
}

export function useAddCommentReaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: number; content: string }) =>
      git.issue.addCommentReaction(commentId, content),
    onSuccess: (_, { commentId }) => {
      queryClient.invalidateQueries({ queryKey: ['commentReactions', commentId] });
    },
  });
}

export function useIssueTemplates() {
  return useQuery({
    queryKey: ['issueTemplates'],
    queryFn: git.issue.listTemplates,
    staleTime: 300000,
    retry: false,
  });
}
