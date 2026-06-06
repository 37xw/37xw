const express = require('express');
const fs = require('fs');
const path = require('path');
const UAParser = require('ua-parser-js');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const VISITORS_FILE = path.join(__dirname, 'visitors.json');
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'yks2026';

let visitors = [];
if (fs.existsSync(VISITORS_FILE)) {
  try {
    visitors = JSON.parse(fs.readFileSync(VISITORS_FILE, 'utf-8'));
  } catch (e) {
    visitors = [];
  }
}

const geoCache = {};

const APPLE_DEVICES = [
  // iPhone - key: "WxH@DPR"
  { match: '320x568@2', model: 'iPhone SE (1. nesil)' },
  { match: '375x667@2', model: 'iPhone 6/6s/7/8/SE (2./3. nesil)' },
  { match: '414x736@3', model: 'iPhone 6+/6s+/7+/8+' },
  { match: '375x812@3', model: 'iPhone X/XS/11 Pro' },
  { match: '414x896@2', model: 'iPhone XR/11' },
  { match: '414x896@3', model: 'iPhone XS Max/11 Pro Max' },
  { match: '360x780@3', model: 'iPhone 12/13 mini' },
  { match: '390x844@3', model: 'iPhone 12/12 Pro/13/13 Pro/14' },
  { match: '428x926@3', model: 'iPhone 12 Pro Max/13 Pro Max/14 Plus' },
  { match: '393x852@3', model: 'iPhone 14 Pro/15/15 Pro' },
  { match: '430x932@3', model: 'iPhone 14 Pro Max/15 Plus/15 Pro Max' },
  // iPad
  { match: '744x1133@2', model: 'iPad Mini (6. nesil)' },
  { match: '820x1180@2', model: 'iPad Air (4./5. nesil) / iPad (10. nesil)' },
  { match: '834x1194@2', model: 'iPad Pro 11 (1./2./3./4. nesil)' },
  { match: '1024x1366@2', model: 'iPad Pro 12.9 (3./4./5./6. nesil)' },
  { match: '810x1080@2', model: 'iPad (9. nesil)' },
];

function identifyModel(vendor, model, os, sw, sh, dpr) {
  if (vendor === 'Apple' && sw && sh && dpr) {
    const key = `${sw}x${sh}@${Math.round(dpr)}`;
    const found = APPLE_DEVICES.find(d => d.match === key);
    if (found) return found.model;
  }
  return [vendor, model].filter(Boolean).join(' ') || '-';
}

function saveVisitors() {
  fs.writeFileSync(VISITORS_FILE, JSON.stringify(visitors, null, 2), 'utf-8');
}

async function getGeoInfo(ip) {
  if (geoCache[ip]) return geoCache[ip];
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    geoCache[ip] = { country: 'Local', city: 'Localhost', isp: '-' };
    return geoCache[ip];
  }
  try {
    const res = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,city,isp,query`, { timeout: 3000 });
    if (res.data.status === 'success') {
      geoCache[ip] = { country: res.data.country, city: res.data.city, isp: res.data.isp };
    } else {
      geoCache[ip] = { country: '?', city: '?', isp: '?' };
    }
  } catch {
    geoCache[ip] = { country: '?', city: '?', isp: '?' };
  }
  return geoCache[ip];
}

app.use(express.static(__dirname, { index: false }));
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

async function logVisit(req, source) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || '';
  const parser = new UAParser(ua);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();
  const geo = await getGeoInfo(ip);

  const sw = parseInt(req.query.sw);
  const sh = parseInt(req.query.sh);
  const dpr = parseFloat(req.query.dpr);

  const entry = {
    ip,
    time: new Date().toISOString(),
    device: device.type || 'desktop',
    deviceModel: identifyModel(device.vendor, device.model, os.name, sw, sh, dpr),
    browser: `${browser.name || '?'} ${browser.version || ''}`,
    os: `${os.name || '?'} ${os.version || ''}`,
    country: geo.country,
    city: geo.city,
    isp: geo.isp,
    referrer: req.headers['referer'] || '-',
    source,
  };

  visitors.unshift(entry);
  if (visitors.length > 5000) visitors.length = 5000;
  saveVisitors();
}

app.get('/api/track', async (req, res) => {
  await logVisit(req, 'github-pages');
  res.json({ ok: true });
});

app.use(async (req, res, next) => {
  if (req.path.startsWith('/admin') || req.path.startsWith('/api')) return next();
  if (req.path !== '/' && !req.path.startsWith('/index.html')) return next();
  await logVisit(req, 'direct');
  next();
});

function basicAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) {
    res.setHeader('WWW-Authenticate', 'Basic realm="YKS Sayaç Admin"');
    return res.status(401).send('Yetkisiz erişim');
  }
  const base64 = auth.split(' ')[1];
  const decoded = Buffer.from(base64, 'base64').toString('utf-8');
  const [user, pass] = decoded.split(':');
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    return next();
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="YKS Sayaç Admin"');
  return res.status(401).send('Hatalı giriş');
}

app.get('/admin', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/api/visitors', basicAuth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const search = (req.query.search || '').toLowerCase();
  const filterDevice = req.query.device || '';

  let filtered = visitors;
  if (search) {
    filtered = filtered.filter(v =>
      v.ip.toLowerCase().includes(search) ||
      v.country.toLowerCase().includes(search) ||
      v.city.toLowerCase().includes(search) ||
      v.browser.toLowerCase().includes(search) ||
      v.os.toLowerCase().includes(search) ||
      v.isp.toLowerCase().includes(search) ||
      (v.deviceModel && v.deviceModel.toLowerCase().includes(search))
    );
  }
  if (filterDevice) {
    filtered = filtered.filter(v => v.device === filterDevice);
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  res.json({ data, total, page, totalPages });
});

app.get('/api/stats', basicAuth, (req, res) => {
  const total = visitors.length;
  const uniqueIPs = new Set(visitors.map(v => v.ip)).size;
  const deviceStats = {};
  const countryStats = {};
  const browserStats = {};

  visitors.forEach(v => {
    deviceStats[v.device] = (deviceStats[v.device] || 0) + 1;
    countryStats[v.country] = (countryStats[v.country] || 0) + 1;
    const b = v.browser.split(' ')[0];
    browserStats[b] = (browserStats[b] || 0) + 1;
  });

  res.json({ total, uniqueIPs, deviceStats, countryStats, browserStats });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`YKS Sayaç sunucu başlatıldı: http://localhost:${PORT}`);
  console.log(`Admin paneli: http://localhost:${PORT}/admin`);
  console.log(`Kullanıcı: ${ADMIN_USER} / Şifre: ${ADMIN_PASS}`);
});
