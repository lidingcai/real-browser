/*
if (typeof require !== 'undefined') {
  var settings = require('util/settings/settings.js')
}
*/
import { settings } from './settings/settings'
// otherwise, assume window.settings exists already

let currentSearchEngine = {
  name: '',
  searchURL: '%s',
} as { name: string; searchURL: string; suggestionsURL?: string; queryParam?: string; urlObj?: URL; custom?: boolean }

const defaultSearchEngine = 'DuckDuckGo'

export const searchEngines: Record<
  string,
  { name: string; searchURL: string; suggestionsURL?: string; queryParam?: string; urlObj?: URL; custom?: boolean }
> = {
  DuckDuckGo: {
    name: 'DuckDuckGo',
    searchURL: 'https://duckduckgo.com/?q=%s&t=min',
    suggestionsURL: 'https://ac.duckduckgo.com/ac/?q=%s&type=list&t=min',
    queryParam: 'q',
  },
  Google: {
    name: 'Google',
    searchURL: 'https://www.google.com/search?q=%s',
    queryParam: 'q',
  },

  Bing: {
    name: 'Bing',
    searchURL: 'https://www.bing.com/search?q=%s',
    suggestionsURL: 'https://www.bing.com/osjson.aspx?query=%s',
    queryParam: 'q',
  },
  Yahoo: {
    name: 'Yahoo',
    searchURL: 'https://search.yahoo.com/yhs/search?p=%s',
    suggestionsURL: 'https://search.yahoo.com/sugg/os?command=%s&output=fxjson',
    queryParam: 'p',
  },

  Baidu: {
    name: 'Baidu',
    searchURL: 'https://www.baidu.com/s?wd=%s',
    suggestionsURL: 'https://www.baidu.com/su?wd=%s&action=opensearch',
    queryParam: 'wd',
  },
  StartPage: {
    name: 'StartPage',
    searchURL: 'https://www.startpage.com/do/search?q=%s',
    suggestionsURL: 'https://www.startpage.com/cgi-bin/csuggest?query=%s&format=json',
    queryParam: 'q',
  },
  Ecosia: {
    name: 'Ecosia',
    searchURL: 'https://www.ecosia.org/search?q=%s',
    suggestionsURL: 'https://ac.ecosia.org/autocomplete?q=%s&type=list',
    queryParam: 'q',
  },
  Qwant: {
    name: 'Qwant',
    searchURL: 'https://www.qwant.com/?q=%s',
    suggestionsURL: 'https://api.qwant.com/api/suggest/?q=%s&client=opensearch',
    queryParam: 'q',
  },
  Wikipedia: {
    name: 'Wikipedia',
    searchURL: 'https://wikipedia.org/w/index.php?search=%s',
    suggestionsURL: 'https://wikipedia.org/w/api.php?action=opensearch&search=%s',
    queryParam: 'search',
  },
  Yandex: {
    name: 'Yandex',
    searchURL: 'https://yandex.com/search/?text=%s',
    suggestionsURL: 'https://suggest.yandex.com/suggest-ff.cgi?part=%s',
    queryParam: 'text',
  },
  none: {
    name: 'none',
    searchURL: 'http://%s',
  },
}
for (const e in searchEngines) {
  try {
    searchEngines[e].urlObj = new URL(searchEngines[e].searchURL)
  } catch (e) {
    //
  }
}

settings.listen('searchEngine', (value: { name: string; url: string }) => {
  if (value && value.name) {
    currentSearchEngine = searchEngines[value.name]
  } else if (value && value.url) {
    let searchDomain
    try {
      searchDomain = new URL(value.url).hostname.replace('www.', '')
    } catch (e) {
      //
    }
    currentSearchEngine = {
      name: searchDomain || 'custom',
      searchURL: value.url,
      custom: true,
    }
  } else {
    currentSearchEngine = searchEngines[defaultSearchEngine]
  }
})

export const searchEngine = {
  getCurrent() {
    return currentSearchEngine
  },
  getSearch(url: string) {
    let urlObj
    try {
      urlObj = new URL(url)
    } catch (e) {
      return null
    }
    for (const e in searchEngines) {
      if (!searchEngines[e].urlObj) {
        continue
      }
      if (
        searchEngines[e].urlObj!.hostname === urlObj.hostname &&
        searchEngines[e].urlObj!.pathname === urlObj.pathname
      ) {
        if (urlObj.searchParams.get(searchEngines[e].queryParam!)) {
          return {
            engine: searchEngines[e].name,
            search: urlObj.searchParams.get(searchEngines[e].queryParam!),
          }
        }
      }
    }
    return null
  },
}

/*
if (typeof module === 'undefined') {
  window.currentSearchEngine = currentSearchEngine
} else {
  module.exports = searchEngine
}
*/
