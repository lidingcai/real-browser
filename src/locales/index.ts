import { createI18n } from 'vue-i18n'

import enUS from './lang/en-US'
import zhCN from './lang/zh-CN'

export const messages:Record<string,any> = {
  'en-US': enUS,
  'zh-CN': zhCN,
}

export const i18n = createI18n({
  legacy: false,
  locale: 'zh_CN',
  fallbackLocale: 'zh_CN',
  messages,
  globalInjection: true,
})
export const getCurrentLanguage = () => {
  let lang = navigator.language
  const baseLang = lang.split('-')[0]
  if (baseLang === 'en') {
    lang = 'en-US'
  } else if (baseLang === 'zh') {
    lang = 'zh-CN'
  } else {
    lang = 'en-US'
  }
  return lang
}
export const lang = getCurrentLanguage()
export const l = (stringId: string): string => {
  if (!messages[lang] || !messages[lang][stringId]) return stringId
  return messages[lang][stringId]
}
export const initDocumentLang = () => {
  if (typeof document !== 'undefined') {
    /*
    if (languages[getCurrentLanguage()] && languages[getCurrentLanguage()].rtl) {
      document.body.classList.add('rtl')
    }
    */

    document.querySelectorAll('[data-string]').forEach((el) => {
      const str = l(el.getAttribute('data-string')!)
      if (typeof str === 'string') {
        el.textContent = str
      }
      // else if (str && str.unsafeHTML && el.hasAttribute('data-allowHTML')) {
      // el.innerHTML = str.unsafeHTML
      // }
    })
    document.querySelectorAll('[data-label]').forEach((el) => {
      const str = l(el.getAttribute('data-label')!)
      if (typeof str === 'string') {
        el.setAttribute('title', str)
        el.setAttribute('aria-label', str)
      } else {
        throw new Error(`invalid data-label value: ${str}`)
      }
    })
    document.querySelectorAll('[data-value]').forEach((el) => {
      const str = l(el.getAttribute('data-value')!)
      if (typeof str === 'string') {
        el.setAttribute('value', str)
      } else {
        throw new Error(`invalid data-value value: ${str}`)
      }
    })
  }
}
