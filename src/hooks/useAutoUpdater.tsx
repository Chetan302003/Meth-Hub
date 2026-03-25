import { useState, useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { isTauri } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { toast } from 'sonner';

export function useAutoUpdater() {
  const [isChecking, setIsChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const checkForUpdates = async (manual = false) => {
    if (!isTauri()) {
      if (manual) {
        toast.error('Browser Not Supported', {
          description: 'Auto-updates are only available in the Aura Desktop App.',
        });
      }
      return;
    }

    try {
      setIsChecking(true);
      const update = await check();
      
      if (update) {
        setUpdateAvailable(true);
        console.log(`Update available: ${update.version}`);
        
        toast('Update Available!', {
          description: `Aura VTC Hub v${update.version} is ready to install.`,
          action: {
            label: 'Update Now',
            onClick: async () => {
              try {
                let downloaded = 0;
                let contentLength = 0;
                
                await update.downloadAndInstall((event) => {
                  switch (event.event) {
                    case 'Started':
                      contentLength = event.data.contentLength || 0;
                      toast.loading(`Downloading update... 0%`);
                      break;
                    case 'Progress':
                      downloaded += event.data.chunkLength;
                      if (contentLength > 0) {
                        const nextProgress = Math.round((downloaded / contentLength) * 100);
                        setDownloadProgress(nextProgress);
                      }
                      break;
                    case 'Finished':
                      toast.success('Update installed! Restarting...');
                      break;
                  }
                });
              } catch (updateError: any) {
                console.error('[UPDATER ERROR]:', updateError);
                toast.error('Update Failed to Start', {
                  description: updateError.toString() || 'Could not download the update. Check the URL or Signature.',
                  duration: 10000
                });
              }
            },
          },
          duration: 10000,
        });
      } else if (manual) {
        toast.success('App Up-to-Date', {
          description: 'You are running the latest version of Aura VTC Hub.',
        });
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      if (manual) {
        toast.error('Update Check Failed', {
          description: 'Could not connect to the update server.',
        });
      }
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Check if we just successfully completed an update
    const checkPostUpdateProcess = async () => {
      if (!isTauri()) return;
      try {
        const currentVersion = await getVersion();
        const storedVersion = localStorage.getItem('aura-app-version');
        
        // If we have a stored version, and it's physically different than what Tauri is currently running, we just updated!
        if (storedVersion && storedVersion !== currentVersion) {
          toast.success(`Update Successfully Installed! ✨`, {
            description: `You are now rocking Aura VTC Hub v${currentVersion}!`,
            duration: 8000
          });
        }
        
        // Sync the current baseline into local storage for the next run
        if (storedVersion !== currentVersion) {
          localStorage.setItem('aura-app-version', currentVersion);
        }
      } catch (e) {
        console.error('Failed to check post-update status', e);
      }
    };

    checkPostUpdateProcess();

    // Delay check slightly so app loads first
    const timer = setTimeout(() => checkForUpdates(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return { isChecking, updateAvailable, downloadProgress, checkForUpdates };
}
