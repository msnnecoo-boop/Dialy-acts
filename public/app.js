const $ = id => document.getElementById(id);
const paper = $('paper');
const machine = document.querySelector('.machine');
const grid = $('print-grid');
const capacities = { small: 12, pair: 2, half: 2, full: 1 };
const pages = [];
let current = null;
let startTimer;
let socket;
function safeAvatar(url) { try { const u = new URL(url); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } }
function element(tag, className, value) { const el = document.createElement(tag); el.className = className; if (value !== undefined) el.textContent = value; return el; }
function card(item) {
  const el = element('article', 'print-card');
  const effect = element('div', 'gift-effect', item.tier === 'full' ? '✦ 👑 ✦' : '✧ ✦ ✧');
  effect.setAttribute('aria-hidden', 'true');
  const portrait = element('div', 'card-portrait');
  const initial = element('div', 'card-initial', Array.from(item.nickname || item.id || '♥')[0].toUpperCase());
  portrait.append(initial);
  const src = safeAvatar(item.avatar);
  if (src) { const img = element('img', 'card-avatar'); img.alt = item.nickname || item.id; img.src = src; img.onerror = () => img.remove(); portrait.append(img); }
  const name = element('div', 'card-name', item.nickname || item.id); name.dir = 'auto';
  const coins = item.totalCoins === null || item.totalCoins === undefined ? 'Gift received' : `${item.totalCoins.toLocaleString()} COINS`;
  el.append(effect, portrait, name, element('div', 'card-handle', '@' + (item.id || 'viewer')), element('div', 'card-gift', `${item.giftName || 'Gift'} ×${item.repeatCount || 1}`), element('div', 'card-coins', coins));
  return el;
}
function queueStatus() { $('queue').textContent = `Queue: ${pages.reduce((n,p) => n + p.items.length, 0)}`; }
function next() {
  startTimer = null;
  if (!pages.length) { current = null; queueStatus(); return; }
  current = pages.shift();
  grid.replaceChildren(); grid.dataset.tier = current.tier;
  paper.classList.remove('printing', 'printed'); machine.classList.remove('is-printing');
  for (const item of current.items) grid.append(card(item));
  void paper.offsetWidth;
  paper.classList.add('printing'); machine.classList.add('is-printing');
  queueStatus();
  setTimeout(() => { machine.classList.remove('is-printing'); paper.classList.remove('printing'); paper.classList.add('printed'); current = null; next(); }, current.tier === 'small' ? 12000 : 9000);
}
function enqueue(item) {
  item.tier = capacities[item.tier] ? item.tier : 'small';
  if (current && current.tier === item.tier && current.items.length < capacities[item.tier] && !pages.length) {
    current.items.push(item); grid.append(card(item)); return;
  }
  const last = pages.at(-1);
  if (last && last.tier === item.tier && last.items.length < capacities[item.tier]) last.items.push(item);
  else { if (pages.length >= 50) pages.shift(); pages.push({ tier: item.tier, items: [item] }); }
  queueStatus();
  if (!current && !startTimer) startTimer = setTimeout(next, 700);
}
function demo(tier = 'small', batch = false) { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'demo', tier, batch })); }
function connect() {
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`);
  socket.onmessage = ev => { try { const m = JSON.parse(ev.data); if (m.type === 'gift') enqueue(m); if (m.type === 'status') { $('status').textContent = m.status + (m.demo ? ' • D: test gifts' : ''); $('demo-button').hidden = !m.demo; } } catch (err) { console.error('Overlay message failed', err); } };
  socket.onclose = () => { $('status').textContent = 'Reconnecting overlay...'; setTimeout(connect, 2500); };
}
connect();
document.addEventListener('keydown', ev => { if (ev.key.toLowerCase() === 'd' && !ev.repeat) demo('small', true); });
$('demo-button').addEventListener('click', ev => { const button = ev.target.closest('button[data-tier]'); if (button) demo(button.dataset.tier, button.dataset.batch === 'true'); });
const params = new URLSearchParams(location.search);
if (params.get('clean') === '1') document.querySelector('.bottom').hidden = true;
if (params.get('transparent') === '1') document.documentElement.classList.add('transparent');
