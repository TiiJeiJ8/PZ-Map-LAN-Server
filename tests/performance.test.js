import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import { enhanceMapLifecycle } from '../electron/main/map-lifecycle.js'

async function animationHarness() {
  const source = await fs.readFile(new URL('../electron/main/map-motion.js', import.meta.url), 'utf8')
  const canvases = [], media = { matches: false }
  let clock = 0
  const style = n => ({ background: [n, n, n], layers: [{ id: 'road', stops: [[5, n, n, n, 1], [15, n, n, n, 1]] }], textLayers: [], paper: { gray: n, stops: [[0, n, n, n, 1]] } })
  const day = style(200), dark = style(20)
  const map = { themeName: 'day', ISO_SPIN: Math.PI / 4, ISO_TILT: Math.PI / 3, THEMES: { dark: { forestTint: 'rgb(20,30,40)', ink: [20, 30, 40] } },
    mat: view => view.iso ? { a: .7, b: .3, c: -.7, d: .3 } : { a: 1, b: 0, c: 0, d: 1 },
    viewRect() {}, inkColor: (r, g, b) => [r, g, b], bindText() {},
    forestTile: () => ({ width: 1024, height: 1024 }),
    applyTheme(data, name) { this.themeName = name; data.style = name === 'day' ? day : dark; return name },
  }
  const document = { head: { appendChild() {} }, createElement: tag => {
    if (tag !== 'canvas') return {}
    const canvas = { width: 0, height: 0, getContext: () => ({ clearRect() {}, drawImage() {} }) }
    canvases.push(canvas); return canvas
  } }
  const context = { window: { PZMap: map, matchMedia: () => media }, document, performance: { now: () => clock } }
  vm.runInNewContext(source.slice(source.indexOf('function installMapMotion()')) + '\ninstallMapMotion()', context)
  const view = { iso: false }, data = { style: day }
  map.lanMotion.step(view, data, 0)
  return { map, view, data, day, dark, canvases, media, advance(time) { clock = time; map.lanMotion.step(view, data, time) } }
}

test('Palette reuses buffers, preserves authored styles, reverses continuously and ends exactly', async () => {
  const h = await animationHarness()
  const original = JSON.stringify([h.day, h.dark])
  h.map.applyTheme(h.data, 'dark')
  h.advance(30)
  const style = h.data.style, stops = style.layers[0].stops
  const first = style.background[0]
  h.advance(60)
  assert.equal(h.data.style, style)
  assert.equal(h.data.style.layers[0].stops, stops)
  assert(h.data.style.background[0] < first)
  assert.equal(stops[0][0], 5); assert.equal(stops[0][4], 1)
  const midpoint = h.data.style.background[0]
  h.map.applyTheme(h.data, 'day')
  h.advance(60)
  assert.equal(h.data.style.background[0], midpoint)
  h.advance(210)
  assert.equal(h.data.style, h.day)
  assert.equal(h.map.lanMotion.active, false)
  assert.equal(JSON.stringify([h.day, h.dark]), original)
  h.advance(220)
  assert.equal(h.map.lanMotion.step(h.view, h.data, 230), false, 'settled frames do not request scene rebuilds')
})

test('Forest blend surfaces have a bounded backing store and release it when settled', async () => {
  const h = await animationHarness()
  h.map.applyTheme(h.data, 'dark'); h.advance(30)
  const forest = {}
  for (let tile = 0; tile < 20; tile++) h.map.forestTile(forest, 0, tile, 0)
  assert.equal(h.canvases.reduce((sum, c) => sum + c.width * c.height, 0), 4 * 1024 * 1024)
  h.advance(150)
  assert.equal(h.canvases.reduce((sum, c) => sum + c.width * c.height, 0), 0)
  h.map.applyTheme(h.data, 'day'); h.advance(180)
  h.map.forestTile(forest, 0, 0, 0)
  h.media.matches = true; h.advance(181)
  assert.equal(h.data.style, h.day)
  assert(h.canvases.every(c => c.width === 0))
})

test('Background adapter fails closed when mod anchors are unavailable or ambiguous', () => {
  for (const source of ['<html>unknown map</html>', 'function frame(ts) { function frame(ts) {']) assert.equal(enhanceMapLifecycle(source), source)
})
