// features/dashboard/components/category-chart/category-chart.component.ts
import { Component, Input, ViewChild, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule, ChartComponent } from 'ng-apexcharts';
import {
  ApexNonAxisChartSeries,
  ApexChart,

  ApexLegend,
  ApexPlotOptions,
  ApexDataLabels,
} from 'ng-apexcharts';
import { ThemeService } from '../../../core/theme/theme.service';


export type CategoryChartOptions = {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  labels: string[];
  colors: string[];
  legend: ApexLegend;
  plotOptions: ApexPlotOptions;
  dataLabels: ApexDataLabels;
};

@Component({
  selector: 'app-category-chart',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './category-chart.component.html',
})
export class CategoryChartComponent {
  @Input() data: { category: string; revenue: number }[] = [];
  @ViewChild('chart') chart!: ChartComponent;

  private themeService = inject(ThemeService);

  chartOptions: CategoryChartOptions;

  constructor() {
    this.chartOptions = {
      series: [],
      chart: {
        type: 'donut',
        height: 300,
        fontFamily: 'inherit',
      },
      labels: [],
      colors: [
        'var(--primary)',
        'var(--secondary)',
        'var(--accent)',
        'var(--muted)',
        'var(--destructive)',
      ],
      legend: {
        position: 'right',
        labels: { colors: 'var(--foreground)' },
      },
      plotOptions: {
        pie: {
          donut: {
            size: '65%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Total',
                color: 'var(--foreground)',
                formatter: (w: any) => {
                  const total = w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
                  return `$${total.toLocaleString()}`;
                },
              },
            },
          },
        },
      },
      dataLabels: { enabled: false },
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
    this.chartOptions.series = this.data.map((d) => d.revenue);
    this.chartOptions.labels = this.data.map((d) => d.category);
  }

  private updateTheme() {
    this.chartOptions.legend = {
      ...this.chartOptions.legend,
      labels: { colors: 'var(--foreground)' },
    };

    if (this.chart) {
      this.chart.updateOptions({
        legend: { labels: { colors: 'var(--foreground)' } },
      });
    }
  }
}