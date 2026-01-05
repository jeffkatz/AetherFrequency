
import { Component, ElementRef, OnInit, OnDestroy, ViewChild, inject, effect, ChangeDetectionStrategy } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { gsap } from 'gsap';
import { SimulationService } from '../../services/simulation.service';
import { SIM_CONFIG, CollisionEvent, SupernovaEvent } from '../../core/models';

const NODE_VERTEX_SHADER = `
  varying vec3 vPosition;
  varying float vFreq;
  attribute float aFrequency;
  uniform float uTime;
  uniform vec3 uClosestParticlePos;
  
  void main() {
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    
    float dist = distance(position, uClosestParticlePos);
    float proximityFactor = 1.0 - smoothstep(0.0, 6.0, dist);
    
    float pulse = sin(uTime * (aFrequency * 0.01)) * 0.1 + 1.0;
    float finalScale = pulse * (1.0 + proximityFactor * 1.5);
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position * finalScale, 1.0);
  }
`;

const NODE_FRAGMENT_SHADER = `
  varying vec3 vPosition;
  varying float vFreq;
  uniform float uTime;
  uniform vec3 uClosestParticlePos;
  uniform vec3 uBaseColor;
  
  void main() {
    float dist = distance(vPosition, uClosestParticlePos);
    float proximity = 1.0 - smoothstep(0.0, 5.0, dist);
    
    float pulse = sin(uTime * (vFreq * 0.01)) * 0.5 + 0.5;
    float alpha = mix(0.1, 0.3, pulse);
    
    vec3 color = mix(uBaseColor, vec3(0.5, 0.9, 1.0), proximity);
    gl_FragColor = vec4(color * (1.0 + proximity * 3.0), mix(alpha, 0.8, proximity));
  }
`;

const ENERGY_VERTEX_SHADER = `
  varying vec3 vNormal;
  varying float vDisplacement;
  uniform float uTime;
  uniform float uFrequency;
  uniform float uAmplitude;
  uniform float uHarmonic;
  
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    float n = p.x + p.y*57.0 + 113.0*p.z;
    return mix(mix(mix(hash(n+0.0), hash(n+1.0),f.x), mix(hash(n+57.0), hash(n+58.0),f.x),f.y),
               mix(mix(hash(n+113.0), hash(n+114.0),f.x), mix(hash(n+170.0), hash(n+171.0),f.x),f.y),f.z);
  }
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    float timeScale = uTime * (uFrequency * 0.005) * (1.0 + uHarmonic * 0.2);
    float spatialScale = 5.0 + uHarmonic * 2.0;
    float displacement = noise(position * spatialScale + timeScale) * uAmplitude * (1.0 + pow(uHarmonic, 1.2) * 0.4);
    vDisplacement = displacement;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * displacement * 0.3, 1.0);
  }
`;

const ENERGY_FRAGMENT_SHADER = `
  varying vec3 vNormal;
  varying float vDisplacement;
  uniform vec3 uColor;
  uniform float uHarmonic;
  uniform float uTime;
  
  void main() {
    float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
    vec3 color = uColor + vec3(0.1, 0.4, 0.8) * vDisplacement * (uHarmonic * 0.5);
    float intensity = (fresnel * (1.5 + uHarmonic)) + (vDisplacement * (0.5 + uHarmonic));
    gl_FragColor = vec4(color * intensity, 0.8);
  }
`;

