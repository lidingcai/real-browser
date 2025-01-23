// var urlParser = require('util/urlParser.js')
// var settings = require('util/settings/settings.js')
import { ipcRenderer as ipc } from 'electron'

import { TabList } from './tabState/tab'
import { settings } from './util/settings/settings'
import { urlParser } from './util/urlParser'

/* implements selecting webviews, switching between them, and creating new ones. */

// const placeholderImg = document.getElementById('webview-placeholder') as HTMLImageElement

const hasSeparateTitlebar = settings.get('useSeparateTitlebar')
let windowIsMaximized = false // affects navbar height on Windows
let windowIsFullscreen = false

function captureCurrentTab(options: { forceCapture: any } | undefined = undefined) {
  if ((window.tabs.get(window.tabs.getSelected()!) as TabType).private) {
    // don't capture placeholders for private tabs
    return
  }

  if (webviews.placeholderRequests.length > 0 && !(options && options.forceCapture === true)) {
    // capturePage doesn't work while the view is hidden
    return
  }

  ipc.send('getCapture', {
    id: webviews.selectedId,
    width: Math.round(window.innerWidth / 10),
    height: Math.round(window.innerHeight / 10),
  })
}

// called whenever a new page starts loading, or an in-page navigation occurs
function onPageURLChange(tab: string, url: string) {
  if (
    url.indexOf('https://') === 0 ||
    url.indexOf('about:') === 0 ||
    url.indexOf('chrome:') === 0 ||
    url.indexOf('file://') === 0 ||
    url.indexOf('min://') === 0
  ) {
    window.tabs.update(tab, {
      secure: true,
      url,
    })
  } else {
    window.tabs.update(tab, {
      secure: false,
      url,
    })
  }

  webviews.callAsync(tab, 'setVisualZoomLevelLimits', [1, 3])
}

// called whenever a navigation finishes
function onNavigate(
  tabId: string,
  url: string,
  _isInPlace: boolean,
  isMainFrame: boolean,
  _frameProcessId: string,
  _frameRoutingId: string,
) {
  if (isMainFrame) {
    onPageURLChange(tabId, url)
  }
}

// called whenever the page finishes loading
function onPageLoad(tabId: string) {
  // capture a preview image if a new page has been loaded
  if (tabId === window.tabs.getSelected()) {
    setTimeout(() => {
      // sometimes the page isn't visible until a short time after the did-finish-load event occurs
      captureCurrentTab()
    }, 250)
  }
}

function scrollOnLoad(tabId: string, scrollPosition: number) {
  const listener = (eTabId: string) => {
    if (eTabId === tabId) {
      let done = false
      // the scrollable content may not be available until some time after the load event, so attempt scrolling several times
      // but stop once we've successfully scrolled once so we don't overwrite user scroll attempts that happen later
      for (let i = 0; i < 3; i++) {
        // var done = false
        // eslint-disable-next-line no-loop-func
        setTimeout(() => {
          if (!done) {
            webviews.callAsync(
              tabId,
              'executeJavaScript',
              `
            (function() {
              window.scrollTo(0, ${scrollPosition})
              return window.scrollY === ${scrollPosition}
            })()
            `,
              (err: any, completed: any) => {
                if (!err && completed) {
                  done = true
                }
              },
            )
          }
        }, 750 * i)
      }
      webviews.unbindEvent('did-finish-load', listener)
    }
  }
  webviews.bindEvent('did-finish-load', listener)
}

function setAudioMutedOnCreate(tabId: string, muted: boolean) {
  const listener = () => {
    webviews.callAsync(tabId, 'setAudioMuted', muted)
    webviews.unbindEvent('did-navigate', listener)
  }
  webviews.bindEvent('did-navigate', listener)
}

