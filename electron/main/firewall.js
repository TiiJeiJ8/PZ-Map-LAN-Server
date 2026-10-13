import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const exec = promisify(execFile)
export async function getNetworkProfiles() { try { const { stdout } = await exec('powershell', ['-NoProfile', '-Command', 'Get-NetConnectionProfile | Select-Object Name,NetworkCategory | ConvertTo-Json -Compress']); return JSON.parse(stdout || '[]') } catch { return [] } }
export async function addFirewallRule(port) { try { await exec('powershell', ['-NoProfile', '-Command', `Start-Process PowerShell -Verb RunAs -Wait -ArgumentList '-NoProfile','-Command','New-NetFirewallRule -DisplayName "PZ Map LAN Server ${port}" -Direction Inbound -Action Allow -Protocol TCP -LocalPort ${Number(port)} -RemoteAddress LocalSubnet'`]); return { ok: true } } catch (error) { return { ok: false, error: error.message } } }
