import { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  useCloneRepo,
  useInitRepo,
  useOpenRepo,
  useOpenRepos,
  useRecentRepos,
  useRefreshAll,
  useRemoveRecentRepo,
  useRepoInfo,
  useRepoStatus,
} from '@/hooks/useGit';
import { useUpdateChecker } from '@/hooks/useUpdateChecker';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useToast } from '@/components/ui/use-toast';
import { useDiffViewerStore } from '@/stores/diffViewerStore';
import { useRepoStore } from '@/stores/repoStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { type AppView } from '@/lib/navigation';
import { getErrorMessage } from '@/lib/error';
import UpdateDialog from '../features/UpdateDialog';
import WelcomeScreen from '../features/WelcomeScreen';
import WorkingArea from '../features/WorkingArea';
import CommitGraph from '../features/CommitGraph';
import BranchManager from '../features/BranchManager';
import CommitHistory from '../features/CommitHistory';
import StashPanel from '../features/StashPanel';
import RemoteManager from '../features/RemoteManager';
import PullRequestManager from '../features/PullRequestManager';
import IssuesManager from '../features/IssuesManager';
import CompareView from '../features/CompareView';
import SideBySideDiff from '../features/SideBySideDiff';
import Terminal from '../features/Terminal';
import Settings from '../features/Settings';
import CommandPalette from '../features/CommandPalette';
import Sidebar from './Sidebar';
import RepoTabs from './RepoTabs';

