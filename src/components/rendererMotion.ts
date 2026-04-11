import { GradientParams } from '../App';

const SPRING_ALPHA = 0.08;

export function cloneParams(params: GradientParams): GradientParams {
  return { ...params };
}

export function stepSmoothedParams(current: GradientParams, target: GradientParams, alpha = SPRING_ALPHA): GradientParams {
  return {
    seed: target.seed,
    speed: current.speed + (target.speed - current.speed) * alpha,
    scale: current.scale + (target.scale - current.scale) * alpha,
    amplitude: current.amplitude + (target.amplitude - current.amplitude) * alpha,
    frequency: current.frequency + (target.frequency - current.frequency) * alpha,
    definition: current.definition + (target.definition - current.definition) * alpha,
    blend: current.blend + (target.blend - current.blend) * alpha,
    morphSpeed:
      current.morphSpeed + (target.morphSpeed - current.morphSpeed) * alpha,
    morphAmount:
      current.morphAmount + (target.morphAmount - current.morphAmount) * alpha,
    focusDistance:
      current.focusDistance + (target.focusDistance - current.focusDistance) * alpha,
    aperture: current.aperture + (target.aperture - current.aperture) * alpha,
    maxBlur: current.maxBlur + (target.maxBlur - current.maxBlur) * alpha,
    dofEnabled: target.dofEnabled,
    topoLineWidth:
      current.topoLineWidth + (target.topoLineWidth - current.topoLineWidth) * alpha,
    cloudType: target.cloudType,
  };
}
