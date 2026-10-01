'use strict';
/*
 * OhMyChiikawa — desktop pet, main process.
 *
 * Creates a transparent, frameless, always-on-top window that hosts the pet,
 * and provides the "physical" behaviours that only the OS layer can do:
 *   - moving the window (dragging, walking)
 *   - click-through on transparent pixels
 *   - the right-click context menu
 *   - polling the global cursor so the pet can look at you
 *
 * Everything is local. No network access is used at any point.
 */

const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { clampWindowBounds, dragAreaForBounds, resolveDragBounds, resolveWalkPlan } = require('./window-geometry');

// ---------- encrypted image vault ----------
// Decrypt assets.pak once here in the main process (which has full Node access);
// the renderer pulls each image as a data: URL over IPC, so neither the
// filesystem nor the key is ever exposed to the (sandboxed) page. If the pak is
// absent (raw dev tree), ASSETS stays empty and the renderer falls back to file
// paths under src/images/.
const ASSETS = Object.create(null);
try {
  const vault = require('./asset-vault');
  const bundle = JSON.parse(vault.decrypt(fs.readFileSync(path.join(__dirname, 'assets.pak'))).toString('utf8'));
  for (const k in bundle) {
    const ext = k.split('.').pop().toLowerCase();
    const mime = ext === 'gif' ? 'image/gif' : (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : 'image/png';
    ASSETS[k] = 'data:' + mime + ';base64,' + bundle[k];
  }
} catch (e) { /* no pak: dev tree uses raw files */ }
ipcMain.on('asset:get', (e, p) => { e.returnValue = ASSETS[p] || null; });

// ---------- launch options (CLI) ----------
function argValue(name, fallback) {
  const pre = '--' + name + '=';
  const hit = process.argv.find((a) => a.startsWith(pre));
  return hit ? hit.slice(pre.length) : fallback;
}
// Persisted preferences — remembers the last chosen pet across launches.
const PREFS_PATH = path.join(app.getPath('userData'), 'prefs.json');
function loadPrefs() { try { return JSON.parse(fs.readFileSync(PREFS_PATH, 'utf8')); } catch (e) { return {}; } }
function savePrefs() { try { fs.mkdirSync(path.dirname(PREFS_PATH), { recursive: true }); fs.writeFileSync(PREFS_PATH, JSON.stringify(prefs)); } catch (e) {} }
const prefs = loadPrefs();

// An explicit --pet on the CLI wins; otherwise restore the last chosen pet.
let currentPet = argValue('pet', null) || prefs.pet || 'usagi';   // switchable from the right-click menu
let lang = (['en', 'zh', 'ja'].includes(prefs.lang)) ? prefs.lang : 'zh';   // menu & speech language (switchable, remembered)
const t = (zh, en, ja) => (lang === 'en' ? en : lang === 'ja' ? ja : zh); // pick the current language's string
// Per-language character names for the menu (the main process has no pet registry).
const PET_LABELS = {
  usagi: { zh: '乌萨奇', en: 'Usagi', ja: 'うさぎ' },
  chiikawa: { zh: '吉伊', en: 'Chiikawa', ja: 'ちいかわ' },
  hachiware: { zh: '小八', en: 'Hachiware', ja: 'ハチワレ' },
  momonga: { zh: '莫莫伽', en: 'Momonga', ja: 'モモンガ' }
};
const ROLL_PETS = new Set(['usagi']);           // pets that have the hand-roll action
const PET_SPEED = { usagi: 3, chiikawa: 2, hachiware: 2, momonga: 2 }; // walk speed px/tick (16ms); default 2
const petLabel = (id) => (PET_LABELS[id] ? PET_LABELS[id][lang] : id);
const SCALES = { tiny: 75, small: 150, medium: 200, large: 270 }; // pet display height (px)
let scaleName = argValue('scale', 'medium');
if (!SCALES[scaleName]) scaleName = 'medium';

// Sound & volume settings (persisted, switchable via menu / CLI)
let soundEnabled = prefs.sound !== false; // default enabled
if (process.argv.includes('--no-sound') || process.argv.includes('--sound=0') || process.argv.includes('--sound=false')) {
  soundEnabled = false;
} else if (process.argv.includes('--sound') || process.argv.includes('--sound=1') || process.argv.includes('--sound=true')) {
  soundEnabled = true;
}
let soundVolume = typeof prefs.volume === 'number' ? prefs.volume : 0.75;
const cliVol = argValue('volume', null);
if (cliVol !== null) {
  const parsed = parseFloat(cliVol);
  if (!isNaN(parsed)) soundVolume = Math.max(0, Math.min(1, parsed));
}

function setSoundEnabled(val) {
  soundEnabled = !!val;
  prefs.sound = soundEnabled;
  savePrefs();
  if (win) win.webContents.send('sound:config', { enabled: soundEnabled, volume: soundVolume });
}

function setSoundVolume(val) {
  soundVolume = Math.max(0, Math.min(1, Number(val)));
  prefs.volume = soundVolume;
  savePrefs();
  if (win) win.webContents.send('sound:config', { enabled: soundEnabled, volume: soundVolume });
}

// ---------- runtime state ----------
let win = null;
const settings = { follow: true, wander: true, onTop: true };

let dragging = false;
let dragOffset = { x: 0, y: 0 };
let dragTimer = null;
let lastDragMoveAt = 0;
let lastDragCursor = null;
let dragSize = null;
let dragTrend = { x: 0, y: 0 };
let dragRendererPointIsPhysical = false;

let walkTimer = null;    // active stroll stepper
let walkPlan = null;     // scheduler for next stroll
let lookTimer = null;    // cursor poll
let lastLook = { dx: 0, dy: 0 };

// ---------- window ----------
function createWindow() {
  win = new BrowserWindow({
    width: 240,
    height: 320,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    title: 'OhMyChiikawa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false // keep the pet animating while unfocused
    }
  });

  win.setMenu(null);
  applyOnTop();
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (e) {}

  win.loadFile(path.join(__dirname, 'index.html'), {
    query: { pet: currentPet, scale: scaleName, lang, sound: soundEnabled ? '1' : '0', volume: String(soundVolume) }
  });

  // start click-through; the renderer turns it off while the cursor is on the pet
  win.setIgnoreMouseEvents(true, { forward: true });

  win.on('closed', () => {
    dragging = false;
    stopDragPoll();
    win = null;
  });
}

