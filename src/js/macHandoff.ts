/* Handoff support for macOS */
import { ipcRenderer as ipc } from 'electron'

export default {
  initialize() {
    if (window.platformType === 'mac') {
      window.tasks.on('tab-selected', (id: string) => {
        if (window.tabs.get(id)) {
          if ((window.tabs.get(id) as TabType).private) {
            ipc.send('handoffUpdate', { url: '' })
          } else {
            ipc.send('handoffUpdate', { url: (window.tabs.get(id) as TabType).url })
          }
        }
      })
      window.tasks.on('tab-updated', (id: string, key: string) => {
        if (key === 'url' && window.tabs.getSelected() === id) {
          if ((window.tabs.get(id) as TabType).private) {
            ipc.send('handoffUpdate', { url: '' })
          } else {
            ipc.send('handoffUpdate', { url: (window.tabs.get(id) as TabType).url })
          }
        }
      })
    }
  },
}
