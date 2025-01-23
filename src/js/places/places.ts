// var webviews = require('webviews.js')
// const searchEngine = require('util/searchEngine.js')
import { ipcRenderer as ipc } from 'electron'

import { searchEngine } from '../util/searchEngine'
// const urlParser = require('util/urlParser.js')
import { urlParser } from '../util/urlParser'
import { webviews } from '../webviews'

export const places = {
  messagePort: null as MessagePort | null,
  sendMessage(data: Object) {
    data = JSON.parse(JSON.stringify(data))
    places.messagePort!.postMessage(data)
  },
  savePage(tabId: string, extractedText: string) {
    /* this prevents pages that are immediately left from being saved to history, and also gives the page-favicon-updated event time to fire (so the colors saved to history are correct). */
    setTimeout(() => {
      const tab = window.tabs.get(tabId) as TabType | undefined
      if (tab) {
        const data = {
          url: urlParser.getSourceURL(tab.url as string), // for PDF viewer and reader mode, save the original page URL and not the viewer URL
          title: tab.title,
          color: tab.backgroundColor,
          extractedText,
        }

        places.sendMessage({
          action: 'updatePlace',
          pageData: data,
          flags: {
            isNewVisit: true,
          },
        })
      }
    }, 500)
  },
  receiveHistoryData(tabId: string, args: any[]) {
    // called when js/preload/textExtractor.js returns the page's text content

    const tab = window.tabs.get(tabId) as TabType
    const data = args[0]

    if (tab.url!.startsWith('data:') || tab.url!.length > 5000) {
      /*
      very large URLs cause performance issues. In particular:
      * they can cause the database to grow abnormally large, which increases memory usage and startup time
      * they can cause the browser to hang when they are displayed in search results
      To avoid this, don't save them to history
      */
      return
    }

    /* if the page is an internal page, it normally shouldn't be saved,
     unless the page represents another page (such as the PDF viewer or reader view) */
    const isNonIndexableInternalPage = urlParser.isInternalURL(tab.url!) && urlParser.getSourceURL(tab.url!) === tab.url
    const isSearchPage = !!searchEngine.getSearch(tab.url!)

    // full-text data from search results isn't useful
    if (isSearchPage) {
      data.extractedText = ''
    }

    // don't save to history if in private mode, or the page is a browser page (unless it contains the content of a normal page)
    if (tab.private === false && !isNonIndexableInternalPage) {
      places.savePage(tabId, data.extractedText)
    }
  },
  callbacks: [] as { id: number; fn: Function }[],
  addWorkerCallback(callback: Function) {
    const callbackId = Date.now() / 1000 + Math.random()
    places.callbacks.push({ id: callbackId, fn: callback })
    return callbackId
  },
  runWorkerCallback(id: number, data: Object) {
    for (let i = 0; i < places.callbacks.length; i++) {
      if (places.callbacks[i].id === id) {
        places.callbacks[i].fn(data)
        places.callbacks.splice(i, 1)
      }
    }
  },
  deleteHistory(url: string) {
    places.sendMessage({
      action: 'deleteHistory',
      pageData: {
        url,
      },
    })
  },
  deleteAllHistory() {
    places.sendMessage({
      action: 'deleteAllHistory',
    })
  },
  searchPlaces(text: string, callback: Function, options: Object) {
    const callbackId = places.addWorkerCallback(callback)
    places.sendMessage({
      action: 'searchPlaces',
      text,
      callbackId,
      options,
    })
  },
  searchPlacesFullText(text: string, callback: Function) {
    const callbackId = places.addWorkerCallback(callback)
    places.sendMessage({
      action: 'searchPlacesFullText',
      text,
      callbackId,
    })
  },
  getPlaceSuggestions(url: string, callback: Function) {
    const callbackId = places.addWorkerCallback(callback)
    places.sendMessage({
      action: 'getPlaceSuggestions',
      text: url,
      callbackId,
    })
  },
  onMessage(e: { data: { callbackId: number; result: Object } }) {
    places.runWorkerCallback(e.data.callbackId, e.data.result)
  },
  getItem(url: string, callback: Function) {
    const callbackId = places.addWorkerCallback(callback)
    places.sendMessage({
      action: 'getPlace',
      pageData: {
        url,
      },
      callbackId,
    })
  },
  getAllItems(callback: Function) {
    const callbackId = places.addWorkerCallback(callback)
    places.sendMessage({
      action: 'getAllPlaces',
      callbackId,
    })
  },
  updateItem(url: string, fields: Object, callback: Function = () => {}) {
    const callbackId = places.addWorkerCallback(callback)
    places.sendMessage({
      action: 'updatePlace',
      pageData: {
        url,
        ...fields,
      },
      callbackId,
    })
  },
  toggleTag(url: string, tag: string) {
    places.getItem(url, (item: { tags: string[] }) => {
      if (!item) {
        return
      }
      if (item.tags.includes(tag)) {
        item.tags = item.tags.filter((t) => t !== tag)
      } else {
        item.tags.push(tag)
      }
      places.sendMessage({
        action: 'updatePlace',
        pageData: {
          url,
          tags: item.tags,
        },
      })
    })
  },
  getSuggestedTags(url: string, callback: Function) {
    const callbackId = places.addWorkerCallback(callback)
    places.sendMessage({
      action: 'getSuggestedTags',
      pageData: {
        url,
      },
      callbackId,
    })
  },
  getAllTagsRanked(url: string, callback: Function) {
    const callbackId = places.addWorkerCallback(callback)
    places.sendMessage({
      action: 'getAllTagsRanked',
      pageData: {
        url,
      },
      callbackId,
    })
  },
  getSuggestedItemsForTags(tags: string[], callback: Function) {
    const callbackId = places.addWorkerCallback(callback)
    places.sendMessage({
      action: 'getSuggestedItemsForTags',
      pageData: {
        tags,
      },
      callbackId,
    })
  },
  autocompleteTags(tags: string[], callback: Function) {
    const callbackId = places.addWorkerCallback(callback)
    places.sendMessage({
      action: 'autocompleteTags',
      pageData: {
        tags,
      },
      callbackId,
    })
  },
  initialize() {
    const { port1, port2 } = new MessageChannel()

    ipc.postMessage('places-connect', null, [port1])
    places.messagePort = port2
    port2.addEventListener('message', places.onMessage)
    port2.start()

    webviews.bindIPC('pageData', places.receiveHistoryData)
  },
}

// places.initialize()
// module.exports = places