function applyOnTop() {
  if (!win) return;
  win.setAlwaysOnTop(settings.onTop, 'floating');
}

function workAreaForBounds(bounds) {
  return screen.getDisplayNearestPoint({
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  }).workArea;
}

function workAreaForDrag(bounds, point) {
  return dragAreaForBounds(screen.getAllDisplays(), bounds, point);
}

function pointDistanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function normalizeRendererPoint(point) {
  const raw = {
    x: point && Number.isFinite(point.x) ? point.x : 0,
    y: point && Number.isFinite(point.y) ? point.y : 0
  };
  if (dragRendererPointIsPhysical && screen.screenToDipPoint) {
    try {
      const dip = screen.screenToDipPoint(raw);
      if (Number.isFinite(dip.x) && Number.isFinite(dip.y)) return dip;
    } catch (e) {}
  }
  return raw;
}

function detectRendererPointMode(point) {
  dragRendererPointIsPhysical = false;
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !screen.screenToDipPoint) return;
  try {
    const raw = { x: point.x, y: point.y };
    const dip = screen.screenToDipPoint(raw);
    const cursor = screen.getCursorScreenPoint();
    dragRendererPointIsPhysical = pointDistanceSq(dip, cursor) + 4 < pointDistanceSq(raw, cursor);
  } catch (e) {}
}

function currentCursorPoint(fallback, preferFallback) {
  if (preferFallback && fallback && Number.isFinite(fallback.x) && Number.isFinite(fallback.y)) {
    return normalizeRendererPoint(fallback);
  }
  try {
    const point = screen.getCursorScreenPoint();
    if (Number.isFinite(point.x) && Number.isFinite(point.y)) return point;
  } catch (e) {}
  return {
    x: fallback && Number.isFinite(fallback.x) ? fallback.x : 0,
    y: fallback && Number.isFinite(fallback.y) ? fallback.y : 0
  };
}

function moveDraggedWindow(cursor, trustCursor) {
  if (!win) return;
  const cur = win.getBounds();
  const dragBounds = {
    x: cur.x,
    y: cur.y,
    width: dragSize ? dragSize.width : cur.width,
    height: dragSize ? dragSize.height : cur.height
  };
  const point = normalizeDragCursor(cursor, dragBounds, trustCursor);
  const area = workAreaForDrag(dragBounds, point);
  const next = resolveDragBounds(dragBounds, area, point, dragOffset);
  dragOffset = next.offset;
  if (next.bounds.x !== cur.x || next.bounds.y !== cur.y) {
    win.setPosition(next.bounds.x, next.bounds.y);
  }
}

