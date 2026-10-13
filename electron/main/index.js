import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, shell, Tray } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Store from 'electron-store'
import { createLanServer } from './server.js'
import { detectWebDirectory, defaultDataDirectory, validateDirectories } from './paths.js'
import { getLanInfo } from './network.js'
import { addFirewallRule, getNetworkProfiles } from './firewall.js'
import { sanitizeMapPreferences } from './map-preferences.js'

const store = new Store({ name: 'settings' })
let win
let tray
let server = null
let previewServer = null
let lastConfig = {}
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appIconPath = path.join(app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '../..'), 'assets', 'app-icon.png')

function getConfig() {
  return {
    webDir: store.get('webDir', ''),
    dataDir: store.get('dataDir', defaultDataDirectory()),
    port: Number(store.get('port', 8123)),
    allowLan: true,
    sidebarOpen: store.get('sidebarOpen', true),
    language: store.get('language', ''),
    theme: ['light', 'dark', 'system'].includes(store.get('theme')) ? store.get('theme') : 'system'
  }
}

async function createWindow() {
  nativeTheme.themeSource = getConfig().theme
  win = new BrowserWindow({ width: 1360, height: 890, minWidth: 1000, minHeight: 680, icon: appIconPath, frame: false, autoHideMenuBar: true, backgroundColor: nativeTheme.shouldUseDarkColors ? '#191919' : '#f7f6f3', webPreferences: { preload: path.join(__dirname, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  win.on('close', (event) => { if (!app.isQuitting) { event.preventDefault(); win.hide() } })
  if (process.env.ELECTRON_RENDERER_URL) await win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else await win.loadFile(path.join(__dirname, '../renderer/index.html'))
}

function showWindow() { win?.show(); win?.focus() }

app.whenReady().then(async () => {
  app.setAppUserModelId('com.tiijeij8.pzmaplanserver')
  await createWindow()

  // Show the UI immediately. Steam libraries may include unavailable volumes,
  // so discovery must not delay window creation.
  void detectWebDirectory().then((foundWeb) => {
    if (foundWeb && !store.get('webDir')) store.set('webDir', foundWeb)
  }).catch((error) => console.error('Steam map discovery failed:', error))

  try {
    tray = new Tray(nativeImage.createFromPath(appIconPath).resize({ width: 16, height: 16 }))
    tray.setToolTip('PZ Map LAN Server')
    tray.setContextMenu(Menu.buildFromTemplate([{ label: '显示窗口', click: showWindow }, { label: '退出', click: () => { app.isQuitting = true; app.quit() } }]))
    tray.on('double-click', showWindow)
  } catch (error) {
    console.error('System tray initialization failed:', error)
  }
}).catch((error) => {
  console.error('Application startup failed:', error)
  dialog.showErrorBox('PZ Map LAN Server', `应用启动失败：${error?.stack || error}`)
})

app.on('before-quit', () => { app.isQuitting = true; server?.stop(); previewServer?.stop() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

ipcMain.handle('config:get', () => ({ ...getConfig(), detectedWebDir: '' }))
ipcMain.handle('config:detect', async () => { const webDir = await detectWebDirectory(); if (webDir) store.set('webDir', webDir); return { webDir, config: getConfig() } })
ipcMain.handle('config:validate', async (_event, payload) => validateDirectories(payload.webDir, payload.dataDir))
ipcMain.handle('config:save', (_event, payload) => {
  if (payload.mapPreferences !== undefined) {
    const preferences = sanitizeMapPreferences(payload.mapPreferences)
    store.set('mapPreferences', preferences)
    previewServer?.setMapPreferences(preferences)
  }
  if (payload.theme !== undefined && !['light', 'dark', 'system'].includes(payload.theme)) throw new Error('Invalid theme')
  for (const key of ['webDir', 'dataDir', 'port', 'language', 'sidebarOpen', 'theme']) if (payload[key] !== undefined) store.set(key, payload[key])
  const config = getConfig()
  nativeTheme.themeSource = config.theme
  win?.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#191919' : '#f7f6f3')
  server?.setAppearance(config)
  previewServer?.setAppearance(config)
  return config
})
ipcMain.handle('dialog:directory', async () => { const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] }); return result.canceled ? null : result.filePaths[0] })
ipcMain.handle('server:start', async (_event, payload) => {
  if (server) server.stop()
  const config = { ...getConfig(), ...payload }
  const validation = await validateDirectories(config.webDir, config.dataDir)
  if (!validation.webValid || !validation.dataValid) throw new Error('请先配置有效的网页目录和数据目录')
  lastConfig = config
  server = createLanServer(config.webDir, config.dataDir, config.port, config.allowLan)
  server.setAppearance(config)
  const address = await server.start()
  const info = getLanInfo(config.port, address)
  return { ...info, port: config.port }
})
ipcMain.handle('server:stop', () => { server?.stop(); server = null; return true })
ipcMain.handle('server:status', () => server ? { running: true, ...getLanInfo(lastConfig.port, server.address()) } : { running: false })
ipcMain.handle('preview:refresh', async (_event, payload) => {
  previewServer?.stop()
  previewServer = null
  const config = { ...getConfig(), ...payload }
  const validation = await validateDirectories(config.webDir, config.dataDir)
  if (!validation.webValid || !validation.dataValid) return { url: '', validation }
  previewServer = createLanServer(config.webDir, config.dataDir, 0, true, '127.0.0.1', sanitizeMapPreferences(store.get('mapPreferences', {})))
  previewServer.setAppearance(config)
  const port = await previewServer.start()
  return { url: `http://127.0.0.1:${port}/`, validation }
})
ipcMain.handle('window:minimize', () => { win?.minimize(); return true })
ipcMain.handle('window:toggle-maximize', () => { if (win?.isMaximized()) win.unmaximize(); else win?.maximize(); return Boolean(win?.isMaximized()) })
ipcMain.handle('window:close', () => { app.isQuitting = true; win?.close(); return true })
ipcMain.handle('network:profiles', async () => getNetworkProfiles())
ipcMain.handle('firewall:add', async (_event, port) => addFirewallRule(port))
ipcMain.handle('preview:open', async (_event, url) => shell.openExternal(url))
