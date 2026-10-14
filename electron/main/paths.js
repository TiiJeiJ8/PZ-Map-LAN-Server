import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const execFileAsync = promisify(execFile)
const target = path.join('steamapps', 'workshop', 'content', '108600', '3770149036', 'mods', 'PZ_Map', '42', 'media', 'web')
export function defaultDataDirectory() { return path.join(os.homedir(), 'Zomboid', 'Lua', 'PZ_Map') }
export async function withTimeout(operation, ms = 2000) {
  let timer
  try { return await Promise.race([operation, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('PZ:TIMEOUT')), ms) })]) }
  finally { clearTimeout(timer) }
}
export async function validateDirectories(webDir, dataDir) {
  const check = async (dir, file) => { if (typeof dir !== 'string' || !dir) return false; try { return (await withTimeout(fs.stat(path.join(dir, file)))).isFile() } catch { return false } }
  const [webValid, dataValid] = await Promise.all([check(webDir, 'index.html'), check(dataDir, 'heartbeat.txt')])
  return { webValid, dataValid }
}
async function steamPath() {
  try {
    const { stdout } = await execFileAsync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { timeout: 2000, windowsHide: true })
    return stdout.split(/\r?\n/).find(x => /\sSteamPath\s/i.test(x))?.split(/\s{2,}/).pop()?.trim()
  } catch { return undefined }
}
// Deduplicate before visiting, including self-references in Steam's VDF.
export async function detectWebDirectory({ getSteamPath = steamPath, io = fs, timeout = 6000 } = {}) {
  const deadline = Date.now() + timeout
  const bounded = promise => withTimeout(promise, Math.max(1, Math.min(1500, deadline - Date.now())))
  const steam = await bounded(getSteamPath()).catch(() => null)
  const queue = steam ? [steam] : [], visited = new Set()
  while (queue.length && Date.now() < deadline && visited.size < 64) {
    const root = queue.shift(), key = path.resolve(root).toLowerCase()
    if (visited.has(key)) continue
    visited.add(key)
    const dir = path.join(root, target)
    try { if ((await bounded(io.stat(path.join(dir, 'index.html')))).isFile()) return dir } catch { /* Try other libraries. */ }
    try {
      const text = await bounded(io.readFile(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8'))
      for (const match of text.matchAll(/"path"\s+"([^"]+)"/g)) queue.push(match[1].replace(/\\\\/g, '\\'))
    } catch { /* Unavailable libraries do not block startup. */ }
  }
  return null
}
