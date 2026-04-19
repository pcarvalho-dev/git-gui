import { useState, useCallback, useEffect } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { open } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';
import { getErrorMessage } from '@/lib/error';

const RELEASES_URL = 'https://github.com/pcarvalho-dev/git-gui/releases/latest';

interface UpdateState {
  checking: boolean;
  downloading: boolean;
  progress: number;
  available: boolean;
  update: Update | null;
  error: string | null;
  canAutoUpdate: boolean;
}

export function useUpdateChecker() {
  const [state, setState] = useState<UpdateState>({
    checking: false,
    downloading: false,
    progress: 0,
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
    setState(prev => ({ ...prev, checking: true, error: null }));

    try {
      const update = await check();

      if (update) {
        setState(prev => ({
          ...prev,
          checking: false,
          available: true,
          update,
        }));
        return update;
      } else {
        setState(prev => ({
          ...prev,
          checking: false,
          available: false,
          update: null,
        }));
        return null;
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      const isNoRelease = errorMessage.toLowerCase().includes('could not fetch') ||
                          errorMessage.toLowerCase().includes('no valid release');
      setState(prev => ({
        ...prev,
        checking: false,
        error: isNoRelease ? null : errorMessage,
      }));
      return null;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!state.update) return;

    setState(prev => ({ ...prev, downloading: true, progress: 0, error: null }));

    try {
      await state.update.downloadAndInstall((event) => {
        if (event.event === 'Started' && event.data.contentLength) {
          setState(prev => ({ ...prev, progress: 0 }));
        } else if (event.event === 'Progress') {
          const progress = event.data.chunkLength;
          setState(prev => ({ ...prev, progress: prev.progress + progress }));
        } else if (event.event === 'Finished') {
          setState(prev => ({ ...prev, progress: 100 }));
        }
      });

      await relaunch();
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setState(prev => ({
        ...prev,
        downloading: false,
        error: errorMessage,
      }));
    }
  }, [state.update]);

  const openReleasesPage = useCallback(async () => {
    await open(RELEASES_URL);
  }, []);

  const dismissUpdate = useCallback(() => {
    setState(prev => ({
      ...prev,
      available: false,
      update: null,
    }));
  }, []);

  return {
    ...state,
    checkForUpdate,
    downloadAndInstall,
    openReleasesPage,
    dismissUpdate,
  };
}
