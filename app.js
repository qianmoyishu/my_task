// -*- coding: utf-8 -*-
App({
  onLaunch() {
    try {
      const config = wx.getStorageSync('iotConfig');
      if (config) {
        this.globalData = {...this.globalData, ...config};
      }
    } catch (e) {
      console.error('读取配置失败', e);
    }
  },
  
  saveConfig() {
    try {
      wx.setStorageSync('iotConfig', {
        iamEndpoint: this.globalData.iamEndpoint,
        userName: this.globalData.userName,
        iamUserName: this.globalData.iamUserName, 
        iamUserPassword: this.globalData.iamUserPassword,
        projectName: this.globalData.projectName,
        iotDAEndpoint: this.globalData.iotDAEndpoint,
        product_id: this.globalData.product_id,
        device_id: this.globalData.device_id,
        refreshInterval: this.globalData.refreshInterval,
        project_id: this.globalData.project_id,
        service_id: this.globalData.service_id,
        devices: this.globalData.devices,
        currentDeviceIndex: this.globalData.currentDeviceIndex,
        deviceName: this.globalData.deviceName
      });
    } catch (e) {
      console.error('保存配置失败', e);
    }
  },

  globalData: {
    userInfo: null,
    // 后端服务地址 - Cloudflare代理
    serverUrl: "https://api.hzyqianchang2333.dpdns.org",
    
    // 初始为空，需要用户在设置中配置
    iamEndpoint: "",   
    userName: "",
    iamUserName: "",
    iamUserPassword: "",
    projectName: "",
    iotDAEndpoint: "",
    project_id: "",
    product_id: "",
    service_id: "",
    
    // 设备列表初始为空
    devices: [],
    currentDeviceIndex: 0,
    device_id: "",
    deviceName: "",

    Gsr: {
      current: 0,
      unit: '',
      min: 0,
      max: 2000,
      history: []
    },
    MLX90600: {
      current: 0.0,
      unit: 'C',
      min: 0.0,
      max: 50.0,
      history: []
    },
    Heart_rate: {
      current: 0,
      unit: 'bpm',
      min: 0,
      max: 200,
      history: []
    },
    thermal_grid: {
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
    lastUpdatedTime: '',
    refreshInterval: 5000,
    deviceStatus: '离线'
  },
  
  // 切换设备
  switchDevice(index) {
    if (this.globalData.devices && index >= 0 && index < this.globalData.devices.length) {
      const device = this.globalData.devices[index];
      this.globalData.currentDeviceIndex = index;
      this.globalData.device_id = device.device_id;
      this.globalData.deviceName = device.name;
      return device;
    }
    return null;
  },
  
  // 获取当前设备
  getCurrentDevice() {
    if (this.globalData.devices && this.globalData.devices.length > 0) {
      return this.globalData.devices[this.globalData.currentDeviceIndex];
    }
    return null;
  },
  
  // 获取设备列表
  getDeviceList() {
    return this.globalData.devices || [];
  }
})
