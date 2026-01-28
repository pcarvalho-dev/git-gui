import { useState, useCallback } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getErrorMessage } from '@/lib/error';

interface UpdateState {
  checking: boolean;
  downloading: boolean;
  progress: number;
  available: boolean;
  update: Update | null;
  error: string | null;
}

export function useUpdateChecker() {
  const [state, setState] = useState<UpdateState>({
    checking: false,
    downloading: false,
    progress: 0,
    available: false,
    update: null,
    error: null,
  });

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
      setState(prev => ({
        ...prev,
        checking: false,
        error: errorMessage,
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

      // Reiniciar o app após instalação
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
    dismissUpdate,
  };
}
