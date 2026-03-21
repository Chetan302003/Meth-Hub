import { useState, useCallback } from 'react';
import { BaseDirectory, exists, mkdir, writeFile } from '@tauri-apps/plugin-fs';
import { appLocalDataDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { isTauri } from '@/lib/tauri';

export interface TMPPlayer {
  id: number;
  name: string;
  avatar: string;
  smallAvatar: string;
  joinDate: string;
  steamID64: string;
  groupName?: string;
  groupColor?: string;
  banned: boolean;
  displayVTCHistory: boolean;
  vtc?: {
    id: number;
    name: string;
    tag: string;
    inVTC: boolean;
    memberID: number;
  };
}

export interface TMPEvent {
  id: number;
  name: string;
  slug: string;
  game: string;
  server: {
    id: number;
    name: string;
  };
  language: string;
  departure: {
    location: string;
    city: string;
  };
  arrive: {
    location: string;
    city: string;
  };
  startAt: string;
  meetupAt?: string;
  banner?: string;
  map?: string;
  description?: string;
  attendances: {
    confirmed: number;
    unsure: number;
  };
  vtc?: {
    id: number;
    name: string;
  };
  user: {
    id: number;
    username: string;
  };
  featured: boolean;
}

export interface TMPServer {
  id: number;
  game: string;
  ip: string;
  port: number;
  name: string;
  shortname: string;
  idprefix?: string;
  online: boolean;
  players: number;
  queue: number;
  maxplayers: number;
  mapid: number;
  displayorder: number;
  speedlimiter: number;
  collisions: boolean;
  carsforplayers: boolean;
  policecarsforplayers: boolean;
  afkenabled: boolean;
  event: boolean;
  specialEvent: boolean;
  promods: boolean;
  syncdelay: number;
}

export function useTruckersMP() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Safely grab data whether edge function unwraps it or keeps the response wrapper
  const extractData = (data: any) => {
    if (!data) return [];
    // Handle nested API responses
    const raw = data.response !== undefined ? data.response : data;
    // Always return an array
    return Array.isArray(raw) ? raw : [];
  };

  // Fetch player data by TruckersMP ID using Tauri native HTTP
  const getPlayer = useCallback(async (tmpId: string): Promise<TMPPlayer | null> => {
    if (!tmpId || !/^\d+$/.test(tmpId)) {
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await tauriFetch(`https://api.truckersmp.com/v2/player/${tmpId}`, {
        method: 'GET'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return (data?.response || data) as TMPPlayer || null;
    } catch (err) {
      console.error('[TMP] Error fetching player:', err);
      setError('Failed to fetch player data');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get player avatar URL directly from TruckersMP (no CORS for images)
  const getPlayerAvatarUrl = useCallback((tmpId: string): string => {
    if (!tmpId || !/^\d+$/.test(tmpId)) {
      return '';
    }
    // TruckersMP avatar URLs follow this pattern
    return `https://truckersmp.com/user/${tmpId}/avatar`;
  }, []);

  // Fetch player avatar using edge function (and cache locally to disk if Tauri)
  const fetchPlayerAvatar = useCallback(async (tmpId: string): Promise<string | null> => {
    if (!tmpId || !/^\d+$/.test(tmpId)) return null;

    try {
      if (isTauri()) {
        try {
          const dir = await appLocalDataDir();
          const cacheDir = await join(dir, 'avatars');
          const filePath = await join(cacheDir, `${tmpId}.png`);

          if (await exists(filePath)) {
            console.log('[TMP] Loaded avatar from local cache:', filePath);
            return convertFileSrc(filePath);
          }
        } catch (e) {
          console.error('[TMP] Error checking local cache:', e);
        }
      }

      // Fetch player data via native Tauri HTTP:
      const response = await tauriFetch(`https://api.truckersmp.com/v2/player/${tmpId}`, {
        method: 'GET'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      const extracted = data?.response || data;
      const avatarUrl = extracted?.avatar || null;

      if (avatarUrl && isTauri()) {
        try {
          const dir = await appLocalDataDir();
          const cacheDir = await join(dir, 'avatars');
          const filePath = await join(cacheDir, `${tmpId}.png`);

          if (!(await exists(cacheDir))) {
            await mkdir(cacheDir, { recursive: true });
          }

          const response = await tauriFetch(avatarUrl, {
            method: 'GET',
          });
          
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            await writeFile(filePath, new Uint8Array(buffer));
            console.log('[TMP] Saved avatar to local cache:', filePath);
            return convertFileSrc(filePath);
          } else {
            console.error('[TMP] Failed to download avatar, status:', response.status);
          }
        } catch (e) {
          console.error('[TMP] Error writing local cache:', e);
        }
      }

      return avatarUrl;
    } catch (err) {
      console.error('[TMP] Error fetching avatar:', err);
      return null;
    }
  }, []);

  // Fetch attending events using Tauri Desktop bypass
  const getEvents = useCallback(async (): Promise<TMPEvent[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await tauriFetch('https://api.truckersmp.com/v2/vtc/75200/events/attending', {
        method: 'GET'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      const rawEvents = extractData(data) || [];
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      return rawEvents
        .map((e: any) => ({
          ...e,
          startAt: e.startAt || e.start_at,
          meetupAt: e.meetupAt || e.meetup_at
        }))
        .filter((e: any) => {
          const eventDate = new Date(e.startAt || e.start_at || '');
          return eventDate >= twoMonthsAgo;
        });
    } catch (err) {
      console.error('[TMP] Error fetching events:', err);
      setError('Failed to fetch events');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch VTC specific events from TruckersMP API using Tauri Desktop bypass
  const getVTCEvents = useCallback(async (): Promise<TMPEvent[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await tauriFetch('https://api.truckersmp.com/v2/vtc/75200/events', {
        method: 'GET'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();

      // VTC events API nests under response key
      const rawEvents = Array.isArray(json?.response) ? json.response : [];
      return rawEvents.map((e: any) => ({
        ...e,
        startAt: e.startAt || e.start_at,
        meetupAt: e.meetupAt || e.meetup_at
      }));
    } catch (err) {
      console.error('[TMP] Error fetching VTC events:', err);
      setError('Failed to fetch VTC events');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch server status using Tauri Desktop bypass
  const getServers = useCallback(async (): Promise<TMPServer[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await tauriFetch('https://api.truckersmp.com/v2/servers', {
        method: 'GET'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      return extractData(data) || [];
    } catch (err) {
      console.error('[TMP] Error fetching servers:', err);
      setError('Failed to fetch servers');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Validate TruckersMP ID format
  const isValidTMPId = useCallback((tmpId: string): boolean => {
    return /^\d+$/.test(tmpId);
  }, []);

  return {
    loading,
    error,
    getPlayer,
    getPlayerAvatarUrl,
    fetchPlayerAvatar,
    getEvents,
    getVTCEvents,
    getServers,
    isValidTMPId,
  };
}
