// Only authored UI translations are shipped. Original map files stay on disk untouched.
const chinese = {
  state: '状态', zoom: '缩放', players: '玩家', connecting: '连接中', live: '实时同步',
  'no heartbeat': '未收到游戏数据', 'no survivor': '无存活角色', paused: '已暂停', menu: '主菜单',
  'Player marker': '玩家标记', 'Other players': '其他玩家', 'Compass direction': '指南针方向',
  'Marker size': '标记大小', 'Show names': '显示名称', 'Persistent names': '始终显示名称',
  'Admin: see all players': '管理员：显示所有玩家', Labels: '地名标注',
  'Town & place names': '城镇与地点名称', 'Building names': '建筑名称', 'Street names': '街道名称',
  'Water & forest names': '水域与森林名称', 'Label size': '标注大小', Notes: '笔记',
  'Persistent symbols': '始终显示符号', 'Note size': '笔记大小', 'Flyers & Annotations': '传单与注释',
  'Persistent flyer names': '始终显示传单名称', 'Flyer size': '传单大小', Fog: '战争迷雾',
  'Darkness (needs light)': '黑暗效果（需要光照）', 'Cell grid': '区块网格', 'Map key': '地图图例',
  Isometric: '等距视角', 'Theme - Dark Map': '深色地图', 'UI size': '界面大小',
  'Reset all': '重置全部', 'Sure?': '确认重置？', Support: '支持与诊断', Close: '关闭', Dismiss: '关闭提示',
  Community: '公共设施', Hospitality: '住宿', Industrial: '工业', Medical: '医疗', Parks: '公园',
  Residential: '住宅', 'Restaurants & Entertainment': '餐饮与娱乐', 'Retail & Commercial': '零售与商业',
  overview: '全图', follow: '跟随', 'Map controls': '地图设置', 'Zoom in': '放大', 'Zoom out': '缩小',
  'Need a compass - shows direction': '需要指南针才能显示方向',
  'Isometric / north-up view': '等距视角 / 正北朝上', 'Toggle isometric view': '切换等距视角',
  'Show the whole map': '查看完整地图', 'Follow player': '跟随玩家',
  'Flyers & annotations - found flyers and annotated maps': '传单与注释：已发现的传单和注释地图',
  'Toggle flyer and annotated-map markers': '切换传单与注释地图标记',
  'Toggle Player marker group': '展开或收起玩家标记选项', 'Toggle Other players group': '展开或收起其他玩家选项',
  'Toggle Labels group': '展开或收起地名标注选项', 'Toggle Notes group': '展开或收起笔记选项',
  'Toggle Flyers and Annotations group': '展开或收起传单与注释选项',
  "Other players' marker size": '其他玩家标记大小',
  "Other players' positions in multiplayer - if the server allows it": '多人模式下其他玩家的位置（需服务器允许）',
  'Show usernames beside player marks': '在玩家标记旁显示用户名',
  'Keep names visible at every zoom instead of hiding them on the overview': '在所有缩放级别显示名称，包括全图视图',
  "Your role can see every player regardless of this server's visibility setting. Off: PZ Map applies that setting to you as well.": '你的角色有权查看所有玩家。关闭后，PZ Map 将遵守服务器的玩家可见性设置。',
  "Dim the map when it is too dark for your survivor to read it - follows the game's light, like the in-game map": '角色所处环境过暗时调暗地图，遵循游戏中的光照',
  "Dark color palette for the map itself - your choice, not the game's clock": '只切换地图本身的配色，独立于应用主题和游戏时间',
  'Size of the chrome - drawer, toolbar, map key': '调整设置面板、工具栏和图例的大小',
  'Reset every map option - toggles, mark sizes and UI size - to defaults': '将地图开关、标记大小与界面大小全部恢复默认',
  'Open the support panel - copy a diagnostic log to paste into a bug report (Shift-Z)': '打开诊断面板，可复制日志用于问题反馈（Shift-Z）',
  'PZ_Map support (Shift-Z)': 'PZ_Map 支持与诊断（Shift-Z）',
  'Layered rendering (translate3d layers)': '分层渲染（translate3d 图层）', 'WebGL fog shader': 'WebGL 迷雾着色器',
  'Firefox fog-smoothing workaround': 'Firefox 迷雾平滑兼容处理', 'Run pan test (3s)': '平移测试（3 秒）',
  'at z': '缩放级别', 'Copy log': '复制日志', 'Smooth motion': '平滑动画', 'Render scale': '渲染分辨率',
  'Glides zoom/pan/heading between samples. Off = instant snaps (feels janky).': '平滑过渡缩放、平移与方向变化；关闭后立即跳转',
  'Lower this if the map is choppy (weak GPU / Firefox / 4K).': '地图卡顿时可降低渲染分辨率（低性能显卡 / Firefox / 4K）',
  'Zoom the test runs at. 15 is the default and what every earlier report used -- change it only to chase a zoom-specific complaint.': '测试使用的缩放级别，默认为 15；仅排查特定缩放问题时调整',
  'running pan test...': '正在测试平移…', 'done - click "Copy log", then paste it into your report': '测试完成，请点击“复制日志”并粘贴到问题报告',
  'Server disabled the player marker.': '服务器已禁用玩家标记。', 'Server disabled the direction cone.': '服务器已禁用方向指示。',
  'Server locked fog of war on.': '服务器强制开启战争迷雾。', 'Server locked darkness on.': '服务器强制开启黑暗效果。',
  'Follow is off - the server disabled the player marker': '无法跟随：服务器已禁用玩家标记',
  'Direction is off - the server disabled the player marker': '无法显示方向：服务器已禁用玩家标记',
  'Direction is off - the server disabled the direction cone': '无法显示方向：服务器已禁用方向指示',
  'Compass direction disabled - the Player marker is turned off': '指南针方向已关闭：请先开启玩家标记',
  'Compass direction disabled - turn on Player > Compass direction in the map controls': '指南针方向已关闭：请开启玩家标记下的指南针方向',
  'This server shows direction without a compass': '此服务器允许无指南针显示方向', 'Compass - shows direction': '指南针：显示方向',
  singleplayer: '单人模式', Singleplayer: '单人模式', 'no other players to show': '没有其他玩家可显示',
  'no live link': '无实时连接', 'No live link': '无实时连接', 'no player position data': '没有玩家位置数据',
  'asking server': '正在请求服务器', Server: '服务器', 'waiting for the player list': '正在等待玩家列表',
  'no PZ Map on server': '服务器未启用 PZ Map', 'no player list sent': '未收到玩家列表',
  'older PZ Map, or not enabled server-side': '服务器的 PZ Map 版本过旧或未启用',
  'off on this server': '服务器已关闭', 'PZ Map server setting': 'PZ Map 服务器设置',
  'Show multiplayer positions': '显示多人位置', 'switched off': '已关闭', 'no mode reported': '未报告可见性模式',
  'Server setting': '服务器设置', 'not reported by this server': '服务器未报告此设置',
  'nobody but you is shown': '只显示自己', 'nobody is shown': '不显示任何玩家',
  'unknown server mode': '未知服务器模式', 'not recognized - valid values are 1-4': '无法识别，有效范围为 1–4',
  'hidden by server': '服务器已隐藏',
  Hidden: '隐藏', Friends: '好友', 'Friends and nearby players': '好友与附近玩家', Everyone: '所有人',
  'Friends: same faction or safehouse': '好友：同阵营或同安全屋', 'Admin override checked': '已启用管理员覆盖',
  'off in map controls': '已在地图设置中关闭', '"Other players" is switched off': '“其他玩家”已关闭',
  'PZ Map shows friends - not nearby players': 'PZ Map 仅显示好友，不显示附近玩家',
  'log copied to clipboard - paste it into your report': '日志已复制到剪贴板，请粘贴到问题报告',
  'could not copy - the log is selected below, press Ctrl+C': '自动复制失败，请对下方已选中的日志按 Ctrl+C',
  'Still reading this world’s map mod. A large map takes a few seconds to appear.': '正在读取当前世界的地图模组，大型地图需要等待几秒。',
  'This world is not the map PZ Map ships, so there is nothing to draw here. A custom map appears on its own once the game has finished reading it; if nothing ever does, this world’s map could not be read.': '当前世界不在 PZ Map 的内置地图中。游戏读取完成后，自定义地图会自动显示；若始终没有显示，则表示该世界的地图未能读取。',
  'Map data was built for': '地图数据适用版本：', ', but this game is': '，当前游戏版本：',
  '. Place names and details may not match what you see in game.': '。地名和细节可能与游戏内不同。',
  'This address is missing the': '此地址缺少',
  'part that tells the page where your game writes its data, so it cannot connect.': '数据目录参数，无法连接到游戏。',
  "No data from the game yet. Load a save if you haven't. Otherwise this address may be incomplete or pointed at a folder that has moved.": '尚未收到游戏数据，请先加载存档；若已加载，请检查地址是否完整、数据目录是否已移动。',
  'Connected using the data folder remembered by this browser. This address is missing its own': '已使用浏览器记住的数据目录连接。此地址仍缺少',
  'part, so it will only work in this browser.': '参数，因此只能在当前浏览器中使用。',
  'In game: Options > Mods > PZ Map >': '游戏内：选项 > 模组 > PZ Map >', 'Copy map URL': '复制地图地址',
  ', then paste that in and bookmark it.': '，然后粘贴新地址并保存书签。',
}

