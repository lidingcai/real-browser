// const settings = require('util/settings/settings.js')
import { settings } from './util/settings/settings'

export const statistics = {
  usageDataCache: { created: 0 } as Record<string, any>,
  envGetters: [] as { key: string; fn: () => void }[],
  registerGetter(key: keyof typeof this.usageDataCache, fn: () => void) {
    statistics.envGetters.push({ key, fn })
  },
  getValue(key: keyof typeof this.usageDataCache): number {
    return statistics.usageDataCache[key]
  },
  setValue(key: keyof typeof this.usageDataCache, value: number) {
    statistics.usageDataCache[key] = value
  },
  incrementValue(key: keyof typeof this.usageDataCache) {
    if (statistics.usageDataCache[key]) {
      statistics.usageDataCache[key]++
    } else {
      statistics.usageDataCache[key] = 1
    }
  },
  upload() {
    if (settings.get('collectUsageStats') === false) {
      return
    }

    // avoid duplicate uploads when multiple windows are open
    if (!document.body.classList.contains('focused')) {
      return
    }

    let usageData = { ...(statistics.usageDataCache || {}) }

    // avoid uploading more than a week's worth of old data, in the case that uploads fail indefinitely
    if (usageData.created && Date.now() - usageData.created > 7 * 24 * 60 * 60 * 1000) {
      usageData = { created: 0 }
      statistics.usageDataCache = {
        created: Date.now(),
      }
    }

    statistics.envGetters.forEach((getter) => {
      try {
        usageData[getter.key] = getter.fn()
      } catch (e) {
        console.warn(e)
      }
    })

    fetch('https://services.minbrowser.org/stats/v1/collect', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientID: settings.get('clientID'),
        installTime: settings.get('installTime'),
        os: process.platform,
        lang: navigator.language,
        appVersion: window.globalArgs['app-version'],
        appName: window.globalArgs['app-name'],
        isDev: 'development-mode' in window.globalArgs,
        usageData,
      }),
    })
      .then(() => {
        statistics.usageDataCache = {
          created: Date.now(),
        }
        settings.set('usageData', null)
      })
      .catch((e) => console.warn('failed to send usage statistics', e))
  },
  initialize() {
    setTimeout(statistics.upload, 10000)
    setInterval(statistics.upload, 24 * 60 * 60 * 1000)

    statistics.usageDataCache = settings.get('usageData') || {
      created: Date.now(),
    }

    setInterval(() => {
      if (settings.get('collectUsageStats') === false) {
        settings.set('usageData', null)
      } else {
        settings.set('usageData', statistics.usageDataCache)
      }
    }, 60000)

    settings.listen('collectUsageStats', (value: boolean) => {
      if (value === false) {
        // disabling stats collection should reset client ID
        settings.set('clientID', undefined)
      } else if (!settings.get('clientID')) {
        settings.set('clientID', Math.random().toString().slice(2))
      }
    })

    if (!settings.get('installTime')) {
      // round install time to nearest hour to reduce uniqueness
      const roundingFactor = 60 * 60 * 1000
      settings.set('installTime', Math.floor(Date.now() / roundingFactor) * roundingFactor)
    }

    statistics.registerGetter('contentTypeFilters', () => {
      return (settings.get('filtering') || {}).contentTypes
    })
  },
}

// module.exports = statistics
