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

function obsRequest(method, objectKey) {
  return new Promise((resolve, reject) => {
    const virtualHost = `${OBS_CONFIG.bucket}.${OBS_CONFIG.endpoint}`;
    const path = `/${objectKey}`;
    const canonicalResource = `/${OBS_CONFIG.bucket}/${objectKey}`;
    const date = new Date().toUTCString();
    const headers = {
      'Date': date,
      'Host': virtualHost
    };
    headers['Authorization'] = signRequest(method, canonicalResource, headers);
    
    const options = {
      hostname: virtualHost,
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
          reject(new Error(`OBS ${res.statusCode}: ${data}`));
        }
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
    
    const options = {
      hostname: virtualHost,
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
          const keys = [];
          const regex = /<Key>([^<]+)<\/Key>.*?<LastModified>([^<]+)<\/LastModified>.*?<Size>([^<]+)<\/Size>/gs;
          let match;
          while ((match = regex.exec(data)) !== null) {
            keys.push({ key: match[1], lastModified: match[2], size: match[3] });
          }
          resolve(keys);
        } else {
          reject(new Error(`OBS list ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

function parseObsContent(content) {
  const results = [];
  const jsonStrings = content.split(/\}\s*\{/).map((str, index, arr) => {
    if (index === 0) return str + '}';
    if (index === arr.length - 1) return '{' + str;
    return '{' + str + '}';
  });
  
  for (const jsonStr of jsonStrings) {
    try {
      results.push(JSON.parse(jsonStr));
    } catch (e) {}
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

app.get('/api/history', async (req, res) => {
  try {
    const { date, hour, device_id } = req.query;
    const now = new Date();
    const targetDate = date || `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;
    const targetHour = hour || String(now.getHours()).padStart(2, '0');
    const objectKey = `device_property_${targetDate}_${targetHour}/date`;
    
    console.log(`GET OBS: ${objectKey}`);
    
    const content = await obsRequest('GET', objectKey);
    const records = parseObsContent(content);
    const data = extractDeviceData(records, device_id);
    
    res.json({ success: true, data, objectKey, totalRecords: records.length });
  } catch (error) {
    console.error('History error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/history/range', async (req, res) => {
  try {
    const { date, startHour, endHour, device_id } = req.query;
    if (!date) return res.status(400).json({ success: false, error: 'date required' });
    
    const start = parseInt(startHour) || 0;
    const end = parseInt(endHour) || 23;
    const allData = [];
    
    for (let h = start; h <= end; h++) {
      const hourStr = String(h).padStart(2, '0');
      const objectKey = `device_property_${date}_${hourStr}/date`;
      try {
        const content = await obsRequest('GET', objectKey);
        const records = parseObsContent(content);
        allData.push(...extractDeviceData(records, device_id));
      } catch (e) {}
    }
    
    res.json({ success: true, data: allData, totalRecords: allData.length });
  } catch (error) {
    console.error('Range error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/history/list', async (req, res) => {
  try {
    const { prefix } = req.query;
    const result = await listObsObjects(prefix || 'device_property_');
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('List error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Medical OBS Server' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
