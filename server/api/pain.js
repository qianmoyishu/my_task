const crypto = require('crypto');
const https = require('https');

function readEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : value;
}

function getPainObsConfig() {
  const config = {
    accessKeyId: readEnv('PAIN_OBS_ACCESS_KEY_ID'),
    secretAccessKey: readEnv('PAIN_OBS_SECRET_ACCESS_KEY'),
    endpoint: readEnv('PAIN_OBS_ENDPOINT'),
    bucket: readEnv('PAIN_OBS_BUCKET_NAME'),
    prefix: readEnv('PAIN_OBS_PREFIX') || 'inference_results/'
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
  const endpoint = config.endpoint.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return Object.assign({}, config, { endpoint });
}

function buildStringToSign(method, canonicalResource, headers) {
  return [
    method,
    headers['Content-MD5'] || '',
    headers['Content-Type'] || '',
    headers.Date,
    canonicalResource
  ].join('\n');
}

function signRequest(config, method, canonicalResource, headers) {
  const stringToSign = buildStringToSign(method, canonicalResource, headers);
  const signature = crypto
    .createHmac('sha1', config.secretAccessKey)
    .update(stringToSign)
    .digest('base64');
  return `OBS ${config.accessKeyId}:${signature}`;
}

function requestPainObs(config, path, canonicalResource, operation = 'request') {
  return new Promise((resolve, reject) => {
    const host = `${config.bucket}.${config.endpoint}`;
    const headers = { Date: new Date().toUTCString(), Host: host };
    const stringToSign = buildStringToSign('GET', canonicalResource, headers);
    headers.Authorization = signRequest(config, 'GET', canonicalResource, headers);
    const req = https.request({ hostname: host, port: 443, path, method: 'GET', headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('error', reject);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(body);
          return;
        }
        const code = body.match(/<Code>([^<]+)<\/Code>/)?.[1];
        const message = body.match(/<Message>([^<]+)<\/Message>/)?.[1];
        if (res.statusCode === 403) {
          // No secrets here; helps diagnose SignatureDoesNotMatch from Vercel logs.
          console.error(`Pain OBS ${operation} StringToSign: ${JSON.stringify(stringToSign)}`);
        }
        reject(new Error(
          `Pain OBS ${operation} ${res.statusCode}: ${code || 'UnknownError'} ${message || body.substring(0, 300)}`
        ));
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
  // Keep the object-prefix name ASCII-safe across deployment tooling.
  return `\u8bbe\u5907${match[1]}`;
}

function toEncodedObjectPath(objectKey) {
  // Match OBS SDK V2 signing: percent-encode every character except path separators.
  let encoded = '';
  for (const char of String(objectKey)) {
    encoded += char === '/' ? '/' : encodeURIComponent(char);
  }
  return `/${encoded}`;
}

async function listPainObjects(config, deviceId, limit = 20) {
  const basePrefix = config.prefix.endsWith('/') ? config.prefix : `${config.prefix}/`;
  const prefix = `${basePrefix}${getDeviceFolder(deviceId)}/`;
  const xml = await requestPainObs(
    config,
    `/?prefix=${encodeURIComponent(prefix)}&max-keys=1000`,
    `/${config.bucket}/`,
    'list'
  );
  const objects = [];
  const regex = /<Key>([^<]+)<\/Key>.*?<LastModified>([^<]+)<\/LastModified>/gs;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    if (/_level\d*\.json$/i.test(match[1])) {
      objects.push({ key: match[1], lastModified: match[2] });
    }
  }
  if (objects.length === 0) {
    throw new Error(`No pain result found for ${getDeviceFolder(deviceId)}`);
  }
  objects.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
  return objects.slice(0, Math.max(1, Math.min(Number(limit) || 20, 50)));
}

async function readPainResult(config, object, deviceId) {
  const body = await requestPainObs(
    config,
    toEncodedObjectPath(object.key),
    `/${config.bucket}${toEncodedObjectPath(object.key)}`,
    'get'
  );
  const result = JSON.parse(body);
  if (!Number.isFinite(Number(result.pain_level))) {
    throw new Error(`pain_level is missing from ${object.key}`);
  }
  return {
    pain_level: Number(result.pain_level),
    pain_label: result.pain_label || '',
    confidence: Number(result.confidence) || 0,
    upload_time: result.upload_time || object.lastModified || '',
    device_id: result.device_id || deviceId,
    objectKey: object.key
  };
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
    const wantsHistory = String(req.query.history || '') === '1';
    const objects = await listPainObjects(config, deviceId, wantsHistory ? req.query.limit : 1);

    if (wantsHistory) {
      const results = await Promise.allSettled(
        objects.map(object => readPainResult(config, object, deviceId))
      );
      const history = results
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);
      if (history.length === 0) {
        throw new Error('No readable pain history found');
      }
      return res.status(200).json({ success: true, data: history });
    }

    const latest = await readPainResult(config, objects[0], deviceId);
    return res.status(200).json({ success: true, data: latest });
  } catch (error) {
    console.error('Pain OBS error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};
