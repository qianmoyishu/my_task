// 华为云API封装
const app = getApp();

// 获取IAM Token
function getIamToken() {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `https://${app.globalData.iamEndpoint}/v3/auth/tokens`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json'
      },
      data: {
        auth: {
          identity: {
            methods: ['password'],
            password: {
              user: {
                name: app.globalData.iamUserName,
                password: app.globalData.iamUserPassword,
                domain: {
                  name: app.globalData.userName
                }
              }
            }
          },
          scope: {
            project: {
              name: app.globalData.projectName
            }
          }
        }
      },
      success: (res) => {
        if (res.statusCode === 201) {
          const token = res.header['X-Subject-Token'];
          resolve(token);
        } else {
          reject('获取Token失败: ' + res.statusCode);
        }
      },
      fail: (err) => {
        reject('获取Token请求失败: ' + JSON.stringify(err));
      }
    });
  });
}

// 获取设备属性
function getDeviceProperties(token) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `https://${app.globalData.iotDAEndpoint}/v5/iot/${app.globalData.project_id}/devices/${app.globalData.device_id}/properties`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject('获取设备属性失败: ' + res.statusCode);
        }
      },
      fail: (err) => {
        reject('获取设备属性请求失败: ' + JSON.stringify(err));
      }
    });
  });
}

// 获取设备状态
function getDeviceStatus(token) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `https://${app.globalData.iotDAEndpoint}/v5/iot/${app.globalData.project_id}/devices/${app.globalData.device_id}`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject('获取设备状态失败: ' + res.statusCode);
        }
      },
      fail: (err) => {
        reject('获取设备状态请求失败: ' + JSON.stringify(err));
      }
    });
  });
}

// 更新设备属性
function updateDeviceProperties(token, properties) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `https://${app.globalData.iotDAEndpoint}/v5/iot/${app.globalData.project_id}/devices/${app.globalData.device_id}/properties`,
      method: 'PUT',
      header: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token
      },
      data: properties,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject('更新设备属性失败: ' + res.statusCode);
        }
      },
      fail: (err) => {
        reject('更新设备属性请求失败: ' + JSON.stringify(err));
      }
    });
  });
}

module.exports = {
  getIamToken,
  getDeviceProperties,
  getDeviceStatus,
  updateDeviceProperties
}; 