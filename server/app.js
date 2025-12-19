require('dotenv').config();
const express = require('express');
const cors = require('cors');
const ObsClient = require('esdk-obs-nodejs');

const app = express();
app.use(cors());
app.use(express.json());

// 初始化OBS客户端
const obsClient = new ObsClient({
  access_key_id: process.env.OBS_ACCESS_KEY_ID,
  secret_access_key: process.env.OBS_SECRET_ACCESS_KEY,
  server: `https://${process.env.OBS_ENDPOINT}`
});

const BUCKET_NAME = process.env.OBS_BUCKET_NAME;

// 解析OBS文件内容（多个JSON对象连续拼接的格式）
function parseObsContent(content) {
  const results = [];
  // 按 }{ 分割，处理连续的JSON对象
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
      console.warn('解析JSON失败:', jsonStr.substring(0, 100));
    }
  }
  return results;
}

// 从解析后的数据中提取设备属性
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

// 获取指定日期和小时的历史数据
app.get('/api/history', async (req, res) => {
  try {
    const { date, hour, device_id } = req.query;
    
    // 默认获取当前日期和小时
    const now = new Date();
    const targetDate = date || `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const targetHour = hour || String(now.getHours()).padStart(2, '0');
    
    // 构建OBS对象路径: device_property_2025/12/19_07/date
    const objectKey = `device_property_${targetDate}_${targetHour}/date`;
    
    console.log(`正在获取OBS对象: ${objectKey}`);
    
    const content = await getObsObject(objectKey);
    const records = parseObsContent(content);
    const data = extractDeviceData(records, device_id);
    
    res.json({ 
      success: true, 
      data,
      objectKey,
      totalRecords: records.length,
      filteredRecords: data.length
    });
  } catch (error) {
    console.error('获取历史数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取指定时间范围的历史数据
app.get('/api/history/range', async (req, res) => {
  try {
    const { date, startHour, endHour, device_id } = req.query;
    
    if (!date) {
      return res.status(400).json({ success: false, error: '请提供date参数，格式: 2025/12/19' });
    }
    
    const start = parseInt(startHour) || 0;
    const end = parseInt(endHour) || 23;
    const allData = [];
    
    for (let h = start; h <= end; h++) {
      const hourStr = String(h).padStart(2, '0');
      const objectKey = `device_property_${date}_${hourStr}/date`;
      
      try {
        const content = await getObsObject(objectKey);
        const records = parseObsContent(content);
        const data = extractDeviceData(records, device_id);
        allData.push(...data);
      } catch (e) {
        console.log(`${objectKey} 不存在或获取失败`);
      }
    }
    
    res.json({ 
      success: true, 
      data: allData,
      totalRecords: allData.length
    });
  } catch (error) {
    console.error('获取历史数据范围失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 列出可用的历史数据文件
app.get('/api/history/list', async (req, res) => {
  try {
    const { prefix } = req.query;
    const searchPrefix = prefix || 'device_property_';
    
    const result = await listObsObjects(searchPrefix);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('列出历史数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 从OBS获取对象内容（返回原始字符串）
function getObsObject(objectKey) {
  return new Promise((resolve, reject) => {
    obsClient.getObject({
      Bucket: BUCKET_NAME,
      Key: objectKey
    }, (err, result) => {
      if (err) {
        reject(err);
      } else if (result.CommonMsg.Status === 200) {
        const content = result.InterfaceResult.Content.toString();
        resolve(content);
      } else {
        reject(new Error(`OBS返回状态: ${result.CommonMsg.Status}`));
      }
    });
  });
}

// 列出OBS对象
function listObsObjects(prefix) {
  return new Promise((resolve, reject) => {
    obsClient.listObjects({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: 100
    }, (err, result) => {
      if (err) {
        reject(err);
      } else if (result.CommonMsg.Status === 200) {
        const objects = result.InterfaceResult.Contents.map(obj => ({
          key: obj.Key,
          lastModified: obj.LastModified,
          size: obj.Size
        }));
        resolve(objects);
      } else {
        reject(new Error(`OBS返回状态: ${result.CommonMsg.Status}`));
      }
    });
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API接口:`);
  console.log(`  GET /api/history?date=2025/12/19&hour=14&device_id=xxx`);
  console.log(`  GET /api/history/range?date=2025/12/19&startHour=0&endHour=23&device_id=xxx`);
  console.log(`  GET /api/history/list`);
});
