// const path = require('path')
// const statistics = require('js/statistics.js')
import fs from 'node:fs'
import path from 'node:path'

import { ipcRenderer as ipc } from 'electron'

import { statistics } from './statistics'

export const newTabPage = {
  background: null as unknown as HTMLImageElement,
  hasBackground: false,
  picker: null as unknown as HTMLButtonElement,
  deleteBackground: null as unknown as HTMLElement,
  imagePath: '',
  blobInstance: null as string | null,
  reloadBackground() {
    fs.readFile(newTabPage.imagePath, (err, data) => {
      if (newTabPage.blobInstance) {
        URL.revokeObjectURL(newTabPage.blobInstance)
        newTabPage.blobInstance = null
      }
      if (err) {
        newTabPage.background.hidden = true
        newTabPage.hasBackground = false
        document.body.classList.remove('ntp-has-background')
        newTabPage.deleteBackground.hidden = true
      } else {
        const blob = new Blob([data], { type: 'application/octet-binary' })
        const url = URL.createObjectURL(blob)
        newTabPage.blobInstance = url
        newTabPage.background.src = url

        newTabPage.background.hidden = false
        newTabPage.hasBackground = true
        document.body.classList.add('ntp-has-background')
        newTabPage.deleteBackground.hidden = false
      }
    })
  },
  initialize() {
    newTabPage.background = document.getElementById('ntp-background') as HTMLImageElement
    newTabPage.hasBackground = false
    newTabPage.picker = document.getElementById('ntp-image-picker') as HTMLButtonElement
    newTabPage.deleteBackground = document.getElementById('ntp-image-remove') as HTMLElement
    newTabPage.imagePath = path.join(window.globalArgs['user-data-path'], 'newTabBackground')
    newTabPage.blobInstance = null as string | null

    newTabPage.reloadBackground()

    newTabPage.picker.addEventListener('click', async () => {
      const filePath = await ipc.invoke('showOpenDialog', {
        filters: [{ name: 'Image files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
      })

      if (!filePath) {
        return
      }

      await fs.promises.copyFile(filePath[0], newTabPage.imagePath)
      newTabPage.reloadBackground()
    })

    newTabPage.deleteBackground.addEventListener('click', async () => {
      await fs.promises.unlink(newTabPage.imagePath)
      newTabPage.reloadBackground()
    })

    statistics.registerGetter('ntpHasBackground', () => {
      return newTabPage.hasBackground
    })
  },
}

// module.exports = newTabPage
