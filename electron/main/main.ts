import fs from 'node:fs'
import { release } from 'node:os'
import path, { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import electron, { app, BrowserWindow, ipcMain as ipc, Menu, session, shell } from 'electron'

import { registerFiltering } from './filtering'
import { buildAppMenu, createDockMenu } from './menu'
import { registerBundleProtocol } from './minInternalProtocol'
import { getUserDataPath, settings } from './settingsMain'
import { buildTouchBar } from './touchbar'
import { windows } from './windowManagement'
// eslint-disable-next-line no-underscore-dangle
const __filename = fileURLToPath(import.meta.url)
// eslint-disable-next-line no-underscore-dangle
const __dirname = dirname(__filename)

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows', 'true')

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

const userDataPath = getUserDataPath()
app.setPath('userData', userDataPath)
// above are about app

// below are about window
// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

// const win: BrowserWindow | null = null
// Here, you can also use other preload
const preload = join(__dirname, '../preload/index.mjs')
// const indexHtml = join(process.env.DIST, 'index.html')
const wholeAppUrl = process.env.VITE_DEV_SERVER_URL || 'write-production-url-here'
const saveWindowBounds = () => {
  if (windows.getCurrent()) {
    const bounds = Object.assign(windows.getCurrent().getBounds(), {
      maximized: windows.getCurrent().isMaximized(),
    })
    fs.writeFileSync(path.join(userDataPath, 'windowBounds.json'), JSON.stringify(bounds))
  }
}

export function sendIPCToWindow(window, action, data = {}) {
  if (window && window.isDestroyed()) {
    console.warn(`ignoring message ${action} sent to destroyed window`)
    return
  }

  if (window && window.webContents && window.webContents.isLoadingMainFrame()) {
    // immediately after a did-finish-load event, isLoading can still be true,
    // so wait a bit to confirm that the page is really loading
    setTimeout(() => {
      if (window.webContents.isLoadingMainFrame()) {
        window.webContents.once('did-finish-load', () => {
          window.webContents.send(action, data || {})
        })
      } else {
        window.webContents.send(action, data || {})
      }
    }, 0)
  } else if (window) {
    window.webContents.send(action, data || {})
  } else {
    window = createWindow()
    window.webContents.once('did-finish-load', () => {
      window.webContents.send(action, data || {})
    })
  }
}

function clamp(n, min, max) {
  return Math.max(Math.min(n, max), min)
}

export function createWindow() {
  let bounds
  try {
    const data = fs.readFileSync(path.join(userDataPath, 'windowBounds.json'), 'utf-8')
    bounds = JSON.parse(data)
  } catch (e) {
    //
  }

  if (!bounds) {
    // there was an error, probably because the file doesn't exist
    const size = electron.screen.getPrimaryDisplay().workAreaSize
    bounds = {
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      maximized: true,
    }
  }

  // make the bounds fit inside a currently-active screen
  // (since the screen Min was previously open on could have been removed)
  // see: https://github.com/minbrowser/min/issues/904
  const containingRect = electron.screen.getDisplayMatching(bounds).workArea

  bounds = {
    x: clamp(bounds.x, containingRect.x, containingRect.x + containingRect.width - bounds.width),
    y: clamp(bounds.y, containingRect.y, containingRect.y + containingRect.height - bounds.height),
    width: clamp(bounds.width, 0, containingRect.width),
    height: clamp(bounds.height, 0, containingRect.height),
    maximized: bounds.maximized,
  }

  return createWindowWithBounds(bounds)
}

function createWindowWithBounds(bounds) {
  const newWin = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: process.platform === 'win32' ? 400 : 320, // controls take up more horizontal space on Windows
    minHeight: 350,
    titleBarStyle: settings.get('useSeparateTitlebar') ? 'default' : 'hidden',
    trafficLightPosition: { x: 12, y: 10 },
    // icon: `${__dirname}/icons/icon256.png`,
    icon: join(process.env.VITE_PUBLIC, 'favicon.ico'),
    frame: settings.get('useSeparateTitlebar'),
    alwaysOnTop: settings.get('windowAlwaysOnTop'),
    backgroundColor: '#fff', // the value of this is ignored, but setting it seems to work around https://github.com/electron/electron/issues/10559
    webPreferences: {
      // webSecurity: false,
      preload,
      nodeIntegration: true,
      contextIsolation: false,
      nodeIntegrationInWorker: true, // used by ProcessSpawner
      additionalArguments: [
        `--user-data-path=${userDataPath}`,
        `--app-version=${app.getVersion()}`,
        `--app-name=${app.getName()}`,
        ...(process.env.VITE_DEV_SERVER_URL ? ['--development-mode'] : []),
        `--window-id=${windows.nextId}`,
        ...(windows.getAll().length === 0 ? ['--initial-window'] : []),
        ...(windows.hasEverCreatedWindow ? [] : ['--launch-window']),
      ],
    },
  })

  // windows and linux always use a menu button in the upper-left corner instead
  // if frame: false is set, this won't have any effect, but it does apply on Linux if "use separate titlebar" is enabled
  if (process.platform !== 'darwin') {
    newWin.setMenuBarVisibility(false)
  }

  // and load the index.html of the app.
  if (process.env.VITE_DEV_SERVER_URL) {
    // electron-vite-vue#298
    newWin.loadURL(wholeAppUrl)
    // Open devTool if the app is not packaged
    newWin.webContents.openDevTools()
  } else {
    newWin.loadURL(wholeAppUrl)
    // newWin.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  newWin.webContents.on('did-finish-load', () => {
    console.log('send main process message in main process')
    setTimeout(() => {
      newWin?.webContents.send('main-process-message', new Date().toLocaleString())
    }, 5000)
  })

  // Make all links open with the browser, not with the application
  newWin.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (bounds.maximized) {
    newWin.maximize()

    newWin.webContents.once('did-finish-load', () => {
      sendIPCToWindow(newWin, 'maximize')
    })
  }

  newWin.on('close', () => {
    // save the window size for the next launch of the app
    saveWindowBounds()
  })

  newWin.on('focus', () => {
    if (!windows.getState(newWin).isMinimized) {
      sendIPCToWindow(newWin, 'windowFocus')
    }
  })

  newWin.on('minimize', () => {
    sendIPCToWindow(newWin, 'minimize')
    windows.getState(newWin).isMinimized = true
  })

  newWin.on('restore', () => {
    windows.getState(newWin).isMinimized = false
  })

  newWin.on('maximize', () => {
    sendIPCToWindow(newWin, 'maximize')
  })

  newWin.on('unmaximize', () => {
    sendIPCToWindow(newWin, 'unmaximize')
  })

  newWin.on('focus', () => {
    sendIPCToWindow(newWin, 'focus')
  })

  newWin.on('blur', () => {
    // if the devtools for this window are focused, this check will be false, and we keep the focused class on the window
    if (BrowserWindow.getFocusedWindow() !== newWin) {
      sendIPCToWindow(newWin, 'blur')
    }
  })

  newWin.on('enter-full-screen', () => {
    sendIPCToWindow(newWin, 'enter-full-screen')
  })

  newWin.on('leave-full-screen', () => {
    sendIPCToWindow(newWin, 'leave-full-screen')
    // https://github.com/minbrowser/min/issues/1093
    newWin.setMenuBarVisibility(false)
  })

  newWin.on('enter-html-full-screen', () => {
    sendIPCToWindow(newWin, 'enter-html-full-screen')
  })

  newWin.on('leave-html-full-screen', () => {
    sendIPCToWindow(newWin, 'leave-html-full-screen')
    // https://github.com/minbrowser/min/issues/952
    newWin.setMenuBarVisibility(false)
  })

  /*
Handles events from mouse buttons
Unsupported on macOS, and on Linux, there is a default handler already,
so registering a handler causes events to happen twice.
See: https://github.com/electron/electron/issues/18322
*/
  if (process.platform === 'win32') {
    newWin.on('app-command', (e, command) => {
      if (command === 'browser-backward') {
        sendIPCToWindow(newWin, 'goBack')
      } else if (command === 'browser-forward') {
        sendIPCToWindow(newWin, 'goForward')
      }
    })
  }

  // prevent remote pages from being loaded using drag-and-drop, since they would have node access

  newWin.webContents.on('will-navigate', (e, url) => {
    if (url !== wholeAppUrl) {
      e.preventDefault()
    }
  })

  newWin.setTouchBar(buildTouchBar())

  windows.addWindow(newWin)

  return newWin
}

