import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { EventEmitter } from 'node:events'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { restoreWindowState } from '../electron/main/window-state.js'
import { createPreviewManager } from '../electron/main/preview.js'
import { sanitizeMapPreferences } from '../electron/main/map-preferences.js'
import { appError, errorCode, validPort } from '../electron/main/errors.js'

// Run the actual main-process orchestration with simulated OS/Electron objects.
// Native window/UAC checks remain separate acceptance tests.
async function harness({ saved = {}, locked = true } = {}) {
  const counts = { writes: 0, tray: 0, appearance: 0, background: 0, profiles: 0 }
  const data = new Map(Object.entries(saved)), handlers = new Map(), windows = [], trays = []
  const app = new EventEmitter()
  Object.assign(app, { isPackaged: false, requestSingleInstanceLock: () => locked, whenReady: () => Promise.resolve(), getLocale: () => 'en', setAppUserModelId() {}, quit() { this.quitCalled = true; this.emit('before-quit') } })
  class Store { get store() { return Object.fromEntries(data) } get(key, fallback) { return data.has(key) ? data.get(key) : fallback } set(key, value) { counts.writes++; if (typeof key === 'object') for (const [k, v] of Object.entries(key)) data.set(k, v); else data.set(key, value) } }
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super(); this.options = options; this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height }; this.visible = true
      this.webContents = { mainFrame: {} }; windows.push(this)
    }
    async loadFile() {} async loadURL() {}
    isMinimized() { return Boolean(this.minimized) } minimize() { this.minimized = true }
    restore() { this.minimized = false } show() { this.visible = true } focus() { this.focused = true } hide() { this.visible = false }
    isDestroyed() { return Boolean(this.destroyed) } getNormalBounds() { return this.bounds }
    isMaximized() { return Boolean(this.maximized) } maximize() { this.maximized = true } unmaximize() { this.maximized = false }
    setBackgroundColor() { counts.background++ }
    close() { let prevented = false; this.emit('close', { preventDefault() { prevented = true } }); if (!prevented) { this.destroyed = true; app.emit('window-all-closed') } }
  }
  class Tray { constructor() { trays.push(this) } setToolTip() {} on() {} setContextMenu(menu) { counts.tray++; this.menu = menu } }
  const servers = []
  const box = { app, BrowserWindow, Tray, Store, path, fileURLToPath, restoreWindowState, createPreviewManager, sanitizeMapPreferences, appError, errorCode, validPort,
    console: { error() {} }, process: { env: {} }, setTimeout, clearTimeout,
    screen: { getPrimaryDisplay: () => ({ id: 1, workArea: { x: 0, y: 0, width: 900, height: 600 } }), getAllDisplays: () => [] },
    nativeTheme: { shouldUseDarkColors: false }, nativeImage: { createFromPath: () => ({ resize() { return {} } }) },
    Menu: { buildFromTemplate: menu => menu }, shell: { openExternal: async () => {} }, dialog: { showErrorBox() {}, showOpenDialog: async () => ({ canceled: true }) },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    defaultDataDirectory: () => 'data', detectWebDirectory: async () => 'detected', validateDirectories: async () => ({ webValid: true, dataValid: true }),
    getLanInfo: port => ({ url: `http://192.168.1.10:${port}/`, ip: '192.168.1.10', adapters: [] }),
    getNetworkProfiles: async () => { counts.profiles++; return [] }, addFirewallRule: async () => ({ ok: true }),
    createDiagnostics: () => async () => ({ game: { state: 'live' }, compatibility: { state: 'supported' } }),
    createLanServer: (_web, _data, port) => {
      const server = { clients: new Map(), bound: null, setAppearance() { counts.appearance++ }, setMapPreferences() {}, stop() { this.bound = null }, address() { return this.bound }, async start() { if (port === 9999) throw Object.assign(new Error('in use'), { code: 'EADDRINUSE' }); this.bound = port || 12345; return this.bound } }
      servers.push(server); return server
    },
  }
  const code = (await readFile(new URL('../electron/main/index.js', import.meta.url), 'utf8')).replace(/^import .*$/gm, '').replace('import.meta.url', JSON.stringify(new URL('../electron/main/index.js', import.meta.url).href))
  vm.runInNewContext(code, box)
  await new Promise(resolve => setImmediate(resolve))
  const call = (name, ...args) => handlers.get(name)({ sender: windows[0].webContents, senderFrame: windows[0].webContents.mainFrame }, ...args)
  return { app, windows, trays, data, call, handlers, servers, counts }
}
test('Desktop close paths, tray translation, preference persistence and window restoration', async () => {
  const h = await harness({ saved: { closeBehavior: 'tray', windowState: { bounds: { x: 5000, y: 0, width: 1360, height: 890 }, maximized: true } } })
  try {
    const window = h.windows[0]
    assert.equal(window.bounds.width, 900); assert.equal(window.maximized, true)
    assert.equal(h.trays[0].menu[0].label, 'Show window')
    await h.call('config:save', { language: 'zh-CN', uiScale: 125, sidebarOpen: false })
    assert.equal(h.trays[0].menu[0].label, '显示窗口')
    assert.equal((await h.call('config:get')).sidebarOpen, false)
    await h.call('window:close'); assert.equal(window.visible, false); assert.equal(window.destroyed, undefined)
    window.minimize(); h.app.emit('second-instance'); assert.equal(window.visible, true); assert.equal(window.minimized, false)
    window.close(); assert.equal(window.visible, false)
    await h.call('config:save', { closeBehavior: 'quit' })
    await h.call('window:close'); assert.equal(h.app.quitCalled, true)
    assert.equal(h.data.get('windowState').maximized, true)
  } finally { h.app.quit() }
})
test('Second process exits before creating another window', async () => {
  const h = await harness({ locked: false })
  assert.equal(h.app.quitCalled, true); assert.equal(h.windows.length, 0)
})
test('Failed server start cannot appear running; valid restart clears error; IPC rejects subframes', async () => {
  const h = await harness({ saved: { webDir: 'web', dataDir: 'data' } })
  try {
    await assert.rejects(h.call('server:start', { port: 9999 }), /PZ:PORT_IN_USE/)
    const failed = await h.call('server:status')
    assert.equal(failed.running, false); assert.equal(failed.code, 'PORT_IN_USE')
    const started = await h.call('server:start', { port: 8123 })
    assert.equal(started.running, true); assert.equal(started.code, '')
    await h.call('config:save', { port: 8124 })
    assert.equal((await h.call('server:status')).configChanged, true)
    await h.call('server:stop'); assert.equal((await h.call('server:status')).running, false)
    await assert.rejects(h.handlers.get('config:get')({ sender: h.windows[0].webContents, senderFrame: {} }), /PZ:ACCESS_DENIED/)
    await assert.rejects(h.call('config:save', { port: 0 }), /PZ:INVALID_PORT/)
  } finally { h.app.quit() }
})


