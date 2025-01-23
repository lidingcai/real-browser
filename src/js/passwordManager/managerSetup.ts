// var { ipcRenderer } = require('electron')
// var fs = require('fs')
import fs from 'node:fs'
// var path = require('path')
import path from 'node:path'

import { l } from '../../locales/index'
// var browserUI = require('browserUI.js')
import * as browserUI from '../browserUI'
// var modalMode = require('modalMode.js')
import { modalMode } from '../modalMode'
// var ProcessSpawner = require('util/process.js')
import { ProcessSpawner } from '../util/process'
// var settings = require('util/settings/settings.js')
import { settings } from '../util/settings/settings'
// var webviews = require('webviews.js')
import { webviews } from '../webviews'
import { Bitwarden } from './bitwarden'
import { Keychain } from './keychain'
import { OnePassword } from './onePassword'

type PasswordManagerType = Bitwarden | Keychain | OnePassword

/*
const dialog = document.getElementById('manager-setup-dialog')!
const primaryInstructions = document.getElementById('manager-setup-instructions-primary')!
const secondaryInstructions = document.getElementById('manager-setup-instructions-secondary')!
const dragBox = document.getElementById('manager-setup-drop-box')!
*/
export const setupDialog = {
  dialog: null as unknown as HTMLElement,
  primaryInstructions: null as unknown as HTMLElement,
  secondaryInstructions: null as unknown as HTMLElement,
  dragBox: null as unknown as HTMLElement,
  manager: null as null | PasswordManagerType,
  setupMode: null as null | string,
  installerCompletionTimeout: null as null | NodeJS.Timeout,
  show(manager: PasswordManagerType) {
    setupDialog.manager = manager
    setupDialog.setupMode = manager.getSetupMode()

    document.getElementById('manager-setup-heading')!.textContent = l('passwordManagerSetupHeading').replace(
      '%p',
      manager.name,
    )
    document.getElementById('password-manager-setup-link')!.textContent = l('passwordManagerSetupLink').replace(
      '%p',
      manager.name,
    )
    document.getElementById('password-manager-setup-link-installer')!.textContent = l(
      'passwordManagerSetupLinkInstaller',
    ).replace('%p', manager.name)

    setupDialog.dragBox.textContent = l('passwordManagerSetupDragBox')

    if (setupDialog.setupMode === 'installer') {
      setupDialog.primaryInstructions.hidden = true
      setupDialog.secondaryInstructions.hidden = false

      setupDialog.installerCompletionTimeout = setTimeout(waitForInstallerComplete, 2000)
    } else {
      setupDialog.primaryInstructions.hidden = false
      setupDialog.secondaryInstructions.hidden = true
    }

    modalMode.toggle(true, {
      onDismiss() {
        settings.set('passwordManager', null)
        setupDialog.hide()
      },
    })

    setupDialog.dialog.hidden = false
    webviews.requestPlaceholder('managerSetup')
  },
  hide() {
    setupDialog.manager = null
    setupDialog.setupMode = null
    clearTimeout(setupDialog.installerCompletionTimeout!)
    setupDialog.installerCompletionTimeout = null

    modalMode.toggle(false)
    setupDialog.dialog.hidden = true
    webviews.hidePlaceholder('managerSetup')
  },
  initialize() {
    setupDialog.dialog = document.getElementById('manager-setup-dialog')!
    setupDialog.primaryInstructions = document.getElementById('manager-setup-instructions-primary')!
    setupDialog.secondaryInstructions = document.getElementById('manager-setup-instructions-secondary')!
    setupDialog.dragBox = document.getElementById('manager-setup-drop-box')!

    document.getElementById('manager-setup-disable')!.addEventListener('click', () => {
      settings.set('passwordManager', null)
      setupDialog.hide()
    })

    document.getElementById('manager-setup-close')!.addEventListener('click', () => {
      settings.set('passwordManager', null)
      setupDialog.hide()
    })

    document.getElementById('password-manager-setup-link')!.addEventListener('click', () => {
      browserUI.addTab(
        window.tabs.add({
          url: setupDialog.manager!.getDownloadLink()!,
        }),
        { openInBackground: true },
      )
    })

    document.getElementById('password-manager-setup-link-installer')!.addEventListener('click', () => {
      browserUI.addTab(
        window.tabs.add({
          url: setupDialog.manager!.getDownloadLink()!,
        }),
        { openInBackground: true },
      )
    })

    setupDialog.dragBox.ondragover = () => {
      return false
    }

    setupDialog.dragBox.ondragleave = () => {
      return false
    }

    setupDialog.dragBox.ondragend = () => {
      return false
    }

    setupDialog.dragBox.ondrop = (e) => {
      e.preventDefault()

      if (e.dataTransfer!.files.length === 0) {
        return
      }

      setupDialog.dragBox.innerHTML = l('passwordManagerSetupInstalling')

      const filePath = e.dataTransfer!.files[0].path

      // try to filter out anything that isn't an executable (note: not 100% accurate)
      if (e.dataTransfer!.files[0].type !== '' && !e.dataTransfer!.files[0].name.endsWith('.exe')) {
        setupDialog.dragBox.innerHTML = l('passwordManagerSetupRetry')
        return
      }

      if (setupDialog.setupMode === 'installer') {
        launchInstaller(filePath, window.platformType)
      } else {
        install(filePath).then(() => {
          afterInstall('')
        })
      }

      // eslint-disable-next-line consistent-return
      return false
    }
  },
}

function waitForInstallerComplete() {
  setupDialog.manager!.checkIfConfigured().then((configured) => {
    if (configured) {
      afterInstall('')
      setupDialog.installerCompletionTimeout = null
    } else {
      setupDialog.installerCompletionTimeout = setTimeout(waitForInstallerComplete, 2000)
    }
  })
}

// Install the tool into the Min user folder.
function install(filePath: string) {
  return new Promise((resolve, reject) => {
    try {
      const toolsDir = path.join(window.globalArgs['user-data-path'], 'tools')
      if (!fs.existsSync(toolsDir)) {
        fs.mkdirSync(toolsDir)
      }

      const targetFilePath = setupDialog.manager!.getLocalPath()!
      fs.createReadStream(filePath)
        .pipe(fs.createWriteStream(targetFilePath))
        .on('finish', () => {
          fs.chmodSync(targetFilePath, '755')
          resolve(targetFilePath)
        })
        .on('error', (error) => {
          reject(error)
        })
    } catch (e) {
      reject(e)
    }
  })
}

// Launch installer file.
function launchInstaller(filePath: string, platform: string) {
  if (platform === 'mac') {
    return new ProcessSpawner('open', [filePath]).execute()
  }
  return new ProcessSpawner(filePath).execute()
}

function afterInstall(toolPath: string = '') {
  setupDialog
    .manager!.signInAndSave(toolPath)
    .then(() => {
      setupDialog.hide()
    })
    .catch((e) => {
      console.warn(e)
      if (setupDialog.setupMode === 'installer') {
        // show the dialog again
        afterInstall(toolPath) // toolPath or '' ???
      } else {
        // Cleanup after we failed.
        const targetFilePath = setupDialog.manager!.getLocalPath()
        if (fs.existsSync(targetFilePath!)) {
          fs.unlinkSync(targetFilePath!)
        }

        const message = (e.error || '').replace(/\n$/gm, '')
        setupDialog.dragBox.innerHTML = `${l('passwordManagerSetupUnlockError') + message} ${l('passwordManagerSetupRetry')}`
      }
    })
}

// setupDialog.initialize()

// module.exports = setupDialog
