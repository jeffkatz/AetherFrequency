
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SimulationService } from '../../services/simulation.service';
import { FrequencyGraphComponent } from './frequency-graph.component';

@Component({
  selector: 'app-controls',
  standalone: true,
  imports: [CommonModule, FrequencyGraphComponent],
  template: `
    <div class="fixed top-6 left-6 w-80 bg-slate-950/90 backdrop-blur-2xl border border-slate-700/40 rounded-3xl p-6 shadow-2xl flex flex-col gap-6 select-none overflow-hidden">
      <div class="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/10 blur-3xl rounded-full"></div>
      
      <header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#22d3ee]"></div>
            <h1 class="text-xl font-black bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent tracking-tighter">
              AETHER FIELD
            </h1>
          </div>
          <span class="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 font-bold">V 2.5</span>
        </div>
        <p class="text-[9px] text-slate-500 mt-1 uppercase tracking-[0.3em] font-bold opacity-80">Autonomous Emergent System</p>
      </header>

      <div class="grid grid-cols-2 gap-3">
        <div class="bg-slate-900/50 p-3 rounded-2xl border border-slate-800/50">
          <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Active Seeds</label>
          <div class="text-2xl font-black text-cyan-400">{{ sim.particles().length }}</div>
        </div>
        <div class="bg-slate-900/50 p-3 rounded-2xl border border-slate-800/50">
          <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Field Energy</label>
          <div class="text-2xl font-black text-indigo-400">{{ (sim.globalAmplitude() * 100).toFixed(0) }}%</div>
        </div>
      </div>

      <section class="flex flex-col gap-2">
        <div class="flex justify-between items-center px-1">
          <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Stability</label>
          <span class="text-[10px] font-mono text-cyan-400">{{ sim.globalAmplitude() > 0.7 ? 'UNSTABLE' : 'EQUILIBRIUM' }}</span>
        </div>
        <div class="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-500" [style.width.%]="sim.globalAmplitude() * 100"></div>
        </div>
      </section>

      <section class="bg-black/40 rounded-2xl p-4 border border-slate-800/30">
        <app-frequency-graph></app-frequency-graph>
      </section>

      <div class="flex flex-col gap-3">
        <button (click)="sim.spawnParticle()" class="w-full py-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-[11px] font-black rounded-xl border border-cyan-500/30 transition-all uppercase tracking-[0.2em]">
          Seed New Particle
        </button>
        <p class="text-[9px] text-slate-500 text-center italic">Tip: Click the field to seed at a specific node</p>
      </div>

      <footer class="text-[9px] text-slate-600 font-bold uppercase tracking-widest text-center opacity-60">
        Intrinsic State • Volumetric Field
      </footer>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ControlsComponent {
  sim = inject(SimulationService);
}