test('Settings batch writes, skip unchanged values, and update only relevant side effects', async () => {
  const h = await harness({ saved: { language: 'en', theme: 'light', webDir: 'web', dataDir: 'data' } })
  try {
    await h.call('preview:refresh', {})
    const before = { ...h.counts }
    await h.call('config:save', { sidebarOpen: false, uiScale: 125, closeBehavior: 'tray' })
    assert.equal(h.counts.writes - before.writes, 1)
    assert.equal(h.counts.tray, before.tray)
    assert.equal(h.counts.appearance, before.appearance)
    assert.equal(h.counts.background, before.background)
    await h.call('config:save', { sidebarOpen: false, uiScale: 125, closeBehavior: 'tray' })
    assert.equal(h.counts.writes - before.writes, 1, 'unchanged values do not touch disk')
    await h.call('config:save', { theme: 'dark' })
    assert.equal(h.counts.background - before.background, 1)
    assert.equal(h.counts.appearance - before.appearance, 1)
    assert.equal(h.counts.tray, before.tray)
    await Promise.all([h.call('network:profiles'), h.call('network:profiles')])
    await h.call('network:profiles')
    assert.equal(h.counts.profiles, 1, 'reuse concurrent and recent PowerShell results')
  } finally { h.app.quit() }
})
