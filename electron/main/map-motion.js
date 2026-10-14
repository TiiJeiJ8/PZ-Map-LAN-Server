// Adapt only served responses. Exact anchors make an incompatible mod update
// fall back to its own renderer rather than partially installing an adapter.
function motionPatches() {
  return [
    ['function frame(ts) {', 'function frame(ts) {\n    if (PZMap.lanMotion && PZMap.lanMotion.step(view, data, ts)) dirty = true;'],
    ['if (view.iso) { var im = PZMap.isoMat;', 'if (view.iso || view.__pzMotion) { var im = PZMap.mat(view);'],
    ['if (view.iso) {\n    // Tilted:', 'if (view.iso || view.__pzMotion) {\n    // Tilted:'],
    ['<script>PZMapApp.start(', `<script>(${installMapMotion.toString()})();</script>\n<script>PZMapApp.start(`],
  ]
}
export function inspectMapCompatibility(source) {
  const version = source.match(/PZ_MAP_VERSION\s*=\s*["']([^"']+)["']/)?.[1] || ''
  const supported = motionPatches().every(([anchor]) => source.split(anchor).length === 2)
  return { version, motion: supported, state: supported ? (version === '0.8.0' ? 'supported' : 'untested') : 'fallback' }
}
export function enhanceMapMotion(source) {
  const patches = motionPatches()
  if (!inspectMapCompatibility(source).motion) return source
  for (const [anchor, replacement] of patches) source = source.replace(anchor, () => replacement)
  return source
}