function normalizeDragCursor(cursor, bounds, trustCursor) {
  const point = { x: Math.round(cursor.x), y: Math.round(cursor.y) };
  if (!lastDragCursor) {
    lastDragCursor = point;
    return point;
  }
  const maxJump = Math.max(160, Math.max(bounds.width, bounds.height) * 1.2);
  const dx = point.x - lastDragCursor.x;
  const dy = point.y - lastDragCursor.y;
  if (!trustCursor && (Math.abs(dx) > maxJump || Math.abs(dy) > maxJump ||
      (dragTrend.x > 0 && dx < -80) || (dragTrend.x < 0 && dx > 80) ||
      (dragTrend.y > 0 && dy < -80) || (dragTrend.y < 0 && dy > 80))) {
    return lastDragCursor;
  }
  if (Math.abs(dx) > 2) dragTrend.x = dx > 0 ? 1 : -1;
  if (Math.abs(dy) > 2) dragTrend.y = dy > 0 ? 1 : -1;
  lastDragCursor = point;
  return point;
}

function clampDragOffset(offset, bounds) {
  const maxX = Math.max(0, Math.round(bounds.width) - 1);
  const maxY = Math.max(0, Math.round(bounds.height) - 1);
  return {
    x: Math.max(0, Math.min(Math.round(offset.x), maxX)),
    y: Math.max(0, Math.min(Math.round(offset.y), maxY))
  };
}

function stopDragPoll() {
  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
  }
}

function startDragPoll() {
  stopDragPoll();
  dragTimer = setInterval(() => {
    if (!dragging || !win) return;
    if (Date.now() - lastDragMoveAt < 80) return;
    moveDraggedWindow(screen.getCursorScreenPoint(), false);
  }, 16);
}

// ---------- sizing & placement ----------
// Renderer measures the pet and asks for an exact window size (incl. motion
// headroom). We keep the pet's bottom-centre anchored so menu resizes feel
// stable, and place it bottom-right on first fit.
let placed = false;
let lastFitSize = null;
function fitWindow(w, h) {
  if (!win) return;
  w = Math.max(60, Math.round(w));
  h = Math.max(60, Math.round(h));
  lastFitSize = { width: w, height: h };
  const cur = win.getBounds();
  const disp = screen.getDisplayNearestPoint({ x: cur.x + cur.width / 2, y: cur.y + cur.height / 2 });
  const area = disp.workArea;
  let x, y;
  if (!placed) {
    x = area.x + area.width - w - 24;
    y = area.y + area.height - h - 12;
    placed = true;
  } else {
    // keep bottom-centre fixed
    x = Math.round(cur.x + cur.width / 2 - w / 2);
    y = Math.round(cur.y + cur.height - h);
  }
  const next = clampWindowBounds({ x, y, width: w, height: h }, area);
  win.setBounds(next);
  if (!win.isVisible()) win.show();
}

function restoreWindowSizeIfNeeded() {
  if (!win || !lastFitSize) return;
  const cur = win.getBounds();
  if (Math.abs(cur.width - lastFitSize.width) <= 2 && Math.abs(cur.height - lastFitSize.height) <= 2) return;
  const x = Math.round(cur.x + cur.width / 2 - lastFitSize.width / 2);
  const y = Math.round(cur.y + cur.height - lastFitSize.height);
  const area = screen.getDisplayNearestPoint({
    x: cur.x + cur.width / 2,
    y: cur.y + cur.height / 2
  }).bounds;
  win.setBounds(clampWindowBounds({
    x: x,
    y: y,
    width: lastFitSize.width,
    height: lastFitSize.height
  }, area));
}

// ---------- dragging ----------
ipcMain.on('drag:start', (_e, pos) => {
  if (!win) return;
  restoreWindowSizeIfNeeded();
  dragging = true;
  lastDragMoveAt = Date.now();
  detectRendererPointMode(pos);
  const cursor = currentCursorPoint(pos, true);
  const b = win.getBounds();
  dragSize = { width: b.width, height: b.height };
  lastDragCursor = { x: Math.round(cursor.x), y: Math.round(cursor.y) };
  dragTrend = { x: 0, y: 0 };
  dragOffset = clampDragOffset({ x: cursor.x - b.x, y: cursor.y - b.y }, b);
  stopWalk();
  startDragPoll();
});
ipcMain.on('drag:move', (_e, pos) => {
  if (!dragging || !win) return;
  lastDragMoveAt = Date.now();
  moveDraggedWindow(currentCursorPoint(pos, true), true);
});
ipcMain.on('drag:end', () => {
  dragging = false;
  lastDragMoveAt = 0;
  lastDragCursor = null;
  dragSize = null;
  dragTrend = { x: 0, y: 0 };
  dragRendererPointIsPhysical = false;
  stopDragPoll();
});

