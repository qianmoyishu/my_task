Component({
  options: {
    styleIsolation: 'shared',
    addGlobalClass: true
  },

  properties: {
    thermalGrid: {
      type: Object,
      value: {
        data: [],
        gridData: [],
        minTemp: '--',
        maxTemp: '--',
        avgTemp: '--'
      }
    },
    thermalHistory: {
      type: Array,
      value: []
    },
    thermalHistoryIndex: {
      type: Number,
      value: 0
    },
    colorScheme: {
      type: String,
      value: 'iron'
    }
  },

  observers: {
    'thermalGrid.data, colorScheme': function(data) {
      if (data && data.length === 48) {
        this.queueDraw();
      }
    }
  },

  lifetimes: {
    ready() {
      this.queueDraw();
    }
  },

  methods: {
    onPrev() {
      this.triggerEvent('prev');
    },

    onNext() {
      this.triggerEvent('next');
    },

    onSchemeChange(e) {
      this.triggerEvent('schemechange', {
        scheme: e.currentTarget.dataset.scheme
      });
    },

    queueDraw() {
      if (this._drawTimer) {
        clearTimeout(this._drawTimer);
      }
      this._drawTimer = setTimeout(() => {
        this.drawThermalImage();
      }, 80);
    },

    calcThermalStats(data) {
      if (!data || data.length === 0) return { min: 20, max: 45, avg: 30 };
      let min = data[0], max = data[0], sum = 0;
      for (let i = 0; i < data.length; i++) {
        if (data[i] < min) min = data[i];
        if (data[i] > max) max = data[i];
        sum += data[i];
      }
      return {
        min: Math.round(min * 10) / 10,
        max: Math.round(max * 10) / 10,
        avg: Math.round(sum / data.length * 10) / 10
      };
    },

    tempToColor(temp, tmin, tmax) {
      let ratio = tmax === tmin ? 0.5 : (temp - tmin) / (tmax - tmin);
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;

      let r, g, b;
      const scheme = this.data.colorScheme;

      if (scheme === 'classic') {
        if (ratio < 0.25) {
          r = 0; g = Math.round(ratio * 4 * 255); b = 255;
        } else if (ratio < 0.5) {
          r = 0; g = 255; b = Math.round((0.5 - ratio) * 4 * 255);
        } else if (ratio < 0.75) {
          r = Math.round((ratio - 0.5) * 4 * 255); g = 255; b = 0;
        } else {
          r = 255; g = Math.round((1.0 - ratio) * 4 * 255); b = 0;
        }
      } else if (scheme === 'medical') {
        if (ratio < 0.5) {
          r = Math.round(ratio * 2 * 255);
          g = Math.round(ratio * 2 * 255);
          b = 255;
        } else {
          r = 255;
          g = Math.round(255 - (ratio - 0.5) * 2 * 255);
          b = Math.round(255 - (ratio - 0.5) * 2 * 255);
        }
      } else if (scheme === 'fire') {
        if (ratio < 0.15) {
          r = Math.round(100 + ratio * 6.67 * 155); g = 0; b = 0;
        } else if (ratio < 0.4) {
          r = 255; g = Math.round((ratio - 0.15) * 4.0 * 180); b = 0;
        } else if (ratio < 0.7) {
          r = 255; g = Math.round(180 + (ratio - 0.4) * 3.33 * 75); b = 0;
        } else {
          r = 255; g = 255; b = Math.round((ratio - 0.7) * 3.33 * 255);
        }
      } else {
        if (ratio < 0.2) {
          r = Math.round(ratio * 5 * 128); g = 0; b = 0;
        } else if (ratio < 0.4) {
          r = Math.round(128 + (ratio - 0.2) * 5 * 127); g = 0; b = 0;
        } else if (ratio < 0.6) {
          r = 255; g = Math.round((ratio - 0.4) * 5 * 128); b = 0;
        } else if (ratio < 0.8) {
          r = 255; g = Math.round(128 + (ratio - 0.6) * 5 * 127); b = 0;
        } else {
          r = 255; g = 255; b = Math.round((ratio - 0.8) * 5 * 255);
        }
      }

      return 'rgb(' + r + ',' + g + ',' + b + ')';
    },

    drawThermalImage() {
      const data = this.data.thermalGrid && this.data.thermalGrid.data;
      if (!data || data.length !== 48) return;

      const stats = this.calcThermalStats(data);
      const ctx = wx.createCanvasContext('thermalCanvas', this);
      const cw = 240, ch = 180, cellW = cw / 8, cellH = ch / 6;

      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 8; c++) {
          const temp = data[r * 8 + c];
          ctx.setFillStyle(this.tempToColor(temp, stats.min, stats.max));
          ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
        }
      }

      const barX = cw + 10, barW = 20;
      for (let y = 0; y < ch; y++) {
        const ratio = 1 - y / ch;
        const temp = stats.min + ratio * (stats.max - stats.min);
        ctx.setFillStyle(this.tempToColor(temp, stats.min, stats.max));
        ctx.fillRect(barX, y, barW, 1);
      }

      ctx.setFillStyle('#6a4b37');
      ctx.setFontSize(10);
      ctx.fillText(stats.max.toFixed(1) + '°C', barX + barW + 5, 12);
      ctx.fillText(stats.min.toFixed(1) + '°C', barX + barW + 5, ch);
      ctx.draw();
    }
  }
});
