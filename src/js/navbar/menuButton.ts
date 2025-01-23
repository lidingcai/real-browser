// var keybindings = require('keybindings.js')
// const { ipcRenderer } = require('electron')
import { ipcRenderer } from 'electron'

import { defineShortcut } from '../keybindings'
// var settings = require('util/settings/settings.js')
import { settings } from '../util/settings/settings'

export const menuButton = {
  menuButton: null as null | HTMLElement,
  showSecondaryMenu() {
    const navbar = document.getElementById('navbar') as HTMLElement
    const rect = menuButton.menuButton!.getBoundingClientRect()
    const navbarRect = navbar.getBoundingClientRect()

    ipcRenderer.send('showSecondaryMenu', {
      x: Math.round(rect.left),
      y: Math.round(navbarRect.bottom),
    })
  },

  initialize() {
    menuButton.menuButton = document.getElementById('menu-button') as HTMLElement
    menuButton.menuButton.addEventListener('click', (_e) => {
      menuButton.showSecondaryMenu()
    })

    defineShortcut('showMenu', () => {
      if (
        !settings.get('useSeparateTitlebar') &&
        (window.platformType === 'windows' || window.platformType === 'linux')
      ) {
        menuButton.showSecondaryMenu()
      }
    })
  },
}
// module.exports = { initialize, showSecondaryMenu }
