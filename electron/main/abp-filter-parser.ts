/* eslint-disable no-labels */
/* eslint-disable no-underscore-dangle */
const elementTypes = [
  'script',
  'image',
  'stylesheet',
  'object',
  'xmlhttprequest',
  'object-subrequest',
  'subdocument',
  'ping',
  'websocket',
  'webrtc',
  'document',
  'elemhide',
  'generichide',
  'genericblock',
  'popup',
  'other',
]

const elementTypesSet = {
  script: 1,
  image: 2,
  stylesheet: 4,
  object: 8,
  xmlhttprequest: 16,
  'object-subrequest': 32,
  subdocument: 64,
  ping: 128,
  websocket: 256,
  webrtc: 512,
  document: 1024,
  elemhide: 2048,
  generichide: 4096,
  genericblock: 8192,
  popup: 16384,
  other: 32768,
}
const allElementTypes = 65535
/*
https://help.eyeo.com/en/adblockplus/how-to-write-filters#options
"Filters will not block pop-ups by default, only if the $popup type option is specified."
*/
// eslint-disable-next-line no-bitwise
const defaultElementTypes = allElementTypes & ~elementTypesSet.popup

const separatorCharacters = ':?/=^'

/**
 * Finds the first separator character in the input string
 */
function findFirstSeparatorChar(input: string | any[], startPos: number) {
  for (let i = startPos, len = input.length; i < len; i++) {
    if (separatorCharacters.indexOf(input[i]) !== -1) {
      return i
    }
  }
  return -1
}

/**
 * Obtains the domain index of the input filter line
 */
function getDomainIndex(input: string | string[]) {
  let index = input.indexOf(':') + 1
  while (input[index] === '/') {
    index++
  }
  return index
}

export function getUrlHost(input: string) {
  const domainIndexStart = getDomainIndex(input)
  let domainIndexEnd = findFirstSeparatorChar(input, domainIndexStart)
  if (domainIndexEnd === -1) {
    domainIndexEnd = input.length
  }
  return input.substring(domainIndexStart, domainIndexEnd)
}

export function isSameOriginHost(baseContextHost: string | any[], testHost: string | any[]) {
  /*
  TODO only the base domain should be considered (so 'www.example.com' and 'a.example.com' should be same origin)
  But enforcing this reduces performance too much, so we only perform a simpler check that doesn't handle this case instead.
  */

  if (testHost.slice(-baseContextHost.length) === baseContextHost) {
    const c = testHost[testHost.length - baseContextHost.length - 1]
    return c === '.' || c === undefined
  }
  return false
}

/**
 * Parses the domain string and fills in options.
 */

function parseDomains(
  input: string,
  options: { elementTypes?: number; thirdParty?: boolean; notThirdParty?: boolean; domains?: any; skipDomains?: any },
) {
  const domains = input.split('|')
  const matchDomains = []
  const skipDomains = []
  for (let i = 0; i < domains.length; i++) {
    if (domains[i][0] === '~') {
      skipDomains.push(domains[i].substring(1))
    } else {
      matchDomains.push(domains[i])
    }
  }
  if (matchDomains.length !== 0) {
    options.domains = matchDomains
  }
  if (skipDomains.length !== 0) {
    options.skipDomains = skipDomains
  }
}

/**
 * Parses options from the passed in input string
 */

function parseOptions(input: string) {
  const output: { elementTypes?: number; thirdParty?: boolean; notThirdParty?: boolean } = {}
  let hasValidOptions = false

  input.split(',').forEach((option: string) => {
    if (option.startsWith('domain=')) {
      const domainString = option.split('=')[1].trim()
      parseDomains(domainString, output)
      hasValidOptions = true
    } else {
      /*
      Element types are stored as an int, where each bit is a type (see elementTypesSet)
      1 -> the filter should match for this element type
      If the filter defines a type to skip, then all other types should implicitly match
      If it defines types to match, all other types should implicitly not match
      */

      // the option is an element type to skip
      if (option[0] === '~' && elementTypes.indexOf(option.substring(1)) !== -1) {
        if (output.elementTypes === undefined) {
          output.elementTypes = defaultElementTypes
        }
        // eslint-disable-next-line no-bitwise
        output.elementTypes &= ~elementTypesSet[option.substring(1)]
        hasValidOptions = true

        // the option is an element type to match
      } else if (elementTypes.indexOf(option) !== -1) {
        // eslint-disable-next-line no-bitwise
        output.elementTypes = (output.elementTypes || 0) | elementTypesSet[option]
        hasValidOptions = true
      }

      if (option === 'third-party') {
        output.thirdParty = true
        hasValidOptions = true
      }

      if (option === '~third-party') {
        output.notThirdParty = true
        hasValidOptions = true
      }
    }
  })

  if (hasValidOptions) {
    return output
  }
  return null
}

