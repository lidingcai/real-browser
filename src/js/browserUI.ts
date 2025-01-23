// var statistics = require('js/statistics.js')
// var focusMode = require('focusMode.js')
import { ipcRenderer as ipc } from 'electron'

import focusMode from './focusMode'
// var tabBar = require('navbar/tabBar.js')
import { tabBar } from './navbar/tabBar'
// var tabEditor = require('navbar/tabEditor.js')
import { tabEditor } from './navbar/tabEditor'
// var searchbar = require('searchbar/searchbar.js')
import { searchbar } from './searchbar/searchbar'
import { statistics } from './statistics'
import { TabList } from './tabState/tab'
// var searchEngine = require('js/util/searchEngine.js')
import { searchEngine } from './util/searchEngine'
/* common actions that affect different parts of the UI (webviews, tabstrip, etc) */
// var settings = require('util/settings/settings.js')
import { settings } from './util/settings/settings'
// var urlParser = require('js/util/urlParser.js')
import { urlParser } from './util/urlParser'
// var webviews = require('webviews.js')
import { webviews } from './webviews'
/* creates a new task */

export function addTask() {
  // insert after current task
  let index
  if (window.tasks.getSelected()) {
    index = window.tasks.getIndex(window.tasks.getSelected()!.id!) + 1
  }
  window.tasks.setSelected(window.tasks.add({}, index!))

  tabBar.updateAll()
  addTab()
}

/* creates a new tab */

/*
options
  options.enterEditMode - whether to enter editing mode when the tab is created. Defaults to true.
  options.openInBackground - whether to open the tab without switching to it. Defaults to false.
*/
export function addTab(
  tabId = window.tabs.add(),
  options: { enterEditMode?: boolean; openInBackground?: boolean } = {},
) {
  /*
  adding a new tab should destroy the current one if either:
  * The current tab is an empty, non-private tab, and the new tab is private
  * The current tab is empty, and the new tab has a URL
  */

  if (
    !options.openInBackground &&
    !(window.tabs.get(window.tabs.getSelected()!) as TabType).url &&
    ((!(window.tabs.get(window.tabs.getSelected()!) as TabType).private &&
      (window.tabs.get(tabId) as TabType).private) ||
      (window.tabs.get(tabId) as TabType).url)
  ) {
    destroyTab(window.tabs.getSelected()!)
  }

  tabBar.addTab(tabId)
  webviews.add(tabId)

  if (!options.openInBackground) {
    switchToTab(tabId, {
      focusWebview: options.enterEditMode === false,
    })
    if (options.enterEditMode !== false) {
      tabEditor.show(tabId)
    }
  } else {
    tabBar.getTab(tabId).scrollIntoView()
  }
}

export function moveTabLeft(tabId = window.tabs.getSelected()!) {
  window.tabs.moveBy(tabId, -1)
  tabBar.updateAll()
}

export function moveTabRight(tabId = window.tabs.getSelected()!) {
  window.tabs.moveBy(tabId, 1)
  tabBar.updateAll()
}

/* destroys a task object and the associated webviews */

export function destroyTask(id: string) {
  const task = window.tasks.get(id)!

  task.tabs!.forEach((tab) => {
    webviews.destroy(tab.id!)
  })

  window.tasks.destroy(id)
}

/* destroys the webview and tab element for a tab */
export function destroyTab(id: string) {
  tabBar.removeTab(id)
  window.tabs.destroy(id) // remove from state - returns the index of the destroyed tab
  webviews.destroy(id) // remove the webview
}

/* destroys a task, and either switches to the next most-recent task or creates a new one */

