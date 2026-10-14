import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, shell, Tray, screen } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Store from 'electron-store'
import { createLanServer } from './server.js'
import { detectWebDirectory, defaultDataDirectory, validateDirectories } from './paths.js'
import { getLanInfo } from './network.js'
import { addFirewallRule, getNetworkProfiles } from './firewall.js'
import { sanitizeMapPreferences } from './map-preferences.js'
import { createPreviewManager } from './preview.js'
import { createDiagnostics } from './diagnostics.js'
import { restoreWindowState } from './window-state.js'
import { appError, errorCode, validPort } from './errors.js'

const store = new Store({ name: 'settings' })
let win, tray, windowTimer, discovery
let server = null, lastConfig = {}, serviceError = '', serviceBusy = false
const diagnostics = createDiagnostics()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appIconPath = path.join(app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '../..'), 'assets', 'app-icon.png')
const preview = createPreviewManager({
  validate: validateDirectories,
  create: config => {
    const instance = createLanServer(config.webDir, config.dataDir, 0, true, '127.0.0.1', sanitizeMapPreferences(store.get('mapPreferences', {})))
    instance.setAppearance(getConfig())
    return instance
  },
})
function getConfig() {
  // Read one settings snapshot; each store.get() otherwise reads the JSON again.
  const saved = store.store
  return {
    webDir: saved.webDir ?? '', dataDir: saved.dataDir ?? defaultDataDirectory(),
    port: Number(saved.port ?? 8123), allowLan: true,
    sidebarOpen: saved.sidebarOpen ?? true, language: saved.language ?? '',
    theme: ['light', 'dark', 'system'].includes(saved.theme) ? saved.theme : 'system',
    closeBehavior: saved.closeBehavior === 'tray' ? 'tray' : 'quit',
    uiScale: [90, 100, 110, 125, 150].includes(saved.uiScale) ? saved.uiScale : 100,
    preferredIp: saved.preferredIp ?? '',
  }
}
function isChinese() { return (getConfig().language || app.getLocale()).toLowerCase().startsWith('zh') }
function showWindow() { if (win?.isMinimized()) win.restore(); win?.show(); win?.focus() }
function updateTray() {
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: isChinese() ? '显示窗口' : 'Show window', click: showWindow },
    { label: isChinese() ? '退出' : 'Quit', click: () => { app.isQuitting = true; app.quit() } },
  ]))
}
function saveWindow() {
  clearTimeout(windowTimer)
  if (win && !win.isDestroyed() && !win.isMinimized()) store.set('windowState', { bounds: win.getNormalBounds(), maximized: win.isMaximized() })
}
async function createWindow() {
  nativeTheme.themeSource = getConfig().theme
  const saved = store.get('windowState')
  const displays = [screen.getPrimaryDisplay(), ...screen.getAllDisplays().filter(d => d.id !== screen.getPrimaryDisplay().id)]
  const bounds = restoreWindowState(saved, displays)
  win = new BrowserWindow({ ...bounds, minWidth: Math.min(640, bounds.width), minHeight: Math.min(480, bounds.height), icon: appIconPath, frame: false, autoHideMenuBar: true, backgroundColor: nativeTheme.shouldUseDarkColors ? '#191919' : '#f7f6f3', webPreferences: { preload: path.join(__dirname, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  for (const event of ['resize', 'move', 'maximize', 'unmaximize']) win.on(event, () => { clearTimeout(windowTimer); windowTimer = setTimeout(saveWindow, 300) })
  win.on('close', event => {
    saveWindow()
    if (!app.isQuitting && getConfig().closeBehavior === 'tray' && tray) { event.preventDefault(); win.hide() }
    else app.isQuitting = true
  })
  if (saved?.maximized) win.maximize()
  if (process.env.ELECTRON_RENDERER_URL) await win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else await win.loadFile(path.join(__dirname, '../renderer/index.html'))
}
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', showWindow)
  app.whenReady().then(async () => {
    app.setAppUserModelId('com.tiijeij8.pzmaplanserver')
    try {
      tray = new Tray(nativeImage.createFromPath(appIconPath).resize({ width: 16, height: 16 }))
      tray.setToolTip('PZ Map LAN Server'); updateTray(); tray.on('double-click', showWindow)
    } catch (error) { console.error('Tray initialization failed:', error) }
    await createWindow()
  }).catch(error => {
    console.error('Application startup failed:', error)
    dialog.showErrorBox('PZ Map LAN Server', `${isChinese() ? '应用启动失败' : 'Application startup failed'}: ${error?.message || error}`)
    app.quit()
  })
}
app.on('before-quit', () => { app.isQuitting = true; saveWindow(); server?.stop(); preview.stop() })
app.on('window-all-closed', () => app.quit())

// Stable error codes cross IPC; the renderer supplies the selected language.
function handle(name, fn) {
  ipcMain.handle(name, async (event, ...args) => {
    if (event.sender !== win?.webContents || event.senderFrame !== win?.webContents.mainFrame) throw appError('ACCESS_DENIED')
    try { return await fn(...args) } catch (error) { console.error(name, error); throw appError(errorCode(error)) }
  })
}
handle('config:get', () => ({ ...getConfig(), trayAvailable: Boolean(tray) }))
handle('config:detect', async () => {
  const config = getConfig()
  if (config.webDir && (await validateDirectories(config.webDir, config.dataDir)).webValid) return { config }
  if (!discovery) discovery = detectWebDirectory().finally(() => { discovery = null })
  const webDir = await discovery
  // A manual choice made during discovery always wins.
  if (webDir && store.get('webDir', '') === config.webDir) store.set('webDir', webDir)
  return { webDir, config: getConfig() }
})
handle('config:validate', payload => validateDirectories(payload.webDir, payload.dataDir))
handle('config:save', payload => {
  if (!payload || typeof payload !== 'object') throw appError('INVALID_SETTINGS')
  if (payload.port !== undefined) validPort(payload.port)
  for (const [key, allowed] of Object.entries({ theme: ['light', 'dark', 'system'], language: ['', 'zh-CN', 'en'], closeBehavior: ['quit', 'tray'], uiScale: [90, 100, 110, 125, 150] })) {
    if (payload[key] !== undefined && !allowed.includes(payload[key])) throw appError('INVALID_SETTINGS')
  }
  for (const key of ['webDir', 'dataDir', 'preferredIp']) if (payload[key] !== undefined && (typeof payload[key] !== 'string' || payload[key].length > 32768)) throw appError('INVALID_SETTINGS')
  if (payload.sidebarOpen !== undefined && typeof payload.sidebarOpen !== 'boolean') throw appError('INVALID_SETTINGS')
  if (payload.closeBehavior === 'tray' && !tray) throw appError('TRAY_UNAVAILABLE')
  const changes = {}
  if (payload.mapPreferences !== undefined) {
    const preferences = sanitizeMapPreferences(payload.mapPreferences)
    if (JSON.stringify(preferences) !== JSON.stringify(store.get('mapPreferences', {}))) changes.mapPreferences = preferences
  }
  const previous = getConfig()
  for (const key of ['webDir', 'dataDir', 'port', 'language', 'sidebarOpen', 'theme', 'closeBehavior', 'uiScale', 'preferredIp']) {
    if (payload[key] !== undefined && payload[key] !== previous[key]) changes[key] = payload[key]
  }
  // electron-store writes synchronously: commit the complete change once.
  if (Object.keys(changes).length) store.set(changes)
  if (changes.mapPreferences) preview.current?.setMapPreferences(changes.mapPreferences)
  const config = { ...previous }
  for (const key of Object.keys(config)) if (key in changes) config[key] = changes[key]
  if ('theme' in changes) {
    nativeTheme.themeSource = config.theme
    win?.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#191919' : '#f7f6f3')
  }
  if ('language' in changes) updateTray()
  if ('theme' in changes || 'language' in changes) { server?.setAppearance(config); preview.current?.setAppearance(config) }
  return config
})
handle('dialog:directory', async () => { const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] }); return result.canceled ? null : result.filePaths[0] })
function serviceStatus() {
  const config = getConfig(), running = Boolean(server?.address())
  const port = running ? server.address() : config.port
  const network = getLanInfo(port, port, config.preferredIp)
  return { running, ...network, port, code: serviceError, clients: running ? [...server.clients].filter(([, at]) => Date.now() - at < 60000).map(([ip, lastSeen]) => ({ ip, lastSeen })) : [], configChanged: running && ['port', 'webDir', 'dataDir'].some(key => config[key] !== lastConfig[key]) }
}
handle('server:start', async payload => {
  if (serviceBusy) throw appError('SERVICE_BUSY')
  serviceBusy = true
  try {
    const config = { ...getConfig(), ...payload }
    validPort(config.port)
    const validation = await validateDirectories(config.webDir, config.dataDir)
    if (!validation.webValid || !validation.dataValid) throw appError('INVALID_DIRECTORIES')
    if (!getLanInfo(config.port, config.port, config.preferredIp).url) throw appError('NO_NETWORK')
    if (server?.address()) return serviceStatus()
    const next = createLanServer(config.webDir, config.dataDir, config.port, true)
    next.setAppearance(config)
    try { await next.start() } catch (error) { next.stop(); throw error }
    server = next; lastConfig = config; serviceError = ''
    return serviceStatus()
  } catch (error) { serviceError = errorCode(error); throw error }
  finally { serviceBusy = false }
})
handle('server:stop', () => { if (serviceBusy) throw appError('SERVICE_BUSY'); server?.stop(); server = null; serviceError = ''; return true })
handle('server:status', async () => ({ ...serviceStatus(), ...(await diagnostics(server?.address() ? lastConfig : getConfig())) }))
handle('preview:refresh', payload => preview.refresh({ ...getConfig(), ...payload }))
handle('window:minimize', () => { win?.minimize(); return true })
handle('window:toggle-maximize', () => { if (win?.isMaximized()) win.unmaximize(); else win?.maximize(); return Boolean(win?.isMaximized()) })
handle('window:close', () => { win?.close(); return true })
let profilesCache, profilesAt = 0, profilesPending
handle('network:profiles', () => {
  if (profilesCache && Date.now() - profilesAt < 60000) return profilesCache
  if (!profilesPending) profilesPending = getNetworkProfiles().then(value => {
    profilesCache = value; profilesAt = Date.now(); return value
  }).finally(() => { profilesPending = null })
  return profilesPending
})
handle('firewall:add', port => addFirewallRule(port))
handle('preview:open', async url => { if (!/^https?:\/\//i.test(url)) throw appError('ACCESS_DENIED'); return shell.openExternal(url) })
