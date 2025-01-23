import { ipcRenderer } from 'electron'

// const webviews = require('webviews.js')
import { webviews } from '../webviews'

interface PermissionRequestType {
  permissionId: number
  tabId: string
  origin: string
  permission: string
  details: { mediaTypes: string[] }
  granted?: boolean
}
export const permissionRequests = {
  requests: [] as PermissionRequestType[],
  listeners: [] as Function[],
  grantPermission(permissionId: number) {
    permissionRequests.requests.forEach((request) => {
      if (request.permissionId && request.permissionId === permissionId) {
        ipcRenderer.send('permissionGranted', permissionId)
      }
    })
  },
  getIcons(request: PermissionRequestType) {
    if (request.permission === 'notifications') {
      return ['carbon:chat']
    }
    if (request.permission === 'pointerLock') {
      return ['carbon:cursor-1']
    }
    if (request.permission === 'media' && request.details.mediaTypes) {
      const mediaIcons = {
        video: 'carbon:video',
        audio: 'carbon:microphone',
      }
      return request.details.mediaTypes.map((t) => mediaIcons[t as keyof typeof mediaIcons])
    }
    return []
  },
  getButtons(tabId: string) {
    const buttons: HTMLButtonElement[] = []
    permissionRequests.requests.forEach((request) => {
      const icons = permissionRequests.getIcons(request)
      // don't display buttons for unsupported permission types
      if (icons.length === 0) {
        return
      }

      if (request.tabId === tabId) {
        const button = document.createElement('button')
        button.className = 'tab-icon permission-request-icon'
        if (request.granted) {
          button.classList.add('active')
        }
        icons.forEach((icon) => {
          const el = document.createElement('i')
          el.className = `i ${icon}`
          button.appendChild(el)
        })
        button.addEventListener('click', (e) => {
          e.stopPropagation()
          if (request.granted) {
            webviews.callAsync(tabId, 'reload')
          } else {
            permissionRequests.grantPermission(request.permissionId)
            button.classList.add('active')
          }
        })
        buttons.push(button)
      }
    })
    return buttons
  },
  onChange(listener: Function) {
    permissionRequests.listeners.push(listener)
  },
  initialize() {
    ipcRenderer.on('updatePermissions', (e, data) => {
      const oldData = permissionRequests.requests
      permissionRequests.requests = data
      oldData.forEach((req) => {
        permissionRequests.listeners.forEach((listener) => listener(req.tabId))
      })
      permissionRequests.requests.forEach((req) => {
        permissionRequests.listeners.forEach((listener) => listener(req.tabId))
      })
    })
  },
}

// permissionRequests.initialize()

// module.exports = permissionRequests
