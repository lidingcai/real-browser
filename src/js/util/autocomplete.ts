// var urlParser = require('util/urlParser.js')
import { urlParser } from './urlParser'

export function autocomplete(input: HTMLInputElement, strings: string[]) {
  // if there is text after the selection, we can never autocomplete
  if (input.selectionEnd !== input.value.length) {
    return {
      valid: false,
    }
  }

  const text = input.value.substring(0, input.selectionStart as number)

  for (let i = 0; i < strings.length; i++) {
    // check if the item can be autocompleted
    if (strings[i].toLowerCase().indexOf(text.toLowerCase()) === 0) {
      input.value = text + strings[i].substring(input.selectionStart as number)
      input.setSelectionRange(text.length, strings[i].length)
      input.setAttribute('data-autocomplete', strings[i])

      return {
        valid: true,
        matchIndex: i,
      }
    }
  }
  input.removeAttribute('data-autocomplete')
  return {
    valid: false,
  }
}

// autocompletes based on a result item
// returns: 1 - the exact URL was autocompleted, 0 - the domain was autocompleted, -1: nothing was autocompleted
export function autocompleteURL(input: HTMLInputElement, url: string) {
  const urlObj = new URL(url)
  const { hostname } = urlObj

  // the different variations of the URL we can autocomplete
  const possibleAutocompletions = [
    // we start with the domain, including any non-standard ports (such as localhost:8080)
    hostname + (urlObj.port ? `:${urlObj.port}` : ''),
    // if that doesn't match, try the hostname without the www instead. The regex requires a slash at the end, so we add one, run the regex, and then remove it
    // `${hostname}/`.replace(urlParser.startingWWWRegex, '$1').replace('/', ''),
    // then try the whole URL
    urlParser.prettyURL(url),
    // then try the URL with querystring
    urlParser.basicURL(url),
    // then just try the URL with protocol
    url,
  ]

  const autocompleteResult = autocomplete(input, possibleAutocompletions)

  if (!autocompleteResult.valid) {
    return -1
  }
  if ((autocompleteResult.matchIndex as number) < 2 && urlObj.pathname !== '/') {
    return 0
  }
  return 1
}

// module.exports = { autocomplete, autocompleteURL }
