// var webviews = require('webviews.js')
// const remoteMenu = require('remoteMenuRenderer.js')
import electron, { ipcRenderer as ipc } from 'electron'

import { l } from '../locales'
import * as remoteMenu from './remoteMenuRenderer'
import { webviews } from './webviews'

function getFileSizeString(bytes: number) {
  const prefixes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

  let size = bytes
  let prefixIndex = 0

  while (size > 900) {
    // prefer "0.9 KB" to "949 bytes"
    size /= 1024
    prefixIndex++
  }

  return `${Math.round(size * 10) / 10} ${prefixes[prefixIndex]}`
}

export const downloadManager = {
  isShown: false,
  bar: null as unknown as HTMLElement,
  container: null as unknown as HTMLElement,
  closeButton: null as unknown as HTMLElement,
  height: 40,
  lastDownloadCompleted: null as null | number,
  downloadItems: {} as Record<string, { status: string }>,
  downloadBarElements: {} as Record<
    string,
    {
      container: HTMLDivElement
      title: HTMLDivElement
      infoBox: HTMLDivElement
      detailedInfoBox: HTMLDivElement
      progress: HTMLDivElement
      dropdown: HTMLButtonElement
      openFolder: HTMLButtonElement
    }
  >,
  show() {
    if (!downloadManager.isShown) {
      downloadManager.isShown = true
      downloadManager.bar.hidden = false
      webviews.adjustMargin([0, 0, downloadManager.height, 0])
    }
  },
  hide() {
    if (downloadManager.isShown) {
      downloadManager.isShown = false
      downloadManager.bar.hidden = true
      webviews.adjustMargin([0, 0, downloadManager.height * -1, 0])

      // remove all completed or failed items
      for (const item in downloadManager.downloadItems) {
        if (downloadManager.downloadItems[item].status !== 'progressing') {
          downloadManager.removeItem(item)
        }
      }
    }
  },
  removeItem(path: string) {
    if (downloadManager.downloadBarElements[path]) {
      downloadManager.downloadBarElements[path].container.remove()
    }

    delete downloadManager.downloadBarElements[path]
    delete downloadManager.downloadItems[path]

    if (Object.keys(downloadManager.downloadItems).length === 0) {
      downloadManager.hide()
    }
  },
  openFolder(path: string) {
    ipc.invoke('showItemInFolder', path)
  },
  onItemClicked(path: string) {
    if (downloadManager.downloadItems[path].status === 'completed') {
      electron.shell.openPath(path)
      // provide a bit of time for the file to open before the download bar disappears
      setTimeout(() => {
        downloadManager.removeItem(path)
      }, 100)
    }
  },
  onItemDragged(path: string) {
    ipc.invoke('startFileDrag', path)
  },
  onDownloadCompleted() {
    downloadManager.lastDownloadCompleted = Date.now()
    setTimeout(() => {
      if (
        Date.now() - downloadManager.lastDownloadCompleted! >= 120000 &&
        Object.values(downloadManager.downloadItems).filter((i) => i.status === 'progressing').length === 0
      ) {
        downloadManager.hide()
      }
    }, 120 * 1000)
  },
  createItem(downloadItem: { name: string | null; path: string }) {
    const container = document.createElement('div')
    container.className = 'download-item'
    container.setAttribute('role', 'listitem')
    container.setAttribute('draggable', 'true')

    const title = document.createElement('div')
    title.className = 'download-title'
    title.textContent = downloadItem.name
    container.appendChild(title)

    const infoBox = document.createElement('div')
    infoBox.className = 'download-info'
    container.appendChild(infoBox)

    const detailedInfoBox = document.createElement('div')
    detailedInfoBox.className = 'download-info detailed'
    container.appendChild(detailedInfoBox)

    const progress = document.createElement('div')
    progress.className = 'download-progress'
    container.appendChild(progress)

    const dropdown = document.createElement('button')
    dropdown.className = 'download-action-button i carbon:chevron-down'
    container.appendChild(dropdown)

    const openFolder = document.createElement('button')
    openFolder.className = 'download-action-button i carbon:folder'
    openFolder.hidden = true
    container.appendChild(openFolder)

    container.addEventListener('click', () => {
      downloadManager.onItemClicked(downloadItem.path)
    })
    container.addEventListener('dragstart', (e) => {
      e.preventDefault()
      downloadManager.onItemDragged(downloadItem.path)
    })

    dropdown.addEventListener('click', (e) => {
      e.stopPropagation()
      const template = [
        [
          {
            label: l('downloadCancel'),
            click() {
              ipc.send('cancelDownload', downloadItem.path)
              downloadManager.removeItem(downloadItem.path)
            },
          },
        ],
      ]

      remoteMenu.open(
        template,
        Math.round(dropdown.getBoundingClientRect().left),
        Math.round(dropdown.getBoundingClientRect().top - 15),
      )
    })

    openFolder.addEventListener('click', (e) => {
      e.stopPropagation()
      downloadManager.openFolder(downloadItem.path)
      downloadManager.removeItem(downloadItem.path)
    })

    downloadManager.container.appendChild(container)
    downloadManager.downloadBarElements[downloadItem.path] = {
      container,
      title,
      infoBox,
      detailedInfoBox,
      progress,
      dropdown,
      openFolder,
    }
  },
  updateItem(downloadItem: { path: string | number; status: string; size: { total: number; received: number } }) {
    const elements = downloadManager.downloadBarElements[downloadItem.path]

    if (downloadItem.status === 'completed') {
      elements.container.classList.remove('loading')
      elements.container.classList.add('completed')
      elements.progress.hidden = true
      elements.dropdown.hidden = true
      elements.openFolder.hidden = false
      elements.infoBox.textContent = l('downloadStateCompleted')
      elements.detailedInfoBox.textContent = l('downloadStateCompleted')
    } else if (downloadItem.status === 'interrupted') {
      elements.container.classList.remove('loading')
      elements.container.classList.remove('completed')
      elements.progress.hidden = true
      elements.dropdown.hidden = true
      elements.openFolder.hidden = true
      elements.infoBox.textContent = l('downloadStateFailed')
      elements.detailedInfoBox.textContent = l('downloadStateFailed')
    } else {
      elements.container.classList.add('loading')
      elements.container.classList.remove('completed')
      elements.progress.hidden = false
      elements.dropdown.hidden = false
      elements.openFolder.hidden = true
      elements.infoBox.textContent = getFileSizeString(downloadItem.size.total)
      elements.detailedInfoBox.textContent = `${getFileSizeString(downloadItem.size.received)} / ${getFileSizeString(downloadItem.size.total)}`

      // the progress bar has a minimum width so that it's visible even if there's 0 download progress
      const adjustedProgress = 0.025 + (downloadItem.size.received / downloadItem.size.total) * 0.975
      elements.progress.style.transform = `scaleX(${adjustedProgress})`
    }
  },
  initialize() {
    downloadManager.bar = document.getElementById('download-bar')!
    downloadManager.container = document.getElementById('download-container')!
    downloadManager.closeButton = document.getElementById('download-close-button')!

    this.closeButton.addEventListener('click', () => {
      downloadManager.hide()
    })

    ipc.on('download-info', (e, info) => {
      if (!info.path) {
        // download save location hasn't been chosen yet
        return
      }

      if (info.status === 'cancelled') {
        downloadManager.removeItem(info.path)
        return
      }

      if (info.status === 'completed') {
        downloadManager.onDownloadCompleted()
      }

      if (!downloadManager.downloadItems[info.path]) {
        downloadManager.show()
        downloadManager.createItem(info)
      }
      downloadManager.updateItem(info)

      downloadManager.downloadItems[info.path] = info
    })
  },
}

// module.exports = downloadManager
