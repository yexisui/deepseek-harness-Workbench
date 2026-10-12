'use strict';
const path = require('node:path');

/** Transparent native icon: retain the normal Windows frame and its controls. */
const windowAppearance = { title: '', icon: path.join(__dirname, 'assets/blank-icon.png') };

function applyWindowAppearance(window) {
  window.setMenu(null);
  window.setTitle('');
  // Loaded HTML/session/skin titles must not reintroduce native caption text.
  window.webContents.on('page-title-updated', (event) => { event.preventDefault(); });
}

module.exports = { windowAppearance, applyWindowAppearance };
