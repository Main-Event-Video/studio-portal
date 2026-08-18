// Quick visual review: seek to N evenly-spaced times and build one contact strip.
// Usage: node strip.mjs <label> [--n=12] [--from=0] [--to=0] [--w=480] [--cols=4]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs'; import path from 'node:path';
import { execFileSync } from 'node:child_process';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = '/home/claude/preview/www';
const args = process.argv.slice(2);
const label = args[0] || 'strip';
const val = (n, d) => { const a = args.find((x) => x.startsWith('--' + n + '=')); return a ? Number(a.split('=')[1]) : d; };
const N = val('n', 12), WIDTH = val('w', 480), COLS = val('cols', 4);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' };
const server = createServer(async (req, res) => {
  try {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const p = fs.realpathSync(path.join(ROOT, u === '/' ? '/render.html' : u));
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;

const dir = '/home/claude/preview/.strip';
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: WIDTH, height: Math.round(WIDTH * 9 / 16) + 4 } });
await page.goto(`http://127.0.0.1:${PORT}/render.html?w=${WIDTH}`);
await page.waitForFunction('window.__ready === true', { timeout: 60000 });
const dur = await page.evaluate('window.__duration');
const from = val('from', 0), to = val('to', 0) || dur;
const el = await page.$('#mount > div');
const times = [];
for (let i = 0; i < N; i++) times.push(from + (to - from) * (i / (N - 1 || 1)));
for (let i = 0; i < N; i++) {
  await page.evaluate((t) => window.seek(t), Math.min(times[i], dur - 0.001));
  await page.evaluate(() => window.settle());
  await el.screenshot({ path: path.join(dir, `s${String(i).padStart(3, '0')}.png`) });
}
await browser.close(); server.close();

const out = `/home/claude/preview/_review_${label}.png`;
execFileSync('python3', ['-c', `
import glob, math
from PIL import Image, ImageDraw
fs = sorted(glob.glob('${dir}/*.png'))
times = ${JSON.stringify(times.map((t) => +t.toFixed(2)))}
ims = [Image.open(f) for f in fs]
w,h = ims[0].size; C=${COLS}; R=math.ceil(len(ims)/C); LBL=16
sheet = Image.new('RGB',(w*C, (h+LBL)*R),(18,18,22)); d=ImageDraw.Draw(sheet)
for i,im in enumerate(ims):
    x=(i%C)*w; y=(i//C)*(h+LBL)
    sheet.paste(im,(x,y)); d.text((x+4,y+h+2), f'{times[i]}s', fill=(170,170,180))
sheet.thumbnail((1500,1500))
sheet.save('${out}')
print('${out}', sheet.size)
`], { stdio: 'inherit' });
console.log(`duration ${dur.toFixed(2)}s`);
