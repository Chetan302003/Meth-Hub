import { createClient } from '@supabase/supabase-js';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type { Database } from './types';
import { tauriStorage } from './storage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

const isTauriEnv = '__TAURI_INTERNALS__' in window || '__TAURI__' in window || '__TAURI_IPC__' in window;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: isTauriEnv ? (tauriStorage as any) : window.localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: {
    fetch: (input, init) => tauriFetch(input, init),
  },
});