export const webviews = {
  viewFullscreenMap: {} as Record<string, boolean>, // tabId, isFullscreen
  selectedId: null as string | null,
  placeholderRequests: [] as string[],
  asyncCallbacks: {} as Record<number, Function>,
  internalPages: {
    error: 'min://app/pages/error/index.html',
  },
  events: [] as { event: string; fn: Function }[],
  IPCEvents: [] as { name: string; fn: Function }[],
  hasViewForTab(tabId: string) {
    return (
      tabId &&
      window.tasks.getTaskContainingTab(tabId) &&
      ((window.tasks.getTaskContainingTab(tabId)!.tabs as TabList).get(tabId) as TabType).hasBrowserView
    )
  },
  bindEvent(event: string, fn: Function) {
    webviews.events.push({
      event,
      fn,
    })
  },
  unbindEvent(event: string, fn: Function) {
    for (let i = 0; i < webviews.events.length; i++) {
      if (webviews.events[i].event === event && webviews.events[i].fn === fn) {
        webviews.events.splice(i, 1)
        i--
      }
    }
  },
  emitEvent(event: string, tabId: string, args: any | any[] = null) {
    if (!webviews.hasViewForTab(tabId)) {
      // the view could have been destroyed between when the event was occured and when it was recieved in the UI process, see https://github.com/minbrowser/min/issues/604#issuecomment-419653437
      return
    }
    webviews.events.forEach((ev) => {
      if (ev.event === event) {
        ev.fn.apply(this, [tabId].concat(args))
      }
    })
  },
  bindIPC(name: string, fn: Function) {
    webviews.IPCEvents.push({
      name,
      fn,
    })
  },
  viewMargins: [0, 0, 0, 0], // top, right, bottom, left
  adjustMargin(margins: number[]) {
    for (let i = 0; i < margins.length; i++) {
      webviews.viewMargins[i] += margins[i]
    }
    webviews.resize()
  },
  getViewBounds() {
    let navbarHeight = 0
    if (webviews.viewFullscreenMap[webviews.selectedId as string]) {
      return {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      }
    }
    if (
      !hasSeparateTitlebar &&
      (window.platformType === 'linux' || window.platformType === 'windows') &&
      !windowIsMaximized &&
      !windowIsFullscreen
    ) {
      navbarHeight = 48
    } else {
      navbarHeight = 36
    }

    const { viewMargins } = webviews

    const position = {
      x: 0 + Math.round(viewMargins[3]),
      y: 0 + Math.round(viewMargins[0]) + navbarHeight,
      width: window.innerWidth - Math.round(viewMargins[1] + viewMargins[3]),
      height: window.innerHeight - Math.round(viewMargins[0] + viewMargins[2]) - navbarHeight,
    }

    return position
  },
  add(tabId: string, existingViewId: string = '') {
    const tabData = window.tabs.get(tabId) as TabType

    // needs to be called before the view is created to that its listeners can be registered
    if (tabData.scrollPosition) {
      scrollOnLoad(tabId, tabData.scrollPosition)
    }

    if (tabData.muted) {
      setAudioMutedOnCreate(tabId, tabData.muted)
    }

    // if the tab is private, we want to partition it. See http://electron.atom.io/docs/v0.34.0/api/web-view-tag/#partition
    // since tab IDs are unique, we can use them as partition names
    let partition = ''
    if (tabData.private === true) {
      partition = tabId.toString() // options.tabId is a number, which remote.session.fromPartition won't accept. It must be converted to a string first
    }
    ipc.send('createView', {
      existingViewId,
      id: tabId,
      webPreferencesString: JSON.stringify({
        partition: partition || 'persist:webcontent',
      }),
      boundsString: JSON.stringify(webviews.getViewBounds()),
      events: webviews.events.map((e) => e.event).filter((i, idx, arr) => arr.indexOf(i) === idx),
    })

    if (!existingViewId) {
      if (tabData.url) {
        ipc.send('loadURLInView', { id: tabData.id, url: urlParser.parse(tabData.url) })
      } else if (tabData.private) {
        // workaround for https://github.com/minbrowser/min/issues/872
        ipc.send('loadURLInView', { id: tabData.id, url: urlParser.parse('min://newtab') })
      }
    }

    ;(window.tasks.getTaskContainingTab(tabId)!.tabs as TabList).update(tabId, {
      hasBrowserView: true,
    })
  },
  setSelected(id: string, options: { focus: boolean } | undefined = undefined) {
    // options.focus - whether to focus the view. Defaults to true.
    webviews.emitEvent('view-hidden', webviews.selectedId as string)

    webviews.selectedId = id

    // create the view if it doesn't already exist
    if (!webviews.hasViewForTab(id)) {
      webviews.add(id)
    }

    if (webviews.placeholderRequests.length > 0) {
      // update the placeholder instead of showing the actual view
      webviews.requestPlaceholder()
      return
    }
    ipc.send('setView', {
      id,
      bounds: webviews.getViewBounds(),
      focus: !options || options.focus !== false,
    })
    webviews.emitEvent('view-shown', id)
  },
  update(id: string, url: string) {
    ipc.send('loadURLInView', { id, url: urlParser.parse(url) })
  },
  destroy(id: string) {
    webviews.emitEvent('view-hidden', id)

    if (webviews.hasViewForTab(id)) {
      ;(window.tasks.getTaskContainingTab(id)!.tabs as TabList).update(id, {
        hasBrowserView: false,
      })
    }
    // we may be destroying a view for which the tab object no longer exists, so this message should be sent unconditionally
    ipc.send('destroyView', id)

    delete webviews.viewFullscreenMap[id]
    if (webviews.selectedId === id) {
      webviews.selectedId = null
    }
  },
  requestPlaceholder(reason: string = '') {
    if (reason && !webviews.placeholderRequests.includes(reason)) {
      webviews.placeholderRequests.push(reason)
    }
    if (webviews.placeholderRequests.length >= 1) {
      // create a new placeholder

      const associatedTab = (window.tasks.getTaskContainingTab(webviews.selectedId as string)!.tabs as TabList).get(
        webviews.selectedId!,
      ) as TabType
      const placeholderImg = document.getElementById('webview-placeholder') as HTMLImageElement
      const img = associatedTab.previewImage
      if (img) {
        placeholderImg.src = img
        placeholderImg.hidden = false
      } else if (associatedTab && associatedTab.url) {
        captureCurrentTab({ forceCapture: true })
      } else {
        placeholderImg.hidden = true
      }
    }
    setTimeout(() => {
      // wait to make sure the image is visible before the view is hidden
      // make sure the placeholder was not removed between when the timeout was created and when it occurs
      if (webviews.placeholderRequests.length > 0) {
        ipc.send('hideCurrentView')
        webviews.emitEvent('view-hidden', webviews.selectedId as string)
      }
    }, 0)
  },
  hidePlaceholder(reason: string) {
    if (webviews.placeholderRequests.includes(reason)) {
      webviews.placeholderRequests.splice(webviews.placeholderRequests.indexOf(reason), 1)
    }

    if (webviews.placeholderRequests.length === 0) {
      // multiple things can request a placeholder at the same time, but we should only show the view again if nothing requires a placeholder anymore
      if (webviews.hasViewForTab(webviews.selectedId as string)) {
        ipc.send('setView', {
          id: webviews.selectedId,
          bounds: webviews.getViewBounds(),
          focus: true,
        })
        webviews.emitEvent('view-shown', webviews.selectedId as string)
      }
      // wait for the view to be visible before removing the placeholder
      setTimeout(() => {
        if (webviews.placeholderRequests.length === 0) {
          // make sure the placeholder hasn't been re-enabled
          const placeholderImg = document.getElementById('webview-placeholder') as HTMLImageElement
          placeholderImg.hidden = true
        }
      }, 400)
    }
  },
  releaseFocus() {
    ipc.send('focusMainWebContents')
  },
  focus() {
    if (webviews.selectedId) {
      ipc.send('focusView', webviews.selectedId)
    }
  },
  resize() {
    ipc.send('setBounds', { id: webviews.selectedId, bounds: webviews.getViewBounds() })
  },
  goBackIgnoringRedirects(id: string) {
    /* If the current page is an error page, we actually want to go back 2 pages, since the last page would otherwise send us back to the error page
    TODO we want to do the same thing for reader mode as well, but only if the last page was redirected to reader mode (since it could also be an unrelated page)
    */

    const { url } = window.tabs.get(id) as TabType

    if (url!.startsWith(urlParser.parse('min://error'))) {
      webviews.callAsync(id, 'canGoToOffset', -2, (err: any, result: boolean) => {
        if (!err && result === true) {
          webviews.callAsync(id, 'goToOffset', -2)
        } else {
          webviews.callAsync(id, 'goBack')
        }
      })
    } else {
      webviews.callAsync(id, 'goBack')
    }
  },
  /*
  Can be called as
  callAsync(id, method, args, callback) -> invokes method with args, runs callback with (err, result)
  callAsync(id, method, callback) -> invokes method with no args, runs callback with (err, result)
  callAsync(id, property, value, callback) -> sets property to value
  callAsync(id, property, callback) -> reads property, runs callback with (err, result)
   */
  callAsync(
    id: string,
    method: string,
    argsOrCallback: any | any[] | Function = undefined,
    callback: Function | undefined = undefined,
  ) {
    let args = argsOrCallback
    let cb = callback
    if (argsOrCallback instanceof Function && !cb) {
      args = []
      cb = argsOrCallback as Function
    }
    if (!(args instanceof Array)) {
      args = [args]
    }
    let callId: number = 0
    if (cb) {
      callId = Math.random()
      webviews.asyncCallbacks[callId] = cb
    }
    ipc.send('callViewMethod', { id, callId, method, args })
  },
}

