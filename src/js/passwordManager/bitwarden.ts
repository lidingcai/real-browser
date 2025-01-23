// const ProcessSpawner = require('util/process.js')
import fs from 'node:fs'
// const path = require('path')
// const fs = require('fs')
import path from 'node:path'

// var { ipcRenderer } = require('electron')
import { ipcRenderer } from 'electron'

import { l } from '../../locales/index'
import { ProcessSpawner } from '../util/process'
// Bitwarden password manager. Requires session key to unlock the vault.
export class Bitwarden {
  sessionKey: null | string

  lastCallList: Record<string, null | Promise<any>> = {}

  name: string

  path: string | null = null

  constructor() {
    this.sessionKey = null
    this.lastCallList = {}
    this.name = 'Bitwarden'
  }

  getDownloadLink() {
    // eslint-disable-next-line default-case
    switch (window.platformType) {
      case 'mac':
        return 'https://vault.bitwarden.com/download/?app=cli&platform=macos'
      case 'windows':
        return 'https://vault.bitwarden.com/download/?app=cli&platform=windows'
      case 'linux':
        return 'https://vault.bitwarden.com/download/?app=cli&platform=linux'
    }
    return ''
  }

  getLocalPath() {
    return path.join(window.globalArgs['user-data-path'], 'tools', window.platformType === 'windows' ? 'bw.exe' : 'bw')
  }

  getSetupMode() {
    return 'dragdrop'
  }

  // Returns a Bitwarden-CLI tool path by checking possible locations.
  // First it checks if the tool was installed for Min specifically
  // by checking the settings value. If that is not set or doesn't point
  // to a valid executable, it checks if 'bw' is available globally.
  // eslint-disable-next-line no-underscore-dangle
  async _getToolPath() {
    const localPath = this.getLocalPath()
    if (localPath) {
      let local = false
      try {
        await fs.promises.access(localPath, fs.constants.X_OK)
        local = true
      } catch (e) {
        //
      }
      if (local) {
        return localPath
      }
    }

    const global = await new ProcessSpawner('bw').checkCommandExists()

    if (global) {
      return 'bw'
    }

    return null
  }

  // Checks if Bitwarden integration is configured properly by trying to
  // obtain a valid Bitwarden-CLI tool path.
  async checkIfConfigured() {
    // eslint-disable-next-line no-underscore-dangle
    this.path = await this._getToolPath()
    return this.path != null
  }

  // Returns current Bitwarden-CLI status. If we have a session key, then
  // password store is considered unlocked.
  isUnlocked() {
    return this.sessionKey != null
  }

  // Tries to get a list of credential suggestions for a given domain name.
  async getSuggestions(domain: string) {
    if (this.lastCallList[domain] != null) {
      return this.lastCallList[domain]
    }

    const command = this.path
    if (!command) {
      return Promise.resolve([])
    }

    if (!this.isUnlocked()) {
      throw new Error()
    }

    this.lastCallList[domain] = this.loadSuggestions(command, domain)
      .then((suggestions) => {
        this.lastCallList[domain] = null
        return suggestions
      })
      .catch(() => {
        this.lastCallList[domain] = null
      })

    return this.lastCallList[domain]
  }

  // Loads credential suggestions for given domain name.
  async loadSuggestions(command: string, domain: string) {
    try {
      const process = new ProcessSpawner(command, [
        'list',
        'items',
        '--url',
        this.sanitize(domain),
        '--session',
        this.sessionKey as string,
      ])
      const data = await process.execute()

      const matches = JSON.parse(data as string)
      const credentials = matches.map((match: { login: { username: string; password: string } }) => {
        const {
          login: { username, password },
        } = match as { login: { username: string; password: string } }
        return { username, password, manager: 'Bitwarden' }
      })

      return credentials
    } catch (ex) {
      const { error, data } = ex as { error: string; data: string }
      console.error(`Error accessing Bitwarden CLI. STDOUT: ${data}. STDERR: ${error}`)
      return []
    }
  }

  async forceSync(command: string) {
    try {
      const process = new ProcessSpawner(command, ['sync', '--session', this.sessionKey as string])
      await process.execute()
    } catch (ex) {
      const { error, data } = ex as { error: string; data: string }
      console.error(`Error accessing Bitwarden CLI. STDOUT: ${data}. STDERR: ${error}`)
    }
  }

  // Tries to unlock the password store with given master password.
  async unlockStore(password: string): Promise<boolean> {
    try {
      const process = new ProcessSpawner(this.path as string, ['unlock', '--raw', password])
      const result = (await process.execute()) as string

      if (!result) {
        throw new Error()
      }

      this.sessionKey = result
      await this.forceSync(this.path as string)

      return true
    } catch (ex) {
      const { error, data } = ex as { error: string; data: string }

      console.error(`Error accessing Bitwarden CLI. STDOUT: ${data}. STDERR: ${error}`)

      if (error.includes('not logged in')) {
        await this.signInAndSave()
        // eslint-disable-next-line no-return-await
        return await this.unlockStore(password)
      }

      throw ex
    }
  }

  async signInAndSave(path = this.path) {
    // It's possible to be already logged in
    const logoutProcess = new ProcessSpawner(path as string, ['logout'])
    try {
      await logoutProcess.execute()
    } catch (e) {
      console.warn(e)
    }

    // show credentials dialog

    const signInFields = [
      { placeholder: 'Client ID', id: 'clientID', type: 'password' },
      { placeholder: 'Client Secret', id: 'clientSecret', type: 'password' },
    ]

    const credentials = ipcRenderer.sendSync('prompt', {
      text: l('passwordManagerBitwardenSignIn'),
      values: signInFields,
      ok: l('dialogConfirmButton'),
      cancel: l('dialogSkipButton'),
      width: 500,
      height: 260,
    })

    for (const key in credentials) {
      if (credentials[key] === '') {
        throw new Error('no credentials entered')
      }
    }

    const process = new ProcessSpawner(path as string, ['login', '--apikey'], {
      BW_CLIENTID: credentials.clientID.trim(),
      BW_CLIENTSECRET: credentials.clientSecret.trim(),
    })

    await process.execute()

    return true
  }

  // Basic domain name cleanup. Removes any non-ASCII symbols.
  sanitize(domain: string) {
    return domain.replace(/[^a-zA-Z0-9.-]/g, '')
  }
}

// module.exports = Bitwarden