class Trie {
  data: { _d?: any } = {}

  /* creates a trie */
  constructor() {
    this.data = {}
  }

  /* adds a string to the trie */
  add(string: string | any[], stringData: any, mergeFn: (arg0: any, arg1: any) => any) {
    let { data } = this

    for (let i = 0, len = string.length; i < len; i++) {
      const char = string[i]

      if (!data[char]) {
        data[char] = {}
      }

      data = data[char]
    }
    if (data._d) {
      let mergeResult: any
      if (mergeFn) {
        for (let n = 0; n < data._d.length; n++) {
          mergeResult = mergeFn(data._d[n], stringData)
          if (mergeResult) {
            data._d[n] = mergeResult
            break
          }
        }
      }
      if (!mergeResult) {
        data._d.push(stringData)
      }
    } else {
      data._d = [stringData]
    }
  }

  /* adds a string to the trie in reverse order */
  addReverse(string: string | any[], stringData: any) {
    let { data } = this

    for (let i = string.length - 1; i >= 0; i--) {
      const char = string[i]

      if (!data[char]) {
        data[char] = {}
      }

      data = data[char]
    }
    if (data._d) {
      data._d.push(stringData)
    } else {
      data._d = [stringData]
    }
  }

  /* finds all strings added to the trie that are a substring of the input string */
  getSubstringsOf(string: string | any[]) {
    const root = this.data
    let substrings = []
    // loop through each character in the string

    outer: for (let i = 0; i < string.length; i++) {
      let data = root[string[i]]
      if (!data) {
        continue
      }
      if (data._d) {
        substrings = substrings.concat(data._d)
      }
      for (let x = i + 1; x < string.length; x++) {
        const char = string[x]
        if (data[char]) {
          data = data[char]
          if (data._d) {
            substrings = substrings.concat(data._d)
          }
        } else {
          continue outer
        }
      }
    }

    return substrings
  }

  /* find all strings added to the trie that are located at the beginning of the input string */
  getStartingSubstringsOf(string: string | any[]) {
    let substrings = []
    // loop through each character in the string

    let data = this.data[string[0]]
    if (!data) {
      return substrings
    }
    for (let i = 1; i < string.length; i++) {
      data = data[string[i]]
      if (!data) {
        break
      }
      if (data._d) {
        substrings = substrings.concat(data._d)
      }
    }

    return substrings
  }

  /* finds all strings within the trie that are located at the end of the input string.
only works if all strings have been added to the trie with addReverse () */
  getEndingSubstringsOfReversed(string: string | any[]) {
    let substrings = []
    // loop through each character in the string

    let data = this.data[string[string.length - 1]]
    if (!data) {
      return substrings
    }
    for (let i = string.length - 2; i >= 0; i--) {
      data = data[string[i]]
      if (!data) {
        break
      }
      if (data._d) {
        substrings = substrings.concat(data._d)
      }
    }

    return substrings
  }
}