@Component({
  selector: 'app-scene',
  template: `<div #container class="w-full h-full cursor-crosshair" (click)="onMapClick($event)"></div>`,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SceneComponent implements OnInit, OnDestroy {
  @ViewChild('container', { static: true }) container!: ElementRef<HTMLDivElement>;
  private sim = inject(SimulationService);

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private controls!: OrbitControls;
  private frameId?: number;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  private gridContainer = new THREE.Group();
  private stabilizerMeshes = new Map<string, THREE.Group>();
  private nodeMeshes: THREE.Mesh[] = [];
  private handledCollisions = new Set<string>();
  private handledSupernovas = new Set<string>();
  private particleLastNode = new Map<string, string | null>();

  constructor() {
    // Particle state management effect
    effect(() => {
      const parts = this.sim.particles();
      const nodes = this.sim.nodes();
      
      parts.forEach(part => {
        let group = this.stabilizerMeshes.get(part.id);
        if (!group) {
          group = this.createParticleMesh();
          this.stabilizerMeshes.set(part.id, group);
          this.scene.add(group);
          this.particleLastNode.set(part.id, part.targetNodeId);
        }

        const targetNode = nodes.find(n => n.id === part.targetNodeId);
        if (targetNode) {
          const lastNodeId = this.particleLastNode.get(part.id);
          if (part.targetNodeId && lastNodeId !== part.targetNodeId) {
            this.createTrail(group);
            this.particleLastNode.set(part.id, part.targetNodeId);
          }
          
          const targetWorldPosition = targetNode.position.clone().applyMatrix4(this.gridContainer.matrixWorld);

          gsap.to(group.position, {
            x: targetWorldPosition.x,
            y: targetWorldPosition.y,
            z: targetWorldPosition.z,
            duration: 1.5,
            ease: 'power3.out'
          });
        }

        const mesh = group.children[0] as THREE.Mesh;
        const mat = mesh.material as THREE.ShaderMaterial;
        mat.uniforms['uColor'].value.copy(part.color);
        mat.uniforms['uFrequency'].value = part.locationalFrequency;
        mat.uniforms['uAmplitude'].value = part.amplitude;
        mat.uniforms['uHarmonic'].value = part.harmonicFactor;
      });

      this.stabilizerMeshes.forEach((group, id) => {
        if (!parts.find(p => p.id === id)) {
          gsap.to(group.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.3, ease: 'power2.in',
            onComplete: () => {
              this.scene.remove(group);
              group.children.forEach(c => { if(c instanceof THREE.Mesh) c.geometry?.dispose() });
              this.stabilizerMeshes.delete(id);
              this.particleLastNode.delete(id);
            }
          });
        }
      });
    });

    effect(() => {
      this.sim.collisionEvents().forEach(event => {
        if (!this.handledCollisions.has(event.id)) { this.triggerCollisionVisuals(event); this.handledCollisions.add(event.id); }
      });
    });

    effect(() => {
      this.sim.supernovaEvents().forEach(event => {
        if (!this.handledSupernovas.has(event.id)) { this.triggerSupernovaVisuals(event); this.handledSupernovas.add(event.id); }
      });
    });

    effect(() => {
      const q = this.sim.gridRotation();
      gsap.to(this.gridContainer.quaternion, {
        _x: q.x, _y: q.y, _z: q.z, _w: q.w, duration: 1.0, ease: 'power3.out'
      });
    });
  }

  ngOnInit() {
    this.initThree();
    this.createNodes();
    this.animate();
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }

  private initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020617);
    this.scene.fog = new THREE.FogExp2(0x020617, 0.015);
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(25, 25, 25);
    this.scene.add(this.gridContainer);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.nativeElement.appendChild(this.renderer.domElement);
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.08;
    
    const renderScene = new RenderPass(this.scene, this.camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.8, 0.4, 0.1);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(bloomPass);
  }

  private createNodes() {
    const geometry = new THREE.OctahedronGeometry(0.12, 1);
    this.sim.nodes().forEach(node => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: NODE_VERTEX_SHADER, fragmentShader: NODE_FRAGMENT_SHADER, transparent: true,
        uniforms: { 
          uTime: { value: 0 }, uClosestParticlePos: { value: new THREE.Vector3(1000, 1000, 1000) }, 
          uBaseColor: { value: node.baseColor } 
        }
      });
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.geometry = mesh.geometry.clone();
      const freqs = new Float32Array(mesh.geometry.attributes.position.count).fill(node.frequency);
      mesh.geometry.setAttribute('aFrequency', new THREE.BufferAttribute(freqs, 1));
      mesh.position.copy(node.position);
      this.gridContainer.add(mesh);
      this.nodeMeshes.push(mesh);
    });
  }

  private createParticleMesh(): THREE.Group {
    const group = new THREE.Group();
    group.userData['isParticle'] = true;
    const mat = new THREE.ShaderMaterial({
      vertexShader: ENERGY_VERTEX_SHADER, fragmentShader: ENERGY_FRAGMENT_SHADER, transparent: true,
      uniforms: { 
        uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uFrequency: { value: 440 }, 
        uAmplitude: { value: 0.5 }, uHarmonic: { value: 1.0 } 
      }
    });
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 48), mat);
    group.add(mesh);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    group.add(core);
    return group;
  }

  onMapClick(event: MouseEvent) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    if (intersects.length > 0) {
      const hit = intersects.find(i => !i.object.parent?.userData['isParticle']);
      this.sim.spawnParticle(hit?.point || intersects[0].point);
    }
  }

  /**
   * Creates a short-lived visual trail from a particle's last position.
   * The trail inherits the particle's color and energy, then fades out.
   */
  private createTrail(particleGroup: THREE.Group) {
    const originalMesh = particleGroup.children[0] as THREE.Mesh;
    if (!originalMesh) return;

    const trailGeo = new THREE.IcosahedronGeometry(0.7, 5);
    const trailMat = (originalMesh.material as THREE.ShaderMaterial).clone();
    trailMat.uniforms['uTime'] = { value: performance.now() * 0.001 };
    trailMat.uniforms['uAmplitude'].value *= 0.7; // Start trail with slightly less energy
    trailMat.transparent = true;

    const trailMesh = new THREE.Mesh(trailGeo, trailMat);
    trailMesh.position.copy(particleGroup.position);
    trailMesh.quaternion.copy(particleGroup.quaternion);
    trailMesh.scale.copy(particleGroup.scale);
    this.scene.add(trailMesh);

    // Animate the trail fading out both in size and energy
    gsap.to(trailMesh.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 1.0, ease: 'power2.in' });
    gsap.to(trailMat.uniforms['uAmplitude'], { value: 0, duration: 1.2, ease: 'power2.out',
      onComplete: () => {
        this.scene.remove(trailMesh);
        trailGeo.dispose();
        trailMat.dispose();
      }
    });
  }

  private triggerCollisionVisuals(event: CollisionEvent) {
    const node = this.sim.nodes().find(n => n.id === event.nodeId);
    if (!node) return;
    const flashGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.position.copy(node.position).applyQuaternion(this.gridContainer.quaternion);
    this.scene.add(flashMesh);
    gsap.to(flashMesh.scale, { x: 8, y: 8, z: 8, duration: 0.7, ease: 'power3.out' });
    gsap.to(flashMesh.material, { opacity: 0, duration: 0.8, ease: 'power2.in',
      onComplete: () => { this.scene.remove(flashMesh); flashGeo.dispose(); flashMat.dispose(); }
    });
    event.particleIds.forEach(pId => {
      const particleGroup = this.stabilizerMeshes.get(pId);
      if (particleGroup) {
        const core = particleGroup.children[1] as THREE.Mesh;
        gsap.to(core.scale, { x: 1.8, y: 1.8, z: 1.8, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.inOut' });

        // Add a resonance pulse to the particle's energy shell
        const shell = particleGroup.children[0] as THREE.Mesh;
        if (shell) {
            const mat = shell.material as THREE.ShaderMaterial;
            gsap.to(mat.uniforms.uAmplitude, { 
                value: mat.uniforms.uAmplitude.value + 0.4, // Add a sharp visual spike
                duration: 0.2, 
                yoyo: true, 
                repeat: 1, 
                ease: 'power3.inOut'
            });
        }
      }
    });
    const nodeMesh = this.nodeMeshes.find(m => m.position.equals(node.position));
    if (nodeMesh) {
      gsap.to(nodeMesh.scale, { x: 3, y: 3, z: 3, duration: 0.25, yoyo: true, repeat: 1, ease: 'elastic.out(1, 0.5)' });

      // Add a resonance color flash to the node
      const mat = nodeMesh.material as THREE.ShaderMaterial;
      const resonanceColor = new THREE.Color(0xa78bfa); // A vibrant violet
      gsap.to(mat.uniforms.uBaseColor.value, {
        r: resonanceColor.r,
        g: resonanceColor.g,
        b: resonanceColor.b,
        duration: 0.2,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut'
      });
    }
  }

  private triggerSupernovaVisuals(event: SupernovaEvent) {
    const ringGeo = new THREE.RingGeometry(1, 1.2, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 1.0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(event.position).applyQuaternion(this.gridContainer.quaternion);
    ringMesh.lookAt(this.camera.position);
    this.scene.add(ringMesh);
    gsap.to(ringMesh.scale, { x: 25, y: 25, z: 25, duration: 1.2, ease: 'power3.out' });
    gsap.to(ringMesh.material, { opacity: 0, duration: 1.3, ease: 'power2.in',
      onComplete: () => { this.scene.remove(ringMesh); ringGeo.dispose(); ringMat.dispose(); }
    });
  }

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  };

  private animate = () => {
    this.frameId = requestAnimationFrame(this.animate);
    const time = performance.now() * 0.001;
    this.controls.update();
    
    this.stabilizerMeshes.forEach(group => {
      const mesh = group.children[0] as THREE.Mesh;
      (mesh.material as THREE.ShaderMaterial).uniforms['uTime'].value = time;
    });

    if (this.sim.particles().length > 0) {
      const localParticlePositions: THREE.Vector3[] = [];
      this.stabilizerMeshes.forEach(group => {
        localParticlePositions.push(this.gridContainer.worldToLocal(group.position.clone()));
      });

      this.nodeMeshes.forEach(node => {
        const mat = node.material as THREE.ShaderMaterial;
        mat.uniforms['uTime'].value = time;
        let minDistSq = Infinity;
        let closestPos = mat.uniforms['uClosestParticlePos'].value;
        localParticlePositions.forEach(localPos => {
          const dSq = node.position.distanceToSquared(localPos);
          if (dSq < minDistSq) {
            minDistSq = dSq;
            closestPos.copy(localPos);
          }
        });
      });
    }

    this.composer.render();
  };
}