/*
async function createWindow() {
  win = new BrowserWindow({
    title: 'Main window',
    icon: join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    // electron-vite-vue#298
    win.loadURL(url)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
  // win.webContents.on('will-navigate', (event, url) => { }) #344
}
*/

// app events
// app.whenReady().then(createWindow)
/*
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
*/

/*
app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})
*/

/*
app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})
*/

// New window example arg: new windows url
/*
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})
*/

export function openTabInWindow(url) {
  sendIPCToWindow(windows.getCurrent(), 'addTab', {
    url,
  })
}

function handleCommandLineArguments(argv) {
  // the "ready" event must occur before this function can be used
  if (argv) {
    argv.forEach((arg, idx) => {
      if (arg && arg.toLowerCase() !== __dirname.toLowerCase()) {
        // URL
        if (arg.indexOf('://') !== -1) {
          sendIPCToWindow(windows.getCurrent(), 'addTab', {
            url: arg,
          })
        } else if (idx > 0 && argv[idx - 1] === '-s') {
          // search
          sendIPCToWindow(windows.getCurrent(), 'addTab', {
            url: arg,
          })
        } else if (/\.(m?ht(ml)?|pdf)$/.test(arg) && fs.existsSync(arg)) {
          // local files (.html, .mht, mhtml, .pdf)
          sendIPCToWindow(windows.getCurrent(), 'addTab', {
            url: `file://${path.resolve(arg)}`,
          })
        }
      }
    })
  }
}

