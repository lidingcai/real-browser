// var webviews = require('webviews.js')
// var keybindings = require('keybindings.js')
import { l } from '../locales/index'
import * as keybindings from './keybindings'
// var readerDecision = require('readerDecision.js')
import { readerDecision } from './readerDecision'
// var urlParser = require('util/urlParser.js')
import { urlParser } from './util/urlParser'
import { webviews } from './webviews'

export const readerView = {
  readerURL: 'min://app/reader/index.html',
  getReaderURL(url: string) {
    return `${readerView.readerURL}?url=${url}`
  },
  isReader(tabId: string) {
    return (window.tabs.get(tabId) as TabType).url!.indexOf(readerView.readerURL) === 0
  },
  getButton(tabId: string) {
    // TODO better icon
    const button = document.createElement('button')
    button.className = 'reader-button tab-icon i carbon:notebook'

    button.setAttribute('data-tab', tabId)
    button.setAttribute('role', 'button')

    button.addEventListener('click', (e) => {
      e.stopPropagation()

      if (readerView.isReader(tabId)) {
        readerView.exit(tabId)
      } else {
        readerView.enter(tabId, '')
      }
    })

    readerView.updateButton(tabId, button)

    return button
  },
  updateButton(tabId: string, buttonArg: HTMLButtonElement | null = null) {
    const button = (buttonArg ||
      document.querySelector('.reader-button[data-tab="{id}"]'.replace('{id}', tabId))) as HTMLButtonElement
    const tab = window.tabs.get(tabId) as TabType

    if (readerView.isReader(tabId)) {
      button.classList.add('is-reader')
      button.setAttribute('title', l('exitReaderView'))
    } else {
      button.classList.remove('is-reader')
      button.setAttribute('title', l('enterReaderView'))

      if (tab.readerable) {
        button.classList.add('can-reader')
      } else {
        button.classList.remove('can-reader')
      }
    }
  },
  enter(tabId: string, url: string = '') {
    const newURL = `${readerView.readerURL}?url=${encodeURIComponent(url || ((window.tabs.get(tabId) as TabType).url as string))}`
    window.tabs.update(tabId, { url: newURL })
    webviews.update(tabId, newURL)
  },
  exit(tabId: string) {
    const src = urlParser.getSourceURL((window.tabs.get(tabId) as TabType).url!)
    // this page should not be automatically readerable in the future
    readerDecision.setURLStatus(src, false)
    window.tabs.update(tabId, { url: src })
    webviews.update(tabId, src)
  },
  printArticle(tabId: string) {
    if (!readerView.isReader(tabId)) {
      throw new Error("attempting to print in a tab that isn't a reader page")
    }

    webviews.callAsync(window.tabs.getSelected()!, 'executeJavaScript', 'parentProcessActions.printArticle()')
  },
  initialize() {
    // update the reader button on page load

    webviews.bindEvent(
      'did-start-navigation',
      (
        tabId: string,
        url: string,
        isInPlace: boolean,
        isMainFrame: boolean,
        _frameProcessId: any,
        _frameRoutingId: any,
      ) => {
        if (isInPlace) {
          return
        }
        if (readerDecision.shouldRedirect(url) === 1) {
          // if this URL has previously been marked as readerable, load reader view without waiting for the page to load
          readerView.enter(tabId, url)
        } else if (isMainFrame) {
          window.tabs.update(tabId, {
            readerable: false, // assume the new page can't be readered, we'll get another message if it can
          })

          readerView.updateButton(tabId)
        }
      },
    )

    webviews.bindIPC('canReader', (tab: string) => {
      if (readerDecision.shouldRedirect((window.tabs.get(tab) as TabType).url!) >= 0) {
        // if automatic reader mode has been enabled for this domain, and the page is readerable, enter reader mode
        readerView.enter(tab)
      }

      window.tabs.update(tab, {
        readerable: true,
      })
      readerView.updateButton(tab)
    })

    // add a keyboard shortcut to enter reader mode

    keybindings.defineShortcut('toggleReaderView', () => {
      if (readerView.isReader(window.tabs.getSelected()!)) {
        readerView.exit(window.tabs.getSelected()!)
      } else {
        readerView.enter(window.tabs.getSelected()!)
      }
    })
  },
}

// readerView.initialize()

// module.exports = readerView
