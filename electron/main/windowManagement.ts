import { app, BrowserWindow, WebContents } from 'electron'

import { destroyAllViews } from './viewData'

export const windows = {
  openWindows: [] as {
    id: string
    win: BrowserWindow
    state: {
      isMinimized: boolean
      selectedView: string | null
      lastFocused?: number
    }
    closed?: boolean
  }[],
  hasEverCreatedWindow: false,
  nextId: 1,
  windowFromContents(webContents: WebContents) {
    return windows.openWindows.find((w) => w.win.webContents.id === webContents.id)
  },
  addWindow(window: BrowserWindow) {
    windows.hasEverCreatedWindow = true

    windows.openWindows.push({
      id: windows.nextId.toString(),
      win: window,
      state: {
        selectedView: '',
        isMinimized: false,
      },
    })

    window.on('focus', () => {
      windows.getState(window).lastFocused = Date.now()
    })

    window.on('close', () => {
      // if the BrowserView is still attached to the window on close, Electron will destroy it automatically, but we want to manage it ourselves
      window.setBrowserView(null)
      windows.openWindows.find((w) => w.win === window).closed = true
    })

    window.on('closed', () => {
      windows.removeWindow(window)

      // Quit on last window closed (ignoring secondary and hidden windows)
      if (windows.openWindows.length === 0 && process.platform !== 'darwin') {
        app.quit()
      }
    })

    windows.nextId++
  },
  removeWindow(window: BrowserWindow) {
    windows.openWindows.splice(
      windows.openWindows.findIndex((w) => w.win === window),
      1,
    )

    // unload BrowserViews when all windows are closed
    if (windows.openWindows.length === 0) {
      destroyAllViews()
    }
  },
  getCurrent() {
    const lastFocused = windows.openWindows
      .filter((w) => !w.closed)
      .sort((a, b) => b.state.lastFocused - a.state.lastFocused)[0]
    if (lastFocused) {
      return lastFocused.win
    }
    return null
  },
  getAll() {
    return windows.openWindows.filter((w) => !w.closed).map((w) => w.win)
  },
  getState(window: BrowserWindow) {
    return windows.openWindows.find((w) => w.win === window).state
  },
}
