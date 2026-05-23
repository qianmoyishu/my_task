// OBS历史数据API - 通过后端获取
const app = getApp();

function getBaseUrl() {
  return app.globalData.serverUrl || 'http://localhost:3000';
}

// 获取指定日期和小时的历史数据
function getHistoryData(date, hour, deviceId) {
  return new Promise((resolve, reject) => {
    const params = [];
    if (date) params.push(`date=${encodeURIComponent(date)}`);
    if (hour !== undefined) params.push(`hour=${encodeURIComponent(hour)}`);
    if (deviceId) params.push(`device_id=${encodeURIComponent(deviceId)}`);
    
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    
    wx.request({
      url: `${getBaseUrl()}/api/history${queryString}`,
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200 && res.data.success) {
          resolve(res.data.data);
        } else {
          reject(res.data.error || '获取历史数据失败');
        }
      },
      fail: (err) => {
        reject('网络请求失败: ' + JSON.stringify(err));
      }
    });
  });
}

// 获取指定日期时间范围的历史数据
function getHistoryRange(date, startHour, endHour, deviceId) {
  return new Promise((resolve, reject) => {
    const params = [`date=${encodeURIComponent(date)}`];
    if (startHour !== undefined) params.push(`startHour=${startHour}`);
    if (endHour !== undefined) params.push(`endHour=${endHour}`);
    if (deviceId) params.push(`device_id=${encodeURIComponent(deviceId)}`);
    
    wx.request({
      url: `${getBaseUrl()}/api/history/range?${params.join('&')}`,
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200 && res.data.success) {
          resolve(res.data.data);
        } else {
          reject(res.data.error || '获取历史数据范围失败');
        }
      },
      fail: (err) => {
        reject('网络请求失败: ' + JSON.stringify(err));
      }
    });
  });
}

// 列出可用的历史数据文件
function listHistoryFiles(prefix) {
  return new Promise((resolve, reject) => {
    const queryString = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
    
    wx.request({
      url: `${getBaseUrl()}/api/history/list${queryString}`,
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200 && res.data.success) {
          resolve(res.data.data);
        } else {
          reject(res.data.error || '列出历史数据失败');
        }
      },
      fail: (err) => {
        reject('网络请求失败: ' + JSON.stringify(err));
      }
    });
  });
}

// 获取当前设备今天的历史数据
function getTodayHistory(deviceId) {
  const now = new Date();
  const date = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  const currentDeviceId = deviceId || app.globalData.device_id;
  return getHistoryRange(date, 0, now.getHours(), currentDeviceId);
}

// 获取当前设备当前小时的历史数据
function getCurrentHourHistory(deviceId) {
  const now = new Date();
  const date = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  const hour = String(now.getHours()).padStart(2, '0');
  const currentDeviceId = deviceId || app.globalData.device_id;
  return getHistoryData(date, hour, currentDeviceId);
}

module.exports = {
  getHistoryData,
  getHistoryRange,
  listHistoryFiles,
  getTodayHistory,
  getCurrentHourHistory
};
