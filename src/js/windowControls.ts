// const settings = require('util/settings/settings.js')
import { ipcRenderer as ipc } from 'electron'

import { settings } from './util/settings/settings'

export function initialize() {
  if (settings.get('useSeparateTitlebar') === true) {
    document.body.classList.add('separate-titlebar')
  }

  let windowIsMaximized = false
  let windowIsFullscreen = false

  const captionMinimize = document.querySelector(
    '.windows-caption-buttons .caption-minimise, body.linux .titlebar-linux .caption-minimise',
  )! as HTMLElement

  const captionMaximize = document.querySelector(
    '.windows-caption-buttons .caption-maximize, body.linux .titlebar-linux .caption-maximize',
  )! as HTMLElement

  const captionRestore = document.querySelector(
    '.windows-caption-buttons .caption-restore, body.linux .titlebar-linux .caption-restore',
  )! as HTMLElement

  const captionClose = document.querySelector(
    '.windows-caption-buttons .caption-close, body.linux .titlebar-linux .caption-close',
  )! as HTMLElement

  const linuxClose = document.querySelector('#linux-control-buttons #close-button')
  const linuxMinimize = document.querySelector('#linux-control-buttons #minimize-button')
  const linuxMaximize = document.querySelector('#linux-control-buttons #maximize-button')

  function updateCaptionButtons() {
    if (window.platformType === 'windows') {
      if (windowIsMaximized || windowIsFullscreen) {
        captionMaximize.hidden = true
        captionRestore.hidden = false
      } else {
        captionMaximize.hidden = false
        captionRestore.hidden = true
      }
    }
  }

  if (window.platformType === 'windows') {
    updateCaptionButtons()

    captionMinimize.addEventListener('click', (_e) => {
      ipc.invoke('minimize')
    })

    captionMaximize.addEventListener('click', (_e) => {
      ipc.invoke('maximize')
    })

    captionRestore.addEventListener('click', (_e) => {
      if (windowIsFullscreen) {
        ipc.invoke('setFullScreen', false)
      } else {
        ipc.invoke('unmaximize')
      }
    })

    captionClose.addEventListener('click', (_e) => {
      ipc.invoke('close')
    })
  }

  ipc.on('maximize', (_e) => {
    windowIsMaximized = true
    updateCaptionButtons()
  })
  ipc.on('unmaximize', (_e) => {
    windowIsMaximized = false
    updateCaptionButtons()
  })
  ipc.on('enter-full-screen', (_e) => {
    windowIsFullscreen = true
    updateCaptionButtons()
  })
  ipc.on('leave-full-screen', (_e) => {
    windowIsFullscreen = false
    updateCaptionButtons()
  })

  if (window.platformType === 'linux') {
    linuxClose!.addEventListener('click', (_e) => {
      ipc.invoke('close')
    })
    linuxMaximize!.addEventListener('click', (_e) => {
      if (windowIsFullscreen) {
        ipc.invoke('setFullScreen', false)
      } else if (windowIsMaximized) {
        ipc.invoke('unmaximize')
      } else {
        ipc.invoke('maximize')
      }
    })
    linuxMinimize!.addEventListener('click', (_e) => {
      ipc.invoke('minimize')
    })
  }
}

// module.exports = { initialize }
