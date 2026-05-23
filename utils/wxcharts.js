// -*- coding: utf-8 -*-
/*
 * wxcharts.js 简化版
 * 用于微信小程序中绘制图表
 */

class WxChart {
  constructor(opts) {
    this.canvasId = opts.canvasId;
    this.width = opts.width || 300;
    this.height = opts.height || 200;
    this.title = opts.title || '';
    this.categories = opts.categories || [];
    this.series = opts.series || [];
    this.colors = opts.colors || ['#1890FF', '#2FC25B', '#FACC14', '#F04864', '#8543E0'];
    this.axisPadding = opts.axisPadding || 10;
    this.yAxisMin = opts.yAxisMin;
    this.yAxisMax = opts.yAxisMax;
    this.yAxisFormat = opts.yAxis && opts.yAxis.format;
    this.context = opts.context;
  }

  draw() {
    const ctx = this.context
      ? wx.createCanvasContext(this.canvasId, this.context)
      : wx.createCanvasContext(this.canvasId);
    this.drawChart(ctx);
    ctx.draw();
  }

  // 绘制固定的Y轴
  drawYAxis(yAxisCanvasId) {
    const ctx = this.context
      ? wx.createCanvasContext(yAxisCanvasId, this.context)
      : wx.createCanvasContext(yAxisCanvasId);
    const width = 40;  // Y轴区域宽度
    const height = this.height;
    const topPadding = 30;
    const bottomPadding = 40;
    const chartHeight = height - topPadding - bottomPadding;
    
    // 确定y轴范围
    let yMin = this.yAxisMin !== undefined ? this.yAxisMin : 0;
    let yMax = this.yAxisMax !== undefined ? this.yAxisMax : 100;
    
    const yAxis = height - bottomPadding;
    
    // 绘制Y轴线
    ctx.beginPath();
    ctx.setStrokeStyle('#DDDDDD');
    ctx.setLineWidth(1);
    ctx.moveTo(width - 5, topPadding);
    ctx.lineTo(width - 5, yAxis);
    ctx.stroke();
    
    // 绘制Y轴刻度和标签
    const yStep = chartHeight / 4;
    ctx.setTextAlign('right');
    ctx.setTextBaseline('middle');
    ctx.setFontSize(10);
    ctx.setFillStyle('#999999');
    
    for (let i = 0; i <= 4; i++) {
      const y = yAxis - i * yStep;
      const val = yMin + (yMax - yMin) * (i / 4);
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(width - 5, y);
      ctx.lineTo(width - 10, y);
      ctx.stroke();
      
      // 绘制标签
      const labelText = this.yAxisFormat ? this.yAxisFormat(val) : val.toFixed(1);
      ctx.fillText(labelText, width - 12, y);
    }
    
    ctx.draw();
  }

  drawChart(ctx) {
    const leftPadding = 10;  // Y轴已分离，左边距减小
    const rightPadding = 30;  // 增加右边距，避免贴边
    const topPadding = 30;
    const bottomPadding = 40;
    const chartWidth = this.width - leftPadding - rightPadding;
    const chartHeight = this.height - topPadding - bottomPadding;
    
    // 绘制标题
    if (this.title) {
      ctx.setFontSize(14);
      ctx.setTextAlign('center');
      ctx.setFillStyle('#666666');
      ctx.fillText(this.title, this.width / 2, 20);
    }
    
    const xStart = leftPadding;
    const xEnd = this.width - rightPadding;
    const yAxis = this.height - bottomPadding;
    
    // 确定y轴范围
    let yMin = this.yAxisMin !== undefined ? this.yAxisMin : Number.MAX_VALUE;
    let yMax = this.yAxisMax !== undefined ? this.yAxisMax : Number.MIN_VALUE;
    
    if (this.yAxisMin === undefined || this.yAxisMax === undefined) {
      this.series.forEach(series => {
        series.data.forEach(val => {
          if (val < yMin) yMin = val;
          if (val > yMax) yMax = val;
        });
      });
      
      // 确保最小值和最大值不同
      if (yMin === yMax) {
        yMin = yMin - 1;
        yMax = yMax + 1;
      }
      
      // 为了美观，稍微扩大范围
      const range = yMax - yMin;
      yMin = yMin - range * 0.1;
      yMax = yMax + range * 0.1;
    }
    
    // 绘制X轴
    ctx.beginPath();
    ctx.setStrokeStyle('#DDDDDD');
    ctx.setLineWidth(1);
    ctx.moveTo(xStart, yAxis);
    ctx.lineTo(xEnd, yAxis);
    ctx.stroke();
    
    // 绘制x轴刻度和标签
    const xStep = chartWidth / (this.categories.length - 1 || 1);
    ctx.setFontSize(10);
    ctx.setTextAlign('center');
    ctx.setTextBaseline('top');
    ctx.setFillStyle('#999999');
    
    this.categories.forEach((label, index) => {
      const x = xStart + index * xStep;
      ctx.beginPath();
      ctx.moveTo(x, yAxis);
      ctx.lineTo(x, yAxis + 5);
      ctx.stroke();
      ctx.fillText(label, x, yAxis + 8);
    });
    
    // 绘制数据线
    this.series.forEach((series, seriesIndex) => {
      ctx.beginPath();
      ctx.setStrokeStyle(this.colors[seriesIndex % this.colors.length]);
      ctx.setLineWidth(2);
      
      series.data.forEach((val, index) => {
        const x = xStart + index * xStep;
        const y = yAxis - ((val - yMin) / (yMax - yMin)) * chartHeight;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
      
      // 绘制数据点
      series.data.forEach((val, index) => {
        const x = xStart + index * xStep;
        const y = yAxis - ((val - yMin) / (yMax - yMin)) * chartHeight;
        
        ctx.beginPath();
        ctx.setFillStyle(this.colors[seriesIndex % this.colors.length]);
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
      });
    });
  }
}

function createLineChart(opts) {
  return new WxChart(opts);
}

function drawYAxisOnly(opts) {
  const chart = new WxChart(opts);
  chart.drawYAxis(opts.yAxisCanvasId);
}

module.exports = {
  createLineChart,
  drawYAxisOnly
};
