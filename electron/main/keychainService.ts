/* Uses Electron's safeStorage to encrypt a password file - encryption key gets stored in the system keychain */

import fs from 'node:fs'
import path from 'node:path'

import { ipcMain as ipc, safeStorage } from 'electron'

import { getUserDataPath } from './settingsMain'

const passwordFilePath = path.join(getUserDataPath(), 'passwordStore')

/*
file format:
{
  version: 1,
  credentials: [
    {
      domain:,
      username:,
      password:
    }
  ]
}
*/

function readSavedPasswordFile(): {
  version: number
  credentials: {
    domain: string
    username: string
    password: string
  }[]
} {
  let file
  try {
    file = fs.readFileSync(passwordFilePath)
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.warn(e)
      throw new Error(e)
    }
  }
  if (file) {
    return JSON.parse(safeStorage.decryptString(file))
  }
  return {
    version: 1,
    credentials: [],
  }
}

function writeSavedPasswordFile(content) {
  fs.writeFileSync(passwordFilePath, safeStorage.encryptString(JSON.stringify(content)))
}

function credentialStoreSetPassword(account) {
  const fileContent = readSavedPasswordFile()

  // delete duplicate credentials
  for (let i = 0; i < fileContent.credentials.length; i++) {
    if (
      fileContent.credentials[i].domain === account.domain &&
      fileContent.credentials[i].username === account.username
    ) {
      fileContent.credentials.splice(i, 1)
      i--
    }
  }

  fileContent.credentials.push(account)
  writeSavedPasswordFile(fileContent)
}

export const initKeychainService = () => {
  ipc.handle('credentialStoreSetPassword', async (event, account) => {
    return credentialStoreSetPassword(account)
  })

  ipc.handle('credentialStoreDeletePassword', async (event, account) => {
    const fileContent = readSavedPasswordFile()

    // delete matching credentials
    for (let i = 0; i < fileContent.credentials.length; i++) {
      if (
        fileContent.credentials[i].domain === account.domain &&
        fileContent.credentials[i].username === account.username
      ) {
        fileContent.credentials.splice(i, 1)
        i--
      }
    }

    return writeSavedPasswordFile(fileContent)
  })

  ipc.handle('credentialStoreGetCredentials', async () => {
    return readSavedPasswordFile().credentials
  })
}
