import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import { URL } from 'node:url'
import { networkInterfaces } from 'node:os'
import { mapPanelTheme } from './map-theme.js'
import { mapAppearanceScript, normalizeAppearance } from './map-appearance.js'
import { enhanceMapMotion } from './map-motion.js'

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.txt': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' }
const inside = (root, candidate) => { const r = path.resolve(root); const c = path.resolve(candidate); return c === r || c.startsWith(r + path.sep) }
const ipv4Number = (value) => value.split('.').reduce((n, part) => (n * 256) + Number(part), 0) >>> 0
const subnetAllowed = (remote) => {
  const client = (remote || '').replace('::ffff:', '')
  if (client === '127.0.0.1' || client === '::1') return true
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(client)) return false
  return Object.values(networkInterfaces()).flat().some((item) => item && item.family === 'IPv4' && !item.internal && ((ipv4Number(client) & ipv4Number(item.netmask)) === (ipv4Number(item.address) & ipv4Number(item.netmask))))
}
export function createLanServer(webDir, dataDir, port, _allowLan = true, host = '0.0.0.0', embeddedPreferences = null) {
  void _allowLan
  let server
  let enhancedHtml
  let appearance = normalizeAppearance()
  const appearanceStreams = new Set()
  const sendAppearance = res => res.write(`data: ${JSON.stringify(appearance)}\n\n`)
  const clients = new Map()
  const mobileEnhancement = `
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<style>html,body,#map{overscroll-behavior:none}#map{touch-action:none}html,body{overflow:hidden}</style>
<script>
(function () {
  function installTouchMapControls() {
    var cv = document.getElementById('map');
    if (!cv || cv.__pzTouchReady) return;
    cv.__pzTouchReady = true;
    var pinchDistance = 0;
    var pinchTravel = 0;
    var multiTouch = false;
    var mouseDown = false;
    var point = function (t) { return { clientX: t.clientX, clientY: t.clientY }; };
    var midpoint = function (a, b) { return { clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 }; };
    var distance = function (a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); };
    var mouse = function (type, p) { cv.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: p.clientX, clientY: p.clientY, button: 0, buttons: type === 'mouseup' ? 0 : 1 })); };
    cv.addEventListener('touchstart', function (e) {
      e.preventDefault();
      if (e.touches.length === 1 && !multiTouch) { mouse('mousedown', point(e.touches[0])); mouseDown = true; }
      if (e.touches.length >= 2) { multiTouch = true; pinchDistance = distance(e.touches[0], e.touches[1]); }
    }, { passive: false });
    cv.addEventListener('touchmove', function (e) {
      e.preventDefault();
      if (e.touches.length >= 2) {
        var next = distance(e.touches[0], e.touches[1]);
        var delta = next - pinchDistance;
        pinchTravel += delta;
        var step = 72;
        if (Math.abs(pinchTravel) >= step) {
          var p = midpoint(e.touches[0], e.touches[1]);
          var direction = pinchTravel > 0 ? 1 : -1;
          cv.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: p.clientX, clientY: p.clientY, deltaY: -direction * 100 }));
          pinchTravel -= direction * step;
          pinchDistance = next;
        }
      } else if (e.touches.length === 1 && !multiTouch) mouse('mousemove', point(e.touches[0]));
    }, { passive: false });
    cv.addEventListener('touchend', function (e) {
      e.preventDefault();
      if (e.touches.length === 0) { if (mouseDown) mouse('mouseup', point(e.changedTouches[0] || { clientX: 0, clientY: 0 })); mouseDown = false; multiTouch = false; pinchDistance = 0; pinchTravel = 0; }
    }, { passive: false });
    cv.addEventListener('touchcancel', function () { if (mouseDown) mouse('mouseup', { clientX: 0, clientY: 0 }); mouseDown = false; multiTouch = false; pinchDistance = 0; pinchTravel = 0; }, { passive: false });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installTouchMapControls); else installTouchMapControls();
  setTimeout(installTouchMapControls, 500);
}());
</script>`
  const getEnhancedHtml = async (file) => {
    if (!enhancedHtml) {
      const source = await fs.promises.readFile(file, 'utf8')
      enhancedHtml = enhanceMapMotion(source).replace(/<\/head\s*>/i, mapPanelTheme + mobileEnhancement + '</head>')
    }
    return enhancedHtml.replace(/<\/head\s*>/i, mapAppearanceScript(appearance, embeddedPreferences) + '</head>')
  }
  const handler = (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end() }
    if (!subnetAllowed(req.socket.remoteAddress)) { res.writeHead(403); return res.end('Local network only') }
    const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    if (parsed.pathname === '/__pz/appearance') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
      if (req.method === 'HEAD') return res.end()
      appearanceStreams.add(res)
      sendAppearance(res)
      res.on('close', () => appearanceStreams.delete(res))
      return
    }
    let root; let relative
    if (parsed.pathname === '/') { res.writeHead(302, { Location: '/app/index.html?d=/data/' }); return res.end() }
    if (parsed.pathname.startsWith('/app/')) { root = webDir; relative = parsed.pathname.slice(5) }
    else if (parsed.pathname.startsWith('/data/')) { root = dataDir; relative = parsed.pathname.slice(6) }
    else { res.writeHead(404); return res.end('Not found') }
    let decoded
    try { decoded = decodeURIComponent(relative) } catch { res.writeHead(400); return res.end('Bad request') }
    const file = path.resolve(root, decoded)
    if (!inside(root, file)) { res.writeHead(403); return res.end('Forbidden') }
    if (parsed.pathname.startsWith('/data/')) clients.set(req.socket.remoteAddress?.replace('::ffff:', '') || 'unknown', Date.now())
    fs.stat(file, (statErr, stat) => {
      if (statErr || !stat.isFile()) { res.writeHead(404); return res.end('Not found') }
      const headers = { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' }
      const isMapHtml = path.basename(file).toLowerCase() === 'index.html' && root === webDir
      if (parsed.pathname.startsWith('/data/') || isMapHtml) headers['Cache-Control'] = 'no-store, max-age=0'
      else headers['Cache-Control'] = 'public, max-age=3600'
      if (req.method === 'HEAD') { res.writeHead(200, headers); return res.end() }
      if (isMapHtml) {
        getEnhancedHtml(file).then((html) => { headers['Content-Length'] = Buffer.byteLength(html); res.writeHead(200, headers); res.end(html) }).catch(() => { res.writeHead(503); res.end('Service unavailable') })
        return
      }
      const stream = fs.createReadStream(file)
      stream.on('error', () => { if (!res.headersSent) res.writeHead(503); res.end() })
      res.writeHead(200, headers); stream.pipe(res)
    })
  }
  return {
    start: () => new Promise((resolve, reject) => { server = http.createServer(handler); server.once('error', reject); server.listen(port, host, () => resolve(server.address().port)) }),
    stop: () => { for (const res of appearanceStreams) res.end(); appearanceStreams.clear(); server?.close() },
    setAppearance: preferences => {
      const next = normalizeAppearance(preferences)
      if (JSON.stringify(next) === JSON.stringify(appearance)) return
      appearance = next
      for (const res of appearanceStreams) sendAppearance(res)
    },
    address: () => server?.address()?.port,
    setMapPreferences: values => { if (embeddedPreferences !== null) embeddedPreferences = values },
    clients,
  }
}
