import type { SavedPreset, RecentScene, SceneState } from '../types';
import {
  SESSION_STORAGE_KEY,
  PRESETS_STORAGE_KEY,
  RECENT_SCENES_STORAGE_KEY,
  ONBOARDING_STORAGE_KEY,
} from '../constants';
import { normalizeSceneState } from '../utils/sceneUtils';
import { serializeSceneForPersistence } from '../migrations/sceneMigrations';

export { serializeSceneForPersistence };

export function readSessionScene(): SceneState | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? normalizeSceneState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function readSavedPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): SavedPreset | null => {
        const scene = normalizeSceneState(item);
        if (
          !scene ||
          typeof item.id !== "string" ||
          typeof item.name !== "string" ||
          typeof item.createdAt !== "string"
        ) return null;
        return { ...scene, id: item.id, name: item.name, createdAt: item.createdAt };
      })
      .filter((item): item is SavedPreset => item !== null);
  } catch {
    return [];
  }
}

export function readRecentScenes(): RecentScene[] {
  try {
    const raw = localStorage.getItem(RECENT_SCENES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): RecentScene | null => {
        const scene = normalizeSceneState(item);
        if (
          !scene ||
          typeof item.id !== "string" ||
          typeof item.name !== "string" ||
          typeof item.seenAt !== "string"
        ) return null;
        const source =
          item.source === "preset" || item.source === "shared" || item.source === "live"
            ? item.source
            : "live";
        return { ...scene, id: item.id, name: item.name, seenAt: item.seenAt, source };
      })
      .filter((item): item is RecentScene => item !== null);
  } catch {
    return [];
  }
}

export function readOnboardingDismissed(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}
