const app = getApp();

function getPainBaseUrl() {
  return app.globalData.serverUrl || 'http://localhost:3000';
}

function getLatestPain(deviceId) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${getPainBaseUrl()}/api/pain?device_id=${encodeURIComponent(deviceId)}`,
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.success) {
          resolve(res.data.data);
        } else {
          reject((res.data && res.data.error) || '获取疼痛等级失败');
        }
      },
      fail: (err) => reject(`网络请求失败: ${JSON.stringify(err)}`)
    });
  });
}

function getPainHistory(deviceId, limit = 20) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${getPainBaseUrl()}/api/pain?device_id=${encodeURIComponent(deviceId)}&history=1&limit=${limit}`,
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.success) {
          if (Array.isArray(res.data.data)) {
            resolve(res.data.data);
            return;
          }
          // 兼容尚未部署历史模式的旧服务：至少展示当前最新一条。
          if (res.data.data && typeof res.data.data === 'object') {
            const latest = Object.assign({}, res.data.data, { historyFallback: true });
            resolve([latest]);
            return;
          }
        }
        reject((res.data && res.data.error) || '获取疼痛历史失败');
      },
      fail: (err) => reject(`网络请求失败: ${JSON.stringify(err)}`)
    });
  });
}

module.exports = { getLatestPain, getPainHistory };
