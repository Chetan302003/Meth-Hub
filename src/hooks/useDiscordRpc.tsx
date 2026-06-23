import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/tauri';
import { useTelemetry } from './useTelemetry';

const DISCORD_CLIENT_ID = '1401447809852506142';

export function useDiscordRpc() {
  const { data, connected, isJobActive } = useTelemetry();
  const initialized = useRef(false);
  const dataRef = useRef({ data, connected, isJobActive });

  // Keep ref continuously updated without triggering re-renders of the interval
  useEffect(() => {
    dataRef.current = { data, connected, isJobActive };
  }, [data, connected, isJobActive]);

  useEffect(() => {
    if (!isTauri()) return;

    const updateRpc = () => {
      if (!initialized.current) return;
      const current = dataRef.current;

      if (!current.connected) {
        invoke('set_discord_rpc', {
          details: 'Idling in Main Menu',
          stateText: 'Awaiting dispatch',
          largeImageKey: null,
          largeImageText: null,
          smallImageKey: null,
          smallImageText: null,
        }).catch(e => console.error('[Discord RPC]', e));
        return;
      }

      let details = 'Free Roaming';
      let stateText = `${current.data.truck.brand} ${current.data.truck.name}`;

      if (current.isJobActive && current.data.job) {
        details = `Hauling ${current.data.job.cargo}`;
        stateText = `${current.data.job.source} ➡️ ${current.data.job.destination}`;
      }

      invoke('set_discord_rpc', {
        details,
        stateText,
        largeImageKey: null,
        largeImageText: null,
        smallImageKey: null,
        smallImageText: null,
      }).catch(e => console.error('[Discord RPC]', e));
    };

    if (!initialized.current) {
      initialized.current = true; // Lock immediately to prevent Strict Mode double-firing
      invoke('init_discord_rpc', { clientId: DISCORD_CLIENT_ID })
        .then(() => {
          console.log('[Discord RPC] Initialized');
          updateRpc(); // Fire immediately!
        })
        .catch(e => {
          console.error('[Discord RPC] Init Error:', e);
          initialized.current = false;
        });
    }

    // Discord rate limit is 1 update per 15 seconds. We poll every 15 seconds.
    const interval = setInterval(updateRpc, 15000);

    return () => clearInterval(interval);
  }, []);
}
