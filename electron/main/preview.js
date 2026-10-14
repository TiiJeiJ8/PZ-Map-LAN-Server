export function createPreviewManager({ validate, create }) {
  let generation = 0, current = null, currentKey = '', currentUrl = '', pending
  return {
    get current() { return current },
    refresh(config) {
      const key = JSON.stringify([config.webDir, config.dataDir])
      if (pending?.key === key) return pending.promise
      const request = ++generation
      const promise = refresh(config, key, request).finally(() => { if (pending?.promise === promise) pending = null })
      pending = { key, promise }
      return promise
    },
    stop() { generation++; pending = null; current?.stop(); current = null; currentKey = ''; currentUrl = '' },
  }
  async function refresh(config, key, request) {
    const validation = await validate(config.webDir, config.dataDir)
    if (request !== generation) return { stale: true }
    if (!validation.webValid || !validation.dataValid) return { url: currentUrl, validation, retained: Boolean(current) }
    if (current && currentKey === key) return { url: currentUrl, validation }
    const next = create(config)
    try {
      const port = await next.start()
      if (request !== generation) { next.stop(); return { stale: true } }
      const previous = current
      current = next; currentKey = key; currentUrl = `http://127.0.0.1:${port}/`
      previous?.stop()
      return { url: currentUrl, validation }
    } catch (error) { next.stop(); throw error }
  }
}
