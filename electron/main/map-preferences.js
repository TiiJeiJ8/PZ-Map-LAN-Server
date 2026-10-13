// Persist only the mod's UI settings, never game data or arbitrary storage keys.
export function sanitizeMapPreferences(value) {
  const result = {}
  if (!value || typeof value !== 'object') return result
  if (value['pzmap.drawer'] === '0' || value['pzmap.drawer'] === '1') result['pzmap.drawer'] = value['pzmap.drawer']
  if (typeof value['pzmap.toggles'] === 'string' && value['pzmap.toggles'].length <= 8192) {
    try {
      const options = JSON.parse(value['pzmap.toggles'])
      if (options && typeof options === 'object' && !Array.isArray(options)) result['pzmap.toggles'] = JSON.stringify(options)
    } catch { /* Ignore malformed preferences. */ }
  }
  return result
}
