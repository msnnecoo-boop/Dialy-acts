import 'dotenv/config';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, access, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function extractTunnelUrl(text) {
  return String(text).match(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)+\.trycloudflare\.com\b/i)?.[0] || null;
}
export function verifyDownload(bytes, digest) {
  if (!/^sha256:[a-f0-9]{64}$/i.test(digest || '')) throw new Error('The official release has no SHA-256 digest. Install cloudflared from Cloudflare documentation instead.');
  if (`sha256:${createHash('sha256').update(bytes).digest('hex')}` !== digest.toLowerCase()) throw new Error('Cloudflared checksum mismatch; download was not installed.');
}
const ROOT = path.dirname(fileURLToPath(import.meta.url));
async function downloadCloudflared() {
  const installed = spawnSync('cloudflared', ['--version'], { encoding: 'utf8', windowsHide: true });
  if (installed.status === 0) return 'cloudflared';
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Install cloudflared for your operating system from https://developers.cloudflare.com/tunnel/downloads/ then run this command again.');
  const toolsDir = path.join(ROOT, 'tools');
  await mkdir(toolsDir, { recursive: true });
  const binary = path.join(toolsDir, 'cloudflared.exe');
  const metadata = path.join(toolsDir, 'cloudflared.sha256');
  try { const bytes = await readFile(binary); verifyDownload(bytes, (await readFile(metadata, 'utf8')).trim()); return binary; } catch {}
  console.log('Downloading cloudflared from the official Cloudflare GitHub release...');
  const releaseResponse = await fetch('https://api.github.com/repos/cloudflare/cloudflared/releases/latest', { headers: { 'User-Agent': 'Live-Printer-Direct-Link' }, signal: AbortSignal.timeout(30000) });
  if (!releaseResponse.ok) throw new Error(`Cannot read Cloudflare release: HTTP ${releaseResponse.status}`);
  const release = await releaseResponse.json();
  const asset = release.assets?.find(a => a.name === 'cloudflared-windows-amd64.exe');
  if (!asset?.browser_download_url?.startsWith('https://github.com/cloudflare/cloudflared/')) throw new Error('The official Windows download could not be found.');
  // Refuse unverifiable binaries before downloading anything executable.
  if (!/^sha256:[a-f0-9]{64}$/i.test(asset.digest || '')) throw new Error('The official release has no SHA-256 digest. Install cloudflared manually from Cloudflare documentation.');
  const response = await fetch(asset.browser_download_url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Cannot download cloudflared: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  verifyDownload(bytes, asset.digest);
  await writeFile(binary, bytes); await writeFile(metadata, asset.digest);
  await chmod(binary, 0o700);
  return binary;
}
export async function main() {
  const port = Number(process.env.PORT || 3100);
  const username = (process.env.TIKTOK_USERNAME || 'familydramaaf').replace(/^@/, '');
  const local = `http://127.0.0.1:${port}`;
  let serverProcess, tunnel;
  const stop = () => { tunnel?.kill(); serverProcess?.kill(); };
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stop(); process.exit(0); });
  async function health() { try { const r = await fetch(`${local}/health`, { signal: AbortSignal.timeout(1000) }); if (!r.ok) return null; return await r.json(); } catch { return null; } }
  try {
    let state = await health();
    if (state && (state.username !== username || state.demo !== false || state.build !== 'atelier-1')) throw new Error(`Port ${port} is running another account, DEMO, or an older printer version. Stop that printer with Ctrl+C first. No process was terminated.`);
    if (!state) {
      serverProcess = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), TIKTOK_USERNAME: username, DEMO_MODE: 'false', EXTENDED_GIFT_INFO: 'false' }, stdio: 'inherit' });
      for (let i = 0; i < 80; i++) { if (serverProcess.exitCode !== null) break; state = await health(); if (state) break; await new Promise(r => setTimeout(r, 100)); }
      if (!state) throw new Error(`The printer did not start on port ${port}. Check the server error above.`);
    }
    console.log(`Direct link for @${username}. This exposes the overlay through a temporary public HTTPS URL.`);
    const executable = await downloadCloudflared();
    tunnel = spawn(executable, ['--no-autoupdate', 'tunnel', '--url', local, '--protocol', 'http2'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = '', linkSaved = false;
    const onData = chunk => {
      const line = chunk.toString(); output = (output + line).slice(-20000);
      process.stdout.write(line);
      const url = extractTunnelUrl(output);
      if (url && !linkSaved) {
        linkSaved = true;
        const link = `${url}/overlay?clean=1`;
        writeFile(path.join(ROOT, 'DIRECT-LINK.txt'), link + '\n').catch(e => console.error('Cannot save link:', e.message));
        console.log(`\n========== TIKTOK LINK ==========\n${link}\n================================\nPaste into LIVE Studio > Add source > Link. Custom resolution: 1080 x 1200 with video below, or 1080 x 1920 for a full scene.\nSetup and copy link: ${url}/setup\nKeep this window open. The URL changes after restarting the tunnel.\n`);
      }
    };
    tunnel.stdout.on('data', onData); tunnel.stderr.on('data', onData);
    await new Promise((resolve, reject) => { tunnel.on('error', reject); tunnel.on('exit', code => code === 0 ? resolve() : reject(new Error(`Cloudflared stopped (exit ${code}).`))); });
  } finally { stop(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(err => { console.error('DIRECT LINK:', err.message); process.exitCode = 1; });