// ---------- click-through ----------
ipcMain.on('hit:ignore', (_e, ignore) => {
  if (win) win.setIgnoreMouseEvents(!!ignore, { forward: true });
});

// ---------- renderer lifecycle ----------
ipcMain.on('pet:fit', (_e, size) => fitWindow(size.w, size.h));
ipcMain.on('pet:quit', () => app.quit());

// Swap the displayed pet by reloading the page with a new ?pet=. Cheap and robust:
// the renderer rebuilds all layers for the new artwork on load. The cursor-follow
// and wander timers live here in the main process, so they survive the reload.
function switchPet(id) {
  if (!win || id === currentPet || !PET_LABELS[id]) return;
  currentPet = id;
  prefs.pet = id; savePrefs();
  win.loadFile(path.join(__dirname, 'index.html'), {
    query: { pet: currentPet, scale: scaleName, lang, sound: soundEnabled ? '1' : '0', volume: String(soundVolume) }
  });
}

// Switch the menu / speech language. The menu rebuilds on next open; the renderer
// updates its speech lines live over IPC (no reload needed).
function setLang(l) {
  l = (['en', 'zh', 'ja'].includes(l)) ? l : 'zh';
  if (l === lang) return;
  lang = l;
  prefs.lang = lang; savePrefs();
  if (win) win.webContents.send('pet:lang', lang);
}

// ---------- context menu ----------
ipcMain.on('menu:open', () => {
  if (!win) return;
  const tmpl = [
    { label: petLabel(currentPet), enabled: false },
    { type: 'separator' },
    {
      label: t('角色', 'Character', 'キャラクター'),
      submenu: Object.keys(PET_LABELS).map((id) => ({
        label: petLabel(id), type: 'radio', checked: currentPet === id,
        click: () => switchPet(id)
      }))
    },
    {
      label: t('语言', 'Language', '言語'),
      submenu: [
        { label: '中文', type: 'radio', checked: lang === 'zh', click: () => setLang('zh') },
        { label: 'English', type: 'radio', checked: lang === 'en', click: () => setLang('en') },
        { label: '日本語', type: 'radio', checked: lang === 'ja', click: () => setLang('ja') }
      ]
    },
    {
      label: t('声音', 'Sound', '音声'),
      submenu: [
        {
          label: t('开启声音', 'Enable sound', '音声を有効化'),
          type: 'checkbox',
          checked: soundEnabled,
          click: () => setSoundEnabled(!soundEnabled)
        },
        { type: 'separator' },
        {
          label: t('音量', 'Volume', '音量'),
          submenu: [
            { label: '25%', type: 'radio', checked: Math.abs(soundVolume - 0.25) < 0.05, click: () => setSoundVolume(0.25) },
            { label: '50%', type: 'radio', checked: Math.abs(soundVolume - 0.50) < 0.05, click: () => setSoundVolume(0.50) },
            { label: '75%', type: 'radio', checked: Math.abs(soundVolume - 0.75) < 0.05, click: () => setSoundVolume(0.75) },
            { label: '100%', type: 'radio', checked: Math.abs(soundVolume - 1.00) < 0.05, click: () => setSoundVolume(1.00) }
          ]
        }
      ]
    },
    { type: 'separator' },
    {
      label: t('跟随鼠标', 'Follow cursor', 'カーソルを追う'), type: 'checkbox', checked: settings.follow,
      click: () => { settings.follow = !settings.follow; if (settings.follow) startLook(); else stopLook(); }
    },
    {
      label: t('四处走动', 'Wander', 'うろうろ歩く'), type: 'checkbox', checked: settings.wander,
      click: () => { settings.wander = !settings.wander; if (settings.wander) scheduleWalk(); else stopWalk(); }
    },
    {
      label: t('总在最前', 'Always on top', '常に最前面'), type: 'checkbox', checked: settings.onTop,
      click: () => { settings.onTop = !settings.onTop; applyOnTop(); }
    },
    { type: 'separator' },
    {
      label: t('大小', 'Size', 'サイズ'),
      submenu: ['tiny', 'small', 'medium', 'large'].map((s) => ({
        label: {
          tiny: t('极小', 'Tiny', '極小'),
          small: t('小', 'Small', '小'),
          medium: t('中', 'Medium', '中'),
          large: t('大', 'Large', '大')
        }[s],
        type: 'radio', checked: scaleName === s,
        click: () => { scaleName = s; if (win) win.webContents.send('scale:set', SCALES[s]); }
      }))
    },
    { label: t('跳一下', 'Hop', 'ジャンプ'), click: () => win && win.webContents.send('pet:react', 'hop') },
    ...(ROLL_PETS.has(currentPet)
      ? [{ label: t('转手', 'Roll hands', '手をぐるぐる'), click: () => win && win.webContents.send('pet:react', 'roll') }]
      : []),
    { type: 'separator' },
    { label: t('退出', 'Quit', '終了') + ' ' + petLabel(currentPet), click: () => app.quit() }
  ];
  Menu.buildFromTemplate(tmpl).popup({ window: win });
});