export const initMain = () => {
  let appIsReady = false
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  app.whenReady().then(() => {
    console.log('app when Ready')
    settings.set('restartNow', false)
    appIsReady = true

    registerBundleProtocol(session.defaultSession)

    const newWin = createWindow()

    newWin.webContents.on('did-finish-load', () => {
      // if a URL was passed as a command line argument (probably because Min is set as the default browser on Linux), open it.
      handleCommandLineArguments(process.argv)

      // there is a URL from an "open-url" event (on Mac)
      if (global.URLToOpen) {
        // if there is a previously set URL to open (probably from opening a link on macOS), open it
        sendIPCToWindow(newWin, 'addTab', {
          url: global.URLToOpen,
        })
        global.URLToOpen = null
      }
    })
    global.mainWin = newWin

    const mainMenu = buildAppMenu()
    Menu.setApplicationMenu(mainMenu)
    createDockMenu()

    app.on('session-created', (ses) => {
      registerFiltering(ses)
    })
    registerFiltering(session.defaultSession)
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('open-url', (e, url) => {
    if (appIsReady) {
      sendIPCToWindow(windows.getCurrent(), 'addTab', {
        url,
      })
    } else {
      global.URLToOpen = url // this will be handled later in the createWindow callback
    }
  })

  // handoff support for macOS
  app.on('continue-activity', (e, type, userInfo, details) => {
    if (type === 'NSUserActivityTypeBrowsingWeb' && details.webpageURL) {
      e.preventDefault()
      sendIPCToWindow(windows.getCurrent(), 'addTab', {
        url: details.webpageURL,
      })
    }
  })

  app.on('second-instance', (e, argv, _workingDir) => {
    if (windows.getCurrent()) {
      if (windows.getCurrent().isMinimized()) {
        windows.getCurrent().restore()
      }
      windows.getCurrent().focus()
      // add a tab with the new URL
      handleCommandLineArguments(argv)
    }
  })

  /**
   * Emitted when the application is activated, which usually happens when clicks on the applications's dock icon
   * https://github.com/electron/electron/blob/master/docs/api/app.md#event-activate-os-x
   *
   * Opens a new tab when all tabs are closed, and min is still open by clicking on the application dock icon
   */
  app.on('activate', (/* e, hasVisibleWindows */) => {
    if (!windows.getCurrent() && appIsReady) {
      // sometimes, the event will be triggered before the app is ready, and creating new windows will fail
      console.log('activate from dock macos and create a new window')
      createWindow()
    }
  })

  ipc.on('focusMainWebContents', () => {
    // TODO fix
    windows.getCurrent().webContents.focus()
  })

  let secondaryMenu: Menu
  ipc.on('showSecondaryMenu', (event, data) => {
    if (!secondaryMenu) {
      secondaryMenu = buildAppMenu({ secondary: true })
    }
    secondaryMenu.popup({
      x: data.x,
      y: data.y,
    })
  })

  ipc.on('handoffUpdate', (e, data) => {
    if (app.setUserActivity && data.url && data.url.startsWith('http')) {
      app.setUserActivity('NSUserActivityTypeBrowsingWeb', {}, data.url)
    } else if (app.invalidateCurrentActivity) {
      app.invalidateCurrentActivity()
    }
  })

  ipc.on('quit', () => {
    app.quit()
  })

  ipc.on('tab-state-change', (e, events) => {
    windows.getAll().forEach((window) => {
      if (window.webContents.id !== e.sender.id) {
        window.webContents.send('tab-state-change-receive', {
          sourceWindowId: windows.windowFromContents(e.sender).id,
          events,
        })
      }
    })
  })

  ipc.on('request-tab-state', (e) => {
    const otherWindow = windows.getAll().find((w) => w.webContents.id !== e.sender.id)
    if (!otherWindow) {
      throw new Error("secondary window doesn't exist as source for tab state")
    }
    ipc.once('return-tab-state', (e2, data) => {
      e.returnValue = data
    })
    otherWindow.webContents.send('read-tab-state')
  })

  /* places service */
  /* ignore this first because I really don't know what it's for 
  const placesPage = `file://${__dirname}/js/places/placesService.html`

  let placesWindow = null
  app.once('ready', () => {
    placesWindow = new BrowserWindow({
      width: 300,
      height: 300,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    })

    placesWindow.loadURL(placesPage)
  })

  ipc.on('places-connect', (e) => {
    placesWindow.webContents.postMessage('places-connect', null, e.ports)
  })
  */
}
