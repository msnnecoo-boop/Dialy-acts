import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
const port = 3199;
const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, DEMO_MODE: 'true', PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
child.stdout.on('data', d => logs += d);
child.stderr.on('data', d => logs += d);
let ws;
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    if (child.exitCode !== null) throw new Error(logs);
    try { ready = (await fetch(`http://127.0.0.1:${port}/health`)).ok; } catch {}
    if (ready) break;
    await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(ready, `Server did not start: ${logs}`);
  const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
  assert.equal(health.demo, true);
  for (const route of ['/overlay', '/app.js', '/style.css']) assert.equal((await fetch(`http://127.0.0.1:${port}${route}`)).status, 200);
  assert.equal((await fetch(`http://127.0.0.1:${port}/missing`)).status, 404);
  ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Gift timeout')), 5000);
    let gifts = 0;
    ws.on('error', reject);
    ws.on('message', raw => {
      try {
        const m = JSON.parse(raw);
        if (m.type === 'status') ws.send(JSON.stringify({ type: 'demo' }));
        if (m.type === 'gift') {
          assert.equal(m.id, 'demo_viewer');
          assert.equal(m.repeatCount, 1);
          if (++gifts === 1) ws.send(JSON.stringify({ type: 'demo' }));
          else { clearTimeout(timer); resolve(); }
        }
      } catch (err) { clearTimeout(timer); reject(err); }
    });
  });
  console.log('PASS: health, overlay assets, 404, WebSocket status, two consecutive gifts');
} finally {
  ws?.terminate();
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
  timer.unref();
}
