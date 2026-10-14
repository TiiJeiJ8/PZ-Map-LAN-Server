export function appError(code) { return Object.assign(new Error(`PZ:${code}`), { appCode: code }) }
export function errorCode(error) {
  return error?.appCode || error?.message?.match(/PZ:([A-Z_]+)/)?.[1] || ({ EADDRINUSE: 'PORT_IN_USE', EACCES: 'ACCESS_DENIED', EPERM: 'ACCESS_DENIED', ENOENT: 'FILE_MISSING' })[error?.code] || 'OPERATION_FAILED'
}
export function validPort(value) {
  if (!Number.isInteger(value) || value < 1024 || value > 65535) throw appError('INVALID_PORT')
  return value
}