function parseFilter(
  input: string,
  parsedFilterData: {
    isException?: any
    options?: any
    regex?: any
    hostAnchored?: any
    host?: any
    data?: any
    leftAnchored?: any
    rightAnchored?: any
    wildcardMatchParts?: any
  },
) {
  input = input.trim().toLowerCase()

  let len = input.length

  // Check for comment or nothing
  if (len === 0) {
    return false
  }

  // Check for comments
  if (input[0] === '[' || input[0] === '!') {
    return false
  }

  let beginIndex = 0

  // Check for exception instead of filter
  if (input[0] === '@' && input[1] === '@') {
    parsedFilterData.isException = true
    beginIndex = 2
  }

  // Check for element hiding rules
  let index = input.indexOf('#', beginIndex)
  if (index !== -1 && (input[index + 1] === '#' || input[index + 1] === '@' || input[index + 1] === '?')) {
    return false
  }

  // Check for options, regex can have options too so check this before regex
  index = input.lastIndexOf('$')
  if (index !== -1) {
    const options = parseOptions(input.substring(index + 1))
    if (options) {
      // if there are no valid options, we shouldn't do any of this, because the $ sign can also be part of the main filter part
      // example: https://github.com/easylist/easylist/commit/1bcf25d782de073764bf122a8dffec785434d8cc
      parsedFilterData.options = options
      // Get rid of the trailing options for the rest of the parsing
      input = input.substring(0, index)
      len = index
    }
  }

  // Check for a regex
  if (input[beginIndex] === '/' && input[len - 1] === '/' && beginIndex !== len - 1) {
    parsedFilterData.regex = new RegExp(input.substring(1, input.length - 1))
    return true
  }

  // Check if there's some kind of anchoring
  if (input[beginIndex] === '|') {
    // Check for an anchored domain name
    if (input[beginIndex + 1] === '|') {
      parsedFilterData.hostAnchored = true
      let indexOfSep = findFirstSeparatorChar(input, beginIndex + 1)
      if (indexOfSep === -1) {
        indexOfSep = len
      }
      beginIndex += 2
      parsedFilterData.host = input.substring(beginIndex, indexOfSep)
      parsedFilterData.data = input.substring(beginIndex)
    } else {
      parsedFilterData.leftAnchored = true
      beginIndex++
      parsedFilterData.data = input.substring(beginIndex)
    }
  }
  if (input[len - 1] === '|') {
    parsedFilterData.rightAnchored = true
    input = input.substring(0, len - 1)
    parsedFilterData.data = input.substring(beginIndex)
  }

  // for nonAnchoredString and wildcard filters

  if (!parsedFilterData.data) {
    if (input.indexOf('*') === -1) {
      parsedFilterData.data = input.substring(beginIndex)
    } else {
      parsedFilterData.wildcardMatchParts = input.split('*')
    }
  }

  return true
}

/**
 * Similar to str1.indexOf(filter, startingPos) but with
 * extra consideration to some ABP filter rules like ^.
 */

const filterArrCache = {}
function indexOfFilter(input: string | any[], filter: string, startingPos: number) {
  if (filter.indexOf('^') === -1) {
    // no separator characters, no need to do the rest of the parsing
    return input.indexOf(filter, startingPos)
  }
  let filterParts: string | any[]
  if (filterArrCache[filter]) {
    filterParts = filterArrCache[filter]
  } else {
    filterParts = filter.split('^')
    filterArrCache[filter] = filterParts
  }
  let index = startingPos
  let beginIndex = -1
  let prefixedSeparatorChar = false

  let f = 0
  let part: string

  for (f = 0; f < filterParts.length; f++) {
    part = filterParts[f]

    if (part === '') {
      prefixedSeparatorChar = true
      continue
    }

    index = input.indexOf(part, index)
    if (index === -1) {
      return -1
    }
    if (beginIndex === -1) {
      beginIndex = index
    }

    if (prefixedSeparatorChar) {
      if (separatorCharacters.indexOf(input[index - 1]) === -1) {
        return -1
      }
    }
    // If we are in an in between filterPart
    if (
      f + 1 < filterParts.length &&
      // and we have some chars left in the input past the last filter match
      input.length > index + part.length
    ) {
      if (separatorCharacters.indexOf(input[index + part.length]) === -1) {
        return -1
      }
    }

    prefixedSeparatorChar = false
  }
  return beginIndex
}

function matchWildcard(input: any, filter: { wildcardMatchParts: any }) {
  let index = 0
  for (const part of filter.wildcardMatchParts) {
    const newIndex = indexOfFilter(input, part, index)
    if (newIndex === -1) {
      return false
    }
    index = newIndex + part.length
  }
  return true
}