function installMapMotion() {
  const map = window.PZMap
  if (!map || !map.mat || !map.applyTheme || !map.forestTile || !map.viewRect) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const VIEW_DURATION = 250
  const THEME_DURATION = 150
  const original = { mat: map.mat, rect: map.viewRect, theme: map.applyTheme, forest: map.forestTile, ink: map.inkColor }
  const ease = t => t * t * (3 - 2 * t)
  const mix = (a, b, t) => a + (b - a) * t
  let mainView, projection, palette, lastTime
  let darkMix = 0
  const forestFrames = new Map()
  let forestPixels = 0
  const forestBudget = 4 * 1024 * 1024
  const motion = map.lanMotion = { active: false }

  // Copy only palette fields. Geometry, fonts, zoom thresholds and alpha remain
  // owned by the mod; never mutate its day style or cached dark style.
  function createStyleBlend(from, to) {
    const slots = []
    function numbers(a, b, rgbOnly = false) {
      return b.map((value, index) => {
        if (Array.isArray(value)) return numbers(a?.[index], value, true)
        if (!rgbOnly || (index >= 1 && index <= 3)) return { start: a?.[index] ?? value, end: value }
        return value
      })
    }
    function buffer(values) {
      return values.map(value => {
        if (Array.isArray(value)) return buffer(value)
        return typeof value === 'object' ? value.start : value
      })
    }
    function compile(a, b, rgbOnly = false) {
      const values = numbers(a, b, rgbOnly), output = buffer(values)
      function collect(values, output) {
        values.forEach((value, index) => {
          if (Array.isArray(value)) collect(value, output[index])
          else if (typeof value === 'object') slots.push({ output, index, ...value })
        })
      }
      collect(values, output)
      return output
    }
    const style = { ...to }
    for (const key of ['background', 'unvisited', 'unvisitedGrid']) if (to[key]) style[key] = compile(from[key], to[key])
    style.fogKnown = compile(from.fogKnown || [127.5, 127.5, 127.5], to.fogKnown || [127.5, 127.5, 127.5])
    for (const key of ['layers', 'textLayers']) {
      const source = new Map((from[key] || []).map(layer => [layer.id, layer]))
      style[key] = (to[key] || []).map(layer => ({ ...layer, stops: compile(source.get(layer.id)?.stops, layer.stops) }))
    }
    if (to.paper) {
      style.paper = { ...to.paper, stops: compile(from.paper?.stops, to.paper.stops) }
      slots.push({ output: style.paper, index: 'gray', start: from.paper?.gray ?? 128, end: to.paper.gray ?? 128 })
    }
    return { style, step(t) { for (const slot of slots) slot.output[slot.index] = mix(slot.start, slot.end, t); return style } }
  }
  function releaseForest(entry) { entry.canvas.width = 0; entry.canvas.height = 0 }
  function clearForestFrames() { for (const entry of forestFrames.values()) releaseForest(entry); forestFrames.clear(); forestPixels = 0 }

  map.applyTheme = function (data, name) {
    const previousName = map.themeName
    const from = data?.style
    const result = original.theme.call(this, data, name)
    if (!data || !mainView || reduced.matches) {
      palette = null
      darkMix = result === 'day' ? 0 : 1
      clearForestFrames()
      return result
    }
    if (previousName === result) {
      if (palette) { data.style = from; map.bindText(data) }
      return result
    }
    palette = { blend: createStyleBlend(from, data.style), to: data.style, darkTint: map.THEMES.dark.forestTint.match(/[\d.]+/g).map(Number), start: performance.now(), fromDark: darkMix, toDark: result === 'day' ? 0 : 1, tint: map.forestTint }
    data.style = palette.blend.style
    map.bindText(data)
    return result
  }

  map.mat = function (view) {
    return view === mainView && projection ? projection.matrix : original.mat(view)
  }
  map.viewRect = function (view, W, H) {
    if (view !== mainView || !view.__pzMotion) return original.rect(view, W, H)
    const s = map.rtScale || map.worldScale(view.zoom, H)
    const corners = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => map.screenToWorld(view, W, H, x, y, s))
    return [Math.min(...corners.map(p => p[0])), Math.min(...corners.map(p => p[1])), Math.max(...corners.map(p => p[0])), Math.max(...corners.map(p => p[1])), s]
  }

  // Forest masks are images, not vector fills. Blend their original day/dark
  // pixels with premultiplied alpha so transparent edges do not become darker.
  map.forestTile = function (forest, q, c, r) {
    if (!palette) return original.forest.call(this, forest, q, c, r)
    const key = `${q}/${c}/${r}`
    let entry = forestFrames.get(key)
    if (!entry || entry.forest !== forest) {
      const tint = map.forestTint
      let day, dark
      try {
        map.forestTint = null
        day = original.forest.call(this, forest, q, c, r)
        map.forestTint = map.THEMES.dark.forestTint
        dark = original.forest.call(this, forest, q, c, r)
      } finally { map.forestTint = tint }
      if (!day || !dark) return day || dark
      if (entry) { forestPixels -= entry.canvas.width * entry.canvas.height; releaseForest(entry); forestFrames.delete(key) }
      const pixels = (day.naturalWidth || day.width) * (day.naturalHeight || day.height)
      // Bound temporary blend surfaces. Keep at most one oversized tile.
      while (forestFrames.size && (forestPixels + pixels > forestBudget || forestFrames.size >= 64)) {
        const oldest = forestFrames.keys().next().value, cached = forestFrames.get(oldest)
        forestPixels -= cached.canvas.width * cached.canvas.height
        releaseForest(cached); forestFrames.delete(oldest)
      }
      const canvas = document.createElement('canvas')
      canvas.width = day.naturalWidth || day.width
      canvas.height = day.naturalHeight || day.height
      entry = { forest, day, dark, canvas, ctx: canvas.getContext('2d'), mix: -1 }
      forestFrames.set(key, entry)
      forestPixels += pixels
    }
    if (entry.mix !== darkMix) {
      const ctx = entry.ctx
      ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1 - darkMix
      ctx.drawImage(entry.day, 0, 0)
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = darkMix
      ctx.drawImage(entry.dark, 0, 0)
      ctx.globalAlpha = 1
      entry.mix = darkMix
    }
    return entry.canvas
  }
  map.inkColor = function (r, g, b) {
    if (!palette) return original.ink(r, g, b)
    const ink = map.noteInk
    let dark
    try { map.noteInk = map.THEMES.dark.ink; dark = original.ink(r, g, b) }
    finally { map.noteInk = ink }
    return [r, g, b].map((v, i) => mix(v, dark[i], darkMix))
  }

  motion.step = function (view, data, timestamp) {
    const now = Number.isFinite(timestamp) ? timestamp : performance.now()
    mainView = view
    const target = view.iso ? 1 : 0
    if (!projection) projection = { value: target, from: target, target, start: now, matrix: { ...original.mat(view) } }
    if (projection.target !== target) {
      projection.from = projection.value
      projection.target = target
      projection.start = now
    }
    const wasMoving = motion.active
    const t = reduced.matches ? 1 : Math.min(1, Math.max(0, (now - projection.start) / VIEW_DURATION))
    const previousValue = projection.value
    projection.value = mix(projection.from, projection.target, ease(t))
    view.__pzMotion = projection.value !== target
    if (view.__pzMotion && previousValue !== projection.value) {
      const spin = map.ISO_SPIN * projection.value, tilt = map.ISO_TILT * projection.value
      const cs = Math.cos(spin), sn = Math.sin(spin), ct = Math.cos(tilt)
      const matrix = projection.matrix
      matrix.a = cs; matrix.b = ct * sn; matrix.c = -sn; matrix.d = ct * cs
    } else if (!view.__pzMotion && previousValue !== target) Object.assign(projection.matrix, original.mat(view))
    if (palette) {
      const t = reduced.matches ? 1 : Math.min(1, Math.max(0, (now - palette.start) / THEME_DURATION))
      darkMix = mix(palette.fromDark, palette.toDark, ease(t))
      data.style = t === 1 ? palette.to : palette.blend.step(ease(t))
      const mask = data._forest?.stops && map.fillAt({ stops: data._forest.stops }, view.zoom)
      const tint = palette.darkTint
      if (mask) map.forestTint = `rgb(${tint.map((v, i) => mix(mask[i], v, darkMix)).join(',')})`
      if (t === 1) { map.bindText(data); map.forestTint = palette.tint; palette = null; clearForestFrames() }
    }
    motion.active = view.__pzMotion || Boolean(palette)
    // All render paths, including WebGL fog, must consume the same matrix and
    // palette in this frame. Stop rebuilding as soon as both transitions settle.
    const changed = motion.active || wasMoving || lastTime === undefined
    if (changed) map._sceneForceRebuild = true
    lastTime = now
    return changed
  }
  const style = document.createElement('style')
  style.textContent = `#mapkey .sw { transition: background-color ${THEME_DURATION}ms ease; } @media (prefers-reduced-motion: reduce) { #mapkey .sw { transition: none; } }`
  document.head.appendChild(style)
}
