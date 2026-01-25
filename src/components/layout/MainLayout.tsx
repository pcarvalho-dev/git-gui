import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useRepoInfo, useRepoStatus, useOpenRepo, useRecentRepos, useRemoveRecentRepo, useRefreshAll } from '@/hooks/useGit';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import Sidebar from './Sidebar';
import WelcomeScreen from '../features/WelcomeScreen';
import WorkingArea from '../features/WorkingArea';
import CommitGraph from '../features/CommitGraph';
import BranchManager from '../features/BranchManager';
import CommitHistory from '../features/CommitHistory';
import StashPanel from '../features/StashPanel';
import RemoteManager from '../features/RemoteManager';
import PullRequestManager from '../features/PullRequestManager';
import SideBySideDiff from '../features/SideBySideDiff';
import Terminal from '../features/Terminal';
import Settings from '../features/Settings';

import { AlertCircle, Loader2 } from 'lucide-react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useToast } from '@/components/ui/use-toast';
import { useDiffViewerStore } from '@/stores/diffViewerStore';
import { useTerminalStore } from '@/stores/terminalStore';

type View = 'graph' | 'files' | 'branches' | 'history' | 'stash' | 'remote' | 'pr';

export default function MainLayout() {
  const [view, setView] = useState<View>('files');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { toast } = useToast();
  const { closeDiff, isOpen: isDiffOpen, nextDiff, prevDiff } = useDiffViewerStore();
  const { toggleTerminal } = useTerminalStore();

  const { data: repoInfo } = useRepoInfo();
  const isRepoOpen = repoInfo?.is_repo === true;
  const { data: status, isLoading: statusLoading, error } = useRepoStatus(isRepoOpen);
  const openRepo = useOpenRepo();
  const recentRepos = useRecentRepos();
  const removeRecent = useRemoveRecentRepo();
  const refreshAll = useRefreshAll();

  useKeyboardShortcuts([
    { key: '1', ctrl: true, action: () => setView('graph') },
    { key: '2', ctrl: true, action: () => setView('files') },
    { key: '3', ctrl: true, action: () => setView('branches') },
    { key: '4', ctrl: true, action: () => setView('history') },
    { key: '5', ctrl: true, action: () => setView('stash') },
    { key: '6', ctrl: true, action: () => setView('remote') },
    { key: '7', ctrl: true, action: () => setView('pr') },
    { key: 'r', ctrl: true, action: refreshAll },
    { key: '`', ctrl: true, action: toggleTerminal },
    { key: 'Escape', action: () => isDiffOpen && closeDiff() },
    { key: 'ArrowRight', action: () => isDiffOpen && nextDiff() },
    { key: 'ArrowLeft', action: () => isDiffOpen && prevDiff() },
  ]);

  const handleOpenRepo = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Selecionar Repositório Git',
      });

      if (selected && typeof selected === 'string') {
        const info = await openRepo.mutateAsync(selected);
        if (!info.is_repo) {
          toast({
            title: 'Erro',
            description: 'O diretório selecionado não é um repositório Git válido',
            variant: 'destructive',
          });
        }
      }
    } catch (err) {
      if (err !== 'User cancelled') {
        toast({
          title: 'Erro',
          description: `Erro ao abrir repositório: ${err}`,
          variant: 'destructive',
        });
      }
    }
  };

  const handleOpenRecent = async (path: string) => {
    try {
      const info = await openRepo.mutateAsync(path);
      if (!info.is_repo) {
        toast({
          title: 'Erro',
          description: 'O diretório não é mais um repositório Git válido',
          variant: 'destructive',
        });
        removeRecent.mutate(path);
      }
    } catch (err) {
      toast({
        title: 'Erro',
        description: `Erro ao abrir repositório: ${err}`,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveRecent = (path: string) => {
    removeRecent.mutate(path);
  };

  // Show welcome screen if no repo is open
  if (!isRepoOpen) {
    return (
      <WelcomeScreen
        recentRepos={recentRepos.data || []}
        isLoading={recentRepos.isLoading || openRepo.isPending}
        onOpenRepo={handleOpenRepo}
        onOpenRecent={handleOpenRecent}
        onRemoveRecent={handleRemoveRecent}
      />
    );
  }

  return (
    <div className="h-screen bg-background">
      <SideBySideDiff />
      <Settings open={settingsOpen} onOpenChange={setSettingsOpen} />
      <PanelGroup direction="horizontal" autoSaveId="main-layout">
        <Panel defaultSize={15} minSize={10} maxSize={30}>
          <Sidebar
            view={view}
            setView={setView}
            repoInfo={repoInfo}
            status={status}
            onRefresh={refreshAll}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </Panel>

        <PanelResizeHandle className="resize-handle resize-handle-horizontal" />

        <Panel minSize={50}>
          <main className="h-full flex flex-col overflow-hidden">
            {/* Error Banner */}
            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{error instanceof Error ? error.message : 'Erro desconhecido'}</span>
              </div>
            )}

            {/* Loading Indicator */}
            {statusLoading && (
              <div className="absolute top-2 right-2 z-50">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Main Content */}
            <div className="flex-1 overflow-hidden">
              {view === 'graph' && <CommitGraph />}
              {view === 'files' && <WorkingArea />}
              {view === 'branches' && <BranchManager />}
              {view === 'history' && <CommitHistory />}
              {view === 'stash' && <StashPanel />}
              {view === 'remote' && <RemoteManager />}
              {view === 'pr' && <PullRequestManager />}
            </div>

            {/* Terminal */}
            <Terminal />
          </main>
        </Panel>
      </PanelGroup>
    </div>
  );
}
