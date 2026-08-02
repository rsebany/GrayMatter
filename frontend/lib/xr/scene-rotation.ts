export const SCENE_ROT_STEP_RAD = Math.PI / 2;

export type SceneEulerRotation = [number, number, number];

export function stepRotationY(
  current: SceneEulerRotation,
  direction: 1 | -1,
): SceneEulerRotation {
  return [current[0], current[1] + direction * SCENE_ROT_STEP_RAD, current[2]];
}

export const ZERO_ROTATION: SceneEulerRotation = [0, 0, 0];
