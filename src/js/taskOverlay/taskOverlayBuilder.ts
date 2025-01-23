// var browserUI = require('browserUI.js')

import { l } from '../../locales/localizationHelpers'
import * as browserUI from '../browserUI'
// var searchbarUtils = require('searchbar/searchbarUtils.js')
import * as searchbarUtils from '../searchbar/searchbarUtils'
import { TabList } from '../tabState/tab'
// var searchEngine = require('util/searchEngine.js')
import { searchEngine } from '../util/searchEngine'
// var urlParser = require('util/urlParser.js')
import { urlParser } from '../util/urlParser'

interface EventsType {
  tabDelete: any
  tabSelect: { call: (arg0: HTMLDivElement, arg1: MouseEvent) => void }
}

const faviconMinimumLuminance = 70 // minimum brightness for a "light" favicon

function getTaskRelativeDate(task: TaskType) {
  let minimumTime: Date | number = new Date()
  minimumTime.setHours(0)
  minimumTime.setMinutes(0)
  minimumTime.setSeconds(0)
  minimumTime = minimumTime.getTime()
  minimumTime -= 5 * 24 * 60 * 60 * 1000

  const time = window.tasks.getLastActivity(task.id!)
  const d = new Date(time)

  // don't show times for recent tasks in order to save space
  if (time > minimumTime) {
    return null
  }
  return new Intl.DateTimeFormat(navigator.language, { month: 'long', day: 'numeric', year: 'numeric' }).format(d)
}

function toggleCollapsed(taskContainer: HTMLElement, task: TaskType) {
  window.tasks.update(task.id!, { collapsed: !window.tasks.isCollapsed(task.id!) })
  taskContainer.classList.toggle('collapsed')

  const collapseButton = taskContainer.querySelector('.task-collapse-button')!
  collapseButton.classList.toggle('carbon:chevron-right')
  collapseButton.classList.toggle('carbon:chevron-down')

  if (window.tasks.isCollapsed(task.id!)) {
    collapseButton.setAttribute('aria-expanded', 'false')
  } else {
    collapseButton.setAttribute('aria-expanded', 'true')
  }
}

