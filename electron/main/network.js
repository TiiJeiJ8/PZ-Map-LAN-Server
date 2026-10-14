import { networkInterfaces } from 'node:os'
export function getLanAdapters(interfaces = networkInterfaces()) {
  return Object.entries(interfaces).flatMap(([name, items]) => (items || []).filter(x => x.family === 'IPv4' && !x.internal).map(x => ({ name, ip: x.address, virtual: /virtual|vmware|vethernet|vbox|docker|wsl|vpn|tun|tap|tailscale|zerotier/i.test(name), linkLocal: x.address.startsWith('169.254.') })))
    .sort((a, b) => Number(a.linkLocal) - Number(b.linkLocal) || Number(a.virtual) - Number(b.virtual) || a.name.localeCompare(b.name))
}
export function getLanInfo(port, boundPort = port, preferredIp = '', adapters = getLanAdapters()) {
  const selected = preferredIp ? adapters.find(x => x.ip === preferredIp) : adapters.find(x => !x.linkLocal)
  return { ip: selected?.ip || '', url: selected ? `http://${selected.ip}:${boundPort}/` : '', adapters, selectionMissing: Boolean(preferredIp && !selected) }
}
