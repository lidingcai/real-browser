// var searchbar = require('searchbar/searchbar.js')
// var places = require('places/places.js')
import { places } from '../places/places'
// var readerDecision = require('readerDecision.js')
import { readerDecision } from '../readerDecision'
// var searchbarAutocomplete = require('util/autocomplete.js')
import * as searchbarAutocomplete from '../util/autocomplete'
// var searchEngine = require('util/searchEngine.js')
import { searchEngine } from '../util/searchEngine'
// var urlParser = require('util/urlParser.js')
import { urlParser } from '../util/urlParser'
import { searchbar } from './searchbar'
// var searchbarPlugins = require('searchbar/searchbarPlugins.js')
import { searchbarPlugins } from './searchbarPlugins'
// var searchbarUtils = require('searchbar/searchbarUtils.js')
import * as searchbarUtils from './searchbarUtils'
// var currentResponseSent = 0
let currentResponseSent = 0
function showSearchbarPlaceResults(text: string, input: HTMLInputElement, event: KeyboardEvent, pluginName = 'places') {
  const responseSent = Date.now()

  let searchFn: Function
  let resultCount:number = 0
  if (pluginName === 'fullTextPlaces') {
    searchFn = places.searchPlacesFullText
    resultCount = 4 - searchbarPlugins.getResultCount('places')
  } else {
    searchFn = places.searchPlaces
    resultCount = 4
  }

  // only autocomplete an item if the delete key wasn't pressed
  let canAutocomplete = event && event.keyCode !== 8

  searchFn(
    text,
    (
      results: {
        url: string
        tags: any
        searchSnippet: any
        title: // var places = require('places/places.js')
        string
        isBookmarked: any
      }[],
    ) => {
      // prevent responses from returning out of order
      if (responseSent < currentResponseSent) {
        return
      }

      currentResponseSent = responseSent

      searchbarPlugins.reset(pluginName)

      results = results.slice(0, resultCount)

      results.forEach(
        (result: { url: string; tags: any; searchSnippet: any; title: string; isBookmarked: any }, index: number) => {
          let didAutocompleteResult = false

          const searchQuery = searchEngine.getSearch(result.url)

          if (canAutocomplete) {
            // if the query is autocompleted, pressing enter will search for the result using the current search engine, so only pages from the current engine should be autocompleted
            if (searchQuery && searchQuery.engine === searchEngine.getCurrent().name && index === 0) {
              const acResult = searchbarAutocomplete.autocomplete(input, [searchQuery.search!])
              if (acResult.valid) {
                canAutocomplete = false
                didAutocompleteResult = true
              }
            } else {
              const autocompletionType = searchbarAutocomplete.autocompleteURL(input, result.url)

              if (autocompletionType !== -1) {
                canAutocomplete = false
              }

              if (autocompletionType === 0) {
                // the domain was autocompleted, show a domain result item
                const domain = new URL(result.url).hostname

                searchbarPlugins.setTopAnswer(pluginName, {
                  title: domain,
                  url: domain,
                  fakeFocus: true,
                })
              }
              if (autocompletionType === 1) {
                didAutocompleteResult = true
              }
            }
          }

          const data = {
            url: result.url,
            metadata: result.tags,
            descriptionBlock: result.searchSnippet,
            highlightedTerms: result.searchSnippet
              ? text
                  .toLowerCase()
                  .split(' ')
                  .filter((t) => t.length > 0)
              : [],
            delete() {
              places.deleteHistory(result.url)
            },
            icon: 'carbon:wikis',
            title: '',
            secondaryText: '',
            fakeFocus: false,
          }

          if (searchQuery) {
            data.title = searchQuery.search!
            data.secondaryText = searchQuery.engine
            data.icon = 'carbon:search'
          } else {
            data.title = urlParser.prettyURL(urlParser.getSourceURL(result.url))
            data.secondaryText = searchbarUtils.getRealTitle(result.title)
          }

          // show a star for bookmarked items
          if (result.isBookmarked) {
            data.icon = 'carbon:star-filled'
          } else if (readerDecision.shouldRedirect(result.url) === 1) {
            // show an icon to indicate that this page will open in reader view
            data.icon = 'carbon:notebook'
          }

          // create the item

          if (didAutocompleteResult) {
            // if this exact URL was autocompleted, show the item as the top answer
            data.fakeFocus = true
            searchbarPlugins.setTopAnswer(pluginName, data)
          } else {
            searchbarPlugins.addResult(pluginName, data)
          }
        },
      )
    },
  )
}

export function initialize() {
  searchbarPlugins.register('places', {
    index: 1,
    trigger(text) {
      return !!text && text.indexOf('!') !== 0
    },
    showResults: showSearchbarPlaceResults,
  })

  searchbarPlugins.register('fullTextPlaces', {
    index: 2,
    trigger(text) {
      return !!text && text.indexOf('!') !== 0
    },
    showResults: window.debounce((text: string, input: HTMLInputElement, event: KeyboardEvent) => {
      if (searchbarPlugins.getResultCount('places') < 4 && searchbar.associatedInput) {
        // eslint-disable-next-line prefer-rest-params
        // showSearchbarPlaceResults.apply(this, Array.from(arguments).concat('fullTextPlaces'))
        showSearchbarPlaceResults(text, input, event, 'fullTextPlaces')
      } else {
        // can't show results, clear any previous ones
        searchbarPlugins.reset('fullTextPlaces')
      }
    }, 200),
  })
}

// module.exports = { initialize }
