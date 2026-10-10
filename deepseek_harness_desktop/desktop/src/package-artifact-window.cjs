'use strict';

function artifactDestination(current, target) {
  try {
    const base = new URL(current), url = new URL(target);
    if (!['http:', 'https:'].includes(base.protocol) || !['127.0.0.1', 'localhost'].includes(base.hostname) || url.origin !== base.origin || url.username || url.password || url.search || url.hash) return null;
    const match = /^\/api\/capabilities\/packages\/artifact\/[a-f0-9-]{36}\/(view|download\.svg)$/.exec(url.pathname);
    return match ? { url: url.href, download: match[1] === 'download.svg' } : null;
  } catch { return null; }
}

function openPackageArtifact(parent, target, BrowserWindow) {
  const destination = artifactDestination(parent.webContents.getURL(), target);
  if (!destination) return false;
  if (destination.download) parent.webContents.downloadURL(destination.url);
  else {
    const viewer = new BrowserWindow({ parent, width: 1120, height: 850, autoHideMenuBar: true,
      webPreferences: { session: parent.webContents.session, contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false } });
    viewer.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    viewer.webContents.on('will-navigate', (event, url) => {
      if (!artifactDestination(destination.url, url)) event.preventDefault();
    });
    void viewer.loadURL(destination.url);
  }
  return true;
}
module.exports = { artifactDestination, openPackageArtifact };
