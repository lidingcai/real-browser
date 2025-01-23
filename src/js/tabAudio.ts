// var webviews = require('webviews.js')
// var keybindings = require('keybindings.js')
import { defineShortcut } from './keybindings'
import { webviews } from './webviews'

export const tabAudio = {
  muteIcon: 'carbon:volume-mute',
  volumeIcon: 'carbon:volume-up',
  getButton(tabId: string) {
    const button = document.createElement('button')
    button.className = 'tab-icon tab-audio-button i'

    button.setAttribute('data-tab', tabId)
    button.setAttribute('role', 'button')

    button.addEventListener('click', (e) => {
      e.stopPropagation()
      tabAudio.toggleAudio(tabId)
    })

    tabAudio.updateButton(tabId, button)

    return button
  },
  updateButton(tabId: string, button0: HTMLButtonElement) {
    const button = button0 || document.querySelector('.tab-audio-button[data-tab="{id}"]'.replace('{id}', tabId))
    const tab = window.tabs.get(tabId) as TabType

    const { muteIcon } = tabAudio
    const { volumeIcon } = tabAudio

    if (tab.muted) {
      button.hidden = false
      button.classList.remove(volumeIcon)
      button.classList.add(muteIcon)
    } else if (tab.hasAudio) {
      button.hidden = false
      button.classList.add(volumeIcon)
      button.classList.remove(muteIcon)
    } else {
      button.hidden = true
    }
  },
  toggleAudio(tabId: string) {
    const tab = window.tabs.get(tabId) as TabType
    // can be muted if has audio, can be unmuted if muted
    if (tab.hasAudio || tab.muted) {
      webviews.callAsync(tabId, 'setAudioMuted', !tab.muted)
      window.tabs.update(tabId, { muted: !tab.muted })
    }
  },
  initialize() {
    defineShortcut('toggleTabAudio', () => {
      tabAudio.toggleAudio(window.tabs.getSelected() as string)
    })

    webviews.bindEvent('media-started-playing', (tabId: string) => {
      window.tabs.update(tabId, { hasAudio: true })
    })
    webviews.bindEvent('media-paused', (tabId: string) => {
      window.tabs.update(tabId, { hasAudio: false })
    })
  },
}

// tabAudio.initialize()

// module.exports = tabAudio