export const normalizeAppearance = ({ theme, language } = {}) => ({
  theme: ['light', 'dark', 'system'].includes(theme) ? theme : 'system',
  language: ['zh-CN', 'en'].includes(language) ? language : '',
})

// Serialized into the served page. Do not capture module variables here.
function installAppearance(initial, dictionary, embeddedPreferences) {
  // Run in the head before the mod restores its options. Only fill missing
  // values: existing choices (and the mod's server-enforced rules) still win.
  try {
    if (embeddedPreferences) {
      for (const key of ['pzmap.toggles', 'pzmap.drawer']) {
        if (typeof embeddedPreferences[key] === 'string') localStorage.setItem(key, embeddedPreferences[key])
      }
    }
    let toggles
    try { toggles = JSON.parse(localStorage.getItem('pzmap.toggles') || '{}') } catch { toggles = {} }
    if (!toggles || typeof toggles !== 'object' || Array.isArray(toggles)) toggles = {}
    if (typeof toggles.fog !== 'boolean') toggles.fog = false
    if (typeof toggles.key !== 'boolean') toggles.key = true
    localStorage.setItem('pzmap.toggles', JSON.stringify(toggles))
    if (localStorage.getItem('pzmap.drawer') === null) localStorage.setItem('pzmap.drawer', '0')
  } catch { /* Browsers that block storage retain the mod's built-in defaults. */ }
  // The mod already engages follow whenever the live link is established,
  // including a reconnect, and respects servers that disable player positions.
  let preferences = initial
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const scope = '#drawer, #toolbar, #mapkey, #uipop, #banners, #pzmap-debug'
  const originals = new WeakMap()
  let observer
  let stream
  let lastSaved = ''
  function rememberPreferences() {
    if (!embeddedPreferences || window.parent === window) return
    try {
      const values = { 'pzmap.toggles': localStorage.getItem('pzmap.toggles'), 'pzmap.drawer': localStorage.getItem('pzmap.drawer') }
      const serialized = JSON.stringify(values)
      if (serialized === lastSaved) return
      lastSaved = serialized
      // file:// parents have opaque origins; the receiving app validates both
      // this frame's exact window identity and its loopback origin.
      window.parent.postMessage({ type: 'pz-lan-map-preferences', values }, '*')
    } catch { /* Storage can be disabled by browser policy. */ }
  }
  const language = () => preferences.language || (navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en')
  function translate(value) {
    if (language() !== 'zh-CN') return value
    return value.split('\n').map(line => {
      const key = line.trim()
      let translated = Object.hasOwn(dictionary, key) ? dictionary[key] : undefined
      if (!translated && key.endsWith(':') && dictionary[key.slice(0, -1)]) translated = dictionary[key.slice(0, -1)] + '：'
      if (!translated && key.startsWith('(') && key.endsWith(')') && dictionary[key.slice(1, -1)]) translated = '（' + dictionary[key.slice(1, -1)] + '）'
      const peers = key.match(/^(none visible|([\d,]+) visible)( \(admin\)| \(friends only\))?$/)
      if (peers) translated = (peers[2] ? peers[2] + ' 位可见玩家' : '没有可见玩家') + (peers[3] === ' (admin)' ? '（管理员）' : peers[3] ? '（仅好友）' : '')
      const maps = key.match(/^Still reading this world’s map mods \((\d+) of (\d+) ready\)\. A large map takes a few seconds to appear\.$/)
      if (maps) translated = '正在读取地图模组（' + maps[1] + '/' + maps[2] + ' 已就绪），大型地图需要等待几秒。'
      return translated ? line.replace(key, translated) : line
    }).join('\n')
  }
  function update(node, key, value, write) {
    let record = originals.get(node)
    if (!record) { record = {}; originals.set(node, record) }
    if (!record[key] || record[key].output !== value) record[key] = { source: value }
    const output = translate(record[key].source)
    record[key].output = output
    if (output !== value) write(output)
  }
  function visit(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Diagnostic logs, user data, editable fields and key bindings are never translated.
      if (node.parentElement?.closest(scope) && !node.parentElement.closest('pre, textarea, input, kbd, script, style')) {
        update(node, 'text', node.nodeValue, value => { node.nodeValue = value })
      }
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    if (node.closest(scope)) {
      for (const attribute of ['title', 'aria-label']) {
        if (node.hasAttribute(attribute)) update(node, attribute, node.getAttribute(attribute), value => node.setAttribute(attribute, value))
      }
    }
    if (!node.matches('pre, textarea, input, script, style, kbd')) for (const child of node.childNodes) visit(child)
  }
  function apply() {
    document.documentElement.dataset.pzLanTheme = preferences.theme === 'system' ? (media.matches ? 'dark' : 'light') : preferences.theme
    document.documentElement.lang = language()
    document.querySelectorAll(scope).forEach(visit)
  }
  function connect() {
    stream?.close()
    stream = new EventSource('/__pz/appearance')
    stream.onmessage = event => {
      try { preferences = JSON.parse(event.data); apply() } catch { /* Keep current appearance during reconnection. */ }
    }
  }
  // Set colors in the head, before the first frame. Observe only UI text/labels,
  // never the canvas, styles or the map's rendering state.
  apply()
  media.addEventListener('change', apply)
  function mount() {
    apply()
    observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList') record.addedNodes.forEach(visit)
        else visit(record.target)
      }
    })
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label'] })
    connect()
    if (embeddedPreferences) {
      rememberPreferences()
    }
  }
  if (embeddedPreferences) {
    for (const type of ['click', 'change', 'input', 'keydown']) {
      document.addEventListener(type, () => queueMicrotask(rememberPreferences))
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true })
  else mount()
  window.addEventListener('pagehide', () => { stream?.close(); observer?.disconnect() })
  window.addEventListener('pageshow', event => { if (event.persisted) mount() })
}

export function mapAppearanceScript(preferences, embeddedPreferences = null) {
  const data = JSON.stringify(normalizeAppearance(preferences))
  return `<script>(${installAppearance.toString()})(${data},${JSON.stringify(chinese).replaceAll('<', '\\u003c')},${JSON.stringify(embeddedPreferences).replaceAll('<', '\\u003c')});</script>`
}
