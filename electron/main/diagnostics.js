import fs from 'node:fs/promises'
import path from 'node:path'
import { inspectMapCompatibility } from './map-motion.js'
import { withTimeout } from './paths.js'

export function parseHeartbeat(text, modifiedAt, now = Date.now()) {
  const match = text.trim().match(/^(?:window\.)?PZ_BEAT\s*=\s*(\{[\s\S]*\})\s*;?$/)
  // Mod output is a JS object literal with unquoted keys. Quote keys only,
  // preserving string tokens, then use JSON's non-executing parser.
  const value = match && JSON.parse(match[1].replace(/("(?:\\.|[^"\\])*")|([A-Za-z_$][\w$]*)\s*:/g, (token, string, key) => string || `"${key}":`))
  if (!value || typeof value.state !== 'string') throw new Error('Invalid heartbeat')
  const staleAfter = Math.max(15000, Math.min(60000, (Number(value.interval) || 1000) * 5))
  return { state: now - modifiedAt > staleAfter ? 'stale' : value.state === 'play' ? 'live' : ['paused', 'menu', 'nochar'].includes(value.state) ? value.state : 'waiting', updatedAt: modifiedAt }
}
export async function readGameStatus(dataDir) {
  if (!dataDir) return { state: 'missing', updatedAt: null }
  let handle
  try {
    // Bound the amount read, and never execute the mod's JavaScript.
    handle = await fs.open(path.join(dataDir, 'heartbeat.txt'), 'r')
    const stat = await handle.stat()
    if (stat.size > 16384) return { state: 'invalid', updatedAt: stat.mtimeMs }
    const buffer = Buffer.alloc(16384)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    return parseHeartbeat(buffer.subarray(0, bytesRead).toString(), stat.mtimeMs)
  } catch (error) { return { state: error.code === 'ENOENT' ? 'missing' : ['EACCES', 'EPERM'].includes(error.code) ? 'unreadable' : 'invalid', updatedAt: null } }
  finally { await handle?.close() }
}
export function createDiagnostics() {
  let cacheKey, compatibility
  return async (config) => {
    const game = await withTimeout(readGameStatus(config.dataDir)).catch(() => ({ state: 'unreadable', updatedAt: null }))
    try {
      const file = path.join(config.webDir, 'index.html')
      const stat = await withTimeout(fs.stat(file))
      const key = `${file}|${stat.mtimeMs}|${stat.size}`
      if (key !== cacheKey) {
        if (stat.size > 16 * 1024 * 1024) throw new Error('Map HTML too large')
        compatibility = inspectMapCompatibility(await withTimeout(fs.readFile(file, 'utf8')))
        cacheKey = key
      }
      return { game, compatibility }
    } catch { return { game, compatibility: { state: 'missing', version: '', motion: false } } }
  }
}
