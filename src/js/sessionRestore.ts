// var browserUI = require('browserUI.js')
import fs from 'node:fs'
import path from 'node:path'

import { ipcRenderer as ipc } from 'electron'

import * as browserUI from './browserUI'
// var webviews = require('webviews.js')
// var tabEditor = require('navbar/tabEditor.js')
import { tabEditor } from './navbar/tabEditor'
// var tabState = require('tabState.js')
import * as tabState from './tabState'
import { TabList } from './tabState/tab'
// var taskOverlay = require('taskOverlay/taskOverlay.js')
import { taskOverlay } from './taskOverlay/taskOverlay'
// var settings = require('util/settings/settings.js')
import { settings } from './util/settings/settings'

// const { tasks } = window
export const sessionRestore = {
  savePath:
    window.globalArgs['user-data-path'] +
    (window.platformType === 'windows' ? '\\sessionRestore.json' : '/sessionRestore.json'),
  previousState: null as null | string,
  save(forceSave: boolean, sync: boolean) {
    // only one window (the focused one) should be responsible for saving session restore data
    if (!document.body.classList.contains('focused')) {
      return
    }

    const stateString = JSON.stringify(window.tasks.getStringifyableState())
    const data = {
      version: 2,
      state: JSON.parse(stateString),
      saveTime: Date.now(),
    }

    // save all tabs that aren't private

    for (let i = 0; i < data.state.tasks.length; i++) {
      data.state.tasks[i].tabs = data.state.tasks[i].tabs.filter((tab: TabType) => {
        return !tab.private
      })
    }

    // if startupTabOption is "open a new blank task", don't save any tabs in the current task
    if (settings.get('startupTabOption') === 3) {
      for (let i = 0; i < data.state.tasks.length; i++) {
        if (window.tasks.get(data.state.tasks[i].id)!.selectedInWindow) {
          // need to re-fetch the task because temporary properties have been removed
          data.state.tasks[i].tabs = []
        }
      }
    }

    if (forceSave === true || stateString !== sessionRestore.previousState) {
      if (sync === true) {
        fs.writeFileSync(sessionRestore.savePath, JSON.stringify(data))
      } else {
        fs.writeFile(sessionRestore.savePath, JSON.stringify(data), (err) => {
          if (err) {
            console.warn(err)
          }
        })
      }
      sessionRestore.previousState = stateString
    }
  },
  restoreFromFile() {
    let savedStringData
    try {
      savedStringData = fs.readFileSync(sessionRestore.savePath, 'utf-8')
    } catch (e) {
      console.warn('failed to read session restore data', e)
    }

    const startupConfigOption = settings.get('startupTabOption') || 2
    /*
    1 - reopen last task
    2 - open new task, keep old tabs in background
    3 - discard old tabs and open new task
    */

    /*
    Disabled - show a user survey on startup
    // the survey should only be shown after an upgrade from an earlier version
    var shouldShowSurvey = false
    if (savedStringData && !localStorage.getItem('1.15survey')) {
      shouldShowSurvey = true
    }
    localStorage.setItem('1.15survey', 'true')
    */

    try {
      // first run, show the tour
      if (!savedStringData) {
        window.tasks.setSelected(window.tasks.add()) // create a new task

        const newTab = (window.tasks.getSelected()!.tabs as TabList).add({
          url: 'https://minbrowser.github.io/min/tour',
        })
        browserUI.addTab(newTab, {
          enterEditMode: false,
        })
        return
      }

      const data = JSON.parse(savedStringData)

      // the data isn't restorable
      if ((data.version && data.version !== 2) || (data.state && data.state.tasks && data.state.tasks.length === 0)) {
        window.tasks.setSelected(window.tasks.add())

        browserUI.addTab((window.tasks.getSelected()!.tabs as TabList).add())
        return
      }

      // add the saved tasks

      data.state.tasks.forEach((task: TaskType) => {
        // restore the task item
        window.tasks.add(task)

        /*
        If the task contained only private tabs, none of the tabs will be contained in the session restore data, but tasks must always have at least 1 tab, so create a new empty tab if the task doesn't have any.
        */
        if ((task.tabs as TabType[]).length === 0) {
          ;(window.tasks.get(task.id!)!.tabs as TabList).add()
        }
      })

      const mostRecentTasks = window.tasks.slice().sort((a, b) => {
        return window.tasks.getLastActivity(b.id!) - window.tasks.getLastActivity(a.id!)
      })
      if (mostRecentTasks.length > 0) {
        window.tasks.setSelected(mostRecentTasks[0].id!)
      }

      // switch to the previously selected tasks

      if ((window.tasks.getSelected()!.tabs as TabList).isEmpty() || startupConfigOption === 1) {
        browserUI.switchToTask(mostRecentTasks[0].id!)
        if ((window.tasks.getSelected()!.tabs as TabList).isEmpty()) {
          tabEditor.show((window.tasks.getSelected()!.tabs as TabList).getSelected()!)
        }
      } else {
        window.createdNewTaskOnStartup = true
        // try to reuse a previous empty task
        const lastTask = window.tasks.byIndex(window.tasks.getLength() - 1)
        if (lastTask && (lastTask.tabs as TabList).isEmpty() && !lastTask.name) {
          browserUI.switchToTask(lastTask.id!)
          tabEditor.show((lastTask.tabs as TabList).getSelected()!)
        } else {
          browserUI.addTask()
        }
      }

      /* Disabled - show user survey
      // if this isn't the first run, and the survey popup hasn't been shown yet, show it
      if (shouldShowSurvey) {
        fetch('https://minbrowser.org/survey/survey15.json').then(function (response) {
          return response.json()
        }).then(function (data) {
          setTimeout(function () {
            if (data.available && data.url) {
              if (tasks.getSelected().tabs.isEmpty()) {
                webviews.update(tasks.getSelected().tabs.getSelected(), data.url)
                tabEditor.hide()
              } else {
                var surveyTab = tasks.getSelected().tabs.add({
                  url: data.url
                })
                browserUI.addTab(surveyTab, {
                  enterEditMode: false
                })
              }
            }
          }, 200)
        })
      }
      */
    } catch (e) {
      // an error occured while restoring the session data

      console.error('restoring session failed: ', e)

      const backupSavePath = path.join(window.globalArgs['user-data-path'], `sessionRestoreBackup-${Date.now()}.json`)

      fs.writeFileSync(backupSavePath, savedStringData!)

      // destroy any tabs that were created during the restore attempt
      tabState.initialize()

      // create a new tab with an explanation of what happened
      const newTask = window.tasks.add()
      const newSessionErrorTab = (window.tasks.get(newTask)!.tabs as TabList).add({
        url: `min://app/pages/sessionRestoreError/index.html?backupLoc=${encodeURIComponent(backupSavePath)}`,
      })

      browserUI.switchToTask(newTask)
      browserUI.switchToTab(newSessionErrorTab)
    }
  },
  syncWithWindow() {
    const data = ipc.sendSync('request-tab-state')
    console.log('got from window', data)

    data.tasks.forEach((task: TaskType) => {
      // restore the task item
      window.tasks.add(task, undefined, false)
    })
    // reuse an existing task or create a new task in this window
    // same as windowSync.js
    const newTaskCandidates = window.tasks
      .filter((task) => (task.tabs as TabList).isEmpty() && !task.selectedInWindow && !task.name)
      .sort((a, b) => {
        return window.tasks.getLastActivity(b.id!) - window.tasks.getLastActivity(a.id!)
      })
    if (newTaskCandidates.length > 0) {
      browserUI.switchToTask(newTaskCandidates[0].id!)
      tabEditor.show((window.tasks.getSelected()!.tabs as TabList).getSelected()!)
    } else {
      browserUI.addTask()
    }
  },
  restore() {
    if (Object.hasOwn(window.globalArgs, 'initial-window')) {
      sessionRestore.restoreFromFile()
    } else {
      sessionRestore.syncWithWindow()
    }
    if (settings.get('newWindowOption') === 2 && !Object.hasOwn(window.globalArgs, 'launch-window')) {
      taskOverlay.show()
    }
  },
  initialize() {
    setInterval(sessionRestore.save, 30000)

    window.onbeforeunload = (_e) => {
      sessionRestore.save(true, true)
      // workaround for notifying the other windows that the task open in this window isn't open anymore.
      // This should ideally be done in windowSync, but it needs to run synchronously, which windowSync doesn't
      ipc.send('tab-state-change', [['task-updated', window.tasks.getSelected()!.id, 'selectedInWindow', null]])
    }

    ipc.on('read-tab-state', (_e) => {
      ipc.send('return-tab-state', window.tasks.getCopyableState())
    })
  },
}

// module.exports = sessionRestore
