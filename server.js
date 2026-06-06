const express = require('express');
const fs = require('fs');
const path = require('path');
const UAParser = require('ua-parser-js');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const VISITORS_FILE = path.join(__dirname, 'visitors.json');
const VISITORS_SPOTIFY_FILE = path.join(__dirname, 'visitors-spotify.json');
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'yks2026';
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

let visitors = [];
if (fs.existsSync(VISITORS_FILE)) {
  try {
    visitors = JSON.parse(fs.readFileSync(VISITORS_FILE, 'utf-8'));
  } catch (e) {
    visitors = [];
  }
}

let visitorsSpotify = [];
if (fs.existsSync(VISITORS_SPOTIFY_FILE)) {
  try {
    visitorsSpotify = JSON.parse(fs.readFileSync(VISITORS_SPOTIFY_FILE, 'utf-8'));
  } catch (e) {
    visitorsSpotify = [];
  }
}

const geoCache = {};

const MODEL_MAP = {
  'iPhone12,1': 'iPhone 11', 'iPhone12,3': 'iPhone 11 Pro', 'iPhone12,5': 'iPhone 11 Pro Max',
  'iPhone12,8': 'iPhone SE 2', 'iPhone13,1': 'iPhone 12 mini', 'iPhone13,2': 'iPhone 12',
  'iPhone13,3': 'iPhone 12 Pro', 'iPhone13,4': 'iPhone 12 Pro Max',
  'iPhone14,2': 'iPhone 13 Pro', 'iPhone14,3': 'iPhone 13 Pro Max',
  'iPhone14,4': 'iPhone 13 mini', 'iPhone14,5': 'iPhone 13', 'iPhone14,6': 'iPhone SE 3',
  'iPhone14,7': 'iPhone 14', 'iPhone14,8': 'iPhone 14 Plus',
  'iPhone15,2': 'iPhone 14 Pro', 'iPhone15,3': 'iPhone 14 Pro Max',
  'iPhone15,4': 'iPhone 15', 'iPhone15,5': 'iPhone 15 Plus',
  'iPhone16,1': 'iPhone 15 Pro', 'iPhone16,2': 'iPhone 15 Pro Max',
  'iPhone17,1': 'iPhone 16 Pro Max', 'iPhone17,2': 'iPhone 16 Pro',
  'iPhone17,3': 'iPhone 16 Plus', 'iPhone17,4': 'iPhone 16',
  'iPhone17,5': 'iPhone SE 4',

  'SM-S938B': 'Galaxy S25 Ultra', 'SM-S938U': 'Galaxy S25 Ultra', 'SM-S938N': 'Galaxy S25 Ultra',
  'SM-S937B': 'Galaxy S25+', 'SM-S936B': 'Galaxy S25', 'SM-S931B': 'Galaxy S25',
  'SM-S932B': 'Galaxy S25+',
  'SM-S928B': 'Galaxy S24 Ultra', 'SM-S928U': 'Galaxy S24 Ultra',
  'SM-S927B': 'Galaxy S24+', 'SM-S926B': 'Galaxy S24', 'SM-S921B': 'Galaxy S24',
  'SM-S926U': 'Galaxy S24',
  'SM-S918B': 'Galaxy S23 Ultra', 'SM-S918U': 'Galaxy S23 Ultra',
  'SM-S917B': 'Galaxy S23+', 'SM-S916B': 'Galaxy S23', 'SM-S911B': 'Galaxy S23',
  'SM-S908B': 'Galaxy S22 Ultra', 'SM-S906B': 'Galaxy S22+', 'SM-S901B': 'Galaxy S22',
  'SM-N986B': 'Galaxy Note 20 Ultra', 'SM-N981B': 'Galaxy Note 20',
  'SM-F958B': 'Galaxy Z Fold 7', 'SM-F956B': 'Galaxy Z Fold 6',
  'SM-F958U': 'Galaxy Z Fold 7', 'SM-F956U': 'Galaxy Z Fold 6',
  'SM-F946B': 'Galaxy Z Fold 5', 'SM-F936B': 'Galaxy Z Fold 4', 'SM-F926B': 'Galaxy Z Fold 3',
  'SM-F741B': 'Galaxy Z Flip 7', 'SM-F721B': 'Galaxy Z Flip 6',
  'SM-F731B': 'Galaxy Z Flip 5', 'SM-F721B': 'Galaxy Z Flip 4', 'SM-F711B': 'Galaxy Z Flip 3',
  'SM-A556B': 'Galaxy A55', 'SM-A546B': 'Galaxy A54', 'SM-A536B': 'Galaxy A53',
  'SM-A356E': 'Galaxy A35', 'SM-A346B': 'Galaxy A34',
  'SM-A256E': 'Galaxy A25', 'SM-A156E': 'Galaxy A15', 'SM-A055F': 'Galaxy A05',
  'SM-A155F': 'Galaxy A15', 'SM-A145F': 'Galaxy A14',

  'CPH2449': 'OnePlus 12', 'CPH2447': 'OnePlus 12R', 'CPH2581': 'OnePlus 13',
  'CPH2413': 'OnePlus 11', 'CPH2399': 'OnePlus 10T', 'CPH2451': 'OnePlus Open',
  'CPH2551': 'OnePlus 13',

  'Pixel 9 Pro': 'Pixel 9 Pro', 'Pixel 9': 'Pixel 9', 'Pixel 9 Pro XL': 'Pixel 9 Pro XL',
  'Pixel 8 Pro': 'Pixel 8 Pro', 'Pixel 8': 'Pixel 8', 'Pixel 8a': 'Pixel 8a',
  'Pixel 7 Pro': 'Pixel 7 Pro', 'Pixel 7': 'Pixel 7', 'Pixel 7a': 'Pixel 7a',
  'Pixel 6 Pro': 'Pixel 6 Pro', 'Pixel 6': 'Pixel 6', 'Pixel 6a': 'Pixel 6a',
  'Pixel Fold': 'Pixel Fold', 'Pixel 9 Pro Fold': 'Pixel 9 Pro Fold',

  '23127PN0CC': 'Xiaomi 14', '2312DRAABC': 'Xiaomi 14 Ultra',
  '24031PN0DC': 'Xiaomi 14 Pro', '2312DRA51C': 'Xiaomi 14 Pro',
  '22122RN99G': 'Xiaomi 13T', '2308CPXD0C': 'Xiaomi 13 Lite',
  '2210132G': 'Xiaomi 12T',
};

