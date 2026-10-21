import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { windowAppearance, applyWindowAppearance } = createRequire(import.meta.url)('../src/window-appearance.cjs');

test('native caption remains empty after page titles change and menus cannot reappear', () => {
  const listeners = new Map();
  let menu = 'default', title = 'old', prevented = false;
  const window = { setMenu: value => { menu = value; }, setTitle: value => { title = value; },
    webContents: { on: (name, listener) => listeners.set(name, listener) } };
  applyWindowAppearance(window);
  assert.equal(menu, null); assert.equal(title, '');
  listeners.get('page-title-updated')({ preventDefault: () => { prevented = true; } }, 'DeepSeek Harness');
  assert.equal(prevented, true);
  assert.equal(windowAppearance.title, '');
  assert.ok(windowAppearance.icon.endsWith(process.platform === 'win32' ? 'icon.ico' : 'icon.png'));
});
