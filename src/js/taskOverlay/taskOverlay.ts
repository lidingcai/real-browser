import { ipcRenderer } from 'electron'
import Sortable from 'sortablejs'

import { l } from '../../locales'
import * as browserUI from '../browserUI'
import focusMode from '../focusMode'
import * as keybindings from '../keybindings'
import { modalMode } from '../modalMode'
import { tabBar } from '../navbar/tabBar'
import { tabEditor } from '../navbar/tabEditor'
import { TabList } from '../tabState/tab'
import { keyboardNavigationHelper } from '../util/keyboardNavigationHelper'
import { webviews } from '../webviews'
import { createTaskContainer } from './taskOverlayBuilder'

/*
var webviews = require('webviews.js')
var keybindings = require('keybindings.js')

var browserUI = require('browserUI.js')

var tabBar = require('navbar/tabBar.js')

var tabEditor = require('navbar/tabEditor.js')

var focusMode = require('focusMode.js')

var modalMode = require('modalMode.js')

var keyboardNavigationHelper = require('util/keyboardNavigationHelper.js')

const Sortable = require('sortablejs')

const createTaskContainer = require('taskOverlay/taskOverlayBuilder.js')
*/
/*
const taskContainer = document.getElementById('task-area')!
const taskSwitcherButton = document.getElementById('switch-task-button')!
const addTaskButton = document.getElementById('add-task')!
const addTaskLabel = addTaskButton.querySelector('span')!
const taskOverlayNavbar = document.getElementById('task-overlay-navbar')!
const { tasks, tabs, empty } = window
*/
function addTaskFromMenu() {
  /* new tasks can't be created in modal mode */
  if (modalMode.enabled()) {
    return
  }

  /* new tasks can't be created in focus mode or modal mode */
  if (focusMode.enabled()) {
    focusMode.warn()
    return
  }

  browserUI.addTask()
  taskOverlay.show()
  setTimeout(() => {
    taskOverlay.hide()
    tabEditor.show(window.tabs.getSelected()!)
  }, 600)
}

function getTaskContainer(id: string) {
  return document.querySelector('.task-container[data-task="{id}"]'.replace('{id}', id))
}

