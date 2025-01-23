/*
const modules = [
  'js/preload/default.js',
  'js/preload/textExtractor.js',
  'js/preload/readerDetector.js',
  'js/preload/siteUnbreak.js',
  'js/util/settings/settingsPreload.js',
  'js/preload/passwordFill.js',
  'js/preload/translate.js',
]
*/
// import { initTemplateIndex } from './template.index'

// initTemplateIndex()

// default.js
import { initDefault } from './default'

initDefault()
// textExtractor.js
import { initTextExtractor } from './textExtractor'

initTextExtractor()
// readerDetector.js
import { initReaderDetector } from './readerDetector'

initReaderDetector()
// siteUnbreak.js
import { initSiteUnbreak } from './siteUnbreak'

initSiteUnbreak()
// settingsPreload.js
import { initSettingsPreload } from './settingsPreload'

initSettingsPreload()
// passwordFill.js
import { initPasswordFill } from './passwordFill'

initPasswordFill()
// translate.js
import { initTranslate } from './translate'

initTranslate()
