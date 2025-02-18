import { app, BrowserWindow, ipcMain as ipc, session } from 'electron'
import path from 'path'

import { sendIPCToWindow } from './main'
import { viewMap } from './viewData'
import { windows } from './windowManagement'

const currrentDownloadItems = {}

function isAttachment(header) {
  return /^\s*attache*?ment/i.test(header)
}

function downloadHandler(event, item, webContents) {
  const sourceView = Object.values(viewMap).find((view) => view.webContents.id === webContents.id)
  let sourceWindow
  if (sourceView) {
    sourceWindow = BrowserWindow.fromBrowserView(sourceView)
  }
  if (!sourceWindow) {
    sourceWindow = windows.getCurrent()
  }

  let savePathFilename

  // send info to download manager
  sendIPCToWindow(sourceWindow, 'download-info', {
    path: item.getSavePath(),
    name: item.getFilename(),
    status: 'progressing',
    size: { received: 0, total: item.getTotalBytes() },
  })

  item.on('updated', (e, state) => {
    if (!savePathFilename) {
      savePathFilename = path.basename(item.getSavePath())
    }

    if (item.getSavePath()) {
      currrentDownloadItems[item.getSavePath()] = item
    }

    sendIPCToWindow(sourceWindow, 'download-info', {
      path: item.getSavePath(),
      name: savePathFilename,
      status: state,
      size: { received: item.getReceivedBytes(), total: item.getTotalBytes() },
    })
  })

  item.once('done', (e, state) => {
    delete currrentDownloadItems[item.getSavePath()]
    sendIPCToWindow(sourceWindow, 'download-info', {
      path: item.getSavePath(),
      name: savePathFilename,
      status: state,
      size: { received: item.getTotalBytes(), total: item.getTotalBytes() },
    })
  })
  return true
}

function listenForDownloadHeaders(ses: Electron.Session) {
  ses.webRequest.onHeadersReceived((details, callback) => {
    if (details.resourceType === 'mainFrame' && details.responseHeaders) {
      let sourceWindow
      if (details.webContents) {
        const sourceView = Object.values(viewMap).find((view) => view.webContents.id === details.webContents.id)
        if (sourceView) {
          sourceWindow = BrowserWindow.fromBrowserView(sourceView)
        }
      }
      if (!sourceWindow) {
        sourceWindow = windows.getCurrent()
      }

      // workaround for https://github.com/electron/electron/issues/24334
      const typeHeader =
        details.responseHeaders[
          Object.keys(details.responseHeaders).filter((k) => k.toLowerCase() === 'content-type')[0]
        ]
      const attachment = isAttachment(
        details.responseHeaders[
          Object.keys(details.responseHeaders).filter((k) => k.toLowerCase() === 'content-disposition')[0]
        ],
      )

      if (
        typeHeader instanceof Array &&
        typeHeader.filter((t) => t.includes('application/pdf')).length > 0 &&
        !attachment
      ) {
        // open in PDF viewer instead
        callback({ cancel: true })
        sendIPCToWindow(sourceWindow, 'openPDF', {
          url: details.url,
          tabId: null,
        })
        return
      }

      // whether this is a file being viewed in-browser or a page
      // Needed to save files correctly: https://github.com/minbrowser/min/issues/1717
      // It doesn't make much sense to have this here, but only one onHeadersReceived instance can be created per session
      const isFileView = typeHeader instanceof Array && !typeHeader.some((t) => t.includes('text/html'))

      sendIPCToWindow(sourceWindow, 'set-file-view', {
        url: details.url,
        isFileView,
      })
    }

    /*
    SECURITY POLICY EXCEPTION:
    reader and PDF internal pages get universal access to web resources
    Note: we can't limit to the URL in the query string, because there could be redirects
    */
    if (
      details.webContents &&
      (details.webContents.getURL().startsWith('min://app/pages/pdfViewer') ||
        details.webContents.getURL().startsWith('min://app/reader/') ||
        details.webContents.getURL() === 'min://app/index.html')
    ) {
      const filteredHeaders = Object.fromEntries(
        Object.entries(details.responseHeaders).filter(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
          ([key, val]) =>
            key.toLowerCase() !== 'access-control-allow-origin' &&
            key.toLowerCase() !== 'access-control-allow-credentials',
        ),
      )

      callback({
        responseHeaders: {
          ...filteredHeaders,
          'Access-Control-Allow-Origin': 'min://app',
          'Access-Control-Allow-Credentials': 'true',
        },
      })
      return
    }

    callback({ cancel: false })
  })
}

export const initDownload = () => {
  ipc.on('cancelDownload', (e, path) => {
    if (currrentDownloadItems[path]) {
      currrentDownloadItems[path].cancel()
    }
  })

  app.once('ready', () => {
    session.defaultSession.on('will-download', downloadHandler)
    listenForDownloadHeaders(session.defaultSession)
  })

  app.on('session-created', (session) => {
    session.on('will-download', downloadHandler)
    listenForDownloadHeaders(session)
  })
}
