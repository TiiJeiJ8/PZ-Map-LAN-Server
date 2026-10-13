import { networkInterfaces } from 'node:os'
export function getLanInfo(port, boundPort = port) { const ip = Object.values(networkInterfaces()).flat().find((x) => x && x.family === 'IPv4' && !x.internal)?.address || '127.0.0.1'; return { ip, url: `http://${ip}:${boundPort}/` } }
