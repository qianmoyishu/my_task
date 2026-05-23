// -*- coding: utf-8 -*-
const api = require('../../utils/api');
const obsApi = require('../../utils/obs-api');
const wxCharts = require('../../utils/wxcharts');
const app = getApp();

// 设备密钥配置 - 包含完整的连接信息
const DEVICE_KEYS = {
  '147': {
    name: '医疗设备1',
    device_id: '691dd51abf22cc5a8c0816a4_medical1',
    service_id: 'medical_1',
    iamEndpoint: 'iam.cn-north-4.myhuaweicloud.com',
    userName: 'hid_3_6y3mvtwehq066',
    iamUserName: 'Vibration_IAM',
    iamUserPassword: '1513120966Ab',
    projectName: 'cn-north-4',
    iotDAEndpoint: '03843d450f.st1.iotda-app.cn-north-4.myhuaweicloud.com',
    project_id: 'b559443bc05f47328a4a30ecb9b2e974',
    product_id: '691dd51abf22cc5a8c0816a4'
  },
  '159': {
    name: '医疗设备2',
    device_id: '691dd51abf22cc5a8c0816a4_medical2',
    service_id: 'medical_1',
    iamEndpoint: 'iam.cn-north-4.myhuaweicloud.com',
    userName: 'hid_3_6y3mvtwehq066',
    iamUserName: 'Vibration_IAM',
    iamUserPassword: '1513120966Ab',
    projectName: 'cn-north-4',
    iotDAEndpoint: '03843d450f.st1.iotda-app.cn-north-4.myhuaweicloud.com',
    project_id: 'b559443bc05f47328a4a30ecb9b2e974',
    product_id: '691dd51abf22cc5a8c0816a4'
  },
  '987': {
    name: '医疗设备3',
    device_id: '691dd51abf22cc5a8c0816a4_medical3',
    service_id: 'medical_1',
    iamEndpoint: 'iam.cn-north-4.myhuaweicloud.com',
    userName: 'hid_3_6y3mvtwehq066',
    iamUserName: 'Vibration_IAM',
    iamUserPassword: '1513120966Ab',
    projectName: 'cn-north-4',
    iotDAEndpoint: '03843d450f.st1.iotda-app.cn-north-4.myhuaweicloud.com',
    project_id: 'b559443bc05f47328a4a30ecb9b2e974',
    product_id: '691dd51abf22cc5a8c0816a4'
  }
};

