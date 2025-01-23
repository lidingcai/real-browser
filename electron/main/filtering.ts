import { app, Session, webContents } from 'electron'
import fs from 'fs'
import path from 'path'

import * as parser from './abp-filter-parser'
import { __dirname } from './constants'
import { settings } from './settingsMain'

const defaultFilteringSettings = {
  blockingLevel: 1,
  contentTypes: [],
  exceptionDomains: [],
}

const enabledFilteringOptions = {
  blockingLevel: 0,
  contentTypes: [], // script, image
  exceptionDomains: [],
}

const globalParamsToRemove = [
  // microsoft
  'msclkid',
  // google
  'gclid',
  'dclid',
  // facebook
  'fbclid',
  // yandex
  'yclid',
  '_openstat',
  // adobe
  'icid',
  // instagram
  'igshid',
  // mailchimp
  'mc_eid',
]
const siteParamsToRemove = {
  'www.amazon.com': [
    '_ref',
    'ref_',
    'pd_rd_r',
    'pd_rd_w',
    'pf_rd_i',
    'pf_rd_m',
    'pf_rd_p',
    'pf_rd_r',
    'pf_rd_s',
    'pf_rd_t',
    'pd_rd_wg',
  ],
  'www.ebay.com': ['_trkparms'],
}

// for tracking the number of blocked requests
let unsavedBlockedRequests = 0

// electron uses different names for resource types than ABP
// electron: https://github.com/electron/electron/blob/34c4c8d5088fa183f56baea28809de6f2a427e02/shell/browser/net/atom_network_delegate.cc#L30
// abp: https://adblockplus.org/filter-cheatsheet#filter-options
const electronABPElementTypeMap = {
  mainFrame: 'document',
  subFrame: 'subdocument',
  stylesheet: 'stylesheet',
  script: 'script',
  image: 'image',
  object: 'object',
  xhr: 'xmlhttprequest',
  other: 'other', // ?
}

let parsedFilterData = {}

function initFilterList() {
  // discard old data if the list is being re-initialized
  parsedFilterData = {}

  fs.readFile(path.join(__dirname, 'ext/filterLists/easylist+easyprivacy-noelementhiding.txt'), 'utf8', (err, data) => {
    if (err) {
      return
    }
    parser.parse(data, parsedFilterData, () => {}, { async: false })
  })

  fs.readFile(path.join(__dirname, 'ext/filterLists/minFilters.txt'), 'utf8', (err, data) => {
    if (err) {
      return
    }
    parser.parse(data, parsedFilterData, () => {}, { async: false })
  })

  fs.readFile(path.join(app.getPath('userData'), 'customFilters.txt'), 'utf8', (err, data) => {
    if (!err && data) {
      parser.parse(data, parsedFilterData, () => {}, { async: false })
    }
  })
}

function removeWWW(domain) {
  return domain.replace(/^www\./i, '')
}

function requestIsThirdParty(baseDomain, requestURL) {
  baseDomain = removeWWW(baseDomain)
  const requestDomain = removeWWW(parser.getUrlHost(requestURL))

  return !(parser.isSameOriginHost(baseDomain, requestDomain) || parser.isSameOriginHost(requestDomain, baseDomain))
}

function requestDomainIsException(domain: string) {
  return enabledFilteringOptions.exceptionDomains.includes(removeWWW(domain))
}

export function filterPopups(url) {
  if (!/^https?:\/\//i.test(url)) {
    return true
  }

  const domain = parser.getUrlHost(url)
  if (enabledFilteringOptions.blockingLevel > 0 && !requestDomainIsException(domain)) {
    if (
      enabledFilteringOptions.blockingLevel === 2 ||
      (enabledFilteringOptions.blockingLevel === 1 && requestIsThirdParty(domain, url))
    ) {
      if (parser.matches(parsedFilterData as any, url, { domain, elementType: 'popup' })) {
        unsavedBlockedRequests++
        return false
      }
    }
  }

  return true
}

function removeTrackingParams(url) {
  try {
    const urlObj = new URL(url)
    for (const param of urlObj.searchParams) {
      if (
        globalParamsToRemove.includes(param[0]) ||
        (siteParamsToRemove[urlObj.hostname] && siteParamsToRemove[urlObj.hostname].includes(param[0]))
      ) {
        urlObj.searchParams.delete(param[0])
      }
    }
    return urlObj.toString()
  } catch (e) {
    console.warn(e)
    return url
  }
}

