// var webviews = require('webviews.js')
// var keybindings = require('keybindings.js')
import { Rectangle } from 'electron'

import { l } from '../locales'
import * as keybindings from './keybindings'
// var PDFViewer = require('pdfViewer.js')
import { PDFViewer } from './pdfViewer'
import { webviews } from './webviews'

export const findinpage = {
  container: null as null | HTMLElement,
  input: null as null | HTMLInputElement,
  counter: null as null | HTMLElement,
  previous: null as null | HTMLElement,
  next: null as null | HTMLElement,
  endButton: null as null | HTMLElement,
  activeTab: null as null | string,
  start() {
    webviews.releaseFocus()

    findinpage.input!.placeholder = l('searchInPage')

    findinpage.activeTab = window.tabs.getSelected()!

    /* special case for PDF viewer */

    if (PDFViewer.isPDFViewer(findinpage.activeTab)) {
      PDFViewer.startFindInPage(findinpage.activeTab)
    }

    findinpage.counter!.textContent = ''
    findinpage.container!.hidden = false
    findinpage.input!.focus()
    findinpage.input!.select()

    if (findinpage.input!.value) {
      webviews.callAsync(findinpage.activeTab, 'findInPage', findinpage.input!.value)
    }
  },
  end(options: { action?: any } | undefined = undefined) {
    options = options || {}
    const action = options.action || 'keepSelection'

    findinpage.container!.hidden = true

    if (findinpage.activeTab) {
      webviews.callAsync(findinpage.activeTab, 'stopFindInPage', action)

      /* special case for PDF viewer */
      if (window.tabs.get(findinpage.activeTab) && PDFViewer.isPDFViewer(findinpage.activeTab)) {
        PDFViewer.endFindInPage(findinpage.activeTab)
      }

      webviews.callAsync(findinpage.activeTab, 'focus')
    }

    findinpage.activeTab = null
  },
  initialize() {
    findinpage.container = document.getElementById('findinpage-bar')!
    findinpage.input = document.getElementById('findinpage-input') as HTMLInputElement
    findinpage.counter = document.getElementById('findinpage-count')!
    findinpage.previous = document.getElementById('findinpage-previous-match')!
    findinpage.next = document.getElementById('findinpage-next-match')!
    findinpage.endButton = document.getElementById('findinpage-end')!
    findinpage.input!.addEventListener('click', () => {
      webviews.releaseFocus()
    })

    findinpage.endButton!.addEventListener('click', () => {
      findinpage.end()
    })

    // eslint-disable-next-line func-names
    findinpage.input!.addEventListener('input', function (_e) {
      if (this.value) {
        webviews.callAsync(findinpage.activeTab!, 'findInPage', findinpage.input!.value)
      }
    })

    findinpage.input!.addEventListener('keypress', (e) => {
      if (e.keyCode === 13) {
        // Return/Enter key
        webviews.callAsync(findinpage.activeTab!, 'findInPage', [
          findinpage.input!.value,
          {
            forward: !e.shiftKey, // find previous if Shift is pressed
            findNext: false,
          },
        ])
      }
    })

    findinpage.previous!.addEventListener('click', (_e) => {
      webviews.callAsync(findinpage.activeTab!, 'findInPage', [
        findinpage.input!.value,
        {
          forward: false,
          findNext: false,
        },
      ])
      findinpage.input!.focus()
    })

    findinpage.next!.addEventListener('click', (_e) => {
      webviews.callAsync(findinpage.activeTab!, 'findInPage', [
        findinpage.input!.value,
        {
          forward: true,
          findNext: false,
        },
      ])
      findinpage.input!.focus()
    })

    webviews.bindEvent('view-hidden', (tabId: string) => {
      if (tabId === findinpage.activeTab) {
        findinpage.end()
      }
    })

    webviews.bindEvent(
      'did-start-navigation',
      (
        tabId: string | null,
        _url: any,
        isInPlace: any,
        _isMainFrame: any,
        _frameProcessId: any,
        _frameRoutingId: any,
      ) => {
        if (!isInPlace && tabId === findinpage.activeTab) {
          findinpage.end()
        }
      },
    )

    webviews.bindEvent(
      'found-in-page',
      (
        _tabId: string,
        data: {
          requestId: number
          activeMatchOrdinal: number
          matches: number
          selectionArea: Rectangle
          finalUpdate: boolean
        },
      ) => {
        if (data.matches !== undefined) {
          let text
          if (data.matches === 1) {
            text = l('findMatchesSingular')
          } else {
            text = l('findMatchesPlural')
          }

          findinpage.counter!.textContent = text
            .replace('%i', data.activeMatchOrdinal as unknown as string)
            .replace('%t', data.matches as unknown as string)
        }
      },
    )

    keybindings.defineShortcut('followLink', () => {
      findinpage.end({ action: 'activateSelection' })
    })

    keybindings.defineShortcut({ keys: 'esc' }, () => {
      findinpage.end()
    })
  },
}
/*
findinpage.input.addEventListener('click', () => {
  webviews.releaseFocus()
})

findinpage.endButton.addEventListener('click', () => {
  findinpage.end()
})

// eslint-disable-next-line func-names
findinpage.input.addEventListener('input', function (_e) {
  if (this.value) {
    webviews.callAsync(findinpage.activeTab!, 'findInPage', findinpage.input.value)
  }
})

findinpage.input.addEventListener('keypress', (e) => {
  if (e.keyCode === 13) {
    // Return/Enter key
    webviews.callAsync(findinpage.activeTab!, 'findInPage', [
      findinpage.input.value,
      {
        forward: !e.shiftKey, // find previous if Shift is pressed
        findNext: false,
      },
    ])
  }
})

findinpage.previous.addEventListener('click', (_e) => {
  webviews.callAsync(findinpage.activeTab!, 'findInPage', [
    findinpage.input.value,
    {
      forward: false,
      findNext: false,
    },
  ])
  findinpage.input.focus()
})

findinpage.next.addEventListener('click', (_e) => {
  webviews.callAsync(findinpage.activeTab!, 'findInPage', [
    findinpage.input.value,
    {
      forward: true,
      findNext: false,
    },
  ])
  findinpage.input.focus()
})

webviews.bindEvent('view-hidden', (tabId: string) => {
  if (tabId === findinpage.activeTab) {
    findinpage.end()
  }
})

webviews.bindEvent(
  'did-start-navigation',
  (tabId: string | null, _url: any, isInPlace: any, _isMainFrame: any, _frameProcessId: any, _frameRoutingId: any) => {
    if (!isInPlace && tabId === findinpage.activeTab) {
      findinpage.end()
    }
  },
)

webviews.bindEvent(
  'found-in-page',
  (
    _tabId: string,
    data: {
      requestId: number
      activeMatchOrdinal: number
      matches: number
      selectionArea: Rectangle
      finalUpdate: boolean
    },
  ) => {
    if (data.matches !== undefined) {
      let text
      if (data.matches === 1) {
        text = l('findMatchesSingular')
      } else {
        text = l('findMatchesPlural')
      }

      findinpage.counter.textContent = text
        .replace('%i', data.activeMatchOrdinal as unknown as string)
        .replace('%t', data.matches as unknown as string)
    }
  },
)

keybindings.defineShortcut('followLink', () => {
  findinpage.end({ action: 'activateSelection' })
})

keybindings.defineShortcut({ keys: 'esc' }, () => {
  findinpage.end()
})
*/
// module.exports = findinpage