export function closeTask(taskId: string) {
  const previousCurrentTask = window.tasks.getSelected()!.id

  destroyTask(taskId)

  if (taskId === previousCurrentTask) {
    // the current task was destroyed, find another task to switch to

    if (window.tasks.getLength() === 0) {
      // there are no tasks left, create a new one
      addTask()
    } else {
      // switch to the most-recent task

      const recentTaskList = window.tasks.map((task) => {
        return { id: task.id!, lastActivity: window.tasks.getLastActivity(task.id!) }
      }) as { id: string; lastActivity: number }[]

      const mostRecent = recentTaskList.reduce((latest, current) =>
        current.lastActivity > latest.lastActivity ? current : latest,
      )

      switchToTask(mostRecent.id)
    }
  }
}

/* destroys a tab, and either switches to the next tab or creates a new one */

export function closeTab(tabId: string) {
  /* disabled in focus mode */
  if (focusMode.enabled()) {
    focusMode.warn()
    return
  }

  if (tabId === window.tabs.getSelected()) {
    const currentIndex = window.tabs.getIndex(window.tabs.getSelected()!)
    const nextTab = window.tabs.getAtIndex(currentIndex - 1) || window.tabs.getAtIndex(currentIndex + 1)

    destroyTab(tabId)

    if (nextTab) {
      switchToTab(nextTab.id!)
    } else {
      addTab()
    }
  } else {
    destroyTab(tabId)
  }
}

/* changes the currently-selected task and updates the UI */

function setWindowTitle(taskData: TaskType) {
  if (taskData.name) {
    document.title = taskData.name.length > 100 ? `${taskData.name.substring(0, 100)}...` : taskData.name
  } else {
    document.title = 'Min'
  }
}

export function switchToTask(id: string) {
  window.tasks.setSelected(id)

  tabBar.updateAll()

  const taskData = window.tasks.get(id)!

  if ((taskData.tabs as TabList).count() > 0) {
    let selectedTab = (taskData.tabs as TabList).getSelected()

    // if the task has no tab that is selected, switch to the most recent one

    if (!selectedTab) {
      selectedTab = ((taskData.tabs as TabList).get() as TabType[]).sort((a, b) => {
        return b.lastActivity! - a.lastActivity!
      })[0].id
    }

    switchToTab(selectedTab!)
  } else {
    addTab()
  }

  setWindowTitle(taskData)
}
/*
window.tasks.on('task-updated', (id: string, key: string) => {
  if (key === 'name' && id === window.tasks.getSelected()!.id) {
    setWindowTitle(window.tasks.get(id)!)
  }
})
*/

/* switches to a tab - update the webview, state, tabstrip, etc. */

