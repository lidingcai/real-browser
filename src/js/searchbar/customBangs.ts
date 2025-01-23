/* list of the available custom !bangs */

import fs from 'node:fs'

import { ipcRenderer as ipc, ipcRenderer } from 'electron'

import { l } from '../../locales'
// const bookmarkConverter = require('bookmarkConverter.js')
import { bookmarkConverter } from '../bookmarkConverter'
// const browserUI = require('browserUI.js')
import * as browserUI from '../browserUI'
// const focusMode = require('focusMode.js')
import focusMode from '../focusMode'
// const contentBlockingToggle = require('navbar/contentBlockingToggle.js')
import { contentBlockingToggle } from '../navbar/contentBlockingToggle'
// const tabEditor = require('navbar/tabEditor.js')
import { tabEditor } from '../navbar/tabEditor'
// const places = require('places/places.js')
import { places } from '../places/places'
import { TabList } from '../tabState/tab'
// const taskOverlay = require('taskOverlay/taskOverlay.js')
import { taskOverlay } from '../taskOverlay/taskOverlay'
// const formatRelativeDate = require('util/relativeDate.js')
import { formatRelativeDate } from '../util/relativeDate'
// const webviews = require('webviews.js')
import { webviews } from '../webviews'
// const bangsPlugin = require('searchbar/bangsPlugin.js')
import * as bangsPlugin from './bangsPlugin'
// const searchbarPlugins = require('searchbar/searchbarPlugins.js')
import { searchbarPlugins } from './searchbarPlugins'

// const { tasks, tabs } = window
function moveToTaskCommand(taskId: string) {
  // remove the tab from the current task

  const currentTab = window.tabs.get(window.tabs.getSelected()!) as TabType
  window.tabs.destroy(currentTab.id!)

  // make sure the task has at least one tab in it
  if (window.tabs.count() === 0) {
    window.tabs.add()
  }

  const newTask = window.tasks.get(taskId) as TaskType

  ;(newTask.tabs as TabList).add(currentTab, { atEnd: true })

  browserUI.switchToTask(newTask.id!)
  browserUI.switchToTab(currentTab.id!)

  taskOverlay.show()

  setTimeout(() => {
    taskOverlay.hide()
  }, 600)
}

function switchToTaskCommand(taskId: string) {
  /* disabled in focus mode */
  if (focusMode.enabled()) {
    focusMode.warn()
    return
  }

  // no task was specified, show all of the tasks
  if (!taskId) {
    taskOverlay.show()
    return
  }

  browserUI.switchToTask(taskId)
}

// returns a task with the same name or index ("1" returns the first task, etc.)
function getTaskByNameOrNumber(text: string) {
  const textAsNumber = parseInt(text, 10)

  return window.tasks.find(
    (task, index) => (task.name && task.name.toLowerCase() === text) || index + 1 === textAsNumber,
  )
}

// return an array of tasks sorted by last activity
// if a search string is present, filter the results with a basic fuzzy search
function searchAndSortTasks(text: string) {
  let taskResults = window.tasks
    .filter((t) => t.id !== window.tasks.getSelected()!.id)
    .map((t) => ({ task: t, lastActivity: window.tasks.getLastActivity(t.id!) }))

  taskResults = taskResults.sort((a, b) => {
    return b.lastActivity - a.lastActivity
  })

  if (text !== '') {
    // fuzzy search
    const searchText = text.toLowerCase()

    taskResults = taskResults.filter((t) => {
      const { task } = t
      const taskName = (
        task.name
          ? task.name
          : l('defaultTaskName').replace('%n', (window.tasks.getIndex(task.id!) + 1) as unknown as string)
      ).toLowerCase()
      const exactMatch = taskName.indexOf(searchText) !== -1
      // const fuzzyTitleScore = taskName.score(searchText, 0.5)
      // I think it's wrong code, cause string.score is impossible
      const fuzzyTitleScore = 0
      return exactMatch || fuzzyTitleScore > 0.4
    })
  }

  return taskResults
}