const APPLE_DEVICES = [
  { match: '320x568@2', model: 'iPhone SE 1', osRange: [9, 10, 11, 12] },
  { match: '375x667@2', model: 'iPhone 6s/7/8/SE 2/3', osRange: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18] },
  { match: '414x736@3', model: 'iPhone 6s/7/8 Plus', osRange: [9, 10, 11, 12, 13, 14, 15] },
  { match: '375x812@3', model: 'iPhone X', osRange: [11, 12] },
  { match: '375x812@3', model: 'iPhone XS', osRange: [12, 13, 14] },
  { match: '375x812@3', model: 'iPhone 11 Pro', osRange: [13, 14, 15, 16, 17, 18] },
  { match: '414x896@2', model: 'iPhone XR', osRange: [12, 13, 14, 15] },
  { match: '414x896@2', model: 'iPhone 11', osRange: [13, 14, 15, 16, 17, 18] },
  { match: '414x896@3', model: 'iPhone XS Max', osRange: [12, 13, 14] },
  { match: '414x896@3', model: 'iPhone 11 Pro Max', osRange: [13, 14, 15, 16, 17, 18] },
  { match: '360x780@3', model: 'iPhone 12 mini', osRange: [14] },
  { match: '360x780@3', model: 'iPhone 13 mini', osRange: [15, 16, 17, 18] },
  { match: '390x844@3', model: 'iPhone 12', osRange: [14] },
  { match: '390x844@3', model: 'iPhone 13', osRange: [15] },
  { match: '390x844@3', model: 'iPhone 14', osRange: [16, 17, 18] },
  { match: '428x926@3', model: 'iPhone 12 Pro Max', osRange: [14] },
  { match: '428x926@3', model: 'iPhone 13 Pro Max', osRange: [15] },
  { match: '428x926@3', model: 'iPhone 14 Plus', osRange: [16, 17, 18] },
  { match: '393x852@3', model: 'iPhone 14 Pro', osRange: [16] },
  { match: '393x852@3', model: 'iPhone 15 / 15 Pro', osRange: [17] },
  { match: '393x852@3', model: 'iPhone 16', osRange: [18] },
  { match: '430x932@3', model: 'iPhone 14 Pro Max', osRange: [16] },
  { match: '430x932@3', model: 'iPhone 15 / 15 Pro Max', osRange: [17] },
  { match: '430x932@3', model: 'iPhone 16 Plus', osRange: [18] },
  { match: '402x874@3', model: 'iPhone 16 Pro', osRange: [18] },
  { match: '440x956@3', model: 'iPhone 16 Pro Max', osRange: [18] },
  { match: '744x1133@2', model: 'iPad Mini 6' },
  { match: '820x1180@2', model: 'iPad Air 4/5 / iPad 10' },
  { match: '834x1194@2', model: 'iPad Pro 11' },
  { match: '1024x1366@2', model: 'iPad Pro 12.9' },
  { match: '810x1080@2', model: 'iPad 9' },
];

