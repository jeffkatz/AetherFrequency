
import { Injectable, signal, computed } from '@angular/core';
import * as THREE from 'three';
import { IntersectionNode, ParticleState, SIM_CONFIG, calculateNodeFrequency, CollisionEvent, SupernovaEvent } from '../core/models';

@Injectable({ providedIn: 'root' })
export class SimulationService {
  readonly nodes = signal<IntersectionNode[]>([]);
  readonly particles = signal<ParticleState[]>([]);
  readonly collisionEvents = signal<CollisionEvent[]>([]);
  readonly supernovaEvents = signal<SupernovaEvent[]>([]);

  readonly gridRotation = signal<THREE.Quaternion>(new THREE.Quaternion());
  readonly gridAngularVelocity = signal<THREE.Vector3>(new THREE.Vector3());
  
  readonly globalAmplitude = computed(() => {
    const parts = this.particles();
    if (parts.length === 0) return 0;
    return parts.reduce((acc, p) => acc + p.amplitude, 0) / parts.length;
  });

  constructor() {
    this.initializeNodes();
    this.spawnParticle(); 
    
    // Autonomous system loop
    setInterval(() => this.processFieldDynamics(), 100);
  }

  private initializeNodes() {
    const newNodes: IntersectionNode[] = [];
    const half = Math.floor(SIM_CONFIG.GRID_SIZE / 2);
    for (let x = -half; x <= half; x++) {
      for (let y = -half; y <= half; y++) {
        for (let z = -half; z <= half; z++) {
          const pos = new THREE.Vector3(x * SIM_CONFIG.SPACING, y * SIM_CONFIG.SPACING, z * SIM_CONFIG.SPACING);
          const freq = calculateNodeFrequency(pos);
          const isCorner = Math.abs(x) === half && Math.abs(y) === half && Math.abs(z) === half;
          newNodes.push({
            id: `${x}_${y}_${z}`,
            position: pos,
            frequency: freq,
            baseColor: new THREE.Color().setHSL((freq % 360) / 360, 0.7, 0.5),
            intensity: 0.2,
            isCorner
          });
        }
      }
    }
    this.nodes.set(newNodes);
  }

  spawnParticle(pos?: THREE.Vector3) {
    if (this.particles().length >= SIM_CONFIG.MAX_PARTICLES) return;

    let freq: number;
    if (pos) {
      freq = calculateNodeFrequency(pos);
    } else {
      const nonCornerNodes = this.nodes().filter(n => !n.isCorner);
      if (nonCornerNodes.length > 0) {
        const randomNode = nonCornerNodes[Math.floor(Math.random() * nonCornerNodes.length)];
        freq = randomNode.frequency + (Math.random() - 0.5) * 10;
      } else {
        // Fallback for very small grids where all nodes might be corners
        freq = 200 + Math.random() * 600;
      }
    }
    
    const newParticle: ParticleState = {
      id: Math.random().toString(36).substring(2, 9),
      baseFrequency: freq,
      locationalFrequency: freq,
      harmonicFactor: 1.0,
      amplitude: SIM_CONFIG.DEFAULT_AMPLITUDE,
      energyLevel: 0.1,
      pattern: 'sine',
      color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6),
      targetNodeId: null
    };

