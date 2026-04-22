import type { AnimationType, ColorRgb, GradientParams, SceneState } from '../App';

export const CURRENT_SCENE_VERSION = 2;

interface MigrationContext {
  defaultParams: GradientParams;
  validAnimationTypes: AnimationType[];
}

interface PersistedScenePayload {
  version: number;
  animationType: AnimationType;
  params: Partial<GradientParams>;
  colors: unknown;
}

type LegacyScenePayload = Partial<SceneState> & { version?: number };

const migrations: Record<number, (payload: LegacyScenePayload, context: MigrationContext) => PersistedScenePayload> = {
  0: (payload, context) => ({
    version: 2,
    animationType: payload.animationType as AnimationType,
    params: { ...context.defaultParams, ...(payload.params ?? {}) },
    colors: payload.colors ?? [],
  }),
  1: (payload, context) => ({
    version: 2,
    animationType: payload.animationType as AnimationType,
    params: { ...context.defaultParams, ...(payload.params ?? {}) },
    colors: payload.colors ?? [],
  }),
};

export function serializeSceneForPersistence(scene: SceneState) {
  return {
    version: CURRENT_SCENE_VERSION,
    animationType: scene.animationType,
    params: { ...scene.params },
    colors: scene.colors.map(color => [...color] as ColorRgb),
  };
}

export function migratePersistedScene(value: unknown, context: MigrationContext): PersistedScenePayload | null {
  if (!value || typeof value !== 'object') return null;

  let current: LegacyScenePayload | PersistedScenePayload = value as LegacyScenePayload;
  let version = typeof current.version === 'number' ? current.version : 0;

  if (version > CURRENT_SCENE_VERSION) return null;

  while (version < CURRENT_SCENE_VERSION) {
    const migrate = migrations[version];
    if (!migrate) return null;
    current = migrate(current as LegacyScenePayload, context);
    version = current.version;
  }

  if (!current.animationType || !context.validAnimationTypes.includes(current.animationType)) return null;

  return {
    version: CURRENT_SCENE_VERSION,
    animationType: current.animationType,
    params: current.params ?? context.defaultParams,
    colors: current.colors ?? [],
  };
}
