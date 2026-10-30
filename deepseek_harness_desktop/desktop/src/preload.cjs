'use strict';

// Preload for the local splash/error pages and for the GUI.
//
// The GUI itself talks to the dsh host over HTTP. The bridge adds native
// project selection and one narrow attention channel (issue #1498): `notify(kind)` reports
// that a run is waiting for the user or has settled, and the main process
// decides whether to flash the taskbar and play the system alert. The kind is
// re-validated in the main process; this bridge is a transport, not a policy.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  petWindow: (action, value) => ipcRenderer.invoke('desktop:pet-window', action, value),
  onPetLayout: callback => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('desktop:pet-layout', listener);
    return () => ipcRenderer.removeListener('desktop:pet-layout', listener);
  },
  onPetOwnerVisibility: callback => {
    const listener = (_event, visible) => callback(visible);
    ipcRenderer.on('desktop:pet-owner-visible', listener);
    return () => ipcRenderer.removeListener('desktop:pet-owner-visible', listener);
  },
  onPetClosed: callback => {
    const listener = () => callback();
    ipcRenderer.on('desktop:pet-closed', listener);
    return () => ipcRenderer.removeListener('desktop:pet-closed', listener);
  },
  openDocument: path => ipcRenderer.invoke('desktop:document-open',path),
  saveDocument: input => ipcRenderer.invoke('desktop:document-save',input),
  selectSearchDirectory: (path) => ipcRenderer.invoke('desktop:select-search-directory', path),
  revealSearchResult: (path) => ipcRenderer.invoke('desktop:reveal-search-result', path),
  selectProjectDirectory: () => ipcRenderer.invoke('desktop:select-project-directory'),
  openCodeProjectDirectory: (path) => ipcRenderer.invoke('desktop:open-code-project-directory', path),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  resolveProjectPaths: (paths) => ipcRenderer.invoke('desktop:resolve-project-paths', paths),
  /**
   * Report one attention signal to the main process.
   * @param {'approval' | 'completed' | 'interrupted'} kind
   */
  notify: (kind) => { ipcRenderer.send('desktop:attention', { kind }); },
  onStatus: (callback) => {
    ipcRenderer.on('desktop:status', (_event, text) => callback(text));
  },
  onError: (callback) => {
    ipcRenderer.on('desktop:error', (_event, payload) => callback(payload));
  },
  retry: () => ipcRenderer.send('desktop:retry'),
  revealLog: () => ipcRenderer.send('desktop:reveal-log'),
  quit: () => ipcRenderer.send('desktop:quit'),
});
