/* Determines whether a page should redirect to reader view based on visit history */

// if (typeof require !== 'undefined') {
// running in UI process
//  var settings = require('util/settings/settings.js')
// }
import { settings } from './util/settings/settings'

export const readerDecision = {
  info: {
    domainStatus: {} as Record<string, boolean>,
    URLStatus: {} as Record<string, { lastVisit: number; isReaderable: boolean }>,
  },
  trimURL(url: string) {
    const loc = new URL(url)
    loc.hash = ''
    return loc.toString()
  },
  shouldRedirect(url: string) {
    /*
    returns:
        -1: never redirect, even if the page is confirmed to be readerable
        0: redirect once the page is confirmed to be readerable
        1: redirect even before the page is confirmed to be readerable
    */

    url = readerDecision.trimURL(url)

    try {
      const urlObj = new URL(url)

      if (readerDecision.info.URLStatus[url]) {
        // we have data collected from a previous visit to this page
        if (readerDecision.info.URLStatus[url].isReaderable === true) {
          // we know it will be readable, redirect without waiting
          return 1
        }
        if (readerDecision.info.URLStatus[url].isReaderable === false) {
          // we know it won't be readerable (or reader mode might be broken for the page), never redirect to it
          return -1
        }
      } else if (readerDecision.info.domainStatus[urlObj.hostname] === true) {
        // this domain has been set to auto reader mode
        // we don't know anything about the content of the page
        if (urlObj.pathname === '/') {
          // sometimes the domain homepage will have a lot of text and look like an article (examples: gutenberg.org, nytimes.com), but it almost never is, so we shouldn't redirect to reader view unless the page has been explicitly marked as readerable (in which case URLStatus will handle it above)
          return -1
        }
        return 0
      }
    } catch (e) {
      console.warn('failed to parse URL', url, e)
    }

    return -1
  },
  setDomainStatus(url: string, autoRedirect: boolean) {
    readerDecision.info.domainStatus[new URL(url).hostname] = autoRedirect
    saveData()
  },
  getDomainStatus(url: string) {
    return readerDecision.info.domainStatus[new URL(url).hostname]
  },
  setURLStatus(url: string, isReaderable: boolean) {
    url = readerDecision.trimURL(url)

    readerDecision.info.URLStatus[url] = { lastVisit: Date.now(), isReaderable }
    saveData()
  },
  getURLStatus(url: string) {
    url = readerDecision.trimURL(url)

    return readerDecision.info.URLStatus[url].isReaderable
  },
  getSameDomainStatuses(url: string) {
    const results = []
    for (const itemURL in readerDecision.info.URLStatus) {
      try {
        if (new URL(itemURL).hostname === new URL(url).hostname && itemURL !== url) {
          results.push(readerDecision.info.URLStatus[itemURL])
        }
      } catch (e) {
        //
      }
    }

    return results
  },
}

function loadData(data: string | null) {
  try {
    if (!data) {
      data = localStorage.getItem('readerData')
      if (data) {
        // migrate from old format
        settings.set('readerData', data)
        localStorage.removeItem('readerData')
      }
    }
    readerDecision.info = JSON.parse(data as string).data
  } catch (e) {
    //
  }

  if (!readerDecision.info) {
    readerDecision.info = {
      domainStatus: {},
      URLStatus: {},
    }
  }
}

function saveData() {
  settings.set('readerData', JSON.stringify({ version: 1, data: readerDecision.info }))
}

function cleanupData() {
  let removedEntries = false
  for (const url in readerDecision.info.URLStatus) {
    if (Date.now() - readerDecision.info.URLStatus[url].lastVisit > 6 * 7 * 24 * 60 * 60 * 1000) {
      delete readerDecision.info.URLStatus[url]
      removedEntries = true
    }
  }
  return removedEntries
}

settings.listen('readerData', (data: string | null) => {
  loadData(data)
  if (cleanupData()) {
    saveData()
  }
})

// if (typeof module !== 'undefined') {
//  module.exports = readerDecision
// }
