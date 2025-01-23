import fs from 'node:fs'

import { ipcRenderer as ipc } from 'electron'

export const settings = {
  filePath: `${window.globalArgs['user-data-path'] + (process.platform === 'win32' ? '\\' : '/')}settings.json`,
  list: {} as Record<string, any>,
  onChangeCallbacks: [] as { key?: string; cb: Function }[],
  runChangeCallbacks(key?: string) {
    settings.onChangeCallbacks.forEach((listener: { key?: string; cb: Function }) => {
      if (!key || !listener.key || listener.key === key) {
        if (listener.key) {
          listener.cb(settings.list[listener.key])
        } else {
          listener.cb(key)
        }
      }
    })
  },
  get(key: string) {
    return settings.list[key]
  },
  listen(key: string | Function, cb: Function | undefined = undefined) {
    if (key && cb) {
      cb(settings.get(key as string))
      settings.onChangeCallbacks.push({ key: key as string, cb })
    } else if (key) {
      // global listener
      settings.onChangeCallbacks.push({ cb: key as (arg0: any) => void })
    }
  },
  set(key: string, value: any) {
    settings.list[key] = value
    ipc.send('settingChanged', key, value)
    settings.runChangeCallbacks(key)
  },
  initialize() {
    let fileData
    try {
      fileData = fs.readFileSync(settings.filePath, 'utf-8')
    } catch (e) {
      if ((e as { code: string }).code !== 'ENOENT') {
        console.warn(e)
      }
    }
    if (fileData) {
      settings.list = JSON.parse(fileData)
    }

    settings.runChangeCallbacks()

    ipc.on('settingChanged', (e, key, value) => {
      settings.list[key] = value
      settings.runChangeCallbacks(key)
    })
    // official min api can not connect
    settings.set('collectUsageStats', false)
  },
}

// settings.initialize()
// module.exports = settings
