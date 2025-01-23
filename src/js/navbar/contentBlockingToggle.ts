// const webviews = require('webviews.js')
// const remoteMenu = require('remoteMenuRenderer.js')
import { l } from '../../locales'
import * as browserUI from '../browserUI'
import * as remoteMenu from '../remoteMenuRenderer'
// const settings = require('util/settings/settings.js')
import { settings } from '../util/settings/settings'
import { webviews } from '../webviews'

export const contentBlockingToggle = {
  enableBlocking(url: string) {
    if (!url) {
      return
    }
    const domain = new URL(url).hostname

    let setting = settings.get('filtering')
    if (!setting) {
      setting = {}
    }
    if (!setting.exceptionDomains) {
      setting.exceptionDomains = []
    }
    setting.exceptionDomains = (setting.exceptionDomains as string[]).filter(
      (d) => d.replace(/^www\./g, '') !== domain.replace(/^www\./g, ''),
    )
    settings.set('filtering', setting)
    webviews.callAsync(window.tabs.getSelected() as string, 'reload')
  },
  disableBlocking(url: string) {
    if (!url) {
      return
    }
    const domain = new URL(url).hostname

    let setting = settings.get('filtering')
    if (!setting) {
      setting = {}
    }
    if (!setting.exceptionDomains) {
      setting.exceptionDomains = []
    }
    // make sure the domain isn't already an exception
    if (
      !(setting.exceptionDomains as string[]).some((d) => d.replace(/^www\./g, '') === domain.replace(/^www\./g, ''))
    ) {
      setting.exceptionDomains.push(domain)
    }
    settings.set('filtering', setting)
    webviews.callAsync(window.tabs.getSelected() as string, 'reload')
  },
  isBlockingEnabled(url: string) {
    let domain = ''
    try {
      domain = new URL(url).hostname
    } catch (e) {
      return false
    }

    const setting = settings.get('filtering')
    return (
      !setting ||
      !setting.exceptionDomains ||
      !(setting.exceptionDomains as string[]).some((d) => d.replace(/^www\./g, '') === domain.replace(/^www\./g, ''))
    )
  },
  create() {
    const button = document.createElement('button')
    button.className = 'tab-editor-button i carbon:manage-protection'

    button.addEventListener('click', (_e) => {
      contentBlockingToggle.showMenu(button)
    })

    return button
  },
  showMenu(button: HTMLButtonElement) {
    const url = (window.tabs.get(window.tabs.getSelected() as string) as TabType).url as string
    const menu = [
      [
        {
          type: 'checkbox',
          label: l('enableBlocking'),
          checked: contentBlockingToggle.isBlockingEnabled(url),
          click() {
            if (contentBlockingToggle.isBlockingEnabled(url)) {
              contentBlockingToggle.disableBlocking(url)
            } else {
              contentBlockingToggle.enableBlocking(url)
            }
            contentBlockingToggle.update(window.tabs.getSelected() as string, button)
          },
        },
      ],
      [
        {
          label: l('appMenuReportBug'),
          click() {
            const newTab = window.tabs.add({
              url: `https://github.com/minbrowser/min/issues/new?title=Content%20blocking%20issue%20on%20${encodeURIComponent(
                url,
              )}`,
            })
            browserUI.addTab(newTab, { enterEditMode: false })
          },
        },
      ],
    ]
    remoteMenu.open(menu)
  },
  update(tabId: string, button: HTMLButtonElement) {
    if (
      !(window.tabs.get(tabId) as TabType).url!.startsWith('http') &&
      !(window.tabs.get(tabId) as TabType).url!.startsWith('https')
    ) {
      button.hidden = true
      return
    }

    if (settings.get('filtering') && settings.get('filtering').blockingLevel === 0) {
      button.hidden = true
      return
    }

    button.hidden = false
    if (contentBlockingToggle.isBlockingEnabled((window.tabs.get(tabId) as TabType).url!)) {
      button.style.opacity = '1'
    } else {
      button.style.opacity = '0.4'
    }
  },
}

// module.exports = contentBlockingToggle
