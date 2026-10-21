const $ = id => document.getElementById(id);
const paper = $('paper');
const machine = document.querySelector('.machine');
const grid = $('print-grid');
const capacities = { small: 4, pair: 2, half: 2, full: 1 };
const pages = [];
let current = null;
let displayedPage = null;
const seenPrints = new Map();
let motionTimer;
let pageTimer;
let socket;
function safeAvatar(url) { try { const u = new URL(url); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } }
function element(tag, className, value) { const el = document.createElement(tag); el.className = className; if (value !== undefined) el.textContent = value; return el; }
function designMark(kind) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64'); svg.setAttribute('class', 'design-mark'); svg.setAttribute('aria-hidden', 'true');
  const shapes = kind === 'full'
    ? ['M8 20 21 30 32 12 43 30 56 20 49 47H15Z', 'M17 53H47', 'M32 34V42']
    : ['M32 5 39 23 59 25 44 39 48 59 32 49 16 59 20 39 5 25 25 23Z', 'M25 32 30 38 40 26'];
  for (const d of shapes) { const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', d); svg.append(path); }
  return svg;
}
function card(item) {
  const el = element('article', 'print-card');
  el.dataset.tier = item.tier;
  if (item.printId) el.dataset.printId = item.printId;
  const effect = element('div', 'gift-effect', item.tier === 'full' ? 'LEGENDARY' : 'SUPER STAR');
  if (item.tier === 'full' || item.tier === 'half') effect.prepend(designMark(item.tier));
  else el.append(element('div', 'edition-badge', item.tier === 'pair' ? 'DUO / 02' : 'LIVE PRINT'));
  el.append(element('div', 'design-corners')); 
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
  if (src) { const img = element('img', 'card-avatar'); img.alt = item.nickname || item.id; img.decoding = 'async'; img.fetchPriority = 'high'; img.onload = () => { initial.hidden = true; }; img.src = src; img.onerror = () => { img.remove(); initial.hidden = false; }; portrait.append(img); }
  const name = element('div', 'card-name', item.nickname || item.id); name.dir = 'auto';
  const coins = item.totalCoins === null || item.totalCoins === undefined ? 'Gift received' : `${item.totalCoins.toLocaleString()} COINS`;
  el.append(effect, portrait, name, element('div', 'card-handle', '@' + (item.id || 'viewer')), element('div', 'card-gift', `${item.giftName || 'Gift'} ×${item.repeatCount || 1}`), element('div', 'card-coins', coins));
  return el;
}
function queueStatus() { $('queue').textContent = `Queue: ${pages.reduce((n,p) => n + p.items.length, 0)}`; }
function next() {
  if (!pages.length) { current = null; queueStatus(); return; }
  current = pages.shift();
  displayedPage = current;
  machine.dataset.tier = current.tier;
  grid.replaceChildren(); grid.dataset.tier = current.tier; grid.dataset.count = current.items.length;
  paper.classList.remove('printing', 'printed'); machine.classList.remove('is-printing');
  current.started = Date.now();
  for (const item of current.items) grid.append(card(item));
  if (current.tier === 'half' && current.items.length === 1) {
    const waiting = element('div', 'waiting-slot');
    waiting.append(element('div', 'waiting-symbol', '✧'), element('div', '', 'NEXT SUPER STAR'), element('small', '', '100+ COINS • YOUR SPOT IS READY'));
    grid.append(waiting);
  }
  void paper.offsetWidth;
  paper.classList.add('printing'); runPrinter();
  queueStatus();
  finishPage(({ small: 1500, pair: 1800, half: 2600, full: 3200 })[current.tier]);
}
function runPrinter() {
  if (machine.classList.contains('is-printing')) return;
  clearTimeout(motionTimer);
  machine.classList.remove('is-printing'); void machine.offsetWidth; machine.classList.add('is-printing');
  motionTimer = setTimeout(() => machine.classList.remove('is-printing'), 1150);
}
function finishPage(delay) {
  clearTimeout(pageTimer);
  current.deadline = Date.now() + delay;
  pageTimer = setTimeout(() => { paper.classList.remove('printing'); paper.classList.add('printed'); current = null; next(); }, delay);
}
function updatePrint(item) {
  const candidates = [...new Set([current, displayedPage, ...pages].filter(Boolean))];
  for (const page of candidates) {
    const index = page.items.findIndex(old => old.printId === item.printId);
    if (index < 0) continue;
    if (page.tier === item.tier) {
      page.items[index] = item;
      if (page === displayedPage) {
        const old = [...grid.querySelectorAll('.print-card')].find(el => el.dataset.printId === item.printId);
        old?.replaceWith(card(item)); runPrinter();
      }
      return true;
    }
    page.items.splice(index, 1);
    if (page === displayedPage) grid.dataset.count = page.items.length;
    if (page === displayedPage) [...grid.querySelectorAll('.print-card')].find(el => el.dataset.printId === item.printId)?.remove();
    if (!page.items.length) {
      const queuedIndex = pages.indexOf(page); if (queuedIndex >= 0) pages.splice(queuedIndex, 1);
      if (page === current) { clearTimeout(pageTimer); current = null; }
    }
    return false;
  }
  // Do not reprint a completed, no-longer-visible sheet for every count update.
  return seenPrints.get(item.printId) === item.tier;
}
function enqueue(item) {
  item.tier = capacities[item.tier] ? item.tier : 'small';
  if (item.printId && updatePrint(item)) return;
  if (item.printId) { seenPrints.set(item.printId, item.tier); if (seenPrints.size > 1000) seenPrints.delete(seenPrints.keys().next().value); }
  if (current && current.tier === item.tier && current.items.length < capacities[item.tier]) {
    current.items.push(item);
    grid.dataset.count = current.items.length;
    runPrinter();
    const waiting = grid.querySelector('.waiting-slot');
    if (waiting) waiting.replaceWith(card(item)); else grid.append(card(item));
    const deadline = Math.min(current.started + 4000, Math.max(current.deadline, Date.now() + 700));
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
    finishPage(Math.min(remaining, Math.max(250, current.started + (current.tier === 'full' ? 1200 : current.tier === 'half' ? 1000 : 650) - Date.now())));
  }
}
function demo(tier = 'small', batch = false) { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'demo', tier, batch })); }
function connect() {
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`);
  socket.onmessage = ev => { try { const m = JSON.parse(ev.data); if (m.type === 'gift' || m.type === 'gift-update') enqueue(m); if (m.type === 'status') { $('status').textContent = 'FAST XL • ' + m.status + (m.demo ? ' • D: test gifts' : ''); $('demo-button').hidden = !m.demo; const mode = m.demo ? 'DEMO • آزمایشی' : m.connected ? 'LIVE • متصل' : 'OFFLINE • قطع'; $('connection-indicator').textContent = mode; $('connection-indicator').dataset.state = m.demo ? 'demo' : m.connected ? 'live' : 'offline'; document.querySelector('.live-badge').textContent = mode; } } catch (err) { console.error('Overlay message failed', err); } };
  socket.onclose = () => { $('connection-indicator').textContent = 'OFFLINE • قطع'; $('connection-indicator').dataset.state = 'offline'; document.querySelector('.live-badge').textContent = 'OFFLINE'; $('demo-button').hidden = true; $('status').textContent = 'Reconnecting overlay...'; setTimeout(connect, 2500); };
}
connect();
document.addEventListener('keydown', ev => { if (ev.key.toLowerCase() === 'd' && !ev.repeat) demo('small', true); });
$('demo-button').addEventListener('click', ev => { const button = ev.target.closest('button[data-tier]'); if (button) demo(button.dataset.tier, button.dataset.batch === 'true'); });
const params = new URLSearchParams(location.search);
if (params.get('clean') === '1') { document.querySelector('.bottom').hidden = true; document.documentElement.classList.add('studio'); }
if (params.get('transparent') === '1') document.documentElement.classList.add('transparent');
