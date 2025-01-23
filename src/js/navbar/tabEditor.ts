// const searchbar = require('searchbar/searchbar.js')
// const modalMode = require('modalMode.js')
import { l } from '../../locales'
import { modalMode } from '../modalMode'
import { searchbar } from '../searchbar/searchbar'
// const keyboardNavigationHelper = require('util/keyboardNavigationHelper.js')
import { keyboardNavigationHelper } from '../util/keyboardNavigationHelper'
// const urlParser = require('util/urlParser.js')
import { urlParser } from '../util/urlParser'
// const webviews = require('webviews.js')
import { webviews } from '../webviews'
// const bookmarkStar = require('navbar/bookmarkStar.js')
import { bookmarkStar } from './bookmarkStar'
// const contentBlockingToggle = require('navbar/contentBlockingToggle.js')
import { contentBlockingToggle } from './contentBlockingToggle'

export const tabEditor = {
  container: null as unknown as HTMLDivElement,
  input: null as unknown as HTMLInputElement,
  star: null as HTMLButtonElement | null,
  contentBlockingToggle: null as null | HTMLButtonElement,
  show(tabId: string, editingValue: string = '', showSearchbar: boolean | undefined = undefined) {
    /* Edit mode is not available in modal mode. */
    if (modalMode.enabled()) {
      return
    }

    tabEditor.container.hidden = false

    bookmarkStar.update(tabId, tabEditor.star!)
    contentBlockingToggle.update(tabId, tabEditor.contentBlockingToggle!)

    webviews.requestPlaceholder('editMode')

    document.body.classList.add('is-edit-mode')

    let currentURL = urlParser.getSourceURL((window.tabs.get(tabId) as TabType).url!)
    if (currentURL === 'min://newtab') {
      currentURL = ''
    }

    tabEditor.input.value = editingValue || currentURL
    tabEditor.input.focus()
    if (!editingValue) {
      tabEditor.input.select()
    }
    // https://github.com/minbrowser/min/discussions/1506
    tabEditor.input.scrollLeft = 0

    searchbar.show(tabEditor.input)

    if (showSearchbar !== false) {
      if (editingValue) {
        searchbar.showResults(editingValue, null)
      } else {
        searchbar.showResults('', null)
      }
    }

    /* animation */
    if (window.tabs.count() > 1) {
      requestAnimationFrame(() => {
        const item = document.querySelector(`.tab-item[data-tab="${tabId}"]`) as Element
        const originCoordinates = item.getBoundingClientRect()

        const finalCoordinates = document.querySelector('#tabs')!.getBoundingClientRect()

        const translateX = Math.min(Math.round(originCoordinates.x - finalCoordinates.x) * 0.45, window.innerWidth)

        tabEditor.container.style.opacity = '0'
        tabEditor.container.style.transform = `translateX(${translateX}px)`
        requestAnimationFrame(() => {
          tabEditor.container.style.transition = '0.135s all'
          tabEditor.container.style.opacity = '1'
          tabEditor.container.style.transform = ''
        })
      })
    }
  },
  hide() {
    tabEditor.container.hidden = true
    tabEditor.container.removeAttribute('style')

    tabEditor.input.blur()
    searchbar.hide()

    document.body.classList.remove('is-edit-mode')

    webviews.hidePlaceholder('editMode')
  },
  initialize() {
    tabEditor.container = document.getElementById('tab-editor') as HTMLDivElement
    tabEditor.input = document.getElementById('tab-editor-input') as HTMLInputElement
    tabEditor.star = null as HTMLButtonElement | null
    tabEditor.contentBlockingToggle = null as null | HTMLButtonElement

    tabEditor.input.setAttribute('placeholder', l('searchbarPlaceholder'))

    tabEditor.star = bookmarkStar.create()
    tabEditor.container.appendChild(tabEditor.star)

    tabEditor.contentBlockingToggle = contentBlockingToggle.create()
    tabEditor.container.appendChild(tabEditor.contentBlockingToggle)

    keyboardNavigationHelper.addToGroup('searchbar', tabEditor.container)

    // keypress doesn't fire on delete key - use keyup instead
    // eslint-disable-next-line func-names
    tabEditor.input.addEventListener('keyup', function (e) {
      if (e.keyCode === 8) {
        searchbar.showResults(this.value, e)
      }
    })

    // eslint-disable-next-line func-names
    tabEditor.input.addEventListener('keypress', function (e) {
      if (e.keyCode === 13) {
        // return key pressed; update the url
        if (
          this.getAttribute('data-autocomplete') &&
          this.getAttribute('data-autocomplete')!.toLowerCase() === this.value.toLowerCase()
        ) {
          // special case: if the typed input is capitalized differently from the actual URL that was autocompleted (but is otherwise the same), then we want to open the actual URL instead of what was typed.
          // see https://github.com/minbrowser/min/issues/314#issuecomment-276678613
          searchbar.openURL(this.getAttribute('data-autocomplete')!, e)
        } else {
          searchbar.openURL(this.value, e)
        }
      } else if (e.keyCode === 9) {
        return
        // tab key, do nothing - in keydown listener
      } else if (e.keyCode === 16) {
        return
        // shift key, do nothing
      } else if (e.keyCode === 8) {
        return
        // delete key is handled in keyUp
      } else {
        // show the searchbar
        // it is ok we don't show the search result
        searchbar.showResults(this.value, e)
      }

      // on keydown, if the autocomplete result doesn't change, we move the selection instead of regenerating it to avoid race conditions with typing. Adapted from https://github.com/patrickburke/jquery.inlineComplete

      const v = e.key
      const sel = this.value.substring(this.selectionStart!, this.selectionEnd!).indexOf(v)

      if (v && sel === 0) {
        this.selectionStart! += 1
        e.preventDefault()
      }
    })

    document.getElementById('webviews')!.addEventListener('click', () => {
      tabEditor.hide()
    })
  },
}

// tabEditor.initialize()

// module.exports = tabEditor
