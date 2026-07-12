// features/dashboard/components/status-chart/status-chart.component.ts
import { Component, Input, ViewChild, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule, ChartComponent } from 'ng-apexcharts';
import {
  ApexNonAxisChartSeries,
  ApexChart,

  ApexLegend,
  ApexPlotOptions,
} from 'ng-apexcharts';
import { ThemeService } from '../../../../core/theme/theme.service';


@Component({
  selector: 'app-status-chart',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './status-chart.component.html',
})
export class StatusChartComponent {
  @Input() data: { status: string; count: number }[] = [];
  @ViewChild('chart') chart!: ChartComponent;

  private themeService = inject(ThemeService);

  chartOptions = {
    series: [] as ApexNonAxisChartSeries,
    chart: { type: 'donut' as const, height: 280, fontFamily: 'inherit' },
    labels: [] as string[],
    colors: [
      'var(--color-warning)',
      'var(--color-success)',
      'var(--color-info)',
      'var(--color-accent)',
      'var(--color-danger)',
    ],
    legend: {
      position: 'bottom' as const,
      labels: { colors: 'var(--foreground)' },
    },
    plotOptions: {
      pie: {
        donut: {
          size: '60%',
          labels: {
            show: true,
            name: { color: 'var(--foreground)' },
            value: { color: 'var(--foreground)' },
          },
        },
      },
    },
  };

  constructor() {
    effect(() => {
      this.themeService.themeVersion();
      this.updateTheme();
    });
  }

  ngOnChanges() {
    this.chartOptions.series = this.data.map((d) => d.count);
    this.chartOptions.labels = this.data.map((d) => d.status);
  }

  private updateTheme() {
    this.chartOptions.legend.labels.colors = 'var(--foreground)';
    this.chart?.updateOptions({
      legend: { labels: { colors: 'var(--foreground)' } },
    });
  }
}