export const taskOverlay = {
  taskContainer: null as unknown as HTMLElement,
  taskSwitcherButton: null as unknown as HTMLElement,
  addTaskButton: null as unknown as HTMLElement,
  addTaskLabel: null as unknown as HTMLElement,
  taskOverlayNavbar: null as unknown as HTMLElement,
  overlayElement: null as unknown as HTMLElement,
  isShown: false,
  sortableInstances: [] as Sortable[],
  addTaskDragging() {
    const sortable = new Sortable(taskOverlay.taskContainer, {
      group: 'overlay-tasks',
      draggable: '.task-container',
      ghostClass: 'task-drop-placeholder',
      scroll: true,
      scrollSensitivity: 100,
      forceAutoScrollFallback: true,
      scrollSpeed: 15,
      onEnd(e) {
        const droppedTaskId = e.item.getAttribute('data-task')!
        const insertionPoint = Array.from(taskOverlay.taskContainer.children).indexOf(e.item)

        // remove the task from the tasks list
        const droppedTask = window.tasks.splice(window.tasks.getIndex(droppedTaskId), 1)[0]

        // reinsert the task
        window.tasks.splice(insertionPoint, 0, droppedTask)
      },
    })
    taskOverlay.sortableInstances.push(sortable)
  },
  addTabDragging(el: HTMLElement) {
    const sortable = new Sortable(el, {
      group: 'overlay-tabs',
      draggable: '.task-tab-item',
      ghostClass: 'tab-drop-placeholder',
      multiDrag: true,
      // multiDragKey: window.platformType === 'mac' ? 'Meta' : 'Ctrl',
      selectedClass: 'dragging-selected',
      animation: 200,
      scroll: true,
      scrollSensitivity: 100,
      forceAutoScrollFallback: true,
      scrollSpeed: 15,
      onStart() {
        taskOverlay.overlayElement.classList.add('is-dragging-tab')
      },
      onEnd(e) {
        taskOverlay.overlayElement.classList.remove('is-dragging-tab')

        const items = e.items.length === 0 ? [e.item] : e.items

        const sortedItems = Array.from(e.to.children).filter((item) => items.some((item2) => item2 === item))

        let newTask
        // if dropping on "add task" button, create a new task
        if (e.to === taskOverlay.addTaskButton) {
          // insert after current task
          let index = 0
          if (window.tasks.getSelected()) {
            index = window.tasks.getIndex(window.tasks.getSelected()!.id!) + 1
          }
          newTask = window.tasks.get(window.tasks.add({}, index))
        } else {
          // otherwise, find a source task to add this tab to
          newTask = window.tasks.get(e.to.getAttribute('data-task')!)
        }

        sortedItems.forEach((item) => {
          const tabId = item.getAttribute('data-tab')!
          const previousTask = window.tasks.getTaskContainingTab(tabId)! // note: can't use e.from here, because it contains only a single element and items could be coming from multiple tasks

          const oldTab = (previousTask.tabs as TabList).splice((previousTask.tabs as TabList).getIndex(tabId), 1)[0]

          if (oldTab.selected) {
            // find a new tab in the old task to become the current one
            const mostRecentTab = ((previousTask.tabs as TabList).get() as TabType[]).sort((a, b) => {
              return b.lastActivity! - a.lastActivity!
            })[0]
            if (mostRecentTab) {
              ;(previousTask.tabs as TabList).setSelected(mostRecentTab.id!)
            }

            // shouldn't become selected in the new task
            oldTab.selected = false
          }

          // if the old task has no tabs left in it, destroy it

          if ((previousTask.tabs as TabList).count() === 0) {
            browserUI.closeTask(previousTask.id!)
            getTaskContainer(previousTask.id!)!.remove()
          }

          if (e.to === taskOverlay.addTaskButton) {
            item.remove()
          }

          const newIdx = Array.from(e.to.children).findIndex((t) => t === item)

          // insert the tab at the correct spot
          ;(newTask!.tabs as TabList).splice(newIdx, 0, oldTab)
        })
        tabBar.updateAll()
        taskOverlay.render()
      },
    })
    taskOverlay.sortableInstances.push(sortable)
  },
  show() {
    /* disabled in focus mode */
    if (focusMode.enabled()) {
      focusMode.warn()
      return
    }

    webviews.requestPlaceholder('taskOverlay')

    document.body.classList.add('task-overlay-is-shown')

    tabEditor.hide()
    ;(document.getElementById('task-search-input') as HTMLInputElement).value = ''

    this.isShown = true
    taskOverlay.taskSwitcherButton.classList.add('active')

    taskOverlay.render()

    // un-hide the overlay
    this.overlayElement.hidden = false

    // scroll to the selected element and focus it
    const currentTabElement = document.querySelector(
      '.task-tab-item[data-tab="{id}"]'.replace('{id}', (window.tasks.getSelected()!.tabs as TabList).getSelected()!),
    ) as HTMLElement

    if (currentTabElement) {
      currentTabElement.classList.add('fakefocus')
      currentTabElement.focus()
    }
  },
  render() {
    window.empty(taskOverlay.taskContainer)
    this.sortableInstances.forEach((inst) => inst.destroy())
    this.sortableInstances = []

    taskOverlay.addTabDragging(taskOverlay.addTaskButton)
    taskOverlay.addTaskDragging()

    // show the task elements
    window.tasks.forEach((task, index) => {
      const el = createTaskContainer(task, index, {
        tabSelect() {
          browserUI.switchToTask(task.id!)
          browserUI.switchToTab(el.getAttribute('data-tab')!) // this.getAttribute

          taskOverlay.hide()
        },
        tabDelete(item: HTMLElement) {
          const tabId = item.getAttribute('data-tab')!

          ;((window.tasks.get(task.id!) as TaskType).tabs as TabList).destroy(tabId)
          webviews.destroy(tabId)

          tabBar.updateAll()

          // if there are no tabs left, remove the task
          if ((task.tabs as TabList).count() === 0) {
            // remove the task element from the overlay
            getTaskContainer(task.id!)!.remove()
            // close the task
            browserUI.closeTask(task.id!)
          }
        },
      })

      taskOverlay.taskContainer.appendChild(el)
      taskOverlay.addTabDragging(el.querySelector('.task-tabs-container') as HTMLElement)
    })
  },

  hide() {
    if (this.isShown) {
      this.isShown = false
      this.overlayElement.hidden = true

      // wait until the animation is complete to remove the tab elements
      setTimeout(() => {
        if (!taskOverlay.isShown) {
          window.empty(taskOverlay.taskContainer)
          webviews.hidePlaceholder('taskOverlay')
        }
      }, 250)

      document.body.classList.remove('task-overlay-is-shown')

      // close any tasks that are pending deletion

      const pendingDeleteTasks = document.body.querySelectorAll('.task-container.deleting')
      for (let i = 0; i < pendingDeleteTasks.length; i++) {
        browserUI.closeTask(pendingDeleteTasks[i].getAttribute('data-task')!)
      }

      // if the current tab has been deleted, switch to the most recent one

      if (!window.tabs.getSelected()) {
        const mostRecentTab = (window.tabs.get() as TabType[]).sort((a, b) => {
          return b.lastActivity! - a.lastActivity!
        })[0]

        if (mostRecentTab) {
          browserUI.switchToTab(mostRecentTab.id!)
        }
      }

      // force the UI to rerender
      browserUI.switchToTask(window.tasks.getSelected()!.id!)
      browserUI.switchToTab(window.tabs.getSelected()!)

      taskOverlay.taskSwitcherButton.classList.remove('active')
    }
  },

  toggle() {
    if (this.isShown) {
      this.hide()
    } else {
      this.show()
    }
  },

  initializeSearch() {
    const container = document.querySelector('.task-search-input-container')!
    const input = document.getElementById('task-search-input') as HTMLInputElement

    input.placeholder = `${l('tasksSearchTabs')} (T)`

    container.addEventListener('click', (e) => {
      e.stopPropagation()
      input.focus()
    })

    taskOverlay.overlayElement.addEventListener('keyup', (e) => {
      if (e.key.toLowerCase() === 't' && document.activeElement!.tagName !== 'INPUT') {
        input.focus()
      }
    })

    input.addEventListener('input', (_e) => {
      const search = input.value.toLowerCase().trim()

      if (!search) {
        // reset the overlay
        taskOverlay.render()
        input.focus()
        return
      }

      let totalTabMatches = 0

      window.tasks.forEach((task) => {
        const taskContainer = document.querySelector(`.task-container[data-task="${task.id}"]`) as HTMLElement

        let taskTabMatches = 0
        task.tabs!.forEach((tab) => {
          const tabContainer = document.querySelector(`.task-tab-item[data-tab="${tab.id}"]`) as HTMLElement

          const searchText = `${task.name} ${tab.title} ${tab.url}`.toLowerCase()

          const searchMatches = search.split(' ').every((word) => searchText.includes(word))
          if (searchMatches) {
            tabContainer.hidden = false
            taskTabMatches++
            totalTabMatches++

            if (totalTabMatches === 1) {
              // first match
              tabContainer.classList.add('fakefocus')
            } else {
              tabContainer.classList.remove('fakefocus')
            }
          } else {
            tabContainer.hidden = true
          }
        })

        if (taskTabMatches === 0) {
          taskContainer.hidden = true
        } else {
          taskContainer.hidden = false
          taskContainer.classList.remove('collapsed')
        }
      })
    })

    input.addEventListener('keypress', (e) => {
      if (e.keyCode === 13) {
        const firstTab = taskOverlay.overlayElement.querySelector('.task-tab-item:not([hidden])') as HTMLElement
        if (firstTab) {
          firstTab.click()
        }
      }
    })
  },
  initialize() {
    taskOverlay.taskContainer = document.getElementById('task-area')!
    taskOverlay.taskSwitcherButton = document.getElementById('switch-task-button')!
    taskOverlay.addTaskButton = document.getElementById('add-task')!
    taskOverlay.addTaskLabel = taskOverlay.addTaskButton.querySelector('span')!
    taskOverlay.taskOverlayNavbar = document.getElementById('task-overlay-navbar')!
    taskOverlay.overlayElement = document.getElementById('task-overlay')!

    taskOverlay.initializeSearch()

    keyboardNavigationHelper.addToGroup('taskOverlay', taskOverlay.overlayElement)

    // swipe down on the tabstrip to show the task overlay
    document.getElementById('navbar')!.addEventListener('wheel', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
        // https://github.com/minbrowser/min/issues/698
        return
      }
      if (e.deltaY < -30 && e.deltaX < 10) {
        taskOverlay.show()
        e.stopImmediatePropagation()
      }
    })

    keybindings.defineShortcut('toggleTasks', () => {
      if (taskOverlay.isShown) {
        taskOverlay.hide()
      } else {
        taskOverlay.show()
      }
    })

    keybindings.defineShortcut({ keys: 'esc' }, () => {
      taskOverlay.hide()
    })

    keybindings.defineShortcut('enterEditMode', () => {
      taskOverlay.hide()
    })

    keybindings.defineShortcut('addTask', addTaskFromMenu)
    ipcRenderer.on('addTask', addTaskFromMenu) // for menu item

    taskOverlay.taskSwitcherButton.title = l('viewTasks')
    taskOverlay.addTaskLabel.textContent = l('newTask')

    taskOverlay.taskSwitcherButton.addEventListener('click', () => {
      taskOverlay.toggle()
    })

    taskOverlay.addTaskButton.addEventListener('click', (_e) => {
      browserUI.addTask()
      taskOverlay.hide()
      tabEditor.show(window.tabs.getSelected()!)
    })

    taskOverlay.taskOverlayNavbar.addEventListener('click', () => {
      taskOverlay.hide()
    })

    window.tasks.on('state-sync-change', () => {
      if (taskOverlay.isShown) {
        taskOverlay.render()
      }
    })
  },
}

// module.exports = taskOverlay
