import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import vm from 'node:vm'
import { detectWebDirectory } from '../electron/main/paths.js'
import { createPreviewManager } from '../electron/main/preview.js'
import { getLanAdapters, getLanInfo } from '../electron/main/network.js'
import { parseHeartbeat, readGameStatus } from '../electron/main/diagnostics.js'
import { restoreWindowState } from '../electron/main/window-state.js'
import { inspectMapCompatibility } from '../electron/main/map-motion.js'
import { createLanServer } from '../electron/main/server.js'
import { validPort } from '../electron/main/errors.js'
import { firewallScript } from '../electron/main/firewall.js'

test('Steam self-reference and duplicate libraries terminate; inaccessible roots are bounded', async () => {
  let reads = 0
  const io = { stat: async () => { throw new Error('missing') }, readFile: async () => { reads++; return '"path" "C:/Steam" "path" "C:/STEAM"' } }
  assert.equal(await detectWebDirectory({ getSteamPath: async () => 'C:/Steam', io }), null)
  assert.equal(reads, 1)
  const start = Date.now()
  assert.equal(await detectWebDirectory({ getSteamPath: () => new Promise(() => {}), timeout: 30 }), null)
  assert(Date.now() - start < 500)
})
test('Steam searches secondary libraries', async () => {
  const io = { stat: async file => ({ isFile: () => file.includes('Secondary') }), readFile: async () => '"path" "C:/Secondary"' }
  assert((await detectWebDirectory({ getSteamPath: async () => 'C:/Steam', io })).includes('Secondary'))
})
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
test('Preview ignores stale validation and stale starts; retains last working map', async () => {
  const validations = {}, starts = {}, instances = []
  const manager = createPreviewManager({ validate: key => (validations[key] = deferred()).promise, create: config => {
    const instance = { stopped: false, start: () => (starts[config.webDir] = deferred()).promise, stop() { this.stopped = true } }
    instances.push(instance); return instance
  } })
  const good = { webValid: true, dataValid: true }
  const a = manager.refresh({ webDir: 'a' }), b = manager.refresh({ webDir: 'b' })
  validations.b.resolve(good); await Promise.resolve(); starts.b.resolve(12); await b
  validations.a.resolve(good); assert((await a).stale); assert.equal(instances.length, 1)
  const c = manager.refresh({ webDir: 'c' }); validations.c.resolve(good); await Promise.resolve()
  const d = manager.refresh({ webDir: 'd' }); validations.d.resolve(good); await Promise.resolve(); starts.d.resolve(14); await d
  starts.c.resolve(13); assert((await c).stale)
  assert.equal(instances.filter(s => !s.stopped).length, 1)
  const invalid = manager.refresh({ webDir: 'bad' }); validations.bad.resolve({ webValid: false, dataValid: false })
  assert.deepEqual(await invalid, { url: 'http://127.0.0.1:14/', validation: { webValid: false, dataValid: false }, retained: true })
  manager.stop(); assert(instances.every(s => s.stopped))
})
test('Network prefers physical IPv4, supports explicit choice and missing network', () => {
  const adapters = getLanAdapters({ vEthernet: [{ family: 'IPv4', internal: false, address: '172.20.0.1' }], 'Wi-Fi': [{ family: 'IPv4', internal: false, address: '192.168.1.10' }] })
  assert.equal(getLanInfo(8123, 8123, '', adapters).ip, '192.168.1.10')
  assert.equal(getLanInfo(8123, 8123, '172.20.0.1', adapters).ip, '172.20.0.1')
  assert.equal(getLanInfo(8123, 8123, '192.168.1.99', adapters).selectionMissing, true)
  assert.equal(getLanInfo(8123, 8123, '', []).url, '')
})
test('Heartbeat accepts actual mod literal and JSON; never executes code', () => {
  const now = Date.now()
  assert.equal(parseHeartbeat('window.PZ_BEAT = {beat:1,interval:300,state:"play",mem:{used:100}};', now, now).state, 'live')
  assert.equal(parseHeartbeat('window.PZ_BEAT = {"state":"nochar"};', now, now).state, 'nochar')
  assert.equal(parseHeartbeat('window.PZ_BEAT = {state:"play"};', now - 60001, now).state, 'stale')
  assert.throws(() => parseHeartbeat('window.PZ_BEAT = {state:(process.exit())};', now))
})
test('Window bounds return to connected screens and fit small work areas', () => {
  const screens = [{ workArea: { x: 0, y: 0, width: 900, height: 600 } }]
  const result = restoreWindowState({ bounds: { x: 5000, y: 5000, width: 1360, height: 890 } }, screens)
  assert.deepEqual(result, { x: 0, y: 0, width: 900, height: 600 })
})
test('Invalid port is rejected before firewall command construction', () => {
  for (const value of [0, 80, 65536, 8123.5, '8123', '8123; exit']) {
    assert.throws(() => validPort(value), /INVALID_PORT/)
    assert.throws(() => firewallScript(value), /INVALID_PORT/)
  }
})
test('Unsupported mod reports fallback without modifying its source', () => {
  assert.deepEqual(inspectMapCompatibility('<script>window.PZ_MAP_VERSION="0.9.0";</script>'), { version: '0.9.0', motion: false, state: 'fallback' })
})
test('HTTP malformed requests survive; pinch distance accumulates once; map edits invalidate cache', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pz-lan-test-'))
  const server = createLanServer(root, root, 0, true, '127.0.0.1')
  try {
    await fs.writeFile(path.join(root, 'index.html'), '<html><head></head><body>first</body></html>')
    const port = await server.start()
    const request = (url, host = 'localhost') => new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port, path: url, headers: { host } }, response => {
        let body = ''; response.on('data', bytes => { body += bytes }); response.on('end', () => resolve({ code: response.statusCode, body }))
      }).on('error', reject)
    })
    assert.equal((await request('/', '[')).code, 400)
    assert.equal((await request('/app/%E0%A4')).code, 400)
    assert.equal((await request('/app/%00')).code, 400)
    assert.equal((await request('/app/%2e%2e%5coutside.txt')).code, 403)
    const page = await request('/app/index.html')
    assert.equal(page.code, 200)
    const touch = [...page.body.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m => m[1].includes('installTouchMapControls'))[1]
    const handlers = {}, events = []
    const canvas = { addEventListener: (type, fn) => { handlers[type] = fn }, dispatchEvent: e => events.push(e) }
    function Event(type, opts) { return { type, ...opts } }
    vm.runInNewContext(touch, { document: { readyState: 'complete', getElementById: () => canvas }, setTimeout() {}, MouseEvent: Event, WheelEvent: Event })
    const event = distance => ({ preventDefault() {}, touches: [{ clientX: 0, clientY: 0 }, { clientX: distance, clientY: 0 }] })
    handlers.touchstart(event(100))
    for (let i = 0; i < 20; i++) handlers.touchmove(event(110))
    assert.equal(events.filter(e => e.type === 'wheel').length, 0)
    handlers.touchmove(event(180)); assert.equal(events.filter(e => e.type === 'wheel').length, 1)
    await fs.writeFile(path.join(root, 'index.html'), '<html><head></head><body>updated-map</body></html>')
    assert((await request('/app/index.html')).body.includes('updated-map'))
    assert.equal((await readGameStatus(root)).state, 'missing')
    await fs.writeFile(path.join(root, 'heartbeat.txt'), 'window.PZ_BEAT={state:"play",interval:300};')
    assert.equal((await readGameStatus(root)).state, 'live')
  } finally { server.stop(); await fs.rm(root, { recursive: true, force: true }) }
})


test('Preview merges simultaneous identical requests and can retry after shutdown', async () => {
  let validations = 0, creations = 0, stops = 0
  const gate = deferred()
  const manager = createPreviewManager({ validate: async () => { validations++; await gate.promise; return { webValid: true, dataValid: true } }, create: () => {
    creations++
    return { start: async () => 12345, stop: () => { stops++ } }
  } })
  const config = { webDir: 'web', dataDir: 'data' }
  const first = manager.refresh(config), second = manager.refresh(config)
  assert.equal(first, second)
  gate.resolve(); await first
  assert.equal(validations, 1); assert.equal(creations, 1)
  manager.stop()
  await manager.refresh(config)
  assert.equal(creations, 2)
  manager.stop(); assert.equal(stops, 2)
})
