import { join } from 'node:path'

import electron, { app, BrowserView, BrowserWindow, ipcMain as ipc, WebPreferences } from 'electron'

import { __dirname } from './constants'
// import { filterPopups } from './filtering'
import { l } from './i18n'
import { createPrompt } from './prompt'
import { settings } from './settingsMain'
import { destroyAllViews, destroyView, viewMap, viewStateMap } from './viewData'
import { windows } from './windowManagement'

const temporaryPopupViews = {} // id: view

// rate limit on "open in app" requests
let globalLaunchRequests = 0
const preload = join(__dirname, '../preload/index.mjs')

const defaultViewWebPreferences: WebPreferences = {
  /*
  nodeIntegration: true,
  contextIsolation: false,
  nodeIntegrationInWorker: true,
  sandbox: false,
  */

  nodeIntegration: false,
  nodeIntegrationInSubFrames: true,
  scrollBounce: true,
  safeDialogs: true,
  safeDialogsMessage: 'Prevent this page from creating additional dialogs',
  // preload: `${__dirname}/dist/preload.js`,
  preload,
  contextIsolation: true,
  sandbox: true,
  // enableRemoteModule: false,
  // allowPopups: false,
  // partition: partition || 'persist:webcontent',
  enableWebSQL: false,
  autoplayPolicy: settings.get('enableAutoplay') ? 'no-user-gesture-required' : 'user-gesture-required',
  // match Chrome's default for anti-fingerprinting purposes (Electron defaults to 0)
  minimumFontSize: 6,
}

