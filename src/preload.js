'use strict';
/*
 * Secure bridge between the sandboxed renderer and the main process.
 * Exposes a tiny, explicit API on window.petAPI — no Node access leaks in.
 *
 * This preload stays sandbox-safe: it only uses `electron` (no fs/crypto). The
 * image vault is decrypted in the main process; the renderer fetches each
 * decrypted data: URL synchronously over IPC via asset().
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  // decrypted asset lookup: 'images/usagi/body.png' -> data URL (or null)
  asset: (p) => ipcRenderer.sendSync('asset:get', p),

  // renderer -> main
  fit: (w, h) => ipcRenderer.send('pet:fit', { w, h }),
  dragStart: (x, y) => ipcRenderer.send('drag:start', { x, y }),
  dragMove: (x, y) => ipcRenderer.send('drag:move', { x, y }),
  dragEnd: () => ipcRenderer.send('drag:end'),
  setIgnore: (ignore) => ipcRenderer.send('hit:ignore', ignore),
  openMenu: () => ipcRenderer.send('menu:open'),
  quit: () => ipcRenderer.send('pet:quit'),

  // main -> renderer
  onReact: (cb) => ipcRenderer.on('pet:react', (_e, type) => cb(type)),
  onCursor: (cb) => ipcRenderer.on('pet:cursor', (_e, p) => cb(p)),
  onLook: (cb) => ipcRenderer.on('pet:look', (_e, v) => cb(v)),
  onWalk: (cb) => ipcRenderer.on('pet:walk', (_e, v) => cb(v)),
  onWalkStop: (cb) => ipcRenderer.on('pet:walk-stop', () => cb()),
  onScale: (cb) => ipcRenderer.on('scale:set', (_e, h) => cb(h)),
  onLang: (cb) => ipcRenderer.on('pet:lang', (_e, l) => cb(l)),
  onSound: (cb) => ipcRenderer.on('sound:config', (_e, cfg) => cb(cfg))
});
