
import { Component, ElementRef, OnInit, ViewChild, inject, effect, ChangeDetectionStrategy } from '@angular/core';
import * as d3 from 'd3';
import { SimulationService } from '../../services/simulation.service';

@Component({
  selector: 'app-frequency-graph',
  template: `<div #chart class="w-full h-48"></div>`,
  styles: [`:host { display: block; }`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FrequencyGraphComponent implements OnInit {
  @ViewChild('chart', { static: true }) chartContainer!: ElementRef<HTMLDivElement>;
  private sim = inject(SimulationService);
  
  private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private margin = { top: 20, right: 10, bottom: 25, left: 35 };

  constructor() {
    effect(() => {
      this.updateChart();
    });
  }

  ngOnInit() {
    this.initChart();
  }

  private initChart() {
    const width = this.chartContainer.nativeElement.clientWidth || 300;
    const height = this.chartContainer.nativeElement.clientHeight || 200;

    this.svg = d3.select(this.chartContainer.nativeElement)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`);
  }

  private updateChart() {
    if (!this.svg) return;

    const width = this.chartContainer.nativeElement.clientWidth - this.margin.left - this.margin.right;
    const height = this.chartContainer.nativeElement.clientHeight - this.margin.top - this.margin.bottom;
    
    if (width <= 0 || height <= 0) return;

    const nodes = this.sim.nodes();
    const particles = this.sim.particles();

    const x = d3.scaleLinear().domain([100, 1000]).range([0, width]);
    const y = d3.scaleLinear().domain([0, 1]).range([height, 0]);

    this.svg.selectAll('*').remove();
    const g = this.svg.append('g').attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    // Draw grid lines
    g.selectAll('line.grid-x')
      .data(x.ticks(5))
      .enter()
      .append('line')
      .attr('x1', d => x(d))
      .attr('x2', d => x(d))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 1);

    // Distribution bars
    const bins = d3.bin().domain([100, 1000]).thresholds(20)(nodes.map(n => n.frequency));
    const maxCount = d3.max(bins, d => d.length) || 1;

    g.selectAll('rect.freq-bar')
      .data(bins)
      .enter()
      .append('rect')
      .attr('class', 'freq-bar')
      .attr('x', d => x(d.x0 || 0))
      .attr('width', d => Math.max(0, x(d.x1 || 0) - x(d.x0 || 0) - 2))
      .attr('y', d => height - (d.length / maxCount) * height)
      .attr('height', d => (d.length / maxCount) * height)
      .attr('fill', '#1e293b')
      .attr('rx', 1);

    // Active particle indicators
    particles.forEach((p, i) => {
      const markerX = x(p.locationalFrequency);
      const color = `#${p.color.getHexString()}`;
      
      g.append('line')
        .attr('x1', markerX)
        .attr('x2', markerX)
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.6)
        .attr('stroke-dasharray', '4,2');

      g.append('circle')
        .attr('cx', markerX)
        .attr('cy', 0)
        .attr('r', 3)
        .attr('fill', color);
    });

    // X-Axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5).tickSize(5).tickPadding(5))
      .attr('color', '#475569')
      .selectAll('text')
      .attr('font-size', '10px');
  }
}
