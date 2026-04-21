import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useTruckersMP } from '@/hooks/useTruckersMP';
import { useAutoUpdater } from '@/hooks/useAutoUpdater';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { isTauri } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { useBroadcastListener } from '@/hooks/useBroadcastListener';
import { UpdateAnnouncementModal } from '@/components/developer/UpdateAnnouncementModal';
import { usePresenceStore } from '@/stores/appStore';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Truck,
  Users,
  FileText,
  Settings,
  LogOut,
  PlusCircle,
  BarChart3,
  Shield,
  Menu,
  X,
  ChevronRight,
  Megaphone,
  Calendar,
  CalendarDays,
  Activity,
  Rocket
} from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['all'] },
  { icon: BarChart3, label: 'Fleet Overview', path: '/fleet', roles: ['all'] },
  { icon: Calendar, label: 'Events', path: '/events', roles: ['all'] },
  { icon: CalendarDays, label: 'Calendar', path: '/calendar', roles: ['all'] },
  { icon: Activity, label: 'Telemetry', path: '/telemetry', roles: ['all'] },
  { icon: Truck, label: 'My Stats', path: '/my-stats', roles: ['all'] },
  { icon: PlusCircle, label: 'Log Job', path: '/log-job', roles: ['all'] },
  { icon: Megaphone, label: 'Announcements', path: '/announcements', roles: ['developer', 'superadmin', 'founder', 'management'] },
  { icon: Users, label: 'User Management', path: '/users', roles: ['developer', 'superadmin', 'founder', 'hr'] },
  { icon: FileText, label: 'System Logs', path: '/logs', roles: ['developer', 'superadmin', 'founder', 'management'] },
  { icon: Shield, label: 'Developer', path: '/developer', roles: ['developer'] },
  { icon: Settings, label: 'Settings', path: '/settings', roles: ['all'] },
];

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, roles, signOut, isApproved } = useAuth();
  const { fetchPlayerAvatar } = useTruckersMP();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const { isChecking, checkForUpdates } = useAutoUpdater();
  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [dbVersion, setDbVersion] = useState<string | null>(null);

  // Initialize push notifications for event reminders (30/15/5/1 min alerts)
  usePushNotifications();

  // Listen for staff-broadcast notifications via Supabase Realtime
  useBroadcastListener();

  useEffect(() => {
    if (isTauri()) {
      getVersion().then(setAppVersion).catch(console.error);
    }
    
    // Check global updates table for latest advertised version
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'version')
      .single()
      .then(({ data }) => {
        if (data && data.value) setDbVersion((data.value as any).latest);
      });
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Fetch TMP avatar if tmp_id exists
  useEffect(() => {
    const loadAvatar = async () => {
      if (profile?.tmp_id) {
        const avatar = await fetchPlayerAvatar(profile.tmp_id);
        if (avatar) setAvatarUrl(avatar);
      } else if (profile?.avatar_url) {
        setAvatarUrl(profile.avatar_url);
      }
    };
    loadAvatar();
  }, [profile?.tmp_id, profile?.avatar_url, fetchPlayerAvatar]);

  const setOnlineUsers = usePresenceStore(state => state.setOnlineUsers);

  // Track Supabase Presence
  useEffect(() => {
    if (!profile?.user_id) return;
    
    const presenceChannel = supabase.channel('global-presence', {
      config: { presence: { key: profile.user_id } }
    });

    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      const activeIds = new Set<string>();
      Object.values(state).forEach(presences => {
        presences.forEach((p: any) => {
          if (p.user_id) activeIds.add(p.user_id);
        });
      });
      setOnlineUsers(activeIds);
    });

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          user_id: profile.user_id,
          online_at: new Date().toISOString()
        });
      }
    });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [profile?.user_id]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const filteredNavItems = navItems.filter(item => {
    if (item.roles.includes('all')) return true;
    return item.roles.some(role => roles.includes(role as any));
  });

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile menu button - Fixed position */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-secondary/90 backdrop-blur-lg text-foreground shadow-lg border border-border/50"
        aria-label="Toggle menu"
      >
        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-10 bottom-0 left-0 z-40 w-64 sm:w-72 transform transition-transform duration-300 ease-out lg:translate-x-0 pt-4",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        "bg-sidebar border-r border-border/50 flex flex-col"
      )}>
        {/* Logo */}
        <div className="p-4 sm:p-6 lg:pt-0">
          <h1 className="text-xl sm:text-2xl font-bold gradient-text neon-text">
            Aura VTC Hub
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Fleet Management</p>
        </div>

        {/* User info */}
        <div className="px-3 sm:px-4 mb-6">
          <div className="glass-card p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-base sm:text-lg neon-pulse overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={profile?.username}
                    className="w-full h-full object-cover"
                    onError={() => setAvatarUrl(null)}
                  />
                ) : (
                  profile?.username?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm sm:text-base truncate">{profile?.username || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {roles[0]?.replace('_', ' ').toUpperCase() || 'Driver'}
                </p>
              </div>
            </div>
            {!isApproved && (
              <div className="mt-3 px-2 py-1 rounded-full bg-amber/20 text-amber text-xs text-center font-medium">
                Pending Approval
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 sm:px-4 pt-4 space-y-1.5 overflow-y-auto pb-4 -mt-2">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-primary/15 text-primary neon-glow"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon size={18} className="shrink-0" />
                <span className="font-medium text-sm truncate">{item.label}</span>
                {isActive && <ChevronRight size={14} className="ml-auto shrink-0" />}
              </Link>
            );
          })}
        </nav>

        {/* Sign out button */}
        <div className="p-3 sm:p-4 border-t border-border/50">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-11"
          >
            <LogOut size={18} />
            <span className="text-sm">Sign Out</span>
          </Button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-72 flex flex-col h-[calc(100vh-2.5rem)] relative">
        {dbVersion && appVersion !== dbVersion && (
          <div className="bg-primary/20 border-b border-primary/30 text-primary px-4 sm:px-6 py-3 flex items-center justify-between text-sm backdrop-blur-md shadow-sm z-20 sticky top-0 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-2.5">
              <Rocket size={18} className="animate-pulse" />
              <span className="font-bold tracking-tight">Aura VTC Hub v{dbVersion} is available!</span>
              <span className="hidden xl:inline text-primary/70 ml-2">Click update to experience the latest features.</span>
            </div>
            <Button size="sm" onClick={() => checkForUpdates(true)} disabled={isChecking} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-8 px-5 font-semibold text-xs transition-transform hover:scale-105">
              {isChecking ? 'Checking...' : 'Update & Restart'}
            </Button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 bg-background">
          <div className="max-w-7xl mx-auto pb-4 w-full">
            {children}
          </div>
        </div>

        {/* Footer - pinned at bottom */}
        <footer className="shrink-0 px-4 sm:px-6 lg:px-8 py-2 border-t border-border/30 bg-background/95 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-muted-foreground/50">
            <span>© {new Date().getFullYear()} Aura VTC · All rights reserved</span>
            <span>Designed & Developed by <a href="https://chetanmahajan.vercel.app">Chetan</a></span>
          </div>
        </footer>
      </main>
      
      <UpdateAnnouncementModal />
    </div>
  );
}
