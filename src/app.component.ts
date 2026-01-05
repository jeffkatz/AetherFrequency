
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SceneComponent } from './components/scene/scene.component';
import { ControlsComponent } from './components/ui/controls.component';
import { FrequencyGraphComponent } from './components/ui/frequency-graph.component';
import { SimulationService } from './services/simulation.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, SceneComponent, ControlsComponent, FrequencyGraphComponent],
  template: `
<main class="relative w-screen h-screen overflow-hidden">
  <!-- Three.js Visualizer -->
  <app-scene></app-scene>

  <!-- Control Overlay -->
  <app-controls></app-controls>

  <!-- Help / Info Overlay (Bottom Right) -->
  <div class="fixed bottom-6 right-6 text-right max-w-sm pointer-events-none">
    <div class="bg-slate-900/40 backdrop-blur-md p-5 rounded-3xl border border-slate-800 shadow-2xl">
      <h2 class="text-xs font-black text-cyan-400 mb-2 uppercase tracking-widest">Aether Dynamics Log</h2>
      <div class="space-y-1.5 font-mono text-[10px] text-slate-400">
        <p>Relational Nodes: <span class="text-slate-200">343</span></p>
        <p>Dimensional Drift: <span class="text-slate-200">±{{ (0.0004 * (1 + sim.globalAmplitude())).toFixed(6) }}</span></p>
        <p>Manifested States: <span class="text-slate-200">{{ sim.particles().length }}</span></p>
        <p class="pt-2 text-cyan-500/80 animate-pulse">>>> SCANNING FOR FREQUENCY INTERFERENCE...</p>
      </div>
    </div>
  </div>
</main>
`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  public sim = inject(SimulationService);
}
