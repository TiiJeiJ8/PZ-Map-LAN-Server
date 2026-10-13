import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const execFileAsync = promisify(execFile)
const target = path.join('steamapps', 'workshop', 'content', '108600', '3770149036', 'mods', 'PZ_Map', '42', 'media', 'web')
export function defaultDataDirectory() { return path.join(os.homedir(), 'Zomboid', 'Lua', 'PZ_Map') }
export async function validateDirectories(webDir, dataDir) {
  const check = async (dir, file) => { if (!dir) return false; try { return (await fs.stat(path.join(dir, file))).isFile() } catch { return false } }
  return { webValid: await check(webDir, 'index.html'), dataValid: await check(dataDir, 'heartbeat.txt') }
}
async function steamPath() { try { const { stdout } = await execFileAsync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath']); return stdout.split(/\r?\n/).find((x) => /SteamPath/i.test(x))?.split(/\s{2,}/).pop()?.trim() } catch { return undefined } }
export async function detectWebDirectory() {
  const roots = []
  const steam = await steamPath(); if (steam) roots.push(steam)
  for (const root of roots) {
    const vdf = path.join(root, 'steamapps', 'libraryfolders.vdf')
    try { const text = await fs.readFile(vdf, 'utf8'); for (const match of text.matchAll(/"path"\s+"([^"]+)"/g)) roots.push(match[1].replace(/\\\\/g, '\\')) } catch { /* ignore malformed or missing VDF */ }
  }
  for (const root of [...new Set(roots)]) { const dir = path.join(root, target); try { if ((await fs.stat(path.join(dir, 'index.html'))).isFile()) return dir } catch { /* continue searching libraries */ } }
  return null
}
