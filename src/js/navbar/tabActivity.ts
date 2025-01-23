/* fades out tabs that are inactive */

// var tabBar = require('navbar/tabBar.js')
import { tabBar } from './tabBar'

export const tabActivity = {
  minFadeAge: 330000,
  refresh() {
    requestAnimationFrame(() => {
      const tabSet = window.tabs.get() as TabType[]
      const selected = window.tabs.getSelected()
      const time = Date.now()

      tabSet.forEach((tab) => {
        if (selected === tab.id) {
          // never fade the current tab
          tabBar.getTab(tab.id!).classList.remove('fade')
          return
        }
        if (time - tab.lastActivity! > tabActivity.minFadeAge) {
          // the tab has been inactive for greater than minActivity, and it is not currently selected
          tabBar.getTab(tab.id!).classList.add('fade')
        } else {
          tabBar.getTab(tab.id!).classList.remove('fade')
        }
      })
    })
  },
  initialize() {
    setInterval(tabActivity.refresh, 7500)

    window.tasks.on('tab-selected', this.refresh)
  },
}

// module.exports = tabActivity
