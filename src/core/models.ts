
import * as THREE from 'three';

export type WavePattern = 'sine' | 'chaos' | 'pulse';

export interface IntersectionNode {
  id: string;
  position: THREE.Vector3;
  frequency: number;
  baseColor: THREE.Color;
  intensity: number;
  isCorner: boolean;
}

export interface ParticleState {
  id:string;
  baseFrequency: number;
  locationalFrequency: number;
  harmonicFactor: number;
  amplitude: number;
  energyLevel: number;
  pattern: WavePattern;
  color: THREE.Color;
  targetNodeId: string | null;
}

export interface CollisionEvent {
  id: string;
  nodeId: string;
  particleIds: string[];
  timestamp: number;
}

export interface SupernovaEvent {
  id: string;
  position: THREE.Vector3;
  timestamp: number;
}

export const SIM_CONFIG = {
  GRID_SIZE: 7,
  SPACING: 4,
  FREQ_RANGE: [100, 999],
  INTERPOLATION_DURATION: 1.2,
  BLOOM_INTENSITY: 1.8,
  BASE_TUNING_STEP: 0.1,
  DEFAULT_AMPLITUDE: 0.4,
  MAX_PARTICLES: 8
};

export function calculateNodeFrequency(pos: THREE.Vector3): number {
  const xComp = (pos.x + 20) * 1.5;
  const yComp = (pos.y + 20) * 10.0;
  const zComp = (pos.z + 20) * 0.5;
  return Math.round(SIM_CONFIG.FREQ_RANGE[0] + (xComp + yComp + zComp) % (SIM_CONFIG.FREQ_RANGE[1] - SIM_CONFIG.FREQ_RANGE[0]));
}