Page({
  data: {
    isLoading: false,
    isConfigured: false,
    error: null,
    // 设备密钥输入
    deviceKeyInput: '',
    deviceName: '',
    deviceStatus: '离线',
    lastUpdatedTime: '--',
    currentType: 'Gsr',
    Gsr: { current: 0, unit: '', min: 0, max: 2000, history: [] },
    MLX90600: { current: 0.0, unit: 'C', min: 0.0, max: 50.0, history: [] },
    Heart_rate: { current: 0, unit: 'bpm', min: 0, max: 200, history: [] },
    // OBS历史数据
    obsHistory: [],
    obsLoading: false,
    // 可用日期列表
    availableDates: [],
    datesLoading: false,
    selectedDateKeys: [],  // 多选的日期key列表
    // 6x8红外热成像数据
    thermalGrid: {
      data: [],
      gridData: [],
      minTemp: 0,
      maxTemp: 0,
      avgTemp: 0
    },
    thermalHistory: [],  // 热成像历史数据
    thermalHistoryIndex: 0,  // 当前显示的热成像历史索引
    colorScheme: 'iron',
    showThermal: false,
    showHistory: false,
    currentData: { current: '', unit: '', history: [] },
    historyPage: 1,
    historyPageSize: 10,
    pagedHistory: [],
    chartWidth: 300,
    chartScrollLeft: 0,  // 图表滚动位置
    chartScrollTo: 0,    // 滚动到指定位置
    // 图表分页
    chartPage: 1,
    chartPageSize: 50,
    chartTotalPages: 1,
    // 滑块控制
    sliderIndex: 0,
    sliderPercent: 0,  // 滑块百分比位置
    centerPointData: { time: '', value: '' },
    chartDataPoints: []  // 存储数据点位置
  },

  getWindowWidth() {
    if (wx.getWindowInfo) {
      const info = wx.getWindowInfo();
      if (info && info.windowWidth) {
        return info.windowWidth;
      }
    }
    const info = wx.getSystemInfoSync();
    return info.windowWidth || 375;
  },

  // 密钥输入
  onDeviceKeyInput(e) {
    this.setData({ deviceKeyInput: e.detail.value });
  },

  onDeviceKeyInputFromComponent(e) {
    this.setData({
      deviceKeyInput: e.detail.value
    });
  },

  // 提交密钥
  onSubmitDeviceKey() {
    const key = this.data.deviceKeyInput.trim();
    if (!key) {
      wx.showToast({ title: '请输入密钥', icon: 'none' });
      return;
    }
    
    const deviceConfig = DEVICE_KEYS[key];
    if (deviceConfig) {
      this.switchToDevice(deviceConfig);
      this.setData({ deviceKeyInput: '' });
    } else {
      wx.showToast({ title: '设备不存在', icon: 'none' });
    }
  },

  // 切换到指定设备
  switchToDevice(device) {
    // 更新全局配置 - 完整的连接信息
    app.globalData.device_id = device.device_id;
    app.globalData.service_id = device.service_id;
    app.globalData.deviceName = device.name;
    app.globalData.iamEndpoint = device.iamEndpoint;
    app.globalData.userName = device.userName;
    app.globalData.iamUserName = device.iamUserName;
    app.globalData.iamUserPassword = device.iamUserPassword;
    app.globalData.projectName = device.projectName;
    app.globalData.iotDAEndpoint = device.iotDAEndpoint;
    app.globalData.project_id = device.project_id;
    app.globalData.product_id = device.product_id;
    
    // 清空历史数据
    app.globalData.Gsr = { current: 0, unit: '', min: 0, max: 2000, history: [] };
    app.globalData.MLX90600 = { current: 0, unit: 'C', min: 0, max: 50, history: [] };
    app.globalData.Heart_rate = { current: 0, unit: 'bpm', min: 0, max: 200, history: [] };
    app.globalData.thermal_grid = { data: [], gridData: [], rows: 6, cols: 8, unit: 'C', min: 20, max: 45, avgTemp: 0, maxTemp: 0, minTemp: 0 };
    
    // 清除日期的 empty 标记
    const dates = this.data.availableDates.map(d => ({ 
      ...d, 
      selected: false,
      empty: false 
    }));
    
    this.setData({
      deviceName: device.name,
      Gsr: app.globalData.Gsr,
      MLX90600: app.globalData.MLX90600,
      Heart_rate: app.globalData.Heart_rate,
      thermalGrid: { data: [], gridData: [], minTemp: 0, maxTemp: 0, avgTemp: 0 },
      thermalHistory: [],
      thermalHistoryIndex: 0,
      lastUpdatedTime: '--',
      availableDates: dates,
      selectedDateKeys: [],
      obsHistory: [],
      error: null
    }, () => {
      this.updateCurrentData();
      this.drawMedicalCharts();
      if (this.data.showThermal) {
        this.drawThermalImage();
      }
    });
    
    // 保存配置
    app.saveConfig();
    
    // 重新获取数据
    this.stopDataRefresh();
    this.checkConfiguration();
    
    // 加载可用日期列表
    this.loadAvailableDates();
    
    wx.showToast({ title: device.name, icon: 'success' });
  },

  onLoad() {
    this.setData({
      deviceName: app.globalData.deviceName || '',
      deviceStatus: '离线'
    });
    this.syncWithGlobalData();
    this.checkConfiguration();
    // 只有配置完成后才加载日期列表
    if (this.isConfigComplete()) {
      this.loadAvailableDates();
    }
  },
  
  onShow() {
    this.syncWithGlobalData();
    this.checkConfiguration();
    if (this.isConfigComplete() && !this.refreshTimer) {
      this.startDataRefresh();
    }
  },
  
  onHide() { 
    this.stopDataRefresh(); 
  },
  
  onUnload() { 
    this.stopDataRefresh(); 
  },

  syncWithGlobalData() {
    this.setData({
      Gsr: app.globalData.Gsr,
      MLX90600: app.globalData.MLX90600,
      Heart_rate: app.globalData.Heart_rate,
      deviceStatus: app.globalData.deviceStatus,
      deviceName: app.globalData.deviceName
    }, () => {
      this.updateCurrentData();
      this.drawMedicalCharts();
    });
  },

  checkConfiguration() {
    const isConfigured = this.isConfigComplete();
    this.setData({
      isConfigured,
      Gsr: app.globalData.Gsr,
      MLX90600: app.globalData.MLX90600,
      Heart_rate: app.globalData.Heart_rate,
      deviceStatus: app.globalData.deviceStatus,
      deviceName: app.globalData.deviceName || '',
      lastUpdatedTime: app.globalData.lastUpdatedTime || '--'
    }, () => {
      this.updateCurrentData();
    });
    if (isConfigured && !this.refreshTimer) {
      this.startDataRefresh();
    } else if (!isConfigured) {
      this.setData({ error: '请输入设备密钥完成配置' });
    }
  },

  isConfigComplete() {
    const { iamEndpoint, userName, iamUserName, iamUserPassword, projectName, iotDAEndpoint, product_id, device_id } = app.globalData;
    return iamEndpoint && userName && iamUserName && iamUserPassword && projectName && iotDAEndpoint && product_id && device_id;
  },

  startDataRefresh() {
    this.fetchDeviceData();
    const interval = Math.max(10000, app.globalData.refreshInterval || 5000);
    this.refreshTimer = setInterval(() => { this.fetchDeviceData(); }, interval);
  },
  
  stopDataRefresh() {
    if (this.refreshTimer) { 
      clearInterval(this.refreshTimer); 
      this.refreshTimer = null; 
    }
  },
  
  onRefresh() {
    if (!this.isConfigComplete()) {
      wx.showToast({ title: '请先完成配置', icon: 'none' });
      return;
    }
    this.fetchDeviceData();
  },

  fetchDeviceData() {
    this.setData({ isLoading: true });
    const api = require('../../utils/api.js');
    let iamToken = null;
    api.getIamToken()
      .then(token => {
        iamToken = token;
        // 先获取设备状态（包含在线/离线信息）
        return api.getDeviceStatus(token);
      })
      .then(deviceInfo => {
        // 从设备信息中获取真实的在线状态
        // 华为云IoTDA返回的status字段: ONLINE/OFFLINE/ABNORMAL
        const realStatus = deviceInfo.status === 'ONLINE' ? '在线' : '离线';
        app.globalData.deviceStatus = realStatus;
        // 不覆盖我们设置的设备名称，只有在没有名称时才使用华为云返回的
        if (!app.globalData.deviceName) {
          app.globalData.deviceName = deviceInfo.device_name || '医疗设备';
        }
        // 继续获取设备影子数据
        return api.getDeviceShadow(iamToken);
      })
      .then(shadowData => {
        if (shadowData && shadowData.shadow && Array.isArray(shadowData.shadow) && shadowData.shadow.length > 0) {
          const shadowObj = shadowData.shadow.find(s => s.service_id === app.globalData.service_id);
          if (shadowObj) {
            const reportedProps = shadowObj.reported && shadowObj.reported.properties || {};
            const gsr = Number(reportedProps.Gsr || 0);
            const mlx90600 = Number(reportedProps.MLX90600 || 0);
            const heartRate = Number(reportedProps.Heart_rate || 0);
            const now = api.formatTime(new Date());
            // 解析thermal_grid (6x8=48个温度值)
            let thermalGridData = [];
            if (reportedProps.thermal_grid && Array.isArray(reportedProps.thermal_grid)) {
              thermalGridData = reportedProps.thermal_grid.map(v => Number(v) || 0);
            }
            
            [
              ['Gsr', gsr], ['MLX90600', mlx90600], ['Heart_rate', heartRate]
            ].forEach(([key, value]) => {
              app.globalData[key].current = value;
              app.globalData[key].history.unshift({ time: now, value, id: `${key}_${Date.now()}` });
              if (app.globalData[key].history.length > 100) app.globalData[key].history.pop();
            });
            app.globalData.thermal_grid.data = thermalGridData;
            app.globalData.lastUpdatedTime = now;
          }
        }
        // 处理热成像数据
        const thermalData = app.globalData.thermal_grid.data;
        let thermalGrid = this.data.thermalGrid;
        if (thermalData && thermalData.length === 48) {
          thermalGrid.data = thermalData;
          thermalGrid.gridData = this.convertToGridData(thermalData);
          const stats = this.calcThermalStats(thermalData);
          thermalGrid.minTemp = stats.min;
          thermalGrid.maxTemp = stats.max;
          thermalGrid.avgTemp = stats.avg;
        }
        
        this.setData({
          Gsr: app.globalData.Gsr,
          MLX90600: app.globalData.MLX90600,
          Heart_rate: app.globalData.Heart_rate,
          thermalGrid: thermalGrid,
          lastUpdatedTime: api.formatTime(new Date()),
          deviceStatus: app.globalData.deviceStatus,
          deviceName: app.globalData.deviceName
        }, () => {
          this.updateCurrentData();
          this.updatePagedHistory();
          // 只有在没有选择OBS历史数据时才重绘图表
          if (this.data.selectedDateKeys.length === 0) {
            this.drawMedicalCharts();
          }
          if (thermalData && thermalData.length === 48) {
            this.drawThermalImage();
          }
        });
      })
      .catch(err => {
        console.error('获取设备数据失败:', err);
        app.globalData.deviceStatus = '离线';
        let errorMsg = '连接设备失败';
        if (typeof err === 'string') {
          if (err.includes('IAM配置参数不完整')) {
            errorMsg = '请先在设置页面完成IAM配置';
          } else if (err.includes('IoTDA配置参数不完整')) {
            errorMsg = '请先在设置页面完成IoTDA配置';
          } else if (err.includes('获取Token失败')) {
            errorMsg = 'IAM认证失败，请检查用户名密码';
          } else if (err.includes('获取设备影子失败')) {
            errorMsg = '设备离线或配置错误';
          } else {
            errorMsg = err;
          }
        }
        this.setData({
          deviceStatus: '离线',
          deviceName: app.globalData.deviceName,
          isLoading: false,
          error: errorMsg
        });
        wx.showToast({ title: errorMsg, icon: 'none', duration: 3000 });
      })
      .finally(() => { this.setData({ isLoading: false }); });
  },

  updateCurrentData() {
    const key = this.data.currentType;
    this.setData({ currentData: this.data[key] || { current: '', unit: '', history: [] } }, () => {
      this.updatePagedHistory();
    });
  },

  updatePagedHistory() {
    const history = this.data.currentData.history || [];
    const pageSize = this.data.historyPageSize;
    const page = this.data.historyPage;
    const start = (page - 1) * pageSize;
    this.setData({ pagedHistory: history.slice(start, start + pageSize) });
  },

  prevHistoryPage() {
    if (this.data.historyPage > 1) {
      this.setData({ historyPage: this.data.historyPage - 1 }, () => {
        this.updatePagedHistory();
      });
    }
  },
  
  nextHistoryPage() {
    const total = this.data.currentData.history.length;
    const maxPage = Math.ceil(total / this.data.historyPageSize);
    if (this.data.historyPage < maxPage) {
      this.setData({ historyPage: this.data.historyPage + 1 }, () => {
        this.updatePagedHistory();
      });
    }
  },

  changeType(e) {
    this.setData({ currentType: e.currentTarget.dataset.type, historyPage: 1, chartPage: 1 }, () => {
      this.updateCurrentData();
      this.drawMedicalCharts();
    });
  },

  onChangeTypeFromComponent(e) {
    const type = e.detail.type;
    this.setData({ currentType: type, historyPage: 1, chartPage: 1 }, () => {
      this.updateCurrentData();
      this.drawMedicalCharts();
    });
  },
  
  toggleHistory() {
    this.setData({ showHistory: !this.data.showHistory });
  },

  getCurrentData() {
    const key = this.data.currentType;
    return this.data[key] || { current: '', unit: '', history: [] };
  },

  drawMedicalCharts() {
    try {
      const canvas = wx.createCanvasContext('currentChart');
      canvas.clearRect(0, 0, 1000, 1000);
      canvas.draw();
      
      setTimeout(() => {
        this.drawChart();
      }, 100);
    } catch (error) {
      console.error('绘制图表失败:', error);
    }
  },

  drawChart() {
    try {
      const windowWidth = this.getWindowWidth();
      const key = this.data.currentType;
      const fullHistory = (this.data[key] && this.data[key].history) ? this.data[key].history : [];
      
      // 计算总页数
      const totalPages = Math.ceil(fullHistory.length / this.data.chartPageSize) || 1;
      
      // 确保当前页不超出范围
      let page = this.data.chartPage;
      if (page > totalPages) {
        page = totalPages;
      }
      if (page < 1) {
        page = 1;
      }
      
      // 从后往前取数据：第1页是最旧的，最后一页是最新的
      // fullHistory 是按时间倒序的（最新在前）
      const endIndex = fullHistory.length - (page - 1) * this.data.chartPageSize;
      const startIndex = Math.max(0, endIndex - this.data.chartPageSize);
      const history = fullHistory.slice(startIndex, endIndex);
      
      // 更新页码
      if (this.data.chartTotalPages !== totalPages || this.data.chartPage !== page) {
        this.setData({ chartTotalPages: totalPages, chartPage: page });
      }
      
      // 如果没有数据，清空图表
      if (history.length === 0) {
        const canvas = wx.createCanvasContext('currentChart');
        canvas.clearRect(0, 0, 1000, 1000);
        canvas.draw();
        this.setData({ 
          chartDataPoints: [],
          centerPointData: { time: '', value: '' },
          sliderIndex: 0,
          sliderPercent: 0
        });
        return;
      }
      
      let timeLabels = history.map(item => {
        if (item.time && item.time.includes(' ')) {
          const timePart = item.time.split(' ')[1];
          return timePart ? timePart.substring(0, 5) : '--:--';
        }
        return '--:--';
      }).reverse();
      let dataArr = history.map(item => item.value || 0).reverse();
      
      // 根据数据点数量计算图表宽度，每个数据点间40px间距
      const minWidth = windowWidth * 0.8;
      const calculatedWidth = Math.max(minWidth, dataArr.length * 40);
      this.setData({ chartWidth: calculatedWidth });
      
      let min = Math.min(...dataArr);
      let max = Math.max(...dataArr);
        
      if (key === 'Gsr') {
        const range = Math.max(200, max - min);
        min = Math.max(0, min - range * 0.1);
        max = max + range * 0.1;
      } else if (key === 'MLX90600') {
        min = Math.max(0, min - 3);
        max = max + 3;
      } else if (key === 'Heart_rate') {
        min = Math.max(0, min - 10);
        max = max + 10;
      }
      
      if (max - min < 1) {
        max = min + 10;
      }
      
      const formatFunc = function (val) {
        const rounded = Math.round(val);
        if (key === 'MLX90600') {
          return rounded + 'C';
        } else {
          return String(rounded);
        }
      };
      
      // 绘制固定的Y轴
      wxCharts.drawYAxisOnly({
        yAxisCanvasId: 'yAxisChart',
        width: 40,
        height: 280,
        yAxisMin: min,
        yAxisMax: max,
        yAxis: { format: formatFunc }
      });
      
      // 绘制主图表（不含Y轴）
      const chartConfig = {
        canvasId: 'currentChart',
        width: calculatedWidth,
        height: 280,
        categories: timeLabels,
        series: [{ 
          name: key, 
          data: dataArr, 
          color: key === 'Gsr' ? '#1989fa' : (key === 'MLX90600' ? '#f39c12' : '#07c160') 
        }],
        yAxisMin: min,
        yAxisMax: max,
        yAxis: { format: formatFunc }
      };
      wxCharts.createLineChart(chartConfig).draw();
      
      // 保存数据点位置用于 tooltip
      const leftPadding = 10;
      const rightPadding = 30;
      const topPadding = 30;
      const bottomPadding = 40;
      const chartHeight = 280 - topPadding - bottomPadding;
      const chartW = calculatedWidth - leftPadding - rightPadding;
      const xStep = chartW / (dataArr.length - 1 || 1);
      
      const historyReversed = history.slice().reverse();
      const dataPoints = dataArr.map((val, i) => {
        const x = leftPadding + i * xStep;
        const y = topPadding + chartHeight - ((val - min) / (max - min)) * chartHeight;
        return {
          x, y,
          value: val,
          time: historyReversed[i] ? historyReversed[i].time : timeLabels[i]
        };
      });
      
      // 保持滑块位置，只在首次或数据点为空时初始化
      const oldIndex = this.data.sliderIndex;
      const oldPoints = this.data.chartDataPoints;
      const isFirstInit = !oldPoints || oldPoints.length === 0;
      
      this.setData({ chartDataPoints: dataPoints }, () => {
        if (dataPoints.length > 0) {
          let newIndex = oldIndex;
          // 首次初始化时设为0，否则保持当前位置（但不超出范围）
          if (isFirstInit) {
            newIndex = 0;
          } else if (newIndex >= dataPoints.length) {
            newIndex = dataPoints.length - 1;
          }
          
          const point = dataPoints[newIndex];
          const percent = dataPoints.length > 1 ? (newIndex / (dataPoints.length - 1)) * 100 : 50;
          
          this.setData({ 
            sliderIndex: newIndex,
            sliderPercent: percent,
            centerPointData: {
              time: point.time,
              value: point.value
            }
          });
        }
      });
    } catch (error) {
      console.error('绑制图表失败:', error);
    }
  },
  
  // 图表滚动事件 - 滚动时更新滑块位置和数据
  onChartScroll(e) {
    const scrollLeft = e.detail.scrollLeft || 0;
    this.chartScrollLeft = scrollLeft;
    
    const points = this.data.chartDataPoints;
    if (!points || points.length === 0) return;
    
    // 计算当前视图中心对应的数据点
    const yAxisWidth = 80; // rpx转px约40px
    const viewWidth = this.getWindowWidth() - 40 - 30; // Y轴和右边距
    const centerX = scrollLeft + viewWidth / 2;
    
    // 找到最接近中心的数据点
    let closestIndex = 0;
    let minDist = Math.abs(points[0].x - centerX);
    for (let i = 1; i < points.length; i++) {
      const dist = Math.abs(points[i].x - centerX);
      if (dist < minDist) {
        minDist = dist;
        closestIndex = i;
      }
    }
    
    // 更新滑块和数据显示
    const point = points[closestIndex];
    const percent = points.length > 1 ? (closestIndex / (points.length - 1)) * 100 : 50;
    
    this.setData({
      sliderIndex: closestIndex,
      sliderPercent: percent,
      centerPointData: {
        time: point.time,
        value: point.value
      }
    });
  },
  
  // 滑块变化（拖动结束）
  onSliderChange(e) {
    const index = e.detail.value;
    this.updateSliderData(index);
  },
  
  // 滑块拖动中
  onSliderChanging(e) {
    const index = e.detail.value;
    this.updateSliderData(index);
  },
  
  // 更新滑块对应的数据（滑块和虚线配套移动，图表手动滚动）
  updateSliderData(index) {
    const points = this.data.chartDataPoints;
    if (!points || points.length === 0) return;
    
    const point = points[index];
    if (point) {
      // 计算滑块百分比位置（0-100）
      const percent = points.length > 1 ? (index / (points.length - 1)) * 100 : 50;
      
      this.setData({
        sliderIndex: index,
        sliderPercent: percent,
        centerPointData: {
          time: point.time,
          value: point.value
        }
      });
    }
  },

  // 图表上一页（更旧的数据）
  onChartScrollToLeft() {
    if (this.data.chartPage > 1) {
      this.setData({ chartPage: this.data.chartPage - 1 }, () => {
        this.drawChart();
      });
    }
  },

  // 图表下一页（更新的数据）
  onChartScrollToRight() {
    if (this.data.chartPage < this.data.chartTotalPages) {
      this.setData({ chartPage: this.data.chartPage + 1 }, () => {
        this.drawChart();
      });
    }
  },

  goToSettings() { 
    wx.switchTab({ url: '/pages/setting/setting' }); 
  },

  // 切换热成像显示
  toggleThermal() {
    this.setData({ showThermal: !this.data.showThermal });
    if (this.data.showThermal && this.data.thermalGrid.data.length === 48) {
      setTimeout(() => this.drawThermalImage(), 100);
    }
  },

  // 切换色彩方案
  changeColorScheme(e) {
    const scheme = e.currentTarget.dataset.scheme;
    this.setData({ colorScheme: scheme });
    if (this.data.thermalGrid.data.length === 48) {
      const gridData = this.convertToGridData(this.data.thermalGrid.data);
      this.setData({ 'thermalGrid.gridData': gridData });
      this.drawThermalImage();
    }
  },

  // 热成像历史 - 上一帧
  prevThermalHistory() {
    const history = this.data.thermalHistory;
    if (!history || history.length === 0) return;
    
    let index = this.data.thermalHistoryIndex;
    if (index < history.length - 1) {
      index++;
      this.showThermalAtIndex(index);
    }
  },

  // 热成像历史 - 下一帧
  nextThermalHistory() {
    const history = this.data.thermalHistory;
    if (!history || history.length === 0) return;
    
    let index = this.data.thermalHistoryIndex;
    if (index > 0) {
      index--;
      this.showThermalAtIndex(index);
    }
  },

  // 显示指定索引的热成像数据
  showThermalAtIndex(index) {
    const history = this.data.thermalHistory;
    if (!history || index < 0 || index >= history.length) return;
    
    const item = history[index];
    const thermalData = item.data;
    
    let thermalGrid = this.data.thermalGrid;
    thermalGrid.data = thermalData;
    thermalGrid.gridData = this.convertToGridData(thermalData);
    const stats = this.calcThermalStats(thermalData);
    thermalGrid.minTemp = stats.min;
    thermalGrid.maxTemp = stats.max;
    thermalGrid.avgTemp = stats.avg;
    
    this.setData({ 
      thermalGrid: thermalGrid,
      thermalHistoryIndex: index
    }, () => {
      this.drawThermalImage();
    });
  },

  // 将一维数组转换为带颜色的二维网格
  convertToGridData(data) {
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

  // 计算热成像统计值
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

  // 温度转颜色 - 与STM32 thermal_enhancement_inline.h 一致
  tempToColor(temp, tmin, tmax) {
    let ratio = (temp - tmin) / (tmax - tmin);
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    let r, g, b;
    const scheme = this.data.colorScheme;
    
    if (scheme === 'iron') {
      // Iron色谱: 黑色->深红->亮红->橙色->黄色->白色 (与STM32一致)
      if (ratio < 0.2) {
        // 黑色到深红
        r = Math.round(ratio * 5 * 128);
        g = 0;
        b = 0;
      } else if (ratio < 0.4) {
        // 深红到亮红
        r = Math.round(128 + (ratio - 0.2) * 5 * 127);
        g = 0;
        b = 0;
      } else if (ratio < 0.6) {
        // 亮红到橙色
        r = 255;
        g = Math.round((ratio - 0.4) * 5 * 128);
        b = 0;
      } else if (ratio < 0.8) {
        // 橙色到黄色
        r = 255;
        g = Math.round(128 + (ratio - 0.6) * 5 * 127);
        b = 0;
      } else {
        // 黄色到白色
        r = 255;
        g = 255;
        b = Math.round((ratio - 0.8) * 5 * 255);
      }
    } else if (scheme === 'classic') {
      // Classic色谱: 蓝->青->绿->黄->红 (与STM32一致)
      if (ratio < 0.25) {
        r = 0;
        g = Math.round(ratio * 4 * 255);
        b = 255;
      } else if (ratio < 0.5) {
        r = 0;
        g = 255;
        b = Math.round((0.5 - ratio) * 4 * 255);
      } else if (ratio < 0.75) {
        r = Math.round((ratio - 0.5) * 4 * 255);
        g = 255;
        b = 0;
      } else {
        r = 255;
        g = Math.round((1.0 - ratio) * 4 * 255);
        b = 0;
      }
    } else if (scheme === 'medical') {
      // 医疗色谱: 蓝->白->红 (与STM32一致)
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
      // 火焰色谱: 深红->红->橙->黄->亮白 (与STM32一致)
      if (ratio < 0.15) {
        r = Math.round(100 + ratio * 6.67 * 155);
        g = 0;
        b = 0;
      } else if (ratio < 0.4) {
        r = 255;
        g = Math.round((ratio - 0.15) * 4.0 * 180);
        b = 0;
      } else if (ratio < 0.7) {
        r = 255;
        g = Math.round(180 + (ratio - 0.4) * 3.33 * 75);
        b = 0;
      } else {
        r = 255;
        g = 255;
        b = Math.round((ratio - 0.7) * 3.33 * 255);
      }
    } else if (scheme === 'rainbow') {
      // 彩虹色谱 (与Classic类似但更鲜艳)
      if (ratio < 0.25) {
        r = 0;
        g = Math.round(ratio * 4 * 255);
        b = 255;
      } else if (ratio < 0.5) {
        r = 0;
        g = 255;
        b = Math.round((0.5 - ratio) * 4 * 255);
      } else if (ratio < 0.75) {
        r = Math.round((ratio - 0.5) * 4 * 255);
        g = 255;
        b = 0;
      } else {
        r = 255;
        g = Math.round((1.0 - ratio) * 4 * 255);
        b = 0;
      }
    } else {
      // 默认使用Iron
      if (ratio < 0.2) { r = Math.round(ratio * 5 * 128); g = 0; b = 0; }
      else if (ratio < 0.4) { r = Math.round(128 + (ratio - 0.2) * 5 * 127); g = 0; b = 0; }
      else if (ratio < 0.6) { r = 255; g = Math.round((ratio - 0.4) * 5 * 128); b = 0; }
      else if (ratio < 0.8) { r = 255; g = Math.round(128 + (ratio - 0.6) * 5 * 127); b = 0; }
      else { r = 255; g = 255; b = Math.round((ratio - 0.8) * 5 * 255); }
    }
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  },

  // 绘制热成像图
  drawThermalImage() {
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
    
    // 绘制色带
    const barX = cw + 10, barW = 20;
    for (let y = 0; y < ch; y++) {
      const ratio = 1 - y / ch;
      const temp = stats.min + ratio * (stats.max - stats.min);
      ctx.setFillStyle(this.tempToColor(temp, stats.min, stats.max));
      ctx.fillRect(barX, y, barW, 1);
    }
    
    ctx.setFillStyle('#333');
    ctx.setFontSize(10);
    ctx.fillText(stats.max.toFixed(1) + '°C', barX + barW + 5, 12);
    ctx.fillText(stats.min.toFixed(1) + '°C', barX + barW + 5, ch);
    ctx.draw();
  },

  // 加载OBS历史数据
  loadObsHistory() {
    this.setData({ obsLoading: true });
    const deviceId = app.globalData.device_id;
    
    obsApi.getTodayHistory(deviceId)
      .then(data => {
        console.log('OBS历史数据:', data);
        // 将OBS数据转换为历史记录格式
        this.processObsData(data);
        this.setData({ obsLoading: false });
      })
      .catch(err => {
        console.error('加载OBS历史数据失败:', err);
        this.setData({ obsLoading: false });
        // 失败时不影响实时数据显示
      });
  },

  // 处理OBS数据，更新历史记录
  processObsData(obsData) {
    if (!obsData || obsData.length === 0) return;
    
    // 按时间排序（最新的在前）
    obsData.sort((a, b) => new Date(b.event_time) - new Date(a.event_time));
    
    // 转换为各指标的历史记录
    const gsrHistory = [];
    const mlxHistory = [];
    const heartRateHistory = [];
    const thermalHistory = [];  // 热成像历史
    
    obsData.forEach(item => {
      const time = this.formatObsTime(item.event_time);
      const props = item.properties || {};
      
      if (props.Gsr !== undefined) {
        gsrHistory.push({ time, value: props.Gsr, id: `gsr_${Date.now()}_${Math.random()}` });
      }
      if (props.MLX90600 !== undefined) {
        mlxHistory.push({ time, value: props.MLX90600, id: `mlx_${Date.now()}_${Math.random()}` });
      }
      if (props.Heart_rate !== undefined) {
        heartRateHistory.push({ time, value: props.Heart_rate, id: `hr_${Date.now()}_${Math.random()}` });
      }
      // 热成像数据
      if (props.thermal_grid && Array.isArray(props.thermal_grid) && props.thermal_grid.length === 48) {
        thermalHistory.push({ 
          time, 
          data: props.thermal_grid.map(v => Number(v) || 0),
          id: `thermal_${Date.now()}_${Math.random()}` 
        });
      }
    });
    
    // 更新数据
    const gsr = this.data.Gsr;
    const mlx = this.data.MLX90600;
    const hr = this.data.Heart_rate;
    
    gsr.history = gsrHistory;
    mlx.history = mlxHistory;
    hr.history = heartRateHistory;
    
    // 设置当前值为最新的历史值
    if (gsrHistory.length > 0) gsr.current = gsrHistory[0].value;
    if (mlxHistory.length > 0) mlx.current = mlxHistory[0].value;
    if (heartRateHistory.length > 0) hr.current = heartRateHistory[0].value;
    
    // 处理热成像历史数据
    let thermalGrid = this.data.thermalGrid;
    if (thermalHistory.length > 0) {
      const latestThermal = thermalHistory[0].data;
      thermalGrid.data = latestThermal;
      thermalGrid.gridData = this.convertToGridData(latestThermal);
      const stats = this.calcThermalStats(latestThermal);
      thermalGrid.minTemp = stats.min;
      thermalGrid.maxTemp = stats.max;
      thermalGrid.avgTemp = stats.avg;
    }
    
    this.setData({ 
      Gsr: gsr, 
      MLX90600: mlx, 
      Heart_rate: hr, 
      thermalGrid: thermalGrid,
      thermalHistory: thermalHistory,  // 保存热成像历史
      obsHistory: obsData 
    }, () => {
      this.updateCurrentData();
      this.drawMedicalCharts();
      // 如果热成像面板打开，重绘
      if (this.data.showThermal && thermalHistory.length > 0) {
        this.drawThermalImage();
      }
    });
    
    // 同步到全局
    app.globalData.Gsr = gsr;
    app.globalData.MLX90600 = mlx;
    app.globalData.Heart_rate = hr;
  },

  // 格式化OBS时间
  formatObsTime(isoTime) {
    const date = new Date(isoTime);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
  },

  // 刷新OBS历史数据
  refreshObsHistory() {
    this.loadObsHistory();
    wx.showToast({ title: '正在刷新历史数据', icon: 'loading' });
  },

  // 加载可用日期列表
  loadAvailableDates() {
    // 如果没有配置设备，不加载OBS数据
    if (!this.isConfigComplete()) {
      this.setData({ datesLoading: false, availableDates: [] });
      return;
    }
    
    this.setData({ datesLoading: true });
    
    console.log('开始加载可用日期列表...');
    console.log('服务器地址:', app.globalData.serverUrl);
    
    obsApi.listHistoryFiles()
      .then(files => {
        console.log('获取到文件列表:', files.length, '个文件');
        // 解析文件列表，提取日期时间
        // key格式: device_property_2025/12/19_14/date
        // 过滤掉太小的文件（小于500字节可能是空的或只有很少数据）
        const dates = files
          .filter(f => parseInt(f.size) > 500)
          .map(f => {
            const match = f.key.match(/device_property_(\d+)\/(\d+)\/(\d+)_(\d+)\/date/);
            if (match) {
              return {
                key: f.key,
                year: match[1],
                month: match[2],
                day: match[3],
                hour: match[4],
                size: f.size,
                display: `${match[2]}/${match[3]} ${match[4]}:00`,
                selected: false
              };
            }
            return null;
          }).filter(d => d !== null);
        
        // 按时间倒序
        dates.sort((a, b) => {
          const ta = `${a.year}${a.month}${a.day}${a.hour}`;
          const tb = `${b.year}${b.month}${b.day}${b.hour}`;
          return tb.localeCompare(ta);
        });
        
        this.setData({ availableDates: dates, datesLoading: false, selectedDateKeys: [] });
      })
      .catch(err => {
        console.error('加载日期列表失败:', err);
        this.setData({ datesLoading: false });
      });
  },

  // 切换日期选择（多选）
  onToggleDateFile(e) {
    const key = e.currentTarget.dataset.key;
    let selectedKeys = [...this.data.selectedDateKeys];
    
    // 切换选中状态
    const index = selectedKeys.indexOf(key);
    if (index > -1) {
      selectedKeys.splice(index, 1);
    } else {
      selectedKeys.push(key);
    }
    
    // 按时间排序
    selectedKeys.sort((a, b) => {
      const matchA = a.match(/device_property_(\d+)\/(\d+)\/(\d+)_(\d+)/);
      const matchB = b.match(/device_property_(\d+)\/(\d+)\/(\d+)_(\d+)/);
      if (matchA && matchB) {
        const timeA = `${matchA[1]}${matchA[2]}${matchA[3]}${matchA[4]}`;
        const timeB = `${matchB[1]}${matchB[2]}${matchB[3]}${matchB[4]}`;
        return timeA.localeCompare(timeB);
      }
      return 0;
    });
    
    // 更新选中状态
    const dates = this.data.availableDates.map(d => ({
      ...d,
      selected: selectedKeys.includes(d.key)
    }));
    
    this.setData({ availableDates: dates, selectedDateKeys: selectedKeys });
    
    // 加载选中的所有数据
    this.loadSelectedDatesData(selectedKeys);
  },

  // 清空选择
  clearSelectedDates() {
    const dates = this.data.availableDates.map(d => ({ ...d, selected: false }));
    this.setData({ 
      availableDates: dates, 
      selectedDateKeys: [],
      obsHistory: []
    });
    // 清空历史数据
    this.setData({
      Gsr: { ...this.data.Gsr, history: [] },
      MLX90600: { ...this.data.MLX90600, history: [] },
      Heart_rate: { ...this.data.Heart_rate, history: [] }
    }, () => {
      this.updateCurrentData();
      this.drawMedicalCharts();
    });
  },

  // 加载多个选中日期的数据
  async loadSelectedDatesData(keys) {
    if (keys.length === 0) {
      this.clearSelectedDates();
      return;
    }
    
    const deviceId = app.globalData.device_id;
    this.setData({ obsLoading: true });
    wx.showLoading({ title: '加载中...' });
    
    const allData = [];
    const emptyKeys = [];  // 记录对当前设备无数据的key
    
    for (const key of keys) {
      const match = key.match(/device_property_(\d+\/\d+\/\d+)_(\d+)\/date/);
      if (!match) continue;
      
      try {
        const data = await obsApi.getHistoryData(match[1], match[2], deviceId);
        if (data && data.length > 0) {
          allData.push(...data);
        } else {
          // 该文件对当前设备无数据
          emptyKeys.push(key);
        }
      } catch (err) {
        console.error('加载数据失败:', key, err);
        emptyKeys.push(key);
      }
    }
    
    wx.hideLoading();
    
    // 更新日期列表，标记无数据的项
    const dates = this.data.availableDates.map(d => ({
      ...d,
      selected: keys.includes(d.key),
      empty: emptyKeys.includes(d.key)  // 标记为空
    }));
    
    this.setData({ availableDates: dates, obsLoading: false });
    
    if (allData.length > 0) {
      this.processObsData(allData);
      if (emptyKeys.length > 0) {
        wx.showToast({ title: `${allData.length}条数据，${emptyKeys.length}个时段无数据`, icon: 'none', duration: 2500 });
      } else {
        wx.showToast({ title: `共${allData.length}条数据`, icon: 'success' });
      }
    } else {
      wx.showToast({ title: '当前设备无数据', icon: 'none' });
    }
  }
});