// Determines if there's a match based on the options, this doesn't
// mean that the filter rule shoudl be accepted, just that the filter rule
// should be considered given the current context.
// By specifying context params, you can filter out the number of rules which are
// considered.
function matchOptions(
  filterOptions: { elementTypes: any; thirdParty: any; notThirdParty: any; skipDomains: any[]; domains: any[] },
  input: any,
  contextParams: { elementType: string | number; domain: any },
  currentHost: any,
) {
  if (
    // eslint-disable-next-line no-bitwise
    (((filterOptions && filterOptions.elementTypes) || defaultElementTypes) &
      elementTypesSet[contextParams.elementType]) ===
    0
  ) {
    return false
  }

  if (!filterOptions) {
    return true
  }

  // Domain option check
  if (contextParams.domain !== undefined) {
    /*
    subdomains are also considered "same origin hosts" for the purposes of thirdParty and domain list checks
    see https://adblockplus.org/filter-cheatsheet#options:
    "The page loading it comes from example.com domain (for example example.com itself or subdomain.example.com) but not from foo.example.com or its subdomains"

    Additionally, subdomain matches are bidrectional, i.e. a request for "a.b.com" on "b.com" and a request for "b.com" on "a.b.com" are both first-party
    */

    if (
      filterOptions.thirdParty &&
      (isSameOriginHost(contextParams.domain, currentHost) || isSameOriginHost(currentHost, contextParams.domain))
    ) {
      return false
    }

    if (
      filterOptions.notThirdParty &&
      !(isSameOriginHost(contextParams.domain, currentHost) || isSameOriginHost(currentHost, contextParams.domain))
    ) {
      return false
    }

    if (
      filterOptions.skipDomains &&
      filterOptions.skipDomains.some((skipDomain: any) => isSameOriginHost(skipDomain, contextParams.domain))
    ) {
      return false
    }

    if (
      filterOptions.domains &&
      !filterOptions.domains.some((domain: any) => isSameOriginHost(domain, contextParams.domain))
    ) {
      return false
    }
  } else if (filterOptions.domains || filterOptions.skipDomains) {
    return false
  }

  return true
}

// easylist includes many filters with the same data and set of options, but that apply to different domains
// as long as all the options except the domain list are the same, they can be merged
// this is currently only used for leftAnchored, since that seems to be the only place where it makes a difference
// note: must add check here when adding support for new options
function maybeMergeDuplicateOptions(
  opt1: { elementTypes: any; thirdParty: any; notThirdParty: any; domains: string | any[]; skipDomains: any },
  opt2: { elementTypes: any; thirdParty: any; notThirdParty: any; domains: any; skipDomains: any },
) {
  if (opt1 === opt2) {
    return opt1
  }
  if (!opt1 || !opt2) {
    return null
  }
  if (
    opt1.elementTypes === opt2.elementTypes &&
    opt1.thirdParty === opt2.thirdParty &&
    opt1.notThirdParty === opt2.notThirdParty
  ) {
    if (opt1.domains && opt2.domains && !opt1.skipDomains && !opt2.skipDomains) {
      opt1.domains = opt1.domains.concat(opt2.domains)
      return opt1
    }
  }
  return null
}

/**
 * Parses the set of filter rules and fills in parserData
 * @param input filter rules
 * @param parserData out parameter which will be filled
 *   with the filters, exceptionFilters and htmlRuleFilters.
 */

