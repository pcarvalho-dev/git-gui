import { create } from "zustand";
import type { DiffInfo, CommitInfo } from "@/types";

interface DiffViewerState {
  isOpen: boolean;
  diff: DiffInfo | null;
  commit: CommitInfo | null;
  allDiffs: DiffInfo[];
  currentIndex: number;
  openDiff: (diff: DiffInfo, commit: CommitInfo, allDiffs?: DiffInfo[]) => void;
  closeDiff: () => void;
  nextDiff: () => void;
  prevDiff: () => void;
  goToDiff: (index: number) => void;
}

export const useDiffViewerStore = create<DiffViewerState>()((set, get) => ({
  isOpen: false,
  diff: null,
  commit: null,
  allDiffs: [],
  currentIndex: 0,

  openDiff: (diff, commit, allDiffs = []) => {
    const index = allDiffs.findIndex((d) => d.path === diff.path);
    set({
      isOpen: true,
      diff,
      commit,
      allDiffs,
      currentIndex: index >= 0 ? index : 0,
    });
  },

  closeDiff: () =>
    set({
      isOpen: false,
      diff: null,
      commit: null,
      allDiffs: [],
      currentIndex: 0,
    }),

  nextDiff: () => {
    const { allDiffs, currentIndex } = get();
    if (currentIndex < allDiffs.length - 1) {
      const newIndex = currentIndex + 1;
      set({
        currentIndex: newIndex,
        diff: allDiffs[newIndex],
      });
    }
  },

  prevDiff: () => {
    const { allDiffs, currentIndex } = get();
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      set({
        currentIndex: newIndex,
        diff: allDiffs[newIndex],
      });
    }
  },

  goToDiff: (index) => {
    const { allDiffs } = get();
    if (index >= 0 && index < allDiffs.length) {
      set({
        currentIndex: index,
        diff: allDiffs[index],
      });
    }
  },
}));
