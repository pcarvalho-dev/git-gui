import { create } from 'zustand';
import type { AppView } from '@/lib/navigation';

interface RepoStore {
  selectedCommitHash: string | null;
  selectedFilePath: string | null;
  selectedFileStaged: boolean;
  selectedIssueNumber: number | null;
  compareBaseRef: string | null;
  compareHeadRef: string | null;
  pendingNavView: AppView | null;
  setSelectedCommitHash: (hash: string | null) => void;
  setSelectedFilePath: (path: string | null, staged?: boolean) => void;
  setSelectedIssueNumber: (number: number | null) => void;
  setCompareRefs: (baseRef: string | null, headRef: string | null) => void;
  setPendingNavView: (view: AppView | null) => void;
  clearSelections: () => void;
}

export const useRepoStore = create<RepoStore>((set) => ({
  selectedCommitHash: null,
  selectedFilePath: null,
  selectedFileStaged: false,
  selectedIssueNumber: null,
  compareBaseRef: null,
  compareHeadRef: null,
  pendingNavView: null,
  setSelectedCommitHash: (hash) => set({ selectedCommitHash: hash }),
  setSelectedFilePath: (path, staged = false) =>
    set({
      selectedFilePath: path,
      selectedFileStaged: path ? staged : false,
    }),
  setSelectedIssueNumber: (number) => set({ selectedIssueNumber: number }),
  setCompareRefs: (baseRef, headRef) =>
    set({
      compareBaseRef: baseRef,
      compareHeadRef: headRef,
    }),
  setPendingNavView: (view) => set({ pendingNavView: view }),
  clearSelections: () =>
    set({
      selectedCommitHash: null,
      selectedFilePath: null,
      selectedFileStaged: false,
      selectedIssueNumber: null,
      compareBaseRef: null,
      compareHeadRef: null,
    }),
}));