const ANDROID_DEVICES = [
  { match: '412x892@3.5', model: 'Galaxy S25 Ultra' },
  { match: '412x892@3.5', model: 'Galaxy S24 Ultra' },
  { match: '412x892@3.5', model: 'Galaxy S23 Ultra' },
  { match: '393x830@3.5', model: 'Galaxy S24+' },
  { match: '360x780@3', model: 'Galaxy S24 / S23 / S22' },
  { match: '360x740@3', model: 'Galaxy A55 / A54 / A35' },
  { match: '412x915@3.5', model: 'Pixel 9 Pro XL' },
  { match: '412x832@3.5', model: 'Pixel 9 Pro' },
  { match: '412x830@3.5', model: 'Pixel 9' },
  { match: '412x846@3.5', model: 'Pixel 8 Pro' },
  { match: '412x830@3.5', model: 'Pixel 8' },
];

function identifyModel(vendor, model, os, sw, sh, dpr, exactModel) {
  if (exactModel && MODEL_MAP[exactModel]) return MODEL_MAP[exactModel];
  if (exactModel) return exactModel;
  if (vendor === 'Apple' && sw && sh && dpr) {
    const key = `${sw}x${sh}@${Math.round(dpr)}`;
    const osMajor = os ? parseInt(os) : 0;
    const match = APPLE_DEVICES.find(d => d.match === key && (!d.osRange || d.osRange.includes(osMajor)));
    if (match) return match.model;
    return `iPhone (${key})`;
  }
  if (vendor && sw && sh && dpr) {
    const key = `${sw}x${sh}@${dpr.toFixed(1)}`;
    const androidMatch = ANDROID_DEVICES.find(d => d.match === key);
    if (androidMatch) return androidMatch.model;
  }
  return [vendor, model].filter(Boolean).join(' ') || '-';
}

