// features/dashboard/components/revenue-chart/revenue-chart.component.ts
import { Component, Input, ViewChild, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule, ChartComponent } from 'ng-apexcharts';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexStroke,
  ApexFill,
  ApexDataLabels,
  ApexGrid,
  ApexTooltip,
} from 'ng-apexcharts';
import { ThemeService } from '../../../../core/theme/theme.service';



export type RevenueChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  stroke: ApexStroke;
  fill: ApexFill;
  colors: string[];
  dataLabels: ApexDataLabels;
  grid: ApexGrid;
  tooltip: ApexTooltip;
};

@Component({
  selector: 'app-revenue-chart',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './revenue-chart.component.html',
})
export class RevenueChartComponent {
  @Input() data: { date: string; revenue: number }[] = [];
  @ViewChild('chart') chart!: ChartComponent;

  private themeService = inject(ThemeService);

  chartOptions: RevenueChartOptions;

  constructor() {
    this.chartOptions = {
      series: [],
      chart: {
        type: 'area',
        height: 300,
        toolbar: { show: false },
        fontFamily: 'inherit',
      },
      xaxis: {
        categories: [],
        labels: { style: { colors: 'var(--muted-foreground)' } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      stroke: {
        curve: 'smooth',
        width: 2,
      },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.3,
          opacityTo: 0.05,
          stops: [0, 100],
        },
      },
      colors: ['var(--primary)'],
      dataLabels: { enabled: false },
      grid: {
        borderColor: 'var(--border)',
        strokeDashArray: 4,
        yaxis: { lines: { show: true } },
      },
      tooltip: {
        theme: this.themeService.theme() === 'dark' ? 'dark' : 'light',
        y: { formatter: (val: number) => `$${val.toLocaleString()}` },
      },
    };

    effect(() => {
      this.themeService.themeVersion();
      this.updateTheme();
    });
  }

  ngOnChanges() {
    this.updateData();
  }

  private updateData() {
    this.chartOptions.series = [
      { name: 'Revenue', data: this.data.map((d) => d.revenue) },
    ];
    this.chartOptions.xaxis = {
      ...this.chartOptions.xaxis,
      categories: this.data.map((d) =>
        new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      ),
    };
  }

  private updateTheme() {
    const isDark = this.themeService.theme() === 'dark';
    this.chartOptions.colors = ['var(--primary)'];
    this.chartOptions.tooltip = {
      ...this.chartOptions.tooltip,
      theme: isDark ? 'dark' : 'light',
    };
    this.chartOptions.grid = {
      ...this.chartOptions.grid,
      borderColor: 'var(--border)',
    };

    if (this.chart) {
      this.chart.updateOptions({
        colors: this.chartOptions.colors,
        tooltip: { theme: isDark ? 'dark' : 'light' },
        grid: { borderColor: 'var(--border)' },
      });
    }
  }
}