import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { git } from '@/services/git';

// Query Keys
export const queryKeys = {
  repoInfo: ['repo', 'info'] as const,
  repoStatus: ['repo', 'status'] as const,
  recentRepos: ['recent', 'repos'] as const,
  commits: (branch?: string) => ['commits', branch] as const,
  branches: ['branches'] as const,
  remotes: ['remotes'] as const,
  stashes: ['stashes'] as const,
  workingDiff: ['diff', 'working'] as const,
  stagedDiff: ['diff', 'staged'] as const,
  commitDiff: (hash: string) => ['diff', 'commit', hash] as const,
  fileDiff: (path: string, staged: boolean) => ['diff', 'file', path, staged] as const,
};

// Repository Hooks
export function useRepoInfo(enabled = true) {
  return useQuery({
    queryKey: queryKeys.repoInfo,
    queryFn: git.repo.getInfo,
    enabled,
    staleTime: Infinity,
  });
}

export function useRepoStatus() {
  return useQuery({
    queryKey: queryKeys.repoStatus,
    queryFn: git.repo.getStatus,
    refetchInterval: 5000, // Auto-refresh every 5s
  });
}

export function useRecentRepos() {
  return useQuery({
    queryKey: queryKeys.recentRepos,
    queryFn: git.repo.getRecent,
    staleTime: 30000,
  });
}

export function useOpenRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (path: string) => git.repo.open(path),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.repoInfo, data);
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
      queryClient.setQueryData(queryKeys.repoInfo, null);
      queryClient.clear();
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
  };
}
