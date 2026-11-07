// Deterministic frame renderer: loads a storyboard + timeline into player.html and screenshots every frame.
// usage: node engine/render.js <storyboard.json> <timeline.json> <outDir> [--workers N] [--fps 30] [--only a,b,c] [--w 720 --h 1280]
const http = require('http'), fs = require('fs'), path = require('path');
const {chromium} = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const [sbPath, tlPath, outDir] = args;
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const WORKERS = +opt('workers', 4), FPS = +opt('fps', 30), ONLY = opt('only', null), QUALITY = +opt('quality', 90);
const MIME = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg'};
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/engine\/node_modules/, '/node_modules'));
  fs.readFile(p.startsWith(ROOT) ? p : '/nonexistent', (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, {'content-type': MIME[path.extname(p)] || 'application/octet-stream'}); res.end(d); } });
});
(async () => {
  const sb = JSON.parse(fs.readFileSync(sbPath)), tl = JSON.parse(fs.readFileSync(tlPath));
  fs.mkdirSync(outDir, {recursive: true});
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
  const total = Math.ceil(tl.total * FPS);
  const frames = ONLY ? ONLY.split(',').map(Number) : [...Array(total).keys()];
  const gpu = !!process.env.GPU;   // GPU=1 -> use the machine's real GPU (much faster on a Mac); default = software rendering (works anywhere)
  const browser = await chromium.launch({args: [...(gpu ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']), '--no-sandbox', '--force-device-scale-factor=1']});
  let next = 0, done = 0; const t0 = Date.now();
  async function worker(id) {
    const ctx = await browser.newContext({viewport: {width: 720, height: 1280}, deviceScaleFactor: 1});
    const page = await ctx.newPage();
    page.on('pageerror', e => console.error('PAGEERR', e.message)); page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
    await page.goto(`http://127.0.0.1:${port}/engine/player.html`); await page.waitForFunction('window.__ready === true', null, {timeout: 60000});
    await page.evaluate(([s, t]) => window.loadStoryboard(s, t), [sb, tl]);
    await page.evaluate(() => document.fonts.ready);
    for (;;) {
      const k = next++; if (k >= frames.length) break; const f = frames[k];
      await page.evaluate(t => window.renderFrame(t), f / FPS);
      const buf = await page.screenshot({type: 'jpeg', quality: QUALITY});
      fs.writeFileSync(path.join(outDir, `f${String(f).padStart(5, '0')}.jpg`), buf);
      if (++done % 60 === 0) console.log(`frames ${done}/${frames.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    await ctx.close();
  }
  await Promise.all([...Array(Math.min(WORKERS, frames.length)).keys()].map(worker));
  await browser.close(); server.close(); console.log('done', frames.length, 'frames in', ((Date.now() - t0) / 1000).toFixed(0) + 's');
})().catch(e => { console.error(e); process.exit(1); });
