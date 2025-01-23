// const setupDialog = require('passwordManager/managerSetup.js')
import { Bitwarden } from './passwordManager/bitwarden'
import { Keychain } from './passwordManager/keychain'
import { setupDialog } from './passwordManager/managerSetup'
import { OnePassword } from './passwordManager/onePassword'
// const PasswordManagers = require('passwordManager/passwordManager.js')
import { PasswordManagers } from './passwordManager/passwordManager'
// const settings = require('util/settings/settings.js')
import { settings } from './util/settings/settings'

type PasswordManagerType = Bitwarden | Keychain | OnePassword
export const AutofillSetup = {
  checkSettings() {
    const manager = PasswordManagers.getActivePasswordManager()
    if (!manager) {
      return
    }

    manager
      .checkIfConfigured()
      .then((configured) => {
        if (!configured) {
          setupDialog.show(manager)
        }
      })
      .catch((err) => {
        console.error(err)
      })
  },
  initialize() {
    settings.listen('passwordManager', (manager: PasswordManagerType) => {
      if (manager) {
        // Trigger the check on browser launch and after manager is enabled
        AutofillSetup.checkSettings()
      }
    })
  },
}

// module.exports = AutofillSetup
