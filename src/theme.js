const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
export const normalizeTheme = theme => ['light', 'dark', 'system'].includes(theme) ? theme : 'system'
let preference = 'system'
try { preference = normalizeTheme(localStorage.getItem('pz-lan-theme')) } catch { /* Storage may be unavailable. */ }

function renderTheme() {
  document.documentElement.dataset.theme = preference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : preference
}
export function applyTheme(theme) {
  preference = normalizeTheme(theme)
  renderTheme()
  try { localStorage.setItem('pz-lan-theme', preference) } catch { /* Electron settings remain the source of truth. */ }
}
systemTheme.addEventListener('change', renderTheme)
renderTheme()
