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

function decodeXml(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/g, (entity, code) => {
    if (code[0] === '#') {
      const number = code[1] === 'x'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return number <= 0x10ffff ? String.fromCodePoint(number) : entity;
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[code];
  });
}

function getXmlTag(xml, name) {
  return xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1];
}

function parseListPage(xml) {
  const objects = [];
  const contents = xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g);
  for (const [, entry] of contents) {
    const key = getXmlTag(entry, 'Key');
    const lastModified = getXmlTag(entry, 'LastModified');
    const size = getXmlTag(entry, 'Size');
    if (key !== undefined && lastModified !== undefined && size !== undefined) {
      objects.push({ key: decodeXml(key), lastModified, size });
    }
  }
  const truncated = getXmlTag(xml, 'IsTruncated')?.trim();
  if (truncated !== 'true' && truncated !== 'false') {
    throw new Error('OBS list response is missing a valid IsTruncated value');
  }
  const nextMarker = getXmlTag(xml, 'NextMarker');
  return { objects, truncated: truncated === 'true', nextMarker };
}

function requestListPage(prefix, marker) {
  return new Promise((resolve, reject) => {
    const virtualHost = `${OBS_CONFIG.bucket}.${OBS_CONFIG.endpoint}`;
    const query = new URLSearchParams({ prefix, 'max-keys': '1000' });
    if (marker) query.set('marker', marker);
    const requestPath = `/?${query.toString()}`;
    const canonicalResource = `/${OBS_CONFIG.bucket}/`;
    const headers = { Date: new Date().toUTCString(), Host: virtualHost };
    headers.Authorization = signRequest('GET', canonicalResource, headers);

    const req = https.request({
      hostname: virtualHost,
      port: 443,
      path: requestPath,
      method: 'GET',
      headers
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('error', reject);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(data);
        else reject(new Error(`OBS list ${res.statusCode}: ${data.substring(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function listObsObjects(prefix) {
  const objects = [];
  const seenMarkers = new Set();
  let marker;
  while (true) {
    const page = parseListPage(await requestListPage(prefix, marker));
    objects.push(...page.objects);
    if (!page.truncated) return objects;

    // OBS may omit NextMarker when no delimiter is requested.
    const nextMarker = page.nextMarker
      ? decodeXml(page.nextMarker)
      : page.objects[page.objects.length - 1]?.key;
    if (!nextMarker || seenMarkers.has(nextMarker)) {
      throw new Error('OBS list pagination did not return a new marker');
    }
    seenMarkers.add(nextMarker);
    marker = nextMarker;
  }
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
