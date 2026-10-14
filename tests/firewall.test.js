import test from 'node:test'
import assert from 'node:assert/strict'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { addFirewallRule, firewallScript } from '../electron/main/firewall.js'
const exec = promisify(execFile)

test('Firewall returns confirmed success, cancellation, and failure, and serializes pending work', async () => {
  assert.deepEqual(await addFirewallRule(8123, async () => ({})), { ok: true })
  assert.deepEqual(await addFirewallRule(8123, async () => { throw { code: 1223 } }), { ok: false, code: 'FIREWALL_CANCELLED' })
  assert.deepEqual(await addFirewallRule(8123, async () => { throw { code: 1 } }), { ok: false, code: 'FIREWALL_FAILED' })
  let release
  const first = addFirewallRule(8123, () => new Promise(resolve => { release = resolve }))
  const second = addFirewallRule(8123, () => { throw new Error('Duplicate command') })
  assert.equal(first, second)
  release({}); await first
})
// Run real PowerShell control flow against in-memory function doubles only.
// No NetSecurity cmdlet or elevation is invoked by this test.
test('Firewall PowerShell script creates or updates one named rule and rejects failed verification', { skip: process.platform !== 'win32' }, async () => {
  for (const mode of ['new', 'existing', 'failure']) {
    const mock = `
$global:exists = $${mode === 'new' ? 'false' : 'true'}
$global:port = '9999'
$global:remote = 'Any'
function Get-NetFirewallRule { param($Name, $ErrorAction)
  if ($global:exists) { [pscustomobject]@{ Enabled='True'; Action='Allow'; Direction='Inbound' } }
}
function New-NetFirewallRule { param($Name,$DisplayName,$Enabled,$Direction,$Action,$Protocol,$LocalPort,$RemoteAddress,$Profile,$ErrorAction)
  if ($global:exists -or $Name -ne 'PZMapLANServer-TCP-8123') { throw 'Duplicate rule' }
  $global:exists = $true; $global:port = $LocalPort; $global:remote = $RemoteAddress
}
function Set-NetFirewallRule { param([Parameter(ValueFromPipeline=$true)]$InputObject,$Enabled,$Direction,$Action,$Profile) process {} }
function Get-NetFirewallPortFilter { param([Parameter(ValueFromPipeline=$true)]$InputObject) process { [pscustomobject]@{ LocalPort=$global:port; Protocol='TCP' } } }
function Set-NetFirewallPortFilter { param([Parameter(ValueFromPipeline=$true)]$InputObject,$Protocol,$LocalPort) process { $global:port=$LocalPort } }
function Get-NetFirewallAddressFilter { param([Parameter(ValueFromPipeline=$true)]$InputObject) process { [pscustomobject]@{ RemoteAddress=$global:remote } } }
function Set-NetFirewallAddressFilter { param([Parameter(ValueFromPipeline=$true)]$InputObject,$RemoteAddress) process { $global:remote='${mode === 'failure' ? 'Any' : 'LocalSubnet'}' } }
`
    const promise = exec('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(mock + firewallScript(8123), 'utf16le').toString('base64')], { windowsHide: true, timeout: 10000 })
    if (mode === 'failure') await assert.rejects(promise, error => error.code === 1)
    else await promise
  }
})
