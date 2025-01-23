/* provides helper functions for using localized strings */

import enUS from './languages/en-US'
import zhCN from './languages/zh-CN'

const languages = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

/*
translations are compiled into here by running "npm run build" in this format

var languages = {
    en-US: {name: "English (United States), identifier: "en-US", translations: {...}}
}

*/
const isInWeb = () => {
  if (typeof process === 'undefined' || !process) {
    return true
  }
  return process.type === 'renderer'
}
function getCurrentLanguage() {
  // TODO add a setting to change the language to something other than the default

  let language = 'en-US' // default

  if (isInWeb()) {
    // renderer process
    language = navigator.language
  } else {
    language = 'en-US'
  }

  return language
}

let userLanguage = ''

export function l(stringId: string) {
  if (!userLanguage) {
    userLanguage = getCurrentLanguage()
  }

  const userBaseLanguage = userLanguage.split('-')[0] // examples: es-419 -> es, nl-BE -> nl

  // get the translated string for the given ID

  // try an exact match for the user language
  if (
    languages[userLanguage] &&
    languages[userLanguage].translations[stringId] &&
    languages[userLanguage].translations[stringId].unsafeHTML !== null
  ) {
    return languages[userLanguage].translations[stringId]
    // try a match for the base language, if the language code is for a particular region
  }
  if (
    languages[userBaseLanguage] &&
    languages[userBaseLanguage].translations[stringId] &&
    languages[userBaseLanguage].translations[stringId].unsafeHTML !== null
  ) {
    return languages[userBaseLanguage].translations[stringId]
  }
  // fallback to en-US
  return languages['en-US'].translations[stringId]
}

/* for static HTML pages
insert a localized string into all elements with a [data-string] attribute
set the correct attributes for all elements with a [data-label] attribute
set the value attribute for all elements with a [data-value] attribute
 */
export const initLocalizationHelpers = () => {
  if (typeof document !== 'undefined') {
    if (languages[getCurrentLanguage()] && languages[getCurrentLanguage()].rtl) {
      document.body.classList.add('rtl')
    }

    document.querySelectorAll('[data-string]').forEach((el) => {
      const str = l(el.getAttribute('data-string'))
      if (typeof str === 'string') {
        el.textContent = str
      } else if (str && str.unsafeHTML && el.hasAttribute('data-allowHTML')) {
        el.innerHTML = str.unsafeHTML
      }
    })
    document.querySelectorAll('[data-label]').forEach((el) => {
      const str = l(el.getAttribute('data-label'))
      if (typeof str === 'string') {
        el.setAttribute('title', str)
        el.setAttribute('aria-label', str)
      } else {
        throw new Error(`invalid data-label value: ${str}`)
      }
    })
    document.querySelectorAll('[data-value]').forEach((el) => {
      const str = l(el.getAttribute('data-value'))
      if (typeof str === 'string') {
        el.setAttribute('value', str)
      } else {
        throw new Error(`invalid data-value value: ${str}`)
      }
    })
  }
}
/*
if (typeof window !== 'undefined') {
  window.l = l
  window.userLanguage = userLanguage
  window.getCurrentLanguage = getCurrentLanguage
}
*/