export function switchToTab(id: string, options: { focusWebview?: any } | undefined = undefined) {
  options = options || {}

  window.tabs.setSelected(id)
  tabBar.setActiveTab(id)
  webviews.setSelected(id, {
    focus: options.focusWebview !== false,
  })

  tabEditor.hide()

  if (!(window.tabs.get(id) as TabType).url) {
    document.body.classList.add('is-ntp')
  } else {
    document.body.classList.remove('is-ntp')
  }
}
/*
window.tasks.on('tab-updated', (id: string, key: string) => {
  if (key === 'url' && id === window.tabs.getSelected()) {
    document.body.classList.remove('is-ntp')
  }
})

webviews.bindEvent('did-create-popup', (tabId: string, popupId: string, initialURL: string) => {
  const popupTab = window.tabs.add({
    // in most cases, initialURL will be overwritten once the popup loads, but if the URL is a downloaded file, it will remain the same
    url: initialURL,
    private: (window.tabs.get(tabId) as TabType).private,
  })
  tabBar.addTab(popupTab)
  webviews.add(popupTab, popupId)
  switchToTab(popupTab)
})

webviews.bindEvent('new-tab', (tabId: string, url: string, openInForeground: boolean) => {
  const newTab = window.tabs.add({
    url,
    private: (window.tabs.get(tabId) as TabType).private, // inherit private status from the current tab
  })

  addTab(newTab, {
    enterEditMode: false,
    openInBackground: !settings.get('openTabsInForeground') && !openInForeground,
  })
})

webviews.bindIPC('close-window', (tabId: string) => {
  closeTab(tabId)
})

ipc.on('set-file-view', (e, data) => {
  ;(window.tabs.get() as TabType[]).forEach((tab) => {
    if (tab.url === data.url) {
      window.tabs.update(tab.id!, { isFileView: data.isFileView })
    }
  })
})

searchbar.events.on('url-selected', (data) => {
  const searchbarQuery = searchEngine.getSearch(urlParser.parse(data.url))
  if (searchbarQuery) {
    statistics.incrementValue(`searchCounts.${searchbarQuery.engine}`)
  }

  if (data.background) {
    const newTab = window.tabs.add({
      url: data.url,
      private: (window.tabs.get(window.tabs.getSelected()!) as TabType).private,
    })
    addTab(newTab, {
      enterEditMode: false,
      openInBackground: true,
    })
  } else {
    webviews.update(window.tabs.getSelected()!, data.url)
    tabEditor.hide()
  }
})

tabBar.events.on('tab-selected', (id: string) => {
  switchToTab(id)
})

tabBar.events.on('tab-closed', (id: string) => {
  closeTab(id)
})
*/
export function initialize() {
  window.tasks.on('task-updated', (id: string, key: string) => {
    if (key === 'name' && id === window.tasks.getSelected()!.id) {
      setWindowTitle(window.tasks.get(id)!)
    }
  })
  window.tasks.on('tab-updated', (id: string, key: string) => {
    if (key === 'url' && id === window.tabs.getSelected()) {
      document.body.classList.remove('is-ntp')
    }
  })

  webviews.bindEvent('did-create-popup', (tabId: string, popupId: string, initialURL: string) => {
    const popupTab = window.tabs.add({
      // in most cases, initialURL will be overwritten once the popup loads, but if the URL is a downloaded file, it will remain the same
      url: initialURL,
      private: (window.tabs.get(tabId) as TabType).private,
    })
    tabBar.addTab(popupTab)
    webviews.add(popupTab, popupId)
    switchToTab(popupTab)
  })

  webviews.bindEvent('new-tab', (tabId: string, url: string, openInForeground: boolean) => {
    const newTab = window.tabs.add({
      url,
      private: (window.tabs.get(tabId) as TabType).private, // inherit private status from the current tab
    })

    addTab(newTab, {
      enterEditMode: false,
      openInBackground: !settings.get('openTabsInForeground') && !openInForeground,
    })
  })

  webviews.bindIPC('close-window', (tabId: string) => {
    closeTab(tabId)
  })

  ipc.on('set-file-view', (e, data) => {
    ;(window.tabs.get() as TabType[]).forEach((tab) => {
      if (tab.url === data.url) {
        window.tabs.update(tab.id!, { isFileView: data.isFileView })
      }
    })
  })

  searchbar.events.on('url-selected', (data) => {
    const searchbarQuery = searchEngine.getSearch(urlParser.parse(data.url))
    if (searchbarQuery) {
      statistics.incrementValue(`searchCounts.${searchbarQuery.engine}`)
    }

    if (data.background) {
      const newTab = window.tabs.add({
        url: data.url,
        private: (window.tabs.get(window.tabs.getSelected()!) as TabType).private,
      })
      addTab(newTab, {
        enterEditMode: false,
        openInBackground: true,
      })
    } else {
      webviews.update(window.tabs.getSelected()!, data.url)
      tabEditor.hide()
    }
  })

  tabBar.events.on('tab-selected', (id: string) => {
    switchToTab(id)
  })

  tabBar.events.on('tab-closed', (id: string) => {
    closeTab(id)
  })
}
/*
export default {
  addTask,
  addTab,
  destroyTask,
  destroyTab,
  closeTask,
  closeTab,
  switchToTask,
  switchToTab,
  moveTabLeft,
  moveTabRight,
}
*/
/*
module.exports = {
  addTask,
  addTab,
  destroyTask,
  destroyTab,
  closeTask,
  closeTab,
  switchToTask,
  switchToTab,
  moveTabLeft,
  moveTabRight
}
*/
