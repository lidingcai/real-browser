// const keybindings = require('keybindings.js')
// var browserUI = require('browserUI.js')
import { clipboard, ipcRenderer as ipc } from 'electron'

import * as browserUI from './browserUI'
// var focusMode = require('focusMode.js')
import focusMode from './focusMode'
import * as keybindings from './keybindings'
// var modalMode = require('modalMode.js')
import { modalMode } from './modalMode'
// var tabEditor = require('navbar/tabEditor.js')
import { tabEditor } from './navbar/tabEditor'
// var webviews = require('webviews.js')
import { webviews } from './webviews'

// const { tasks, tabs } = window

export const defaultKeybindings = {
  initialize() {
    keybindings.defineShortcut('quitMin', () => {
      ipc.send('quit')
    })

    keybindings.defineShortcut('addTab', () => {
      /* new tabs can't be created in modal mode */
      if (modalMode.enabled()) {
        return
      }

      /* new tabs can't be created in focus mode */
      if (focusMode.enabled()) {
        focusMode.warn()
        return
      }

      browserUI.addTab()
    })

    keybindings.defineShortcut('addPrivateTab', () => {
      /* new tabs can't be created in modal mode */
      if (modalMode.enabled()) {
        return
      }

      /* new tabs can't be created in focus mode */
      if (focusMode.enabled()) {
        focusMode.warn()
        return
      }

      browserUI.addTab(
        window.tabs.add({
          private: true,
        }),
      )
    })

    keybindings.defineShortcut('duplicateTab', () => {
      if (modalMode.enabled()) {
        return
      }

      if (focusMode.enabled()) {
        focusMode.warn()
        return
      }

      const sourceTab = window.tabs.get(window.tabs.getSelected()!) as TabType
      // strip tab id so that a new one is generated
      const newTab = window.tabs.add({ ...sourceTab, id: undefined })

      browserUI.addTab(newTab, { enterEditMode: false })
    })

    keybindings.defineShortcut('enterEditMode', () => {
      tabEditor.show(window.tabs.getSelected()!)
      return false
    })

    keybindings.defineShortcut('runShortcut', () => {
      tabEditor.show(window.tabs.getSelected()!, '!')
    })

    keybindings.defineShortcut('closeTab', () => {
      browserUI.closeTab(window.tabs.getSelected()!)
    })

    keybindings.defineShortcut('moveTabLeft', () => {
      browserUI.moveTabLeft(window.tabs.getSelected()!)
    })

    keybindings.defineShortcut('moveTabRight', () => {
      browserUI.moveTabRight(window.tabs.getSelected()!)
    })

    keybindings.defineShortcut('restoreTab', () => {
      if (focusMode.enabled()) {
        focusMode.warn()
        return
      }

      const restoredTab = window.tasks.getSelected()!.tabHistory.pop()

      // The tab history stack is empty
      if (!restoredTab) {
        return
      }

      browserUI.addTab(window.tabs.add(restoredTab), {
        enterEditMode: false,
      })
    })

    keybindings.defineShortcut('addToFavorites', () => {
      tabEditor.show(window.tabs.getSelected()!, undefined, false)
      // we need to show the bookmarks button, which is only visible in edit mode
      ;(tabEditor.container.querySelector('.bookmarks-button') as HTMLButtonElement).click()
    })

    keybindings.defineShortcut('showBookmarks', () => {
      tabEditor.show(window.tabs.getSelected()!, '!bookmarks ')
    })

    // cmd+x should switch to tab x. Cmd+9 should switch to the last tab

    for (let i = 1; i < 9; i++) {
      ;((i) => {
        keybindings.defineShortcut({ keys: `mod+${i}` }, () => {
          const currentIndex = window.tabs.getIndex(window.tabs.getSelected()!)
          const newTab = window.tabs.getAtIndex(currentIndex + i) || window.tabs.getAtIndex(currentIndex - i)
          if (newTab) {
            browserUI.switchToTab(newTab.id!)
          }
        })

        keybindings.defineShortcut({ keys: `shift+mod+${i}` }, () => {
          const currentIndex = window.tabs.getIndex(window.tabs.getSelected()!)
          const newTab = window.tabs.getAtIndex(currentIndex - i) || window.tabs.getAtIndex(currentIndex + i)
          if (newTab) {
            browserUI.switchToTab(newTab.id!)
          }
        })
      })(i)
    }

    keybindings.defineShortcut('gotoLastTab', () => {
      browserUI.switchToTab(window.tabs.getAtIndex(window.tabs.count() - 1).id!)
    })

    keybindings.defineShortcut('gotoFirstTab', () => {
      browserUI.switchToTab(window.tabs.getAtIndex(0).id!)
    })

    keybindings.defineShortcut({ keys: 'esc' }, () => {
      if (webviews.placeholderRequests.length === 0 && document.activeElement!.tagName !== 'INPUT') {
        webviews.callAsync(window.tabs.getSelected()!, 'stop')
      }

      tabEditor.hide()

      if (modalMode.enabled() && modalMode.onDismiss) {
        modalMode.onDismiss()
        modalMode.onDismiss = null
      }

      // exit full screen mode
      webviews.callAsync(
        window.tabs.getSelected()!,
        'executeJavaScript',
        'if(document.webkitIsFullScreen){document.webkitExitFullscreen()}',
      )

      webviews.callAsync(window.tabs.getSelected()!, 'focus')
    })

    keybindings.defineShortcut('goBack', () => {
      webviews.callAsync(window.tabs.getSelected()!, 'goBack')
    })

    keybindings.defineShortcut('goForward', () => {
      webviews.callAsync(window.tabs.getSelected()!, 'goForward')
    })

    keybindings.defineShortcut('switchToPreviousTab', () => {
      const currentIndex = window.tabs.getIndex(window.tabs.getSelected()!)
      const previousTab = window.tabs.getAtIndex(currentIndex - 1)

      if (previousTab) {
        browserUI.switchToTab(previousTab.id!)
      } else {
        browserUI.switchToTab(window.tabs.getAtIndex(window.tabs.count() - 1).id!)
      }
    })

    keybindings.defineShortcut('switchToNextTab', () => {
      const currentIndex = window.tabs.getIndex(window.tabs.getSelected()!)
      const nextTab = window.tabs.getAtIndex(currentIndex + 1)

      if (nextTab) {
        browserUI.switchToTab(nextTab.id!)
      } else {
        browserUI.switchToTab(window.tabs.getAtIndex(0).id!)
      }
    })

    keybindings.defineShortcut('switchToNextTask', () => {
      if (focusMode.enabled()) {
        focusMode.warn()
        return
      }

      const taskSwitchList = window.tasks.filter((t) => !window.tasks.isCollapsed(t.id!))

      const currentTaskIdx = taskSwitchList.findIndex((t) => t.id === window.tasks.getSelected()!.id)

      const nextTask = taskSwitchList[currentTaskIdx + 1] || taskSwitchList[0]
      browserUI.switchToTask(nextTask.id!)
    })

    keybindings.defineShortcut('switchToPreviousTask', () => {
      if (focusMode.enabled()) {
        focusMode.warn()
        return
      }

      const taskSwitchList = window.tasks.filter((t) => !window.tasks.isCollapsed(t.id!))

      const currentTaskIdx = taskSwitchList.findIndex((t) => t.id === window.tasks.getSelected()!.id)
      // taskCount = taskSwitchList.length

      const previousTask = taskSwitchList[currentTaskIdx - 1] || taskSwitchList[taskSwitchList.length - 1]
      browserUI.switchToTask(previousTask.id!)
    })

    // shift+option+cmd+x should switch to task x

    for (let i = 1; i < 10; i++) {
      ;((i) => {
        keybindings.defineShortcut({ keys: `shift+option+mod+${i}` }, () => {
          if (focusMode.enabled()) {
            focusMode.warn()
            return
          }

          const taskSwitchList = window.tasks.filter((t) => !window.tasks.isCollapsed(t.id!))
          if (taskSwitchList[i - 1]) {
            browserUI.switchToTask(taskSwitchList[i - 1].id!)
          }
        })
      })(i)
    }

    keybindings.defineShortcut('closeAllTabs', () => {
      // destroys all current tabs, and creates a new, empty tab. Kind of like creating a new window, except the old window disappears.
      if (focusMode.enabled()) {
        focusMode.warn()
        return
      }

      const tset = window.tabs.get() as TabType[]
      for (let i = 0; i < tset.length; i++) {
        browserUI.destroyTab(tset[i].id!)
      }

      browserUI.addTab() // create a new, blank tab
    })

    keybindings.defineShortcut('closeWindow', () => {
      ipc.invoke('close')
    })

    keybindings.defineShortcut('reload', () => {
      if ((window.tabs.get(window.tabs.getSelected()!) as TabType).url!.startsWith(webviews.internalPages.error)) {
        // reload the original page rather than show the error page again
        webviews.update(
          window.tabs.getSelected()!,
          new URL((window.tabs.get(window.tabs.getSelected()!) as TabType).url!).searchParams.get('url')!,
        )
      } else {
        // this can't be an error page, use the normal reload method
        webviews.callAsync(window.tabs.getSelected()!, 'reload')
      }
    })

    keybindings.defineShortcut('reloadIgnoringCache', () => {
      webviews.callAsync(window.tabs.getSelected()!, 'reloadIgnoringCache')
    })

    keybindings.defineShortcut('showHistory', () => {
      tabEditor.show(window.tabs.getSelected()!, '!history ')
    })

    keybindings.defineShortcut('copyPageURL', () => {
      const tab = window.tabs.get(window.tabs.getSelected()!) as TabType
      const anchorTag = document.createElement('a')
      anchorTag.href = tab.url!
      anchorTag.textContent = tab.url!

      clipboard.write({
        text: tab.url,
        bookmark: tab.title,
        html: anchorTag.outerHTML,
      })
    })
  },
}

// module.exports = defaultKeybindings
