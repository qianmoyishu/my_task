const ObsClient = require('esdk-obs-nodejs');

function readEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : value;
}

function getPainObsConfig() {
  const hasPainAccessKey = Boolean(readEnv('PAIN_OBS_ACCESS_KEY_ID'));
  const hasPainSecretKey = Boolean(readEnv('PAIN_OBS_SECRET_ACCESS_KEY'));
  if (hasPainAccessKey !== hasPainSecretKey) {
    throw new Error('Configure both PAIN_OBS_ACCESS_KEY_ID and PAIN_OBS_SECRET_ACCESS_KEY, or neither');
  }

  const useDedicatedPainCredentials = hasPainAccessKey && hasPainSecretKey;
  const config = {
    accessKeyId: useDedicatedPainCredentials ? readEnv('PAIN_OBS_ACCESS_KEY_ID') : readEnv('OBS_ACCESS_KEY_ID'),
    secretAccessKey: useDedicatedPainCredentials ? readEnv('PAIN_OBS_SECRET_ACCESS_KEY') : readEnv('OBS_SECRET_ACCESS_KEY'),
    securityToken: readEnv('PAIN_OBS_SECURITY_TOKEN'),
    endpoint: readEnv('PAIN_OBS_ENDPOINT'),
    bucket: readEnv('PAIN_OBS_BUCKET_NAME'),
    prefix: readEnv('PAIN_OBS_PREFIX') || 'inference_results/'
  };
  const required = [
    [useDedicatedPainCredentials ? 'PAIN_OBS_ACCESS_KEY_ID' : 'OBS_ACCESS_KEY_ID', config.accessKeyId],
    [useDedicatedPainCredentials ? 'PAIN_OBS_SECRET_ACCESS_KEY' : 'OBS_SECRET_ACCESS_KEY', config.secretAccessKey],
    ['PAIN_OBS_ENDPOINT', config.endpoint],
    ['PAIN_OBS_BUCKET_NAME', config.bucket]
  ];
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Missing pain OBS environment variables: ${missing.join(', ')}`);
  }
  return config;
}

function createPainObsClient(config) {
  const endpoint = /^https?:\/\//i.test(config.endpoint)
    ? config.endpoint
    : `https://${config.endpoint}`;
  return new ObsClient({
    access_key_id: config.accessKeyId,
    secret_access_key: config.secretAccessKey,
    security_token: config.securityToken || undefined,
    server: endpoint
  });
}

function ensureObsSuccess(result, operation) {
  const common = result && result.CommonMsg;
  if (!common || common.Status >= 300) {
    const status = common && common.Status ? common.Status : 'unknown';
    const code = common && common.Code ? common.Code : 'UnknownError';
    const message = common && common.Message ? common.Message : 'OBS request failed';
    throw new Error(`Pain OBS ${operation} ${status}: ${code} ${message}`);
  }
  return result.InterfaceResult || {};
}

function getDeviceFolder(deviceId) {
  const match = String(deviceId || '').match(/_medical(\d+)$/i);
  if (!match) {
    throw new Error('Unsupported device_id for pain OBS');
  }
  return `\u8bbe\u5907${match[1]}`;
}

async function findLatestPainObject(client, config, deviceId) {
  const basePrefix = config.prefix.endsWith('/') ? config.prefix : `${config.prefix}/`;
  const prefix = `${basePrefix}${getDeviceFolder(deviceId)}/`;
  const result = await client.listObjects({
    Bucket: config.bucket,
    Prefix: prefix,
    MaxKeys: 1000
  });
  const response = ensureObsSuccess(result, 'list');
  const contents = Array.isArray(response.Contents) ? response.Contents : [];
  const objects = contents.filter((item) => /_level\d*\.json$/i.test(item.Key));
  if (objects.length === 0) {
    throw new Error(`No pain result found for ${getDeviceFolder(deviceId)}`);
  }
  objects.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
  return objects[0];
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let client;
  try {
    const deviceId = req.query.device_id;
    if (!deviceId) return res.status(400).json({ success: false, error: 'device_id is required' });

    const config = getPainObsConfig();
    client = createPainObsClient(config);
    const latest = await findLatestPainObject(client, config, deviceId);
    const result = await client.getObject({ Bucket: config.bucket, Key: latest.Key });
    const response = ensureObsSuccess(result, 'get');
    const content = Buffer.isBuffer(response.Content)
      ? response.Content.toString('utf8')
      : String(response.Content || '');
    const pain = JSON.parse(content);
    if (!Number.isFinite(Number(pain.pain_level))) {
      throw new Error('pain_level is missing from the latest pain result');
    }

    return res.status(200).json({
      success: true,
      data: {
        pain_level: Number(pain.pain_level),
        pain_label: pain.pain_label || '',
        confidence: Number(pain.confidence) || 0,
        upload_time: pain.upload_time || '',
        device_id: pain.device_id || deviceId,
        objectKey: latest.Key
      }
    });
  } catch (error) {
    console.error('Pain OBS error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) client.close();
  }
};
