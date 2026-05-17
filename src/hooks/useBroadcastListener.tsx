import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUIStore } from '@/stores/appStore';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import { sendNativeNotification } from '@/lib/tauri';
import { useNavigate } from 'react-router-dom';

interface BroadcastPayload {
  title: string;
  body: string;
  url?: string;
  sentBy?: string;
}

/**
 * Global hook that listens for staff broadcast notifications
 * via Supabase Realtime. Shows both native desktop + in-app toast.
 */
export function useBroadcastListener() {
  const notificationsEnabled = useUIStore((s) => s.notificationsEnabled);
  const navigate = useNavigate();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    console.log('[Broadcast] Hook mounted. Notifications enabled:', notificationsEnabled);
    if (!notificationsEnabled) {
      console.log('[Broadcast] Exiting early because notifications are disabled.');
      return;
    }

    const channel = supabase.channel('aura-broadcasts');

    channel.on('broadcast', { event: 'event-alert' }, ({ payload }: { payload: BroadcastPayload }) => {
      console.log('[Broadcast] Received event-alert:', payload);

      // Native desktop notification (works even when minimized to tray)
      sendNativeNotification(
        payload.title,
        payload.body
      );

      // In-app toast
      toast(payload.title, {
        description: payload.body,
        duration: 12000,
        icon: <Bell className="w-4 h-4 text-primary" />,
        action: payload.url ? {
          label: 'View',
          onClick: () => {
            if (payload.url?.startsWith('https://') || payload.url?.startsWith('http://')) {
              window.open(payload.url, '_blank');
            } else {
              navigate(payload.url || '/events');
            }
          },
        } : undefined,
      });
    });

    channel.subscribe((status) => {
      console.log('[Broadcast] Channel status:', status);
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [notificationsEnabled]);
}
