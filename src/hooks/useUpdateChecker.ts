import { useState, useCallback, useEffect } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { open } from '@tauri-apps/plugin-shell';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { getErrorMessage } from '@/lib/error';

const RELEASES_URL = 'https://github.com/pcarvalho-dev/git-gui/releases/latest';
const LATEST_JSON_URL = 'https://github.com/pcarvalho-dev/git-gui/releases/latest/download/latest.json';

type InstallPhase = 'idle' | 'checking' | 'downloading' | 'installing' | 'done';

// Minimal update info for the .deb flow — only version and notes are needed.
interface DebUpdate {
  version: string;
  body: string | null;
  debUrl: string;
}

interface UpdateState {
  phase: InstallPhase;
  available: boolean;
  update: Update | null;       // AppImage / Windows / macOS
  debUpdate: DebUpdate | null; // .deb Linux
  error: string | null;
  canAutoUpdate: boolean;
}

function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [aMaj = 0, aMin = 0, aPatch = 0] = parse(a);
  const [bMaj = 0, bMin = 0, bPatch = 0] = parse(b);
  if (aMaj !== bMaj) return aMaj - bMaj;
  if (aMin !== bMin) return aMin - bMin;
  return aPatch - bPatch;
}

export function useUpdateChecker() {
  const [state, setState] = useState<UpdateState>({
    phase: 'idle',
    available: false,
    update: null,
    debUpdate: null,
    error: null,
    canAutoUpdate: true,
  });

  // Detect install type on mount so the dialog renders correctly from the start.
  useEffect(() => {
    invoke<string>('get_install_type')
      .then((t) => setState(prev => ({ ...prev, canAutoUpdate: t !== 'system' })))
      .catch(() => {});
  }, []);

  const checkForUpdate = useCallback(async () => {
    setState(prev => ({ ...prev, phase: 'checking', error: null }));

    try {
      const installType = await invoke<string>('get_install_type').catch(() => 'native');
      const isDeb = installType === 'system';

      setState(prev => ({ ...prev, canAutoUpdate: !isDeb }));

      if (isDeb) {
        // Tauri updater only works with AppImage on Linux.
        // For .deb installs, check latest.json manually.
        const resp = await fetch(LATEST_JSON_URL);
        if (!resp.ok) throw new Error('could not fetch latest version info');

        const data = await resp.json();
        const remoteVersion: string = data.version ?? '';
        const debUrl: string = data.platforms?.['linux-deb-x86_64']?.url ?? '';
        const currentVersion = await getVersion();

        if (remoteVersion && compareVersions(remoteVersion, currentVersion) > 0) {
          const debUpdate: DebUpdate = {
            version: remoteVersion,
            body: data.notes ?? null,
            debUrl,
          };
          setState(prev => ({ ...prev, phase: 'idle', available: true, debUpdate }));
          return debUpdate;
        }

        setState(prev => ({ ...prev, phase: 'idle', available: false }));
        return null;
      }

      // AppImage / Windows / macOS: use Tauri's native updater.
      const update = await check();
      if (update) {
        setState(prev => ({ ...prev, phase: 'idle', available: true, update }));
        return update;
      }

      setState(prev => ({ ...prev, phase: 'idle', available: false }));
      return null;
    } catch (err) {
      const msg = getErrorMessage(err);
      const isSilent =
        msg.toLowerCase().includes('could not fetch') ||
        msg.toLowerCase().includes('no valid release') ||
        msg.toLowerCase().includes('no update available');
      setState(prev => ({ ...prev, phase: 'idle', error: isSilent ? null : msg }));
      return null;
    }
  }, []);

  // AppImage / Windows / macOS: Tauri native download + install.
  const downloadAndInstall = useCallback(async () => {
    if (!state.update) return;

    setState(prev => ({ ...prev, phase: 'downloading', error: null }));

    try {
      await state.update.downloadAndInstall((event) => {
        if (event.event === 'Started') setState(prev => ({ ...prev, phase: 'downloading' }));
        else if (event.event === 'Finished') setState(prev => ({ ...prev, phase: 'installing' }));
      });

      setState(prev => ({ ...prev, phase: 'done' }));
      await relaunch();
    } catch (err) {
      setState(prev => ({ ...prev, phase: 'idle', error: getErrorMessage(err) }));
    }
  }, [state.update]);

  // .deb: curl download + pkexec dpkg -i.
  const downloadAndInstallDeb = useCallback(async () => {
    const deb = state.debUpdate;
    if (!deb || !deb.debUrl) return;

    setState(prev => ({ ...prev, phase: 'downloading', error: null }));

    try {
      await invoke('install_deb_update', { url: deb.debUrl, version: deb.version });
      setState(prev => ({ ...prev, phase: 'done' }));
      await relaunch();
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg === 'cancelled') {
        setState(prev => ({ ...prev, phase: 'idle', error: null }));
      } else {
        setState(prev => ({ ...prev, phase: 'idle', error: msg }));
      }
    }
  }, [state.debUpdate]);

  const openReleasesPage = useCallback(async () => {
    await open(RELEASES_URL);
  }, []);

  const dismissUpdate = useCallback(() => {
    setState(prev => ({ ...prev, available: false, update: null, debUpdate: null, error: null }));
  }, []);

  // Unified version/body for the dialog — works for both flows.
  const updateVersion = state.update?.version ?? state.debUpdate?.version ?? null;
  const updateBody = state.update?.body ?? state.debUpdate?.body ?? null;

  return {
    checking: state.phase === 'checking',
    downloading: state.phase === 'downloading',
    installing: state.phase === 'installing',
    available: state.available,
    update: state.update,
    updateVersion,
    updateBody,
    error: state.error,
    canAutoUpdate: state.canAutoUpdate,
    checkForUpdate,
    downloadAndInstall,
    downloadAndInstallDeb,
    openReleasesPage,
    dismissUpdate,
  };
}
