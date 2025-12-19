require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json());

const OBS_CONFIG = {
  accessKeyId: process.env.OBS_ACCESS_KEY_ID,
  secretAccessKey: process.env.OBS_SECRET_ACCESS_KEY,
  endpoint: process.env.OBS_ENDPOINT,
  bucket: process.env.OBS_BUCKET_NAME
};

// 生成OBS签名
function signRequest(method, path, headers) {
  const stringToSign = [
    method,
    headers['Content-MD5'] || '',
    headers['Content-Type'] || '',
    headers['Date'],
    path
  ].join('\n');
  
  const signature = crypto
    .createHmac('sha1', OBS_CONFIG.secretAccessKey)
    .update(stringToSign)
    .digest('base64');
  
  return `OBS ${OBS_CONFIG.accessKeyId}:${signature}`;
}

// HTTP请求OBS
function obsRequest(method, objectKey) {
  return new Promise((resolve, reject) => {
    const path = `/${OBS_CONFIG.bucket}/${objectKey}`;
    const date = new Date().toUTCString();
    const headers = {
      'Date': date,
      'Host': OBS_CONFIG.endpoint
    };
    headers['Authorization'] = signRequest(method, path, headers);
    
    const options = {
      hostname: OBS_CONFIG.endpoint,
      port: 443,
      path: path,
      method: method,
      headers: headers
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`OBS返回 ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// 列出OBS对象
function listObsObjects(prefix) {
  return new Promise((resolve, reject) => {
    const path = `/${OBS_CONFIG.bucket}?prefix=${encodeURIComponent(prefix)}&max-keys=100`;
    const date = new Date().toUTCString();
    const canonicalPath = `/${OBS_CONFIG.bucket}/`;
    const headers = {
      'Date': date,
      'Host': OBS_CONFIG.endpoint
    };
    headers['Authorization'] = signRequest('GET', canonicalPath, headers);
    
    const options = {
      hostname: OBS_CONFIG.endpoint,
      port: 443,
      path: path,
      method: 'GET',
      headers: headers
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          // 解析XML响应
          const keys = [];
          const regex = /<Key>([^<]+)<\/Key>.*?<LastModified>([^<]+)<\/LastModified>.*?<Size>([^<]+)<\/Size>/gs;
          let match;
          while ((match = regex.exec(data)) !== null) {
            keys.push({
              key: match[1],
              lastModified: match[2],
              size: match[3]
            });
          }
          resolve(keys);
        } else {
          reject(new Error(`OBS列表返回 ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// 解析OBS文件内容
function parseObsContent(content) {
  const results = [];
  const jsonStrings = content.split(/\}\s*\{/).map((str, index, arr) => {
    if (index === 0) return str + '}';
    if (index === arr.length - 1) return '{' + str;
    return '{' + str + '}';
  });
  
  for (const jsonStr of jsonStrings) {
    try {
      const obj = JSON.parse(jsonStr);
      results.push(obj);
    } catch (e) {
      // 跳过解析失败的
    }
  }
  return results;
}

// 提取设备数据
function extractDeviceData(records, deviceId) {
  return records
    .filter(record => {
      const headerDeviceId = record.notify_data?.header?.device_id;
      return !deviceId || headerDeviceId === deviceId;
    })
    .map(record => {
      const header = record.notify_data?.header || {};
      const services = record.notify_data?.body?.services || [];
      const service = services.find(s => s.service_id === 'medical_1') || services[0] || {};
      
      return {
        device_id: header.device_id,
        event_time: record.event_time_ms || record.event_time,
        properties: service.properties || {},
        service_id: service.service_id
      };
    });
}

// API: 获取历史数据
app.get('/api/history', async (req, res) => {
  try {
    const { date, hour, device_id } = req.query;
    const now = new Date();
    const targetDate = date || `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const targetHour = hour || String(now.getHours()).padStart(2, '0');
    const objectKey = `device_property_${targetDate}_${targetHour}/date`;
    
    console.log(`获取OBS对象: ${objectKey}`);
    
    const content = await obsRequest('GET', objectKey);
    const records = parseObsContent(content);
    const data = extractDeviceData(records, device_id);
    
    res.json({ success: true, data, objectKey, totalRecords: records.length });
  } catch (error) {
    console.error('获取历史数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: 获取时间范围数据
app.get('/api/history/range', async (req, res) => {
  try {
    const { date, startHour, endHour, device_id } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, error: '请提供date参数' });
    }
    
    const start = parseInt(startHour) || 0;
    const end = parseInt(endHour) || 23;
    const allData = [];
    
    for (let h = start; h <= end; h++) {
      const hourStr = String(h).padStart(2, '0');
      const objectKey = `device_property_${date}_${hourStr}/date`;
      try {
        const content = await obsRequest('GET', objectKey);
        const records = parseObsContent(content);
        const data = extractDeviceData(records, device_id);
        allData.push(...data);
      } catch (e) {
        // 该小时没数据，跳过
      }
    }
    
    res.json({ success: true, data: allData, totalRecords: allData.length });
  } catch (error) {
    console.error('获取历史范围失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: 列出文件
app.get('/api/history/list', async (req, res) => {
  try {
    const { prefix } = req.query;
    const result = await listObsObjects(prefix || 'device_property_');
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('列出文件失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 健康检查
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Medical OBS Server' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

module.exports = app;
