// Adapt only served responses. Exact anchors make an incompatible mod update
// fall back to its own renderer rather than partially installing an adapter.
export function enhanceMapMotion(source) {
  const patches = [
    ['function frame(ts) {', 'function frame(ts) {\n    if (PZMap.lanMotion && PZMap.lanMotion.step(view, data, ts)) dirty = true;'],
    ['if (view.iso) { var im = PZMap.isoMat;', 'if (view.iso || view.__pzMotion) { var im = PZMap.mat(view);'],
    ['if (view.iso) {\n    // Tilted:', 'if (view.iso || view.__pzMotion) {\n    // Tilted:'],
    ['<script>PZMapApp.start(', `<script>(${installMapMotion.toString()})();</script>\n<script>PZMapApp.start(`],
  ]
  if (!patches.every(([anchor]) => source.split(anchor).length === 2)) return source
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
  let forestFrames = new Map()
  const motion = map.lanMotion = { active: false }

  // Copy only palette fields. Geometry, fonts, zoom thresholds and alpha remain
  // owned by the mod; never mutate its day style or cached dark style.
  function blendStyle(from, to, t) {
    const rgb = (a, b) => b.map((v, i) => mix(a?.[i] ?? v, v, t))
    const stops = (a, b) => b.map((row, i) => row.map((v, j) => j >= 1 && j <= 3 ? mix(a?.[i]?.[j] ?? v, v, t) : v))
    const result = { ...to }
    for (const key of ['background', 'unvisited', 'unvisitedGrid']) {
      if (to[key]) result[key] = rgb(from[key], to[key])
    }
    result.fogKnown = rgb(from.fogKnown || [127.5, 127.5, 127.5], to.fogKnown || [127.5, 127.5, 127.5])
    for (const key of ['layers', 'textLayers']) {
      result[key] = (to[key] || []).map(layer => ({ ...layer, stops: stops(from[key]?.find(item => item.id === layer.id)?.stops, layer.stops) }))
    }
    if (to.paper) result.paper = { ...to.paper, gray: mix(from.paper?.gray ?? 128, to.paper.gray ?? 128, t), stops: stops(from.paper?.stops, to.paper.stops) }
    return result
  }

  map.applyTheme = function (data, name) {
    const previousName = map.themeName
    const from = data?.style
    const result = original.theme.call(this, data, name)
    if (!data || !mainView || reduced.matches) {
      palette = null
      darkMix = result === 'day' ? 0 : 1
      forestFrames.clear()
      return result
    }
    if (previousName === result) {
      if (palette) data.style = from
      return result
    }
    palette = { from, to: data.style, start: performance.now(), fromDark: darkMix, toDark: result === 'day' ? 0 : 1, tint: map.forestTint }
    data.style = from
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
      const canvas = document.createElement('canvas')
      canvas.width = day.naturalWidth || day.width
      canvas.height = day.naturalHeight || day.height
      entry = { forest, day, dark, canvas, ctx: canvas.getContext('2d'), mix: -1 }
      forestFrames.set(key, entry)
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
    if (!projection) projection = { value: target, from: target, target, start: now, matrix: original.mat(view) }
    if (projection.target !== target) {
      projection.from = projection.value
      projection.target = target
      projection.start = now
    }
    const wasMoving = motion.active
    const t = reduced.matches ? 1 : Math.min(1, Math.max(0, (now - projection.start) / VIEW_DURATION))
    projection.value = mix(projection.from, projection.target, ease(t))
    view.__pzMotion = projection.value !== target
    if (view.__pzMotion) {
      const spin = map.ISO_SPIN * projection.value, tilt = map.ISO_TILT * projection.value
      const cs = Math.cos(spin), sn = Math.sin(spin), ct = Math.cos(tilt)
      projection.matrix = { a: cs, b: ct * sn, c: -sn, d: ct * cs }
    } else projection.matrix = original.mat(view)
    if (palette) {
      const t = reduced.matches ? 1 : Math.min(1, Math.max(0, (now - palette.start) / THEME_DURATION))
      darkMix = mix(palette.fromDark, palette.toDark, ease(t))
      data.style = t === 1 ? palette.to : blendStyle(palette.from, palette.to, ease(t))
      const mask = data._forest?.stops && map.fillAt({ stops: data._forest.stops }, view.zoom)
      const tint = map.THEMES.dark.forestTint.match(/[\d.]+/g).map(Number)
      if (mask) map.forestTint = `rgb(${tint.map((v, i) => mix(mask[i], v, darkMix)).join(',')})`
      map.bindText(data)
      if (t === 1) { map.forestTint = palette.tint; palette = null; forestFrames.clear() }
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
