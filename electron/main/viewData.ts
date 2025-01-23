import { BrowserView } from 'electron'

import { windows } from './windowManagement'

export const viewMap: Record<string, BrowserView> = {} // id: view
export const viewStateMap = {} // id: view state
export function destroyView(id) {
  if (!viewMap[id]) {
    return
  }

  windows.getAll().forEach((window) => {
    if (viewMap[id] === window.getBrowserView()) {
      window.setBrowserView(null)
      // TODO fix
      windows.getState(window).selectedView = null
    }
  })
  viewMap[id].webContents.close({ waitForBeforeUnload: false })

  delete viewMap[id]
  delete viewStateMap[id]
}

export function destroyAllViews() {
  for (const id in viewMap) {
    destroyView(id)
  }
}