// ---------- cursor poll: drives click-through hit-testing AND eye-follow ----------
// Click-through is hit-tested here, from the global cursor against live window
// bounds, rather than relying solely on the renderer's mousemove. On Windows the
// forwarded move events under setIgnoreMouseEvents({forward:true}) stall after
// focus changes / occlusion, and the pet can also wander UNDER a stationary
// cursor (the window moves but no mousemove fires) — both leave the renderer's
// toggle stuck, so the pet stops being draggable / right-clickable and clicks
// fall through to the desktop. Polling the OS cursor fixes both, because IPC is
// unaffected by the ignore state. The poll runs whenever the window is open;
// `settings.follow` only gates the eye-follow message.
function startLook() {
  stopLook();
  lookTimer = setInterval(() => {
    if (!win || dragging) return;
    const c = screen.getCursorScreenPoint();
    const b = win.getContentBounds();
    // Window-relative cursor -> renderer alpha hit-test (always, for click-through).
    win.webContents.send('pet:cursor', { x: c.x - b.x, y: c.y - b.y });
    if (!settings.follow) return;
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height * 0.42; // around the face
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    const dx = clamp((c.x - cx) / 360);
    const dy = clamp((c.y - cy) / 360);
    if (Math.abs(dx - lastLook.dx) > 0.03 || Math.abs(dy - lastLook.dy) > 0.03) {
      lastLook = { dx, dy };
      win.webContents.send('pet:look', { dx, dy });
    }
  }, 80);
}
function stopLook() { if (lookTimer) { clearInterval(lookTimer); lookTimer = null; } }

// ---------- wander / edge-walk ----------
function scheduleWalk() {
  clearTimeout(walkPlan);
  if (!settings.wander) return;
  const delay = 6000 + Math.random() * 9000;
  walkPlan = setTimeout(startWalk, delay);
}
function startWalk() {
  if (!win || dragging || !settings.wander) { scheduleWalk(); return; }
  restoreWindowSizeIfNeeded();
  let b = win.getBounds();
  const area = screen.getDisplayNearestPoint({ x: b.x + b.width / 2, y: b.y + b.height / 2 }).bounds;
  const dir = Math.random() < 0.5 ? -1 : 1;
  const distance = 80 + Math.random() * 220;
  const speed = PET_SPEED[currentPet] || 2; // usagi runs faster (it has a real run cycle)
  const plan = resolveWalkPlan(b, area, dir, distance, speed);
  if (!plan) { stopWalk(); return; }
  if (plan.bounds.x !== b.x) {
    win.setPosition(plan.bounds.x, b.y);
    b = Object.assign({}, b, { x: plan.bounds.x });
  }
  const targetX = plan.targetX;
  win.webContents.send('pet:walk', { dir: plan.dir });
  clearInterval(walkTimer);
  walkTimer = setInterval(() => {
    if (!win || dragging) { stopWalk(); return; }
    const cur = win.getBounds();
    const remaining = targetX - cur.x;
    if (Math.abs(remaining) <= speed) {
      win.setPosition(targetX, cur.y);
      stopWalk();
      return;
    }
    const next = clampWindowBounds({
      x: Math.round(cur.x + Math.sign(remaining) * speed),
      y: b.y,
      width: cur.width,
      height: cur.height
    }, area);
    if (next.x === cur.x) { stopWalk(); return; }
    win.setPosition(next.x, cur.y);
  }, 16);
}
function stopWalk() {
  if (walkTimer) { clearInterval(walkTimer); walkTimer = null; }
  if (win) win.webContents.send('pet:walk-stop');
  scheduleWalk();
}

// ---------- app lifecycle ----------
app.on('window-all-closed', () => app.quit());
app.whenReady().then(() => {
  createWindow();
  win.webContents.once('did-finish-load', () => {
    startLook(); // always polls: drives click-through; eye-follow gated by settings.follow
    scheduleWalk();
  });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
