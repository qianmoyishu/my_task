const app = getApp();

// 管理员密码
const ADMIN_PASSWORD = '1513120966';

Page({
  data: {
    isUnlocked: false,
    currentDeviceName: '',
    formData: {
      iamEndpoint: '',
      userName: '',
      iamUserName: '',
      iamUserPassword: '',
      projectName: '',
      iotDAEndpoint: '',
      product_id: '',
      device_id: '',
      refreshInterval: 5000,
      project_id: '',
      service_id: ''
    },
    showTips: false,
    tipContent: ''
  },

  onShow() {
    if (!this.data.isUnlocked) {
      this.showPasswordDialog();
    } else {
      this.loadFormData();
    }
  },

  onHide() {
    this.setData({ isUnlocked: false });
  },

  showPasswordDialog() {
    wx.showModal({
      title: '输入管理员密码',
      editable: true,
      placeholderText: '请输入密码',
      success: (res) => {
        if (res.confirm) {
          if (res.content === ADMIN_PASSWORD) {
            this.setData({ isUnlocked: true });
            this.loadFormData();
            wx.showToast({ title: '验证成功', icon: 'success' });
          } else {
            wx.showToast({ title: '密码错误', icon: 'none' });
            setTimeout(() => { this.showPasswordDialog(); }, 1500);
          }
        } else {
          wx.switchTab({ url: '/pages/index/index' });
        }
      }
    });
  },

  loadFormData() {
    this.setData({
      formData: {
        iamEndpoint: app.globalData.iamEndpoint || '',
        userName: app.globalData.userName || '',
        iamUserName: app.globalData.iamUserName || '',
        iamUserPassword: app.globalData.iamUserPassword || '',
        projectName: app.globalData.projectName || '',
        iotDAEndpoint: app.globalData.iotDAEndpoint || '',
        product_id: app.globalData.product_id || '',
        device_id: app.globalData.device_id || '',
        refreshInterval: app.globalData.refreshInterval || 5000,
        project_id: app.globalData.project_id || '',
        service_id: app.globalData.service_id || ''
      },
      currentDeviceName: app.globalData.deviceName || ''
    });
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({ [`formData.${field}`]: value });
  },

  saveSettings() {
    const { formData } = this.data;

    const requiredFields = [
      'iamEndpoint', 'userName', 'iamUserName', 'iamUserPassword',
      'projectName', 'iotDAEndpoint', 'product_id', 'device_id'
    ];

    for (const field of requiredFields) {
      if (!formData[field]) {
        wx.showToast({ title: '请填写必填项', icon: 'none' });
        return;
      }
    }

    const refreshInterval = parseInt(formData.refreshInterval);
    if (isNaN(refreshInterval) || refreshInterval < 3000) {
      wx.showToast({ title: '间隔需>=3000ms', icon: 'none' });
      return;
    }

    app.globalData.iamEndpoint = formData.iamEndpoint;
    app.globalData.userName = formData.userName;
    app.globalData.iamUserName = formData.iamUserName;
    app.globalData.iamUserPassword = formData.iamUserPassword;
    app.globalData.projectName = formData.projectName;
    app.globalData.iotDAEndpoint = formData.iotDAEndpoint;
    app.globalData.product_id = formData.product_id;
    app.globalData.device_id = formData.device_id;
    app.globalData.refreshInterval = refreshInterval;
    app.globalData.project_id = formData.project_id;
    app.globalData.service_id = formData.service_id;

    app.saveConfig();
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  resetSettings() {
    wx.showModal({
      title: '确认重置',
      content: '确定要重置所有设置吗？',
      confirmColor: '#ee0a24',
      success: (res) => {
        if (res.confirm) {
          // 清除缓存
          wx.removeStorageSync('iotConfig');
          
          app.globalData.iamEndpoint = '';
          app.globalData.userName = '';
          app.globalData.iamUserName = '';
          app.globalData.iamUserPassword = '';
          app.globalData.projectName = '';
          app.globalData.iotDAEndpoint = '';
          app.globalData.product_id = '';
          app.globalData.device_id = '';
          app.globalData.refreshInterval = 5000;
          app.globalData.project_id = '';
          app.globalData.service_id = '';
          app.globalData.deviceName = '';

          this.setData({
            formData: {
              iamEndpoint: '', userName: '', iamUserName: '', iamUserPassword: '',
              projectName: '', iotDAEndpoint: '', product_id: '', device_id: '',
              refreshInterval: 5000, project_id: '', service_id: ''
            },
            currentDeviceName: ''
          });

          wx.showToast({ title: '已重置', icon: 'success' });
        }
      }
    });
  },

  showHelp(e) {
    const { tip } = e.currentTarget.dataset;
    const tips = {
      'iam': 'IAM终端地址格式如：iam.cn-north-4.myhuaweicloud.com',
      'iotda': 'IoTDA终端地址格式如：iotda.cn-north-4.myhuaweicloud.com',
      'project_id': '华为云项目ID可在控制台"我的凭证"页面查看',
      'product_id': '产品ID是华为云IoT平台中创建的产品的唯一标识符',
      'service_id': '设备服务ID，当前设备使用"medical_1"',
      'interval': '自动刷新间隔，单位毫秒，建议不低于3000'
    };
    this.setData({ showTips: true, tipContent: tips[tip] || '' });
  },

  closeTips() {
    this.setData({ showTips: false });
  }
});
