import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as Sentry from '@sentry/react';

export type AppRole = 'developer' | 'superadmin' | 'founder' | 'management' | 'hr' | 'event_team' | 'media' | 'driver';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

interface Profile {
  id: string;
  user_id: string;
  username: string;
  email: string;
  tmp_id: string | null;
  avatar_url: string | null;
  approval_status: ApprovalStatus;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signUp: (email: string, password: string, username: string, tmpId?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isApproved: boolean;
  hasRole: (role: AppRole) => boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data as Profile;
  };

  const fetchRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error fetching roles:', error);
      return [];
    }
    return data.map(r => r.role as AppRole);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer Supabase calls with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(async () => {
            const [profileData, rolesData] = await Promise.all([
              fetchProfile(session.user.id),
              fetchRoles(session.user.id)
            ]);
            setProfile(profileData);
            setRoles(rolesData);
            setLoading(false);
            if (profileData) {
              Sentry.setUser({ id: session.user.id, username: profileData.username });
            }
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setLoading(false);
          Sentry.setUser(null);
        }
      }
    );

    // THEN check for existing session and validate it against the server
    const initAuth = async () => {
      try {
        const { data: { session: localSession } } = await supabase.auth.getSession();
        
        if (!localSession) {
          setLoading(false);
          return;
        }

        // If offline, trust the local session and skip server validation to prevent false logouts
        if (!navigator.onLine) {
          console.warn("App is offline. Trusting local session.");
          setSession(localSession);
          setUser(localSession.user);
          setLoading(false);
          return;
        }

        // We are online, validate token strictly against the server
        const { data: { user: validatedUser }, error } = await supabase.auth.getUser();

        if (error || !validatedUser) {
          // Double-check it's not a network error before wiping the session
          if (error && !error.message.toLowerCase().includes('failed to fetch')) {
            console.error("Auth validation error (revoked, expired, or logged in elsewhere):", error);
            await supabase.auth.signOut(); 
            setSession(null);
            setUser(null);
          } else if (error && error.message.toLowerCase().includes('failed to fetch')) {
             console.warn("Network error during validation. Treating as offline.");
             setSession(localSession);
             setUser(localSession.user);
          }
          setLoading(false);
          return;
        }
        
        // If valid, apply the session and fetch profile
        setSession(localSession);
        setUser(validatedUser);
        
        const [profileData, rolesData] = await Promise.all([
          fetchProfile(validatedUser.id),
          fetchRoles(validatedUser.id)
        ]);
        
        setProfile(profileData);
        setRoles(rolesData);
        setLoading(false);
        
        if (profileData) {
          Sentry.setUser({ id: validatedUser.id, username: profileData.username });
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        setLoading(false);
      }
    };

    initAuth();

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, username: string, tmpId?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username,
          tmp_id: tmpId
        }
      }
    });

    if (error) {
      return { error };
    }

    // Update profile with TMP ID if provided
    if (tmpId && user) {
      await supabase
        .from('profiles')
        .update({ tmp_id: tmpId })
        .eq('user_id', user.id);
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    Sentry.setUser(null);
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  
  const isStaff = roles.some(r => 
    ['developer', 'superadmin', 'founder', 'management', 'hr', 'event_team', 'media'].includes(r)
  );

  const isApproved = profile?.approval_status === 'approved' || isStaff;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      roles,
      loading,
      signUp,
      signIn,
      signOut,
      isApproved,
      hasRole,
      isStaff
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}