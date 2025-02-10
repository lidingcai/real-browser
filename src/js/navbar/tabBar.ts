import EventEmitter from 'node:events'

import dragula, { Drake } from 'dragula'

import { l } from '../../locales'
import * as browserUI from '../browserUI'
// const focusMode = require('focusMode.js')
import focusMode from '../focusMode'
// const readerView = require('readerView.js')
import { readerView } from '../readerView'
// const tabAudio = require('tabAudio.js')
import { tabAudio } from '../tabAudio'
import { TabList } from '../tabState/tab'
// const settings = require('util/settings/settings.js')
import { settings } from '../util/settings/settings'
// const urlParser = require('util/urlParser.js')
import { urlParser } from '../util/urlParser'
// const webviews = require('webviews.js')
import { webviews } from '../webviews'
// const permissionRequests = require('navbar/permissionRequests.js')
import { permissionRequests } from './permissionRequests'
// const progressBar = require('navbar/progressBar.js')
import { progressBar } from './progressBar'
// const keybindings = require('keybindings.js')
// import * as keybindings from '../keybindings'
// const tabEditor = require('navbar/tabEditor.js')
import { tabEditor } from './tabEditor'

let lastTabDeletion = 0 // TODO get rid of this

export const tabBar = {
  navBar: null as unknown as HTMLElement,
  container: null as unknown as HTMLElement,
  containerInner: null as unknown as HTMLElement,
  tabElementMap: {} as Record<string, HTMLElement>, // tabId: tab element
  events: null as unknown as EventEmitter,
  dragulaInstance: null as null | Drake,

  getTab(tabId: string) {
    return tabBar.tabElementMap[tabId]
  },

  getTabInput(tabId: string) {
    return tabBar.getTab(tabId).querySelector('.tab-input')
  },

  setActiveTab(tabId: string) {
    const activeTab = document.querySelector('.tab-item.active')

    if (activeTab) {
      activeTab.classList.remove('active')
      activeTab.removeAttribute('aria-selected')
    }

    const el = tabBar.getTab(tabId)
    el.classList.add('active')
    el.setAttribute('aria-selected', 'true')

    requestAnimationFrame(() => {
      el.scrollIntoView()
    })
  },

  createTab(data: TabType) {
    const tabEl = document.createElement('div')
    tabEl.className = 'tab-item'
    tabEl.setAttribute('data-tab', data.id!)
    tabEl.setAttribute('role', 'tab')

    tabEl.appendChild(readerView.getButton(data.id!))
    tabEl.appendChild(tabAudio.getButton(data.id!))
    tabEl.appendChild(progressBar.create())

    // icons

    const iconArea = document.createElement('span')
    iconArea.className = 'tab-icon-area'

    if (data.private) {
      const pbIcon = document.createElement('i')
      pbIcon.className = 'icon-tab-is-private tab-icon tab-info-icon i carbon:view-off'
      iconArea.appendChild(pbIcon)
    }

    const closeTabButton = document.createElement('button')
    closeTabButton.className = 'tab-icon tab-close-button i carbon:close'

    closeTabButton.addEventListener('click', (e) => {
      tabBar.events.emit('tab-closed', data.id)
      // prevent the searchbar from being opened
      e.stopPropagation()
    })

    iconArea.appendChild(closeTabButton)

    tabEl.appendChild(iconArea)

    // title

    const title = document.createElement('span')
    title.className = 'title'

    tabEl.appendChild(title)

    // click to enter edit mode or switch to a tab
    tabEl.addEventListener('click', (_e) => {
      if ((window.tabs as TabList).getSelected() !== data.id) {
        // else switch to tab if it isn't focused
        tabBar.events.emit('tab-selected', data.id)
      } else {
        // the tab is focused, edit tab instead
        tabEditor.show(data.id!, '', undefined)
      }
    })

    tabEl.addEventListener('auxclick', (e) => {
      if (e.which === 2) {
        // if mouse middle click -> close tab
        tabBar.events.emit('tab-closed', data.id)
      }
    })

    // eslint-disable-next-line func-names
    tabEl.addEventListener('wheel', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
        // https://github.com/minbrowser/min/issues/698
        return
      }
      if (e.deltaY > 65 && e.deltaX < 10 && Date.now() - lastTabDeletion > 900) {
        // swipe up to delete tabs
        lastTabDeletion = Date.now()

        /* tab deletion is disabled in focus mode */
        if (focusMode.enabled()) {
          focusMode.warn()
          return
        }

        this.style.transform = 'translateY(-100%)'

        setTimeout(() => {
          tabBar.events.emit('tab-closed', data.id)
        }, 150) // wait until the animation has completed
      }
    })

    tabBar.updateTab(data.id!, tabEl)

    return tabEl
  },

  updateTab(tabId: string, tabEl: HTMLElement | undefined = undefined) {
    if (tabEl === undefined) {
      tabEl = tabBar.getTab(tabId)
    }
    const tabData = (window.tabs as TabList).get(tabId) as TabType

    // update tab title
    let tabTitle

    const isNewTab = tabData.url === '' || tabData.url === urlParser.parse('min://newtab')
    if (isNewTab) {
      tabTitle = l('newTabLabel')
    } else if (tabData.title) {
      tabTitle = tabData.title
    } else if (tabData.loaded) {
      tabTitle = tabData.url
    }

    tabTitle = (tabTitle || l('newTabLabel')).substring(0, 500)

    const titleEl = tabEl.querySelector('.title') as HTMLElement
    titleEl.textContent = tabTitle

    tabEl.title = tabTitle
    if (tabData.private) {
      tabEl.title += ` (${l('privateTab')})`
    }

    // update tab audio icon
    const audioButton = tabEl.querySelector('.tab-audio-button') as HTMLButtonElement
    tabAudio.updateButton(tabId, audioButton)

    tabEl.querySelectorAll('.permission-request-icon').forEach((el) => el.remove())

    permissionRequests
      .getButtons(tabId)
      .reverse()
      .forEach((button) => {
        tabEl!.insertBefore(button, tabEl!.children[0])
      })

    const iconArea = tabEl.getElementsByClassName('tab-icon-area')[0]

    let insecureIcon = tabEl.getElementsByClassName('icon-tab-not-secure')[0] as HTMLElement
    if (tabData.secure === true && insecureIcon) {
      insecureIcon.remove()
    } else if (tabData.secure === false && !insecureIcon) {
      insecureIcon = document.createElement('i')
      insecureIcon.className = 'icon-tab-not-secure tab-icon tab-info-icon i carbon:unlocked'
      insecureIcon.title = l('connectionNotSecure')
      iconArea.appendChild(insecureIcon)
    }
  },

  updateAll() {
    window.empty(tabBar.containerInner)
    tabBar.tabElementMap = {}
    ;((window.tabs as TabList).get() as TabType[]).forEach((tab) => {
      const el = tabBar.createTab(tab)
      tabBar.containerInner.appendChild(el)
      tabBar.tabElementMap[tab.id!] = el
    })

    if ((window.tabs as TabList).getSelected()) {
      tabBar.setActiveTab((window.tabs as TabList).getSelected()!)
    }
  },
  addTab(tabId: string) {
    const tab = (window.tabs as TabList).get(tabId) as TabType
    const index = (window.tabs as TabList).getIndex(tabId)

    const tabEl = tabBar.createTab(tab)
    tabBar.containerInner.insertBefore(tabEl, tabBar.containerInner.childNodes[index])
    tabBar.tabElementMap[tabId] = tabEl
  },
  removeTab(tabId: string) {
    const tabEl = tabBar.getTab(tabId)
    if (tabEl) {
      // The tab does not have a corresponding .tab-item element.
      // This happens when destroying tabs from other task where this .tab-item is not present
      tabBar.containerInner.removeChild(tabEl)
      delete tabBar.tabElementMap[tabId]
    }
  },
  handleDividerPreference(dividerPreference: boolean) {
    if (dividerPreference === true) {
      tabBar.navBar.classList.add('show-dividers')
    } else {
      tabBar.navBar.classList.remove('show-dividers')
    }
  },

  initializeTabDragging() {
    tabBar.dragulaInstance = dragula([document.getElementById('tabs-inner') as Element], {
      direction: 'horizontal',
      // slideFactorX: 25,
    })

    tabBar.dragulaInstance.on('drop', (el: Element, _target: Element, _source: Element, sibling: Element) => {
      const tabId = el.getAttribute('data-tab')!
      let adjacentTabId = ''
      if (sibling) {
        adjacentTabId = sibling.getAttribute('data-tab')!
      }

      const oldTab = window.tabs.splice((window.tabs as TabList).getIndex(tabId), 1)[0]

      let newIdx
      if (adjacentTabId) {
        newIdx = (window.tabs as TabList).getIndex(adjacentTabId)
      } else {
        // tab was inserted at end
        newIdx = (window.tabs as TabList).count()
      }

      window.tabs.splice(newIdx, 0, oldTab)
    })
  },
  initialize() {
    tabBar.navBar = document.getElementById('navbar') as HTMLElement
    tabBar.container = document.getElementById('tabs') as HTMLElement
    tabBar.containerInner = document.getElementById('tabs-inner') as HTMLElement
    tabBar.tabElementMap = {} as Record<string, HTMLElement> // tabId: tab element
    tabBar.events = new EventEmitter()

    settings.listen('showDividerBetweenTabs', (dividerPreference: boolean) => {
      tabBar.handleDividerPreference(dividerPreference)
    })

    webviews.bindEvent('did-start-loading', (tabId: string) => {
      progressBar.update(tabBar.getTab(tabId).querySelector('.progress-bar')! as HTMLDivElement, 'start')
      ;(window.tabs as TabList).update(tabId, { loaded: false })
    })

    webviews.bindEvent('did-stop-loading', (tabId: string) => {
      progressBar.update(tabBar.getTab(tabId).querySelector('.progress-bar')!, 'finish')
      window.tabs.update(tabId, { loaded: true })
      tabBar.updateTab(tabId)
    })

    window.tasks.on('tab-updated', (id: string, key: string) => {
      const updateKeys = ['title', 'secure', 'url', 'muted', 'hasAudio']
      if (updateKeys.includes(key)) {
        tabBar.updateTab(id)
      }
    })

    permissionRequests.onChange((tabId: string) => {
      if (window.tabs.get(tabId)) {
        tabBar.updateTab(tabId)
      }
    })

    tabBar.initializeTabDragging()

    tabBar.container.addEventListener('dragover', (e: Event) => e.preventDefault())

    tabBar.container.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault()
      const data = e.dataTransfer!
      browserUI.addTab(
        window.tabs.add({
          url: data.files[0] ? `file://${data.files[0].path}` : data.getData('text'),
          private: (window.tabs.get(window.tabs.getSelected()!) as TabType).private,
        }),
        { enterEditMode: false, openInBackground: !settings.get('openTabsInForeground') },
      )
    })
  },
}

