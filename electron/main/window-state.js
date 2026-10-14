export function restoreWindowState(saved, displays) {
  const primary = displays[0].workArea
  const bounds = saved?.bounds
  const valid = bounds && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(bounds[k]))
  const display = valid && displays.find(({ workArea: a }) => bounds.x < a.x + a.width && bounds.x + bounds.width > a.x && bounds.y < a.y + a.height && bounds.y + bounds.height > a.y)
  const area = display?.workArea || primary
  const width = Math.min(area.width, Math.max(640, valid ? bounds.width : 1360))
  const height = Math.min(area.height, Math.max(480, valid ? bounds.height : 890))
  return { width, height, x: valid && display ? Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)) : area.x + Math.round((area.width - width) / 2), y: valid && display ? Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)) : area.y + Math.round((area.height - height) / 2) }
}
