import { app, ipcMain as ipc } from 'electron'
import fs from 'fs'

import { windows } from './windowManagement'

export const getUserDataPath = () => {
  return app.getPath('userData') + (process.env.VITE_DEV_SERVER_URL ? '-dev' : '')
}
export const settings = {
  filePath: `${getUserDataPath() + (process.platform === 'win32' ? '\\' : '/')}settings.json`,
  fileWritePromise: null,
  list: {},
  onChangeCallbacks: [],
  writeFile() {
    /*
      Writing to the settings file from multiple places simultaneously causes data corruption, so to avoid that:
      * We forward data from the renderer process to the main process, and only write from there
      * In the main process, we put multiple save requests in a queue (by chaining them to a promise) so they execute individually
      * https://github.com/minbrowser/min/issues/1520
      */

    /* eslint-disable no-inner-declarations */
    function newFileWrite() {
      return fs.promises.writeFile(settings.filePath, JSON.stringify(settings.list))
    }

    function ongoingFileWrite() {
      return settings.fileWritePromise || Promise.resolve()
    }
    /* eslint-enable no-inner-declarations */

    // eslint-disable-next-line no-return-assign
    settings.fileWritePromise = ongoingFileWrite()
      .then(newFileWrite)
      .then(() => {
        settings.fileWritePromise = null
      })
  },
  runChangeCallbacks(key: any) {
    settings.onChangeCallbacks.forEach((listener) => {
      if (!key || !listener.key || listener.key === key) {
        if (listener.key) {
          listener.cb(settings.list[listener.key])
        } else {
          listener.cb(key)
        }
      }
    })
  },
  get(key: string | number) {
    return settings.list[key]
  },
  listen(key: any, cb: (arg0: any) => void) {
    if (key && cb) {
      cb(settings.get(key))
      settings.onChangeCallbacks.push({ key, cb })
    } else if (key) {
      // global listener
      settings.onChangeCallbacks.push({ cb: key })
    }
  },
  set(key: string | number, value: any) {
    settings.list[key] = value
    settings.writeFile()
    settings.runChangeCallbacks(key)

    windows.getAll().forEach((win) => {
      win.webContents.send('settingChanged', key, value)
    })
  },
  initialize() {
    let fileData: string
    try {
      fileData = fs.readFileSync(settings.filePath, 'utf-8')
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn(e)
      }
    }
    if (fileData) {
      settings.list = JSON.parse(fileData)
    }

    ipc.on('settingChanged', (e, key, value) => {
      settings.list[key] = value
      settings.writeFile()
      settings.runChangeCallbacks(key)

      windows.getAll().forEach((win) => {
        if (win.webContents.id !== e.sender.id) {
          win.webContents.send('settingChanged', key, value)
        }
      })
    })
  },
}
