export const settings = {
  loaded: false,
  list: {} as Record<string, any>,
  onLoadCallbacks: [] as { key: string; cb: Function }[],
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
  get(key: string, cb: Function) {
    // get the setting from the cache if possible
    if (settings.loaded) {
      cb(settings.list[key])

      // if the settings haven't loaded, wait until they have
    } else {
      settings.onLoadCallbacks.push({
        key,
        cb,
      })
    }
  },
  listen(key: string | Function, cb: Function | undefined = undefined) {
    if (key && cb) {
      settings.get(key as string, cb)
      settings.onChangeCallbacks.push({ key: key as string, cb: cb as Function })
    } else if (key) {
      // global listener
      settings.onChangeCallbacks.push({ cb: key as Function })
    }
  },
  set(key: string, value: any) {
    settings.list[key] = value
    postMessage({ message: 'setSetting', key, value })
    settings.runChangeCallbacks(key)
  },
  load() {
    postMessage({ message: 'getSettingsData' })
  },
  onLoad(cb: Function) {
    if (settings.loaded) {
      cb()
    } else {
      settings.onLoadCallbacks.push({
        key: '',
        cb,
      })
    }
  },
  initialize: () => {
    window.addEventListener('message', (e) => {
      if (e.data.message && e.data.message === 'receiveSettingsData') {
        settings.list = e.data.settings
        if (!settings.loaded) {
          settings.onLoadCallbacks.forEach((item) => {
            item.cb(settings.list[item.key])
          })
          settings.onLoadCallbacks = []
        }
        settings.loaded = true
        settings.runChangeCallbacks()
      }
    })
    settings.load()
  },
}