function createView(existingViewId, id, webPreferencesString, boundsString, events) {
  if (viewStateMap[id]) {
    console.warn('Creating duplicate view')
  }
  viewStateMap[id] = { loadedInitialURL: false }

  let view: BrowserView
  if (existingViewId) {
    view = temporaryPopupViews[existingViewId]
    delete temporaryPopupViews[existingViewId]

    // the initial URL has already been loaded, so set the background color
    view.setBackgroundColor('#fff')
    viewStateMap[id].loadedInitialURL = true
  } else {
    view = new BrowserView({
      webPreferences: { ...defaultViewWebPreferences, ...JSON.parse(webPreferencesString) },
    })
  }

  events.forEach((event) => {
    view.webContents.on(event, (...params) => {
      const args = Array.prototype.slice.call(params).slice(1)

      const eventTarget = BrowserWindow.fromBrowserView(view) || windows.getCurrent()

      if (!eventTarget) {
        // this can happen during shutdown - windows can be destroyed before the corresponding views, and the view can emit an event during that time
        return
      }

      eventTarget.webContents.send('view-event', {
        tabId: id,
        event,
        args,
      })
    })
  })

  view.webContents.on('select-bluetooth-device', (event, _deviceList, callback) => {
    event.preventDefault()
    callback('')
  })

  view.webContents.setWindowOpenHandler((details) => {
    /*
      Opening a popup with window.open() generally requires features to be set
      So if there are no features, the event is most likely from clicking on a link, which should open a new tab.
      Clicking a link can still have a "new-window" or "foreground-tab" disposition depending on which keys are pressed
      when it is clicked.
      (https://github.com/minbrowser/min/issues/1835)
    */
    if (!details.features) {
      const eventTarget = BrowserWindow.fromBrowserView(view) || windows.getCurrent()

      eventTarget.webContents.send('view-event', {
        tabId: id,
        event: 'new-tab',
        args: [details.url, !(details.disposition === 'background-tab')],
      })
      return {
        action: 'deny',
      }
    }

    return {
      action: 'allow',
    }
  })

  /*
  view.webContents.removeAllListeners('-add-new-contents')
  view.webContents.on(
    '-add-new-contents',
    (
      _e,
      webContents,
      _disposition,
      _userGesture,
      _left,
      _top,
      _width,
      _height,
      url,
      _frameName,
      _referrer,
      _rawFeatures,
      _postData,
    ) => {
      if (!filterPopups(url)) {
        return
      }
      // webContents
      const view = new BrowserView({ webPreferences: defaultViewWebPreferences })

      const popupId = Math.random().toString()
      temporaryPopupViews[popupId] = view

      const eventTarget = BrowserWindow.fromBrowserView(view) || windows.getCurrent()

      eventTarget.webContents.send('view-event', {
        tabId: id,
        event: 'did-create-popup',
        args: [popupId, url],
      })
    },
  )
  */

  view.webContents.on('ipc-message', (e, channel, data) => {
    let senderURL
    try {
      senderURL = e.senderFrame.url
    } catch (err) {
      // https://github.com/minbrowser/min/issues/2052
      console.warn('dropping message because senderFrame is destroyed', channel, data, err)
      return
    }

    const eventTarget = BrowserWindow.fromBrowserView(view) || windows.getCurrent()

    eventTarget.webContents.send('view-ipc', {
      id,
      name: channel,
      data,
      frameId: e.frameId,
      frameURL: senderURL,
    })
  })

  // Open a login prompt when site asks for http authentication
  view.webContents.on('login', (event, _authenticationResponseDetails, authInfo, callback) => {
    if (authInfo.scheme !== 'basic') {
      // Only for basic auth
      return
    }
    event.preventDefault()
    const title = l('loginPromptTitle').replace('%h', authInfo.host)
    createPrompt(
      {
        text: title,
        values: [
          { placeholder: l('username'), id: 'username', type: 'text' },
          { placeholder: l('password'), id: 'password', type: 'password' },
        ],
        ok: l('dialogConfirmButton'),
        cancel: l('dialogSkipButton'),
        width: 400,
        height: 200,
      },
      (result) => {
        // resend request with auth credentials
        callback(result.username, result.password)
      },
    )
  })

  // show an "open in app" prompt for external protocols

  function handleExternalProtocol(_e, url, _isInPlace, _isMainFrame, _frameProcessId, _frameRoutingId) {
    const knownProtocols = ['http', 'https', 'file', 'min', 'about', 'data', 'javascript', 'chrome'] // TODO anything else?
    if (!knownProtocols.includes(url.split(':')[0])) {
      const externalApp = app.getApplicationNameForProtocol(url)
      if (externalApp) {
        const sanitizedName = externalApp.replace(/[^a-zA-Z0-9.]/g, '')
        if (globalLaunchRequests < 2) {
          globalLaunchRequests++
          setTimeout(() => {
            globalLaunchRequests--
          }, 20000)
          const result = electron.dialog.showMessageBoxSync({
            type: 'question',
            buttons: ['OK', 'Cancel'],
            message: l('openExternalApp').replace('%s', sanitizedName).replace(/\\/g, ''),
            detail: url.length > 160 ? `${url.substring(0, 160)}...` : url,
          })

          if (result === 0) {
            electron.shell.openExternal(url)
          }
        }
      }
    }
  }

  view.webContents.on('did-start-navigation', handleExternalProtocol)
  /*
  It's possible for an HTTP request to redirect to an external app link
  (primary use case for this is OAuth from desktop app > browser > back to app)
  and did-start-navigation isn't (always?) emitted for redirects, so we need this handler as well
  */
  view.webContents.on('will-redirect', handleExternalProtocol)

  view.setBounds(JSON.parse(boundsString))

  viewMap[id] = view

  return view
}

function setView(id: string, senderContents: Electron.WebContents) {
  const { win } = windows.windowFromContents(senderContents)

  // setBrowserView causes flickering, so we only want to call it if the view is actually changing
  // see https://github.com/minbrowser/min/issues/1966
  if (win.getBrowserView() !== viewMap[id]) {
    if (viewStateMap[id].loadedInitialURL) {
      win.setBrowserView(viewMap[id])
    } else {
      win.setBrowserView(null)
    }
    windows.getState(win).selectedView = id
  }
}

function setBounds(id, bounds) {
  if (viewMap[id]) {
    viewMap[id].setBounds(bounds)
  }
}

function focusView(id) {
  // empty views can't be focused because they won't propogate keyboard events correctly, see https://github.com/minbrowser/min/issues/616
  // also, make sure the view exists, since it might not if the app is shutting down
  if (viewMap[id] && (viewMap[id].webContents.getURL() !== '' || viewMap[id].webContents.isLoading())) {
    viewMap[id].webContents.focus()
    return true
  }
  if (BrowserWindow.fromBrowserView(viewMap[id])) {
    BrowserWindow.fromBrowserView(viewMap[id]).webContents.focus()
    return true
  }
  return false
}

