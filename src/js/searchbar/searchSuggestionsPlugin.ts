// var searchbarPlugins = require('searchbar/searchbarPlugins.js')
// var searchEngine = require('util/searchEngine.js')
import { searchEngine } from '../util/searchEngine'
// var urlParser = require('util/urlParser.js')
import { urlParser } from '../util/urlParser'
import { searchbarPlugins } from './searchbarPlugins'

function showSearchSuggestions(text: string, _input: any, _event: any) {
  const { suggestionsURL } = searchEngine.getCurrent()

  if (!suggestionsURL) {
    searchbarPlugins.reset('searchSuggestions')
    return
  }

  if (searchbarPlugins.getResultCount() - searchbarPlugins.getResultCount('searchSuggestions') > 3) {
    searchbarPlugins.reset('searchSuggestions')
    return
  }
  // console.log(`fetch url = ${suggestionsURL.replace('%s', encodeURIComponent(text))}`)
  fetch(suggestionsURL.replace('%s', encodeURIComponent(text)), {
    cache: 'force-cache',
  })
    .then((response) => {
      return response.json()
    })
    .then((results) => {
      searchbarPlugins.reset('searchSuggestions')

      if (searchbarPlugins.getResultCount() > 3) {
        return
      }

      if (results) {
        results = results[1].slice(0, 3)
        results.forEach((result: string) => {
          const data = {
            title: result,
            url: result,
            icon: '',
          }

          if (urlParser.isPossibleURL(result)) {
            // website suggestions
            data.icon = 'carbon:earth-filled'
          } else {
            // regular search results
            data.icon = 'carbon:search'
          }

          searchbarPlugins.addResult('searchSuggestions', data)
        })
      }
    })
    .catch((error) => {
      console.log(error)
      console.trace()
    })
}

export function initialize() {
  searchbarPlugins.register('searchSuggestions', {
    index: 4,
    trigger(text) {
      return (
        !!text && text.indexOf('!') !== 0 && !(window.tabs.get(window.tabs.getSelected() as string) as TabType).private
      )
    },
    showResults: window.debounce(showSearchSuggestions, 50),
  })
}

// module.exports = { initialize }
