import { ipcRenderer } from 'electron'

export class Keychain {
  name: string

  constructor() {
    this.name = 'Built-in password manager'
  }

  getDownloadLink() {
    return null
  }

  getLocalPath() {
    return null
  }

  getSetupMode() {
    return null
  }

  async checkIfConfigured() {
    return true
  }

  isUnlocked() {
    return true
  }

  async getSuggestions(domain: string) {
    return ipcRenderer.invoke('credentialStoreGetCredentials').then(
      (
        results: {
          domain: string
          username: string
          password: string
        }[],
      ) => {
        return results
          .filter((result) => {
            return result.domain === domain
          })
          .map((result) => {
            return {
              ...result,
              manager: 'Keychain',
            }
          })
      },
    )
  }

  saveCredential(domain: string, username: string, password: string) {
    ipcRenderer.invoke('credentialStoreSetPassword', { domain, username, password })
  }

  deleteCredential(domain: string, username: string) {
    ipcRenderer.invoke('credentialStoreDeletePassword', { domain, username })
  }

  getAllCredentials() {
    return ipcRenderer.invoke('credentialStoreGetCredentials').then(
      (
        results: {
          domain: string
          username: string
          password: string
        }[],
      ) => {
        return results.map((result) => {
          return {
            ...result,
            manager: 'Keychain',
          }
        })
      },
    )
  }

  async signInAndSave(_path: string = '') {
    return true
  }
}

// module.exports = Keychain
