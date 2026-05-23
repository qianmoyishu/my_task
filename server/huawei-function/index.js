const crypto = require('crypto');
const https = require('https');

// OBS 配置 - 在华为云函数环境变量中设置
const OBS_CONFIG = {
  accessKeyId: process.env.OBS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.OBS_SECRET_ACCESS_KEY || '',
  endpoint: process.env.OBS_ENDPOINT || 'obs.cn-north-4.myhuaweicloud.com',
  bucket: process.env.OBS_BUCKET_NAME || ''
};

function signRequest(method, canonicalResource, headers) {
  const stringToSign = [
    method,
    headers['Content-MD5'] || '',
    headers['Content-Type'] || '',
    headers['Date'],
    canonicalResource
  ].join('\n');
  
  const signature = crypto
    .createHmac('sha1', OBS_CONFIG.secretAccessKey)
    .update(stringToSign)
    .digest('base64');
  
  return `OBS ${OBS_CONFIG.accessKeyId}:${signature}`;
}

function obsRequest(objectKey) {
  return new Promise((resolve, reject) => {
    const virtualHost = `${OBS_CONFIG.bucket}.${OBS_CONFIG.endpoint}`;
    const path = `/${objectKey}`;
    const canonicalResource = `/${OBS_CONFIG.bucket}/${objectKey}`;
    const date = new Date().toUTCString();
    const headers = {
      'Date': date,
      'Host': virtualHost
    };
    headers['Authorization'] = signRequest('GET', canonicalResource, headers);
    
    const req = https.request({
      hostname: virtualHost,
      port: 443,
      path: path,
      method: 'GET',
      headers: headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(data);
        else reject(new Error(`OBS ${res.statusCode}`));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function listObsObjects(prefix) {
  return new Promise((resolve, reject) => {
    const virtualHost = `${OBS_CONFIG.bucket}.${OBS_CONFIG.endpoint}`;
    const path = `/?prefix=${encodeURIComponent(prefix)}&max-keys=100`;
    const canonicalResource = `/${OBS_CONFIG.bucket}/`;
    const date = new Date().toUTCString();
    const headers = {
      'Date': date,
      'Host': virtualHost
    };
    headers['Authorization'] = signRequest('GET', canonicalResource, headers);
    
    const req = https.request({
      hostname: virtualHost,
      port: 443,
      path: path,
      method: 'GET',
      headers: headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const keys = [];
          const regex = /<Key>([^<]+)<\/Key>.*?<LastModified>([^<]+)<\/LastModified>.*?<Size>([^<]+)<\/Size>/gs;
          let match;
          while ((match = regex.exec(data)) !== null) {
            keys.push({ key: match[1], lastModified: match[2], size: match[3] });
          }
          resolve(keys);
        } else {
          reject(new Error(`OBS list ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function parseObsContent(content) {
  const results = [];
  const jsonStrings = content.split(/\}\s*\{/).map((str, i, arr) => {
    if (i === 0) return str + '}';
    if (i === arr.length - 1) return '{' + str;
    return '{' + str + '}';
  });
  for (const jsonStr of jsonStrings) {
    try { results.push(JSON.parse(jsonStr)); } catch (e) {}
  }
  return results;
}

function extractDeviceData(records, deviceId) {
  return records
    .filter(r => !deviceId || r.notify_data?.header?.device_id === deviceId)
    .map(r => ({
      device_id: r.notify_data?.header?.device_id,
      event_time: r.event_time_ms || r.event_time,
      properties: r.notify_data?.body?.services?.[0]?.properties || {},
      service_id: r.notify_data?.body?.services?.[0]?.service_id
    }));
}

// HTTP 函数入口
exports.handler = async (event, context) => {
  // 设置 CORS 头
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  // 获取请求信息
  const method = event.method || event.httpMethod || 'GET';
  const path = event.path || event.requestURI || '/';
  const query = event.queryStringParameters || {};
  
  // 如果 query 为空，尝试从 URL 解析
  if (Object.keys(query).length === 0 && path.includes('?')) {
    const urlParts = path.split('?');
    const searchParams = new URLSearchParams(urlParts[1]);
    searchParams.forEach((value, key) => {
      query[key] = value;
    });
  }
  
  // 处理 OPTIONS 预检请求
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: headers,
      body: ''
    };
  }
  
  try {
    // /list 或 /api/list 或 /api/history/list - 列出文件
    if (path.includes('/list')) {
      const prefix = query.prefix || 'device_property_';
      const result = await listObsObjects(prefix);
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({ success: true, data: result })
      };
    }
    
    // /history 或 /api/history - 获取历史数据
    if (path.includes('/history') || path === '/' || path === '') {
      const { date, hour, device_id } = query;
      const now = new Date();
      const targetDate = date || `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;
      const targetHour = hour || String(now.getHours()).padStart(2, '0');
      const objectKey = `device_property_${targetDate}_${targetHour}/date`;
      
      const content = await obsRequest(objectKey);
      const records = parseObsContent(content);
      const data = extractDeviceData(records, device_id);
      
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({ success: true, data, objectKey, totalRecords: records.length })
      };
    }
    
    // 默认返回状态
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({ status: 'ok', message: 'Medical OBS API', path: path })
    };
    
  } catch (error) {
    console.error('Error:', error.message);
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
