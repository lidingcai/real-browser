import electron, { app, Menu, MenuItem, MenuItemConstructorOptions, webContents } from 'electron'

import { l } from './i18n'
import { createWindow, openTabInWindow, sendIPCToWindow } from './main'
import { showFocusModeDialog1, showFocusModeDialog2 } from './remoteActions'
import { settings } from './settingsMain'
import { destroyAllViews } from './viewData'
import { windows } from './windowManagement'

export function buildAppMenu(options: { secondary?: boolean } = {}) {
  global.isFocusMode = false
  function getFormattedKeyMapEntry(keybinding: string) {
    const value = settings.get('keyMap')?.[keybinding]

    if (value) {
      if (Array.isArray(value)) {
        // value is array if multiple entries are set
        return value[0].replace('mod', 'CmdOrCtrl')
      }
      return value.replace('mod', 'CmdOrCtrl')
    }

    return null
  }

  const tabTaskActions = [
    {
      label: l('appMenuNewTab'),
      accelerator: getFormattedKeyMapEntry('addTab') || 'CmdOrCtrl+t',
      click(_item: any, window: any, event: { triggeredByAccelerator: any }) {
        // keyboard shortcuts for these items are handled in the renderer
        if (!event.triggeredByAccelerator) {
          sendIPCToWindow(window, 'addTab')
        }
      },
    },
    {
      label: l('appMenuNewPrivateTab'),
      accelerator: getFormattedKeyMapEntry('addPrivateTab') || 'shift+CmdOrCtrl+p',
      click(_item: any, window: any, event: { triggeredByAccelerator: any }) {
        if (!event.triggeredByAccelerator) {
          sendIPCToWindow(window, 'addPrivateTab')
        }
      },
    },
    {
      label: l('appMenuNewTask'),
      accelerator: getFormattedKeyMapEntry('addTask') || 'CmdOrCtrl+n',
      click(_item: any, window: any, event: { triggeredByAccelerator: any }) {
        if (!event.triggeredByAccelerator) {
          sendIPCToWindow(window, 'addTask')
        }
      },
    },
    {
      label: l('appMenuNewWindow'),
      accelerator: getFormattedKeyMapEntry('addWindow') || 'shift+CmdOrCtrl+n',
      click() {
        if (global.isFocusMode) {
          showFocusModeDialog2()
        } else {
          createWindow()
        }
      },
    },
  ]

  const personalDataItems = [
    {
      label: l('appMenuBookmarks'),
      accelerator: getFormattedKeyMapEntry('showBookmarks') || 'CmdOrCtrl+b',
      click(_item: any, window: any, event: { triggeredByAccelerator: any }) {
        if (!event.triggeredByAccelerator) {
          sendIPCToWindow(window, 'showBookmarks')
        }
      },
    },
    {
      label: l('appMenuHistory'),
      accelerator: getFormattedKeyMapEntry('showHistory') || 'Shift+CmdOrCtrl+h',
      click(_item: any, window: any, event: { triggeredByAccelerator: any }) {
        if (!event.triggeredByAccelerator) {
          sendIPCToWindow(window, 'showHistory')
        }
      },
    },
  ]

  const quitAction = {
    label: l('appMenuQuit').replace('%n', app.name),
    accelerator: getFormattedKeyMapEntry('quitMin') || 'CmdOrCtrl+Q',
    click(_item: any, _window: any, event: { triggeredByAccelerator: any }) {
      if (!event.triggeredByAccelerator) {
        app.quit()
      }
    },
  }

  const preferencesAction = {
    label: l('appMenuPreferences'),
    accelerator: 'CmdOrCtrl+,',
    click(_item: any, window: any) {
      sendIPCToWindow(window, 'addTab', {
        url: 'min://app/pages/settings/index.html',
        // url: `http://localhost:5173/#/pages/settings`,
      })
    },
  }

  type TypeType = 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio'
  type RoleType =
    | 'undo'
    | 'redo'
    | 'cut'
    | 'copy'
    | 'paste'
    | 'pasteAndMatchStyle'
    | 'delete'
    | 'selectAll'
    | 'reload'
    | 'forceReload'
    | 'toggleDevTools'
    | 'resetZoom'
    | 'zoomIn'
    | 'zoomOut'
    | 'toggleSpellChecker'
    | 'togglefullscreen'
    | 'window'
    | 'minimize'
    | 'close'
    | 'help'
    | 'about'
    | 'services'
    | 'hide'
    | 'hideOthers'
    | 'unhide'
    | 'quit'
    | 'showSubstitutions'
    | 'toggleSmartQuotes'
    | 'toggleSmartDashes'
    | 'toggleTextReplacement'
    | 'startSpeaking'
    | 'stopSpeaking'
    | 'zoom'
    | 'front'
    | 'appMenu'
    | 'fileMenu'
    | 'editMenu'
    | 'viewMenu'
    | 'shareMenu'
    | 'recentDocuments'
    | 'toggleTabBar'
    | 'selectNextTab'
    | 'selectPreviousTab'
    | 'showAllTabs'
    | 'mergeAllWindows'
    | 'clearRecentDocuments'
    | 'moveTabToNewWindow'
    | 'windowMenu'

  const template: Array<MenuItemConstructorOptions | MenuItem> = [
    ...(options.secondary ? tabTaskActions : []),
    ...(options.secondary ? [{ type: 'separator' as TypeType }] : []),
    ...(options.secondary ? personalDataItems : []),
    ...(options.secondary ? [{ type: 'separator' as TypeType }] : []),
    ...(options.secondary ? [preferencesAction] : []),
    ...(options.secondary ? [{ type: 'separator' as TypeType }] : []),
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              {
                label: l('appMenuAbout').replace('%n', app.name),
                role: 'about' as RoleType,
              },
              {
                type: 'separator' as TypeType,
              },
              preferencesAction,
              {
                label: 'Services',
                role: 'services' as RoleType,
                submenu: [],
              },
              {
                type: 'separator' as TypeType,
              },
              {
                label: l('appMenuHide').replace('%n', app.name),
                accelerator: 'CmdOrCtrl+H',
                role: 'hide' as RoleType,
              },
              {
                label: l('appMenuHideOthers'),
                accelerator: 'CmdOrCtrl+Alt+H',
                role: 'hideothers' as RoleType,
              },
              {
                label: l('appMenuShowAll'),
                role: 'unhide' as RoleType,
              },
              {
                type: 'separator' as TypeType,
              },
              quitAction,
            ],
          },
        ]
      : []),
    {
      label: l('appMenuFile'),
      submenu: [
        ...(!options.secondary ? tabTaskActions : []),
        ...(!options.secondary ? [{ type: 'separator' as TypeType }] : []),
        {
          label: l('appMenuSavePageAs'),
          accelerator: 'CmdOrCtrl+s',
          click(_item, window) {
            sendIPCToWindow(window, 'saveCurrentPage')
          },
        },
        {
          type: 'separator' as TypeType,
        },
        {
          label: l('appMenuPrint'),
          accelerator: 'CmdOrCtrl+p',
          click(_item, window) {
            sendIPCToWindow(window, 'print')
          },
        },
        ...(!options.secondary && process.platform === 'linux' ? [{ type: 'separator' as TypeType }] : []),
        ...(!options.secondary && process.platform === 'linux' ? [quitAction] : []),
      ],
    },
    {
      label: l('appMenuEdit'),
      submenu: [
        {
          label: l('appMenuUndo'),
          accelerator: 'CmdOrCtrl+Z',
          role: 'undo' as RoleType,
        },
        {
          label: l('appMenuRedo'),
          accelerator: 'Shift+CmdOrCtrl+Z',
          role: 'redo' as RoleType,
        },
        {
          type: 'separator' as TypeType,
        },
        {
          label: l('appMenuCut'),
          accelerator: 'CmdOrCtrl+X',
          role: 'cut' as RoleType,
        },
        {
          label: l('appMenuCopy'),
          accelerator: 'CmdOrCtrl+C',
          role: 'copy' as RoleType,
        },
        {
          label: l('appMenuPaste'),
          accelerator: 'CmdOrCtrl+V',
          role: 'paste' as RoleType,
        },
        {
          label: l('appMenuSelectAll'),
          accelerator: 'CmdOrCtrl+A',
          role: 'selectall' as RoleType,
        },
        {
          type: 'separator' as TypeType,
        },
        {
          label: l('appMenuFind'),
          accelerator: 'CmdOrCtrl+F',
          click(_item, window) {
            sendIPCToWindow(window, 'findInPage')
          },
        },
        ...(!options.secondary && process.platform !== 'darwin' ? [{ type: 'separator' as TypeType }] : []),
        ...(!options.secondary && process.platform !== 'darwin' ? [preferencesAction] : []),
      ],
    },
    {
      label: l('appMenuView'),
      submenu: [
        ...(!options.secondary ? personalDataItems : []),
        ...(!options.secondary ? [{ type: 'separator' as TypeType }] : []),
        {
          label: l('appMenuZoomIn'),
          accelerator: 'CmdOrCtrl+Plus',
          click(_item, window) {
            sendIPCToWindow(window, 'zoomIn')
          },
        },
        {
          label: l('appMenuZoomOut'),
          accelerator: 'CmdOrCtrl+-',
          click(_item, window) {
            sendIPCToWindow(window, 'zoomOut')
          },
        },
        {
          label: l('appMenuActualSize'),
          accelerator: 'CmdOrCtrl+0',
          click(_item, window) {
            sendIPCToWindow(window, 'zoomReset')
          },
        },
        {
          type: 'separator' as TypeType,
        },
        {
          label: l('appMenuFocusMode'),
          accelerator: undefined,
          type: 'checkbox' as TypeType,
          checked: false,
          click(_item, _window) {
            if (global.isFocusMode) {
              global.isFocusMode = false
              windows.getAll().forEach((win) => sendIPCToWindow(win, 'exitFocusMode'))
            } else {
              global.isFocusMode = true
              windows.getAll().forEach((win) => sendIPCToWindow(win, 'enterFocusMode'))

              // wait to show the message until the tabs have been hidden, to make the message less confusing
              setTimeout(() => {
                showFocusModeDialog1()
              }, 16)
            }
          },
        },
        {
          label: l('appMenuFullScreen'),
          accelerator: (() => {
            if (process.platform === 'darwin') {
              return 'Ctrl+Command+F'
            }
            return 'F11'
          })(),
          role: 'togglefullscreen' as RoleType,
        },
      ],
    },
    {
      label: l('appMenuDeveloper'),
      submenu: [
        {
          label: l('appMenuInspectPage'),
          accelerator: (() => {
            if (process.platform === 'darwin') {
              return 'Cmd+Alt+I'
            }
            return 'Ctrl+Shift+I'
          })(),
          click(_item, window) {
            sendIPCToWindow(window, 'inspectPage')
          },
        },
        // this is defined a second time (but hidden) in order to provide two keyboard shortcuts
        {
          label: l('appMenuInspectPage'),
          visible: false,
          accelerator: 'f12',
          click(_item, window) {
            sendIPCToWindow(window, 'inspectPage')
          },
        },
        {
          type: 'separator' as TypeType,
        },
        ...(process.env.VITE_DEV_SERVER_URL
          ? [
              {
                label: l('appMenuReloadBrowser'),
                accelerator: process.env.VITE_DEV_SERVER_URL ? 'alt+CmdOrCtrl+R' : undefined,
                click(_item: any, _focusedWindow: any) {
                  destroyAllViews()
                  windows.getAll().forEach((win) => win.close())
                  createWindow()
                },
              },
            ]
          : []),
        {
          label: l('appMenuInspectBrowser'),
          accelerator: (() => {
            if (process.platform === 'darwin') {
              return 'Shift+Cmd+Alt+I'
            }
            return 'Ctrl+Shift+Alt+I'
          })(),
          click(_item, focusedWindow) {
            if (focusedWindow) focusedWindow.webContents.toggleDevTools()
          },
        },
      ],
    },
    ...(process.platform === 'darwin'
      ? [
          {
            label: l('appMenuWindow'),
            role: 'window' as RoleType,
            submenu: [
              {
                label: l('appMenuMinimize'),
                accelerator: 'CmdOrCtrl+M',
                role: 'minimize' as RoleType,
              },
              {
                label: l('appMenuClose'),
                accelerator: 'CmdOrCtrl+W',
                click(_item: any, _window: any) {
                  if (windows.getAll().length > 0 && !windows.getAll().some((win) => win.isFocused())) {
                    // a devtools window is focused, close it
                    const contents = webContents.getAllWebContents()
                    for (let i = 0; i < contents.length; i++) {
                      if (contents[i].isDevToolsFocused()) {
                        contents[i].closeDevTools()
                        return
                      }
                    }
                  }
                  // otherwise, this event will be handled in the main window
                },
              },
              {
                label: l('appMenuAlwaysOnTop'),
                type: 'checkbox' as TypeType,
                checked: settings.get('windowAlwaysOnTop') || false,
                click(item: { checked: boolean }, _window: any) {
                  windows.getAll().forEach((win) => {
                    win.setAlwaysOnTop(item.checked)
                  })
                  settings.set('windowAlwaysOnTop', item.checked)
                },
              },
              {
                type: 'separator' as TypeType,
              },
              {
                label: l('appMenuBringToFront'),
                role: 'front' as RoleType,
              },
            ],
          },
        ]
      : []),
    {
      label: l('appMenuHelp'),
      role: 'help' as RoleType,
      submenu: [
        {
          label: l('appMenuKeyboardShortcuts'),
          click() {
            openTabInWindow('https://github.com/minbrowser/min/wiki#keyboard-shortcuts')
          },
        },
        {
          label: l('appMenuReportBug'),
          click() {
            openTabInWindow('https://github.com/minbrowser/min/issues/new')
          },
        },
        {
          label: l('appMenuTakeTour'),
          click() {
            openTabInWindow('https://minbrowser.github.io/min/tour/')
          },
        },
        {
          label: l('appMenuViewGithub'),
          click() {
            openTabInWindow('https://github.com/minbrowser/min')
          },
        },
        ...(process.platform !== 'darwin' ? [{ type: 'separator' as TypeType }] : []),
        ...(process.platform !== 'darwin'
          ? [
              {
                label: l('appMenuAbout').replace('%n', app.name),
                click(_item: any, _window: any) {
                  const info = [`Min v${app.getVersion()}`, `Chromium v${process.versions.chrome}`]
                  electron.dialog.showMessageBox({
                    type: 'info',
                    title: l('appMenuAbout').replace('%n', app.name),
                    message: info.join('\n'),
                    buttons: [l('closeDialog')],
                  })
                },
              },
            ]
          : []),
      ],
    },
    ...(options.secondary && process.platform !== 'darwin' ? [{ type: 'separator' as TypeType }] : []),
    ...(options.secondary && process.platform !== 'darwin' ? [quitAction] : []),
  ]
  return Menu.buildFromTemplate(template)
}

export function createDockMenu() {
  // create the menu. based on example from https://github.com/electron/electron/blob/master/docs/tutorial/desktop-environment-integration.md#custom-dock-menu-macos
  if (process.platform === 'darwin') {
    const { Menu } = electron

    const template = [
      {
        label: l('appMenuNewTab'),
        click(_item: any, window: any) {
          sendIPCToWindow(window, 'addTab')
        },
      },
      {
        label: l('appMenuNewPrivateTab'),
        click(_item: any, window: any) {
          sendIPCToWindow(window, 'addPrivateTab')
        },
      },
      {
        label: l('appMenuNewTask'),
        click(_item: any, window: any) {
          sendIPCToWindow(window, 'addTask')
        },
      },
      {
        label: l('appMenuNewWindow'),
        click() {
          if (global.isFocusMode) {
            showFocusModeDialog2()
          } else {
            createWindow()
          }
        },
      },
    ]

    const dockMenu = Menu.buildFromTemplate(template)
    app.dock.setMenu(dockMenu)
  }
}
