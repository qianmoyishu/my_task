const app = getApp();

// 获取IAM Token
function getIamToken() {
  return new Promise((resolve, reject) => {
    if (!app.globalData.iamEndpoint || !app.globalData.iamUserName || 
        !app.globalData.iamUserPassword || !app.globalData.userName || 
        !app.globalData.projectName) {
      reject('IAM配置参数不完整');
      return;
    }
    
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
          const token = res.header['X-Subject-Token'] || res.header['x-subject-token'];
          if (token) {
            resolve(token);
          } else {
            reject('未能获取到Token');
          }
        } else {
          reject(`获取Token失败: ${res.statusCode}, ${JSON.stringify(res.data)}`);
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
  const { iotDAEndpoint, device_id, product_id, project_id } = getApp().globalData;
  
  // 检查必要参数
  if (!iotDAEndpoint || !device_id || !product_id || !project_id) {
    return Promise.reject('获取设备属性所需的参数不完整');
  }
  
  console.log('正在获取设备属性...');
  
  const apiUrl = `${iotDAEndpoint}/v5/iot/${project_id}/devices/${device_id}/properties`;
  
  return new Promise((resolve, reject) => {
    wx.request({
      url: apiUrl,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token
      },
      success: (res) => {
        console.log('设备属性获取成功:', res);
        
        if (res.statusCode === 200 && res.data) {
          resolve(res.data);
        } else {
          reject(`获取设备属性失败: ${res.statusCode} ${JSON.stringify(res.data)}`);
        }
      },
      fail: (err) => {
        console.error('获取设备属性请求失败:', err);
        reject('网络请求失败: ' + JSON.stringify(err));
      }
    });
  });
}

// 获取设备状态
function getDeviceStatus(token) {
  return new Promise((resolve, reject) => {
    if (!app.globalData.iotDAEndpoint || !app.globalData.product_id || !app.globalData.device_id) {
      reject('IoTDA配置参数不完整');
      return;
    }
    
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
          reject(`获取设备状态失败: ${res.statusCode}, ${JSON.stringify(res.data)}`);
        }
      },
      fail: (err) => {
        reject('获取设备状态请求失败: ' + JSON.stringify(err));
      }
    });
  });
}

// 通用获取服务属性函数
function getServiceProperties(token, serviceId) {
  return new Promise((resolve, reject) => {
    if (!app.globalData.iotDAEndpoint || !app.globalData.project_id || !app.globalData.device_id) {
      reject('IoTDA配置参数不完整');
      return;
    }
    
    // 尝试使用设备级别的属性查询，而不是服务级别
    wx.request({
      url: `https://${app.globalData.iotDAEndpoint}/v5/iot/${app.globalData.project_id}/devices/${app.globalData.device_id}/properties`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token
      },
      success: (res) => {
        if (res.statusCode === 200) {
          // 手动过滤出特定服务的属性
          if (res.data && res.data.services) {
            const serviceData = res.data.services.find(s => s.service_id === serviceId);
            if (serviceData) {
              resolve({ properties: serviceData.properties });
            } else {
              resolve({ properties: {} }); // 服务不存在，返回空属性
            }
          } else {
            resolve({ properties: {} }); // 没有服务数据，返回空属性
          }
        } else {
          reject(`获取${serviceId}服务属性失败: ${res.statusCode}, ${JSON.stringify(res.data)}`);
        }
      },
      fail: (err) => {
        reject(`获取${serviceId}服务属性请求失败: ${JSON.stringify(err)}`);
      }
    });
  });
}

// 获取设备影子
function getDeviceShadow(token) {
  return new Promise((resolve, reject) => {
    if (!app.globalData.iotDAEndpoint || !app.globalData.project_id || !app.globalData.device_id) {
      reject('IoTDA配置参数不完整');
      return;
    }
    
    wx.request({
      url: `https://${app.globalData.iotDAEndpoint}/v5/iot/${app.globalData.project_id}/devices/${app.globalData.device_id}/shadow`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject(`获取设备影子失败: ${res.statusCode}, ${JSON.stringify(res.data)}`);
        }
      },
      fail: (err) => {
        reject(`获取设备影子请求失败: ${JSON.stringify(err)}`);
      }
    });
  });
}

// 格式化时间
function formatTime(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  return [year, month, day].map(formatNumber).join('-') + ' ' + 
         [hour, minute, second].map(formatNumber).join(':');
}

