// var searchbarPlugins = require('searchbar/searchbarPlugins.js')
// var browserUI = require('browserUI.js')
import { l } from '../../locales'
import * as browserUI from '../browserUI'
import { TabList } from '../tabState/tab'
import { searchbarPlugins } from './searchbarPlugins'
// var searchbarUtils = require('searchbar/searchbarUtils.js')
import * as searchbarUtils from './searchbarUtils'

// const { tasks } = window
function getFormattedTitle(tab: TabType) {
  if (tab.title) {
    const title = searchbarUtils.getRealTitle(tab.title)
    return `"${title.length > 45 ? `${title.substring(0, 45).trim()}...` : title}"`
  }
  return l('newTabLabel')
}

function showRestoreTask() {
  searchbarPlugins.reset('restoreTask')

  const lastTask = window.tasks.slice().sort((a, b) => {
    return window.tasks.getLastActivity(b.id!) - window.tasks.getLastActivity(a.id!)
  })[1]
  const recentTabs = ((lastTask.tabs as TabList).get() as TabType[])
    .sort((a, b) => b.lastActivity! - a.lastActivity!)
    .slice(0, 3)

  let taskDescription
  if (recentTabs.length === 1) {
    taskDescription = getFormattedTitle(recentTabs[0])
  } else if (recentTabs.length === 2) {
    taskDescription = l('taskDescriptionTwo')
      .replace('%t', getFormattedTitle(recentTabs[0]))
      .replace('%t', getFormattedTitle(recentTabs[1]))
  } else {
    taskDescription = l('taskDescriptionThree')
      .replace('%t', getFormattedTitle(recentTabs[0]))
      .replace('%t', getFormattedTitle(recentTabs[1]))
      .replace('%n', ((lastTask.tabs as TabList).count() - 2) as unknown as string)
  }

  searchbarPlugins.addResult('restoreTask', {
    title: l('returnToTask'),
    descriptionBlock: taskDescription,
    icon: 'carbon:redo',
    click(_e) {
      const thisTask = window.tasks.getSelected()!.id
      browserUI.switchToTask(lastTask.id!)
      browserUI.closeTask(thisTask!)
    },
  })
}

export function initialize() {
  searchbarPlugins.register('restoreTask', {
    index: 0,
    trigger(text) {
      return (
        !text &&
        performance.now() < 15000 &&
        (window.tasks.getSelected()!.tabs as TabList).isEmpty() &&
        window.createdNewTaskOnStartup
      )
    },
    showResults: showRestoreTask,
  })
}

// module.exports = { initialize }
