/*
const modules = [
  'dist/localization.build.js',
  'main/windowManagement.js',
  'main/menu.js',
  'main/touchbar.js',
  'main/registryConfig.js',
  'main/main.js',
  'js/util/settings/settingsMain.js',
  'main/filtering.js',
  'main/viewManager.js',
  'main/download.js',
  'main/UASwitcher.js',
  'main/permissionManager.js',
  'main/prompt.js',
  'main/remoteMenu.js',
  'main/remoteActions.js',
  'main/keychainService.js',
  'js/util/proxy.js',
  'main/themeMain.js'
]
const modules = [
  'dist/localization.build.js',
  'main/windowManagement.js',
  'main/menu.js',
  'main/touchbar.js',
  'main/registryConfig.js',
  'main/main.js',
  'main/minInternalProtocol.js',
  'js/util/settings/settingsMain.js',
  'main/filtering.js',
  'main/viewManager.js',
  'main/download.js',
  'main/UASwitcher.js',
  'main/permissionManager.js',
  'main/prompt.js',
  'main/remoteMenu.js',
  'main/remoteActions.js',
  'main/keychainService.js',
  'js/util/proxy.js',
  'main/themeMain.js'
]
*/
// import { initLocalization } from '../../localization.build'

// initLocalization()
// import { windows } from "./windowManagement.js";
// import { buildAppMenu, createDockMenu } from "./menu.js";
// import { buildTouchBar } from './touchbar'

// global.buildTouchBar = buildTouchBar
/*
  import {
    regedit,
    installPath,
    keysToCreate,
    registryConfig,
    registryInstaller,
  } from "./registryConfig.js";
  */
// import { initLocalizationHelpers } from '../../src/locales/localizationHelpers'

// initLocalizationHelpers()

import { settings } from './settingsMain'

settings.initialize()

import { initMain } from './main'

initMain()

// filtering.js
import { initFiltering } from './filtering'

initFiltering()

import { initMinInternalProtocol } from './minInternalProtocol'

initMinInternalProtocol()

// viewManager.js
import { initViewManager } from './viewManager'

initViewManager()
// download.js
import { initDownload } from './download'

initDownload()
// UASwitcher.js
import { initUASwitcher } from './UASwitcher'

initUASwitcher()
// permissionManager.js
import { initPermissionManager } from './permissionManager'

initPermissionManager()
// prompt.js
import { initPrompt } from './prompt'

initPrompt()
// remoteMenu.js
import { initRemoteMenu } from './remoteMenu'

initRemoteMenu()
// remoteActions.js
import { initRemoteActions } from './remoteActions'

initRemoteActions()
// keychainService.js
import { initKeychainService } from './keychainService'

initKeychainService()
// proxy.js
import { initProxy } from './proxy'

initProxy()
// themeMain.js
import { initThemeMain } from './themeMain'

initThemeMain()
