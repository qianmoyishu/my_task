const crypto = require('crypto');
const https = require('https');

function getPainObsConfig() {
  const config = {
    accessKeyId: process.env.PAIN_OBS_ACCESS_KEY_ID,
    secretAccessKey: process.env.PAIN_OBS_SECRET_ACCESS_KEY,
    endpoint: process.env.PAIN_OBS_ENDPOINT,
    bucket: process.env.PAIN_OBS_BUCKET_NAME,
    prefix: process.env.PAIN_OBS_PREFIX || 'inference_results/'
  };
  const required = [
    ['PAIN_OBS_ACCESS_KEY_ID', config.accessKeyId],
    ['PAIN_OBS_SECRET_ACCESS_KEY', config.secretAccessKey],
    ['PAIN_OBS_ENDPOINT', config.endpoint],
    ['PAIN_OBS_BUCKET_NAME', config.bucket]
  ];
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Missing pain OBS environment variables: ${missing.join(', ')}`);
  }
  return config;
}

function signRequest(config, method, canonicalResource, headers) {
  const stringToSign = [
    method,
    headers['Content-MD5'] || '',
    headers['Content-Type'] || '',
    headers.Date,
    canonicalResource
  ].join('\n');
  const signature = crypto
    .createHmac('sha1', config.secretAccessKey)
    .update(stringToSign)
    .digest('base64');
  return `OBS ${config.accessKeyId}:${signature}`;
}

function requestPainObs(config, path, canonicalResource) {
  return new Promise((resolve, reject) => {
    const host = `${config.bucket}.${config.endpoint}`;
    const headers = { Date: new Date().toUTCString(), Host: host };
    headers.Authorization = signRequest(config, 'GET', canonicalResource, headers);
    const req = https.request({ hostname: host, port: 443, path, method: 'GET', headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) resolve(body);
        else reject(new Error(`Pain OBS ${res.statusCode}: ${body.substring(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function getDeviceFolder(deviceId) {
  const match = String(deviceId || '').match(/_medical(\d+)$/i);
  if (!match) {
    throw new Error('Unsupported device_id for pain OBS');
  }
  return `设备${match[1]}`;
}

function getSafeDeviceFolder(deviceId) {
  const match = String(deviceId || '').match(/_medical(\d+)$/i);
  if (!match) {
    throw new Error('Unsupported device_id for pain OBS');
  }
  // Avoid relying on the source-file encoding for the Chinese OBS folder name.
  return `\u8bbe\u5907${match[1]}`;
}

function toEncodedObjectPath(objectKey) {
  return `/${String(objectKey).split('/').map(encodeURIComponent).join('/')}`;
}

async function findLatestPainObject(config, deviceId) {
  const basePrefix = config.prefix.endsWith('/') ? config.prefix : `${config.prefix}/`;
  const prefix = `${basePrefix}${getSafeDeviceFolder(deviceId)}/`;
  const xml = await requestPainObs(
    config,
    `/?prefix=${encodeURIComponent(prefix)}&max-keys=1000`,
    `/${config.bucket}/`
  );
  const objects = [];
  const regex = /<Key>([^<]+)<\/Key>.*?<LastModified>([^<]+)<\/LastModified>/gs;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    if (/_level\.json$/i.test(match[1])) {
      objects.push({ key: match[1], lastModified: match[2] });
    }
  }
  if (objects.length === 0) {
    throw new Error(`No pain result found for ${getDeviceFolder(deviceId)}`);
  }
  objects.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
  return objects[0];
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const deviceId = req.query.device_id;
    if (!deviceId) return res.status(400).json({ success: false, error: 'device_id is required' });

    const config = getPainObsConfig();
    const latest = await findLatestPainObject(config, deviceId);
    const body = await requestPainObs(
      config,
      toEncodedObjectPath(latest.key),
      `/${config.bucket}/${latest.key}`
    );
    const result = JSON.parse(body);
    if (!Number.isFinite(Number(result.pain_level))) {
      throw new Error('pain_level is missing from the latest pain result');
    }

    return res.status(200).json({
      success: true,
      data: {
        pain_level: Number(result.pain_level),
        pain_label: result.pain_label || '',
        confidence: Number(result.confidence) || 0,
        upload_time: result.upload_time || '',
        device_id: result.device_id || deviceId,
        objectKey: latest.key
      }
    });
  } catch (error) {
    console.error('Pain OBS error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};
