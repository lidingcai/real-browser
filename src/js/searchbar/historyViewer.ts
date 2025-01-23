// var searchbar = require('searchbar/searchbar.js')
// var places = require('places/places.js')
import { ipcRenderer as ipc } from 'electron'

import { l } from '../../locales'
import { places } from '../places/places'
// var formatRelativeDate = require('util/relativeDate.js')
import { formatRelativeDate } from '../util/relativeDate'
// var urlParser = require('util/urlParser.js')
import { urlParser } from '../util/urlParser'
// var bangsPlugin = require('searchbar/bangsPlugin.js')
import * as bangsPlugin from './bangsPlugin'
import { searchbar } from './searchbar'
// var searchbarPlugins = require('searchbar/searchbarPlugins.js')
import { searchbarPlugins } from './searchbarPlugins'
// var searchbarUtils = require('searchbar/searchbarUtils.js')
import * as searchbarUtils from './searchbarUtils'

interface ItemType {
  url: string
  title: string
  tags: string[]
  lastVisit: number
  isBookmarked: boolean
}
// module.exports = {
export const initialize = () => {
  bangsPlugin.registerCustomBang({
    phrase: '!history',
    snippet: l('searchHistory'),
    isAction: false,
    showSuggestions(text: string, input: HTMLInputElement, _event: Event) {
      places.searchPlaces(
        text,
        (results: ItemType[]) => {
          searchbarPlugins.reset('bangs')

          const container = searchbarPlugins.getContainer('bangs')!

          // show clear button

          if (text === '' && results.length > 0) {
            const clearButton = document.createElement('button')
            clearButton.className = 'searchbar-floating-button'
            clearButton.textContent = l('clearHistory')
            container.appendChild(clearButton)

            clearButton.addEventListener('click', () => {
              // eslint-disable-next-line no-restricted-globals, no-alert
              if (confirm(l('clearHistoryConfirmation'))) {
                places.deleteAllHistory()
                ipc.invoke('clearStorageData')

                // hacky way to refresh the list
                // TODO make a better api for this
                setTimeout(() => {
                  searchbarPlugins.run(`!history ${text}`, input, null)
                }, 200)
              }
            })
          }

          // show results

          const lazyList = searchbarUtils.createLazyList(container.parentNode as Element)

          let lastRelativeDate = '' // used to generate headings

          results
            .sort((a, b) => {
              // order by last visit
              return b.lastVisit - a.lastVisit
            })
            .slice(0, 1000)
            .forEach((result, index) => {
              const thisRelativeDate = formatRelativeDate(result.lastVisit)
              if (thisRelativeDate !== lastRelativeDate) {
                searchbarPlugins.addHeading('bangs', { text: thisRelativeDate })
                lastRelativeDate = thisRelativeDate
              }
              const data = {
                title: result.title,
                secondaryText: urlParser.basicURL(urlParser.getSourceURL(result.url)),
                fakeFocus: index === 0 && !!text,
                icon: result.isBookmarked ? 'carbon:star' : '',
                click(e: MouseEvent | KeyboardEvent | undefined) {
                  searchbar.openURL(result.url, e)
                },
                delete() {
                  places.deleteHistory(result.url)
                },
                showDeleteButton: true,
              }
              const placeholder = lazyList.createPlaceholder()
              container.appendChild(placeholder)
              lazyList.lazyRenderItem(placeholder, data)
            })
        },
        { limit: Infinity },
      )
    },
    fn(text: string) {
      if (!text) {
        return
      }
      places.searchPlaces(
        text,
        (results: ItemType[]) => {
          if (results.length !== 0) {
            results = results.sort((a, b) => {
              return b.lastVisit - a.lastVisit
            })
            searchbar.openURL(results[0].url, undefined)
          }
        },
        { limit: Infinity },
      )
    },
  })
}
// }
