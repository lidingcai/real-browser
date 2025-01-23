import EventEmitter from 'node:events'

// var keybindings = require('keybindings.js')
import * as keybindings from '../keybindings'
// var keyboardNavigationHelper = require('util/keyboardNavigationHelper.js')
import { keyboardNavigationHelper } from '../util/keyboardNavigationHelper'
// var urlParser = require('util/urlParser.js')
import { urlParser } from '../util/urlParser'
// var webviews = require('webviews.js')
import { webviews } from '../webviews'
// var searchbarPlugins = require('searchbar/searchbarPlugins.js')
import { searchbarPlugins } from './searchbarPlugins'

function openURLInBackground(url: string) {
  // used to open a url in the background, without leaving the searchbar
  searchbar.events.emit('url-selected', { url, background: true })

  const i = searchbar.el.querySelector('.searchbar-item:focus') as HTMLElement
  if (i) {
    // remove the highlight from an awesomebar result item, if there is one
    i.blur()
  }
}

export const searchbar = {
  el: null as unknown as HTMLElement,
  associatedInput: null as null | HTMLInputElement,
  events: null as unknown as EventEmitter,
  show(associatedInput: HTMLInputElement) {
    searchbar.el.hidden = false
    searchbar.associatedInput = associatedInput
  },
  hide() {
    searchbar.associatedInput = null
    searchbar.el.hidden = true

    searchbarPlugins.clearAll()
  },
  getValue() {
    const text = searchbar.associatedInput!.value
    return text.replace(
      text.substring(
        searchbar.associatedInput!.selectionStart as number,
        searchbar.associatedInput!.selectionEnd as number,
      ),
      '',
    )
  },
  showResults(text: string, event: KeyboardEvent | null = null) {
    // find the real input value, accounting for highlighted suggestions and the key that was just pressed
    // delete key doesn't behave like the others, String.fromCharCode returns an unprintable character (which has a length of one)

    let realText
    if (event && event.keyCode !== 8) {
      realText =
        text.substring(0, searchbar.associatedInput!.selectionStart as number) +
        event.key +
        text.substring(searchbar.associatedInput!.selectionEnd as number, text.length)
    } else {
      realText = text
    }
    searchbarPlugins.run(realText, searchbar.associatedInput, event)
  },
  openURL(url: string, event: MouseEvent | KeyboardEvent | undefined = undefined): boolean {
    const hasURLHandler = searchbarPlugins.runURLHandlers(url)
    if (hasURLHandler) {
      return false
    }

    if (event && (window.platformType === 'mac' ? event.metaKey : event.ctrlKey)) {
      openURLInBackground(url)
      return true
    }
    searchbar.events.emit('url-selected', { url, background: false })
    // focus the webview, so that autofocus inputs on the page work
    webviews.focus()
    return false
  },
  initialize() {
    searchbar.el = document.getElementById('searchbar') as HTMLElement
    searchbar.associatedInput = null as null | HTMLInputElement
    searchbar.events = new EventEmitter()

    keyboardNavigationHelper.addToGroup('searchbar', searchbar.el)

    // mod+enter navigates to searchbar URL + ".com"
    keybindings.defineShortcut('completeSearchbar', () => {
      if (searchbar.associatedInput) {
        // if the searchbar is open
        const { value } = searchbar.associatedInput

        // if the text is already a URL, navigate to that page
        if (urlParser.isPossibleURL(value)) {
          searchbar.events.emit('url-selected', { url: value, background: false })
        } else {
          searchbar.events.emit('url-selected', { url: urlParser.parse(`${value}.com`), background: false })
        }
      }
    })

    searchbarPlugins.initialize(searchbar.openURL)
  },
}

/*
keyboardNavigationHelper.addToGroup('searchbar', searchbar.el)

// mod+enter navigates to searchbar URL + ".com"
keybindings.defineShortcut('completeSearchbar', () => {
  if (searchbar.associatedInput) {
    // if the searchbar is open
    const { value } = searchbar.associatedInput

    // if the text is already a URL, navigate to that page
    if (urlParser.isPossibleURL(value)) {
      searchbar.events.emit('url-selected', { url: value, background: false })
    } else {
      searchbar.events.emit('url-selected', { url: urlParser.parse(`${value}.com`), background: false })
    }
  }
})

searchbarPlugins.initialize(searchbar.openURL)
*/
// module.exports = searchbar
