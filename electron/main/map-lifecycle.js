// Installed only in the loopback preview. LAN clients keep their own lifecycle.
const frameAnchor = 'function frame(ts) {'
const followAnchor = 'else { engageFollow(); }'
const startAnchor = '<script>PZMapApp.start('
export function supportsMapLifecycle(source) {
  return [frameAnchor, followAnchor, startAnchor, 'function saveView()', 'var zoomTarget =', 'var pendingFollowZoom ='].every(anchor => source.split(anchor).length === 2)
}
export function enhanceMapLifecycle(source) {
  if (!supportsMapLifecycle(source)) return source
  return source.replace(frameAnchor, `${frameAnchor}
    var lifecycle = PZMap.lanLifecycle;
    if (lifecycle) {
      if (!lifecycle.attached) lifecycle.attach({
        snapshot: function () {
          saveView();
          return { bounds: String(data.bounds), cx: view.cx, cy: view.cy, zoom: view.zoom, follow: follow };
        },
        restore: function (state) {
          if (!state || state.bounds !== String(data.bounds) || ![state.cx, state.cy, state.zoom].every(Number.isFinite)) return;
          resize();
          view.cx = state.cx; view.cy = state.cy; view.zoom = state.zoom; clampView();
          zoomTarget = view.zoom; zoomAnchor = null; panTarget = null; panVel = null;
          follow = state.follow === true && policy.marker; pendingFollowZoom = false; restoredZoom = true;
          lifecycle.restoredFollow = follow;
          if (follow && player) toPlayer();
          dirty = true;
        },
        wake: function () { lastTs = 0; resize(); dirty = true; requestAnimationFrame(frame); }
      });
      if (lifecycle.paused) { lifecycle.sleeping = true; return; }
    }
  `).replace(followAnchor, `else {
    if (!PZMap.lanLifecycle || PZMap.lanLifecycle.restoredFollow !== false) engageFollow();
    if (PZMap.lanLifecycle) PZMap.lanLifecycle.restoredFollow = undefined;
  }`).replace(startAnchor, `<script>(${installLifecycle.toString()})();</script>\n${startAnchor}`)
}

function installLifecycle() {
  if (window.parent === window || !window.PZMap) return
  let hooks, pendingState
  const lifecycle = window.PZMap.lanLifecycle = {
    attached: false, paused: false, sleeping: false,
    attach(value) {
      hooks = value
      lifecycle.attached = true
      window.parent.postMessage({ type: 'pz-lan-map-ready' }, '*')
    },
  }
  window.addEventListener('message', event => {
    if (event.source !== window.parent || !hooks) return
    const message = event.data
    if (message?.type === 'pz-lan-map-activity') {
      if (message.state) pendingState = message.state
      lifecycle.paused = message.active !== true
      if (!lifecycle.paused && pendingState) { hooks.restore(pendingState); pendingState = null }
      if (!lifecycle.paused && lifecycle.sleeping) { lifecycle.sleeping = false; hooks.wake() }
    }
    if (message?.type === 'pz-lan-map-suspend') {
      window.parent.postMessage({ type: 'pz-lan-map-snapshot', state: pendingState || hooks.snapshot(), request: message.request }, '*')
    }
  })
}
