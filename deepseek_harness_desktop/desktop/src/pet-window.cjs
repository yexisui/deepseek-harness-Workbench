'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FRAME_NAME = 'workbench-desktop-pet';
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// Keep the pet itself reachable, while leaving room for its existing popovers.
function petLayout(point, size, area, zoom = 1) {
  const width = Math.min(640, area.width), height = Math.min(600, area.height);
  const sw = Math.min(size.width * zoom, width), sh = Math.min(size.height * zoom, height);
  const px = clamp(point.x, area.x, area.x + area.width - sw);
  const py = clamp(point.y, area.y, area.y + area.height - sh);
  const x = Math.round(clamp(px + sw / 2 - width / 2, area.x, area.x + area.width - width));
  const y = Math.round(clamp(py + sh / 2 - height / 2, area.y, area.y + area.height - height));
  return { bounds: { x, y, width, height }, position: { x: px, y: py },
    display: { right: (x + width - px - sw) / zoom, bottom: (y + height - py - sh) / zoom } };
}

function createPetWindow({ screen, mainWindow, statePath, log = () => {} }) {
  let pet = null, timer = null, drag = null, rects = [], ignored = true;
  let size = { width: 160, height: 160 }, point = null, zoom = 1;
  let lastLayout = '', lastDisplay = '';
  const send = (channel, value) => {
    const main = mainWindow();
    if (main && !main.isDestroyed()) main.webContents.send(channel, value);
  };
  function save() {
    if (!point) return;
    try {
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      fs.writeFileSync(statePath, JSON.stringify(point));
    } catch { log('[desktop] pet position could not be saved'); }
  }
  function place(next) {
    if (!pet || pet.isDestroyed()) return;
    const area = screen.getDisplayNearestPoint({ x: Math.round(next.x + size.width * zoom / 2), y: Math.round(next.y + size.height * zoom / 2) }).workArea;
    const result = petLayout(next, size, area, zoom);
    point = result.position;
    const key = JSON.stringify(result);
    if (key !== lastLayout) {
      lastLayout = key;
      const current = pet.getBounds();
      if (Object.keys(result.bounds).some(key => current[key] !== result.bounds[key])) pet.setBounds(result.bounds);
      const displayKey = JSON.stringify(result.display);
      if (displayKey !== lastDisplay) { lastDisplay = displayKey; send('desktop:pet-layout', result.display); }
    }
    return result.display;
  }
  function tick() {
    if (!pet || pet.isDestroyed()) return;
    const cursor = screen.getCursorScreenPoint();
    if (drag) place({ x: cursor.x - drag.x, y: cursor.y - drag.y });
    const b = pet.getBounds();
    const x = (cursor.x - b.x) / zoom, y = (cursor.y - b.y) / zoom;
    const next = !drag && !rects.some(r => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
    if (next !== ignored) { ignored = next; pet.setIgnoreMouseEvents(next, { forward: true }); }
  }
  function close() { if (pet && !pet.isDestroyed()) pet.close(); }
  function showMain() {
    const main = mainWindow();
    if (main && !main.isDestroyed()) { if (main.isMinimized()) main.restore(); main.show(); main.focus(); }
  }
  function adopt(window) {
    if (pet) { window.close(); return; }
    pet = window;
    pet.setMenu(null);
    pet.setAlwaysOnTop(true, 'floating');
    pet.setIgnoreMouseEvents(true, { forward: true });
    pet.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    pet.webContents.on('will-navigate', event => event.preventDefault());
    pet.webContents.on('render-process-gone', close);
    const main = mainWindow();
    main?.webContents.setBackgroundThrottling(false);
    pet.on('blur', () => { if (drag) { drag = null; save(); } });
    pet.on('closed', () => {
      save(); clearTimeout(timer); timer = null; pet = null; drag = null; rects = []; ignored = true; lastLayout = ''; lastDisplay = '';
      if (main && !main.isDestroyed()) main.webContents.setBackgroundThrottling(true);
      send('desktop:pet-closed');
    });
    const poll = () => { tick(); timer = setTimeout(poll, drag ? 16 : 50); };
    poll();
  }
  function command(action, value = {}) {
    if (action === 'close') { showMain(); close(); return; }
    if (action === 'show-main') {
      showMain();
      return;
    }
    if (!pet || pet.isDestroyed()) throw Error('桌面宠物窗口未打开，请重试。');
    if (action === 'place') {
      if (![value.width, value.height].every(n => Number.isFinite(n) && n > 0 && n <= 2048)) throw Error('Invalid pet size');
      size = { width: value.width, height: value.height };
      zoom = mainWindow().webContents.getZoomFactor();
      if (value.cursor === true) {
        const cursor = screen.getCursorScreenPoint();
        return place({ x: cursor.x - size.width * zoom / 2, y: cursor.y - size.height * zoom / 2 });
      }
      if (!point) {
        try { const saved = JSON.parse(fs.readFileSync(statePath, 'utf8')); if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) point = saved; } catch {}
      }
      const mainBounds = mainWindow().getContentBounds();
      return place(point ?? { x: mainBounds.x + 120, y: mainBounds.y + 120 });
    }
    if (action === 'show') { tick(); pet.showInactive(); return; }
    if (action === 'hit-regions') {
      if (!Array.isArray(value) || value.length > 200) throw Error('Invalid pet hit regions');
      rects = value.filter(r => r && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(r[k])) && r.width > 0 && r.height > 0);
      tick(); return;
    }
    if (action === 'drag-start') {
      if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) throw Error('Invalid pet drag');
      drag = { x: clamp(value.x, 0, size.width) * zoom, y: clamp(value.y, 0, size.height) * zoom };
      tick(); return;
    }
    if (action === 'drag-end') { drag = null; save(); tick(); return; }
    throw Error('Unknown pet window action');
  }
  const screensChanged = () => { if (point) place(point); };
  screen.on('display-removed', screensChanged);
  screen.on('display-metrics-changed', screensChanged);
  return { command, close, adopt,
    options: details => details.url === 'about:blank' && details.frameName === FRAME_NAME && !pet ? {
      action: 'allow', overrideBrowserWindowOptions: {
        title: '桌面宠物', show: false, width: 640, height: 600,
        frame: false, transparent: true, backgroundColor: '#00000000',
        hasShadow: false, roundedCorners: false, resizable: false, maximizable: false,
        minimizable: false, fullscreenable: false, skipTaskbar: true, alwaysOnTop: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
      },
    } : null,
  };
}

module.exports = { createPetWindow, petLayout, FRAME_NAME };
