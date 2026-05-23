const crypto = require('crypto');
const https = require('https');

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
        else reject(new Error(`OBS ${res.statusCode}: ${data.substring(0, 200)}`));
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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { date, hour, device_id } = req.query;
    const now = new Date();
    const targetDate = date || `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;
    const targetHour = hour || String(now.getHours()).padStart(2, '0');
    const objectKey = `device_property_${targetDate}_${targetHour}/date`;
    
    const content = await obsRequest(objectKey);
    const records = parseObsContent(content);
    const data = extractDeviceData(records, device_id);
    
    res.status(200).json({ success: true, data, objectKey, totalRecords: records.length });
  } catch (error) {
    console.error('History error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};
