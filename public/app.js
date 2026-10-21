const $ = id => document.getElementById(id);
const paper = $('paper');
const queue = [];
let active = false;
let socket;
function safeAvatar(url) { try { const u = new URL(url); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } }
function render(item) {
  $('nickname').textContent = item.nickname || item.id;
  $('handle').textContent = '@' + (item.id || 'viewer');
  $('gift').textContent = '🎁 ' + (item.giftName || 'Gift');
  $('count').textContent = '×' + (item.repeatCount || 1);
  const src = safeAvatar(item.avatar);
  $('avatar').style.display = src ? 'block' : 'none';
  $('initials').style.display = src ? 'none' : 'flex';
  $('initials').textContent = (item.nickname || item.id || '♥').slice(0, 1).toUpperCase();
  $('avatar').onerror = () => { $('avatar').style.display = 'none'; $('initials').style.display = 'flex'; };
  if (src) $('avatar').src = src;
}
function next() {
  if (!queue.length) { active = false; $('queue').textContent = 'Queue: 0'; return; }
  active = true;
  const item = queue.shift();
  $('queue').textContent = 'Queue: ' + queue.length;
  paper.classList.remove('printing');
  paper.classList.add('reset');
  render(item);
  void paper.offsetWidth;
  paper.classList.remove('reset');
  paper.classList.add('printing');
  setTimeout(() => { paper.classList.remove('printing'); paper.classList.add('reset'); setTimeout(next, 450); }, 6800);
}
function enqueue(item) { if (queue.length >= 50) queue.shift(); queue.push(item); $('queue').textContent = 'Queue: ' + queue.length; if (!active) next(); }
function connect() {
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`);
  socket.onopen = () => { $('status').textContent = 'Overlay connected'; };
  socket.onmessage = ev => { try { const m = JSON.parse(ev.data); if (m.type === 'gift') enqueue(m); if (m.type === 'status') { $('status').textContent = m.status; $('demo-button').hidden = !m.demo; if (m.demo) { $('status').textContent += ' • Press D to test'; } } } catch {} };
  socket.onclose = () => { $('status').textContent = 'Reconnecting overlay...'; setTimeout(connect, 2500); };
}
connect();
document.addEventListener('keydown', ev => { if (ev.key.toLowerCase() === 'd' && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'demo' })); });

$('demo-button').addEventListener('click', () => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'demo' })); });
if (new URLSearchParams(location.search).get('clean') === '1') document.querySelector('.bottom').hidden = true;
