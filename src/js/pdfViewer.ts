/* handles viewing pdf files using pdf.js. Recieves events from main.js will-download */

// const webviews = require('webviews.js')
// const urlParser = require('util/urlParser.js')
// import { urlParser } from './util/urlParser'
import { ipcRenderer as ipc } from 'electron'

import { webviews } from './webviews'

export const PDFViewer = {
  url: {
    base: 'min://app/pages/pdfViewer/index.html',
    queryString: '?url=%l',
  },
  isPDFViewer(tabId: string) {
    return (window.tabs.get(tabId) as TabType).url!.startsWith(PDFViewer.url.base)
  },
  printPDF(viewerTabId: string) {
    if (!PDFViewer.isPDFViewer(viewerTabId)) {
      throw new Error("attempting to print in a tab that isn't a PDF viewer")
    }

    webviews.callAsync(window.tabs.getSelected() as string, 'executeJavaScript', 'parentProcessActions.printPDF()')
  },
  savePDF(viewerTabId: string) {
    if (!PDFViewer.isPDFViewer(viewerTabId)) {
      throw new Error("attempting to save in a tab that isn't a PDF viewer")
    }

    webviews.callAsync(window.tabs.getSelected() as string, 'executeJavaScript', 'parentProcessActions.downloadPDF()')
  },
  startFindInPage(viewerTabId: string) {
    if (!PDFViewer.isPDFViewer(viewerTabId)) {
      throw new Error("attempting to call startFindInPage in a tab that isn't a PDF viewer")
    }

    webviews.callAsync(
      window.tabs.getSelected() as string,
      'executeJavaScript',
      'parentProcessActions.startFindInPage()',
    )
  },
  endFindInPage(viewerTabId: string) {
    if (!PDFViewer.isPDFViewer(viewerTabId)) {
      throw new Error("attempting to call endFindInPage in a tab that isn't a PDF viewer")
    }

    webviews.callAsync(window.tabs.getSelected() as string, 'executeJavaScript', 'parentProcessActions.endFindInPage()')
  },
  handlePDFOpenEvent(_event: any, data: { tabId: string; url: string | number | boolean }) {
    if (!data.tabId) {
      const matchingTabs = (window.tabs.get() as TabType[])
        .filter((t) => t.url === data.url)
        .sort((a, b) => {
          return b.lastActivity! - a.lastActivity!
        })
      if (matchingTabs[0]) {
        data.tabId = matchingTabs[0].id as string
      }
    }
    if (!data.tabId) {
      console.warn(
        'missing tab ID for PDF',
        data.url,
        (window.tabs.get() as TabType[]).map((t) => t.url),
      )
      return
    }
    const PDFurl = PDFViewer.url.base + PDFViewer.url.queryString.replace('%l', encodeURIComponent(data.url))
    webviews.update(data.tabId, PDFurl)
  },
  initialize() {
    ipc.on('openPDF', PDFViewer.handlePDFOpenEvent)
  },
}

// module.exports = PDFViewer
