// const browserUI = require('browserUI.js')
// const taskOverlay = require('taskOverlay/taskOverlay.js')
import { ipcRenderer as ipc } from 'electron'

import * as browserUI from '../browserUI'
import { taskOverlay } from '../taskOverlay/taskOverlay'
import { TabList } from './tab'

// const { tasks, tabs } = window
export const windowSync = {
  pendingEvents: [] as (string | any)[][],
  syncTimeout: null as null | NodeJS.Timeout,
  sendEvents() {
    ipc.send('tab-state-change', windowSync.pendingEvents)
    windowSync.pendingEvents = []
    windowSync.syncTimeout = null
  },
  initialize() {
    window.tasks.on('*', (...data: any[]) => {
      if (data[0] === 'state-sync-change') {
        return
      }
      windowSync.pendingEvents.push(data)
      if (!windowSync.syncTimeout) {
        windowSync.syncTimeout = setTimeout(windowSync.sendEvents, 0)
      }
    })

    ipc.on('tab-state-change-receive', (e, data) => {
      const { sourceWindowId, events } = data
      events.forEach((event: string[] | any[]) => {
        const priorSelectedTask = window.tasks.getSelected()!.id

        // close window if its task is destroyed
        if (
          (event[0] === 'task-destroyed' && event[1] === priorSelectedTask) ||
          (event[0] === 'tab-destroyed' &&
            event[2] === priorSelectedTask &&
            (window.tasks.getSelected()!.tabs as TabList).count() === 1)
        ) {
          ipc.invoke('close')
          ipc.removeAllListeners('tab-state-change-receive')
          return
        }
        const obj: Record<any, any> = {}
        switch (event[0]) {
          case 'task-added':
            window.tasks.add(event[2], event[3], false)
            break
          case 'task-selected':
            window.tasks.setSelected(event[1], false, sourceWindowId)
            break
          case 'task-destroyed':
            window.tasks.destroy(event[1], false)
            break
          case 'tab-added':
            ;(window.tasks.get(event[4])!.tabs as TabList).add(event[2], event[3], false)
            break
          case 'tab-updated':
            // eslint-disable-next-line prefer-destructuring
            obj[event[2]] = event[3]
            ;(window.tasks.get(event[4])!.tabs as TabList).update(event[1], obj, false)
            break
          case 'task-updated':
            // eslint-disable-next-line prefer-destructuring
            obj[event[2]] = event[3]
            window.tasks.update(event[1], obj, false)
            break
          case 'tab-selected':
            ;(window.tasks.get(event[2])!.tabs as TabList).setSelected(event[1], false)
            break
          case 'tab-destroyed':
            ;(window.tasks.get(event[2])!.tabs as TabList).destroy(event[1], false)
            break
          case 'tab-splice':
            // eslint-disable-next-line no-case-declarations
            const otherArray = event.slice(2)
            ;(window.tasks.get(event[1])!.tabs as TabList).spliceNoEmit(otherArray[0], otherArray[1])
            //            tasks.get(event[1]).tabs.spliceNoEmit(...event.slice(2))
            break
          case 'state-sync-change':
            break
          default:
            // eslint-disable-next-line prefer-rest-params
            console.warn(arguments)
            throw new Error('unimplemented event')
        }

        // UI updates

        if (event[0] === 'task-selected' && event[1] === priorSelectedTask) {
          // our task is being taken by another window
          // switch to an empty task not open in any window, if possible
          const newTaskCandidates = window.tasks
            .filter((task) => (task.tabs as TabList).isEmpty() && !task.selectedInWindow && !task.name)
            .sort((a, b) => {
              return window.tasks.getLastActivity(b.id!) - window.tasks.getLastActivity(a.id!)
            })
          if (newTaskCandidates.length > 0) {
            browserUI.switchToTask(newTaskCandidates[0].id!)
          } else {
            browserUI.addTask()
          }
          taskOverlay.show()
        }
        // if a tab was added or removed from our task, force a rerender
        if (
          (event[0] === 'tab-splice' && event[1] === priorSelectedTask) ||
          (event[0] === 'tab-destroyed' && event[2] === priorSelectedTask)
        ) {
          browserUI.switchToTask(window.tasks.getSelected()!.id!)
          browserUI.switchToTab(window.tabs.getSelected()!)
        }
      })

      window.tasks.emit('state-sync-change')
    })
  },
}
// module.exports = windowSync