window.addEventListener(
  'resize',
  window.throttle(() => {
    if (webviews.placeholderRequests.length > 0) {
      // can't set view bounds if the view is hidden
      return
    }
    webviews.resize()
  }, 75),
)

// leave HTML fullscreen when leaving window fullscreen
ipc.on('leave-full-screen', () => {
  // electron normally does this automatically (https://github.com/electron/electron/pull/13090/files), but it doesn't work for BrowserViews
  for (const view in webviews.viewFullscreenMap) {
    if (webviews.viewFullscreenMap[view]) {
      webviews.callAsync(view, 'executeJavaScript', 'document.exitFullscreen()')
    }
  }
})

webviews.bindEvent('enter-html-full-screen', (tabId: string) => {
  webviews.viewFullscreenMap[tabId] = true
  webviews.resize()
})

webviews.bindEvent('leave-html-full-screen', (tabId: string) => {
  webviews.viewFullscreenMap[tabId] = false
  webviews.resize()
})

ipc.on('maximize', () => {
  windowIsMaximized = true
  webviews.resize()
})

ipc.on('unmaximize', () => {
  windowIsMaximized = false
  webviews.resize()
})

ipc.on('enter-full-screen', () => {
  windowIsFullscreen = true
  webviews.resize()
})

ipc.on('leave-full-screen', () => {
  windowIsFullscreen = false
  webviews.resize()
})