    this.particles.update(p => [...p, newParticle]);
    this.updateTargetNodes();
  }

  private processFieldDynamics() {
    // --- Grid Rotational Dynamics ---
    this.gridAngularVelocity.update(v => v.multiplyScalar(0.97)); // Damping
    if (this.gridAngularVelocity().lengthSq() > 0.000001) {
      const deltaRotation = new THREE.Quaternion().setFromAxisAngle(
        this.gridAngularVelocity().clone().normalize(),
        this.gridAngularVelocity().length()
      );
      this.gridRotation.update(q => q.premultiply(deltaRotation));
    }

    this.particles.update(parts => {
      // 1. Natural Drift & Decay with Rotational Influence
      let updated = parts.map(p => {
        let drift = (Math.random() - 0.5) * 4.0;
        
        const angularVel = this.gridAngularVelocity();
        if (angularVel.lengthSq() > 0.000001) {
            const targetNode = this.nodes().find(n => n.id === p.targetNodeId);
            if (targetNode) {
                // Simplified Coriolis-like effect on frequency
                const influenceVec = new THREE.Vector3().crossVectors(angularVel, targetNode.position);
                const rotationalDrift = (influenceVec.x + influenceVec.y + influenceVec.z) * 25.0;
                drift += rotationalDrift;
            }
        }
        
        let newFreq = p.locationalFrequency + drift;
        newFreq = Math.max(100, Math.min(999, newFreq));
        
        const decayedAmp = Math.max(SIM_CONFIG.DEFAULT_AMPLITUDE, p.amplitude - 0.005);
        const decayedHarmonic = Math.max(1.0, p.harmonicFactor - 0.02);
        const decayedEnergy = Math.max(0.1, p.energyLevel - 0.002);
        
        return { 
          ...p, locationalFrequency: newFreq, amplitude: decayedAmp, 
          harmonicFactor: decayedHarmonic, energyLevel: decayedEnergy
        };
      });

      // 2. Identify Target Nodes & Collisions
      const nodeOccupancy = new Map<string, string[]>(); 
      updated.forEach(p => {
        const target = this.findNearestNode(p.locationalFrequency);
        if (target) {
          p.targetNodeId = target.id;
          if (!nodeOccupancy.has(target.id)) nodeOccupancy.set(target.id, []);
          nodeOccupancy.get(target.id)!.push(p.id);
        }
      });

      // 3. Process Interference, Supernovas & Corner Weight
      const particleIdsToRemove = new Set<string>();
      let explosionsToProcess = 0;

      nodeOccupancy.forEach((pIds, nodeId) => {
        const node = this.nodes().find(n => n.id === nodeId);
        if (!node) return;

        // --- Corner Weight Mechanic ---
        if (node.isCorner) {
          pIds.forEach(pId => {
            const particle = updated.find(p => p.id === pId);
            if (particle && particle.energyLevel > 0.2) {
              const torque = node.position.clone().normalize().multiplyScalar(particle.energyLevel * 0.0005);
              this.gridAngularVelocity.update(v => v.add(torque));
            }
          });
        }
        
        if (pIds.length > 1) {
          // ... (existing collision logic)
          const collisionEvent: CollisionEvent = {
            id: `${nodeId}-${Date.now()}`, nodeId, particleIds: pIds, timestamp: Date.now()
          };
          this.collisionEvents.update(events => [...events, collisionEvent]);
          setTimeout(() => this.collisionEvents.update(events => events.filter(e => e.id !== collisionEvent.id)), 1500);

          let supernovaTriggered = false;
          const collidingParticles = pIds.map(id => updated.find(p => p.id === id)).filter(Boolean) as ParticleState[];

          if (collidingParticles.length > 1) {
            collidingParticles.forEach(currentParticle => {
              const otherParticles = collidingParticles.filter(p => p.id !== currentParticle.id);
              if (otherParticles.length === 0) return;
              const currentParticleIndex = updated.findIndex(p => p.id === currentParticle.id);
              if (currentParticleIndex === -1) return;

              const avgOtherBaseFrequency = otherParticles.reduce((acc, p) => acc + p.baseFrequency, 0) / otherParticles.length;
              const avgOtherAmplitude = otherParticles.reduce((acc, p) => acc + p.amplitude, 0) / otherParticles.length;
              const avgColor = otherParticles.reduce((acc, p) => acc.add(p.color), new THREE.Color(0,0,0));
              avgColor.multiplyScalar(1 / otherParticles.length);

              const maxFreqDiff = SIM_CONFIG.FREQ_RANGE[1] - SIM_CONFIG.FREQ_RANGE[0];
              const freqDifference = Math.abs(currentParticle.baseFrequency - avgOtherBaseFrequency);
              const resonanceFactor = Math.pow(1 - (freqDifference / maxFreqDiff), 2);
              const amplitudeFactor = (currentParticle.amplitude + avgOtherAmplitude) / 2;
              const harmonicIncrease = resonanceFactor * amplitudeFactor * (0.6 + otherParticles.length * 0.2);
              const oldHarmonicFactor = updated[currentParticleIndex].harmonicFactor;
              const newHarmonicFactor = Math.min(4.0, oldHarmonicFactor + harmonicIncrease);
              updated[currentParticleIndex].harmonicFactor = newHarmonicFactor;

              console.log(
                `[Collision @ Node ${nodeId}] Particle ${currentParticle.id} Harmonic Resonance (${otherParticles.length} others):
  - Freq Diff to Avg: ${freqDifference.toFixed(0)}Hz
  - Resonance Factor: ${resonanceFactor.toFixed(3)}
  - Harmonic Change: +${harmonicIncrease.toFixed(3)} (${oldHarmonicFactor.toFixed(2)} -> ${newHarmonicFactor.toFixed(2)})`
              );

              updated[currentParticleIndex].amplitude = Math.min(1.0, currentParticle.amplitude + (amplitudeFactor * 0.15));
              updated[currentParticleIndex].energyLevel = Math.min(1.0, currentParticle.energyLevel + 0.2 * otherParticles.length);
              updated[currentParticleIndex].color.lerp(avgColor, 0.15);

              if (updated[currentParticleIndex].energyLevel >= 1.0) {
                supernovaTriggered = true;
              }
            });
          }

          if (supernovaTriggered) {
            if (node) {
              const supernovaEvent: SupernovaEvent = {
                id: `sn-${nodeId}-${Date.now()}`, position: node.position, timestamp: Date.now()
              };
              this.supernovaEvents.update(events => [...events, supernovaEvent]);
              setTimeout(() => this.supernovaEvents.update(events => events.filter(e => e.id !== supernovaEvent.id)), 2000);
            }
            pIds.forEach(id => particleIdsToRemove.add(id));
            explosionsToProcess++;
          }
        }
      });

      // 4. Update state: filter destroyed particles
      let finalParticles = updated.filter(p => !particleIdsToRemove.has(p.id));
      
      // 5. Spawn new particles from supernovas
      for (let i = 0; i < explosionsToProcess; i++) {
        setTimeout(() => this.spawnParticle(), 50); 
      }

      return finalParticles;
    });

    // Handle any threshold rules
    if (this.globalAmplitude() >= 0.7 && this.particles().length < 3) {
      this.spawnParticle();
    }
  }

  private findNearestNode(freq: number): IntersectionNode | null {
    const nodes = this.nodes();
    if (nodes.length === 0) return null;
    return nodes.reduce((prev, curr) => 
      Math.abs(curr.frequency - freq) < Math.abs(prev.frequency - freq) ? curr : prev
    );
  }

  private updateTargetNodes() {
    this.particles.update(parts => parts.map(p => ({
      ...p,
      targetNodeId: this.findNearestNode(p.locationalFrequency)?.id || null
    })));
  }
}