function saveVisitors() {
  fs.writeFileSync(VISITORS_FILE, JSON.stringify(visitors, null, 2), 'utf-8');
}
function saveVisitorsSpotify() {
  fs.writeFileSync(VISITORS_SPOTIFY_FILE, JSON.stringify(visitorsSpotify, null, 2), 'utf-8');
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

async function sendDiscordNotification(entry, title = 'YKS Sayac Login') {
  if (!DISCORD_WEBHOOK_URL) return;
  const flag = entry.country === 'Turkey' || entry.country === 'Türkiye' ? '🇹🇷' : '🌍';
  try {
    await axios.post(DISCORD_WEBHOOK_URL, {
      embeds: [{
        title,
        color: title.includes('Spotify') ? 0x1DB954 : 0xf5c518,
        fields: [
          { name: '📍 Konum', value: `${flag} ${entry.city}, ${entry.country}`, inline: true },
          { name: '🆔 IP', value: entry.ip, inline: true },
          { name: '📱 Cihaz', value: `${entry.deviceModel || '-'}`, inline: true },
          { name: '💻 İşletim Sistemi', value: entry.os, inline: true },
          { name: '🌐 Tarayıcı', value: entry.browser, inline: true },
          { name: '🔌 ISS', value: entry.isp, inline: true },
          { name: '🔗 Yönlendiren', value: entry.referrer?.substring(0, 50) || '-', inline: true },
          { name: '⏰ Tarih', value: new Date(entry.time).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour12: false }), inline: true },
        ],
        footer: { text: title === 'Spotify Stalkeri !!!' ? 'Spotify Stalker · 37xw' : 'YKS Sayac Login · 37xw' },
        timestamp: entry.time,
      }]
    });
  } catch (e) {
    console.error('Discord webhook error:', e.message);
  }
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
    deviceModel: identifyModel(device.vendor, device.model, os.version, sw, sh, dpr, req.query.exact_model),
    browser: `${browser.name || '?'} ${browser.version || ''}`,
    os: `${os.name || '?'} ${os.version || ''}`,
    country: geo.country,
    city: geo.city,
    isp: geo.isp,
    referrer: req.headers['referer'] || '-',
  };

  visitors.unshift(entry);
  if (visitors.length > 5000) visitors.length = 5000;
  saveVisitors();
  sendDiscordNotification(entry);
}

app.get('/api/track', async (req, res) => {
  await logVisit(req, 'github-pages');
  res.json({ ok: true });
});

app.get('/api/track-spotify', async (req, res) => {
  await logSpotifyVisit(req);
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

app.delete('/api/visitors', basicAuth, (req, res) => {
  visitors = [];
  saveVisitors();
  res.json({ ok: true, message: 'Tüm kayıtlar silindi.' });
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

const SPOTIFY_PROFILE_URL = 'https://open.spotify.com/user/zx9oehv0zw9qx96qowlby0ktl';

async function logSpotifyVisit(req) {
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
    deviceModel: identifyModel(device.vendor, device.model, os.version, sw, sh, dpr, req.query.exact_model),
    browser: `${browser.name || '?'} ${browser.version || ''}`,
    os: `${os.name || '?'} ${os.version || ''}`,
    country: geo.country,
    city: geo.city,
    isp: geo.isp,
    referrer: req.headers['referer'] || '-',
  };

  visitorsSpotify.unshift(entry);
  if (visitorsSpotify.length > 5000) visitorsSpotify.length = 5000;
  saveVisitorsSpotify();
  sendDiscordNotification({ ...entry, source: 'spotify' }, 'Spotify Stalkeri !!!');
}

app.get('/37', async (req, res) => {
  await logSpotifyVisit(req);
  res.redirect(302, SPOTIFY_PROFILE_URL);
});

app.get('/admin/spotify', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-spotify.html'));
});

app.get('/api/visitors-spotify', basicAuth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const search = (req.query.search || '').toLowerCase();
  const filterDevice = req.query.device || '';

  let filtered = visitorsSpotify;
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

app.delete('/api/visitors-spotify', basicAuth, (req, res) => {
  visitorsSpotify = [];
  saveVisitorsSpotify();
  res.json({ ok: true, message: 'Spotify kayıtları silindi.' });
});

app.get('/api/stats-spotify', basicAuth, (req, res) => {
  const total = visitorsSpotify.length;
  const uniqueIPs = new Set(visitorsSpotify.map(v => v.ip)).size;
  const deviceStats = {};
  const countryStats = {};
  const browserStats = {};

  visitorsSpotify.forEach(v => {
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