webviews.bindEvent('did-start-navigation', onNavigate)
webviews.bindEvent('will-redirect', onNavigate)
webviews.bindEvent('did-navigate', (tabId: string, url: string, _httpResponseCode: any, _httpStatusText: any) => {
  onPageURLChange(tabId, url)
})

webviews.bindEvent('did-finish-load', onPageLoad)

webviews.bindEvent('page-title-updated', (tabId: string, title: string, _explicitSet: never) => {
  window.tabs.update(tabId, {
    title,
  })
})

webviews.bindEvent(
  'did-fail-load',
  (tabId: string, errorCode: number, _errorDesc: string, validatedURL: string, isMainFrame: boolean) => {
    if (errorCode && errorCode !== -3 && isMainFrame && validatedURL) {
      webviews.update(
        tabId,
        `${webviews.internalPages.error}?ec=${encodeURIComponent(errorCode)}&url=${encodeURIComponent(validatedURL)}`,
      )
    }
  },
)

webviews.bindEvent('crashed', (tabId: string, _isKilled: never) => {
  const { url } = window.tabs.get(tabId) as TabType

  window.tabs.update(tabId, {
    url: `${webviews.internalPages.error}?ec=crash&url=${encodeURIComponent(url!)}`,
  })

  // the existing process has crashed, so we can't reuse it
  webviews.destroy(tabId)
  webviews.add(tabId)

  if (tabId === window.tabs.getSelected()) {
    webviews.setSelected(tabId)
  }
})

webviews.bindIPC('getSettingsData', (tabId: string, _args: never) => {
  if (!urlParser.isInternalURL((window.tabs.get(tabId) as TabType).url as string)) {
    throw new Error()
  }
  webviews.callAsync(tabId, 'send', ['receiveSettingsData', settings.list])
})
webviews.bindIPC('setSetting', (tabId: string, args: { key: string; value: any }[]) => {
  if (!urlParser.isInternalURL((window.tabs.get(tabId) as TabType).url as string)) {
    throw new Error()
  }
  settings.set(args[0].key, args[0].value)
})

settings.listen(() => {
  window.tasks.forEach((task) => {
    task.tabs!.forEach((tab: TabType) => {
      if (tab.url!.startsWith('min://')) {
        try {
          webviews.callAsync(tab.id as string, 'send', ['receiveSettingsData', settings.list])
        } catch (e) {
          // webview might not actually exist
        }
      }
    })
  })
})

webviews.bindIPC('scroll-position-change', (tabId: string, args: any[]) => {
  window.tabs.update(tabId, {
    scrollPosition: args[0],
  })
})

ipc.on('view-event', (_e, args) => {
  webviews.emitEvent(args.event, args.tabId, args.args)
})

ipc.on('async-call-result', (_e, args) => {
  webviews.asyncCallbacks[args.callId](args.error, args.result)
  delete webviews.asyncCallbacks[args.callId]
})

ipc.on('view-ipc', (_e, args) => {
  if (!webviews.hasViewForTab(args.id)) {
    // the view could have been destroyed between when the event was occured and when it was recieved in the UI process, see https://github.com/minbrowser/min/issues/604#issuecomment-419653437
    return
  }
  webviews.IPCEvents.forEach((item) => {
    if (item.name === args.name) {
      item.fn(args.id, [args.data], args.frameId, args.frameURL)
    }
  })
})

setInterval(() => {
  captureCurrentTab()
}, 15000)

ipc.on('captureData', (_e, data) => {
  window.tabs.update(data.id, { previewImage: data.url })
  if (data.id === webviews.selectedId && webviews.placeholderRequests.length > 0) {
    const placeholderImg = document.getElementById('webview-placeholder') as HTMLImageElement
    placeholderImg.src = data.url
    placeholderImg.hidden = false
  }
})

/* focus the view when the window is focused */

ipc.on('windowFocus', () => {
  if (webviews.placeholderRequests.length === 0 && document.activeElement!.tagName !== 'INPUT') {
    webviews.focus()
  }
})

// module.exports = webviews