function formatNumber(n) {
  n = n.toString();
  return n[1] ? n : '0' + n;
}

// 发送设备命令
function sendDeviceCommand(token, commandData) {
  return new Promise((resolve, reject) => {
    if (!app.globalData.iotDAEndpoint || !app.globalData.project_id || !app.globalData.device_id) {
      reject('IoTDA配置参数不完整');
      return;
    }
    
    wx.request({
      url: `https://${app.globalData.iotDAEndpoint}/v5/iot/${app.globalData.project_id}/devices/${app.globalData.device_id}/commands`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token
      },
      data: commandData,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject(`发送命令失败: ${res.statusCode}, ${JSON.stringify(res.data)}`);
        }
      },
      fail: (err) => {
        reject(`发送命令请求失败: ${JSON.stringify(err)}`);
      }
    });
  });
}

// 发送直接命令控制设备
function sendDirectCommand(token, commandData) {
  return new Promise((resolve, reject) => {
    if (!app.globalData.iotDAEndpoint || !app.globalData.project_id || !app.globalData.device_id) {
      reject('IoTDA配置参数不完整');
      return;
    }
    
    wx.request({
      url: `https://${app.globalData.iotDAEndpoint}/v5/iot/${app.globalData.project_id}/devices/${app.globalData.device_id}/commands`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token
      },
      data: commandData,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject(`发送命令失败: ${res.statusCode}, ${JSON.stringify(res.data)}`);
        }
      },
      fail: (err) => {
        reject(`发送命令请求失败: ${JSON.stringify(err)}`);
      }
    });
  });
}

// 更新设备属性
function updateDeviceProperty(token, propertyData) {
  return new Promise((resolve, reject) => {
    if (!app.globalData.iotDAEndpoint || !app.globalData.project_id || !app.globalData.device_id) {
      reject('IoTDA配置参数不完整');
      return;
    }
    
    wx.request({
      url: `https://${app.globalData.iotDAEndpoint}/v5/iot/${app.globalData.project_id}/devices/${app.globalData.device_id}/shadow/properties`,
      method: 'PUT',
      header: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token
      },
      data: propertyData,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject(`更新属性失败: ${res.statusCode}, ${JSON.stringify(res.data)}`);
        }
      },
      fail: (err) => {
        reject(`更新属性请求失败: ${JSON.stringify(err)}`);
      }
    });
  });
}

// 直接更新设备属性（不使用影子）
function updateDeviceDirectProperty(token, propertyData) {
  return new Promise((resolve, reject) => {
    if (!app.globalData.iotDAEndpoint || !app.globalData.project_id || !app.globalData.device_id) {
      reject('IoTDA配置参数不完整');
      return;
    }
    
    wx.request({
      url: `https://${app.globalData.iotDAEndpoint}/v5/iot/${app.globalData.project_id}/devices/${app.globalData.device_id}/properties`,
      method: 'PUT',
      header: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token
      },
      data: propertyData,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject(`更新属性失败: ${res.statusCode}, ${JSON.stringify(res.data)}`);
        }
      },
      fail: (err) => {
        reject(`更新属性请求失败: ${JSON.stringify(err)}`);
      }
    });
  });
}

// 更新设备影子
function updateDeviceShadow(token, shadowData) {
  return new Promise((resolve, reject) => {
    if (!app.globalData.iotDAEndpoint || !app.globalData.project_id || !app.globalData.device_id) {
      reject('IoTDA配置参数不完整');
      return;
    }
    
    wx.request({
      url: `https://${app.globalData.iotDAEndpoint}/v5/iot/${app.globalData.project_id}/devices/${app.globalData.device_id}/shadow`,
      method: 'PUT',
      header: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token
      },
      data: shadowData,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject(`更新影子失败: ${res.statusCode}, ${JSON.stringify(res.data)}`);
        }
      },
      fail: (err) => {
        reject(`更新影子请求失败: ${JSON.stringify(err)}`);
      }
    });
  });
}

module.exports = {
  getIamToken,
  getDeviceProperties,
  getDeviceStatus,
  getDeviceShadow,
  sendDeviceCommand,
  sendDirectCommand,
  formatTime,
  updateDeviceProperty,
  updateDeviceDirectProperty,
  updateDeviceShadow
}; 