// Presentation overrides for the known PZ Map controls only. Injected into the
// HTTP response; never written to Workshop files or applied to canvas layers.
export const mapPanelTheme = `
<style id="pz-lan-panel-theme">
:is(#drawer, #toolbar, #mapkey, #uipop, #banners, #pzmap-debug) {
  --lan-scheme: light; --lan-surface: #fff; --lan-panel: rgba(255,255,255,.96);
  --lan-text: #37352f; --lan-muted: #787670; --lan-border: #e5e5e5;
  --lan-soft: #f7f6f3; --lan-hover: #eeede9; --lan-scroll: #cecdc8;
  --lan-active: #37352f; --lan-on-active: #fff; --lan-key-active: #514f49; --lan-key-border: #706e68;
  --lan-warning: #875519; --lan-warning-bg: #fff4e5; --lan-warning-border: #d8b98d;
  --lan-danger: #994b2b; --lan-danger-border: #d8a894; --lan-success: #466346; --lan-success-border: #b8cbb8;
  --lan-swatch-border: rgba(55,53,47,.2);
}
/* Neutral charcoal chrome stays distinct from the game's independent map palette. */
:root[data-pz-lan-theme="dark"] :is(#drawer, #toolbar, #mapkey, #uipop, #banners, #pzmap-debug) {
  --lan-scheme: dark; --lan-surface: #2b2b2b; --lan-panel: rgba(43,43,43,.98);
  --lan-text: #ededea; --lan-muted: #b5b4af; --lan-border: #515151;
  --lan-soft: #353535; --lan-hover: #414141; --lan-scroll: #6b6b6b;
  --lan-active: #e6e5e0; --lan-on-active: #232323; --lan-key-active: #cecdc7; --lan-key-border: #aaa9a3;
  --lan-warning: #dfbc77; --lan-warning-bg: #473b28; --lan-warning-border: #8c744b;
  --lan-danger: #f1ac91; --lan-danger-border: #90644f; --lan-success: #a5cda5; --lan-success-border: #638363;
  --lan-swatch-border: rgba(255,255,255,.3);
}
:root[data-pz-lan-theme="dark"] #toolbar #iso-btn:not(.on) #iso-img { filter: none; }
/* Toolbar selection matches the app sidebar instead of primary action buttons. */
#toolbar {
  --lan-active: #e3e1db;
  --lan-on-active: #37352f;
  --lan-key-active: #f7f6f3;
  --lan-key-border: #cecdc8;
}
:root[data-pz-lan-theme="dark"] #toolbar {
  --lan-active: #414141;
  --lan-on-active: #ededea;
  --lan-key-active: #353535;
  --lan-key-border: #6b6b6b;
}
:root[data-pz-lan-theme="dark"] #toolbar #iso-btn.on #iso-img { filter: none; }

:is(#drawer, #toolbar, #mapkey, #uipop, #banners, #pzmap-debug) {
  --panel: var(--lan-surface);
  --border: var(--lan-border);
  --ink: var(--lan-text);
  --head: var(--lan-text);
  --dim: var(--lan-muted);
  --accent: var(--lan-text);
  color: var(--ink);
  color-scheme: var(--lan-scheme);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
  accent-color: var(--accent);
  scrollbar-width: thin;
  scrollbar-color: var(--lan-scroll) transparent;
}
:is(#drawer, #mapkey, #uipop, #banners > .hud) {
  background: var(--lan-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(37, 35, 30, .09), 0 1px 3px rgba(37, 35, 30, .04);
}
#drawer {
  top: 12px;
  right: 12px;
  bottom: calc(36px + 38px * var(--ui-scale));
  width: clamp(290px, calc(300px * var(--ui-scale)), 420px);
  max-width: calc(100vw - 24px);
  padding: calc(14px * var(--ui-scale));
  font-size: calc(13px * var(--ui-scale));
  overscroll-behavior: contain;
  touch-action: pan-y;
}
#drawer .drawer-head {
  align-items: center;
  margin-bottom: calc(12px * var(--ui-scale));
}
#drawer .drawer-brand {
  font: 600 calc(17px * var(--ui-scale))/1.4 "Segoe UI", "Microsoft YaHei", sans-serif;
  letter-spacing: -.3px;
}
#drawer .drawer-ver {
  padding: 2px 6px;
  background: var(--lan-soft);
  border-radius: 4px;
  letter-spacing: 0;
}
#drawer #status {
  padding: calc(8px * var(--ui-scale)) calc(10px * var(--ui-scale));
  background: var(--lan-soft);
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
}
#drawer #status .row { gap: 10px; padding: 2px 0; }
#drawer #status b { text-align: right; overflow-wrap: anywhere; }
#drawer .toggles {
  margin-top: calc(12px * var(--ui-scale));
  padding: calc(10px * var(--ui-scale)) 0;
  border-color: var(--border);
  gap: calc(3px * var(--ui-scale));
}
#drawer .tk { min-height: calc(29px * var(--ui-scale)); border-radius: 4px; }
#drawer .tk:not(.disabled):hover { background: var(--lan-soft); }
#drawer .tk input { flex-shrink: 0; width: calc(14px * var(--ui-scale)); height: calc(14px * var(--ui-scale)); }
#drawer .tk span { min-width: 0; }
#drawer .grp-chevron { min-height: calc(29px * var(--ui-scale)); border-radius: 4px; }
#drawer .grp-chevron:hover { background: var(--lan-hover); }
#drawer .grp-kids { margin-top: 2px; margin-bottom: calc(6px * var(--ui-scale)); }
#drawer .sz { min-height: calc(28px * var(--ui-scale)); }
#drawer .szval, #uipop-val { font-variant-numeric: tabular-nums; }
#drawer .drawer-foot {
  padding-top: calc(12px * var(--ui-scale));
  border-color: var(--border);
  flex-shrink: 0;
}
#drawer .dbtn {
  min-height: calc(32px * var(--ui-scale));
  background: var(--lan-surface);
  border-color: var(--border);
  border-radius: 5px;
  transition: background-color 140ms ease, border-color 140ms ease;
}
#drawer .dbtn:hover { background: var(--lan-hover); border-color: var(--lan-scroll); }
#drawer .dbtn.on { background: var(--lan-active); border-color: var(--lan-active); color: var(--lan-on-active); }
#drawer .dbtn.on b { color: inherit; }
#drawer #reset-btn.arm { color: var(--lan-warning); background: var(--lan-warning-bg); border-color: var(--lan-warning-border); }
#toolbar {
  right: 12px;
  bottom: 12px;
  max-width: calc(100vw - 24px);
  padding: 5px;
  gap: calc(3px * var(--ui-scale));
  background: var(--lan-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 3px 16px rgba(37, 35, 30, .1);
  overflow-x: auto;
  touch-action: pan-x;
}
#toolbar .tbtn {
  flex-shrink: 0;
  background: transparent;
  border-color: transparent;
  border-radius: 5px;
  transition: background-color 140ms ease, color 140ms ease;
}
#toolbar .tbtn:not(.dead):hover { background: var(--lan-hover); }
#toolbar .tbtn.on, #toolbar .tbtn.on:hover { color: var(--lan-on-active); background: var(--lan-active); }
#toolbar #compass-btn, #toolbar #compass-btn:hover { background: transparent; }
#toolbar #compass-ind:not(.has) { filter: grayscale(1); }
/* The game's white view-toggle art needs a dark ink equivalent on a light cell. */
#toolbar #iso-btn #iso-img { filter: brightness(.3); }
:is(#drawer, #toolbar, #mapkey) kbd {
  background: var(--lan-soft);
  color: var(--lan-muted);
  border: 1px solid var(--lan-border);
  border-radius: 4px;
  font-size: .85em;
  font-weight: 400;
}
#toolbar .on kbd { background: var(--lan-key-active); color: var(--lan-on-active); border-color: var(--lan-key-border); }
#mapkey { top: 12px; left: 12px; padding: 12px 14px; max-width: calc(100vw - 24px); }
#mapkey .mk-h { text-align: left; margin-bottom: 8px; }
#mapkey .mk-row { padding: 4px 0; gap: 10px; }
#mapkey .sw, body.theme-dark #mapkey .sw { border-color: var(--lan-swatch-border); border-radius: 3px; }
#uipop { bottom: calc(48px + 38px * var(--ui-scale)); max-width: calc(100vw - 24px); padding: 14px 16px; }
#uipop .uipop-x { min-width: 28px; min-height: 28px; border-radius: 4px; }
#uipop .uipop-x:hover { background: var(--lan-hover); }
#banners .build-warn { border-color: var(--lan-warning-border); }
#banners .build-warn b { color: var(--lan-warning); }
#banners .pack-wait { border-color: var(--border); }
#banners .url-warn { border-color: var(--lan-danger-border); }
#banners .url-warn b { color: var(--lan-danger); }
#banners .url-ok { border-color: var(--lan-success-border); }
#banners .url-ok b { color: var(--lan-success); }
#drawer .warn { color: var(--lan-warning); }
/* Support UI is created lazily with inline colors. Override presentation only:
   its inline display state, diagnostic content and handlers remain authoritative. */
#pzmap-debug {
  background: var(--lan-surface) !important;
  color: var(--lan-text) !important;
  border: 1px solid var(--lan-border) !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 20px rgba(37, 35, 30, .12) !important;
  padding: 14px !important;
  overscroll-behavior: contain;
  touch-action: pan-y;
}
#pzmap-debug > div { color: var(--lan-muted) !important; border-color: var(--lan-border) !important; }
#pzmap-debug button, #pzmap-debug input[type="number"], #pzmap-debug textarea {
  color: var(--lan-text) !important;
  background: var(--lan-soft) !important;
  border: 1px solid var(--lan-border) !important;
  border-radius: 4px;
  padding: 5px;
}
#pzmap-debug button:hover { background: var(--lan-hover) !important; }
:is(#drawer, #toolbar, #uipop, #pzmap-debug) :is(button, input, textarea):focus-visible {
  outline: 2px solid var(--lan-muted);
  outline-offset: 2px;
}
#drawer, #mapkey {
  opacity: 0;
  transition: opacity 180ms ease, translate 180ms cubic-bezier(.2, .7, .3, 1), display 180ms allow-discrete;
}
#drawer { translate: 18px 0; }
#mapkey { translate: -18px 0; }
#drawer.open, #mapkey.open { opacity: 1; translate: 0 0; }
#drawer:not(.open), #mapkey:not(.open) { pointer-events: none; }
@starting-style {
  #drawer.open { opacity: 0; translate: 18px 0; }
  #mapkey.open { opacity: 0; translate: -18px 0; }
}
#uipop.open { animation: pz-lan-panel-in 160ms ease-out; }
@keyframes pz-lan-panel-in { from { opacity: 0; } to { opacity: 1; } }
@media (pointer: coarse) {
  #drawer .tk, #drawer .grp-chevron, #drawer .sz { min-height: calc(36px * var(--ui-scale)); }
  #drawer .dbtn { min-height: 40px; }
  #uipop .uipop-x { min-height: 36px; min-width: 36px; }
}
@media (max-width: 600px) {
  #toolbar .wide { padding-inline: 8px; }
  #toolbar kbd { display: none; }
  #mapkey { max-height: calc(100vh - 100px); overflow-y: auto; touch-action: pan-y; }
  #pzmap-debug { max-width: calc(100vw - 24px) !important; bottom: calc(36px + 38px * var(--ui-scale)) !important; }
}
@media (prefers-reduced-motion: reduce) {
  :is(#drawer, #toolbar, #mapkey, #uipop), :is(#drawer, #toolbar) * { animation: none !important; transition: none !important; }
}
</style>`
