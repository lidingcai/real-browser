/*
if (typeof require !== 'undefined') {
  var settings = require('util/settings.js')
}
*/
import { settings } from './settings/settings'

export const passwordManagers = {
  none: {
    name: 'none',
  },
  Bitwarden: {
    name: 'Bitwarden',
  },
  '1Password': {
    name: '1Password',
  },
  'Built-in password manager': {
    name: 'Built-in password manager',
  },
}
export const initialize = () => {
  let currentPasswordManager = null
  settings.listen('passwordManager', (value: { name: string }) => {
    if (value && value.name) {
      currentPasswordManager = value
    } else {
      currentPasswordManager = passwordManagers['Built-in password manager']
    }
  })

  window.currentPasswordManager = currentPasswordManager
}
