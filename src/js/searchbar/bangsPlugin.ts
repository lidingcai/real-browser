// var tabEditor = require('navbar/tabEditor.js')
import { l } from '../../locales'
import { tabEditor } from '../navbar/tabEditor'
// var searchbarAutocomplete = require('util/autocomplete.js')
import * as searchbarAutocomplete from '../util/autocomplete'
// var searchEngine = require('util/searchEngine.js')
import { searchEngine } from '../util/searchEngine'
// var settings = require('util/settings/settings.js')
import { settings } from '../util/settings/settings'
// var searchbar = require('searchbar/searchbar.js')
import { searchbar } from './searchbar'
// var searchbarPlugins = require('searchbar/searchbarPlugins.js')
import { searchbarPlugins } from './searchbarPlugins'
// format is {phrase, snippet, score, icon, fn, isCustom, isAction} to match https://ac.duckduckgo.com/ac?q=!

// isAction describes whether the !bang is an action (like "open preferences"), or a place to search (like "search reading list items")
export interface CustomBangsType {
  phrase: string
  snippet: string
  score?: number
  icon?: string
  showSuggestions?: Function
  fn: Function
  isCustom?: boolean
  isAction?: boolean
  image?: string
}
const customBangs: CustomBangsType[] = []

export function registerCustomBang(data: CustomBangsType) {
  customBangs.push({
    phrase: data.phrase,
    snippet: data.snippet,
    score: data.score || 256000,
    icon: data.icon || 'carbon:terminal',
    showSuggestions: data.showSuggestions,
    fn: data.fn,
    isCustom: true,
    isAction: data.isAction || false,
  })
}

function searchCustomBangs(text: string) {
  return customBangs.filter((item) => {
    return item.phrase.indexOf(text) === 0
  })
}

function getCustomBang(text: string) {
  const bang = text.split(' ')[0]
  return customBangs.filter((item) => {
    return item.phrase === bang
  })[0]
}

// format is {bang: count}
const bangUseCounts = JSON.parse(localStorage.getItem('bangUseCounts') || '{}')

const saveBangUseCounts = window.debounce(() => {
  localStorage.setItem('bangUseCounts', JSON.stringify(bangUseCounts))
}, 10000)

function incrementBangCount(bang: string) {
  // increment bangUseCounts

  if (bangUseCounts[bang]) {
    bangUseCounts[bang]++
  } else {
    bangUseCounts[bang] = 1
  }

  // prevent the data from getting too big

  if (bangUseCounts[bang] > 100) {
    for (const key in bangUseCounts) {
      bangUseCounts[key] = Math.floor(bangUseCounts[key] * 0.8)

      if (bangUseCounts[key] < 2) {
        delete bangUseCounts[key]
      }
    }
  }

  saveBangUseCounts()
}

// results is an array of {phrase, snippet, image}
function showBangSearchResults(
  text: string,
  results: CustomBangsType[],
  input: HTMLInputElement,
  event: Event,
  limit = 5,
) {
  searchbarPlugins.reset('bangs')

  results.sort((a, b) => {
    let aScore = a.score || 1
    let bScore = b.score || 1
    if (bangUseCounts[a.phrase]) {
      aScore *= bangUseCounts[a.phrase]
    }
    if (bangUseCounts[b.phrase]) {
      bScore *= bangUseCounts[b.phrase]
    }

    return bScore - aScore
  })

  results.slice(0, limit).forEach((result, idx) => {
    // autocomplete the bang, but allow the user to keep typing

    const data = {
      icon: result.icon,
      iconImage: result.image,
      title: result.snippet,
      secondaryText: result.phrase,
      fakeFocus: text !== '!' && idx === 0,
      click: (_arg0: any) => {},
    }

    data.click = (e) => {
      // if the item is an action, clicking on it should immediately trigger it instead of prompting for additional text
      if (result.isAction && result.fn) {
        searchbar.openURL(result.phrase, e)
        return
      }

      setTimeout(() => {
        incrementBangCount(result.phrase)

        input.value = `${result.phrase} `
        input.focus()

        // show search suggestions for custom bangs
        if (result.showSuggestions) {
          result.showSuggestions('', input, event)
        }
      }, 66)
    }

    searchbarPlugins.addResult('bangs', data)
  })
}

