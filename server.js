import { liveOptions, requiresProviderAccess } from './connection.js';
import { normalizeGift, isPendingStreak } from './gifts.js';
import 'dotenv/config';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const USERNAME = (process.env.TIKTOK_USERNAME || 'familydramaaf').replace(/^@/, '');
const PORT = Number(process.env.PORT || 3100);
const DEMO = process.env.DEMO_MODE === 'true';
const server = http.createServer(async (req, res) => {
  const route = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  if (route === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ connected, status: lastStatus, username: USERNAME, demo: DEMO })); return; }
  const files = { '/': 'index.html', '/overlay': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css' };
  const file = files[route];
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const content = await readFile(path.join(ROOT, file));
    res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'application/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(content);
  } catch { res.writeHead(500); res.end('Unable to load'); }
});
const wss = new WebSocketServer({ server });
wss.on('error', err => console.error(`[Overlay] ${err.code || 'ERROR'}: ${err.message}`));
let connected = false;
let lastStatus = 'Starting';
function send(payload) {
  const msg = JSON.stringify(payload);
  for (const ws of wss.clients) if (ws.readyState === WebSocket.OPEN) ws.send(msg);
}
wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'status', connected, status: lastStatus, username: USERNAME, demo: DEMO }));
  ws.on('message', data => {
    // Demo is restricted to the local host; external viewers cannot trigger fake gifts.
    if (!DEMO) return;
    try {
      const m = JSON.parse(data);
      if (m.type !== 'demo') return;
      const coins = ({ full: 500, half: 100, pair: 10, small: 1 })[m.tier] || 1;
      const count = m.batch === true ? (coins === 1 ? 6 : 2) : 1;
      for (let i = 0; i < count; i++) emitGift({ uniqueId: count === 1 ? 'demo_viewer' : `demo_viewer_${i + 1}`, nickname: count === 1 ? 'Demo Viewer' : `Viewer ${i + 1}`, profilePictureUrl: '', giftName: coins === 1 ? 'Rose' : 'Demo Gift', diamondCount: coins, repeatCount: 1, giftId: 5655 });
    } catch {}
  });
});
function status(message, isConnected = false) { connected = isConnected; lastStatus = message; console.log('[TikTok]', message); send({ type: 'status', connected, status: message, username: USERNAME, demo: DEMO }); }
const recent = new Map();
function emitGift(evt) {
  const key = evt.event?.msgId || evt.msgId || null;
  const now = Date.now();
  if (key && recent.has(key)) return;
  if (key) recent.set(key, now);
  if (recent.size > 500) for (const [k, t] of recent) if (now - t > 60000) recent.delete(k);
  const gift = normalizeGift(evt, now);
  send(gift);
  console.log(`[Gift] ${gift.nickname} → ${gift.giftName} x${gift.repeatCount}`);
}
if (!DEMO) {
  const live = new TikTokLiveConnection(USERNAME, liveOptions());
  let reconnectTimer;
  let retry = 0;
  let stopping = false;
  let providerBlocked = false;
  async function connect() {
    if (stopping) return;
    try {
      status(`Connecting to @${USERNAME}...`);
      await live.connect();
      retry = 0;
      status(`Connected to @${USERNAME}`, true);
    } catch (err) {
      if (requiresProviderAccess(err)) {
        providerBlocked = true; clearTimeout(reconnectTimer); reconnectTimer = null;
        status('Provider access required. Automatic retries paused. Check SIGN_API_KEY / provider permissions, then restart.');
      } else { status(`Not connected: ${err.message || err}`); schedule(); }
    }
  }
  function schedule() {
    if (reconnectTimer || stopping || providerBlocked) return;
    const wait = Math.min(60000, 3000 * 2 ** Math.min(retry++, 4));
    reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, wait);
  }
  live.on(WebcastEvent.GIFT, event => {
    // Streak gifts emit updates; print only after the streak is finished.
    if (isPendingStreak(event)) return;
    emitGift(event);
  });
  live.on(ControlEvent.DISCONNECTED, () => { status('Disconnected — reconnecting'); schedule(); });
  live.on(ControlEvent.ERROR, err => { status(`Connection error: ${err?.message || err?.info || 'TikTok unavailable'}`); });
  live.on(WebcastEvent.STREAM_END, () => { status('Live ended — waiting to reconnect'); schedule(); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; clearTimeout(reconnectTimer); live.disconnect(); for (const ws of wss.clients) ws.terminate(); wss.close(); server.close(); });
  server.listen(PORT, '127.0.0.1', () => { console.log(`Overlay: http://localhost:${PORT}/overlay`); connect(); });
} else {
  server.listen(PORT, '127.0.0.1', () => status(`Demo mode at http://localhost:${PORT}/overlay`, false));
}

server.on('error', err => { console.error(`Server could not start: ${err.message}. Check whether port ${PORT} is already in use.`); process.exitCode = 1; });
