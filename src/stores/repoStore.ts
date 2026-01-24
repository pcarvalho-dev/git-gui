import { create } from 'zustand';

// Simplified store - most state is now managed by React Query
interface RepoStore {
  selectedCommitHash: string | null;
  selectedFilePath: string | null;
  setSelectedCommitHash: (hash: string | null) => void;
  setSelectedFilePath: (path: string | null) => void;
}

export const useRepoStore = create<RepoStore>((set) => ({
  selectedCommitHash: null,
  selectedFilePath: null,
  setSelectedCommitHash: (hash) => set({ selectedCommitHash: hash }),
  setSelectedFilePath: (path) => set({ selectedFilePath: path }),
}));
