import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Titlebar } from './components/Titlebar';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AppLayout } from '@/components/layout/AppLayout';
import { useEffect } from "react";
import { trackEvent } from "@/lib/aptabase";
import { getVersion } from "@tauri-apps/api/app";
// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import FleetOverview from "./pages/FleetOverview";
import MyStats from "./pages/MyStats";
import LogJob from "./pages/LogJob";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import UserManagement from "./pages/UserManagement";
import SystemLogs from "./pages/SystemLogs";
import DeveloperPanel from "./pages/DeveloperPanel";
import Announcements from "./pages/Announcements";
import Events from "./pages/Events";
import CalendarPage from "./pages/Calendar";
import Telemetry from "./pages/Telemetry";

import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { TelemetryProvider } from "@/contexts/TelemetryContext";
import { useDiscordRpc } from '@/hooks/useDiscordRpc';

const queryClient = new QueryClient();

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </ProtectedRoute>
  );
}

// Auth route - redirect if already logged in
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

import { useBrightness } from "@/hooks/useBrightness";
import { usePresence } from "@/hooks/usePresence";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { supabase } from "@/integrations/supabase/client";

function GlobalHooks() {
  useDiscordRpc();
  useBrightness(); 
  
  const { user } = useAuth();
  usePresence(user?.id);

  useEffect(() => {
    if (!user?.id) return;

    // Run only in Tauri environment
    if ((window as any).__TAURI_INTERNALS__) {
      const unlisten = getCurrentWindow().onCloseRequested(async () => {
        await supabase
          .from("profiles")
          .update({
            last_seen: new Date().toISOString(),
            is_online: false,
          })
          .eq("user_id", user.id);
      });

      return () => {
        unlisten.then((fn) => fn());
      };
    }
  }, [user?.id]);

  return null;
}

function AppTelemetryTracker() {
  const location = useLocation();

  useEffect(() => {
    trackEvent("page_viewed", { page: location.pathname });
  }, [location]);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const currentVersion = await getVersion();
        const storedVersion = localStorage.getItem("app_version");
        if (storedVersion && storedVersion !== currentVersion) {
          trackEvent("app_updated", { from: storedVersion, to: currentVersion });
        }
        localStorage.setItem("app_version", currentVersion);
      } catch (e) {
        // Ignored in non-Tauri env
      }
    };
    checkVersion();
  }, []);

  return null;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
      
      {/* Protected Routes */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/fleet" element={<FleetOverview />} />
        <Route path="/my-stats" element={<MyStats />} />
        <Route path="/log-job" element={<LogJob />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/logs" element={<SystemLogs />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/events" element={<Events />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/telemetry" element={<Telemetry />} />
        <Route path="/developer" element={<DeveloperPanel />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      
      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
{/* This wrapper ensures the Titlebar is always present 
        and the content is pushed down so it's not hidden.
      */}
      <div className="min-h-screen bg-aura-dark text-white flex flex-col">
        <Titlebar />
        <main className="flex-1 pt-10">
          <HashRouter>
            <AuthProvider>
              <TelemetryProvider>
                <GlobalHooks />
                <AppTelemetryTracker />
                <AppRoutes />
              </TelemetryProvider>
            </AuthProvider>
          </HashRouter>
        </main>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;