function handleRequest(details, callback) {
  // webContentsId may not exist if this request is a mainFrame or subframe
  let domain: string
  if (details.webContentsId) {
    domain = parser.getUrlHost(webContents.fromId(details.webContentsId).getURL())
  }

  const isExceptionDomain = domain && requestDomainIsException(domain)

  const modifiedURL =
    enabledFilteringOptions.blockingLevel > 0 && !isExceptionDomain ? removeTrackingParams(details.url) : details.url

  if (
    !(details.url.startsWith('http://') || details.url.startsWith('https://')) ||
    details.resourceType === 'mainFrame'
  ) {
    callback({
      cancel: false,
      requestHeaders: details.requestHeaders,
      redirectURL: modifiedURL !== details.url ? modifiedURL : undefined,
    })
    return
  }

  // block javascript and images if needed

  if (enabledFilteringOptions.contentTypes.length > 0) {
    for (let i = 0; i < enabledFilteringOptions.contentTypes.length; i++) {
      if (details.resourceType === enabledFilteringOptions.contentTypes[i]) {
        callback({
          cancel: true,
          requestHeaders: details.requestHeaders,
        })
        return
      }
    }
  }

  if (enabledFilteringOptions.blockingLevel > 0 && !isExceptionDomain) {
    if (
      (enabledFilteringOptions.blockingLevel === 1 && (!domain || requestIsThirdParty(domain, details.url))) ||
      enabledFilteringOptions.blockingLevel === 2
    ) {
      // by doing this check second, we can skip checking same-origin requests if only third-party blocking is enabled
      const matchesFilters = parser.matches(parsedFilterData as any, details.url, {
        domain,
        elementType: electronABPElementTypeMap[details.resourceType],
      })
      if (matchesFilters) {
        unsavedBlockedRequests++

        callback({
          cancel: true,
          requestHeaders: details.requestHeaders,
        })
        return
      }
    }
  }

  callback({
    cancel: false,
    requestHeaders: details.requestHeaders,
    redirectURL: modifiedURL !== details.url ? modifiedURL : undefined,
  })
}

function setFilteringSettings(settings) {
  if (!settings) {
    settings = {}
  }

  for (const key in defaultFilteringSettings) {
    if (settings[key] === undefined) {
      settings[key] = defaultFilteringSettings[key]
    }
  }

  if (settings.blockingLevel > 0 && !(enabledFilteringOptions.blockingLevel > 0)) {
    // we're enabling tracker filtering
    initFilterList()
  }

  enabledFilteringOptions.contentTypes = settings.contentTypes
  enabledFilteringOptions.blockingLevel = settings.blockingLevel
  enabledFilteringOptions.exceptionDomains = settings.exceptionDomains.map((d) => removeWWW(d))
}

export function registerFiltering(ses: Session) {
  ses.webRequest.onBeforeSendHeaders(
    { urls: ['https://api.duckduckgo.com/*', 'https://ac.duckduckgo.com/*'] },
    (details, callback) => {
      const { origin } = new URL(details.url)
      details.requestHeaders.Origin = origin
      callback({ cancel: false, requestHeaders: details.requestHeaders })
    },
  )
  ses.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    const origin = details.requestHeaders.Origin || details.requestHeaders.origin
    if (!origin) {
      callback({ cancel: false, requestHeaders: details.requestHeaders })
      return
    }
    if (details.webContentsId === global.mainWin.webContents.id) {
      const realOrigin = new URL(details.url).origin
      details.requestHeaders.Origin = realOrigin
    }
    /*
    const host1 = new URL(origin).host
    const host2 = new URL(wholeAppUrl).host
    if (host1 === host2) {
      const realOrigin = new URL(details.url).origin
      delete details.requestHeaders.Origin
      delete details.requestHeaders.origin
      details.requestHeaders.Origin = realOrigin
    }
    */
    callback({ cancel: false, requestHeaders: details.requestHeaders })
  })
  ses.webRequest.onHeadersReceived(
    // { urls: ['https://api.duckduckgo.com/*', 'https://ac.duckduckgo.com/*'] },
    { urls: ['*://*/*'] },
    (details, callback) => {
      let allowOrigin = []
      for (const key in details.responseHeaders) {
        if (key.toLowerCase() === 'access-control-allow-origin') {
          allowOrigin = Array.from(details.responseHeaders[key])
          delete details.responseHeaders[key]
        }
      }
      if (details.webContentsId === global.mainWin.webContents.id) {
        details.responseHeaders['Access-Control-Allow-Origin'] = ['*']
      } else {
        details.responseHeaders['Access-Control-Allow-Origin'] = allowOrigin
      }
      callback({ cancel: false, responseHeaders: details.responseHeaders })
    },
  )
  /*
  ses.webRequest.onHeadersReceived({ urls: ['https:'] }, (details, callback) => {
    for (const key in details.responseHeaders) {
      if (key.toLowerCase() === 'access-control-allow-origin') {
        delete details.responseHeaders[key]
      }
    }
    details.responseHeaders['Access-Control-Allow-Origin'] = ['*']
    callback({ cancel: false, responseHeaders: details.responseHeaders })
  })
  */
  ses.webRequest.onBeforeRequest(
    handleRequest as (
      details: Electron.OnBeforeRequestListenerDetails,
      callback: (response: Electron.CallbackResponse) => void,
    ) => void,
  )
}

export const initFiltering = () => {
  setInterval(() => {
    if (unsavedBlockedRequests > 0) {
      let current = settings.get('filteringBlockedCount')
      if (!current) {
        current = 0
      }
      settings.set('filteringBlockedCount', current + unsavedBlockedRequests)
      unsavedBlockedRequests = 0
    }
  }, 60000)

  /*
  app.whenReady().then(() => {
    app.on('session-created', (ses) => {
      registerFiltering(ses)
    })
    registerFiltering(session.defaultSession)
  })
  */

  settings.listen('filtering', (value) => {
    // migrate from old settings (<v1.9.0)
    if (value && typeof value.trackers === 'boolean') {
      if (value.trackers === true) {
        value.blockingLevel = 2
      } else if (value.trackers === false) {
        value.blockingLevel = 0
      }
      delete value.trackers
      settings.set('filtering', value)
    }

    setFilteringSettings(value)
  })
}
