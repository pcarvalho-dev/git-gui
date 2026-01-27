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
  pullRequests: (state?: string) => ['pullRequests', state] as const,
  pullRequest: (number: number) => ['pullRequest', number] as const,
  prReviews: (number: number) => ['prReviews', number] as const,
  prComments: (number: number) => ['prComments', number] as const,
  prFiles: (number: number) => ['prFiles', number] as const,
  ghCliStatus: ['ghCliStatus'] as const,
  gitConfig: (key: string) => ['gitConfig', key] as const,
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
    refetchInterval: enabled ? 5000 : false, // Auto-refresh every 5s only when enabled
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
      } else {
        // Still have repos - refresh data for the new active repo
        queryClient.invalidateQueries({ queryKey: queryKeys.repoInfo });
        queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
        queryClient.invalidateQueries({ queryKey: ['commits'] });
        queryClient.invalidateQueries({ queryKey: queryKeys.branches });
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
export function useCommits(branch?: string, limit = 100) {
  return useQuery({
    queryKey: queryKeys.commits(branch),
    queryFn: () => git.commit.list(branch, limit),
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
export function useBranches() {
  return useQuery({
    queryKey: queryKeys.branches,
    queryFn: git.branch.list,
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
    mutationFn: ({ message, includeUntracked, keepIndex }: {
      message?: string;
      includeUntracked?: boolean;
      keepIndex?: boolean;
    }) => git.stash.create(message, includeUntracked, keepIndex),
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
  };
}

// Pull Request Hooks
export function useGitHubCliStatus() {
  return useQuery({
    queryKey: queryKeys.ghCliStatus,
    queryFn: git.pr.checkCli,
    staleTime: 60000,
    retry: false,
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
    onSuccess: () => {
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
