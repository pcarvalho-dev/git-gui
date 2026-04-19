import { useState, useCallback, useEffect } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { open } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';
import { getErrorMessage } from '@/lib/error';

const RELEASES_URL = 'https://github.com/pcarvalho-dev/git-gui/releases/latest';
const DEB_URL_PATTERN = 'https://github.com/pcarvalho-dev/git-gui/releases/download/v{version}/git-arc_{version}_amd64.deb';

type InstallPhase = 'idle' | 'checking' | 'downloading' | 'installing' | 'done';

interface UpdateState {
  phase: InstallPhase;
  available: boolean;
  update: Update | null;
  error: string | null;
  canAutoUpdate: boolean;
}

export function useUpdateChecker() {
  const [state, setState] = useState<UpdateState>({
    phase: 'idle',
    available: false,
    update: null,
    error: null,
    canAutoUpdate: true,
  });

  useEffect(() => {
    invoke<string>('get_install_type').then((installType) => {
      setState(prev => ({ ...prev, canAutoUpdate: installType !== 'system' }));
    }).catch(() => {});
  }, []);

  const checkForUpdate = useCallback(async () => {
    setState(prev => ({ ...prev, phase: 'checking', error: null }));

    try {
      const update = await check();

      if (update) {
        setState(prev => ({ ...prev, phase: 'idle', available: true, update }));
        return update;
      } else {
        setState(prev => ({ ...prev, phase: 'idle', available: false, update: null }));
        return null;
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      const isNoRelease = errorMessage.toLowerCase().includes('could not fetch') ||
                          errorMessage.toLowerCase().includes('no valid release');
      setState(prev => ({
        ...prev,
        phase: 'idle',
        error: isNoRelease ? null : errorMessage,
      }));
      return null;
    }
  }, []);

  // AppImage / Windows / macOS: Tauri updater nativo
  const downloadAndInstall = useCallback(async () => {
    if (!state.update) return;

    setState(prev => ({ ...prev, phase: 'downloading', error: null }));

    try {
      await state.update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          setState(prev => ({ ...prev, phase: 'downloading' }));
        } else if (event.event === 'Finished') {
          setState(prev => ({ ...prev, phase: 'installing' }));
        }
      });

      setState(prev => ({ ...prev, phase: 'done' }));
      await relaunch();
    } catch (err) {
      setState(prev => ({ ...prev, phase: 'idle', error: getErrorMessage(err) }));
    }
  }, [state.update]);

  // .deb: download + pkexec dpkg -i
  const downloadAndInstallDeb = useCallback(async () => {
    if (!state.update) return;

    const version = state.update.version;
    const url = DEB_URL_PATTERN.replace(/{version}/g, version);

    setState(prev => ({ ...prev, phase: 'downloading', error: null }));

    try {
      await invoke('install_deb_update', { url, version });
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
  }, [state.update]);

  const openReleasesPage = useCallback(async () => {
    await open(RELEASES_URL);
  }, []);

  const dismissUpdate = useCallback(() => {
    setState(prev => ({ ...prev, available: false, update: null, error: null }));
  }, []);

  const checking = state.phase === 'checking';
  const downloading = state.phase === 'downloading';
  const installing = state.phase === 'installing';

  return {
    checking,
    downloading,
    installing,
    available: state.available,
    update: state.update,
    error: state.error,
    canAutoUpdate: state.canAutoUpdate,
    checkForUpdate,
    downloadAndInstall,
    downloadAndInstallDeb,
    openReleasesPage,
    dismissUpdate,
  };
}
