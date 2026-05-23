const wxCharts = require('../../utils/wxcharts');

Component({
  options: {
    styleIsolation: 'shared',
    addGlobalClass: true
  },

  properties: {
    chartDataPoints: {
      type: Array,
      value: []
    },
    centerPointData: {
      type: Object,
      value: {
        time: '',
        value: ''
      }
    },
    currentData: {
      type: Object,
      value: {
        unit: ''
      }
    },
    sliderIndex: {
      type: Number,
      value: 0
    },
    sliderPercent: {
      type: Number,
      value: 0
    },
    chartPage: {
      type: Number,
      value: 1
    },
    chartTotalPages: {
      type: Number,
      value: 1
    },
    chartWidth: {
      type: Number,
      value: 300
    }
  },

  methods: {
    onSliderChange(e) {
      this.triggerEvent('sliderchange', {
        value: e.detail.value
      });
    },

    onSliderChanging(e) {
      this.triggerEvent('sliderchanging', {
        value: e.detail.value
      });
    },

    onChartScroll(e) {
      this.triggerEvent('chartscroll', e.detail || {});
    },

    onPrevPage() {
      this.triggerEvent('prevpage');
    },

    onNextPage() {
      this.triggerEvent('nextpage');
    },

    clearChart() {
      const main = wx.createCanvasContext('currentChart', this);
      main.clearRect(0, 0, 1000, 1000);
      main.draw();

      const axis = wx.createCanvasContext('yAxisChart', this);
      axis.clearRect(0, 0, 1000, 1000);
      axis.draw();
    },

    drawChart(config) {
      if (!config || !config.chartConfig || !config.yAxisConfig) return;

      wxCharts.drawYAxisOnly({
        ...config.yAxisConfig,
        context: this
      });

      wxCharts.createLineChart({
        ...config.chartConfig,
        context: this
      }).draw();
    }
  }
});
