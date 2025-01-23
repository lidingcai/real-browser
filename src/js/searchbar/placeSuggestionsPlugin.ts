// var searchbarPlugins = require('searchbar/searchbarPlugins.js')
// var places = require('places/places.js')
import { places } from '../places/places'
// var urlParser = require('util/urlParser.js')
import { urlParser } from '../util/urlParser'
import { searchbarPlugins } from './searchbarPlugins'
// var searchbarUtils = require('searchbar/searchbarUtils.js')
import * as searchbarUtils from './searchbarUtils'

// const { tabs } = window
function showPlaceSuggestions(_text: string, _input: HTMLInputElement, _event: Event) {
  // use the current tab's url for history suggestions, or the previous tab if the current tab is empty
  let { url } = window.tabs.get(window.tabs.getSelected()!) as TabType

  if (!url) {
    const previousTab = window.tabs.getAtIndex(window.tabs.getIndex(window.tabs.getSelected()!) - 1)
    if (previousTab) {
      url = previousTab.url
    }
  }

  places.getPlaceSuggestions(url!, (results: { url: string; title: string }[]) => {
    searchbarPlugins.reset('placeSuggestions')

    const tabList = (window.tabs.get() as TabType[]).map((tab: TabType) => {
      return tab.url
    })

    results = results.filter((item: { url: string }) => {
      return tabList.indexOf(item.url) === -1
    })

    results.slice(0, 4).forEach((result: { url: string; title: string }) => {
      searchbarPlugins.addResult('placeSuggestions', {
        title: urlParser.prettyURL(result.url),
        secondaryText: searchbarUtils.getRealTitle(result.title),
        url: result.url,
        delete() {
          places.deleteHistory(result.url)
        },
      })
    })
  })
}

export function initialize() {
  searchbarPlugins.register('placeSuggestions', {
    index: 1,
    trigger(text) {
      return !text
    },
    showResults: showPlaceSuggestions,
  })
}

// module.exports = { initialize }
