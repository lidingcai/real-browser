// const webviews = require('webviews.js')
// const settings = require('util/settings/settings.js')
import { l } from '../../locales/index'
import { settings } from '../util/settings/settings'
import { webviews } from '../webviews'
import { Keychain } from './keychain'
// const PasswordManagers = require('passwordManager/passwordManager.js')
import { PasswordManagers } from './passwordManager'

interface CredentialType {
  domain: string
  username: string
  password: string
}
export const passwordCapture = {
  bar: null as unknown as HTMLElement,
  description: null as unknown as HTMLElement,
  usernameInput: null as unknown as HTMLInputElement,
  passwordInput: null as unknown as HTMLInputElement,
  revealButton: null as unknown as HTMLButtonElement,
  saveButton: null as unknown as HTMLButtonElement,
  neverSaveButton: null as unknown as HTMLButtonElement,
  closeButton: null as unknown as HTMLButtonElement,
  currentDomain: '',
  barHeight: 0,
  showCaptureBar(username: string, password: string) {
    passwordCapture.description.textContent = l('passwordCaptureSavePassword').replace(
      '%s',
      passwordCapture.currentDomain,
    )
    passwordCapture.bar.hidden = false

    passwordCapture.passwordInput.type = 'password'
    passwordCapture.revealButton.classList.add('carbon:view')
    passwordCapture.revealButton.classList.remove('carbon:view-off')

    passwordCapture.usernameInput.value = username || ''
    passwordCapture.passwordInput.value = password || ''

    passwordCapture.barHeight = passwordCapture.bar.getBoundingClientRect().height
    webviews.adjustMargin([passwordCapture.barHeight, 0, 0, 0])
  },
  hideCaptureBar() {
    webviews.adjustMargin([passwordCapture.barHeight * -1, 0, 0, 0])

    passwordCapture.bar.hidden = true
    passwordCapture.usernameInput.value = ''
    passwordCapture.passwordInput.value = ''
    passwordCapture.currentDomain = ''
  },
  togglePasswordVisibility() {
    if (passwordCapture.passwordInput.type === 'password') {
      passwordCapture.passwordInput.type = 'text'
      passwordCapture.revealButton.classList.remove('carbon:view')
      passwordCapture.revealButton.classList.add('carbon:view-off')
    } else {
      passwordCapture.passwordInput.type = 'password'
      passwordCapture.revealButton.classList.add('carbon:view')
      passwordCapture.revealButton.classList.remove('carbon:view-off')
    }
  },
  handleRecieveCredentials(tab: any, args: string[][], _frameId: any) {
    let domain = args[0][0]
    if (domain.startsWith('www.')) {
      domain = domain.slice(4)
    }

    if (settings.get('passwordsNeverSaveDomains') && settings.get('passwordsNeverSaveDomains').includes(domain)) {
      return
    }

    const username = args[0][1] || ''
    const password = args[0][2] || ''

    PasswordManagers.getConfiguredPasswordManager().then((manager) => {
      if (!manager || !(manager as Keychain).saveCredential) {
        // the password can't be saved
        return
      }

      // check if this username/password combo is already saved
      manager.getSuggestions(domain).then((credentials) => {
        const alreadyExists = credentials.some(
          (cred: CredentialType) => cred.username === username && cred.password === password,
        )
        if (!alreadyExists) {
          if (!passwordCapture.bar.hidden) {
            passwordCapture.hideCaptureBar()
          }

          passwordCapture.currentDomain = domain
          passwordCapture.showCaptureBar(username, password)
        }
      })
    })
  },
  initialize() {
    passwordCapture.bar = document.getElementById('password-capture-bar')!
    passwordCapture.description = document.getElementById('password-capture-description')!
    passwordCapture.usernameInput = document.getElementById('password-capture-username') as HTMLInputElement
    passwordCapture.passwordInput = document.getElementById('password-capture-password') as HTMLInputElement
    passwordCapture.revealButton = document.getElementById('password-capture-reveal-password') as HTMLButtonElement
    passwordCapture.saveButton = document.getElementById('password-capture-save') as HTMLButtonElement
    passwordCapture.neverSaveButton = document.getElementById('password-capture-never-save') as HTMLButtonElement
    passwordCapture.closeButton = document.getElementById('password-capture-ignore') as HTMLButtonElement

    passwordCapture.usernameInput.placeholder = l('username')
    passwordCapture.passwordInput.placeholder = l('password')

    webviews.bindIPC('password-form-filled', passwordCapture.handleRecieveCredentials)

    passwordCapture.saveButton.addEventListener('click', () => {
      if (passwordCapture.usernameInput.checkValidity() && passwordCapture.passwordInput.checkValidity()) {
        PasswordManagers.getConfiguredPasswordManager().then((manager) => {
          ;(manager as Keychain).saveCredential(
            passwordCapture.currentDomain,
            passwordCapture.usernameInput.value,
            passwordCapture.passwordInput.value,
          )

          passwordCapture.hideCaptureBar()
        })
      }
    })

    passwordCapture.neverSaveButton.addEventListener('click', () => {
      settings.set(
        'passwordsNeverSaveDomains',
        (settings.get('passwordsNeverSaveDomains') || []).concat([passwordCapture.currentDomain]),
      )
      passwordCapture.hideCaptureBar()
    })

    passwordCapture.closeButton.addEventListener('click', passwordCapture.hideCaptureBar)
    passwordCapture.revealButton.addEventListener('click', passwordCapture.togglePasswordVisibility)

    // the bar can change height when the window is resized, so the webview needs to be resized in response
    window.addEventListener('resize', () => {
      if (!passwordCapture.bar.hidden) {
        const oldHeight = passwordCapture.barHeight
        passwordCapture.barHeight = passwordCapture.bar.getBoundingClientRect().height
        webviews.adjustMargin([passwordCapture.barHeight - oldHeight, 0, 0, 0])
      }
    })
  },
}

// module.exports = passwordCapture
