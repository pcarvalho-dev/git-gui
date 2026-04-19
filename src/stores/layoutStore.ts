import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppView } from '@/lib/navigation';

export type IssueSort = 'newest' | 'oldest' | 'most-commented' | 'recently-updated' | 'least-updated';
export type IssueViewMode = 'list' | 'board';
export type FilterValue = 'open' | 'closed' | 'all';

interface LayoutStore {
  lastView: AppView;
  prFilter: FilterValue;
  issueStateFilter: FilterValue;
  issueSort: IssueSort;
  issueViewMode: IssueViewMode;

  setLastView: (view: AppView) => void;
  setPrFilter: (filter: FilterValue) => void;
  setIssueStateFilter: (filter: FilterValue) => void;
  setIssueSort: (sort: IssueSort) => void;
  setIssueViewMode: (mode: IssueViewMode) => void;
}

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
      lastView: 'files',
      prFilter: 'open',
      issueStateFilter: 'open',
      issueSort: 'newest',
      issueViewMode: 'list',

      setLastView: (lastView) => set({ lastView }),
      setPrFilter: (prFilter) => set({ prFilter }),
      setIssueStateFilter: (issueStateFilter) => set({ issueStateFilter }),
      setIssueSort: (issueSort) => set({ issueSort }),
      setIssueViewMode: (issueViewMode) => set({ issueViewMode }),
    }),
    {
      name: 'layout-state',
    }
  )
);
