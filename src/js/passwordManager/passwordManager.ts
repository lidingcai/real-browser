import { ipcRenderer } from 'electron'

import { l } from '../../locales/index'
// const keybindings = require('keybindings.js')
import * as keybindings from '../keybindings'
// const statistics = require('js/statistics.js')
import { statistics } from '../statistics'
import { settings } from '../util/settings/settings.js'
// const webviews = require('webviews.js')
import { webviews } from '../webviews.js'
// const Bitwarden = require('js/passwordManager/bitwarden.js')
import { Bitwarden } from './bitwarden'
// const Keychain = require('js/passwordManager/keychain.js')
import { Keychain } from './keychain'
// const OnePassword = require('js/passwordManager/onePassword.js')
import { OnePassword } from './onePassword'

export const PasswordManagers = {
  // List of supported password managers. Each password manager is expected to
  // have getSuggestions(domain) method that returns a Promise with credentials
  // suggestions matching given domain name.
  managers: [] as (Bitwarden | Keychain | OnePassword)[],
  // Returns an active password manager, which is the one that is selected in app's
  // settings.
  getActivePasswordManager() {
    if (PasswordManagers.managers.length === 0) {
      return null
    }

    const managerSetting = settings.get('passwordManager')
    if (managerSetting == null) {
      return PasswordManagers.managers.find((mgr) => mgr.name === 'Built-in password manager')
    }

    return PasswordManagers.managers.find((mgr) => mgr.name === managerSetting.name)
  },
  async getConfiguredPasswordManager() {
    const manager = PasswordManagers.getActivePasswordManager()
    if (!manager) {
      return null
    }

    const configured = await manager.checkIfConfigured()
    if (!configured) {
      return null
    }

    return manager
  },
  // Shows a prompt dialog for password store's master password.
  async promptForMasterPassword(manager: Bitwarden | OnePassword | Keychain) {
    return new Promise((resolve, reject) => {
      const { password } = ipcRenderer.sendSync('prompt', {
        text: l('passwordManagerUnlock').replace('%p', manager.name),
        values: [{ placeholder: l('password'), id: 'password', type: 'password' }],
        ok: l('dialogConfirmButton'),
        cancel: l('dialogSkipButton'),
        height: 175,
      })
      if (password === null || password === '') {
        reject(new Error('No password provided'))
      } else {
        resolve(password)
      }
    })
  },
  async unlock(manager: Bitwarden | OnePassword | Keychain) {
    let success = false
    while (!success) {
      let password: string
      try {
        // eslint-disable-next-line no-await-in-loop
        password = (await PasswordManagers.promptForMasterPassword(manager)) as string
      } catch (e) {
        // dialog was canceled
        break
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        success = await (manager as Bitwarden | OnePassword).unlockStore(password)
      } catch (e) {
        // incorrect password, prompt again
      }
    }
    return success
  },
  // Binds IPC events.
  initialize() {
    this.managers = [new Bitwarden(), new OnePassword(), new Keychain()]
    // Called when page preload script detects a form with username and password.
    webviews.bindIPC('password-autofill', (tab: string, args: any, frameId: string, frameURL: string) => {
      // it's important to use frameURL here and not the tab URL, because the domain of the
      // requesting iframe may not match the domain of the top-level page
      const { hostname } = new URL(frameURL)

      PasswordManagers.getConfiguredPasswordManager().then(async (manager) => {
        if (!manager) {
          return
        }

        if (!manager.isUnlocked()) {
          await PasswordManagers.unlock(manager)
        }

        let formattedHostname = hostname
        if (formattedHostname.startsWith('www.')) {
          formattedHostname = formattedHostname.slice(4)
        }

        manager
          .getSuggestions(formattedHostname)
          .then((credentials) => {
            if (credentials != null) {
              webviews.callAsync(tab, 'sendToFrame', [
                frameId,
                'password-autofill-match',
                {
                  credentials,
                  hostname,
                },
              ])
            }
          })
          .catch((e) => {
            console.error(`Failed to get password suggestions: ${e.message}`)
          })
      })
    })

    webviews.bindIPC('password-autofill-check', (tab: string, args: any, frameId: string) => {
      if (PasswordManagers.getActivePasswordManager()) {
        webviews.callAsync(tab, 'sendToFrame', [frameId, 'password-autofill-enabled'])
      }
    })

    keybindings.defineShortcut('fillPassword', () => {
      webviews.callAsync(window.tabs.getSelected() as string, 'send', ['password-autofill-shortcut'])
    })

    statistics.registerGetter('passwordManager', () => {
      return PasswordManagers.getActivePasswordManager()!.name
    })
  },
}

// module.exports = PasswordManagers
