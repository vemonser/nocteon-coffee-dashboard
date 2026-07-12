import { Component, Input, OnChanges, effect, inject, ViewChild } from '@angular/core';
import { NgApexchartsModule, ChartComponent, ApexNonAxisChartSeries, ApexChart } from 'ng-apexcharts';
import { ThemeService } from '../../../../core/theme/theme.service';
import { getCssVarColor } from '../../../../shared/utils/utils';

@Component({
  selector: 'app-orders-status-chart',
  standalone: true,
  imports: [NgApexchartsModule],
  templateUrl: "./orders-status-chart.component.html",
})
export class OrdersStatusChartComponent implements OnChanges {
  @Input() data: { status: string; count: number }[] = [];
  @ViewChild('chartObj') chartObj!: ChartComponent;

  private themeService = inject(ThemeService);

  series: ApexNonAxisChartSeries = [];
  labels: string[] = [];
  colors: string[] = [];
  chart: ApexChart = { type: 'donut', height: 300 };

  private statusColorVars: Record<string, string> = {
    PENDING: '--color-warning',
    CONFIRMED: '--color-success',
    PROCESSING: '--color-info',
    SHIPPED: '--color-accent',
    DELIVERED: '--color-success',
    CANCELLED: '--color-danger',
  };

  constructor() {
    effect(() => {
      this.themeService.themeVersion();
      this.updateColors();
      this.applyColorsToChart();
    });
  }

  ngOnChanges() {
    this.updateData();
  }

  private updateColors() {
    this.colors = this.data.map((d) =>
      getCssVarColor(this.statusColorVars[d.status] || '--color-muted'),
    );
  }

  private updateData() {
    this.series = this.data.map((d) => d.count);
    this.labels = this.data.map((d) => d.status);
    this.updateColors();
  }

  private applyColorsToChart() {
    if (this.chartObj) {
      this.chartObj.updateOptions({ colors: this.colors }, false, false);
    }
  }
}