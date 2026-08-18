// Deterministic frame capture: seek the sim to each frame time, screenshot,
// then assemble with ffmpeg. Never records in real time — the paint-timing bug
// noted in HANDOFF-11 §9 makes realtime capture drop large background images.
// Usage: node capture.mjs <out.mp4> [--fps=25] [--w=960] [--max=20]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = '/home/claude/preview/www';
const args = process.argv.slice(2);
const out = args[0] || '/home/claude/preview/out.mp4';
const val = (n, d) => { const a = args.find((x) => x.startsWith('--' + n + '=')); return a ? Number(a.split('=')[1]) : d; };
const FPS = val('fps', 25), WIDTH = val('w', 960), MAXS = val('max', 0);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' };

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let p = path.join(ROOT, url === '/' ? '/render.html' : url);
    const real = fs.realpathSync(p);
    const body = await readFile(real);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(real).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;

const frames = '/home/claude/preview/.frames';
await rm(frames, { recursive: true, force: true });
await mkdir(frames, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, args: ['--force-device-scale-factor=1'] });
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'meta.json'), 'utf8'));
const page = await browser.newPage({ viewport: { width: WIDTH, height: Math.round(WIDTH * 9 / 16) + 4 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/render.html?w=${WIDTH}`);
await page.waitForFunction('window.__ready === true', { timeout: 60000 });

const duration = await page.evaluate('window.__duration');
const total = MAXS > 0 ? Math.min(duration, MAXS) : duration;
const n = Math.max(1, Math.round(total * FPS));
console.log(`duration ${duration.toFixed(2)}s -> capturing ${total.toFixed(2)}s @ ${FPS}fps = ${n} frames`);

const el = await page.$('#mount > div');
for (let i = 0; i < n; i++) {
  const t = i / FPS;
  await page.evaluate((tt) => window.seek(tt), t);
  await page.evaluate(() => window.settle());
  await el.screenshot({ path: path.join(frames, `f${String(i).padStart(5, '0')}.png`) });
}
await browser.close();
server.close();

execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(frames, 'f%05d.png'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
  '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', out], { stdio: 'pipe' });
console.log('wrote', out, fs.statSync(out).size, 'bytes');
if (errs.length) console.log('PAGE ERRORS:\n' + [...new Set(errs)].slice(0, 10).join('\n'));