function getBangSearchResults(text: string, input: HTMLInputElement, event: KeyboardEvent) {
  // if there is a space in the text, show bang search suggestions (only supported for custom bangs)

  if (text.indexOf(' ') !== -1) {
    const bang = getCustomBang(text)

    if (bang && bang.showSuggestions) {
      bang.showSuggestions(text.replace(bang.phrase, '').trimLeft(), input, event)
      return
    }
    if (text.trim().indexOf(' ') !== -1) {
      searchbarPlugins.reset('bangs')
      return
    }
  }

  // otherwise search for bangs

  let resultsPromise

  // get results from DuckDuckGo if it is a search engine, and the current tab is not a private tab
  if (
    searchEngine.getCurrent().name === 'DuckDuckGo' &&
    !(window.tabs.get(window.tabs.getSelected()!) as TabType).private
  ) {
    resultsPromise = fetch(`https://ac.duckduckgo.com/ac/?t=min&q=${encodeURIComponent(text)}`, {
      cache: 'force-cache',
    }).then((response) => {
      return response.json()
    })
  } else {
    resultsPromise = new Promise((resolve, _reject) => {
      // autocomplete doesn't work if we attempt to autocomplete at the same time as the key is being pressed, so add a small delay (TODO fix this)
      setTimeout(() => {
        resolve([])
      }, 0)
    })
  }

  resultsPromise.then((results) => {
    if (text === '!') {
      // if we're listing all commands, limit the number of site results so that there's space to show more browser commands
      // but if there's search text, the results are capped elsewhere, and low-ranking results should be included here
      // in case they end up being sorted to the top based on usage
      results = results.slice(0, 8)
    }
    results = results.concat(searchCustomBangs(text))
    if (text === '!') {
      showBangSearchResults(text, results, input, event)
      searchbarPlugins.addResult('bangs', {
        title: l('showMoreBangs'),
        icon: 'carbon:chevron-down',
        click() {
          showBangSearchResults(text, results, input, event, Infinity)
        },
      })
    } else {
      showBangSearchResults(text, results, input, event)

      if (results[0] && event.keyCode !== 8) {
        searchbarAutocomplete.autocomplete(input, [results[0].phrase])
      }
    }
  })
}

export function initialize() {
  searchbarPlugins.register('bangs', {
    index: 1,
    trigger(text) {
      return !!text && text.indexOf('!') === 0
    },
    showResults: getBangSearchResults,
  })

  searchbarPlugins.registerURLHandler((url) => {
    if (url.indexOf('!') === 0) {
      incrementBangCount(url.split(' ')[0])

      const bang = getCustomBang(url)

      if ((!bang || !bang.isAction) && url.split(' ').length === 1 && !url.endsWith(' ')) {
        // the bang is non-custom or a custom bang that requires search text, so add a space after it
        tabEditor.show(window.tabs.getSelected()!, `${url} `)
        return true
      }
      if (bang) {
        // there is a custom bang that is an action or has search text, so it can be run
        tabEditor.hide()
        bang.fn(url.replace(bang.phrase, '').trimLeft())
        return true // override the default action
      }
    }
    return false
  })

  const savedBangs = settings.get('customBangs') as { phrase: string; redirect: string; snippet: string }[]
  if (savedBangs) {
    savedBangs.forEach((bang) => {
      if (!bang.phrase || !bang.redirect) return
      registerCustomBang({
        phrase: `!${bang.phrase}`,
        snippet: `${bang.snippet}` ?? '',
        // isAction: true - skip search text entry if the bang does not include a search parameter
        isAction: !bang.redirect.includes('%s'),
        fn(text: string) {
          searchbar.openURL(bang.redirect.replace('%s', encodeURIComponent(text)))
        },
      })
    })
  }
}

// module.exports = { initialize, registerCustomBang }
