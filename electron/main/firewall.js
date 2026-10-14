import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { validPort } from './errors.js'
const exec = promisify(execFile)
export async function getNetworkProfiles() {
  try {
    const { stdout } = await exec('powershell', ['-NoProfile', '-Command', 'Get-NetConnectionProfile | Select-Object Name,@{Name="NetworkCategory";Expression={$_.NetworkCategory.ToString()}} | ConvertTo-Json -Compress'], { windowsHide: true, timeout: 5000 })
    const result = JSON.parse(stdout || '[]')
    return Array.isArray(result) ? result : result ? [result] : []
  } catch { return [] }
}
export function firewallScript(port) {
  validPort(port)
  return `$ErrorActionPreference = 'Stop'
try {
  $ruleName = 'PZMapLANServer-TCP-${port}'
  $rule = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
  if ($rule) {
    $rule | Set-NetFirewallRule -Enabled True -Direction Inbound -Action Allow -Profile Any -ErrorAction Stop | Out-Null
    $rule | Get-NetFirewallPortFilter | Set-NetFirewallPortFilter -Protocol TCP -LocalPort ${port} -ErrorAction Stop | Out-Null
    $rule | Get-NetFirewallAddressFilter | Set-NetFirewallAddressFilter -RemoteAddress LocalSubnet -ErrorAction Stop | Out-Null
  } else {
    New-NetFirewallRule -Name $ruleName -DisplayName 'PZ Map LAN Server ${port}' -Enabled True -Direction Inbound -Action Allow -Protocol TCP -LocalPort ${port} -RemoteAddress LocalSubnet -Profile Any -ErrorAction Stop | Out-Null
  }
  $verified = Get-NetFirewallRule -Name $ruleName -ErrorAction Stop
  $ports = $verified | Get-NetFirewallPortFilter
  $addresses = $verified | Get-NetFirewallAddressFilter
  if ($verified.Enabled -ne 'True' -or $verified.Action -ne 'Allow' -or $verified.Direction -ne 'Inbound' -or $ports.LocalPort -ne '${port}' -or $ports.Protocol -notin @('TCP','6') -or @($addresses.RemoteAddress) -notcontains 'LocalSubnet') { exit 1 }
  exit 0
} catch { exit 1 }`
}
let pending
export function addFirewallRule(port, run = exec) {
  validPort(port)
  if (pending) return pending
  const encoded = Buffer.from(firewallScript(port), 'utf16le').toString('base64')
  const launch = `$ErrorActionPreference = 'Stop'; try { $p = Start-Process PowerShell -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','${encoded}'; exit $p.ExitCode } catch { if ($_.Exception.NativeErrorCode -eq 1223) { exit 1223 }; exit 1 }`
  pending = run('powershell', ['-NoProfile', '-NonInteractive', '-Command', launch], { windowsHide: true })
    .then(() => ({ ok: true }))
    .catch(error => ({ ok: false, code: error.code === 1223 ? 'FIREWALL_CANCELLED' : 'FIREWALL_FAILED' }))
    .finally(() => { pending = null })
  return pending
}
