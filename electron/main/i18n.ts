import { app } from 'electron'

import enUS from '../../src/locales/lang/en-US'
import zhCN from '../../src/locales/lang/zh-CN'

export const messages = {
  'en-US': enUS,
  'zh-CN': zhCN,
}

export const getCurrentLanguage = () => {
  let lang = app.getLocale()
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