const TaskOverlayBuilder = {
  create: {
    task: {
      collapseButton(taskContainer: HTMLElement, task: TaskType) {
        const collapseButton = document.createElement('button')
        collapseButton.className = 'task-collapse-button i'
        collapseButton.setAttribute('tabindex', '-1')

        collapseButton.setAttribute('aria-haspopup', 'true')
        if (window.tasks.isCollapsed(task.id!)) {
          collapseButton.classList.add('carbon:chevron-right')
          collapseButton.setAttribute('aria-expanded', 'false')
        } else {
          collapseButton.classList.add('carbon:chevron-down')
          collapseButton.setAttribute('aria-expanded', 'true')
        }
        collapseButton.addEventListener('click', (e) => {
          e.stopPropagation()
          toggleCollapsed(taskContainer, task)
        })
        return collapseButton
      },
      nameInputField(task: TaskType, taskIndex: number) {
        const input = document.createElement('input')
        input.classList.add('task-name')
        input.classList.add('mousetrap')

        const taskName = l('defaultTaskName').replace('%n', (taskIndex + 1) as unknown as string)

        input.placeholder = taskName
        input.value = task.name || taskName
        input.spellcheck = false

        // eslint-disable-next-line func-names
        input.addEventListener('keyup', function (e) {
          if (e.keyCode === 13) {
            this.blur()
          }

          window.tasks.update(task.id!, { name: this.value })
        })

        // eslint-disable-next-line func-names
        input.addEventListener('focusin', function (_e) {
          if (window.tasks.isCollapsed(task.id!)) {
            this.blur()
            return
          }
          this.select()
        })
        return input
      },
      deleteButton(container: HTMLElement, task: TaskType) {
        const deleteButton = document.createElement('button')
        deleteButton.className = 'task-delete-button i carbon:trash-can'
        deleteButton.tabIndex = -1 // needed for keyboardNavigationHelper

        deleteButton.addEventListener('click', (_e) => {
          if ((task.tabs as TabList).isEmpty()) {
            container.remove()
            browserUI.closeTask(task.id!)
          } else {
            container.classList.add('deleting')
            setTimeout(() => {
              if (container.classList.contains('deleting')) {
                container.style.opacity = '0'
                // transitionend would be nice here, but it doesn't work if the element is removed from the DOM
                setTimeout(() => {
                  container.remove()
                  browserUI.closeTask(task.id!)
                }, 500)
              }
            }, 10000)
          }
        })
        return deleteButton
      },
      deleteWarning(container: HTMLElement, _task: TaskType) {
        const deleteWarning = document.createElement('div')
        deleteWarning.className = 'task-delete-warning'

        deleteWarning.innerHTML = l('taskDeleteWarning').unsafeHTML
        deleteWarning.addEventListener('click', (_e) => {
          container.classList.remove('deleting')
        })
        return deleteWarning
      },

      actionContainer(taskContainer: HTMLElement, task: TaskType, taskIndex: number) {
        const taskActionContainer = document.createElement('div')
        taskActionContainer.className = 'task-action-container'

        // add the collapse button
        const collapseButton = this.collapseButton(taskContainer, task)
        taskActionContainer.appendChild(collapseButton)

        // add the input for the task name
        const input = this.nameInputField(task, taskIndex)
        taskActionContainer.appendChild(input)

        // add the delete button
        const deleteButton = this.deleteButton(taskContainer, task)
        taskActionContainer.appendChild(deleteButton)

        return taskActionContainer
      },
      infoContainer(task: TaskType) {
        const infoContainer = document.createElement('div')
        infoContainer.className = 'task-info-container'

        const date = getTaskRelativeDate(task)

        if (date) {
          const dateEl = document.createElement('span')
          dateEl.className = 'task-date'
          dateEl.textContent = date
          infoContainer.appendChild(dateEl)
        }

        const lastTabEl = document.createElement('span')
        lastTabEl.className = 'task-last-tab-title'
        let lastTabTitle = ((task.tabs as TabList).get() as TabType[]).sort(
          (a, b) => b.lastActivity! - a.lastActivity!,
        )[0].title

        if (lastTabTitle) {
          lastTabTitle = searchbarUtils.getRealTitle(lastTabTitle)
          if (lastTabTitle.length > 40) {
            lastTabTitle = `${lastTabTitle.substring(0, 40)}...`
          }
          lastTabEl.textContent = searchbarUtils.getRealTitle(lastTabTitle)
        }
        infoContainer.appendChild(lastTabEl)

        let favicons: { url: string; luminance: number }[] = []
        const faviconURLs: string[] = []

        ;((task.tabs as TabList).get() as TabType[])
          .sort((a, b) => b.lastActivity! - a.lastActivity!)
          .forEach((tab) => {
            if (tab.favicon) {
              favicons.push(tab.favicon as { url: string; luminance: number })
              faviconURLs.push((tab.favicon as { url: string; luminance: number }).url)
            }
          })

        if (favicons.length > 0) {
          const faviconsEl = document.createElement('span')
          faviconsEl.className = 'task-favicons'
          favicons = favicons.filter((i, idx) => faviconURLs.indexOf(i.url) === idx)

          favicons.forEach((favicon) => {
            const img = document.createElement('img')
            img.src = favicon.url
            if (favicon.luminance < faviconMinimumLuminance) {
              img.classList.add('dark-favicon')
            }
            faviconsEl.appendChild(img)
          })

          infoContainer.appendChild(faviconsEl)
        }

        return infoContainer
      },
      container(task: TaskType, taskIndex: number, events: EventsType) {
        const container = document.createElement('div')
        container.className = 'task-container'

        if (task.id !== window.tasks.getSelected()!.id && window.tasks.isCollapsed(task.id!)) {
          container.classList.add('collapsed')
        }
        if (task.id === window.tasks.getSelected()!.id) {
          container.classList.add('selected')
        }
        container.setAttribute('data-task', task.id!)

        container.addEventListener('click', (_e) => {
          if (window.tasks.isCollapsed(task.id!)) {
            toggleCollapsed(container, task)
          }
        })

        const taskActionContainer = this.actionContainer(container, task, taskIndex)
        container.appendChild(taskActionContainer)

        const infoContainer = this.infoContainer(task)
        container.appendChild(infoContainer)

        const deleteWarning = this.deleteWarning(container, task)
        container.appendChild(deleteWarning)

        const tabContainer = TaskOverlayBuilder.create.tab.container(task, events)
        container.appendChild(tabContainer)

        return container
      },
    },

    tab: {
      element(_tabContainer: HTMLUListElement, _task: TaskType, tab: TabType, events: EventsType) {
        const data = {
          classList: ['task-tab-item'],
          delete: events.tabDelete,
          showDeleteButton: true,
          icon: '',
          iconImage: '',
          title: '',
          secondaryText: '',
        }

        if (tab.private) {
          data.icon = 'carbon:view-off'
        } else if (tab.favicon) {
          data.iconImage = (tab.favicon as { url: string; luminance: number }).url

          if (
            (tab.favicon as { url: string; luminance: number }).luminance &&
            (tab.favicon as { url: string; luminance: number }).luminance < faviconMinimumLuminance
          ) {
            data.classList.push('has-dark-favicon')
          }
        }

        const source = urlParser.getSourceURL(tab.url!)
        const searchQuery = searchEngine.getSearch(source)

        if (searchQuery) {
          data.title = searchQuery.search!
          data.secondaryText = searchQuery.engine
        } else {
          data.title = tab.title || l('newTabLabel')
          data.secondaryText = urlParser.basicURL(source)
        }

        const el = searchbarUtils.createItem(data)

        el.setAttribute('data-tab', tab.id!)

        // eslint-disable-next-line func-names
        el.addEventListener('click', function (e) {
          if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
            events.tabSelect.call(this, e)
          }
        })
        return el
      },

      container(task: TaskType, events: EventsType) {
        const tabContainer = document.createElement('ul')
        tabContainer.className = 'task-tabs-container'
        tabContainer.setAttribute('data-task', task.id!)

        if (task.tabs) {
          for (let i = 0; i < (task.tabs as TabList).count(); i++) {
            const el = this.element(tabContainer, task, (task.tabs as TabList).getAtIndex(i), events)
            tabContainer.appendChild(el)
          }
        }

        return tabContainer
      },
    },
  },
  // extend with other helper functions?
}

export function createTaskContainer(task: TaskType, index: number, events: EventsType) {
  return TaskOverlayBuilder.create.task.container(task, index, events)
}
