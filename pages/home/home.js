const huaweiApi = require('../../utils/huawei-api.js');
const app = getApp();

Page({
  data: {
    iamToken: '',
    gsr: { current: 0, unit: '', min: 0, max: 2000, history: [] },
    mlxTemp: { current: 0, unit: 'C', min: 0, max: 50, history: [] },
    heartRate: { current: 0, unit: 'bpm', min: 0, max: 200, history: [] },
    thermalGrid: {
      data: [],
      gridData: [],
      rows: 6,
      cols: 8,
      unit: 'C',
      min: 20,
      max: 45,
      avgTemp: 0,
      maxTemp: 0,
      minTemp: 0
    },
    colorScheme: 'iron',
    lastUpdatedTime: '',
    refreshInterval: 5000,
    isLoading: true,
    showSettings: false,
    deviceInfo: {},
    deviceStatus: '',
    error: null,
    settingsForm: {
      iamEndpoint: '',
      userName: '',
      iamUserName: '',
      iamUserPassword: '',
      productName: '',
      iotDAEndpoint: '',
      product_id: '',
      device_id: '',
      refreshInterval: 5000
    }
  },

  onLoad: function() {
    this.setData({
      refreshInterval: app.globalData.refreshInterval,
      settingsForm: {
        iamEndpoint: app.globalData.iamEndpoint,
        userName: app.globalData.userName,
        iamUserName: app.globalData.iamUserName,
        iamUserPassword: app.globalData.iamUserPassword,
        productName: app.globalData.productName,
        iotDAEndpoint: app.globalData.iotDAEndpoint,
        product_id: app.globalData.product_id,
        device_id: app.globalData.device_id,
        refreshInterval: app.globalData.refreshInterval
      }
    });
    if (this.isConfigComplete()) {
      this.startDataRefresh();
    } else {
      this.setData({ showSettings: true, isLoading: false, error: '' });
    }
  },

  onShow: function() {
    if (this.isConfigComplete() && !this.refreshTimer) {
      this.startDataRefresh();
    }
  },

  onHide: function() { this.stopDataRefresh(); },
  onUnload: function() { this.stopDataRefresh(); },

  isConfigComplete: function() {
    const g = app.globalData;
    return g.iamEndpoint && g.userName && g.iamUserName && g.iamUserPassword && 
           g.productName && g.iotDAEndpoint && g.product_id && g.device_id;
  },

  startDataRefresh: function() {
    this.fetchDeviceData();
    this.refreshTimer = setInterval(() => { this.fetchDeviceData(); }, this.data.refreshInterval);
  },

  stopDataRefresh: function() {
    if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
  },

  fetchDeviceData: async function() {
    try {
      this.setData({ isLoading: true, error: null });
      const token = await huaweiApi.getIamToken();
      this.setData({ iamToken: token });
      const deviceStatus = await huaweiApi.getDeviceStatus(token);
      const properties = await huaweiApi.getDeviceProperties(token);
      this.updateDeviceInfo(deviceStatus, properties);
      this.setData({ isLoading: false });
    } catch (error) {
      console.error('获取数据失败', error);
      this.setData({ isLoading: false, error: '获取数据失败: ' + error });
    }
  },

  handleManualRefresh: function() { this.fetchDeviceData(); },

  updateDeviceInfo: function(deviceStatus, properties) {
    const deviceInfo = {
      name: deviceStatus.device_name || '未知设备',
      id: deviceStatus.device_id,
      status: deviceStatus.status === 'ONLINE' ? '在线' : '离线'
    };
    
    let gsrValue = 0, mlxTempValue = 0, heartRateValue = 0, thermalGridData = [];
    
    if (properties && properties.services) {
      console.log("设备属性:", JSON.stringify(properties, null, 2));
      properties.services.forEach(service => {
        if (service.service_id === app.globalData.service_id && service.properties) {
          service.properties.forEach(prop => {
            const name = prop.property_name || "";
            const val = prop.value;
            if (name === 'Gsr') gsrValue = Number(val) || 0;
            else if (name === 'MLX90600') mlxTempValue = Number(val) || 0;
            else if (name === 'Heart_rate') heartRateValue = Number(val) || 0;
            else if (name === 'thermal_grid' && Array.isArray(val)) {
              thermalGridData = val.map(v => Number(v) || 0);
            }
          });
        }
      });
    }
    
    const now = new Date();
    const timeString = now.getFullYear() + '-' + (now.getMonth()+1) + '-' + now.getDate() + ' ' + 
                       now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();
    
    const gsr = this.data.gsr;
    gsr.current = gsrValue;
    gsr.history.push({ value: gsrValue, time: timeString });
    if (gsr.history.length > 10) gsr.history.shift();
    
    const mlxTemp = this.data.mlxTemp;
    mlxTemp.current = mlxTempValue;
    mlxTemp.history.push({ value: mlxTempValue, time: timeString });
    if (mlxTemp.history.length > 10) mlxTemp.history.shift();
    
    const heartRate = this.data.heartRate;
    heartRate.current = heartRateValue;
    heartRate.history.push({ value: heartRateValue, time: timeString });
    if (heartRate.history.length > 10) heartRate.history.shift();
    
    const thermalGrid = this.data.thermalGrid;
    if (thermalGridData.length === 48) {
      thermalGrid.data = thermalGridData;
      thermalGrid.gridData = this.convertToGridData(thermalGridData);
      const stats = this.calcThermalStats(thermalGridData);
      thermalGrid.minTemp = stats.min;
      thermalGrid.maxTemp = stats.max;
      thermalGrid.avgTemp = stats.avg;
    }
    
    app.globalData.Gsr = gsr;
    app.globalData.MLX90600 = mlxTemp;
    app.globalData.Heart_rate = heartRate;
    app.globalData.thermal_grid.data = thermalGridData;
    app.globalData.lastUpdatedTime = timeString;
    
    this.setData({ deviceInfo, deviceStatus: deviceInfo.status, gsr, mlxTemp, heartRate, thermalGrid, lastUpdatedTime: timeString });
    
    if (thermalGridData.length === 48) this.drawThermalImage();
  },

  convertToGridData: function(data) {
    const gridData = [];
    const stats = this.calcThermalStats(data);
    for (let r = 0; r < 6; r++) {
      const row = [];
      for (let c = 0; c < 8; c++) {
        const temp = data[r * 8 + c];
        row.push({ temp: temp.toFixed(1), color: this.tempToColor(temp, stats.min, stats.max) });
      }
      gridData.push(row);
    }
    return gridData;
  },

  calcThermalStats: function(data) {
    if (!data || data.length === 0) return { min: 20, max: 45, avg: 30 };
    let min = data[0], max = data[0], sum = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
      sum += data[i];
    }
    return { min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10, avg: Math.round(sum / data.length * 10) / 10 };
  },

  tempToColor: function(temp, tmin, tmax) {
    let ratio = (temp - tmin) / (tmax - tmin);
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    let r, g, b;
    const scheme = this.data.colorScheme;
    
    if (scheme === 'iron') {
      if (ratio < 0.2) { r = Math.round(ratio / 0.2 * 80); g = 0; b = Math.round(ratio / 0.2 * 120); }
      else if (ratio < 0.4) { r = Math.round(80 + (ratio - 0.2) / 0.2 * 100); g = 0; b = Math.round(120 + (ratio - 0.2) / 0.2 * 60); }
      else if (ratio < 0.6) { r = Math.round(180 + (ratio - 0.4) / 0.2 * 75); g = Math.round((ratio - 0.4) / 0.2 * 80); b = Math.round(180 - (ratio - 0.4) / 0.2 * 180); }
      else if (ratio < 0.8) { r = 255; g = Math.round(80 + (ratio - 0.6) / 0.2 * 100); b = 0; }
      else { r = 255; g = Math.round(180 + (ratio - 0.8) / 0.2 * 75); b = Math.round((ratio - 0.8) / 0.2 * 200); }
    } else if (scheme === 'rainbow') {
      if (ratio < 0.25) { r = 0; g = Math.round(ratio / 0.25 * 255); b = 255; }
      else if (ratio < 0.5) { r = 0; g = 255; b = Math.round(255 * (1 - (ratio - 0.25) / 0.25)); }
      else if (ratio < 0.75) { r = Math.round((ratio - 0.5) / 0.25 * 255); g = 255; b = 0; }
      else { r = 255; g = Math.round(255 * (1 - (ratio - 0.75) / 0.25)); b = 0; }
    } else if (scheme === 'medical') {
      if (ratio < 0.5) { r = Math.round(ratio * 2 * 255); g = Math.round(ratio * 2 * 255); b = 255; }
      else { r = 255; g = Math.round(255 * (1 - (ratio - 0.5) * 2)); b = Math.round(255 * (1 - (ratio - 0.5) * 2)); }
    } else {
      if (ratio < 0.33) { r = 0; g = Math.round(ratio / 0.33 * 255); b = Math.round(255 * (1 - ratio / 0.33)); }
      else if (ratio < 0.66) { r = Math.round((ratio - 0.33) / 0.33 * 255); g = 255; b = 0; }
      else { r = 255; g = Math.round(255 * (1 - (ratio - 0.66) / 0.34)); b = 0; }
    }
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  },

  drawThermalImage: function() {
    const data = this.data.thermalGrid.data;
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
    
    ctx.setFillStyle('#333');
    ctx.setFontSize(10);
    ctx.fillText(stats.max.toFixed(1) + 'C', barX + barW + 5, 12);
    ctx.fillText(stats.min.toFixed(1) + 'C', barX + barW + 5, ch);
    ctx.draw();
  },

  changeColorScheme: function(e) {
    const scheme = e.currentTarget.dataset.scheme;
    this.setData({ colorScheme: scheme });
    if (this.data.thermalGrid.data.length === 48) {
      const gridData = this.convertToGridData(this.data.thermalGrid.data);
      this.setData({ 'thermalGrid.gridData': gridData });
      this.drawThermalImage();
    }
  },

  showSettingsPanel: function() { this.setData({ showSettings: true }); },
  hideSettingsPanel: function() { this.setData({ showSettings: false }); },

  saveSettings: function(e) {
    const formData = e.detail.value;
    app.globalData.iamEndpoint = formData.iamEndpoint;
    app.globalData.userName = formData.userName;
    app.globalData.iamUserName = formData.iamUserName;
    app.globalData.iamUserPassword = formData.iamUserPassword;
    app.globalData.productName = formData.productName;
    app.globalData.iotDAEndpoint = formData.iotDAEndpoint;
    app.globalData.product_id = formData.product_id;
    app.globalData.device_id = formData.device_id;
    app.globalData.refreshInterval = parseInt(formData.refreshInterval) || 5000;
    
    this.setData({ refreshInterval: app.globalData.refreshInterval, showSettings: false });
    this.stopDataRefresh();
    if (this.isConfigComplete()) this.startDataRefresh();
  },

  onInputChange: function(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({ ['settingsForm.' + field]: value });
  }
});
