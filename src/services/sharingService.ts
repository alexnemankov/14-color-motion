import type { SceneState } from '../types';
import { VALID_ANIMATION_TYPES, SHARE_PARAM_KEY, SHARE_NAME_PARAM_KEY, SHARE_SCENE_VERSION, DEFAULT_PARAMS } from '../constants';
import { rgbToShareHex, shareHexToRgb } from '../utils/colorUtils';
import { normalizeSceneState } from '../utils/sceneUtils';
import { CURRENT_SCENE_VERSION } from '../migrations/sceneMigrations';

function encodeBase64Url(value: string): string {
  const utf8 = new TextEncoder().encode(value);
  let binary = "";
  utf8.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function toShareNumber(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function serializeShareScene(scene: SceneState, name?: string | null): string {
  const payload = {
    v: SHARE_SCENE_VERSION,
    sv: CURRENT_SCENE_VERSION,
    a: VALID_ANIMATION_TYPES.indexOf(scene.animationType),
    p: [
      scene.params.seed,
      toShareNumber(scene.params.speed),
      toShareNumber(scene.params.scale),
      toShareNumber(scene.params.amplitude),
      toShareNumber(scene.params.frequency),
      scene.params.definition,
      toShareNumber(scene.params.blend),
      toShareNumber(scene.params.morphSpeed),
      toShareNumber(scene.params.morphAmount),
      toShareNumber(scene.params.focusDistance),
      toShareNumber(scene.params.aperture),
      toShareNumber(scene.params.maxBlur),
      scene.params.dofEnabled ? 1 : 0,
    ],
    c: scene.colors.map(rgbToShareHex),
    ...(name ? { n: name.slice(0, 80) } : {}),
  };
  return encodeBase64Url(JSON.stringify(payload));
}

export function parseCompactSharedScene(
  raw: string,
): { scene: SceneState; name: string | null } | null {
  try {
    const decoded = JSON.parse(decodeBase64Url(raw)) as {
      v?: string; sv?: number; a?: number; p?: unknown[]; c?: unknown[]; n?: string;
    };

    if (decoded.v !== SHARE_SCENE_VERSION) return null;
    if (typeof decoded.a !== "number" || !VALID_ANIMATION_TYPES[decoded.a]) return null;
    if (!Array.isArray(decoded.p) || decoded.p.length < 10) return null;
    if (!Array.isArray(decoded.c)) return null;

    const colors = decoded.c
      .map((v) => (typeof v === "string" ? shareHexToRgb(v) : null))
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .slice(0, 8);

    if (colors.length < 2) return null;

    const scene = normalizeSceneState({
      version: typeof decoded.sv === "number" ? decoded.sv : 0,
      animationType: VALID_ANIMATION_TYPES[decoded.a],
      params: {
        seed: decoded.p[0],
        speed: decoded.p[1],
        scale: decoded.p[2],
        amplitude: decoded.p[3],
        frequency: decoded.p[4],
        definition: decoded.p[5],
        blend: decoded.p[6],
        morphSpeed: decoded.p[7] ?? DEFAULT_PARAMS.morphSpeed,
        morphAmount: decoded.p[8] ?? DEFAULT_PARAMS.morphAmount,
        focusDistance: decoded.p[9] ?? DEFAULT_PARAMS.focusDistance,
        aperture: decoded.p[10] ?? DEFAULT_PARAMS.aperture,
        maxBlur: decoded.p[11] ?? DEFAULT_PARAMS.maxBlur,
        dofEnabled:
          decoded.p[12] === 0 ? false : decoded.p[12] === 1 ? true : DEFAULT_PARAMS.dofEnabled,
      },
      colors,
    });

    if (!scene) return null;

    const name =
      typeof decoded.n === "string" && decoded.n.trim()
        ? decoded.n.trim().slice(0, 80)
        : null;

    return { scene, name };
  } catch {
    return null;
  }
}

export function readSharedSceneBundle(): { scene: SceneState; name: string | null } | null {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get(SHARE_PARAM_KEY);
    if (!raw) return null;

    const compact = parseCompactSharedScene(raw);
    if (compact) return compact;

    const scene = normalizeSceneState(JSON.parse(decodeURIComponent(raw)));
    if (!scene) return null;

    const legacyNameRaw = url.searchParams.get(SHARE_NAME_PARAM_KEY);
    const legacyName = legacyNameRaw
      ? decodeURIComponent(legacyNameRaw).trim().slice(0, 80)
      : "";

    return { scene, name: legacyName || null };
  } catch {
    return null;
  }
}

export function readSharedSceneName(): string | null {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get(SHARE_NAME_PARAM_KEY);
    if (!raw) return null;
    const name = decodeURIComponent(raw).trim();
    return name ? name.slice(0, 80) : null;
  } catch {
    return null;
  }
}
