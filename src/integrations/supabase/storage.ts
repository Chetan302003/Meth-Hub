import { exists, readTextFile, writeTextFile, remove, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';

const ensureDir = async () => {
  try {
    const hasDir = await exists('', { baseDir: BaseDirectory.AppLocalData });
    if (!hasDir) {
      await mkdir('', { baseDir: BaseDirectory.AppLocalData, recursive: true });
    }
  } catch (e) {
    console.error('Failed to ensure AppLocalData directory exists', e);
  }
};

// Custom storage adapter for Supabase Auth to use Tauri's plugin-fs
// This prevents session loss when Webview2 unexpectedly clears localStorage
export const tauriStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      await ensureDir();
      const filename = `${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
      const hasKey = await exists(filename, { baseDir: BaseDirectory.AppLocalData });
      if (!hasKey) return null;
      return await readTextFile(filename, { baseDir: BaseDirectory.AppLocalData });
    } catch (e) {
      console.error('Error reading from custom storage', e);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await ensureDir();
      const filename = `${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
      await writeTextFile(filename, value, { baseDir: BaseDirectory.AppLocalData });
    } catch (e) {
      console.error('Error writing to custom storage', e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      const filename = `${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
      const hasKey = await exists(filename, { baseDir: BaseDirectory.AppLocalData });
      if (hasKey) {
        await remove(filename, { baseDir: BaseDirectory.AppLocalData });
      }
    } catch (e) {
      console.error('Error removing from custom storage', e);
    }
  }
};
