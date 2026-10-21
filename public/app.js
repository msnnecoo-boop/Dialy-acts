const $ = id => document.getElementById(id);
const paper = $('paper');
const machine = document.querySelector('.machine');
const grid = $('print-grid');
const capacities = { small: 6, pair: 2, half: 2, full: 1 };
const pages = [];
let current = null;
let pageTimer;
let socket;
function safeAvatar(url) { try { const u = new URL(url); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } }
function element(tag, className, value) { const el = document.createElement(tag); el.className = className; if (value !== undefined) el.textContent = value; return el; }
function card(item) {
  const el = element('article', 'print-card');
  el.dataset.tier = item.tier;
  const effect = element('div', 'gift-effect', item.tier === 'full' ? '👑 LEGENDARY' : '✦ SUPER STAR ✦');
  if (item.tier === 'half' || item.tier === 'full') {
    const particles = element('div', 'premium-particles'); particles.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 12; i++) { const star = element('span', '', i % 3 === 0 ? '✧' : '✦'); star.style.setProperty('--i', i); particles.append(star); }
    el.append(particles, element('div', 'premium-orbit'), element('div', 'premium-flash'));
  }
  effect.setAttribute('aria-hidden', 'true');
  const portrait = element('div', 'card-portrait');
  const initial = element('div', 'card-initial', Array.from(item.nickname || item.id || '♥')[0].toUpperCase());
  portrait.append(initial);
  const src = safeAvatar(item.avatar);
  if (src) { const img = element('img', 'card-avatar'); img.alt = item.nickname || item.id; img.decoding = 'async'; img.fetchPriority = 'high'; img.src = src; img.onerror = () => img.remove(); portrait.append(img); }
  const name = element('div', 'card-name', item.nickname || item.id); name.dir = 'auto';
  const coins = item.totalCoins === null || item.totalCoins === undefined ? 'Gift received' : `${item.totalCoins.toLocaleString()} COINS`;
  el.append(effect, portrait, name, element('div', 'card-handle', '@' + (item.id || 'viewer')), element('div', 'card-gift', `${item.giftName || 'Gift'} ×${item.repeatCount || 1}`), element('div', 'card-coins', coins));
  return el;
}
function queueStatus() { $('queue').textContent = `Queue: ${pages.reduce((n,p) => n + p.items.length, 0)}`; }
function next() {
  if (!pages.length) { current = null; queueStatus(); return; }
  current = pages.shift();
  grid.replaceChildren(); grid.dataset.tier = current.tier;
  paper.classList.remove('printing', 'printed'); machine.classList.remove('is-printing');
  current.started = Date.now();
  for (const item of current.items) grid.append(card(item));
  if (current.tier === 'half' && current.items.length === 1) {
    const waiting = element('div', 'waiting-slot');
    waiting.append(element('div', 'waiting-symbol', '✧'), element('div', '', 'NEXT SUPER STAR'), element('small', '', '100+ COINS • YOUR SPOT IS READY'));
    grid.append(waiting);
  }
  void paper.offsetWidth;
  paper.classList.add('printing'); machine.classList.add('is-printing');
  queueStatus();
  finishPage(({ small: 2000, pair: 2500, half: 3500, full: 4500 })[current.tier]);
}
function finishPage(delay) {
  clearTimeout(pageTimer);
  current.deadline = Date.now() + delay;
  pageTimer = setTimeout(() => { machine.classList.remove('is-printing'); paper.classList.remove('printing'); paper.classList.add('printed'); current = null; next(); }, delay);
}
function enqueue(item) {
  item.tier = capacities[item.tier] ? item.tier : 'small';
  if (current && current.tier === item.tier && current.items.length < capacities[item.tier]) {
    current.items.push(item);
    const waiting = grid.querySelector('.waiting-slot');
    if (waiting) waiting.replaceWith(card(item)); else grid.append(card(item));
    const deadline = Math.min(current.started + 6000, Math.max(current.deadline, Date.now() + 1000));
    finishPage(Math.max(0, deadline - Date.now()));
    return;
  }
  const last = pages.at(-1);
  if (last && last.tier === item.tier && last.items.length < capacities[item.tier]) last.items.push(item);
  else { if (pages.length >= 50) pages.shift(); pages.push({ tier: item.tier, items: [item] }); }
  queueStatus();
  if (!current) next();
  else {
    // Under load, finish the current sheet promptly while preserving a minimum viewing time.
    const remaining = Math.max(0, current.deadline - Date.now());
    finishPage(Math.min(remaining, Math.max(500, current.started + 1000 - Date.now())));
  }
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
