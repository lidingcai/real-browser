// const webviews = require('webviews.js')
// const modalMode = require('modalMode.js')
import { l } from '../../locales/index'
import { modalMode } from '../modalMode'
// const settings = require('util/settings/settings.js')
import { settings } from '../util/settings/settings'
import { webviews } from '../webviews'
// import { Bitwarden } from './bitwarden'
import { Keychain } from './keychain'
// import { OnePassword } from './onePassword'
// const PasswordManagers = require('passwordManager/passwordManager.js')
import { PasswordManagers } from './passwordManager'

// type PasswordManagerType = Bitwarden | Keychain | OnePassword
interface CredentialType {
  domain: string
  username: string
  password: string
}
export const passwordViewer = {
  container: null as unknown as HTMLElement,
  listContainer: null as unknown as HTMLElement,
  emptyHeading: null as unknown as HTMLElement,
  closeButton: null as unknown as HTMLElement,
  createCredentialListElement(credential: CredentialType) {
    const container = document.createElement('div')

    const domainEl = document.createElement('span')
    domainEl.className = 'domain-name'
    domainEl.textContent = credential.domain
    container.appendChild(domainEl)

    const usernameEl = document.createElement('input')
    usernameEl.value = credential.username
    usernameEl.disabled = true
    container.appendChild(usernameEl)

    const passwordEl = document.createElement('input')
    passwordEl.type = 'password'
    passwordEl.value = credential.password
    passwordEl.disabled = true
    container.appendChild(passwordEl)

    const revealButton = document.createElement('button')
    revealButton.className = 'i carbon:view'
    revealButton.addEventListener('click', () => {
      if (passwordEl.type === 'password') {
        passwordEl.type = 'text'
        revealButton.classList.remove('carbon:view')
        revealButton.classList.add('carbon:view-off')
      } else {
        passwordEl.type = 'password'
        revealButton.classList.add('carbon:view')
        revealButton.classList.remove('carbon:view-off')
      }
    })
    container.appendChild(revealButton)

    const deleteButton = document.createElement('button')
    deleteButton.className = 'i carbon:trash-can'
    container.appendChild(deleteButton)

    deleteButton.addEventListener('click', () => {
      // eslint-disable-next-line no-restricted-globals, no-alert
      if (confirm(l('deletePassword').replace('%s', credential.domain))) {
        PasswordManagers.getConfiguredPasswordManager().then((manager) => {
          ;(manager as Keychain).deleteCredential(credential.domain, credential.username)
          container.remove()
        })
      }
    })

    return container
  },
  createNeverSaveDomainElement(domain: string) {
    const container = document.createElement('div')

    const domainEl = document.createElement('span')
    domainEl.className = 'domain-name'
    domainEl.textContent = domain
    container.appendChild(domainEl)

    const descriptionEl = document.createElement('span')
    descriptionEl.className = 'description'
    descriptionEl.textContent = l('savedPasswordsNeverSavedLabel')
    container.appendChild(descriptionEl)

    const deleteButton = document.createElement('button')
    deleteButton.className = 'i carbon:trash-can'
    container.appendChild(deleteButton)

    deleteButton.addEventListener('click', () => {
      settings.set(
        'passwordsNeverSaveDomains',
        settings.get('passwordsNeverSaveDomains').filter((d: string) => d !== domain),
      )
      container.remove()
    })

    return container
  },
  show() {
    PasswordManagers.getConfiguredPasswordManager().then((manager) => {
      if (!(manager as Keychain).getAllCredentials) {
        throw new Error('unsupported password manager')
      }

      ;(manager as Keychain).getAllCredentials().then((credentials) => {
        webviews.requestPlaceholder('passwordViewer')
        modalMode.toggle(true, {
          onDismiss: passwordViewer.hide,
        })
        passwordViewer.container.hidden = false

        credentials.forEach((cred) => {
          passwordViewer.listContainer.appendChild(passwordViewer.createCredentialListElement(cred))
        })

        const neverSaveDomains = settings.get('passwordsNeverSaveDomains') || []

        neverSaveDomains.forEach((domain: string) => {
          passwordViewer.listContainer.appendChild(passwordViewer.createNeverSaveDomainElement(domain))
        })

        passwordViewer.emptyHeading.hidden = credentials.length + neverSaveDomains.length !== 0
      })
    })
  },
  hide() {
    webviews.hidePlaceholder('passwordViewer')
    modalMode.toggle(false)
    window.empty(passwordViewer.listContainer)
    passwordViewer.container.hidden = true
  },
  initialize() {
    passwordViewer.container = document.getElementById('password-viewer')!
    passwordViewer.listContainer = document.getElementById('password-viewer-list')!
    passwordViewer.emptyHeading = document.getElementById('password-viewer-empty')!
    passwordViewer.closeButton = document.querySelector('#password-viewer .modal-close-button')!

    passwordViewer.closeButton.addEventListener('click', passwordViewer.hide)
    webviews.bindIPC('showCredentialList', () => {
      passwordViewer.show()
    })
  },
}

// module.exports = passwordViewer