export function initialize() {
  bangsPlugin.registerCustomBang({
    phrase: '!settings',
    snippet: l('viewSettings'),
    isAction: true,
    fn() {
      webviews.update(window.tabs.getSelected()!, 'min://settings')
    },
  })

  bangsPlugin.registerCustomBang({
    phrase: '!back',
    snippet: l('goBack'),
    isAction: true,
    fn() {
      webviews.callAsync(window.tabs.getSelected()!, 'goBack')
    },
  })

  bangsPlugin.registerCustomBang({
    phrase: '!forward',
    snippet: l('goForward'),
    isAction: true,
    fn() {
      webviews.callAsync(window.tabs.getSelected()!, 'goForward')
    },
  })

  bangsPlugin.registerCustomBang({
    phrase: '!screenshot',
    snippet: l('takeScreenshot'),
    isAction: true,
    fn() {
      setTimeout(() => {
        // wait so that the view placeholder is hidden
        ipcRenderer.send('saveViewCapture', { id: window.tabs.getSelected() })
      }, 400)
    },
  })

  bangsPlugin.registerCustomBang({
    phrase: '!clearhistory',
    snippet: l('clearHistory'),
    isAction: true,
    fn() {
      // eslint-disable-next-line no-restricted-globals, no-alert
      if (confirm(l('clearHistoryConfirmation'))) {
        places.deleteAllHistory()
        ipc.invoke('clearStorageData')
      }
    },
  })

  bangsPlugin.registerCustomBang({
    phrase: '!enableblocking',
    snippet: l('enableBlocking'),
    isAction: true,
    fn() {
      contentBlockingToggle.enableBlocking((window.tabs.get(window.tabs.getSelected()!) as TabType).url!)
    },
  })

  bangsPlugin.registerCustomBang({
    phrase: '!disableblocking',
    snippet: l('disableBlocking'),
    isAction: true,
    fn() {
      contentBlockingToggle.disableBlocking((window.tabs.get(window.tabs.getSelected()!) as TabType).url!)
    },
  })

  bangsPlugin.registerCustomBang({
    phrase: '!movetotask',
    snippet: l('moveToTask'),
    isAction: false,
    showSuggestions(text: string, _input: HTMLInputElement, _event: Event) {
      searchbarPlugins.reset('bangs')

      const taskResults = searchAndSortTasks(text)

      taskResults.forEach((t, idx) => {
        const { task } = t
        const { lastActivity } = t

        const taskName = task.name
          ? task.name
          : l('defaultTaskName').replace('%n', (window.tasks.getIndex(task.id!) + 1) as unknown as string)

        const data = {
          title: taskName,
          secondaryText: formatRelativeDate(lastActivity),
          fakeFocus: !!text && idx === 0,
          click() {
            tabEditor.hide()

            /* disabled in focus mode */
            if (focusMode.enabled()) {
              focusMode.warn()
              return
            }

            moveToTaskCommand(task.id!)
          },
        }

        searchbarPlugins.addResult('bangs', data)
      })
    },

    fn(text: string) {
      /* disabled in focus mode */
      if (focusMode.enabled()) {
        focusMode.warn()
        return
      }

      // use the first search result
      // if there is no search text or no result, need to create a new task
      let task = searchAndSortTasks(text)[0]?.task
      if (!text || !task) {
        task = window.tasks.get(
          window.tasks.add(
            {
              name: text,
            },
            window.tasks.getIndex(window.tasks.getSelected()!.id!) + 1,
          ),
        )!
      }

      moveToTaskCommand(task.id!)
    },
  })

  bangsPlugin.registerCustomBang({
    phrase: '!task',
    snippet: l('switchToTask'),
    isAction: false,
    showSuggestions(text: string, _input: HTMLInputElement, _event: Event) {
      searchbarPlugins.reset('bangs')

      const taskResults = searchAndSortTasks(text)

      taskResults.forEach((t, idx) => {
        const { task } = t
        const { lastActivity } = t

        const taskName = task.name
          ? task.name
          : l('defaultTaskName').replace('%n', (window.tasks.getIndex(task.id!) + 1) as unknown as string)

        const data = {
          title: taskName,
          secondaryText: formatRelativeDate(lastActivity),
          fakeFocus: !!text && idx === 0,
          click() {
            tabEditor.hide()
            switchToTaskCommand(task.id!)
          },
        }

        searchbarPlugins.addResult('bangs', data)
      })
    },
    fn(text: string) {
      if (text) {
        // switch to the first search result
        switchToTaskCommand(searchAndSortTasks(text)[0].task.id!)
      } else {
        taskOverlay.show()
      }
    },
  })

  bangsPlugin.registerCustomBang({
    phrase: '!newtask',
    snippet: l('createTask'),
    isAction: true,
    fn(text: string) {
      /* disabled in focus mode */
      if (focusMode.enabled()) {
        focusMode.warn()
        return
      }

      taskOverlay.show()

      setTimeout(() => {
        browserUI.addTask()
        if (text) {
          window.tasks.update(window.tasks.getSelected()!.id!, { name: text })
        }
      }, 600)
    },
  })

  bangsPlugin.registerCustomBang({
    phrase: '!closetask',
    snippet: l('closeTask'),
    isAction: false,
    fn(text: string) {
      const currentTask = window.tasks.getSelected()!
      let taskToClose

      if (text) {
        taskToClose = getTaskByNameOrNumber(text)
      } else {
        taskToClose = window.tasks.getSelected()
      }

      if (taskToClose) {
        browserUI.closeTask(taskToClose.id!)
        if (currentTask.id === taskToClose.id) {
          taskOverlay.show()
          setTimeout(() => {
            taskOverlay.hide()
          }, 600)
        }
      }
    },
  })

  bangsPlugin.registerCustomBang({
    phrase: '!nametask',
    snippet: l('nameTask'),
    isAction: false,
    fn(text: string) {
      window.tasks.update(window.tasks.getSelected()!.id!, { name: text })
    },
  })

  bangsPlugin.registerCustomBang({
    phrase: '!importbookmarks',
    snippet: l('importBookmarks'),
    isAction: true,
    async fn() {
      const filePath = await ipc.invoke('showOpenDialog', {
        filters: [{ name: 'HTML files', extensions: ['htm', 'html'] }],
      })

      if (!filePath) {
        return
      }
      fs.readFile(filePath[0], 'utf-8', (err, data) => {
        if (err || !data) {
          console.warn(err)
          return
        }
        bookmarkConverter.import(data)
      })
    },
  })

  bangsPlugin.registerCustomBang({
    phrase: '!exportbookmarks',
    snippet: l('exportBookmarks'),
    isAction: true,
    async fn() {
      const data = await bookmarkConverter.exportAll()
      // save the result
      const savePath = await ipc.invoke('showSaveDialog', { defaultPath: 'bookmarks.html' })
      fs.writeFileSync(savePath, data)
    },
  })

  bangsPlugin.registerCustomBang({
    phrase: '!addbookmark',
    snippet: l('addBookmark'),
    fn(text: string) {
      const { url } = window.tabs.get(window.tabs.getSelected()!) as TabType
      if (url) {
        places.updateItem(
          url,
          {
            isBookmarked: true,
            tags: text ? text.split(/\s/g).map((t) => t.replace('#', '').trim()) : [],
          },
          () => {},
        )
      }
    },
  })
}

// module.exports = { initialize }
