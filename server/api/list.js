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
          reject(new Error(`OBS list ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { prefix } = req.query;
    const result = await listObsObjects(prefix || 'device_property_');
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('List error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};