export function parse(
  input: string,
  parserData: { [x: string]: any; exceptionFilters?: { [x: string]: any }; initialized?: boolean },
  callback: () => void,
  options: { async?: boolean } = {},
) {
  const arrayFilterCategories = ['regex', 'bothAnchored']
  const objectFilterCategories = ['hostAnchored']
  const trieFilterCategories = ['nonAnchoredString', 'leftAnchored', 'rightAnchored']

  parserData.exceptionFilters = parserData.exceptionFilters || {}
  let i
  for (i = 0; i < arrayFilterCategories.length; i++) {
    parserData[arrayFilterCategories[i]] = parserData[arrayFilterCategories[i]] || []
    parserData.exceptionFilters[arrayFilterCategories[i]] = parserData.exceptionFilters[arrayFilterCategories[i]] || []
  }

  for (i = 0; i < objectFilterCategories.length; i++) {
    parserData[objectFilterCategories[i]] = parserData[objectFilterCategories[i]] || {}
    parserData.exceptionFilters[objectFilterCategories[i]] =
      parserData.exceptionFilters[objectFilterCategories[i]] || {}
  }

  for (i = 0; i < trieFilterCategories.length; i++) {
    parserData[trieFilterCategories[i]] = parserData[trieFilterCategories[i]] || new Trie()
    parserData.exceptionFilters[trieFilterCategories[i]] =
      parserData.exceptionFilters[trieFilterCategories[i]] || new Trie()
  }

  const filters = input.split('\n')

  function processChunk(start: number, end: number) {
    for (let i = start, len = end; i < len; i++) {
      const filter = filters[i]
      if (!filter) {
        continue
      }

      const parsedFilterData: any = {}

      /*
      let object: {
        bothAnchored: {}[]
        leftAnchored: { add: (arg0: any, arg1: any, arg2: (opt1: any, opt2: any) => any) => void }
        rightAnchored: { addReverse: (arg0: any, arg1: any) => void }
        hostAnchored: { [x: string]: {}[] }
        regex: {}[]
        nonAnchoredString: { add: (arg0: string, arg1: {}) => void }
      }
      */
      let object: any
      if (parseFilter(filter, parsedFilterData)) {
        if (parsedFilterData.isException) {
          object = parserData.exceptionFilters
        } else {
          object = parserData
        }

        // add the filters to the appropriate category
        if (parsedFilterData.leftAnchored) {
          if (parsedFilterData.rightAnchored) {
            object.bothAnchored.push(parsedFilterData)
          } else {
            object.leftAnchored.add(parsedFilterData.data, parsedFilterData.options, maybeMergeDuplicateOptions)
          }
        } else if (parsedFilterData.rightAnchored) {
          object.rightAnchored.addReverse(parsedFilterData.data, parsedFilterData.options)
        } else if (parsedFilterData.hostAnchored) {
          /* add the filters to the object based on the last 6 characters of their domain.
            Domains can be just 5 characters long: the TLD is at least 2 characters,
            the . character adds one more character, and the domain name must be at least two
            characters long. However, slicing the last 6 characters of a 5-character string
            will give us the 5 available characters; we can then check for both a
            5-character and a 6-character match in matchesFilters. By storing the last
            characters in an object, we can skip checking whether every filter's domain
            is from the same origin as the URL we are checking. Instead, we can just get
            the last characters of the URL to check, get the filters stored in that
            property of the object, and then check if the complete domains match.
           */
          const ending = parsedFilterData.host.slice(-6)

          if (object.hostAnchored[ending]) {
            object.hostAnchored[ending].push(parsedFilterData)
          } else {
            object.hostAnchored[ending] = [parsedFilterData]
          }
        } else if (parsedFilterData.regex) {
          object.regex.push(parsedFilterData)
        } else if (parsedFilterData.wildcardMatchParts) {
          let wildcardToken = parsedFilterData.wildcardMatchParts[0].split('^')[0].substring(0, 10)
          if (wildcardToken.length < 4) {
            const wildcardToken2 = parsedFilterData.wildcardMatchParts[1].split('^')[0].substring(0, 10)
            if (wildcardToken2 && wildcardToken2.length > wildcardToken.length) {
              wildcardToken = wildcardToken2
            }
          }
          if (wildcardToken) {
            object.nonAnchoredString.add(wildcardToken, parsedFilterData)
          } else {
            object.nonAnchoredString.add('', parsedFilterData)
          }
        } else {
          object.nonAnchoredString.add(parsedFilterData.data.split('^')[0].substring(0, 10), parsedFilterData)
        }
      }
    }
  }

  if (options.async === false) {
    processChunk(0, filters.length)
    parserData.initialized = true
  } else {
    /* parse filters in chunks to prevent the main process from freezing */

    const filtersLength = filters.length
    let lastFilterIdx = 0
    let nextChunkSize = 1500
    const targetMsPerChunk = 12

    const nextChunk = () => {
      const t1 = Date.now()
      processChunk(lastFilterIdx, lastFilterIdx + nextChunkSize)
      const t2 = Date.now()

      lastFilterIdx += nextChunkSize

      if (t2 - t1 !== 0) {
        nextChunkSize = Math.round(nextChunkSize / ((t2 - t1) / targetMsPerChunk))
      }

      if (lastFilterIdx < filtersLength) {
        setTimeout(nextChunk, 16)
      } else {
        parserData.initialized = true

        if (callback) {
          callback()
        }
      }
    }

    nextChunk()
  }
}