function hideCurrentView(senderContents) {
  const { win } = windows.windowFromContents(senderContents)

  win.setBrowserView(null)
  windows.getState(win).selectedView = null
  if (win.isFocused()) {
    win.webContents.focus()
  }
}

export function getView(id) {
  return viewMap[id]
}

export function getTabIDFromWebContents(contents) {
  for (const id in viewMap) {
    if (viewMap[id].webContents === contents) {
      return id
    }
  }
  return ''
}

export const initViewManager = () => {
  ipc.on('createView', (_e, args) => {
    createView(args.existingViewId, args.id, args.webPreferencesString, args.boundsString, args.events)
  })

  ipc.on('destroyView', (_e, id) => {
    destroyView(id)
  })

  ipc.on('destroyAllViews', () => {
    destroyAllViews()
  })

  ipc.on('setView', (e, args) => {
    setView(args.id, e.sender)
    setBounds(args.id, args.bounds)
    if (args.focus && BrowserWindow.fromWebContents(e.sender) && BrowserWindow.fromWebContents(e.sender).isFocused()) {
      const couldFocus = focusView(args.id)
      if (!couldFocus) {
        e.sender.focus()
      }
    }
  })

  ipc.on('setBounds', (_e, args) => {
    setBounds(args.id, args.bounds)
  })

  ipc.on('focusView', (_e, id) => {
    focusView(id)
  })

  ipc.on('hideCurrentView', (e) => {
    hideCurrentView(e.sender)
  })

  ipc.on('loadURLInView', (e, args) => {
    const { win } = windows.windowFromContents(e.sender)

    // wait until the first URL is loaded to set the background color so that new tabs can use a custom background
    if (!viewStateMap[args.id].loadedInitialURL) {
      // Give the site a chance to display something before setting the background, in case it has its own dark theme
      viewMap[args.id].webContents.once('dom-ready', () => {
        viewMap[args.id].setBackgroundColor('#fff')
      })
      // If the view has no URL, it won't be attached yet
      if (args.id === windows.getState(win).selectedView) {
        win.setBrowserView(viewMap[args.id])
      }
    }
    viewMap[args.id].webContents.loadURL(args.url)
    viewStateMap[args.id].loadedInitialURL = true
  })

  ipc.on('callViewMethod', (e, data) => {
    let error
    let result
    try {
      const { webContents } = viewMap[data.id]
      const methodOrProp = webContents[data.method]
      if (methodOrProp instanceof Function) {
        // call function
        result = methodOrProp.apply(webContents, data.args)
      } else {
        // set property
        if (data.args && data.args.length > 0) {
          // eslint-disable-next-line prefer-destructuring
          webContents[data.method] = data.args[0]
        }
        // read property
        result = methodOrProp
      }
    } catch (e) {
      error = e
    }
    if (result instanceof Promise) {
      result.then((result) => {
        if (data.callId) {
          e.sender.send('async-call-result', { callId: data.callId, error: null, result })
        }
      })
      result.catch((error) => {
        if (data.callId) {
          e.sender.send('async-call-result', { callId: data.callId, error, result: null })
        }
      })
    } else if (data.callId) {
      e.sender.send('async-call-result', { callId: data.callId, error, result })
    }
  })

  ipc.on('getCapture', (e, data) => {
    const view = viewMap[data.id]
    if (!view) {
      // view could have been destroyed
      return
    }

    view.webContents.capturePage().then((img) => {
      const size = img.getSize()
      if (size.width === 0 && size.height === 0) {
        return
      }
      img = img.resize({ width: data.width, height: data.height })
      e.sender.send('captureData', { id: data.id, url: img.toDataURL() })
    })
  })

  ipc.on('saveViewCapture', (_e, data) => {
    const view = viewMap[data.id]
    if (!view) {
      // view could have been destroyed
    }

    view.webContents.capturePage().then((image) => {
      view.webContents.downloadURL(image.toDataURL())
    })
  })
}
