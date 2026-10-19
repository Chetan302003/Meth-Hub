import { useState, useEffect } from 'react';

export type AvatarSource = 'local' | 'tmp';

const getLocalAvatarKey = (userId: string) => `hub_local_avatar_${userId}`;
const getAvatarSourceKey = (userId: string) => `hub_avatar_source_${userId}`;

/**
 * Get locally stored custom avatar (data URL) for user.
 */
export function getLocalAvatar(userId?: string | null): string | null {
  if (!userId) return null;
  try {
    return localStorage.getItem(getLocalAvatarKey(userId));
  } catch (e) {
    console.error('[AvatarStorage] Failed to get local avatar:', e);
    return null;
  }
}

/**
 * Store custom avatar locally (per-device). Does NOT touch backend/Supabase.
 */
export function setLocalAvatar(userId: string, dataUrl: string): void {
  try {
    localStorage.setItem(getLocalAvatarKey(userId), dataUrl);
    window.dispatchEvent(new CustomEvent('hub-avatar-changed', { detail: { userId } }));
  } catch (e) {
    console.error('[AvatarStorage] Failed to set local avatar:', e);
  }
}

/**
 * Remove locally stored avatar for user.
 */
export function removeLocalAvatar(userId: string): void {
  try {
    localStorage.removeItem(getLocalAvatarKey(userId));
    window.dispatchEvent(new CustomEvent('hub-avatar-changed', { detail: { userId } }));
  } catch (e) {
    console.error('[AvatarStorage] Failed to remove local avatar:', e);
  }
}

/**
 * Get selected avatar source. Defaults to 'tmp' for new users.
 */
export function getAvatarSource(userId?: string | null): AvatarSource {
  if (!userId) return 'tmp';
  try {
    const saved = localStorage.getItem(getAvatarSourceKey(userId));
    if (saved === 'local' || saved === 'tmp') {
      return saved;
    }
  } catch (e) {
    console.error('[AvatarStorage] Failed to get avatar source:', e);
  }
  return 'tmp';
}

/**
 * Set avatar source ('local' or 'tmp'). Does NOT delete local photo.
 */
export function setAvatarSource(userId: string, source: AvatarSource): void {
  try {
    localStorage.setItem(getAvatarSourceKey(userId), source);
    window.dispatchEvent(new CustomEvent('hub-avatar-changed', { detail: { userId } }));
  } catch (e) {
    console.error('[AvatarStorage] Failed to set avatar source:', e);
  }
}

/**
 * Resolve effective avatar according to user preference and fallback rules:
 * 1. If source is 'local': use local uploaded photo. If none, fall back to TMP photo.
 * 2. If source is 'tmp': use TMP photo.
 * 3. If neither exists, returns null (fallback to initial avatar).
 */
export function getEffectiveAvatar(
  userId?: string | null,
  tmpAvatarUrl?: string | null
): string | null {
  if (!userId) return tmpAvatarUrl || null;
  const source = getAvatarSource(userId);
  if (source === 'local') {
    const local = getLocalAvatar(userId);
    return local || tmpAvatarUrl || null;
  }
  return tmpAvatarUrl || null;
}

/**
 * Validates and optimizes an uploaded image file into a base64 data URL.
 * Limits: JPG/PNG/WebP, Max 5MB, scaled to max 512x512.
 */
export function processImageFile(file: File, maxSizePx = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return reject(new Error('Only JPG, PNG, or WebP images are allowed.'));
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return reject(new Error('Image must be under 5MB.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSizePx || height > maxSizePx) {
          if (width > height) {
            height = Math.round((height * maxSizePx) / width);
            width = maxSizePx;
          } else {
            width = Math.round((width * maxSizePx) / height);
            height = maxSizePx;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not process image on canvas.'));
        }

        ctx.drawImage(img, 0, 0, width, height);
        const format = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const quality = format === 'image/jpeg' ? 0.88 : undefined;
        resolve(canvas.toDataURL(format, quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * React hook to reactively manage and observe effective avatar and source preferences.
 */
export function useEffectiveAvatar(userId?: string | null, tmpAvatarUrl?: string | null) {
  const [effectiveAvatar, setEffectiveAvatarState] = useState<string | null>(() =>
    getEffectiveAvatar(userId, tmpAvatarUrl)
  );
  const [source, setSourceState] = useState<AvatarSource>(() => getAvatarSource(userId));
  const [hasLocalPhoto, setHasLocalPhoto] = useState<boolean>(() => !!getLocalAvatar(userId));

  useEffect(() => {
    const update = () => {
      setEffectiveAvatarState(getEffectiveAvatar(userId, tmpAvatarUrl));
      setSourceState(getAvatarSource(userId));
      setHasLocalPhoto(!!getLocalAvatar(userId));
    };

    update();

    const handleAvatarChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ userId?: string }>;
      if (!userId || !customEvent.detail || customEvent.detail.userId === userId) {
        update();
      }
    };

    window.addEventListener('hub-avatar-changed', handleAvatarChanged);
    return () => {
      window.removeEventListener('hub-avatar-changed', handleAvatarChanged);
    };
  }, [userId, tmpAvatarUrl]);

  return {
    effectiveAvatar,
    source,
    hasLocalPhoto,
    setSource: (newSource: AvatarSource) => {
      if (userId) setAvatarSource(userId, newSource);
    },
    saveLocalPhoto: (dataUrl: string) => {
      if (userId) {
        setLocalAvatar(userId, dataUrl);
        setAvatarSource(userId, 'local');
      }
    },
    deleteLocalPhoto: () => {
      if (userId) {
        removeLocalAvatar(userId);
      }
    }
  };
}
