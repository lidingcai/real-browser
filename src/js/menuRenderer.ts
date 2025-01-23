/* Handles messages that get sent from the menu bar in the main process */

// var webviews = require('webviews.js')
// var browserUI = require('browserUI.js')
import { ipcRenderer as ipc } from 'electron'

import * as browserUI from './browserUI'
// var findinpage = require('findinpage.js')
import { findinpage } from './findinpage'
// var focusMode = require('focusMode.js')
import focusMode from './focusMode'
// var modalMode = require('modalMode.js')
import { modalMode } from './modalMode'
// var tabEditor = require('navbar/tabEditor.js')
import { tabEditor } from './navbar/tabEditor'
// var PDFViewer = require('pdfViewer.js')
import { PDFViewer } from './pdfViewer'
// var readerView = require('readerView.js')
import { readerView } from './readerView'
// var taskOverlay = require('taskOverlay/taskOverlay.js')
import { taskOverlay } from './taskOverlay/taskOverlay'
// var webviewGestures = require('webviewGestures.js')
import { webviewGestures } from './webviewGestures'
import { webviews } from './webviews'

// const { tabs } = window
// module.exports = {
export const initialize = () => {
  ipc.on('zoomIn', () => {
    webviewGestures.zoomWebviewIn(window.tabs.getSelected()!)
  })

  ipc.on('zoomOut', () => {
    webviewGestures.zoomWebviewOut(window.tabs.getSelected()!)
  })

  ipc.on('zoomReset', () => {
    webviewGestures.resetWebviewZoom(window.tabs.getSelected()!)
  })

  ipc.on('print', () => {
    if (PDFViewer.isPDFViewer(window.tabs.getSelected()!)) {
      PDFViewer.printPDF(window.tabs.getSelected()!)
    } else if (readerView.isReader(window.tabs.getSelected()!)) {
      readerView.printArticle(window.tabs.getSelected()!)
    } else if (webviews.placeholderRequests.length === 0) {
      // work around #1281 - calling print() when the view is hidden crashes on Linux in Electron 12
      // TODO figure out why webContents.print() doesn't work in Electron 4
      webviews.callAsync(window.tabs.getSelected()!, 'executeJavaScript', 'window.print()')
    }
  })

  ipc.on('findInPage', () => {
    /* Page search is not available in modal mode. */
    if (modalMode.enabled()) {
      return
    }

    findinpage.start()
  })

  ipc.on('inspectPage', () => {
    webviews.callAsync(window.tabs.getSelected()!, 'toggleDevTools')
  })

  ipc.on('openEditor', () => {
    tabEditor.show(window.tabs.getSelected()!)
  })

  ipc.on('showBookmarks', () => {
    tabEditor.show(window.tabs.getSelected()!, '!bookmarks ')
  })

  ipc.on('showHistory', () => {
    tabEditor.show(window.tabs.getSelected()!, '!history ')
  })

  ipc.on('addTab', (e, data) => {
    /* new tabs can't be created in modal mode */
    if (modalMode.enabled()) {
      return
    }

    /* new tabs can't be created in focus mode */
    if (focusMode.enabled()) {
      focusMode.warn()
      return
    }
    console.log(`add a new tab url = ${data.url}`)
    const newTab = window.tabs.add({
      url: data.url || '',
    })

    browserUI.addTab(newTab, {
      enterEditMode: !data.url, // only enter edit mode if the new tab is empty
    })
  })

  ipc.on('saveCurrentPage', async () => {
    const currentTab = window.tabs.get(window.tabs.getSelected()!) as TabType

    // new tabs cannot be saved
    if (!currentTab.url) {
      return
    }

    // if the current tab is a PDF, let the PDF viewer handle saving the document
    if (PDFViewer.isPDFViewer(window.tabs.getSelected()!)) {
      PDFViewer.savePDF(window.tabs.getSelected()!)
      return
    }

    if ((window.tabs.get(window.tabs.getSelected()!) as TabType).isFileView) {
      webviews.callAsync(window.tabs.getSelected()!, 'downloadURL', [
        (window.tabs.get(window.tabs.getSelected()!) as TabType).url,
      ])
    } else {
      let savePath = await ipc.invoke('showSaveDialog', {
        defaultPath: currentTab.title!.replace(/[/\\]/g, '_'),
      })

      // savePath will be undefined if the save dialog is canceled
      if (savePath) {
        if (!savePath.endsWith('.html')) {
          savePath = `${savePath}.html`
        }
        webviews.callAsync(window.tabs.getSelected()!, 'savePage', [savePath, 'HTMLComplete'])
      }
    }
  })

  ipc.on('addPrivateTab', () => {
    /* new tabs can't be created in modal mode */
    if (modalMode.enabled()) {
      return
    }

    /* new tabs can't be created in focus mode */
    if (focusMode.enabled()) {
      focusMode.warn()
      return
    }

    browserUI.addTab(
      window.tabs.add({
        private: true,
      }),
    )
  })

  ipc.on('toggleTaskOverlay', () => {
    taskOverlay.toggle()
  })

  ipc.on('goBack', () => {
    webviews.callAsync(window.tabs.getSelected()!, 'goBack')
  })

  ipc.on('goForward', () => {
    webviews.callAsync(window.tabs.getSelected()!, 'goForward')
  })
}
// }
