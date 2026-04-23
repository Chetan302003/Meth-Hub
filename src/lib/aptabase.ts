import { invoke } from '@tauri-apps/api/core';

export async function trackEvent(
  name: string,
  props?: {
    [key: string]: string | number | boolean;
  },
): Promise<void> {
  try {
    await invoke<string>('plugin:aptabase|track_event', { name, props });
  } catch (error) {
    // Silently fail - analytics should never break the app
    console.debug('[Aptabase] Event logging failed:', error);
  }
}
