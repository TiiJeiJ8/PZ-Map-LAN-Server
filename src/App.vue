<script setup>
import { computed, defineComponent, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { version } from '../package.json'
import { useI18n } from 'vue-i18n'
import './style.css'
import appIcon from '../assets/app-icon.svg'
import { applyTheme, normalizeTheme } from './theme.js'
import { MapLocation, Connection, Setting, InfoFilled, Minus, CopyDocument, Close, Fold, Check, WarningFilled, Link, Iphone, FullScreen, Lock, FolderOpened } from '@element-plus/icons-vue'
const { t, locale, te } = useI18n()
function message(error) { const code = error?.message?.match(/PZ:([A-Z_]+)/)?.[1] || error?.code; return code && te('error_' + code) ? t('error_' + code) : t('error_OPERATION_FAILED') }
const ElIcon = defineComponent({
  name: 'AppIcon',
  inheritAttrs: false,
  setup(_props, { attrs, slots }) {
    return () => h('span', { 'aria-hidden': true, ...attrs, class: ['el-icon', attrs.class] }, slots.default?.())
  },
})
const active = ref('map'); const sidebar = ref(true); const config = ref({ webDir: '', dataDir: '', port: 8123, closeBehavior: 'quit', uiScale: 100, preferredIp: '' }); const validation = ref({ webValid: false, dataValid: false }); const status = ref({ running: false }); const qr = ref(''); const copied = ref(false); const profiles = ref([]); const firewallDone = ref(false); const firewallBusy = ref(false); const error = ref('')
const ready = computed(() => validation.value.webValid && validation.value.dataValid)
const webUrl = computed(() => status.value.running ? status.value.url || '' : '')
const previewUrl = ref('')
const mapIframe = ref(null)
let previewTimer, statusTimer, previewRequest = 0, statusRequest = 0, polling = false, profilesAt = 0, profilesPending = false
const initialized = ref(false)
const previewSuspended = ref(false)
let suspendTimer, suspendRequest = 0, mapState = null, lifecycleReady = false, disposed = false
function postToMap(message) {
  if (previewUrl.value) mapIframe.value?.contentWindow?.postMessage(message, new URL(previewUrl.value).origin)
}
function syncMapActivity() {
  postToMap({ type: 'pz-lan-map-activity', active: !document.hidden && active.value === 'map' })
}
function updateActivity() {
  clearTimeout(statusTimer)
  clearTimeout(suspendTimer)
  suspendRequest++
  if (document.hidden) {
    suspendTimer = setTimeout(() => {
      // Unsupported maps stay mounted: never discard a view we cannot restore.
      if (document.hidden && lifecycleReady && !previewSuspended.value) postToMap({ type: 'pz-lan-map-suspend', request: suspendRequest })
    }, 60000)
  } else {
    if (active.value === 'map') previewSuspended.value = false
    if (initialized.value) void pollStatus()
  }
  syncMapActivity()
}
watch(active, updateActivity)
watch(previewUrl, () => { mapState = null; lifecycleReady = false; suspendRequest++ })
const previewRetained = ref(false)
const statusError = ref(false)
const game = computed(() => status.value.game || { state: 'waiting', updatedAt: null })
const compatibility = computed(() => status.value.compatibility || { state: 'checking', version: '' })
const networkChoices = computed(() => status.value.adapters || [])
const formattedTime = value => value ? new Date(value).toLocaleString(locale.value, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
const connectionIssue = computed(() => statusError.value ? 'STATUS_UNAVAILABLE' : status.value.code || (!status.value.url ? 'NO_NETWORK' : ''))
async function pollStatus() {
  if (disposed || document.hidden || polling || !window.pz?.server?.status) return
  clearTimeout(statusTimer)
  polling = true
  const request = ++statusRequest
  try {
    const result = await window.pz.server.status()
    if (request === statusRequest) { status.value = result; statusError.value = false }
    if (active.value === 'share' && !document.hidden) void refreshProfiles()
  }
  catch { statusError.value = true }
  finally {
    polling = false
    if (!disposed && !document.hidden) statusTimer = setTimeout(pollStatus, active.value === 'share' ? 3000 : 15000)
  }
}
async function refreshProfiles() {
  if (profilesPending || Date.now() - profilesAt < 60000) return
  profilesPending = true
  try {
    const result = await window.pz.network?.profiles?.()
    if (!disposed) profiles.value = Array.isArray(result) ? result : result ? [result] : []
  } catch { /* A network-profile lookup must not invalidate game status. */ }
  finally { profilesAt = Date.now(); profilesPending = false }
}
watch(webUrl, async (url, _, onCleanup) => {
  let cancelled = false
  onCleanup(() => { cancelled = true })
  if (!url || !status.value.running) { qr.value = ''; return }
  try { const image = await QRCode.toDataURL(url, { margin: 1, width: 220 }); if (!cancelled) qr.value = image }
  catch (e) { error.value = message(e) }
})
async function savePreference(key, value) {
  const previous = config.value[key]
  config.value[key] = value
  try { await window.pz.config.save({ [key]: value }); if (key === 'preferredIp') await pollStatus() }
  catch (e) { config.value[key] = previous; error.value = message(e) }
}
async function toggleSidebar() {
  sidebar.value = !sidebar.value
  await savePreference('sidebarOpen', sidebar.value)
  sidebar.value = config.value.sidebarOpen
}

function rememberMapPreferences(event) {
  if (!previewUrl.value || event.source !== mapIframe.value?.contentWindow || event.origin !== new URL(previewUrl.value).origin) return
  if (event.data?.type === 'pz-lan-map-ready') {
    lifecycleReady = true
    postToMap({ type: 'pz-lan-map-activity', active: !document.hidden && active.value === 'map', state: mapState })
    mapState = null
    return
  }
  if (event.data?.type === 'pz-lan-map-snapshot') {
    if (document.hidden && event.data.request === suspendRequest) {
      mapState = event.data.state
      previewSuspended.value = true
      lifecycleReady = false
    }
    return
  }
  if (event.data?.type !== 'pz-lan-map-preferences') return
  void window.pz.config.save({ mapPreferences: event.data.values }).catch(e => { error.value = message(e) })
}
const saved = ref(false)
const saving = ref(false)
const shareAction = ref('')
const sharingBusy = computed(() => Boolean(shareAction.value))
const copying = ref(false)
const themeSaving = ref(false)
const themeOptions = ['light', 'dark', 'system']
const splashVisible = ref(true)
let splashTimer
let splashStarted
function revealInterface() {
  clearTimeout(splashTimer)
  const minimum = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650
  splashTimer = setTimeout(() => { splashVisible.value = false }, Math.max(0, minimum - (performance.now() - splashStarted)))
}
async function switchTheme(theme) {
  if (themeSaving.value || theme === config.value.theme) return
  themeSaving.value = true
  const previous = normalizeTheme(config.value.theme)
  config.value.theme = theme
  applyTheme(theme)
  error.value = ''
  try { await window.pz.config.save({ theme }) }
  catch (e) { config.value.theme = previous; applyTheme(previous); error.value = message(e) }
  finally { themeSaving.value = false }
}
let savedTimer
let copiedTimer
const navItems = [
  { key: 'map', icon: MapLocation }, { key: 'share', icon: Connection },
  { key: 'settings', icon: Setting }, { key: 'about', icon: InfoFilled },
]
const navIndex = computed(() => navItems.findIndex(item => item.key === active.value))
const shareLabel = computed(() => shareAction.value || (status.value.running ? 'stop' : 'start'))
const saveLabel = computed(() => saving.value ? 'saving' : saved.value ? 'settingsSaved' : 'save')
onUnmounted(() => { clearTimeout(savedTimer); clearTimeout(copiedTimer); clearTimeout(splashTimer); clearTimeout(previewTimer); clearTimeout(statusTimer); clearTimeout(suspendTimer); disposed = true; previewRequest++; statusRequest++; document.removeEventListener('visibilitychange', updateActivity); window.removeEventListener('message', rememberMapPreferences) })
const workspace = ref(null)
watch(active, () => workspace.value?.scrollTo({ top: 0 }), { flush: 'post' })
const featureItems = [
  { icon: MapLocation, title: 'featureMapTitle', description: 'featureLiveMap' },
  { icon: Iphone, title: 'featureLanTitle', description: 'featureLan' },
  { icon: FullScreen, title: 'featureTouchTitle', description: 'featureTouch' },
  { icon: Lock, title: 'featurePrivacyTitle', description: 'featurePrivacy' },
]
function openExternal(url) { void window.pz.preview.open(url) }
// Vue refs expose reactive proxies, which Electron IPC cannot structured-clone.
// Send a plain snapshot across the contextBridge boundary.
const configSnapshot = () => ({ ...config.value })
async function validate() {
  const snapshot = configSnapshot()
  try {
    if (!window.pz?.config?.validate) throw new Error(t('desktopUnavailable'))
    const result = await window.pz.config.validate(snapshot)
    if (snapshot.webDir === config.value.webDir && snapshot.dataDir === config.value.dataDir) validation.value = result
  } catch (e) { error.value = message(e) }
}
async function choose(key) {
  try {
    const dir = await window.pz.dialog.directory()
    if (dir) { config.value[key] = dir; await validate(); await window.pz.config.save(configSnapshot()) }
  } catch (e) { error.value = t('chooseDirectoryError', { message: message(e) }) }
}
async function save() { await window.pz.config.save(configSnapshot()); await validate() }
async function saveSettings() {
  if (saving.value) return
  saving.value = true
  saved.value = false
  clearTimeout(savedTimer)
  error.value = ''
  const snapshot = JSON.stringify(configSnapshot())
  try {
    await save()
    saved.value = snapshot === JSON.stringify(configSnapshot())
    savedTimer = setTimeout(() => { saved.value = false }, 1800)
  } catch (e) { error.value = message(e) }
  finally { saving.value = false }
}
watch(() => [config.value.webDir, config.value.dataDir, config.value.port], () => { saved.value = false })
async function start() {
  if (sharingBusy.value) return
  statusRequest++
  shareAction.value = 'starting'
  error.value = ''
  try {
    await save()
    status.value = { running: true, ...(await window.pz.server.start(configSnapshot())) }
    await pollStatus()
  } catch (e) { error.value = message(e) }
  finally { shareAction.value = '' }
}
async function stop() {
  if (sharingBusy.value) return
  statusRequest++
  shareAction.value = 'stopping'
  error.value = ''
  try {
    await window.pz.server.stop()
    status.value = { running: false }
    qr.value = ''
    copied.value = false
    clearTimeout(copiedTimer)
  } catch (e) { error.value = message(e) }
  finally { shareAction.value = '' }
}
async function copy() {
  if (copying.value) return
  copying.value = true
  error.value = ''
  try {
    await navigator.clipboard.writeText(webUrl.value)
    copied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copied.value = false }, 1600)
  } catch (e) { error.value = message(e) }
  finally { copying.value = false }
}
async function firewall() {
  if (firewallBusy.value) return
  firewallBusy.value = true; firewallDone.value = false; error.value = ''
  try {
    const result = await window.pz.firewall.add(status.value.running ? status.value.port : config.value.port)
    firewallDone.value = result.ok
    if (!result.ok) error.value = message(result)
  } catch (e) { error.value = message(e) }
  finally { firewallBusy.value = false }
}
watch(() => [config.value.port, status.value.port], () => { firewallDone.value = false })
async function minimizeWindow() { await window.pz?.window?.minimize?.() }
async function toggleMaximizeWindow() { await window.pz?.window?.toggleMaximize?.() }
async function closeWindow() { await window.pz?.window?.close?.() }
async function detect() {
  const initialPath = config.value.webDir
  const result = await window.pz.config.detect()
  if (result?.config?.webDir && config.value.webDir === initialPath) config.value.webDir = result.config.webDir
  await validate()
}
async function refreshPreview() {
  if (!window.pz?.preview?.refresh) return
  clearTimeout(previewTimer)
  const request = ++previewRequest
  try {
    const result = await window.pz.preview.refresh(configSnapshot())
    if (request !== previewRequest || result.stale) return
    previewUrl.value = result.url; validation.value = result.validation
    previewRetained.value = Boolean(result.retained)
  } catch (e) { if (request === previewRequest) error.value = message(e) }
}
watch(() => [config.value.webDir, config.value.dataDir], () => {
  if (!initialized.value) return
  previewRequest++
  clearTimeout(previewTimer)
  previewTimer = setTimeout(refreshPreview, 400)
})
async function switchLang(language = locale.value === 'zh-CN' ? 'en' : 'zh-CN') {
  locale.value = language
  config.value.language = language
  try { await window.pz.config.save({ language }) } catch (e) { error.value = message(e) }
}
onMounted(async () => {
  window.addEventListener('message', rememberMapPreferences)
  document.addEventListener('visibilitychange', updateActivity)
  splashStarted = performance.now()
  // Always expose the usable shell, even if IPC or drive discovery stalls.
  splashTimer = setTimeout(() => { splashVisible.value = false }, 900)
  try {
    if (!window.pz?.config?.get) throw new Error(t('desktopUnavailable'))
    config.value = { ...config.value, ...(await window.pz.config.get()) }
    config.value.theme = normalizeTheme(config.value.theme)
    sidebar.value = config.value.sidebarOpen !== false
    applyTheme(config.value.theme)
    if (config.value.language === 'zh-CN' || config.value.language === 'en') locale.value = config.value.language
    revealInterface()
    await nextTick()
    initialized.value = true
    if (config.value.webDir) void refreshPreview()
    updateActivity()
    // Directory changes schedule their own refresh. Do not reload the same map.
    await detect()
  } catch (e) { error.value = message(e); revealInterface() }
})
</script>
<template>
  <main class="shell" :style="{ '--ui-scale': (config.uiScale || 100) / 100 }">
    <div class="titlebar">
      <span class="titlebar-name"><img class="titlebar-mark" :src="appIcon" alt="" />{{ t('appName') }}</span>
      <div class="window-actions">
        <button :aria-label="t('windowMinimize')" @click="minimizeWindow"><ElIcon><Minus /></ElIcon></button>
        <button :aria-label="t('windowMaximize')" @click="toggleMaximizeWindow"><span class="maximize-square" aria-hidden="true"></span></button>
        <button class="close" :aria-label="t('windowClose')" @click="closeWindow"><ElIcon><Close /></ElIcon></button>
      </div>
    </div>
    <Transition name="splash">
      <div v-if="splashVisible" class="startup-splash" role="status" :aria-label="t('startingApp')">
        <div class="splash-content">
          <img class="splash-icon" :src="appIcon" alt="" />
          <p class="splash-name">{{ t('appName') }}</p>
          <div class="splash-dots" aria-hidden="true"><span></span><span></span><span></span></div>
        </div>
      </div>
    </Transition>
    <aside :inert="splashVisible" :class="['sidebar', { collapsed: !sidebar }]">
      <div class="brand" :title="t('appName')"><img class="brand-mark" :src="appIcon" alt="" /><span class="brand-name sidebar-label"><strong>PZ Map</strong><small>LAN Server</small></span></div>
      <nav :style="{ '--nav-index': navIndex }">
        <button v-for="item in navItems" :key="item.key" :class="{ active: active === item.key }" :title="t(item.key)" :aria-label="t(item.key)" :aria-current="active === item.key ? 'page' : undefined" @click="active = item.key">
          <ElIcon><component :is="item.icon" /></ElIcon><b class="sidebar-label">{{ t(item.key) }}</b>
        </button>
      </nav>
      <div class="sidebar-summary sidebar-label">
        <div class="eyebrow">{{ t('mapPreview') }}</div>
        <div class="summary-row"><span>{{ t('webDir') }}</span><ElIcon :class="validation.webValid ? 'ok' : 'bad'"><component :is="validation.webValid ? Check : WarningFilled" /></ElIcon></div>
        <div class="summary-row"><span>{{ t('dataDir') }}</span><ElIcon :class="validation.dataValid ? 'ok' : 'bad'"><component :is="validation.dataValid ? Check : WarningFilled" /></ElIcon></div>
        <div class="summary-row"><span>{{ t('share') }}</span><span :class="{ ok: status.running }">{{ t(status.running ? 'running' : 'stopped') }}</span></div>
      </div>
      <div class="sidebar-footer">
        <button :title="t('language')" @click="switchLang()">{{ locale === 'zh-CN' ? 'EN' : 'CN' }}</button>
        <small class="sidebar-label">{{ t('aboutVersion') }} {{ version }}</small>
        <button :aria-label="t('toggleSidebar')" :title="t('toggleSidebar')" @click="toggleSidebar"><ElIcon><Fold /></ElIcon></button>
      </div>
    </aside>
    <section ref="workspace" :inert="splashVisible" :class="['workspace', { 'map-workspace': active === 'map' }]">
      <header class="page-header">
        <div><small>PZ MAP LAN SERVER</small><h1><span :key="active" class="feedback-text">{{ t(active) }}</span></h1></div>
        <div v-if="active !== 'about'" class="status-pill" :class="{ live: status.running }">{{ t(status.running ? 'running' : 'stopped') }}</div>
      </header>
      <div v-if="!ready && active !== 'about' && active !== 'settings'" class="notice">
        <ElIcon><WarningFilled /></ElIcon><p>{{ t('setupRequired') }}</p><button class="secondary" @click="active = 'settings'">{{ t('settings') }}</button>
      </div>
      <p v-if="active === 'map' && previewRetained" class="warning">{{ t('previewRetained') }}</p>
      <p v-if="active === 'map' && ['fallback', 'untested'].includes(compatibility.state)" class="warning">{{ t('compat_' + compatibility.state) }}</p>
      <Transition name="page">
      <div v-show="active === 'map'" class="map-frame">
        <iframe v-if="previewUrl && !previewSuspended" ref="mapIframe" @load="syncMapActivity" :src="previewUrl" :title="t('localPreview')"></iframe>
        <div v-else class="map-empty"><ElIcon class="map-icon"><MapLocation /></ElIcon><h2>{{ t(ready ? 'mapPreviewLoading' : 'missing') }}</h2><p>{{ t(ready ? 'mapPreviewDescription' : 'setupRequired') }}</p><button class="primary" @click="active = 'settings'">{{ t('settings') }}</button></div>
      </div>
      </Transition>
      <Transition name="page">
      <section v-show="active === 'share'" class="content-page share-page">
        <article class="card share-hub">
          <div class="share-controls">
            <span class="eyebrow">{{ t('share') }}</span>
            <h2><span :key="status.running" class="feedback-text">{{ t(status.running ? 'sharingReady' : 'sharingStopped') }}</span></h2>
            <p class="description">{{ t('shareDescription') }}</p>
            <button class="share-button" :class="status.running ? 'secondary' : 'primary'" :disabled="sharingBusy" :aria-busy="sharingBusy" @click="status.running ? stop() : start()"><span :key="shareLabel" class="feedback-text">{{ t(shareLabel) }}</span></button>
            <div class="address-block">
              <label>{{ t('address') }}</label>
              <div class="address-content">
                <Transition name="crossfade">
                  <div v-if="status.running" key="address" class="address-row"><code>{{ webUrl }}</code><button class="secondary copy-button" :disabled="copying" @click="copy"><ElIcon><CopyDocument /></ElIcon><span :key="copied" class="feedback-text">{{ t(copied ? 'copied' : 'copy') }}</span></button></div>
                  <p v-else key="pending" class="muted">{{ t('addressPending') }}</p>
                </Transition>
              </div>
            </div>
            <small>{{ t('lanOnly') }}</small>
          </div>
          <div class="qr-panel">
            <h3>{{ t('qr') }}</h3>
            <div class="qr-slot"><Transition name="crossfade">
              <img v-if="qr" key="qr" class="qr-image" :src="qr" :alt="t('qr')" />
              <div v-else key="pending" class="qr-placeholder" aria-hidden="true"></div>
            </Transition></div>
            <p>{{ t(status.running ? 'scanHint' : 'qrPending') }}</p>
          </div>
        </article>
        <article class="card live-status-card">
          <div class="section-heading"><h2>{{ t('liveStatus') }}</h2><span class="muted">{{ t('statusRefresh') }}</span></div>
          <dl class="live-status-grid">
            <div><dt>{{ t('gameData') }}</dt><dd :class="game.state === 'live' ? 'ok' : 'muted'">{{ t('game_' + game.state) }}</dd></div>
            <div><dt>{{ t('lastUpdate') }}</dt><dd>{{ formattedTime(game.updatedAt) }}</dd></div>
            <div><dt>{{ t('devices') }}</dt><dd>{{ (status.clients || []).length }}</dd></div>
          </dl>
          <p v-if="status.configChanged" class="warning">{{ t('restartRequired') }}</p>
          <p v-if="connectionIssue" class="warning">{{ t('error_' + connectionIssue) }}</p>
          <p v-if="game.state !== 'live'" class="description">{{ t('gameHint_' + game.state) }}</p>
          <div class="device-list"><div v-for="client in (status.clients || [])" :key="client.ip"><code>{{ client.ip }}</code><span>{{ t('lastSeen') }} {{ formattedTime(client.lastSeen) }}</span></div></div>
          <p class="description">{{ t('devicesHint') }}</p>
          <details class="connection-help"><summary>{{ t('connectionHelp') }}</summary><p class="description">{{ t('connectionHelpText') }}</p></details>
        </article>
        <section class="guide-section">
          <h2 class="section-title">{{ t('connectionGuide') }}</h2>
          <ol class="steps"><li v-for="step in [1, 2, 3]" :key="step"><span class="step-number">{{ step }}</span><p>{{ t('connectionGuideStep' + step) }}</p></li></ol>
        </section>
        <article class="card network-card">
          <div class="section-heading"><h2>{{ t('networkStatus') }}</h2><span class="muted">{{ t('lanOnly') }}</span></div>
          <dl class="network-details"><div><dt>{{ t('lan') }}</dt><dd>{{ status.ip || '—' }}</dd></div><div><dt>{{ t('port') }}</dt><dd>{{ status.running ? status.port : config.port }}</dd></div></dl>
          <label class="adapter-select"><span>{{ t('networkAdapter') }}</span><select :value="config.preferredIp || ''" @change="savePreference('preferredIp', $event.target.value)"><option value="">{{ t('automatic') }}</option><option v-for="adapter in networkChoices" :key="adapter.ip" :value="adapter.ip">{{ adapter.name }} · {{ adapter.ip }}{{ adapter.virtual ? ' (' + t('virtualAdapter') + ')' : '' }}</option><option v-if="config.preferredIp && !networkChoices.some(a => a.ip === config.preferredIp)" :value="config.preferredIp">{{ config.preferredIp }} · {{ t('unavailable') }}</option></select></label>
          <p v-if="profiles.some(p => p.NetworkCategory === 'Public')" class="warning">{{ t('publicNetwork') }}</p>
          <div class="firewall-row"><p class="description">{{ t('firewallHint') }}</p><button class="secondary" :disabled="firewallBusy" :aria-busy="firewallBusy" @click="firewall">{{ t(firewallBusy ? 'firewallWorking' : firewallDone ? 'firewallDone' : 'firewall') }}</button></div>
        </article>
      </section>
      </Transition>
      <Transition name="page">
      <section v-show="active === 'settings'" class="content-page settings-page">
        <form class="card settings-form" @submit.prevent="saveSettings">
          <section class="settings-section">
            <div class="section-heading"><div><h2>{{ t('pathsSection') }}</h2><p class="description">{{ t('pathsHint') }}</p></div><span class="section-status" :class="ready ? 'ok' : 'bad'">{{ t(ready ? 'configured' : 'notConfigured') }}</span></div>
            <div class="setting-row" v-for="field in [{ key: 'webDir', valid: validation.webValid }, { key: 'dataDir', valid: validation.dataValid }]" :key="field.key">
              <label :for="field.key">{{ t(field.key) }}</label>
              <div class="setting-control"><div class="field"><input :id="field.key" v-model="config[field.key]" @change="validate" /><button type="button" class="secondary" @click="choose(field.key)"><ElIcon><FolderOpened /></ElIcon>{{ t('browse') }}</button></div><span class="validation-text" :class="field.valid ? 'ok' : 'bad'">{{ t(field.valid ? 'valid' : 'invalid') }}</span></div>
            </div>
          </section>
          <section class="settings-section">
            <h2>{{ t('serviceSection') }}</h2>
            <div class="setting-row"><label for="port">{{ t('port') }}</label><div class="setting-control"><input id="port" v-model.number="config.port" type="number" min="1024" max="65535" required /><p class="description">{{ t('portHint') }}</p></div></div>
          </section>
          <section class="settings-section">
            <h2>{{ t('appearanceSection') }}</h2>
            <div class="setting-row"><label for="ui-scale">{{ t('uiScale') }}</label><div class="setting-control"><select id="ui-scale" :value="config.uiScale" @change="savePreference('uiScale', Number($event.target.value))"><option v-for="scale in [90, 100, 110, 125, 150]" :key="scale" :value="scale">{{ scale }}%</option></select><p class="description">{{ t('uiScaleHint') }}</p></div></div>
            <div class="setting-row"><label for="close-behavior">{{ t('closeBehavior') }}</label><div class="setting-control"><select id="close-behavior" :value="config.closeBehavior" @change="savePreference('closeBehavior', $event.target.value)"><option value="quit">{{ t('closeQuit') }}</option><option value="tray" :disabled="config.trayAvailable === false">{{ t('closeTray') }}</option></select><p class="description">{{ t('closeHint') }}</p></div></div>
            <div class="setting-row"><span id="theme-label">{{ t('theme') }}</span><div class="setting-control"><div class="language-options theme-options" role="group" aria-labelledby="theme-label" :aria-busy="themeSaving"><button v-for="theme in themeOptions" :key="theme" type="button" :aria-pressed="config.theme === theme" :disabled="themeSaving" @click="switchTheme(theme)">{{ t('theme_' + theme) }}</button></div><p class="description">{{ t('themeHint') }}</p></div></div>
            <div class="setting-row"><span id="language-label">{{ t('language') }}</span><div class="setting-control"><div class="language-options" role="group" aria-labelledby="language-label"><button type="button" :aria-pressed="locale === 'zh-CN'" @click="switchLang('zh-CN')">中文</button><button type="button" :aria-pressed="locale === 'en'" @click="switchLang('en')">English</button></div><p class="description">{{ t('languageHint') }}</p></div></div>
          </section>
          <section class="settings-section"><h2>{{ t('compatibility') }}</h2><p class="description">{{ t('detectedVersion') }} {{ compatibility.version || '—' }}</p><p class="description" :class="{ warning: compatibility.state === 'fallback' }">{{ t('compat_' + compatibility.state) }}</p></section>
          <footer class="settings-footer"><span class="muted" role="status"><span :key="saved" class="feedback-text">{{ t(saved ? 'settingsSaved' : 'saveHint') }}</span></span><button type="submit" class="primary save-button" :disabled="saving" :aria-busy="saving"><span :key="saveLabel" class="feedback-text">{{ t(saveLabel) }}</span></button></footer>
        </form>
      </section>
      </Transition>
      <Transition name="page">
      <section v-show="active === 'about'" class="content-page about-page">
        <div class="about-heading"><img class="app-icon-mark" :src="appIcon" alt="" /><h2>{{ t('appName') }}</h2><p>{{ t('aboutVersion') }} {{ version }}</p></div>
        <section class="about-section"><h2 class="section-title">{{ t('features') }}</h2><div class="feature-grid"><article v-for="feature in featureItems" :key="feature.title" class="card feature-item"><ElIcon><component :is="feature.icon" /></ElIcon><div><h3>{{ t(feature.title) }}</h3><p class="description">{{ t(feature.description) }}</p></div></article></div></section>
        <section class="about-section author-section"><h2 class="section-title">{{ t('author') }}</h2><a class="author-profile" href="https://github.com/TiiJeiJ8" @click.prevent="openExternal('https://github.com/TiiJeiJ8')"><img class="author-avatar" src="../assets/author-avatar.jpg" alt="TiiJeiJ8"/><strong>TiiJeiJ8</strong><span>github.com/TiiJeiJ8 <ElIcon><Link /></ElIcon></span></a></section>
        <footer class="about-footer"><span>{{ t('license') }} · MIT</span><a href="https://steamcommunity.com/sharedfiles/filedetails/?id=3770149036" @click.prevent="openExternal('https://steamcommunity.com/sharedfiles/filedetails/?id=3770149036')">{{ t('workshop') }} <ElIcon><Link /></ElIcon></a></footer>
      </section>
      </Transition>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
    </section>
  </main>
</template>