/*
settings.listen('showDividerBetweenTabs', (dividerPreference: boolean) => {
  tabBar.handleDividerPreference(dividerPreference)
})

webviews.bindEvent('did-start-loading', (tabId: string) => {
  progressBar.update(tabBar.getTab(tabId).querySelector('.progress-bar')! as HTMLDivElement, 'start')
  ;(window.tabs as TabList).update(tabId, { loaded: false })
})

webviews.bindEvent('did-stop-loading', (tabId: string) => {
  progressBar.update(tabBar.getTab(tabId).querySelector('.progress-bar')!, 'finish')
  window.tabs.update(tabId, { loaded: true })
  tabBar.updateTab(tabId)
})

window.tasks.on('tab-updated', (id: string, key: string) => {
  const updateKeys = ['title', 'secure', 'url', 'muted', 'hasAudio']
  if (updateKeys.includes(key)) {
    tabBar.updateTab(id)
  }
})

permissionRequests.onChange((tabId: string) => {
  if (window.tabs.get(tabId)) {
    tabBar.updateTab(tabId)
  }
})

tabBar.initializeTabDragging()

tabBar.container.addEventListener('dragover', (e: Event) => e.preventDefault())

tabBar.container.addEventListener('drop', (e: DragEvent) => {
  e.preventDefault()
  const data = e.dataTransfer!
  browserUI.addTab(
    window.tabs.add({
      url: data.files[0] ? `file://${data.files[0].path}` : data.getData('text'),
      private: (window.tabs.get(window.tabs.getSelected()!) as TabType).private,
    }),
    { enterEditMode: false, openInBackground: !settings.get('openTabsInForeground') },
  )
})
*/
// module.exports = tabBar