export function matchesFilters(
  filters: {
    leftAnchored: { getStartingSubstringsOf: (arg0: any) => any }
    rightAnchored: { getEndingSubstringsOfReversed: (arg0: any) => any }
    bothAnchored: string | any[]
    hostAnchored: { [x: string]: any }
    nonAnchoredString: { getSubstringsOf: (arg0: any) => any }
  },
  input: any,
  contextParams: any,
) {
  const currentHost = getUrlHost(input)

  let i: number
  let len: number
  let filter: { host: any; data: any; options: any; wildcardMatchParts: any }

  // check if the string matches a left anchored filter

  const leftAnchoredMatches = filters.leftAnchored.getStartingSubstringsOf(input)
  if (leftAnchoredMatches.length !== 0) {
    len = leftAnchoredMatches.length
    for (i = 0; i < len; i++) {
      if (matchOptions(leftAnchoredMatches[i], input, contextParams, currentHost)) {
        return true
      }
    }
  }

  // check if the string matches a right anchored filter

  const rightAnchoredMatches = filters.rightAnchored.getEndingSubstringsOfReversed(input)
  if (rightAnchoredMatches.length !== 0) {
    len = rightAnchoredMatches.length
    for (i = 0; i < len; i++) {
      if (matchOptions(rightAnchoredMatches[i], input, contextParams, currentHost)) {
        return true
      }
    }
  }

  // check if the string matches a filter with both anchors

  for (i = 0, len = filters.bothAnchored.length; i < len; i++) {
    if (
      filters.bothAnchored[i].data === input &&
      matchOptions(filters.bothAnchored[i].options, input, contextParams, currentHost)
    ) {
      // console.log(filter, 3)

      return true
    }
  }

  // get all of the host anchored filters with the same domain ending as the current domain
  const hostFiltersLong = filters.hostAnchored[currentHost.slice(-6)]
  const hostFiltersShort = filters.hostAnchored[currentHost.slice(-5)]

  let hostFiltersToCheck = []
  if (hostFiltersLong) {
    hostFiltersToCheck = hostFiltersToCheck.concat(hostFiltersLong)
  }
  if (hostFiltersShort) {
    hostFiltersToCheck = hostFiltersToCheck.concat(hostFiltersShort)
  }

  if (hostFiltersToCheck) {
    // check if the string matches a domain name anchored filter

    for (i = 0, len = hostFiltersToCheck.length; i < len; i++) {
      filter = hostFiltersToCheck[i]

      if (
        isSameOriginHost(filter.host, currentHost) &&
        indexOfFilter(input, filter.data, 0) !== -1 &&
        matchOptions(filter.options, input, contextParams, currentHost)
      ) {
        // console.log(filter, 4)

        return true
      }
    }
  }

  // check if the string matches a string filter

  const nonAnchoredStringMatches = filters.nonAnchoredString.getSubstringsOf(input)

  if (nonAnchoredStringMatches.length !== 0) {
    len = nonAnchoredStringMatches.length

    for (i = 0; i < len; i++) {
      filter = nonAnchoredStringMatches[i]
      let matches: boolean
      if (filter.wildcardMatchParts) {
        matches = matchWildcard(input, filter)
      } else {
        matches = indexOfFilter(input, filter.data, 0) !== -1
      }
      if (matches && matchOptions(nonAnchoredStringMatches[i].options, input, contextParams, currentHost)) {
        // console.log(nonAnchoredStringMatches[i], 5)
        return true
      }
    }
  }

  // no filters matched
  return false
}

export function matches(
  filters: {
    initialized?: any
    exceptionFilters?: any
    leftAnchored: { getStartingSubstringsOf: (arg0: any) => any }
    rightAnchored: { getEndingSubstringsOfReversed: (arg0: any) => any }
    bothAnchored: string | any[]
    hostAnchored: { [x: string]: any }
    nonAnchoredString: { getSubstringsOf: (arg0: any) => any }
  },
  input: string,
  contextParams: any,
) {
  if (!filters.initialized) {
    return false
  }
  if (
    matchesFilters(filters, input.toLowerCase(), contextParams) &&
    !matchesFilters(filters.exceptionFilters, input.toLowerCase(), contextParams)
  ) {
    return true
  }
  return false
}