export default function MainLayout() {
  const [view, setView] = useState<AppView>('files');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { toast } = useToast();
  const { closeDiff, isOpen: isDiffOpen, nextDiff, prevDiff } = useDiffViewerStore();
  const { toggleTerminal } = useTerminalStore();
  const clearSelections = useRepoStore((state) => state.clearSelections);
  const setCompareRefs = useRepoStore((state) => state.setCompareRefs);
  const {
    update,
    downloading,
    installing,
    canAutoUpdate,
    checkForUpdate,
    downloadAndInstall,
    downloadAndInstallDeb,
    dismissUpdate,
  } = useUpdateChecker();

  useEffect(() => {
    let isMounted = true;

    const timer = setTimeout(() => {
      checkForUpdate()
        .then((pendingUpdate) => {
          if (isMounted && pendingUpdate) {
            setUpdateDialogOpen(true);
          }
        })
        .catch(() => {
          // Ignore errors during hot reload.
        });
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [checkForUpdate]);

  const { data: repoInfo } = useRepoInfo();
  const { data: openRepos } = useOpenRepos();
  const hasOpenRepos = (openRepos?.length || 0) > 0;
  const isRepoOpen = repoInfo?.is_repo === true;
  const { data: status, isLoading: statusLoading, error } = useRepoStatus(isRepoOpen);
  const openRepo = useOpenRepo();
  const cloneRepo = useCloneRepo();
  const initRepo = useInitRepo();
  const recentRepos = useRecentRepos();
  const removeRecent = useRemoveRecentRepo();
  const refreshAll = useRefreshAll();

  useEffect(() => {
    if (repoInfo?.path) {
      clearSelections();
    }
  }, [clearSelections, repoInfo?.path]);

  useKeyboardShortcuts([
    { key: '1', ctrl: true, action: () => setView('graph') },
    { key: '2', ctrl: true, action: () => setView('files') },
    { key: '3', ctrl: true, action: () => setView('branches') },
    { key: '4', ctrl: true, action: () => setView('history') },
    { key: '9', ctrl: true, action: () => setView('compare') },
    { key: '5', ctrl: true, action: () => setView('stash') },
    { key: '6', ctrl: true, action: () => setView('remote') },
    { key: '7', ctrl: true, action: () => setView('pr') },
    { key: '8', ctrl: true, action: () => setView('issues') },
    { key: 'k', ctrl: true, action: () => setCommandPaletteOpen((open) => !open) },
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
        title: 'Selecionar repositorio Git',
      });

      if (selected && typeof selected === 'string') {
        const info = await openRepo.mutateAsync(selected);
        if (!info.is_repo) {
          toast({
            title: 'Erro',
            description: 'O diretorio selecionado nao e um repositorio Git valido',
            variant: 'destructive',
          });
        }
      }
    } catch (err) {
      if (err !== 'User cancelled') {
        toast({
          title: 'Erro',
          description: `Erro ao abrir repositorio: ${err}`,
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
          description: 'O diretorio nao e mais um repositorio Git valido',
          variant: 'destructive',
        });
        removeRecent.mutate(path);
      }
    } catch (err) {
      toast({
        title: 'Erro',
        description: `Erro ao abrir repositorio: ${err}`,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveRecent = (path: string) => {
    removeRecent.mutate(path);
  };

  const handleClearRecent = () => {
    recentRepos.data?.forEach((repo) => removeRecent.mutate(repo.path));
  };

  const handleCloneRepo = async (url: string, path: string) => {
    try {
      await cloneRepo.mutateAsync({ url, path });
    } catch (err) {
      toast({
        title: 'Erro',
        description: `Erro ao clonar repositorio: ${getErrorMessage(err)}`,
        variant: 'destructive',
      });
    }
  };

  const handleInitRepo = async (path: string, bare: boolean) => {
    try {
      const repo = await initRepo.mutateAsync({ path, bare });
      if (repo.is_bare) {
        toast({
          title: 'Repositorio bare criado',
          description: 'O repositorio foi inicializado, mas nao foi aberto na interface visual.',
        });
      }
    } catch (err) {
      toast({
        title: 'Erro',
        description: `Erro ao inicializar repositorio: ${getErrorMessage(err)}`,
        variant: 'destructive',
      });
    }
  };

  const palette = (
    <CommandPalette
      open={commandPaletteOpen}
      onOpenChange={setCommandPaletteOpen}
      view={view}
      setView={setView}
      repoInfo={repoInfo}
      status={status}
      onOpenRepo={handleOpenRepo}
      onOpenSettings={() => setSettingsOpen(true)}
      onRefresh={refreshAll}
    />
  );

  const handleOpenCompare = (baseRef: string, headRef: string) => {
    setCompareRefs(baseRef, headRef);
    setView('compare');
  };

  if (!isRepoOpen && !hasOpenRepos) {
    return (
      <>
        {palette}
        <WelcomeScreen
          recentRepos={recentRepos.data || []}
          isLoading={
            recentRepos.isLoading ||
            openRepo.isPending ||
            cloneRepo.isPending ||
            initRepo.isPending
          }
          onOpenRepo={handleOpenRepo}
          onOpenRecent={handleOpenRecent}
          onRemoveRecent={handleRemoveRecent}
          onCloneRepo={handleCloneRepo}
          onInitRepo={handleInitRepo}
          onClearRecent={handleClearRecent}
        />
      </>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {palette}
      <SideBySideDiff />
      <Settings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onOpenUpdateDialog={() => setUpdateDialogOpen(true)}
      />
      <UpdateDialog
        open={updateDialogOpen}
        onOpenChange={setUpdateDialogOpen}
        update={update}
        downloading={downloading}
        installing={installing}
        canAutoUpdate={canAutoUpdate}
        onDownload={downloadAndInstall}
        onDownloadDeb={downloadAndInstallDeb}
        onDismiss={() => {
          setUpdateDialogOpen(false);
          dismissUpdate();
        }}
      />

      {hasOpenRepos && <RepoTabs onAddRepo={handleOpenRepo} />}

      <PanelGroup direction="horizontal" autoSaveId="main-layout" className="flex-1">
        <Panel defaultSize={18} minSize={14} maxSize={35}>
          {repoInfo && (
            <Sidebar
              view={view}
              setView={setView}
              repoInfo={repoInfo}
              status={status}
              onRefresh={refreshAll}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          )}
        </Panel>

        <PanelResizeHandle className="resize-handle resize-handle-horizontal" />

        <Panel minSize={50}>
          <main className="h-full flex flex-col overflow-hidden">
            {error && (
              <div className="bg-destructive/10 px-4 py-2 text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>{getErrorMessage(error)}</span>
              </div>
            )}

            {statusLoading && (
              <div className="absolute right-2 top-2 z-50">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            <div className="flex-1 overflow-hidden">
              {view === 'graph' && <CommitGraph />}
              {view === 'files' && <WorkingArea />}
              {view === 'branches' && <BranchManager onOpenCompare={handleOpenCompare} />}
              {view === 'history' && <CommitHistory onOpenCompare={handleOpenCompare} />}
              {view === 'compare' && <CompareView setView={setView} />}
              {view === 'stash' && <StashPanel />}
              {view === 'remote' && <RemoteManager />}
              {view === 'pr' && <PullRequestManager />}
              {view === 'issues' && <IssuesManager />}
            </div>

            <Terminal />
          </main>
        </Panel>
      </PanelGroup>
    </div>
  );
}
